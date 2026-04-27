'use server';
/**
 * Outbound webhook system for Lumxia.
 *
 * Events fired:
 *   document.indexed  — document finished processing successfully
 *   document.failed   — document processing failed
 *   query.answered    — a query was answered via the REST API or chat
 *
 * Payload format:
 *   { event: string, timestamp: number, tenantId: string, data: object }
 *
 * Signature header:
 *   X-Lumxia-Signature: sha256=<hex>   (HMAC-SHA256 of JSON body with webhook secret)
 */

import { createHmac, randomBytes } from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { getSessionUser } from '@/lib/auth-actions';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebhookEvent = 'document.indexed' | 'document.failed' | 'query.answered';

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  'document.indexed',
  'document.failed',
  'query.answered',
];

export interface WebhookRecord {
  webhookId: string;
  tenantId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;       // HMAC signing secret — never exposed after creation
  active: boolean;
  createdAt: number;
  lastFiredAt: number | null;
}

export interface WebhookSummary {
  webhookId: string;
  url: string;
  events: WebhookEvent[];
  createdAt: number;
  lastFiredAt: number | null;
}

const MAX_WEBHOOKS_PER_TENANT = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireAdminPro(user: Awaited<ReturnType<typeof getSessionUser>>, plan: string) {
  if (!user) throw new Error('Unauthorized.');
  if (user.role !== 'Admin') throw new Error('Only Admins can manage webhooks.');
  if (plan !== 'pro') throw new Error('Webhooks are available on the Pro plan.');
}

function validateWebhookUrl(url: string) {
  if (!url.startsWith('https://')) {
    throw new Error('Webhook URL must use HTTPS.');
  }
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid webhook URL.');
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createWebhook(
  url: string,
  events: WebhookEvent[]
): Promise<{ webhookId: string; secret: string }> {
  const user = await getSessionUser();

  // Load plan from Firestore (can't import getMyTenantQuota — circular — read directly)
  const tenantSnap = await adminDb.collection('tenants').doc(user!.tenantId).get();
  const plan = (tenantSnap.data()?.plan as string) ?? 'free';
  requireAdminPro(user, plan);

  validateWebhookUrl(url);

  if (!events.length) throw new Error('Select at least one event.');
  const invalidEvents = events.filter((e) => !WEBHOOK_EVENTS.includes(e));
  if (invalidEvents.length) throw new Error(`Unknown events: ${invalidEvents.join(', ')}`);

  // Enforce per-tenant cap
  const countSnap = await adminDb
    .collection('webhooks')
    .where('tenantId', '==', user!.tenantId)
    .where('active', '==', true)
    .get();
  if (countSnap.size >= MAX_WEBHOOKS_PER_TENANT) {
    throw new Error(`Maximum of ${MAX_WEBHOOKS_PER_TENANT} webhooks per workspace.`);
  }

  const webhookId = randomBytes(12).toString('hex');
  const secret = randomBytes(24).toString('hex'); // shown once to the user

  const record: WebhookRecord = {
    webhookId,
    tenantId: user!.tenantId,
    url: url.trim(),
    events,
    secret,
    active: true,
    createdAt: Date.now(),
    lastFiredAt: null,
  };

  await adminDb.collection('webhooks').doc(webhookId).set(record);
  return { webhookId, secret };
}

export async function listWebhooks(): Promise<WebhookSummary[]> {
  const user = await getSessionUser();
  if (!user || user.role !== 'Admin') throw new Error('Only Admins can list webhooks.');

  const snap = await adminDb
    .collection('webhooks')
    .where('tenantId', '==', user.tenantId)
    .where('active', '==', true)
    .get();

  return snap.docs
    .map((d) => {
      const r = d.data() as WebhookRecord;
      return {
        webhookId: r.webhookId,
        url: r.url,
        events: r.events,
        createdAt: r.createdAt,
        lastFiredAt: r.lastFiredAt,
      } satisfies WebhookSummary;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.role !== 'Admin') throw new Error('Only Admins can delete webhooks.');

  const ref = adminDb.collection('webhooks').doc(webhookId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Webhook not found.');
  if ((snap.data() as WebhookRecord).tenantId !== user.tenantId) {
    throw new Error('Not found.');
  }
  await ref.update({ active: false });
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Fire an event to all active webhooks for a tenant that subscribe to it.
 * Called internally from the ingestion flow and query route.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function dispatchWebhook(
  tenantId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const snap = await adminDb
      .collection('webhooks')
      .where('tenantId', '==', tenantId)
      .where('active', '==', true)
      .get();

    if (snap.empty) return;

    const payload = JSON.stringify({
      event,
      timestamp: Math.floor(Date.now() / 1000),
      tenantId,
      data,
    });

    const fires = snap.docs
      .map((d) => d.data() as WebhookRecord)
      .filter((w) => w.events.includes(event))
      .map((webhook) => fireWebhook(webhook, payload));

    await Promise.allSettled(fires);
  } catch (err) {
    console.error('[Webhook] dispatchWebhook error:', (err as Error).message);
  }
}

async function fireWebhook(webhook: WebhookRecord, payload: string): Promise<void> {
  const sig = 'sha256=' + createHmac('sha256', webhook.secret).update(payload).digest('hex');

  const attempt = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Lumxia-Webhooks/1.0',
          'X-Lumxia-Event': JSON.parse(payload).event,
          'X-Lumxia-Signature': sig,
        },
        body: payload,
        signal: controller.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(timeout);
    }
  };

  let success = false;
  try {
    success = await attempt();
  } catch {
    // retry once
    try {
      success = await attempt();
    } catch (retryErr) {
      console.warn('[Webhook] Delivery failed after retry:', webhook.webhookId, (retryErr as Error).message);
    }
  }

  if (success) {
    adminDb
      .collection('webhooks')
      .doc(webhook.webhookId)
      .update({ lastFiredAt: Date.now() })
      .catch(() => {});
  }
}

// ─── Test ping ────────────────────────────────────────────────────────────────

export async function sendTestPing(webhookId: string): Promise<{ success: boolean; statusCode: number }> {
  const user = await getSessionUser();
  if (!user || user.role !== 'Admin') throw new Error('Only Admins can test webhooks.');

  const snap = await adminDb.collection('webhooks').doc(webhookId).get();
  if (!snap.exists) throw new Error('Webhook not found.');
  const webhook = snap.data() as WebhookRecord;
  if (webhook.tenantId !== user.tenantId) throw new Error('Not found.');

  const payload = JSON.stringify({
    event: 'ping',
    timestamp: Math.floor(Date.now() / 1000),
    tenantId: user.tenantId,
    data: { message: 'This is a test ping from Lumxia.' },
  });

  const sig = 'sha256=' + createHmac('sha256', webhook.secret).update(payload).digest('hex');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Lumxia-Webhooks/1.0',
        'X-Lumxia-Event': 'ping',
        'X-Lumxia-Signature': sig,
      },
      body: payload,
      signal: controller.signal,
    });
    if (res.ok) {
      adminDb.collection('webhooks').doc(webhookId).update({ lastFiredAt: Date.now() }).catch(() => {});
    }
    return { success: res.ok, statusCode: res.status };
  } catch (err) {
    return { success: false, statusCode: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

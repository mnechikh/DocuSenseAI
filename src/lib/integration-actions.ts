'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getSessionUser } from '@/lib/auth-actions';
import { PLAN_DEFAULTS, type TenantPlan } from '@/lib/quota-constants';
import { randomUUID } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntegrationParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  testValue?: string;  // value to use when running test calls
}

export interface IntegrationRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string;       // Shown to the AI so it knows when to propose this action
  enabled: boolean;
  endpoint: string;          // HTTPS only
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: { key: string; value: string }[];  // Stored server-side only
  bodyTemplate: string;      // JSON string with {{paramName}} placeholders
  parameters: IntegrationParameter[];
  createdAt: number;
  updatedAt: number;
}

export type IntegrationSummary = Omit<IntegrationRecord, 'headers'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireAdmin(user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!user) throw new Error('Unauthorized.');
  if (user.role !== 'Admin') throw new Error('Only Admins can manage integrations.');
  return user;
}

function validateEndpoint(endpoint: string) {
  if (!endpoint.startsWith('https://')) {
    throw new Error('Endpoint must use HTTPS.');
  }
  try {
    new URL(endpoint);
  } catch {
    throw new Error('Invalid endpoint URL.');
  }
}

// Valid HTTP header name: token chars only (no @, spaces, etc.)
function isValidHeaderName(name: string): boolean {
  return /^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/.test(name);
}

function substituteParams(
  template: string,
  params: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = params[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });
}

/** Trim whitespace and auto-prepend `Bearer ` for bare Authorization tokens. */
function normalizeHeaderValue(key: string, value: string): string {
  const v = value.trim();
  if (key.trim().toLowerCase() === 'authorization' && v && !/^[A-Za-z]+ /u.test(v)) {
    return 'Bearer ' + v;
  }
  return v;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createIntegration(data: {
  name: string;
  description: string;
  endpoint: string;
  method: IntegrationRecord['method'];
  headers: { key: string; value: string }[];
  bodyTemplate: string;
  parameters: IntegrationParameter[];
}): Promise<{ id: string }> {
  const user = await getSessionUser();
  requireAdmin(user);
  validateEndpoint(data.endpoint);

  // Enforce per-plan integration quota
  const tenantSnap = await adminDb.doc(`tenants/${user!.tenantId}`).get();
  const tenantData = tenantSnap.data() as Record<string, unknown>;
  const tenantPlan = (tenantData.plan as TenantPlan) ?? 'free';
  const integrationQuota = (tenantData.integrationQuota as number) ?? PLAN_DEFAULTS[tenantPlan].integrationQuota;
  if (integrationQuota < 999) {
    const existingCount = (await adminDb.collection('integrations').where('tenantId', '==', user!.tenantId).count().get()).data().count;
    if (existingCount >= integrationQuota) {
      throw new Error(`Integration limit reached (${existingCount}/${integrationQuota}). Upgrade to Pro for unlimited integrations.`);
    }
  }

  const id = randomUUID();
  const now = Date.now();

  await adminDb.collection('integrations').doc(id).set({
    id,
    tenantId: user!.tenantId,
    name: data.name.trim(),
    description: data.description.trim(),
    enabled: true,
    endpoint: data.endpoint.trim(),
    method: data.method,
    headers: data.headers.filter((h) => h.key.trim() && isValidHeaderName(h.key.trim())).map(h => ({ key: h.key.trim(), value: normalizeHeaderValue(h.key, h.value) })),
    bodyTemplate: data.bodyTemplate,
    parameters: data.parameters,
    createdAt: now,
    updatedAt: now,
  } satisfies IntegrationRecord);

  return { id };
}

export async function listIntegrations(): Promise<IntegrationSummary[]> {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized.');

  const snap = await adminDb
    .collection('integrations')
    .where('tenantId', '==', user.tenantId)
    .where('enabled', '==', true)
    .get();

  return snap.docs
    .map((d) => {
      const r = d.data() as IntegrationRecord;
      // Strip headers (contain credentials) before returning to client
      const { headers: _headers, ...rest } = r;
      void _headers;
      return rest as IntegrationSummary;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listAllIntegrations(): Promise<IntegrationSummary[]> {
  const user = await getSessionUser();
  requireAdmin(user);

  const snap = await adminDb
    .collection('integrations')
    .where('tenantId', '==', user!.tenantId)
    .get();

  return snap.docs
    .map((d) => {
      const r = d.data() as IntegrationRecord;
      const { headers: _headers, ...rest } = r;
      void _headers;
      return rest as IntegrationSummary;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Returns the raw headers (including secret values) for an integration. Admin-only. */
export async function getIntegrationHeaders(id: string): Promise<{ key: string; value: string }[]> {
  const user = await getSessionUser();
  requireAdmin(user);
  const snap = await adminDb.collection('integrations').doc(id).get();
  if (!snap.exists) throw new Error('Integration not found.');
  const record = snap.data() as IntegrationRecord;
  if (record.tenantId !== user!.tenantId) throw new Error('Not found.');
  return record.headers ?? [];
}

export async function updateIntegration(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    enabled: boolean;
    endpoint: string;
    method: IntegrationRecord['method'];
    headers: { key: string; value: string }[];
    bodyTemplate: string;
    parameters: IntegrationParameter[];
  }>
): Promise<void> {
  const user = await getSessionUser();
  requireAdmin(user);

  const ref = adminDb.collection('integrations').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Integration not found.');
  if ((snap.data() as IntegrationRecord).tenantId !== user!.tenantId) {
    throw new Error('Not found.');
  }
  if (data.endpoint) validateEndpoint(data.endpoint);

  // Normalize header key/value whitespace and auto-prefix bare Authorization tokens
  const normalized = data.headers
    ? { ...data, headers: data.headers.map(h => ({ key: h.key.trim(), value: normalizeHeaderValue(h.key, h.value) })) }
    : data;

  await ref.update({ ...normalized, updatedAt: Date.now() });
}

export async function deleteIntegration(id: string): Promise<void> {
  const user = await getSessionUser();
  requireAdmin(user);

  const ref = adminDb.collection('integrations').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Integration not found.');
  if ((snap.data() as IntegrationRecord).tenantId !== user!.tenantId) {
    throw new Error('Not found.');
  }
  await ref.delete();
}

// ─── Execute ──────────────────────────────────────────────────────────────────

/**
 * Truncates an API response string while keeping JSON parseable.
 * - JSON array  → first 100 items re-stringified
 * - JSON object with array property → first 100 items of that array
 * - Other JSON  → pass through (objects are small enough)
 * - Not JSON    → hard cap at 50,000 chars
 */
function truncateResult(text: string): string {
  const ITEM_LIMIT = 100;
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const truncated = parsed.slice(0, ITEM_LIMIT);
      const out = JSON.stringify(truncated);
      return parsed.length > ITEM_LIMIT
        ? out.slice(0, -1) + ']' // already sliced, just return directly
        : out;
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const arrayKey = Object.keys(obj).find(
        (k) => Array.isArray(obj[k]) && (obj[k] as unknown[]).length > ITEM_LIMIT
      );
      if (arrayKey) {
        return JSON.stringify({
          ...obj,
          [arrayKey]: (obj[arrayKey] as unknown[]).slice(0, ITEM_LIMIT),
        });
      }
    }
    return text; // valid JSON that doesn't need truncation
  } catch {
    // Not JSON — cap at 50k chars so Firestore doesn't reject the document
    return text.length > 50_000 ? text.slice(0, 50_000) + '…' : text;
  }
}

export interface ExecuteIntegrationResult {
  success: boolean;
  statusCode: number;
  result: string;
  executedAt: number;
}

export async function executeIntegration(
  integrationId: string,
  parameters: Record<string, unknown>
): Promise<ExecuteIntegrationResult> {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized.');

  // Load full record including headers
  const snap = await adminDb.collection('integrations').doc(integrationId).get();
  if (!snap.exists) throw new Error('Integration not found.');

  const integration = snap.data() as IntegrationRecord;
  if (integration.tenantId !== user.tenantId) throw new Error('Not found.');
  if (!integration.enabled) throw new Error('Integration is disabled.');

  // Validate required parameters
  for (const param of integration.parameters) {
    if (param.required && (parameters[param.name] === undefined || parameters[param.name] === null)) {
      throw new Error(`Missing required parameter: ${param.name}`);
    }
  }

  // Build request headers
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Lumxia-Integration/1.0',
  };
  for (const { key, value } of integration.headers) {
    const k = key.trim();
    if (k && isValidHeaderName(k)) reqHeaders[k] = normalizeHeaderValue(k, value);
  }

  // Build body
  let body: string | undefined;
  if (integration.method !== 'GET' && integration.method !== 'DELETE') {
    const substituted = substituteParams(integration.bodyTemplate, parameters);
    // Validate the substituted string is valid JSON (or empty)
    if (substituted.trim()) {
      try {
        JSON.parse(substituted);
        body = substituted;
      } catch {
        // Treat as raw string body
        body = JSON.stringify({ data: substituted });
      }
    }
  }

  const executedAt = Date.now();
  let statusCode = 0;
  let result = '';

  try {
    const response = await fetch(integration.endpoint, {
      method: integration.method,
      headers: reqHeaders,
      body,
      signal: AbortSignal.timeout(15_000), // 15s timeout
    });

    statusCode = response.status;
    const text = await response.text();
    // JSON-aware truncation — keeps the response parseable for the UI renderer
    result = truncateResult(text);

    // Log execution (non-fatal)
    adminDb.collection('integrationLogs').add({
      integrationId,
      tenantId: user.tenantId,
      userId: user.uid,
      parameters,
      statusCode,
      success: response.ok,
      executedAt,
    }).catch(() => {});

    return { success: response.ok, statusCode, result, executedAt };
  } catch (err: unknown) {
    const msg = (err as Error).message ?? 'Network error';
    return { success: false, statusCode: 0, result: msg, executedAt };
  }
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export interface ImportEntry {
  name?: unknown;
  description?: unknown;
  endpoint?: unknown;
  method?: unknown;
  headers?: unknown;
  bodyTemplate?: unknown;
  parameters?: unknown;
  enabled?: unknown;
}

export interface ImportResult {
  created: number;
  errors: { index: number; name: string; message: string }[];
}

export async function importIntegrations(entries: ImportEntry[]): Promise<ImportResult> {
  const user = await getSessionUser();
  requireAdmin(user);

  // Enforce per-plan integration quota across the batch
  const tenantSnapImp = await adminDb.doc(`tenants/${user!.tenantId}`).get();
  const tenantDataImp = tenantSnapImp.data() as Record<string, unknown>;
  const tenantPlanImp = (tenantDataImp.plan as TenantPlan) ?? 'free';
  const importQuota = (tenantDataImp.integrationQuota as number) ?? PLAN_DEFAULTS[tenantPlanImp].integrationQuota;
  const existingCountSnap = await adminDb.collection('integrations').where('tenantId', '==', user!.tenantId).count().get();
  let slotsRemaining = importQuota >= 999 ? Infinity : importQuota - existingCountSnap.data().count;

  const errors: ImportResult['errors'] = [];
  let created = 0;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const label = typeof e.name === 'string' && e.name.trim() ? e.name.trim() : `entry #${i + 1}`;

    try {
      if (!e.name || typeof e.name !== 'string' || !e.name.trim()) {
        throw new Error('name is required');
      }
      if (!e.endpoint || typeof e.endpoint !== 'string') {
        throw new Error('endpoint is required');
      }
      validateEndpoint(e.endpoint);

      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      const method = (typeof e.method === 'string' ? e.method.toUpperCase() : 'POST') as IntegrationRecord['method'];
      if (!validMethods.includes(method)) {
        throw new Error(`method must be one of ${validMethods.join(', ')}`);
      }

      const headers: { key: string; value: string }[] = [];
      if (Array.isArray(e.headers)) {
        for (const h of e.headers) {
          if (h && typeof h === 'object' && typeof h.key === 'string' && typeof h.value === 'string') {
            const k = h.key.trim();
            if (k && isValidHeaderName(k)) headers.push({ key: k, value: h.value });
          }
        }
      }

      const parameters: IntegrationParameter[] = [];
      if (Array.isArray(e.parameters)) {
        for (const p of e.parameters) {
          if (p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim()) {
            parameters.push({
              name: p.name.trim(),
              type: ['string', 'number', 'boolean'].includes(p.type) ? p.type : 'string',
              description: typeof p.description === 'string' ? p.description : '',
              required: Boolean(p.required),
            });
          }
        }
      }

      if (slotsRemaining <= 0) {
        throw new Error(`Integration limit reached. Upgrade to Pro for unlimited integrations.`);
      }

      const id = randomUUID();
      const now = Date.now();
      await adminDb.collection('integrations').doc(id).set({
        id,
        tenantId: user!.tenantId,
        name: e.name.trim(),
        description: typeof e.description === 'string' ? e.description.trim() : '',
        enabled: e.enabled !== false,
        endpoint: (e.endpoint as string).trim(),
        method,
        headers,
        bodyTemplate: typeof e.bodyTemplate === 'string' ? e.bodyTemplate : '',
        parameters,
        createdAt: now,
        updatedAt: now,
      } satisfies IntegrationRecord);

      created++;
      slotsRemaining--;
    } catch (err: unknown) {
      errors.push({ index: i, name: label, message: (err as Error).message });
    }
  }

  return { created, errors };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportedIntegration {
  name: string;
  description: string;
  enabled: boolean;
  endpoint: string;
  method: IntegrationRecord['method'];
  bodyTemplate: string;
  parameters: IntegrationParameter[];
  // headers intentionally excluded — values are secrets
}

export async function exportIntegrations(): Promise<ExportedIntegration[]> {
  const user = await getSessionUser();
  requireAdmin(user);

  const snap = await adminDb
    .collection('integrations')
    .where('tenantId', '==', user!.tenantId)
    .get();

  return snap.docs
    .map((d) => {
      const r = d.data() as IntegrationRecord;
      return {
        name: r.name,
        description: r.description,
        enabled: r.enabled,
        endpoint: r.endpoint,
        method: r.method,
        bodyTemplate: r.bodyTemplate,
        parameters: r.parameters,
      } satisfies ExportedIntegration;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Bulk Test ────────────────────────────────────────────────────────────────

export interface TestIntegrationResult {
  id: string;
  name: string;
  success: boolean;
  statusCode: number;
  latencyMs: number;
  error: string;
}

export async function testIntegrations(ids: string[]): Promise<TestIntegrationResult[]> {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized.');

  const results = await Promise.allSettled(
    ids.map(async (id): Promise<TestIntegrationResult> => {
      const snap = await adminDb.collection('integrations').doc(id).get();
      if (!snap.exists) return { id, name: id, success: false, statusCode: 0, latencyMs: 0, error: 'Not found' };

      const integration = snap.data() as IntegrationRecord;
      if (integration.tenantId !== user.tenantId) {
        return { id, name: id, success: false, statusCode: 0, latencyMs: 0, error: 'Not found' };
      }

      // Build placeholder params — use testValue if set, otherwise fall back by type
      const testParams: Record<string, unknown> = {};
      for (const p of integration.parameters) {
        if (p.testValue?.trim()) {
          testParams[p.name] = p.type === 'number' ? Number(p.testValue) : p.type === 'boolean' ? p.testValue === 'true' : p.testValue.trim();
        } else {
          testParams[p.name] = p.type === 'number' ? 0 : p.type === 'boolean' ? false : '__test__';
        }
      }

      const start = Date.now();
      try {
        const res = await executeIntegration(id, testParams);
        return {
          id,
          name: integration.name,
          success: res.success,
          statusCode: res.statusCode,
          latencyMs: Date.now() - start,
          error: res.success ? '' : res.result.slice(0, 200),
        };
      } catch (err: unknown) {
        return {
          id,
          name: integration.name,
          success: false,
          statusCode: 0,
          latencyMs: Date.now() - start,
          error: (err as Error).message,
        };
      }
    })
  );

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { id: ids[i], name: ids[i], success: false, statusCode: 0, latencyMs: 0, error: (r.reason as Error).message }
  );
}

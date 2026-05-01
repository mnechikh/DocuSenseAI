'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getSessionUser } from '@/lib/auth-actions';
import { randomUUID } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntegrationParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
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
    headers: data.headers.filter((h) => h.key.trim() && isValidHeaderName(h.key.trim())),
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

  await ref.update({ ...data, updatedAt: Date.now() });
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
    if (k && isValidHeaderName(k)) reqHeaders[k] = value;
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
    // Truncate long responses
    result = text.length > 2000 ? text.slice(0, 2000) + '…' : text;

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

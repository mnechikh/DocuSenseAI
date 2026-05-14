'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getSessionUser } from '@/lib/auth-actions';
import { randomUUID } from 'crypto';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ConnectionRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  headers: { key: string; value: string }[];
  createdAt: number;
  updatedAt: number;
}

/** Client-safe view — header values are masked, only keys returned */
export interface ConnectionSummary {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  headerKeys: string[];  // keys only — values never sent to client
  createdAt: number;
  updatedAt: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function requireAdmin(user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!user) throw new Error('Unauthorized.');
  if (user.role !== 'Admin') throw new Error('Only Admins can manage connections.');
  return user;
}

function isValidHeaderName(name: string): boolean {
  return /^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/.test(name);
}

function normalizeHeaderValue(key: string, value: string): string {
  const v = value.trim();
  if (key.trim().toLowerCase() === 'authorization' && v && !/^[A-Za-z]+ /u.test(v)) {
    return 'Bearer ' + v;
  }
  return v;
}

function toSummary(r: ConnectionRecord): ConnectionSummary {
  return {
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    description: r.description,
    headerKeys: (r.headers ?? []).map((h) => h.key),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function createConnection(data: {
  name: string;
  description: string;
  headers: { key: string; value: string }[];
}): Promise<{ id: string }> {
  const user = await getSessionUser();
  requireAdmin(user);

  if (!data.name?.trim()) throw new Error('Connection name is required.');

  const id = randomUUID();
  const now = Date.now();

  const cleanHeaders = (data.headers ?? [])
    .filter((h) => h.key.trim() && isValidHeaderName(h.key.trim()))
    .map((h) => ({ key: h.key.trim(), value: normalizeHeaderValue(h.key, h.value) }));

  await adminDb.collection('connections').doc(id).set({
    id,
    tenantId: user!.tenantId,
    name: data.name.trim(),
    description: data.description?.trim() ?? '',
    headers: cleanHeaders,
    createdAt: now,
    updatedAt: now,
  } satisfies ConnectionRecord);

  return { id };
}

export async function listConnections(): Promise<ConnectionSummary[]> {
  const user = await getSessionUser();
  requireAdmin(user);

  const snap = await adminDb
    .collection('connections')
    .where('tenantId', '==', user!.tenantId)
    .get();

  return snap.docs
    .map((d) => toSummary(d.data() as ConnectionRecord))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateConnection(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    headers: { key: string; value: string }[];
  }>
): Promise<void> {
  const user = await getSessionUser();
  requireAdmin(user);

  const ref = adminDb.collection('connections').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Connection not found.');
  if ((snap.data() as ConnectionRecord).tenantId !== user!.tenantId) throw new Error('Not found.');

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.description !== undefined) update.description = data.description.trim();
  if (data.headers !== undefined) {
    update.headers = data.headers
      .filter((h) => h.key.trim() && isValidHeaderName(h.key.trim()))
      .map((h) => ({ key: h.key.trim(), value: normalizeHeaderValue(h.key, h.value) }));
  }

  await ref.update(update);
}

export async function deleteConnection(id: string): Promise<void> {
  const user = await getSessionUser();
  requireAdmin(user);

  const ref = adminDb.collection('connections').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Connection not found.');
  if ((snap.data() as ConnectionRecord).tenantId !== user!.tenantId) throw new Error('Not found.');

  await ref.delete();
  // Note: integrations that referenced this connectionId will fall back to their own headers at execution time
}

/** Returns the raw headers (including secret values) for a connection. Admin-only. */
export async function getConnectionHeaders(id: string): Promise<{ key: string; value: string }[]> {
  const user = await getSessionUser();
  requireAdmin(user);

  const snap = await adminDb.collection('connections').doc(id).get();
  if (!snap.exists) throw new Error('Connection not found.');
  const record = snap.data() as ConnectionRecord;
  if (record.tenantId !== user!.tenantId) throw new Error('Not found.');
  return record.headers ?? [];
}

/** Returns connections as a minimal {id, name} list for dropdowns — no header data. */
export async function listConnectionOptions(): Promise<{ id: string; name: string }[]> {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized.');

  const snap = await adminDb
    .collection('connections')
    .where('tenantId', '==', user.tenantId)
    .get();

  return snap.docs
    .map((d) => { const r = d.data() as ConnectionRecord; return { id: r.id, name: r.name }; })
    .sort((a, b) => a.name.localeCompare(b.name));
}

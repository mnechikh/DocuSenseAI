'use server';

import { adminDb, isSuperAdmin } from '@/lib/firebase-admin';
import { getSessionUser } from '@/lib/auth-actions';
import { logActivity } from '@/lib/activity-log';
import type { ActivityLog, ActivityLevel, ActivityCategory } from '@/lib/activity-log';

export type { ActivityLog, ActivityLevel, ActivityCategory };

// ─── Read (per-tenant, Admin only) ───────────────────────────────────────────

export interface ActivityLogFilters {
  level?: ActivityLevel;
  category?: ActivityCategory;
  cursor?: number; // timestamp of last item for pagination (load more)
}

export async function listActivityLogs(
  filters: ActivityLogFilters = {}
): Promise<{ logs: ActivityLog[]; hasMore: boolean }> {
  const user = await getSessionUser();
  if (!user) return { logs: [], hasMore: false };
  if (user.role !== 'Admin') return { logs: [], hasMore: false };

  const PAGE_SIZE = 50;

  let query = adminDb
    .collection('activityLogs')
    .where('tenantId', '==', user.tenantId)
    .orderBy('timestamp', 'desc');

  if (filters.level) {
    query = query.where('level', '==', filters.level) as typeof query;
  }
  if (filters.category) {
    query = query.where('category', '==', filters.category) as typeof query;
  }
  if (filters.cursor) {
    query = query.startAfter(filters.cursor) as typeof query;
  }

  query = query.limit(PAGE_SIZE + 1) as typeof query;

  try {
    const snap = await query.get();
    const docs = snap.docs.slice(0, PAGE_SIZE);
    const hasMore = snap.docs.length > PAGE_SIZE;

    const logs: ActivityLog[] = docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ActivityLog, 'id'>),
    }));

    return { logs, hasMore };
  } catch {
    return { logs: [], hasMore: false };
  }
}

// ─── Read (all tenants, super-admin only) ────────────────────────────────────

export async function listAllActivityLogs(
  filters: ActivityLogFilters = {}
): Promise<{ logs: ActivityLog[]; hasMore: boolean }> {
  const user = await getSessionUser();
  if (!user || !isSuperAdmin(user.uid)) return { logs: [], hasMore: false };

  const PAGE_SIZE = 100;

  let query = adminDb
    .collection('activityLogs')
    .orderBy('timestamp', 'desc') as FirebaseFirestore.Query;

  if (filters.level) {
    query = query.where('level', '==', filters.level);
  }
  if (filters.category) {
    query = query.where('category', '==', filters.category);
  }
  if (filters.cursor) {
    query = query.startAfter(filters.cursor);
  }

  query = query.limit(PAGE_SIZE + 1);

  try {
    const snap = await query.get();
    const docs = snap.docs.slice(0, PAGE_SIZE);
    const hasMore = snap.docs.length > PAGE_SIZE;

    const logs: ActivityLog[] = docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ActivityLog, 'id'>),
    }));

    return { logs, hasMore };
  } catch {
    return { logs: [], hasMore: false };
  }
}

// ─── logAuthEvent — called from login page on auth failure ────────────────────

/**
 * Log a failed login attempt. Accepts only email + Firebase error code.
 * Looks up the tenantId by email so the log is scoped to the right workspace.
 * Falls back to tenantId "unknown" if user is not found (prevents info leak).
 */
export async function logAuthEvent(
  email: string,
  errorCode: string
): Promise<void> {
  // Never log empty or obviously invalid inputs
  if (!email || !email.includes('@')) return;

  let tenantId = 'unknown';
  try {
    const snap = await adminDb
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!snap.empty) {
      tenantId = (snap.docs[0].data() as { tenantId: string }).tenantId;
    }
  } catch {
    // Non-fatal — still log with unknown tenantId
  }

  logActivity({
    tenantId,
    level: 'warning',
    category: 'auth',
    action: 'auth.login_failed',
    actorEmail: email,
    message: `Failed login attempt for ${email}`,
    metadata: { errorCode },
  });
}


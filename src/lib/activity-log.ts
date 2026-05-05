/**
 * Activity logging utility for Lumxia.
 *
 * Fire-and-forget: every call to logActivity() writes to Firestore
 * asynchronously and swallows errors so it never blocks or breaks the caller.
 *
 * NO 'use server' directive — this file is imported from server actions,
 * server-side flows, and the activity-log-actions.ts 'use server' file.
 */

import { adminDb } from '@/lib/firebase-admin';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityLevel = 'info' | 'warning' | 'error';

export type ActivityCategory =
  | 'auth'
  | 'document'
  | 'user'
  | 'webhook'
  | 'api'
  | 'integration'
  | 'system';

export interface ActivityLog {
  id: string;
  tenantId: string;
  timestamp: number;
  level: ActivityLevel;
  category: ActivityCategory;
  action: string;       // e.g. "auth.login_failed", "document.processing_failed"
  actorId?: string;     // Firebase UID of who triggered it (undefined for system events)
  actorEmail?: string;  // Email for display — never a password
  targetId?: string;    // Resource ID (documentId, userId, webhookId…)
  targetName?: string;  // Human-readable name of the resource
  message: string;      // Plain-English description
  metadata?: Record<string, unknown>; // Extra structured context
}

export type ActivityLogInput = Omit<ActivityLog, 'id' | 'timestamp'>;

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Write an activity log entry. Fire-and-forget — never throws.
 */
export function logActivity(input: ActivityLogInput): void {
  const entry = {
    ...input,
    timestamp: Date.now(),
  };

  adminDb
    .collection('activityLogs')
    .add(entry)
    .catch((err) => {
      // Only log to console — never surface to user
      console.warn('[ActivityLog] Failed to write log:', err?.message ?? err);
    });
}

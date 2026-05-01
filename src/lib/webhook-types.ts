/**
 * Shared types and constants for the webhook system.
 * Kept separate from webhook-actions.ts so they can be imported
 * by client components without violating the "use server" constraint.
 */

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
  secret: string;
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

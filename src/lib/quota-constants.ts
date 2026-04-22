// Shared quota constants — importable from both server and client code.
// Do NOT add "use server" to this file.

export type TenantPlan = "free" | "starter" | "pro";

export const PLAN_DEFAULTS: Record<TenantPlan, { docQuota: number; queryQuota: number; storageMB: number }> = {
  free:    { docQuota: 5,   queryQuota: 20,   storageMB: 100   },
  starter: { docQuota: 25,  queryQuota: 500,  storageMB: 1024  },
  pro:     { docQuota: 999, queryQuota: 2000, storageMB: 10240 },
};

export const PLAN_PRICES: Record<'starter' | 'pro', { monthly: number; label: string }> = {
  starter: { monthly: 29, label: 'Starter' },
  pro:     { monthly: 99, label: 'Pro' },
};

export function nextResetTs(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

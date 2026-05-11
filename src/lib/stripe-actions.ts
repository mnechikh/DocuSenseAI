'use server';

import { stripe, PLAN_PRICE_IDS } from '@/lib/stripe';
import { getSessionUser } from '@/lib/auth-actions';
import { adminDb } from '@/lib/firebase-admin';
import { PLAN_DEFAULTS, type TenantPlan } from '@/lib/quota-constants';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002').replace(/\/$/, '');

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  plan: 'starter' | 'pro'
): Promise<{ url: string }> {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized.');

  const priceId = PLAN_PRICE_IDS[plan];
  if (!priceId) throw new Error(`Price ID not configured for plan: ${plan}`);

  // Look up or create a Stripe customer for this tenant
  const tenantSnap = await adminDb.doc(`tenants/${user.tenantId}`).get();
  if (!tenantSnap.exists) throw new Error('Tenant not found.');
  const tenantData = tenantSnap.data() as Record<string, unknown>;

  let stripeCustomerId = tenantData.stripeCustomerId as string | null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: (tenantData.name as string) ?? user.email,
      metadata: { tenantId: user.tenantId, userId: user.uid },
    });
    stripeCustomerId = customer.id;
    await adminDb.doc(`tenants/${user.tenantId}`).update({ stripeCustomerId });
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/dashboard/billing?success=1`,
    cancel_url:  `${APP_URL}/dashboard/billing?cancelled=1`,
    metadata: { tenantId: user.tenantId, plan },
    subscription_data: {
      metadata: { tenantId: user.tenantId, plan },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL.');
  return { url: session.url };
}

// ─── Billing Portal ───────────────────────────────────────────────────────────

export async function createBillingPortalSession(): Promise<{ url: string }> {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized.');

  const tenantSnap = await adminDb.doc(`tenants/${user.tenantId}`).get();
  if (!tenantSnap.exists) throw new Error('Tenant not found.');
  const { stripeCustomerId } = tenantSnap.data() as { stripeCustomerId: string | null };
  if (!stripeCustomerId) throw new Error('No billing account found. Please subscribe first.');

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${APP_URL}/dashboard/billing`,
  });

  return { url: session.url };
}

// ─── Subscription Info ────────────────────────────────────────────────────────

export interface SubscriptionInfo {
  plan: TenantPlan;
  status: 'active' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

export async function getCurrentSubscription(): Promise<SubscriptionInfo> {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized.');

  const tenantSnap = await adminDb.doc(`tenants/${user.tenantId}`).get();
  if (!tenantSnap.exists) throw new Error('Tenant not found.');
  const data = tenantSnap.data() as Record<string, unknown>;
  const plan = (data.plan as TenantPlan) ?? 'free';
  const stripeCustomerId = data.stripeCustomerId as string | null;

  if (!stripeCustomerId || plan === 'free') {
    return { plan: 'free', status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return { plan, status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false };
    }

    const sub = subscriptions.data[0];
    return {
      plan,
      status: sub.status === 'active' ? 'active'
            : sub.status === 'past_due' ? 'past_due'
            : 'canceled',
      currentPeriodEnd: (sub as unknown as { current_period_end: number }).current_period_end * 1000,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  } catch {
    return { plan, status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }
}

// ─── Webhook helper — update tenant plan after payment ────────────────────────

export async function upgradeTenantPlan(
  tenantId: string,
  plan: TenantPlan,
  stripeCustomerId: string
) {
  const defaults = PLAN_DEFAULTS[plan];
  await adminDb.doc(`tenants/${tenantId}`).update({
    plan,
    stripeCustomerId,
    paidAt: Date.now(),
    docQuota:          defaults.docQuota,
    queryQuota:        defaults.queryQuota,
    storageMB:         defaults.storageMB,
    integrationQuota:  defaults.integrationQuota,
  });
}

export async function downgradeTenantToFree(tenantId: string) {
  const defaults = PLAN_DEFAULTS.free;
  await adminDb.doc(`tenants/${tenantId}`).update({
    plan: 'free' as TenantPlan,
    paidAt: null,
    docQuota:          defaults.docQuota,
    queryQuota:        defaults.queryQuota,
    storageMB:         defaults.storageMB,
    integrationQuota:  defaults.integrationQuota,
  });
}

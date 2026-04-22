import Stripe from 'stripe';

// Lazily validate at runtime so the build doesn't fail without env vars.
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set.');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia',
  });
}

// Keep a module-level singleton for server-action use.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

export const PLAN_PRICE_IDS: Record<'starter' | 'pro', string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
};

export const PLAN_LABELS: Record<'starter' | 'pro', { name: string; price: string }> = {
  starter: { name: 'Starter', price: '$29/mo' },
  pro:     { name: 'Pro',     price: '$99/mo' },
};

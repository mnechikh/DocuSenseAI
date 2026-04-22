import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';
import { PLAN_DEFAULTS, type TenantPlan } from '@/lib/quota-constants';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// Stripe requires the raw body bytes for signature verification — do NOT use
// Next.js body parsing here.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Stripe webhook] STRIPE_WEBHOOK_SECRET is not set.');
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig ?? '', webhookSecret);
  } catch (err: unknown) {
    console.error('[Stripe webhook] Signature verification failed:', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Successful checkout → upgrade plan ──────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const plan = session.metadata?.plan as TenantPlan | undefined;

        if (!tenantId || !plan || !PLAN_DEFAULTS[plan]) {
          console.warn('[Stripe webhook] Missing metadata on session:', session.id);
          break;
        }

        const customerId = typeof session.customer === 'string'
          ? session.customer
          : (session.customer as Stripe.Customer | null)?.id ?? null;

        const defaults = PLAN_DEFAULTS[plan];
        await adminDb.doc(`tenants/${tenantId}`).update({
          plan,
          paidAt: Date.now(),
          stripeCustomerId: customerId,
          docQuota:   defaults.docQuota,
          queryQuota: defaults.queryQuota,
          storageMB:  defaults.storageMB,
        });

        console.info('[Stripe webhook] Upgraded tenant:', { tenantId, plan });
        break;
      }

      // ── Subscription updated (e.g. plan change via billing portal) ──────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) break;

        // Determine plan from the price ID on the subscription
        const priceId = sub.items.data[0]?.price?.id;
        const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID;
        const proPriceId     = process.env.STRIPE_PRO_PRICE_ID;

        let plan: TenantPlan = 'free';
        if (priceId === proPriceId) plan = 'pro';
        else if (priceId === starterPriceId) plan = 'starter';

        if (plan !== 'free') {
          const defaults = PLAN_DEFAULTS[plan];
          await adminDb.doc(`tenants/${tenantId}`).update({
            plan,
            docQuota:   defaults.docQuota,
            queryQuota: defaults.queryQuota,
            storageMB:  defaults.storageMB,
          });
          console.info('[Stripe webhook] Subscription updated:', { tenantId, plan });
        }
        break;
      }

      // ── Subscription cancelled → downgrade to free ──────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) {
          // Fallback: look up tenant by stripeCustomerId
          const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
          if (customerId) {
            const snap = await adminDb.collection('tenants')
              .where('stripeCustomerId', '==', customerId)
              .limit(1)
              .get();
            if (!snap.empty) {
              const ref = snap.docs[0].ref;
              const defaults = PLAN_DEFAULTS.free;
              await ref.update({
                plan: 'free' as TenantPlan,
                paidAt: null,
                docQuota:   defaults.docQuota,
                queryQuota: defaults.queryQuota,
                storageMB:  defaults.storageMB,
              });
              console.info('[Stripe webhook] Downgraded tenant via customerId:', customerId);
            }
          }
          break;
        }
        const defaults = PLAN_DEFAULTS.free;
        await adminDb.doc(`tenants/${tenantId}`).update({
          plan: 'free' as TenantPlan,
          paidAt: null,
          docQuota:   defaults.docQuota,
          queryQuota: defaults.queryQuota,
          storageMB:  defaults.storageMB,
        });
        console.info('[Stripe webhook] Downgraded tenant to free:', tenantId);
        break;
      }

      // ── Payment failed → log only (no immediate downgrade — grace period) ───
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : (invoice.customer as Stripe.Customer | null)?.id;
        console.warn('[Stripe webhook] Payment failed for customer:', customerId);
        // TODO: send dunning email / show banner in dashboard
        break;
      }

      default:
        // Acknowledge but ignore unhandled events
        break;
    }
  } catch (err: unknown) {
    console.error('[Stripe webhook] Handler error:', (err as Error).message);
    return NextResponse.json({ error: 'Handler error.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  createCheckoutSession,
  createBillingPortalSession,
  getCurrentSubscription,
  type SubscriptionInfo,
} from "@/lib/stripe-actions";
import { getMyTenantQuota } from "@/lib/auth-actions";
import { PLAN_DEFAULTS, PLAN_PRICES, type TenantPlan } from "@/lib/quota-constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Check, Zap, ArrowLeft, LayoutDashboard, CreditCard,
  FileText, MessageSquare, Plug2, KeyRound, ExternalLink,
  RefreshCw, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useStore();
  const { toast } = useToast();

  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [quota, setQuota] = useState<{
    plan: TenantPlan; docQuota: number; queryQuota: number;
    queriesThisMonth: number; quotaResetAt: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<"starter" | "pro" | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    if (!currentUser?.tenantId) return;
    Promise.all([getCurrentSubscription(), getMyTenantQuota()])
      .then(([s, q]) => { setSub(s); setQuota(q); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUser?.tenantId]);

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      toast({ title: "Subscription activated!", description: "Your plan has been upgraded." });
    }
    if (searchParams.get("cancelled") === "1") {
      toast({ title: "Checkout cancelled", description: "No charges were made.", variant: "destructive" });
    }
  }, [searchParams, toast]);

  const handleUpgrade = async (plan: "starter" | "pro") => {
    if (checkingOut) return;
    setCheckingOut(plan);
    try {
      const { url } = await createCheckoutSession(plan);
      window.location.href = url;
    } catch (e: unknown) {
      toast({ title: "Checkout failed", description: (e as Error).message, variant: "destructive" });
      setCheckingOut(null);
    }
  };

  const handlePortal = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const { url } = await createBillingPortalSession();
      window.location.href = url;
    } catch (e: unknown) {
      toast({ title: "Could not open billing portal", description: (e as Error).message, variant: "destructive" });
      setOpeningPortal(false);
    }
  };

  const currentPlan = quota?.plan ?? "free";
  const queryUsedPct = quota ? Math.round((quota.queriesThisMonth / quota.queryQuota) * 100) : 0;
  const resetDate = quota ? new Date(quota.quotaResetAt).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "—";

  const plans: { id: "starter" | "pro"; name: string; price: string; description: string; queries: number; docs: number | string; highlight: boolean; features: string[] }[] = [
    {
      id: "starter",
      name: "Starter",
      price: `$${PLAN_PRICES.starter.monthly}/mo`,
      description: "For small teams getting real value from documents.",
      queries: PLAN_DEFAULTS.starter.queryQuota,
      docs: PLAN_DEFAULTS.starter.docQuota,
      highlight: false,
      features: [
        "500 AI queries / month",
        "25 documents",
        "Integrations (Make, Zapier, etc.)",
        "3 team members",
        "Email support",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      price: `$${PLAN_PRICES.pro.monthly}/mo`,
      description: "For teams who need full power and API access.",
      queries: PLAN_DEFAULTS.pro.queryQuota,
      docs: "Unlimited",
      highlight: true,
      features: [
        "2,000 AI queries / month",
        "Unlimited documents",
        "Integrations (Make, Zapier, etc.)",
        "REST API access",
        "10 team members",
        "Priority support",
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground flex items-center gap-1">
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Billing</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" /> Billing & Plans
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your subscription and usage.</p>
        </div>
        {sub && sub.status === "active" && (
          <Button variant="outline" onClick={handlePortal} disabled={openingPortal}>
            {openingPortal ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Manage Billing
          </Button>
        )}
      </div>

      {/* Current plan + usage */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Current Plan</CardTitle>
            <Badge variant={currentPlan === "free" ? "secondary" : "default"} className="capitalize text-sm px-3 py-1">
              {currentPlan}
            </Badge>
          </div>
          {sub?.cancelAtPeriodEnd && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Subscription cancels on {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"}. You can reactivate via Manage Billing.
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="h-12 bg-muted animate-pulse rounded" />
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> AI Queries
                  </span>
                  <span className={queryUsedPct >= 80 ? "text-destructive font-semibold" : "font-medium"}>
                    {quota?.queriesThisMonth ?? 0} / {quota?.queryQuota ?? 20}
                  </span>
                </div>
                <Progress
                  value={queryUsedPct}
                  className={`h-2 ${queryUsedPct >= 100 ? "[&>div]:bg-destructive" : queryUsedPct >= 80 ? "[&>div]:bg-amber-500" : ""}`}
                />
                <p className="text-xs text-muted-foreground">Resets {resetDate}</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Documents
                </span>
                <span className="font-medium">Up to {quota?.docQuota ?? 5}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Plug2 className="h-3.5 w-3.5" /> Integrations
                </span>
                <span className={currentPlan === "free" ? "text-muted-foreground" : "font-medium text-green-600"}>
                  {currentPlan === "free" ? "Locked — upgrade to unlock" : "Enabled"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> REST API
                </span>
                <span className={currentPlan === "pro" ? "font-medium text-green-600" : "text-muted-foreground"}>
                  {currentPlan === "pro" ? "Enabled" : "Pro plan only"}
                </span>
              </div>
              {sub?.currentPeriodEnd && sub.status === "active" && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Next billing date: {new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Plan cards — hide if already on that plan */}
      {currentPlan !== "pro" && (
        <>
          <h2 className="text-lg font-semibold">Upgrade Your Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              return (
                <Card
                  key={plan.id}
                  className={`relative ${plan.highlight ? "border-primary shadow-md" : ""} ${isCurrent ? "opacity-70" : ""}`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="px-3 py-0.5 text-xs">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <CardDescription className="mt-1">{plan.description}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{plan.price}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={plan.highlight ? "default" : "outline"}
                      disabled={isCurrent || checkingOut !== null}
                      onClick={() => handleUpgrade(plan.id)}
                    >
                      {checkingOut === plan.id ? (
                        <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Redirecting…</>
                      ) : isCurrent ? (
                        "Current Plan"
                      ) : (
                        <><Zap className="h-4 w-4 mr-2" />Upgrade to {plan.name}</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {currentPlan === "pro" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-6 text-center">
            <Check className="h-10 w-10 text-green-600 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-green-800">You&apos;re on the Pro plan</h3>
            <p className="text-sm text-green-700 mt-1">All features unlocked. Use Manage Billing to update payment or cancel.</p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

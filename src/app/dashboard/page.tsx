"use client";

import { useStore } from "@/lib/store";
import { useDocuments } from "@/hooks/useDocuments";
import { useChats } from "@/hooks/useChats";
import { useEffect, useState } from "react";
import { getMyTenantQuota } from "@/lib/auth-actions";
import { type TenantPlan } from "@/lib/quota-constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  MessageSquare, 
  ShieldCheck, 
  Upload, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Gauge,
  Zap,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type QuotaInfo = {
  plan: TenantPlan;
  docQuota: number;
  queryQuota: number;
  queriesThisMonth: number;
  quotaResetAt: number;
};

export default function DashboardPage() {
  const { currentUser } = useStore();
  const { documents: tenantDocuments, loading: docsLoading } = useDocuments(currentUser?.tenantId);
  const { chats: tenantChats } = useChats(currentUser?.tenantId, currentUser?.userId);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOnboardingDismissed(localStorage.getItem("lumxia-onboarding-dismissed") === "1");
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.tenantId) return;
    getMyTenantQuota().then(setQuota).catch(() => {});
  }, [currentUser?.tenantId]);

  const showOnboarding = !docsLoading && tenantDocuments.length === 0 && !onboardingDismissed;

  const docCount = tenantDocuments.filter(d => d.status !== "failed").length;

  if (showOnboarding) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(124,140,255,0.12)", border: "1px solid rgba(124,140,255,0.2)" }}>
          <Sparkles className="w-7 h-7 text-[#9B8CFF]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary mb-2">
            Welcome to Lumxia, {currentUser?.name}
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
            Your workspace is ready. Upload your first document and start asking questions in natural language — no setup required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left">
          {[
            { step: "1", title: "Upload documents", desc: "PDF, DOCX, XLSX, images, or a ZIP archive of files." },
            { step: "2", title: "Lumxia indexes them", desc: "Content is extracted and ready to query in seconds." },
            { step: "3", title: "Ask in plain English", desc: "Get precise answers with source citations from your docs." },
          ].map((s) => (
            <div key={s.step} className="p-5 rounded-2xl border border-border/40 bg-card/50">
              <div className="text-4xl font-black text-muted-foreground/10 leading-none mb-3 select-none">{s.step}</div>
              <p className="text-sm font-semibold text-foreground mb-1">{s.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          {currentUser?.role === "Admin" && (
            <Button asChild className="bg-primary hover:bg-primary/90 shadow-md gap-2">
              <Link href="/documents">
                <Upload className="w-4 h-4" />
                Upload Your First Document
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="gap-2">
            <Link href="/support">
              <ArrowRight className="w-4 h-4" />
              Learn how it works
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground text-sm"
            onClick={() => {
              localStorage.setItem("lumxia-onboarding-dismissed", "1");
              setOnboardingDismissed(true);
            }}
          >
            Skip for now
          </Button>
        </div>
      </div>
    );
  }


  const stats = [
    { 
      label: "Indexed Documents", 
      value: tenantDocuments.filter(d => d.status === "indexed").length, 
      icon: FileText, 
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    { 
      label: "Total Chats", 
      value: tenantChats.length, 
      icon: MessageSquare, 
      color: "text-teal-500",
      bg: "bg-teal-50"
    },
    { 
      label: "System Status", 
      value: "Secure", 
      icon: ShieldCheck, 
      color: "text-green-500",
      bg: "bg-green-50"
    },
  ];

  const recentDocs = tenantDocuments.slice(0, 5);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Welcome back, {currentUser?.name}</h1>
          <p className="text-muted-foreground mt-1">
            Tenant: <span className="font-semibold">{currentUser?.tenantId}</span> • Secure Workspace
          </p>
        </div>
        <div className="flex gap-3">
          {currentUser?.role === "Admin" && (
            <Button asChild variant="outline">
              <Link href="/documents">
                <Upload className="mr-2 h-4 w-4" />
                Upload Knowledge
              </Link>
            </Button>
          )}
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-md">
            <Link href="/chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              Start Consultation
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <div className={`${stat.bg} ${stat.color} p-2 rounded-lg`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Quota usage bar ── */}
      {quota && (
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Usage — this month</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize text-xs">{quota.plan} plan</Badge>
              {quota.plan === "free" && (
                <Button asChild size="sm" className="h-7 text-xs px-3">
                  <Link href="/dashboard/billing"><Zap className="h-3 w-3 mr-1" />Upgrade</Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Documents</span>
                <span>{docCount} / {quota.docQuota}</span>
              </div>
              <Progress
                value={quota.docQuota > 0 ? Math.min(100, Math.round((docCount / quota.docQuota) * 100)) : 0}
                className="h-2"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>AI Queries</span>
                <span className={quota.queriesThisMonth >= quota.queryQuota ? "text-destructive font-semibold" : quota.queriesThisMonth / quota.queryQuota >= 0.8 ? "text-amber-600 font-semibold" : ""}>
                  {quota.queriesThisMonth} / {quota.queryQuota}
                </span>
              </div>
              <Progress
                value={quota.queryQuota > 0 ? Math.min(100, Math.round((quota.queriesThisMonth / quota.queryQuota) * 100)) : 0}
                className={`h-2 ${
                  quota.queriesThisMonth >= quota.queryQuota ? "[&>div]:bg-destructive" :
                  quota.queriesThisMonth / quota.queryQuota >= 0.8 ? "[&>div]:bg-amber-500" : ""
                }`}
              />
              <p className="text-[10px] text-muted-foreground">
                Resets {new Date(quota.quotaResetAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
          {/* Upgrade CTA when at or near limit */}
          {quota.plan === "free" && quota.queriesThisMonth / quota.queryQuota >= 0.8 && (
            <div className="mx-6 mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 flex-1">
                {quota.queriesThisMonth >= quota.queryQuota
                  ? "You've used all your queries this month."
                  : `${quota.queryQuota - quota.queriesThisMonth} queries remaining — running low.`}
              </p>
              <Button asChild size="sm" className="shrink-0">
                <Link href="/dashboard/billing"><Zap className="h-3.5 w-3.5 mr-1" />Upgrade now</Link>
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Tenant Activity</CardTitle>
            <CardDescription>Recent document indexing status</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDocs.length > 0 ? (
              <div className="space-y-4">
                {recentDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-white/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none truncate">{doc.filename}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(doc.timestamp).toLocaleDateString()} • {doc.fileType}
                          {doc.chunkCount != null && ` • ${doc.chunkCount} chunks`}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {doc.status === "indexed" ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold uppercase">Ready</span>
                        </div>
                      ) : doc.status === "processing" ? (
                        <div className="flex items-center gap-1 text-blue-600 animate-pulse">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold uppercase">Processing</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold uppercase">Failed</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="ghost" className="w-full text-xs text-muted-foreground" asChild>
                  <Link href="/documents">View all documents</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-center gap-2">
                <FileText className="h-10 w-10 opacity-20" />
                <p className="text-sm font-medium">No documents yet</p>
                {currentUser?.role === "Admin" && (
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link href="/documents">Upload your first document</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary text-primary-foreground overflow-hidden">
          <CardHeader>
            <CardTitle>Intelligent Insights</CardTitle>
            <CardDescription className="text-primary-foreground/70">Powered by Retrieval Augmented Generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                Knowledge Efficiency
              </h4>
              <p className="text-xs leading-relaxed opacity-80">
                Your knowledge platform is currently processing documents with a 98% extraction accuracy. 
                Average retrieval latency is below 400ms.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Total Chunks</p>
                <p className="text-xl font-bold">
                  {tenantDocuments.reduce((acc, d) => acc + (d.chunkCount || 0), 0)}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Vector Storage</p>
                <p className="text-xl font-bold">Optimized</p>
              </div>
            </div>
            
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" asChild>
              <Link href="/chat">Launch AI Interface</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

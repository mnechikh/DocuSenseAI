"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  getAllTenants, approveTenant, suspendTenant,
  setTenantQuota, resetTenantQueryCount,
  createTenantAsAdmin, renameTenant, deleteTenant, getOwnerResetLink,
} from "@/lib/auth-actions";
import { PLAN_DEFAULTS, type TenantPlan } from "@/lib/quota-constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Shield, CheckCircle2, XCircle, Users, Building2, Clock, Loader2, RefreshCw, LogOut, Settings2, RotateCcw, Plus, Pencil, Trash2, KeyRound, Copy, Check, ShieldCheck, ChevronDown } from "lucide-react";
import { revokeSessionCookie } from "@/lib/auth-actions";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { listAllActivityLogs } from "@/lib/activity-log-actions";
import type { ActivityLog, ActivityLevel, ActivityCategory } from "@/lib/activity-log";
import { format } from "date-fns";

type Tenant = {
  id: string;
  name: string;
  ownerId: string;
  status: "pending" | "active" | "suspended";
  createdAt: number;
  userCount: number;
  stripeCustomerId: string | null;
  paidAt: number | null;
  plan: TenantPlan;
  docQuota: number;
  queryQuota: number;
  storageMB: number;
  queriesThisMonth: number;
  quotaResetAt: number;
};

// ─── Helpers shared between tabs ─────────────────────────────────────────────

const LEVEL_STYLES: Record<ActivityLevel, string> = {
  info:    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  error:   "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  auth: "Auth", document: "Document", user: "User",
  webhook: "Webhook", api: "API", integration: "Integration", system: "System",
};

function fmtTs(ts: number) {
  try { return format(new Date(ts), "MMM d HH:mm:ss"); } catch { return String(ts); }
}

export default function AdminPage() {
  const router = useRouter();
  const { currentUser, logout } = useStore();
  const [activeTab, setActiveTab] = useState<"workspaces" | "logs">("workspaces");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ── Activity logs state ──────────────────────────────────────────────────
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [logsLevelFilter, setLogsLevelFilter] = useState<ActivityLevel | "all">("all");
  const [logsCategoryFilter, setLogsCategoryFilter] = useState<ActivityCategory | "all">("all");

  const fetchLogs = useCallback(async (cursor?: number, append = false) => {
    setLogsLoading(true);
    try {
      const { logs: newLogs, hasMore } = await listAllActivityLogs({
        level: logsLevelFilter !== "all" ? logsLevelFilter : undefined,
        category: logsCategoryFilter !== "all" ? logsCategoryFilter : undefined,
        cursor,
      });
      setLogs((prev) => append ? [...prev, ...newLogs] : newLogs);
      setLogsHasMore(hasMore);
    } finally {
      setLogsLoading(false);
    }
  }, [logsLevelFilter, logsCategoryFilter]);

  useEffect(() => {
    if (activeTab === "logs") fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, logsLevelFilter, logsCategoryFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAllTenants();
      setTenants(data);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (tenantId: string) => {
    setActionId(tenantId);
    try {
      await approveTenant(tenantId);
      setTenants((prev) => prev.map((t) => t.id === tenantId ? { ...t, status: "active" } : t));
    } catch (e: unknown) {
      setError((e as Error).message ?? "Action failed.");
    } finally {
      setActionId(null);
    }
  };

  const handleSuspend = async (tenantId: string) => {
    setActionId(tenantId);
    try {
      await suspendTenant(tenantId);
      setTenants((prev) => prev.map((t) => t.id === tenantId ? { ...t, status: "suspended" } : t));
    } catch (e: unknown) {
      setError((e as Error).message ?? "Action failed.");
    } finally {
      setActionId(null);
    }
  };

  // ── Quota modal ────────────────────────────────────────────────────────────
  const [quotaTarget, setQuotaTarget] = useState<Tenant | null>(null);
  const [quotaPlan, setQuotaPlan] = useState<TenantPlan>("free");
  const [quotaDocOverride, setQuotaDocOverride] = useState("");
  const [quotaQueryOverride, setQuotaQueryOverride] = useState("");
  const [quotaSaving, setQuotaSaving] = useState(false);

  const openQuotaModal = (t: Tenant) => {
    setQuotaTarget(t);
    setQuotaPlan(t.plan ?? "free");
    setQuotaDocOverride(String(t.docQuota ?? PLAN_DEFAULTS[t.plan ?? "free"].docQuota));
    setQuotaQueryOverride(String(t.queryQuota ?? PLAN_DEFAULTS[t.plan ?? "free"].queryQuota));
  };

  const handlePlanChange = (plan: TenantPlan) => {
    setQuotaPlan(plan);
    setQuotaDocOverride(String(PLAN_DEFAULTS[plan].docQuota));
    setQuotaQueryOverride(String(PLAN_DEFAULTS[plan].queryQuota));
  };

  const handleSaveQuota = async () => {
    if (!quotaTarget) return;
    setQuotaSaving(true);
    try {
      await setTenantQuota(quotaTarget.id, quotaPlan, {
        docQuota: parseInt(quotaDocOverride) || PLAN_DEFAULTS[quotaPlan].docQuota,
        queryQuota: parseInt(quotaQueryOverride) || PLAN_DEFAULTS[quotaPlan].queryQuota,
      });
      setTenants((prev) => prev.map((t) => t.id === quotaTarget.id ? {
        ...t,
        plan: quotaPlan,
        docQuota: parseInt(quotaDocOverride) || PLAN_DEFAULTS[quotaPlan].docQuota,
        queryQuota: parseInt(quotaQueryOverride) || PLAN_DEFAULTS[quotaPlan].queryQuota,
      } : t));
      setQuotaTarget(null);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to save quota.");
    } finally {
      setQuotaSaving(false);
    }
  };

  const handleResetQueries = async (tenantId: string) => {
    setActionId(tenantId);
    try {
      await resetTenantQueryCount(tenantId);
      setTenants((prev) => prev.map((t) => t.id === tenantId ? { ...t, queriesThisMonth: 0 } : t));
    } catch (e: unknown) {
      setError((e as Error).message ?? "Reset failed.");
    } finally {
      setActionId(null);
    }
  };

  // ── Create workspace modal ─────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // ── Reset link dialog (shared by create + per-row) ────────────────────────
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetLinkEmail, setResetLinkEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [fetchingLink, setFetchingLink] = useState<string | null>(null); // tenantId

  const copyLink = async () => {
    if (!resetLink) return;
    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createEmail.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const { tenantId, resetLink: link } = await createTenantAsAdmin(createName.trim(), createEmail.trim());
      setCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      await load();
      if (link) {
        setResetLinkEmail(createEmail.trim());
        setResetLink(link);
        setCopied(false);
      }
    } catch (e: unknown) {
      setCreateError((e as Error).message ?? "Failed to create workspace.");
    } finally {
      setCreating(false);
    }
  };

  const handleGetResetLink = async (t: Tenant) => {
    setFetchingLink(t.id);
    try {
      const link = await getOwnerResetLink(t.id);
      setResetLinkEmail(t.ownerId); // will show tenantId as fallback label
      // look up email from tenants list for display
      setResetLinkEmail(t.id);
      setResetLink(link);
      setCopied(false);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Could not generate reset link.");
    } finally {
      setFetchingLink(null);
    }
  };

  // ── Inline rename ──────────────────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (t: Tenant) => {
    setRenamingId(t.id);
    setRenameValue(t.name);
  };

  const commitRename = async (tenantId: string) => {
    try {
      await renameTenant(tenantId, renameValue);
      setTenants((prev) => prev.map((t) => t.id === tenantId ? { ...t, name: renameValue.trim() } : t));
    } catch (e: unknown) {
      setError((e as Error).message ?? "Rename failed.");
    } finally {
      setRenamingId(null);
    }
  };

  // ── Delete confirmation ────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return;
    setDeleting(true);
    try {
      await deleteTenant(deleteTarget.id);
      setTenants((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteConfirm("");
    } catch (e: unknown) {
      setError((e as Error).message ?? "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    await revokeSessionCookie();
    await signOut(auth).catch(() => {});
    logout();
    router.push("/login");
  };

  const counts = {
    total: tenants.length,
    pending: tenants.filter((t) => t.status === "pending").length,
    active: tenants.filter((t) => t.status === "active").length,
    suspended: tenants.filter((t) => t.status === "suspended").length,
  };

  const statusBadge = (status: Tenant["status"]) => {
    if (status === "active") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-0">Active</Badge>;
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-0">Pending</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-0">Suspended</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C8CFF 0%, #C084FC 100%)', boxShadow: '0 4px 14px rgba(124,140,255,0.3)' }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 5px 2px rgba(255,255,255,0.45)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Owner Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Lumxia — Workspace Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{currentUser?.email}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon"
                  onClick={() => activeTab === "logs" ? fetchLogs() : load()}
                  disabled={loading || logsLoading}>
                  <RefreshCw className={`w-4 h-4 ${(loading || logsLoading) ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />Sign out
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>
      )}

      {/* Stats */}
      {/* Tab nav */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("workspaces")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "workspaces" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <span className="flex items-center gap-2"><Building2 className="w-4 h-4" />Workspaces</span>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "logs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Activity Logs</span>
        </button>
      </div>

      {activeTab === "workspaces" && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Workspaces", value: counts.total, icon: Building2, color: "text-primary" },
          { label: "Pending Approval", value: counts.pending, icon: Clock, color: "text-amber-600" },
          { label: "Active", value: counts.active, icon: CheckCircle2, color: "text-green-600" },
          { label: "Suspended", value: counts.suspended, icon: XCircle, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label} className="border shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
                <s.icon className={`w-8 h-8 ${s.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>All Workspaces</CardTitle>
            <CardDescription>Approve or suspend workspace access. Approval activates all users in the workspace.</CardDescription>
          </div>
          <Button size="sm" className="gap-2 shrink-0" onClick={() => { setCreateOpen(true); setCreateError(""); }}>
            <Plus className="w-4 h-4" /> New Workspace
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />Loading workspaces…
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No workspaces yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Docs</TableHead>
                  <TableHead>Queries / mo</TableHead>
                  <TableHead><span className="flex items-center gap-1"><Users className="w-3 h-3" />Users</span></TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => {
                  const plan = t.plan ?? "free";
                  const docQ = t.docQuota ?? PLAN_DEFAULTS[plan].docQuota;
                  const queryQ = t.queryQuota ?? PLAN_DEFAULTS[plan].queryQuota;
                  const queriesMo = t.queriesThisMonth ?? 0;
                  return (
                  <TableRow key={t.id}>
                    <TableCell>
                      {renamingId === t.id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            className="h-7 text-sm w-40"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(t.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => commitRename(t.id)}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setRenamingId(null)}>✕</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          <div>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{t.id}</div>
                          </div>
                          <button
                            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                            onClick={() => startRename(t)}
                            title="Rename"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">{plan}</Badge>
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      <div className="text-xs text-muted-foreground mb-1">{docQ} limit</div>
                      <Progress value={0} className="h-1.5 w-20" />
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="text-xs text-muted-foreground mb-1">{queriesMo}/{queryQ}</div>
                      <Progress value={queryQ > 0 ? Math.round((queriesMo / queryQ) * 100) : 0} className="h-1.5 w-24" />
                    </TableCell>
                    <TableCell>{t.userCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {t.status !== "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/40"
                            onClick={() => handleApprove(t.id)}
                            disabled={actionId === t.id}
                          >
                            {actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Approve
                          </Button>
                        )}
                        {t.status !== "suspended" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => handleSuspend(t.id)}
                            disabled={actionId === t.id}
                          >
                            {actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                            Suspend
                          </Button>
                        )}
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" className="gap-1" onClick={() => openQuotaModal(t)}>
                                <Settings2 className="w-3 h-3" />
                                Limits
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit plan &amp; quotas</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground"
                                onClick={() => handleResetQueries(t.id)}
                                disabled={actionId === t.id}>
                                {actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reset query counter</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost"
                                className="gap-1 text-muted-foreground"
                                onClick={() => handleGetResetLink(t)}
                                disabled={fetchingLink === t.id}>
                                {fetchingLink === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy owner reset link</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost"
                                className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => { setDeleteTarget(t); setDeleteConfirm(""); }}
                                disabled={actionId === t.id}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete workspace</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Stripe integration: when payment is enabled, workspaces will be approved automatically on successful payment.
        The approve/suspend controls above will remain for manual overrides.
      </p>
      </>}

      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={logsLevelFilter} onValueChange={(v) => setLogsLevelFilter(v as ActivityLevel | "all")}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={logsCategoryFilter} onValueChange={(v) => setLogsCategoryFilter(v as ActivityCategory | "all")}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                {logs.length} event{logs.length !== 1 ? "s" : ""}
                {logsLevelFilter !== "all" || logsCategoryFilter !== "all" ? " (filtered)" : " — all tenants"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {logsLoading && logs.length === 0 ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />Loading…
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-sm">
                  No activity logs yet. Events appear here as users interact with the platform.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-muted-foreground text-xs">
                        <th className="px-4 py-3 text-left font-medium">Time</th>
                        <th className="px-4 py-3 text-left font-medium">Level</th>
                        <th className="px-4 py-3 text-left font-medium">Category</th>
                        <th className="px-4 py-3 text-left font-medium">Action</th>
                        <th className="px-4 py-3 text-left font-medium">Tenant</th>
                        <th className="px-4 py-3 text-left font-medium">Actor</th>
                        <th className="px-4 py-3 text-left font-medium">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                            {fmtTs(log.timestamp)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLES[log.level]}`}>
                              {log.level.charAt(0).toUpperCase() + log.level.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[log.category] ?? log.category}</Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.action}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[120px]" title={log.tenantId}>
                            {log.tenantId}
                          </td>
                          <td className="px-4 py-3 text-xs truncate max-w-[140px]" title={log.actorEmail}>
                            {log.actorEmail ?? log.actorId ?? <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span title={log.metadata ? JSON.stringify(log.metadata, null, 2) : undefined}>
                              {log.message}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {logsHasMore && (
                <div className="flex justify-center py-4 border-t">
                  <Button variant="ghost" size="sm" onClick={() => { const last = logs[logs.length - 1]; if (last) fetchLogs(last.timestamp, true); }} disabled={logsLoading}>
                    <ChevronDown className="h-4 w-4 mr-2" />Load more
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Create Workspace Modal ── */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setCreateName(""); setCreateEmail(""); setCreateError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Workspace
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Workspace Name</Label>
              <Input
                placeholder="Acme Corp"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Owner Email</Label>
              <Input
                type="email"
                placeholder="owner@example.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <p className="text-xs text-muted-foreground">
                If this email has no account, one will be created and a password-reset link logged to the server console.
              </p>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !createName.trim() || !createEmail.trim()} className="gap-1">
              {creating && <Loader2 className="w-3 h-3 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirm(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Delete Workspace
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span>
                This will permanently delete <strong>{deleteTarget?.name}</strong> and all its users, documents, and data. This cannot be undone.
              </span>
              <span className="block pt-2">
                Type <strong className="select-all">{deleteTarget?.name}</strong> to confirm:
              </span>
              <Input
                className="mt-1"
                placeholder={deleteTarget?.name}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && deleteConfirm === deleteTarget?.name && handleDelete()}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1"
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== deleteTarget?.name}
            >
              {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
              Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reset Link Dialog ── */}
      <Dialog open={!!resetLink} onOpenChange={(open) => { if (!open) { setResetLink(null); setCopied(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Owner Reset Link
            </DialogTitle>
            <DialogDescription>
              Share this link with the workspace owner so they can set their password and log in.
              The link expires after one use.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 items-center mt-2">
            <Input readOnly value={resetLink ?? ""} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyLink} className="shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setResetLink(null); setCopied(false); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Quota Edit Modal ── */}
      <Dialog open={!!quotaTarget} onOpenChange={(open) => { if (!open) setQuotaTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Edit Limits — {quotaTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Plan</Label>
              <Select value={quotaPlan} onValueChange={(v) => handlePlanChange(v as TenantPlan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free — {PLAN_DEFAULTS.free.docQuota} docs / {PLAN_DEFAULTS.free.queryQuota} queries</SelectItem>
                  <SelectItem value="starter">Starter — {PLAN_DEFAULTS.starter.docQuota} docs / {PLAN_DEFAULTS.starter.queryQuota} queries</SelectItem>
                  <SelectItem value="pro">Pro — {PLAN_DEFAULTS.pro.docQuota} docs / {PLAN_DEFAULTS.pro.queryQuota} queries</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Doc Quota</Label>
                <Input type="number" min={1} value={quotaDocOverride} onChange={(e) => setQuotaDocOverride(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Query Quota / mo</Label>
                <Input type="number" min={1} value={quotaQueryOverride} onChange={(e) => setQuotaQueryOverride(e.target.value)} />
              </div>
            </div>
            {quotaTarget && (
              <p className="text-xs text-muted-foreground">
                Queries this month: <strong>{quotaTarget.queriesThisMonth ?? 0}</strong> &nbsp;·&nbsp;
                Resets: <strong>{quotaTarget.quotaResetAt ? new Date(quotaTarget.quotaResetAt).toLocaleDateString() : "—"}</strong>
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setQuotaTarget(null)}>Cancel</Button>
            <Button onClick={handleSaveQuota} disabled={quotaSaving} className="gap-1">
              {quotaSaving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

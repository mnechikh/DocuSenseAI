"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { getAllTenants, approveTenant, suspendTenant } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, CheckCircle2, XCircle, Users, Building2, Clock, Loader2, RefreshCw, LogOut } from "lucide-react";
import { revokeSessionCookie } from "@/lib/auth-actions";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Tenant = {
  id: string;
  name: string;
  ownerId: string;
  status: "pending" | "active" | "suspended";
  createdAt: number;
  userCount: number;
  stripeCustomerId: string | null;
  paidAt: number | null;
};

export default function AdminPage() {
  const router = useRouter();
  const { currentUser, logout } = useStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

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
                <Button variant="outline" size="icon" onClick={load} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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
        <CardHeader>
          <CardTitle>All Workspaces</CardTitle>
          <CardDescription>Approve or suspend workspace access. Approval activates all users in the workspace.</CardDescription>
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
                  <TableHead><span className="flex items-center gap-1"><Users className="w-3 h-3" />Users</span></TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{t.id}</div>
                    </TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Stripe integration: when payment is enabled, workspaces will be approved automatically on successful payment.
        The approve/suspend controls above will remain for manual overrides.
      </p>
    </div>
  );
}

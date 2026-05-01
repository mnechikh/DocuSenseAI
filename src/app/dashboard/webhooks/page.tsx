"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { getMyTenantQuota } from "@/lib/auth-actions";
import {
  createWebhook,
  listWebhooks,
  deleteWebhook,
  sendTestPing,
} from "@/lib/webhook-actions";
import {
  WEBHOOK_EVENTS,
  type WebhookEvent,
  type WebhookSummary,
} from "@/lib/webhook-types";
import { type TenantPlan } from "@/lib/quota-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Webhook, Plus, Trash2, Copy, Check, ArrowLeft, LayoutDashboard,
  ShieldCheck, FlaskConical, Lock, CreditCard, Clock,
} from "lucide-react";
import Link from "next/link";

const EVENT_LABELS: Record<WebhookEvent, string> = {
  "document.indexed": "Document indexed",
  "document.failed":  "Document failed",
  "query.answered":   "Query answered",
};

export default function WebhooksPage() {
  const router = useRouter();
  const { currentUser } = useStore();
  const { toast } = useToast();

  const [hooks, setHooks] = useState<WebhookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>(["document.indexed"]);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WebhookSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [secretDialog, setSecretDialog] = useState<{ secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState<TenantPlan | null>(null);

  useEffect(() => {
    getMyTenantQuota().then((q) => setPlan(q.plan)).catch(() => {});
  }, []);

  const loadHooks = useCallback(async () => {
    try {
      const { hooks: data, error } = await listWebhooks();
      if (error) toast({ title: "Failed to load webhooks", description: error, variant: "destructive" });
      else setHooks(data);
    } catch (e: unknown) {
      toast({ title: "Failed to load webhooks", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (plan === "pro") loadHooks(); }, [loadHooks, plan]);

  // ── Guard: redirect non-admins ────────────────────────────────────────────
  useEffect(() => {
    if (currentUser && currentUser.role !== "Admin") router.replace("/dashboard");
  }, [currentUser, router]);

  if (plan === null) {
    return <div className="flex items-center justify-center h-[60vh]"><span className="text-muted-foreground">Loading…</span></div>;
  }

  if (plan !== "pro") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Webhooks — Pro Feature</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Outbound webhooks are available on the Pro plan. Get notified in real-time when documents are indexed
          or queries are answered — connect Lumxia to Make, Zapier, Slack, or any HTTP endpoint.
        </p>
        <Button asChild>
          <Link href="/dashboard/billing">
            <CreditCard className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Link>
        </Button>
      </div>
    );
  }

  const toggleEvent = (e: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );
  };

  const handleCreate = async () => {
    if (!url.trim() || !selectedEvents.length) return;
    if (!url.trim().startsWith("https://")) {
      toast({ title: "Invalid URL", description: "Webhook URL must use HTTPS.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const result = await createWebhook(url.trim(), selectedEvents);
      if (result.error) {
        toast({ title: "Failed to create webhook", description: result.error, variant: "destructive" });
      } else {
        setSecretDialog({ secret: result.secret! });
        setUrl("");
        setSelectedEvents(["document.indexed"]);
        await loadHooks();
        toast({ title: "Webhook created" });
      }
    } catch (e: unknown) {
      toast({ title: "Failed to create webhook", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteWebhook(deleteTarget.webhookId);
      if (result.error) {
        toast({ title: "Failed to remove webhook", description: result.error, variant: "destructive" });
      } else {
        setHooks((prev) => prev.filter((h) => h.webhookId !== deleteTarget.webhookId));
        toast({ title: "Webhook removed" });
      }
    } catch (e: unknown) {
      toast({ title: "Failed to remove webhook", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handlePing = async (webhookId: string) => {
    setPingingId(webhookId);
    try {
      const res = await sendTestPing(webhookId);
      if (res.error) {
        toast({ title: "Ping error", description: res.error, variant: "destructive" });
      } else if (res.success) {
        toast({ title: "Ping sent", description: `Endpoint responded with ${res.statusCode}.` });
        await loadHooks();
      } else {
        toast({ title: "Ping failed", description: `Endpoint returned ${res.statusCode ?? "no response"}.`, variant: "destructive" });
      }
    } catch (e: unknown) {
      toast({ title: "Ping error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPingingId(null);
    }
  };

  const copySecret = async (secret: string) => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-3.5 h-3.5" />
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Button>
          <span>/</span>
          <span className="text-foreground font-medium">Webhooks</span>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Webhook className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">Webhooks</h1>
            <Badge variant="secondary" className="text-xs">Pro</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Receive real-time HTTP callbacks when Lumxia events occur. Connect to Make, Zapier, Slack, or any HTTPS endpoint.
          </p>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            Each webhook is signed with <code className="font-mono text-xs bg-primary/10 px-1 rounded">X-Lumxia-Signature: sha256=&lt;hex&gt;</code>.
            Verify it in Make/Zapier using your webhook secret to ensure payloads are genuine.
          </div>
        </div>

        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a new webhook</CardTitle>
            <CardDescription>Maximum 5 webhooks per workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url">Destination URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://hook.eu1.make.com/abc123xyz"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={creating || hooks.length >= 5}
              />
              <p className="text-[11px] text-muted-foreground">Must be HTTPS.</p>
            </div>

            <div className="space-y-2">
              <Label>Events to subscribe</Label>
              <div className="flex flex-wrap gap-4">
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={selectedEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                      disabled={creating || hooks.length >= 5}
                    />
                    <span className="text-sm">{EVENT_LABELS[event]}</span>
                    <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">{event}</code>
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={creating || !url.trim() || !selectedEvents.length || hooks.length >= 5}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {creating ? "Creating…" : "Create Webhook"}
            </Button>

            {hooks.length >= 5 && (
              <p className="text-xs text-muted-foreground">Maximum of 5 webhooks reached.</p>
            )}
          </CardContent>
        </Card>

        {/* Existing webhooks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : hooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No webhooks yet. Create one above.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Last fired</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hooks.map((hook) => (
                    <TableRow key={hook.webhookId}>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate" title={hook.url}>
                        {hook.url}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {hook.events.map((e) => (
                            <Badge key={e} variant="outline" className="text-[10px] px-1.5 py-0">
                              {e}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {hook.lastFiredAt ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {fmtDate(hook.lastFiredAt)}
                          </span>
                        ) : (
                          "Never"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 px-2"
                            title="Send test ping"
                            disabled={pingingId !== null}
                            onClick={() => handlePing(hook.webhookId)}
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            {pingingId === hook.webhookId ? "Sending…" : "Test"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(hook)}
                            title="Remove webhook"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secret reveal dialog — shown once on creation */}
      <Dialog open={!!secretDialog} onOpenChange={(o) => !o && setSecretDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save your webhook secret</DialogTitle>
            <DialogDescription>
              This secret is shown <strong>once only</strong>. Copy it now and store it safely.
              Use it in Make / Zapier to verify the <code className="text-xs font-mono">X-Lumxia-Signature</code> header.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all select-all">
              {secretDialog?.secret}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => copySecret(secretDialog!.secret)}
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecretDialog(null)}>I've saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              <code className="text-xs font-mono break-all">{deleteTarget?.url}</code>
              <br /><br />
              Lumxia will stop sending events to this URL immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

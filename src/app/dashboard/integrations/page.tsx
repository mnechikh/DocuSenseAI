"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { getMyTenantQuota } from "@/lib/auth-actions";
import { type TenantPlan } from "@/lib/quota-constants";
import {
  createIntegration,
  listAllIntegrations,
  updateIntegration,
  deleteIntegration,
  executeIntegration,
  type IntegrationSummary,
  type IntegrationParameter,
} from "@/lib/integration-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plug2, Plus, Pencil, Trash2, ArrowLeft, ShieldCheck, FlaskConical,
  LayoutDashboard, ChevronDown, ChevronUp, X, Lock, CreditCard,
} from "lucide-react";
import Link from "next/link";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface HeaderRow { key: string; value: string }

interface FormState {
  name: string;
  description: string;
  endpoint: string;
  method: HttpMethod;
  headers: HeaderRow[];
  bodyTemplate: string;
  parameters: IntegrationParameter[];
}

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  endpoint: "https://",
  method: "POST",
  headers: [{ key: "", value: "" }],
  bodyTemplate: "",
  parameters: [],
});

export default function IntegrationsPage() {
  const router = useRouter();
  const { currentUser } = useStore();
  const { toast } = useToast();

  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IntegrationSummary | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IntegrationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [plan, setPlan] = useState<TenantPlan | null>(null);

  useEffect(() => {
    getMyTenantQuota().then((q) => setPlan(q.plan)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAllIntegrations();
      setIntegrations(data);
    } catch (e: unknown) {
      toast({ title: "Failed to load integrations", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (plan !== null && plan !== "free") load(); }, [load, plan]);

  if (plan === null) {
    return <div className="flex items-center justify-center h-[60vh]"><span className="text-muted-foreground">Loading…</span></div>;
  }

  if (plan === "free") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Lock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Integrations — Paid Feature</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          Connect Lumxia to external services and automate workflows with custom integrations.
          Available on Starter and Pro plans.
        </p>
        <Button onClick={() => router.push("/dashboard/billing")}>
          <CreditCard className="mr-2 h-4 w-4" />Upgrade to unlock
        </Button>
        <Button variant="ghost" className="mt-2" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard
        </Button>
      </div>
    );
  }

  if (currentUser?.role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
        <ShieldCheck className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can manage integrations.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  // ─── Dialog helpers ───────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (integration: IntegrationSummary) => {
    setEditTarget(integration);
    setForm({
      name: integration.name,
      description: integration.description,
      endpoint: integration.endpoint,
      method: integration.method,
      headers: integration.parameters.length >= 0 ? [{ key: "", value: "" }] : [{ key: "", value: "" }],
      bodyTemplate: integration.bodyTemplate,
      parameters: integration.parameters,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" }); return;
    }
    if (!form.endpoint.startsWith("https://")) {
      toast({ title: "Endpoint must start with https://", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        endpoint: form.endpoint.trim(),
        method: form.method,
        headers: form.headers.filter((h) => h.key.trim()),
        bodyTemplate: form.bodyTemplate,
        parameters: form.parameters.filter((p) => p.name.trim()),
      };
      if (editTarget) {
        await updateIntegration(editTarget.id, payload);
        toast({ title: "Integration updated" });
      } else {
        await createIntegration(payload);
        toast({ title: "Integration created" });
      }
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteIntegration(deleteTarget.id);
      toast({ title: "Integration deleted" });
      setDeleteTarget(null);
      await load();
    } catch (e: unknown) {
      toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleEnabled = async (integration: IntegrationSummary) => {
    try {
      await updateIntegration(integration.id, { enabled: !integration.enabled });
      await load();
    } catch (e: unknown) {
      toast({ title: "Failed to update", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleTest = async (integration: IntegrationSummary) => {
    setTestingId(integration.id);
    try {
      // Build placeholder params for test
      const testParams: Record<string, unknown> = {};
      for (const p of integration.parameters) {
        testParams[p.name] = p.type === "number" ? 0 : p.type === "boolean" ? false : "test";
      }
      const result = await executeIntegration(integration.id, testParams);
      toast({
        title: result.success ? `Test succeeded (${result.statusCode})` : `Test failed (${result.statusCode})`,
        description: result.result.slice(0, 200),
        variant: result.success ? "default" : "destructive",
      });
    } catch (e: unknown) {
      toast({ title: "Test error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  // ─── Form field helpers ────────────────────────────────────────────────────

  const addHeader = () => setForm((f) => ({ ...f, headers: [...f.headers, { key: "", value: "" }] }));
  const removeHeader = (i: number) =>
    setForm((f) => ({ ...f, headers: f.headers.filter((_, idx) => idx !== i) }));
  const updateHeader = (i: number, field: "key" | "value", val: string) =>
    setForm((f) => {
      const h = [...f.headers]; h[i] = { ...h[i], [field]: val }; return { ...f, headers: h };
    });

  const addParam = () =>
    setForm((f) => ({
      ...f,
      parameters: [...f.parameters, { name: "", type: "string", description: "", required: true }],
    }));
  const removeParam = (i: number) =>
    setForm((f) => ({ ...f, parameters: f.parameters.filter((_, idx) => idx !== i) }));
  const updateParam = (i: number, field: keyof IntegrationParameter, val: unknown) =>
    setForm((f) => {
      const p = [...f.parameters];
      p[i] = { ...p[i], [field]: val };
      return { ...f, parameters: p };
    });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground flex items-center gap-1">
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Integrations</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug2 className="h-6 w-6" /> Integrations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure external HTTP actions the AI can propose during chat.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New Integration
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : integrations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Plug2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No integrations yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add an integration so the AI can propose actions like creating tickets or sending webhooks.
            </p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add your first integration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <Card key={integration.id} className={integration.enabled ? "" : "opacity-60"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <Badge variant={integration.enabled ? "default" : "secondary"}>
                        {integration.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-xs">{integration.method}</Badge>
                    </div>
                    <CardDescription className="mt-1 line-clamp-2">{integration.description}</CardDescription>
                    <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{integration.endpoint}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={integration.enabled}
                      onCheckedChange={() => handleToggleEnabled(integration)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(integration)}
                      disabled={testingId === integration.id || !integration.enabled}
                    >
                      <FlaskConical className="h-3.5 w-3.5 mr-1" />
                      {testingId === integration.id ? "Testing…" : "Test"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(integration)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(integration)}
                      className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedId(expandedId === integration.id ? null : integration.id)}
                    >
                      {expandedId === integration.id
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedId === integration.id && (
                <CardContent className="pt-0 space-y-3">
                  {integration.parameters.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">PARAMETERS</p>
                      <div className="space-y-1">
                        {integration.parameters.map((p) => (
                          <div key={p.name} className="flex items-center gap-2 text-sm">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{p.name}</code>
                            <Badge variant="outline" className="text-xs">{p.type}</Badge>
                            {p.required && <Badge className="text-xs">required</Badge>}
                            <span className="text-muted-foreground text-xs">{p.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {integration.bodyTemplate && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">BODY TEMPLATE</p>
                      <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-32">{integration.bodyTemplate}</pre>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Integration" : "New Integration"}</DialogTitle>
            <DialogDescription>
              Configure an HTTP endpoint the AI can call when users ask to take action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name + Description */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Create Jira Ticket"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description (shown to AI)</Label>
                <Textarea
                  placeholder="Creates a Jira ticket with the given title and description. Use when the user wants to track an issue."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>

            {/* Endpoint + Method */}
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label>Method</Label>
                <Select
                  value={form.method}
                  onValueChange={(v) => setForm((f) => ({ ...f, method: v as HttpMethod }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["POST", "GET", "PUT", "PATCH", "DELETE"] as HttpMethod[]).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>Endpoint URL (HTTPS only) <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="https://api.example.com/tickets"
                  value={form.endpoint}
                  onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
                />
              </div>
            </div>

            {/* Headers */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Headers <span className="text-xs text-muted-foreground">(for auth credentials, etc.)</span></Label>
                <Button variant="outline" size="sm" onClick={addHeader}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {form.headers.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Authorization"
                      value={h.key}
                      onChange={(e) => updateHeader(i, "key", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Bearer token..."
                      value={h.value}
                      onChange={(e) => updateHeader(i, "value", e.target.value)}
                      className="flex-1"
                      type="password"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeHeader(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Body Template */}
            <div className="space-y-1.5">
              <Label>
                Body Template{" "}
                <span className="text-xs text-muted-foreground">
                  (JSON; use {`{{paramName}}`} placeholders)
                </span>
              </Label>
              <Textarea
                placeholder={`{\n  "title": "{{title}}",\n  "description": "{{description}}"\n}`}
                value={form.bodyTemplate}
                onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
                rows={4}
                className="font-mono text-xs"
              />
            </div>

            {/* Parameters */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Parameters{" "}
                  <span className="text-xs text-muted-foreground">(the AI fills these in)</span>
                </Label>
                <Button variant="outline" size="sm" onClick={addParam}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {form.parameters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No parameters yet.</p>
              ) : (
                <div className="space-y-2">
                  {form.parameters.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        placeholder="name"
                        value={p.name}
                        onChange={(e) => updateParam(i, "name", e.target.value)}
                        className="col-span-3 text-xs font-mono"
                      />
                      <Select
                        value={p.type}
                        onValueChange={(v) => updateParam(i, "type", v)}
                      >
                        <SelectTrigger className="col-span-2 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="number">number</SelectItem>
                          <SelectItem value="boolean">boolean</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Description for the AI"
                        value={p.description}
                        onChange={(e) => updateParam(i, "description", e.target.value)}
                        className="col-span-5 text-xs"
                      />
                      <div className="col-span-1 flex items-center gap-1">
                        <Switch
                          checked={p.required}
                          onCheckedChange={(v) => updateParam(i, "required", v)}
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeParam(i)} className="col-span-1">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Toggle = required</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete integration?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be permanently removed. The AI will no longer
              be able to propose this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

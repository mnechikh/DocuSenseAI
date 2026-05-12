"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import yaml from "js-yaml";
import { useStore } from "@/lib/store";
import { getMyTenantQuota } from "@/lib/auth-actions";
import { type TenantPlan } from "@/lib/quota-constants";
import {
  createIntegration,
  listAllIntegrations,
  updateIntegration,
  deleteIntegration,
  executeIntegration,
  importIntegrations,
  exportIntegrations,
  testIntegrations,
  type IntegrationSummary,
  type IntegrationParameter,
  type ImportEntry,
  type ImportResult,
  type TestIntegrationResult,
} from "@/lib/integration-actions";
import {
  INTEGRATION_TEMPLATES,
  type IntegrationTemplate,
} from "@/lib/integration-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Plug2, Plus, Pencil, Trash2, ArrowLeft, ShieldCheck, FlaskConical,
  LayoutDashboard, ChevronDown, ChevronUp, X, Lock, CreditCard,
  Upload, Download, BookOpen, Play, HelpCircle,
  CheckCircle2, XCircle, Clock, Copy, Check, ChevronRight,
  Sparkles, Filter,
} from "lucide-react";
import Link from "next/link";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface HeaderRow { key: string; value: string }
interface FormState {
  name: string; description: string; endpoint: string;
  method: HttpMethod; headers: HeaderRow[]; bodyTemplate: string;
  parameters: IntegrationParameter[];
}
interface ParsedPreviewRow {
  index: number; name: string; method: string; endpoint: string;
  paramCount: number; error?: string; isDuplicate?: boolean;
}

const emptyForm = (): FormState => ({
  name: "", description: "", endpoint: "https://", method: "POST",
  headers: [{ key: "", value: "" }], bodyTemplate: "", parameters: [],
});

const ONBOARDING_KEY = "lumxia-integrations-onboarding-dismissed";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  POST: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  PUT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  PATCH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-semibold ${METHOD_COLORS[method] ?? "bg-muted text-muted-foreground"}`}>
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
    }}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

const JSON_EXAMPLE = `[
  {
    "name": "Slack Notification",
    "description": "Posts a message to Slack when called by the AI.",
    "enabled": true,
    "endpoint": "https://hooks.slack.com/services/T.../B.../xxx",
    "method": "POST",
    "headers": [
      { "key": "Content-Type", "value": "application/json" }
    ],
    "bodyTemplate": "{ \\"text\\": \\"{{message}}\\" }",
    "parameters": [
      {
        "name": "message",
        "type": "string",
        "description": "Message text to send",
        "required": true
      }
    ]
  }
]`;

const YAML_EXAMPLE = `- name: Slack Notification
  description: Posts a message to Slack when called by the AI.
  enabled: true
  endpoint: https://hooks.slack.com/services/T.../B.../xxx
  method: POST
  headers:
    - key: Content-Type
      value: application/json
  bodyTemplate: '{ "text": "{{message}}" }'
  parameters:
    - name: message
      type: string
      description: Message text to send
      required: true`;

function HelpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Integration Help</SheetTitle>
          <SheetDescription>Everything you need to set up and manage integrations.</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="guide" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 mb-0 self-start">
            <TabsTrigger value="guide">Guide</TabsTrigger>
            <TabsTrigger value="format">Format Reference</TabsTrigger>
            <TabsTrigger value="examples">Quick Examples</TabsTrigger>
          </TabsList>
          <TabsContent value="guide" className="flex-1 min-h-0">
            <ScrollArea className="h-full px-6 py-4">
              <Accordion type="multiple" defaultValue={["what"]} className="space-y-1">
                <AccordionItem value="what">
                  <AccordionTrigger className="text-sm font-semibold">What are Integrations?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>Integrations are HTTP endpoints that the Lumxia AI can call on behalf of users during a chat conversation.</p>
                    <p>For example: when a user says <em>&ldquo;create a Jira ticket for this bug&rdquo;</em>, the AI will propose calling your Jira integration and fire it automatically upon user confirmation.</p>
                    <p>Integrations are only proposed when relevant, based on the description you provide.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="endpoint">
                  <AccordionTrigger className="text-sm font-semibold">Setting up an Endpoint</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>Endpoints must use <strong>HTTPS</strong>. HTTP endpoints are rejected for security.</p>
                    <p>Choose the HTTP method that matches your API: <strong>POST</strong> to create, <strong>GET</strong> to fetch, <strong>PUT/PATCH</strong> to update, <strong>DELETE</strong> to remove.</p>
                    <p>The endpoint must be publicly reachable — local or private network URLs will time out.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="headers">
                  <AccordionTrigger className="text-sm font-semibold">Headers &amp; Authentication</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>Add headers for API keys and tokens here. Common patterns:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><code className="text-xs bg-muted px-1 rounded">Authorization: Bearer YOUR_TOKEN</code></li>
                      <li><code className="text-xs bg-muted px-1 rounded">X-API-Key: YOUR_KEY</code></li>
                    </ul>
                    <p className="text-amber-600 dark:text-amber-400 font-medium">&#x26A0; Header values are stored securely server-side and never returned to the browser or exported.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="params">
                  <AccordionTrigger className="text-sm font-semibold">Body Templates &amp; {"{{params}}"}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>The body template is a JSON string with <code className="text-xs bg-muted px-1 rounded">{`{{paramName}}`}</code> placeholders filled in by the AI at runtime.</p>
                    <pre className="bg-muted rounded p-2 text-xs overflow-auto">{`{\n  "title": "{{title}}",\n  "body": "{{description}}"\n}`}</pre>
                    <p>Each placeholder must have a matching Parameter defined in the Parameters section.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="testing">
                  <AccordionTrigger className="text-sm font-semibold">Testing Integrations</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>The <strong>Test</strong> button fires the integration with placeholder values (<code className="text-xs bg-muted px-1 rounded">__test__</code> for strings, <code className="text-xs bg-muted px-1 rounded">0</code> for numbers).</p>
                    <p>This verifies <strong>connectivity</strong> — the endpoint may return a validation error (4xx) but if it responds, connectivity is confirmed.</p>
                    <p>Use <strong>Test Mode</strong> to select multiple integrations and run them all at once with a results summary.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="bulk">
                  <AccordionTrigger className="text-sm font-semibold">Bulk Import &amp; Export</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>Use <strong>Import</strong> to onboard multiple integrations at once by pasting or uploading a JSON or YAML file.</p>
                    <p>Use <strong>Export</strong> to download your integrations for backup or to copy them to another workspace.</p>
                    <p className="text-amber-600 dark:text-amber-400">Header values are <strong>not</strong> exported. You will need to re-enter credentials after importing.</p>
                    <p>See the <strong>Format Reference</strong> tab for the exact schema.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="format" className="flex-1 min-h-0">
            <ScrollArea className="h-full px-6 py-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">JSON Format</h3>
                  <p className="text-xs text-muted-foreground mb-2">An array of objects. A single object (not wrapped in an array) is also accepted.</p>
                  <div className="relative">
                    <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-56 font-mono">{JSON_EXAMPLE}</pre>
                    <div className="absolute top-2 right-2"><CopyButton text={JSON_EXAMPLE} /></div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-1">YAML Format</h3>
                  <div className="relative">
                    <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-56 font-mono">{YAML_EXAMPLE}</pre>
                    <div className="absolute top-2 right-2"><CopyButton text={YAML_EXAMPLE} /></div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-2">Field Reference</h3>
                  <div className="rounded border overflow-hidden text-xs">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Field</th>
                          <th className="px-3 py-2 text-left font-semibold">Type</th>
                          <th className="px-3 py-2 text-left font-semibold">Req</th>
                          <th className="px-3 py-2 text-left font-semibold">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {([
                          ["name", "string", true, "Display name"],
                          ["description", "string", false, "Shown to AI to understand usage"],
                          ["enabled", "boolean", false, "Defaults to true"],
                          ["endpoint", "string", true, "HTTPS only"],
                          ["method", "string", false, "GET/POST/PUT/PATCH/DELETE, default POST"],
                          ["headers", "array", false, "[{ key, value }] — values stored securely"],
                          ["bodyTemplate", "string", false, "JSON with {{param}} placeholders"],
                          ["parameters", "array", false, "[{ name, type, description, required }]"],
                        ] as [string, string, boolean, string][]).map(([f, t, r, n]) => (
                          <tr key={f} className="hover:bg-muted/50">
                            <td className="px-3 py-1.5 font-mono text-primary">{f}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{t}</td>
                            <td className="px-3 py-1.5">{r ? <span className="text-destructive font-medium">yes</span> : <span className="text-muted-foreground">no</span>}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="examples" className="flex-1 min-h-0">
            <ScrollArea className="h-full px-6 py-4">
              <p className="text-sm text-muted-foreground mb-4">Copy any example to use in the Import dialog, or browse the Template Gallery for one-click imports.</p>
              <div className="space-y-4">
                {INTEGRATION_TEMPLATES.slice(0, 4).map((t) => {
                  const snippet = JSON.stringify([{ name: t.name, description: t.description, endpoint: t.endpoint, method: t.method, parameters: t.parameters }], null, 2);
                  return (
                    <div key={t.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{t.icon}</span>
                        <span className="text-sm font-semibold">{t.name}</span>
                        <MethodBadge method={t.method} />
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                      <div className="relative">
                        <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-28 font-mono">{snippet}</pre>
                        <div className="absolute top-1 right-1"><CopyButton text={snippet} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function TemplateGallery({ open, onOpenChange, existingNames, onImport }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  existingNames: Set<string>; onImport: (entries: ImportEntry[]) => void;
}) {
  const [filter, setFilter] = useState("all");
  const categories = [
    { id: "all", label: "All" }, { id: "notifications", label: "Notifications" },
    { id: "project-mgmt", label: "Project Mgmt" }, { id: "crm", label: "CRM" }, { id: "generic", label: "Generic" },
  ];
  const filtered = filter === "all" ? INTEGRATION_TEMPLATES : INTEGRATION_TEMPLATES.filter((t) => t.category === filter);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Template Gallery</SheetTitle>
          <SheetDescription>Ready-to-use integrations. Click &ldquo;Use Template&rdquo; to import instantly.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pt-3 pb-0 flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {categories.map((c) => (
            <Button key={c.id} variant={filter === c.id ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setFilter(c.id)}>{c.label}</Button>
          ))}
        </div>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-3">
            {filtered.map((t: IntegrationTemplate) => (
              <Card key={t.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{t.icon}</span>
                      <div>
                        <CardTitle className="text-sm">{t.name}</CardTitle>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MethodBadge method={t.method} />
                          <Badge variant="outline" className="text-xs px-1.5 py-0">{t.categoryLabel}</Badge>
                          {existingNames.has(t.name) && <Badge variant="secondary" className="text-xs px-1.5 py-0 text-amber-600">&#x26A0; name exists</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" className="h-7 text-xs shrink-0" onClick={() => {
                      onImport([{ name: t.name, description: t.description, enabled: true, endpoint: t.endpoint, method: t.method, headers: t.headers, bodyTemplate: t.bodyTemplate, parameters: t.parameters }]);
                      onOpenChange(false);
                    }}>
                      Use Template <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  {t.parameters.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">params:</span>
                      {t.parameters.map((p) => <code key={p.name} className="text-xs bg-muted px-1 rounded font-mono">{p.name}</code>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ImportDialog({ open, onOpenChange, existingNames, onSuccess, initialText }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  existingNames: Set<string>; onSuccess: () => void; initialText?: string;
}) {
  const { toast } = useToast();
  const [text, setText] = useState(initialText ?? "");
  const [format, setFormat] = useState<"auto" | "json" | "yaml">("auto");
  const [preview, setPreview] = useState<ParsedPreviewRow[] | null>(null);
  const [parsed, setParsed] = useState<ImportEntry[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && initialText) { setText(initialText); setPreview(null); setParsed(null); setParseError(null); }
  }, [open, initialText]);

  const handleParse = () => {
    setParseError(null); setPreview(null); setParsed(null);
    if (!text.trim()) { setParseError("Please paste or upload a JSON or YAML file."); return; }
    try {
      let raw: unknown;
      const det = format === "auto" ? (text.trimStart().startsWith("[") || text.trimStart().startsWith("{") ? "json" : "yaml") : format;
      raw = det === "json" ? JSON.parse(text) : yaml.load(text);
      const arr = Array.isArray(raw) ? raw : [raw];
      const entries = arr as ImportEntry[];
      const rows: ParsedPreviewRow[] = entries.map((e, i) => {
        const name = typeof e?.name === "string" && e.name.trim() ? e.name.trim() : `(entry #${i + 1})`;
        let error: string | undefined;
        if (!e?.name) error = "name is required";
        else if (!e?.endpoint) error = "endpoint is required";
        else if (typeof e.endpoint === "string" && !e.endpoint.startsWith("https://")) error = "endpoint must start with https://";
        return { index: i, name, method: String(e?.method ?? "POST"), endpoint: String(e?.endpoint ?? ""), paramCount: Array.isArray(e?.parameters) ? (e.parameters as unknown[]).length : 0, error, isDuplicate: !error && existingNames.has(name) };
      });
      setPreview(rows); setParsed(entries);
    } catch (err: unknown) { setParseError(`Parse error: ${(err as Error).message}`); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "json") setFormat("json"); else if (ext === "yaml" || ext === "yml") setFormat("yaml");
    const reader = new FileReader();
    reader.onload = (ev) => { setText(ev.target?.result as string ?? ""); };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsed || importing) return;
    setImporting(true);
    try {
      const result: ImportResult = await importIntegrations(parsed);
      toast({ title: `Imported ${result.created} integration${result.created !== 1 ? "s" : ""}`, description: result.errors.length > 0 ? `${result.errors.length} skipped: ${result.errors.map((e) => e.name).join(", ")}` : "All integrations created successfully." });
      onOpenChange(false); onSuccess();
    } catch (err: unknown) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const validCount = preview ? preview.filter((r) => !r.error).length : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) { setPreview(null); setParsed(null); setParseError(null); } } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Import Integrations</DialogTitle>
          <DialogDescription>Paste JSON or YAML, or upload a file. Each array entry becomes one integration.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-1">
          <div className="flex items-center gap-3 flex-wrap">
            <input ref={fileRef} type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-1.5" />Upload file</Button>
            <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
              Format:
              {(["auto", "json", "yaml"] as const).map((f) => (
                <Button key={f} variant={format === f ? "default" : "outline"} size="sm" className="h-6 px-2 text-xs" onClick={() => setFormat(f)}>{f}</Button>
              ))}
            </div>
          </div>
          <Textarea
            placeholder={`Paste JSON or YAML here, e.g.:\n[\n  {\n    "name": "Slack Notification",\n    "endpoint": "https://hooks.slack.com/...",\n    ...\n  }\n]`}
            value={text}
            onChange={(e) => { setText(e.target.value); setPreview(null); setParsed(null); setParseError(null); }}
            rows={8} className="font-mono text-xs resize-none"
          />
          {parseError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-3">
              <XCircle className="h-4 w-4 shrink-0" />{parseError}
            </div>
          )}
          {preview && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {preview.length} entries — <span className="text-green-600 font-medium">{validCount} valid</span>
                {preview.length - validCount > 0 && <span className="text-destructive"> · {preview.length - validCount} with errors</span>}
              </div>
              <div className="rounded border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">Name</th>
                      <th className="px-3 py-2 text-left font-semibold">Method</th>
                      <th className="px-3 py-2 text-left font-semibold">Endpoint</th>
                      <th className="px-3 py-2 text-left font-semibold">Params</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.map((row) => (
                      <tr key={row.index} className={row.error ? "bg-destructive/5" : "hover:bg-muted/30"}>
                        <td className="px-3 py-2 text-muted-foreground">{row.index + 1}</td>
                        <td className="px-3 py-2 font-medium max-w-[120px] truncate">{row.name}</td>
                        <td className="px-3 py-2"><MethodBadge method={row.method} /></td>
                        <td className="px-3 py-2 text-muted-foreground font-mono max-w-[140px] truncate">{row.endpoint}</td>
                        <td className="px-3 py-2 text-center">{row.paramCount}</td>
                        <td className="px-3 py-2">
                          {row.error
                            ? <span className="text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" />{row.error}</span>
                            : row.isDuplicate
                              ? <span className="text-amber-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />name exists</span>
                              : <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />valid</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.some((r) => r.isDuplicate) && (
                <p className="text-xs text-amber-600">&#x26A0; Duplicate names will be created as new integrations — delete any duplicates afterwards.</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { onOpenChange(false); setPreview(null); setParsed(null); setParseError(null); }}>Cancel</Button>
          {!preview
            ? <Button onClick={handleParse} disabled={!text.trim()}>Preview</Button>
            : <Button onClick={handleImport} disabled={importing || validCount === 0}>{importing ? "Importing…" : `Import ${validCount} integration${validCount !== 1 ? "s" : ""}`}</Button>
          }
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestResultsSheet({ open, onOpenChange, results, onRetest, retestingId }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  results: TestIntegrationResult[]; onRetest: (id: string) => void; retestingId: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[60vh] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" /> Test Results
            <span className="text-sm font-normal text-muted-foreground ml-auto">
              {results.filter((r) => r.success).length}/{results.length} passed
            </span>
          </SheetTitle>
          <SheetDescription className="text-xs">Required parameters use placeholder values — tests verify connectivity only.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Integration</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Latency</th>
                <th className="px-4 py-2 text-left font-semibold">Result</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((r) => (
                <tr key={r.id} className={r.success ? "bg-green-50/40 dark:bg-green-950/10" : r.statusCode >= 400 && r.statusCode < 500 ? "bg-amber-50/40 dark:bg-amber-950/10" : "bg-red-50/40 dark:bg-red-950/10"}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono font-semibold text-sm ${r.success ? "text-green-600" : r.statusCode >= 400 && r.statusCode < 500 ? "text-amber-600" : "text-destructive"}`}>
                      {r.statusCode || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.latencyMs ? `${r.latencyMs}ms` : "—"}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex items-center gap-1.5">
                      {r.success ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                      <span className="truncate text-xs text-muted-foreground">{r.error || "OK"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={retestingId === r.id} onClick={() => onRetest(r.id)}>
                      <Play className="h-3 w-3 mr-1" />{retestingId === r.id ? "…" : "Re-test"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function OnboardingBanner({ onDismiss, onAdd, onImport, onTemplates }: {
  onDismiss: () => void; onAdd: () => void; onImport: () => void; onTemplates: () => void;
}) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2"><Plug2 className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle className="text-base">Get started with Integrations</CardTitle>
              <CardDescription>Give the AI the ability to take action — send messages, create tickets, update records and more.</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={onDismiss}><X className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { n: "1", title: "Create or Import", desc: "Add integrations manually, bulk-import from a JSON/YAML file, or start with a ready-made template." },
            { n: "2", title: "Configure & Test", desc: "Set your endpoint, headers for auth, and a body template with {{param}} placeholders. Test connectivity instantly." },
            { n: "3", title: "Enable & Chat", desc: "Toggle integrations on. The AI will propose them automatically when users ask for relevant actions in chat." },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-3 rounded-lg bg-muted/60 p-3">
              <div className="rounded-full bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">{step.n}</div>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={onAdd}><Plus className="h-4 w-4 mr-1.5" />Add Manually</Button>
          <Button variant="outline" onClick={onImport}><Upload className="h-4 w-4 mr-1.5" />Import from file</Button>
          <Button variant="outline" onClick={onTemplates}><Sparkles className="h-4 w-4 mr-1.5" />Browse Templates</Button>
          <Button variant="ghost" className="ml-auto text-muted-foreground text-xs" onClick={onDismiss}>Skip for now</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntegrationsPage() {
  const router = useRouter();
  const { currentUser } = useStore();
  const { toast } = useToast();

  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<TenantPlan | null>(null);
  const [integrationQuota, setIntegrationQuota] = useState<number>(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IntegrationSummary | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IntegrationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importInitialText, setImportInitialText] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTesting, setBulkTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestIntegrationResult[]>([]);
  const [testResultsOpen, setTestResultsOpen] = useState(false);
  const [retestingId, setRetestingId] = useState<string | null>(null);
  const [headersModified, setHeadersModified] = useState(false);

  useEffect(() => {
    getMyTenantQuota().then((q) => {
      setPlan(q.plan);
      setIntegrationQuota(q.integrationQuota);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAllIntegrations();
      setIntegrations(data);
    } catch (e: unknown) {
      toast({ title: "Failed to load integrations", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { if (plan !== null && plan !== "free") load(); }, [load, plan]);

  useEffect(() => {
    if (!loading && integrations.length === 0 && !localStorage.getItem(ONBOARDING_KEY)) setOnboardingVisible(true);
    else setOnboardingVisible(false);
  }, [loading, integrations.length]);

  const existingNames = new Set(integrations.map((i) => i.name));

  if (plan === null) return <div className="flex items-center justify-center h-[60vh]"><span className="text-muted-foreground">Loading…</span></div>;

  if (plan === "free") return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
      <div className="rounded-full bg-muted p-4 mb-4"><Lock className="w-10 h-10 text-muted-foreground" /></div>
      <h2 className="text-2xl font-bold mb-2">Integrations — Paid Feature</h2>
      <p className="text-muted-foreground max-w-sm mb-6">Connect Lumxia to external services and automate workflows. Available on Starter and Pro plans.</p>
      <Button onClick={() => router.push("/dashboard/billing")}><CreditCard className="mr-2 h-4 w-4" />Upgrade to unlock</Button>
      <Button variant="ghost" className="mt-2" onClick={() => router.push("/dashboard")}><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button>
    </div>
  );

  if (currentUser?.role !== "Admin") return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
      <ShieldCheck className="w-12 h-12 text-destructive mb-4" />
      <h2 className="text-2xl font-bold">Access Denied</h2>
      <p className="text-muted-foreground">Only administrators can manage integrations.</p>
      <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button>
    </div>
  );

  const atQuota = plan === "starter" && integrationQuota > 0 && integrations.length >= integrationQuota;
  const isPro = plan === "pro";
  const requirePro = (feature: string): boolean => {
    if (!isPro) {
      toast({ title: `${feature} requires Pro`, description: "Upgrade to unlock bulk import/export, template gallery, and test mode.", variant: "destructive" });
      router.push("/dashboard/billing");
      return false;
    }
    return true;
  };

  const openCreate = () => { setEditTarget(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (ig: IntegrationSummary) => {
    setEditTarget(ig);
    setHeadersModified(false);
    setForm({ name: ig.name, description: ig.description, endpoint: ig.endpoint, method: ig.method, headers: [], bodyTemplate: ig.bodyTemplate, parameters: ig.parameters });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!form.endpoint.startsWith("https://")) { toast({ title: "Endpoint must start with https://", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const filteredHeaders = form.headers.filter((h) => h.key.trim());
      if (editTarget) {
        const updatePayload: Parameters<typeof updateIntegration>[1] = { name: form.name.trim(), description: form.description.trim(), endpoint: form.endpoint.trim(), method: form.method, bodyTemplate: form.bodyTemplate, parameters: form.parameters.filter((p) => p.name.trim()), ...(headersModified && { headers: filteredHeaders }) };
        await updateIntegration(editTarget.id, updatePayload); toast({ title: "Integration updated" });
      } else {
        await createIntegration({ name: form.name.trim(), description: form.description.trim(), endpoint: form.endpoint.trim(), method: form.method, headers: filteredHeaders, bodyTemplate: form.bodyTemplate, parameters: form.parameters.filter((p) => p.name.trim()) }); toast({ title: "Integration created" });
      }
      setDialogOpen(false); await load();
    } catch (e: unknown) { toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteIntegration(deleteTarget.id);
      toast({ title: "Integration deleted" }); setDeleteTarget(null); await load();
    } catch (e: unknown) { toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  const handleToggleEnabled = async (ig: IntegrationSummary) => {
    try { await updateIntegration(ig.id, { enabled: !ig.enabled }); await load(); }
    catch (e: unknown) { toast({ title: "Failed to update", description: (e as Error).message, variant: "destructive" }); }
  };

  const handleTest = async (ig: IntegrationSummary) => {
    setTestingId(ig.id);
    try {
      const testParams: Record<string, unknown> = {};
      for (const p of ig.parameters) testParams[p.name] = p.type === "number" ? 0 : p.type === "boolean" ? false : "test";
      const result = await executeIntegration(ig.id, testParams);
      toast({ title: result.success ? `Test succeeded (${result.statusCode})` : `Test failed (${result.statusCode})`, description: result.result.slice(0, 200), variant: result.success ? "default" : "destructive" });
    } catch (e: unknown) { toast({ title: "Test error", description: (e as Error).message, variant: "destructive" }); }
    finally { setTestingId(null); }
  };

  const handleExport = async (fmt: "json" | "yaml") => {
    setExporting(true);
    try {
      const data = await exportIntegrations();
      const content = fmt === "json" ? JSON.stringify(data, null, 2) : yaml.dump(data);
      const blob = new Blob([content], { type: fmt === "json" ? "application/json" : "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `integrations.${fmt === "json" ? "json" : "yaml"}`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Exported as ${fmt.toUpperCase()}`, description: `${data.length} integration${data.length !== 1 ? "s" : ""} downloaded.` });
    } catch (e: unknown) { toast({ title: "Export failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setExporting(false); }
  };

  const handleBulkTest = async () => {
    if (selectedIds.size === 0 || bulkTesting) return;
    setBulkTesting(true);
    try {
      const results = await testIntegrations(Array.from(selectedIds));
      setTestResults(results); setTestResultsOpen(true);
    } catch (e: unknown) { toast({ title: "Bulk test failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBulkTesting(false); }
  };

  const handleRetest = async (id: string) => {
    setRetestingId(id);
    try {
      const results = await testIntegrations([id]);
      setTestResults((prev) => prev.map((r) => r.id === id ? results[0] : r));
    } catch (e: unknown) { toast({ title: "Re-test failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setRetestingId(null); }
  };

  const toggleSelect = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds(selectedIds.size === integrations.length ? new Set() : new Set(integrations.map((i) => i.id)));
  const dismissOnboarding = () => { localStorage.setItem(ONBOARDING_KEY, "1"); setOnboardingVisible(false); };

  const addHeader = () => { setHeadersModified(true); setForm((f) => ({ ...f, headers: [...f.headers, { key: "", value: "" }] })); };
  const removeHeader = (i: number) => { setHeadersModified(true); setForm((f) => ({ ...f, headers: f.headers.filter((_, idx) => idx !== i) })); };
  const updateHeader = (i: number, field: "key" | "value", val: string) => { setHeadersModified(true); setForm((f) => { const h = [...f.headers]; h[i] = { ...h[i], [field]: val }; return { ...f, headers: h }; }); };
  const addParam = () => setForm((f) => ({ ...f, parameters: [...f.parameters, { name: "", type: "string", description: "", required: true }] }));
  const removeParam = (i: number) => setForm((f) => ({ ...f, parameters: f.parameters.filter((_, idx) => idx !== i) }));
  const updateParam = (i: number, field: keyof IntegrationParameter, val: unknown) => setForm((f) => { const p = [...f.parameters]; p[i] = { ...p[i], [field]: val }; return { ...f, parameters: p }; });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground flex items-center gap-1">
          <LayoutDashboard className="h-3.5 w-3.5" />Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Integrations</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Plug2 className="h-6 w-6" />Integrations</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure external HTTP actions the AI can propose during chat.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setHelpOpen(true)} title="Help &amp; Documentation"><HelpCircle className="h-4 w-4" /></Button>
          {integrations.length > 0 && (
            <Button variant={selectMode ? "default" : "outline"} size="sm" onClick={() => { if (!requirePro("Test Mode")) return; setSelectMode((v) => !v); setSelectedIds(new Set()); }}>
              <FlaskConical className="h-4 w-4 mr-1.5" />{selectMode ? "Exit Test Mode" : "Test Mode"}{!isPro && <Lock className="h-3 w-3 ml-1.5 opacity-60" />}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { if (!requirePro("Import")) return; setImportInitialText(undefined); setImportOpen(true); }}>
            <Upload className="h-4 w-4 mr-1.5" />Import{!isPro && <Lock className="h-3 w-3 ml-1.5 opacity-60" />}
          </Button>
          {integrations.length > 0 && (
            isPro ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exporting}><Download className="h-4 w-4 mr-1.5" />Export<ChevronDown className="h-3 w-3 ml-1" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("json")}>Export as JSON</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("yaml")}>Export as YAML</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" onClick={() => requirePro("Export")}>
                <Download className="h-4 w-4 mr-1.5" />Export<Lock className="h-3 w-3 ml-1.5 opacity-60" />
              </Button>
            )
          )}
          <Button variant="outline" size="sm" onClick={() => { if (!requirePro("Template Gallery")) return; setTemplatesOpen(true); }}>
            <Sparkles className="h-4 w-4 mr-1.5" />Templates{!isPro && <Lock className="h-3 w-3 ml-1.5 opacity-60" />}
          </Button>
          <Button onClick={openCreate} disabled={atQuota} title={atQuota ? "Integration limit reached. Upgrade to Pro for unlimited." : undefined}>
            <Plus className="h-4 w-4 mr-1.5" />New Integration{atQuota && <Lock className="h-3.5 w-3.5 ml-1.5" />}
          </Button>
        </div>
      </div>

      {/* Integration quota usage bar (Starter only) */}
      {plan === "starter" && !loading && (
        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium">Integrations used</span>
              <span className={atQuota ? "text-destructive font-semibold" : "text-muted-foreground"}>
                {integrations.length} / {integrationQuota}
              </span>
            </div>
            <Progress value={integrationQuota > 0 ? Math.min((integrations.length / integrationQuota) * 100, 100) : 0} className="h-1.5" />
          </div>
          {atQuota ? (
            <Button size="sm" className="shrink-0 text-xs h-8" onClick={() => router.push("/dashboard/billing")}>
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />Upgrade for unlimited
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground shrink-0">
              Starter plan &middot;{" "}
              <button className="underline hover:text-foreground" onClick={() => router.push("/dashboard/billing")}>upgrade to Pro</button>
              {" "}for unlimited
            </span>
          )}
        </div>
      )}

      {/* Onboarding banner */}
      {onboardingVisible && (
        <OnboardingBanner
          onDismiss={dismissOnboarding}
          onAdd={() => { dismissOnboarding(); openCreate(); }}
          onImport={() => { dismissOnboarding(); setImportInitialText(undefined); setImportOpen(true); }}
          onTemplates={() => { dismissOnboarding(); setTemplatesOpen(true); }}
        />
      )}

      {/* Test mode selection bar */}
      {selectMode && integrations.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <Checkbox checked={selectedIds.size === integrations.length} onCheckedChange={toggleSelectAll} id="select-all" />
          <label htmlFor="select-all" className="text-sm cursor-pointer select-none">
            {selectedIds.size === integrations.length ? "Deselect all" : "Select all"}
          </label>
          <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" disabled={selectedIds.size === 0 || bulkTesting} onClick={handleBulkTest}>
              {bulkTesting ? <><Clock className="h-3.5 w-3.5 mr-1.5 animate-pulse" />Testing…</> : <><Play className="h-3.5 w-3.5 mr-1.5" />Test Selected ({selectedIds.size})</>}
            </Button>
            {testResults.length > 0 && <Button variant="outline" size="sm" onClick={() => setTestResultsOpen(true)}>View Last Results</Button>}
          </div>
        </div>
      )}

      {/* Main content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-64 bg-muted rounded mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : integrations.length === 0 && !onboardingVisible ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Plug2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No integrations yet</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-xs mx-auto">Add an integration so the AI can propose actions like creating tickets or sending webhooks.</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add manually</Button>
              <Button variant="outline" onClick={() => setTemplatesOpen(true)}><Sparkles className="mr-2 h-4 w-4" />Browse templates</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {integrations.map((ig) => (
            <Card key={ig.id} className={`transition-all ${ig.enabled ? "" : "opacity-60"} ${selectMode && selectedIds.has(ig.id) ? "ring-2 ring-primary" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  {selectMode && <div className="pt-0.5 shrink-0"><Checkbox checked={selectedIds.has(ig.id)} onCheckedChange={() => toggleSelect(ig.id)} /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{ig.name}</CardTitle>
                      <Badge variant={ig.enabled ? "default" : "secondary"} className="text-xs">{ig.enabled ? "Enabled" : "Disabled"}</Badge>
                      <MethodBadge method={ig.method} />
                      {ig.parameters.length > 0 && <Badge variant="outline" className="text-xs">{ig.parameters.length} param{ig.parameters.length !== 1 ? "s" : ""}</Badge>}
                    </div>
                    <CardDescription className="mt-1 line-clamp-2">{ig.description}</CardDescription>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{ig.endpoint}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch checked={ig.enabled} onCheckedChange={() => handleToggleEnabled(ig)} />
                    <Button variant="outline" size="sm" onClick={() => handleTest(ig)} disabled={testingId === ig.id || !ig.enabled} className="hidden sm:flex">
                      <FlaskConical className="h-3.5 w-3.5 mr-1" />{testingId === ig.id ? "Testing…" : "Test"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(ig)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(ig)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setExpandedId(expandedId === ig.id ? null : ig.id)}>
                      {expandedId === ig.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expandedId === ig.id && (
                <CardContent className="pt-0 border-t space-y-3">
                  {ig.parameters.length > 0 && (
                    <div className="pt-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Parameters</p>
                      <div className="space-y-1.5">
                        {ig.parameters.map((p) => (
                          <div key={p.name} className="flex items-center gap-2 flex-wrap">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{p.name}</code>
                            <Badge variant="outline" className="text-xs">{p.type}</Badge>
                            {p.required && <Badge variant="secondary" className="text-xs">required</Badge>}
                            <span className="text-muted-foreground text-xs">{p.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {ig.bodyTemplate && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Body Template</p>
                      <div className="relative">
                        <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-32 font-mono">{ig.bodyTemplate}</pre>
                        <div className="absolute top-1 right-1"><CopyButton text={ig.bodyTemplate} /></div>
                      </div>
                    </div>
                  )}
                  <div className="sm:hidden">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleTest(ig)} disabled={testingId === ig.id || !ig.enabled}>
                      <FlaskConical className="h-3.5 w-3.5 mr-1.5" />{testingId === ig.id ? "Testing…" : "Test connectivity"}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {integrations.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-4">
          <span>{integrations.length} integration{integrations.length !== 1 ? "s" : ""} · {integrations.filter((i) => i.enabled).length} enabled</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setTemplatesOpen(true)}>
            <Sparkles className="h-3 w-3 mr-1" />Browse more templates
          </Button>
        </div>
      )}

      {/* Sheets & Dialogs */}
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
      <TemplateGallery open={templatesOpen} onOpenChange={setTemplatesOpen} existingNames={existingNames}
        onImport={(entries) => { setImportInitialText(JSON.stringify(entries, null, 2)); setImportOpen(true); }} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} existingNames={existingNames} onSuccess={load} initialText={importInitialText} />
      <TestResultsSheet open={testResultsOpen} onOpenChange={setTestResultsOpen} results={testResults} onRetest={handleRetest} retestingId={retestingId} />

      {/* Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Integration" : "New Integration"}</DialogTitle>
            <DialogDescription>Configure an HTTP endpoint the AI can call during chat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Create Jira Ticket" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-xs text-muted-foreground">(shown to AI to decide when to use)</span></Label>
              <Textarea placeholder="Creates a Jira ticket. Use when the user wants to track an issue." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v as HttpMethod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(["POST","GET","PUT","PATCH","DELETE"] as HttpMethod[]).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>Endpoint URL (HTTPS only) <span className="text-destructive">*</span></Label>
                <Input placeholder="https://api.example.com/tickets" value={form.endpoint} onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              {/* Hidden honeypot inputs to block browser credential autofill */}
              <input type="text" style={{display:"none"}} aria-hidden="true" />
              <input type="password" style={{display:"none"}} aria-hidden="true" />
              <div className="flex items-center justify-between">
                <Label>Headers <span className="text-xs text-muted-foreground">(API keys, auth tokens — stored securely)</span></Label>
                <Button variant="outline" size="sm" onClick={addHeader}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              {editTarget && !headersModified && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2.5 py-1.5">
                  Saved headers are preserved server-side and not shown here. Add a row only if you want to replace them.
                </p>
              )}
              <div className="space-y-2">
                {form.headers.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Authorization" value={h.key} onChange={(e) => updateHeader(i, "key", e.target.value)} className="flex-1" autoComplete="off" name={`hk-${i}`} />
                    <Input placeholder="Bearer token…" value={h.value} onChange={(e) => updateHeader(i, "value", e.target.value)} className="flex-1" type="password" autoComplete="new-password" name={`hv-${i}`} />
                    <Button variant="ghost" size="icon" onClick={() => removeHeader(i)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Body Template <span className="text-xs text-muted-foreground">(JSON; use {`{{paramName}}`} placeholders)</span></Label>
              <Textarea placeholder={`{\n  "title": "{{title}}",\n  "description": "{{description}}"\n}`} value={form.bodyTemplate} onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))} rows={4} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Parameters <span className="text-xs text-muted-foreground">(the AI fills these in)</span></Label>
                <Button variant="outline" size="sm" onClick={addParam}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              {form.parameters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No parameters yet.</p>
              ) : (
                <div className="space-y-2">
                  {form.parameters.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input placeholder="name" value={p.name} onChange={(e) => updateParam(i, "name", e.target.value)} className="col-span-3 text-xs font-mono" />
                      <Select value={p.type} onValueChange={(v) => updateParam(i, "type", v)}>
                        <SelectTrigger className="col-span-2 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="string">string</SelectItem><SelectItem value="number">number</SelectItem><SelectItem value="boolean">boolean</SelectItem></SelectContent>
                      </Select>
                      <Input placeholder="Description for the AI" value={p.description} onChange={(e) => updateParam(i, "description", e.target.value)} className="col-span-5 text-xs" />
                      <div className="col-span-1 flex items-center justify-center"><Switch checked={p.required} onCheckedChange={(v) => updateParam(i, "required", v)} /></div>
                      <Button variant="ghost" size="icon" onClick={() => removeParam(i)} className="col-span-1"><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Toggle = required</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editTarget ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete integration?</AlertDialogTitle>
            <AlertDialogDescription><strong>{deleteTarget?.name}</strong> will be permanently removed. The AI will no longer be able to propose this action.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? "Deleting…" : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

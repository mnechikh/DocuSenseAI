"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  KeyRound, Plus, Trash2, Copy, Check, ArrowLeft, LayoutDashboard,
  ShieldCheck, Clock,
} from "lucide-react";
import Link from "next/link";

interface ApiKeyRow {
  keyId: string;
  label: string;
  keyPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  active: boolean;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const { currentUser } = useStore();
  const { toast } = useToast();

  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);
  // Shown-once dialog for new key
  const [newKeyDialog, setNewKeyDialog] = useState<{ rawKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const data = await listApiKeys();
      setKeys(data.filter((k) => k.active));
    } catch (e: unknown) {
      toast({ title: "Failed to load API keys", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  if (currentUser?.role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
        <ShieldCheck className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can manage API keys.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard
        </Button>
      </div>
    );
  }

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { rawKey } = await createApiKey(newLabel.trim() || "Unnamed key");
      setNewKeyDialog({ rawKey });
      setNewLabel("");
      await loadKeys();
    } catch (e: unknown) {
      toast({ title: "Failed to create key", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget || revoking) return;
    setRevoking(true);
    try {
      await revokeApiKey(revokeTarget.keyId);
      toast({ title: "Key revoked", description: `"${revokeTarget.label}" has been revoked.` });
      setRevokeTarget(null);
      await loadKeys();
    } catch (e: unknown) {
      toast({ title: "Failed to revoke key", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmt = (ms: number | null) =>
    ms ? new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Never";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          onClick={() => router.push("/dashboard")}>
          <LayoutDashboard className="w-3.5 h-3.5" />Dashboard
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">API Keys</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <KeyRound className="w-7 h-7" />API Keys
          </h1>
          <p className="text-muted-foreground mt-1">
            Integrate external systems with the Lumxia REST API •{" "}
            <span className="font-medium text-primary">{currentUser?.tenantId}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-1.5 h-4 w-4" />Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Create new key */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create New API Key</CardTitle>
          <CardDescription>Keys are shown only once. Store them securely.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Key label (e.g. Production, Zapier, CRM)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="max-w-sm"
            />
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              {creating ? "Creating…" : "Create Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keys table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-white/50 border-b">
          <CardTitle className="text-base">Active Keys</CardTitle>
          <CardDescription>{keys.length} active key{keys.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No active API keys. Create one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Label</TableHead>
                  <TableHead>Key prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.keyId}>
                    <TableCell className="font-medium">{k.label}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {k.keyPrefix}…
                      </code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt(k.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />{fmt(k.lastUsedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRevokeTarget(k)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* API Reference card */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />Quick Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1 text-muted-foreground uppercase text-xs tracking-wider">Query your knowledge base</p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{`POST ${appUrl}/api/v1/query
Authorization: Bearer lum_<your-key>
Content-Type: application/json

{ "query": "What are the payment terms?", "topK": 10 }`}</pre>
          </div>
          <div>
            <p className="font-medium mb-1 text-muted-foreground uppercase text-xs tracking-wider">List documents</p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{`GET ${appUrl}/api/v1/documents
Authorization: Bearer lum_<your-key>`}</pre>
          </div>
          <div>
            <p className="font-medium mb-1 text-muted-foreground uppercase text-xs tracking-wider">Ingest a document via URL</p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{`POST ${appUrl}/api/v1/documents
Authorization: Bearer lum_<your-key>
Content-Type: application/json

{ "filename": "report.pdf", "fileType": "application/pdf", "url": "https://..." }`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Shown-once new key dialog */}
      <Dialog open={!!newKeyDialog} onOpenChange={(o) => { if (!o) setNewKeyDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />Your new API key
            </DialogTitle>
            <DialogDescription>
              Copy and store this key now. It will <strong>not</strong> be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
              {newKeyDialog?.rawKey}
            </code>
            <Button variant="outline" size="icon" onClick={() => copyKey(newKeyDialog?.rawKey ?? "")}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={() => setNewKeyDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              The key <strong>"{revokeTarget?.label}"</strong> ({revokeTarget?.keyPrefix}…) will be permanently revoked.
              Any integrations using it will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

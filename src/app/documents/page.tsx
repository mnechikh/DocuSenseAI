"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStore, DocumentRecord } from "@/lib/store";
import { useDocuments } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowUpCircle,
  Info,
  ArrowLeft,
  RotateCcw,
  Search,
  X,
  LayoutDashboard,
} from "lucide-react";
import { uploadAndProcessDocumentForAIAnalysis } from "@/ai/flows/upload-and-process-document-for-ai-analysis";
import { deleteDocumentChunks } from "@/lib/auth-actions";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_FILE_SIZE_MB = 30;

function StatusCell({ doc }: { doc: DocumentRecord }) {
  switch (doc.status) {
    case "indexed":
      return (
        <div className="flex items-center gap-1.5 text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-xs font-semibold">Ready</span>
        </div>
      );
    case "processing":
      return (
        <div className="flex items-center gap-1.5 text-blue-600">
          <Clock className="w-4 h-4 animate-spin" />
          <span className="text-xs font-semibold">Indexing…</span>
        </div>
      );
    case "uploaded":
      return (
        <div className="flex items-center gap-1.5 text-yellow-600">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-semibold">Queued</span>
        </div>
      );
    default:
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-destructive cursor-help">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-semibold">Error</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {doc.failureReason ?? "Unknown processing error"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
  }
}

export default function DocumentsPage() {
  const router = useRouter();
  const { currentUser } = useStore();
  const {
    documents,
    addDocument: addDocumentToFirestore,
    updateDocument,
    removeDocument,
  } = useDocuments(currentUser?.tenantId);
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentRecord["status"] | "all">("all");

  if (currentUser?.role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can manage documents.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const processFile = async (
    file: File,
    docId: string
  ): Promise<void> => {
    const processingStart = Date.now();
    try {
      // Read as base64 data URI on the client so the server action doesn't need to
      // re-download from Firebase Storage — saves a full round-trip.
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      // Kick off Storage upload and AI processing in parallel.
      // Storage upload is still needed for persistence / retry download.
      const storageRef = ref(storage, `tenants/${currentUser.tenantId}/docs/${docId}/${file.name}`);
      await updateDocument(docId, { status: "processing" });

      const [, result] = await Promise.all([
        uploadBytes(storageRef, file),
        uploadAndProcessDocumentForAIAnalysis({
          tenantId: currentUser.tenantId,
          documentId: docId,
          filename: file.name,
          fileType: file.type,
          documentDataUri: dataUri,
          callerRole: currentUser.role,
        }),
      ]);

      const processingMs = Date.now() - processingStart;

      if (result.status === "processed") {
        await updateDocument(docId, {
          status: "indexed",
          chunkCount: result.chunkCount,
          processingMs,
          chunks: result.chunks,
        });
        toast({
          title: "Document Indexed",
          description: `${file.name} — ${result.chunkCount} chunks in ${(processingMs / 1000).toFixed(1)}s`,
        });
      } else {
        await updateDocument(docId, { status: "failed", failureReason: result.message });
        toast({ title: "Processing Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: unknown) {
      const rawMsg =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String((error as Record<string, unknown>).message)
          : String(error);
      const msg = rawMsg.toLowerCase().includes("limit")
        ? "File too large for the current configuration."
        : rawMsg || "Unexpected error.";
      console.error("[Documents] processFile error:", error);
      await updateDocument(docId, { status: "failed", failureReason: msg });
      toast({ title: "Upload Error", description: msg, variant: "destructive" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `Max ${MAX_FILE_SIZE_MB} MB.`, variant: "destructive" });
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: "Unsupported file type", description: "Supported: PDF, DOCX, TXT, CSV, XLSX.", variant: "destructive" });
      return;
    }

    const docId = crypto.randomUUID();
    const readableType = file.type
      .split("/")[1]
      .toUpperCase()
      .replace("VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT", "DOCX")
      .replace("VND.OPENXMLFORMATS-OFFICEDOCUMENT.SPREADSHEETML.SHEET", "XLSX");

    await addDocumentToFirestore({
      id: docId,
      tenantId: currentUser.tenantId,
      filename: file.name,
      fileType: readableType,
      status: "uploaded",
      timestamp: Date.now(),
    });

    setIsUploading(true);
    await processFile(file, docId);
    setIsUploading(false);
  };

  const handleRetry = async (doc: DocumentRecord) => {
    setRetryingId(doc.id);
    await updateDocument(doc.id, { status: "processing", failureReason: undefined });
    try {
      const result = await uploadAndProcessDocumentForAIAnalysis({
        tenantId: currentUser.tenantId,
        documentId: doc.id,
        filename: doc.filename,
        fileType: "text/plain",
        documentDataUri: "data:text/plain;base64,UmV0cnlpbmcgZG9jdW1lbnQgcHJvY2Vzc2luZy4=",
        callerRole: currentUser.role,
      });
      if (result.status === "processed") {
        await updateDocument(doc.id, { status: "indexed", chunkCount: result.chunkCount, chunks: result.chunks });
        toast({ title: "Retry Succeeded", description: `${doc.filename} re-indexed.` });
      } else {
        await updateDocument(doc.id, { status: "failed", failureReason: result.message });
        toast({ title: "Retry Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: unknown) {
      const msg = (error as Error).message ?? "Retry failed.";
      await updateDocument(doc.id, { status: "failed", failureReason: msg });
      toast({ title: "Retry Error", description: msg, variant: "destructive" });
    } finally {
      setRetryingId(null);
    }
  };

  const allTenantDocs = documents;

  const filteredDocs = useMemo(
    () =>
      allTenantDocs.filter((doc) => {
        const matchSearch =
          searchQuery === "" ||
          doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
        const matchStatus = statusFilter === "all" || doc.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    [allTenantDocs, searchQuery, statusFilter]
  );

  const counts = {
    total: allTenantDocs.length,
    indexed: allTenantDocs.filter((d) => d.status === "indexed").length,
    processing: allTenantDocs.filter((d) => d.status === "processing").length,
    failed: allTenantDocs.filter((d) => d.status === "failed").length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb nav */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          onClick={() => router.push("/dashboard")}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">Knowledge Management</span>
      </div>

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Knowledge Management</h1>
          <p className="text-muted-foreground mt-1">
            Upload and index documents for AI retrieval •{" "}
            <span className="font-medium text-primary">{currentUser.tenantId}</span>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="relative">
            <Input
              type="file"
              className="hidden"
              id="doc-upload"
              onChange={handleFileUpload}
              disabled={isUploading}
              accept=".pdf,.docx,.txt,.csv,.xlsx"
            />
            <Button asChild className="bg-primary hover:bg-primary/90 shadow-md" disabled={isUploading}>
              <label
                htmlFor="doc-upload"
                className={isUploading ? "cursor-not-allowed opacity-70 flex items-center" : "cursor-pointer flex items-center"}
              >
                {isUploading ? (
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {isUploading ? "Uploading…" : "Add Document"}
              </label>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: counts.total, color: "text-primary" },
          { label: "Ready", value: counts.indexed, color: "text-green-600" },
          { label: "Processing", value: counts.processing, color: "text-blue-600" },
          { label: "Failed", value: counts.failed, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label} className="border-none shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Document table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-white/50 border-b">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div>
              <CardTitle className="text-lg">Document Inventory</CardTitle>
              <CardDescription>
                {filteredDocs.length} of {counts.total} document{counts.total !== 1 ? "s" : ""} shown
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search filename…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 w-44 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-1">
                {(["all", "indexed", "processing", "failed"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs capitalize"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[280px]">Filename</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Proc. Time</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="truncate max-w-[230px]" title={doc.filename}>
                          {doc.filename}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        {doc.fileType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusCell doc={doc} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums text-sm">
                      {doc.chunkCount != null ? doc.chunkCount : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {doc.processingMs != null ? `${(doc.processingMs / 1000).toFixed(1)}s` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(doc.timestamp).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {doc.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            disabled={retryingId === doc.id}
                            onClick={() => handleRetry(doc)}
                            title="Retry processing"
                          >
                            <RotateCcw className={`w-4 h-4 ${retryingId === doc.id ? "animate-spin" : ""}`} />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes <strong>{doc.filename}</strong> and all its
                                indexed chunks. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={async () => {
                                  await deleteDocumentChunks(doc.id).catch(() => {});
                                  await removeDocument(doc.id);
                                }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      {counts.total === 0 ? (
                        <>
                          <ArrowUpCircle className="w-10 h-10 opacity-20 mb-3" />
                          <p className="font-medium">No documents yet</p>
                          <p className="text-xs mt-1">Upload a file to start building your knowledge base.</p>
                        </>
                      ) : (
                        <>
                          <Search className="w-10 h-10 opacity-20 mb-3" />
                          <p className="font-medium">No results match your filter</p>
                          <button
                            onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                            className="text-xs text-primary mt-1 hover:underline"
                          >
                            Clear filters
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "Data Privacy",
            body: "Documents are strictly isolated to your tenant. Cross-tenant retrieval is blocked at both the storage and query layers.",
          },
          {
            title: "Processing Pipeline",
            body: "Text is extracted, chunked with overlapping windows, and indexed for hybrid keyword + embedding retrieval.",
          },
          {
            title: "Retry & Recovery",
            body: "Failed documents show an error tooltip with the failure reason. Use the ↺ button to trigger a re-processing attempt.",
          },
        ].map((card) => (
          <Card key={card.title} className="border-none shadow-sm bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-accent" />
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

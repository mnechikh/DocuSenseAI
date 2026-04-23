"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo, useEffect, useRef } from "react";
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
  ArrowUpCircle,
  Info,
  ArrowLeft,
  RotateCcw,
  Search,
  X,
  LayoutDashboard,
  Upload,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { uploadAndProcessDocumentForAIAnalysis } from "@/ai/flows/upload-and-process-document-for-ai-analysis";
import { deleteDocumentChunks } from "@/lib/auth-actions";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { getMyTenantQuota } from "@/lib/auth-actions";
import { PLAN_DEFAULTS } from "@/lib/quota-constants";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";

const ALLOWED_TYPES = [
  // Documents
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  // Spreadsheets
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  // Text / data
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/json",
  // Images (extracted via Gemini vision)
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE_MB = 30;

interface QueueItem {
  id: string;
  file: File;
  status: "queued" | "processing" | "done" | "failed" | "cancelled";
  failureReason?: string;
}

const fmtSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

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

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentRecord["status"] | "all">("all");
  const [docQuota, setDocQuota] = useState(PLAN_DEFAULTS.free.docQuota);
  const [dragActive, setDragActive] = useState(false);
  const [queueVisible, setQueueVisible] = useState(false);
  const [queueDisplay, setQueueDisplay] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser?.tenantId) return;
    getMyTenantQuota()
      .then((q) => setDocQuota(q.docQuota))
      .catch((err) => console.error("[Documents] tenant quota fetch:", err));
  }, [currentUser?.tenantId]);

  // Apply non-standard webkitdirectory attribute via ref
  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

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

  // Quota: count every doc that occupies a slot (mirrors server-side checkDocumentQuota)
  const quotaUsed = allTenantDocs.filter(
    (d) => d.status === "uploaded" || d.status === "processing" || d.status === "indexed"
  ).length;
  const quotaFull = quotaUsed >= docQuota;

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
  ): Promise<{ ok: boolean; reason?: string }> => {
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
        return { ok: true };
      } else {
        await updateDocument(docId, { status: "failed", failureReason: result.message });
        toast({ title: "Processing Failed", description: result.message, variant: "destructive" });
        return { ok: false, reason: result.message };
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
      return { ok: false, reason: msg };
    }
  };

  // ── Queue helpers ────────────────────────────────────────────────

  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    queueRef.current = queueRef.current.map((i) =>
      i.id === id ? { ...i, ...updates } : i
    );
    setQueueDisplay([...queueRef.current]);
  };

  const startProcessing = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = queueRef.current.find((i) => i.status === "queued");
      if (!next) break;
      updateQueueItem(next.id, { status: "processing" });
      const result = await processFile(next.file, next.id);
      updateQueueItem(next.id, {
        status: result.ok ? "done" : "failed",
        failureReason: result.ok ? undefined : result.reason,
      });
    }
    processingRef.current = false;
  };

  const extractZip = async (zipFile: File): Promise<File[]> => {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(zipFile);
    const EXT_MIME: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      txt: "text/plain",
      csv: "text/csv",
      md: "text/markdown",
      html: "text/html",
      htm: "text/html",
      json: "application/json",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    const files: File[] = [];
    const tasks: Promise<void>[] = [];
    zip.forEach((relativePath, entry) => {
      if (entry.dir || relativePath.startsWith("__MACOSX") || relativePath.startsWith(".")) return;
      const ext = relativePath.split(".").pop()?.toLowerCase() ?? "";
      if (!EXT_MIME[ext]) return;
      tasks.push(
        entry.async("blob").then((blob) => {
          const name = relativePath.split("/").pop() ?? relativePath;
          files.push(new File([blob], name, { type: EXT_MIME[ext] }));
        })
      );
    });
    await Promise.all(tasks);
    return files;
  };

  const getFilesFromEntry = async (entry: FileSystemEntry): Promise<File[]> => {
    if (entry.isFile) {
      return new Promise((resolve) =>
        (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]))
      );
    }
    if (entry.isDirectory) {
      return new Promise((resolve) => {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const all: File[] = [];
        const readBatch = () => {
          reader.readEntries(async (entries) => {
            if (entries.length === 0) return resolve(all);
            const nested = await Promise.all(entries.map(getFilesFromEntry));
            all.push(...nested.flat());
            readBatch();
          }, () => resolve(all));
        };
        readBatch();
      });
    }
    return [];
  };

  const enqueueFiles = async (rawFiles: File[]) => {
    const flatFiles: File[] = [];
    for (const f of rawFiles) {
      if (f.type === "application/zip" || f.name.toLowerCase().endsWith(".zip")) {
        try {
          const extracted = await extractZip(f);
          flatFiles.push(...extracted);
          if (extracted.length === 0)
            toast({ title: "Empty ZIP", description: `${f.name}: no supported files found inside`, variant: "destructive" });
        } catch {
          toast({ title: "ZIP Error", description: `Could not extract ${f.name}`, variant: "destructive" });
        }
      } else {
        flatFiles.push(f);
      }
    }

    const activeInQueue = queueRef.current.filter(
      (i) => i.status === "queued" || i.status === "processing"
    ).length;
    const remaining = Math.max(0, docQuota - quotaUsed - activeInQueue);
    const newItems: QueueItem[] = [];
    let skippedQuota = 0;

    for (const file of flatFiles) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name}: max ${MAX_FILE_SIZE_MB} MB`, variant: "destructive" });
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ title: "Unsupported type", description: `${file.name}: skipped`, variant: "destructive" });
        continue;
      }
      if (newItems.length >= remaining) { skippedQuota++; continue; }
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
      newItems.push({ id: docId, file, status: "queued" });
    }

    if (skippedQuota > 0)
      toast({ title: "Quota limit", description: `${skippedQuota} file${skippedQuota > 1 ? "s" : ""} skipped — quota reached`, variant: "destructive" });
    if (newItems.length === 0) return;

    queueRef.current = [...queueRef.current, ...newItems];
    setQueueDisplay([...queueRef.current]);
    setQueueVisible(true);
    startProcessing();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (quotaFull) return;
    const items = Array.from(e.dataTransfer.items);
    const promises: Promise<File[]>[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        promises.push(getFilesFromEntry(entry));
      } else if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) promises.push(Promise.resolve([f]));
      }
    }
    const all = (await Promise.all(promises)).flat();
    await enqueueFiles(all);
  };

  const handleBrowseFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    e.target.value = "";
    if (!fileList || fileList.length === 0) return;
    await enqueueFiles(Array.from(fileList));
  };

  const handleRetryQueueItem = async (item: QueueItem) => {
    updateQueueItem(item.id, { status: "queued", failureReason: undefined });
    if (!processingRef.current) startProcessing();
  };

  const cancelRemaining = () => {
    queueRef.current = queueRef.current.map((i) =>
      i.status === "queued" ? { ...i, status: "cancelled" as const } : i
    );
    setQueueDisplay([...queueRef.current]);
  };

  // Map human-readable fileType label back to MIME type for re-processing
  const LABEL_TO_MIME: Record<string, string> = {
    PDF: "application/pdf",
    DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    XLS: "application/vnd.ms-excel",
    TXT: "text/plain",
    CSV: "text/csv",
    MD: "text/markdown",
    HTML: "text/html",
    JSON: "application/json",
    JPEG: "image/jpeg",
    JPG: "image/jpeg",
    PNG: "image/png",
    WEBP: "image/webp",
    GIF: "image/gif",
  };

  const handleRetry = async (doc: DocumentRecord) => {
    setRetryingId(doc.id);
    await updateDocument(doc.id, { status: "processing" });
    try {
      // Fetch the original file from Firebase Storage to re-process it properly.
      // Falls back to a text/plain sentinel only if the file is no longer in Storage.
      let documentDataUri: string;
      let mimeType: string = LABEL_TO_MIME[doc.fileType.toUpperCase()] ?? "text/plain";

      try {
        const folderRef = ref(storage, `tenants/${doc.tenantId}/docs/${doc.id}`);
        const listResult = await listAll(folderRef);
        if (listResult.items.length > 0) {
          const fileRef = listResult.items[0];
          const downloadUrl = await getDownloadURL(fileRef);
          // Fetch as blob and convert to base64 data URI
          const blob = await fetch(downloadUrl).then((r) => r.blob());
          documentDataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("FileReader failed"));
            reader.readAsDataURL(blob);
          });
          // Use blob's actual MIME type if available
          if (blob.type) mimeType = blob.type;
        } else {
          throw new Error("No file found in Storage folder");
        }
      } catch (storageErr: unknown) {
        console.warn("[Retry] Storage fetch failed, using sentinel:", (storageErr as Error).message);
        documentDataUri = "data:text/plain;base64,UmV0cnlpbmcgZG9jdW1lbnQgcHJvY2Vzc2luZy4=";
        mimeType = "text/plain";
      }

      const result = await uploadAndProcessDocumentForAIAnalysis({
        tenantId: currentUser.tenantId,
        documentId: doc.id,
        filename: doc.filename,
        fileType: mimeType,
        documentDataUri,
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
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[
              { label: "PDF" },
              { label: "DOCX" },
              { label: "XLSX" },
              { label: "XLS" },
              { label: "TXT" },
              { label: "CSV" },
              { label: "MD" },
              { label: "HTML" },
              { label: "JSON" },
              { label: "JPG" },
              { label: "PNG" },
              { label: "WebP" },
              { label: "GIF" },
            ].map(({ label }) => (
              <span key={label} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                {label}
              </span>
            ))}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-muted-foreground">
              · max {MAX_FILE_SIZE_MB} MB
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-medium tabular-nums ${quotaFull ? "text-destructive" : "text-muted-foreground"}`}>
            {quotaUsed}/{docQuota} docs
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* Drag-and-drop upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!quotaFull) setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed transition-all duration-150 p-8 text-center ${
          quotaFull
            ? "opacity-50 cursor-not-allowed border-border"
            : dragActive
            ? "border-primary bg-primary/5 scale-[1.005]"
            : "border-border hover:border-primary/50 hover:bg-accent/5 cursor-pointer"
        }`}
      >
        <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium text-sm mb-1">
          {dragActive ? "Drop to upload" : "Drop files, folders, or a .zip here"}
        </p>
        <p className="text-xs text-muted-foreground mb-5">or browse from your computer</p>
        <div className="flex items-center justify-center gap-3">
          {/* Browse files */}
          <input
            type="file"
            id="browse-files"
            className="hidden"
            multiple
            disabled={quotaFull}
            accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.md,.html,.htm,.json,.jpg,.jpeg,.png,.webp,.gif,.zip"
            onChange={handleBrowseFiles}
          />
          <Button size="sm" variant="outline" disabled={quotaFull} asChild>
            <label htmlFor="browse-files" className={quotaFull ? "cursor-not-allowed" : "cursor-pointer"}>
              <FileText className="mr-1.5 w-3.5 h-3.5" />
              Browse Files
            </label>
          </Button>
          {/* Browse folder */}
          <input
            ref={folderInputRef}
            type="file"
            id="browse-folder"
            className="hidden"
            multiple
            disabled={quotaFull}
            onChange={handleBrowseFiles}
          />
          <Button size="sm" variant="outline" disabled={quotaFull} asChild>
            <label htmlFor="browse-folder" className={quotaFull ? "cursor-not-allowed" : "cursor-pointer"}>
              <FolderOpen className="mr-1.5 w-3.5 h-3.5" />
              Browse Folder
            </label>
          </Button>
        </div>
        {quotaFull && (
          <p className="text-xs text-destructive mt-3 font-medium">
            Document quota reached ({quotaUsed}/{docQuota}). Delete documents to free slots.
          </p>
        )}
      </div>

      {/* Upload queue panel */}
      {queueVisible && queueDisplay.length > 0 && (
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-accent/5 border-b pb-3 pt-4 px-5">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-sm">Upload Queue</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {queueDisplay.filter((i) => i.status === "done").length} of{" "}
                    {queueDisplay.filter((i) => i.status !== "cancelled").length} complete
                  </span>
                  {queueDisplay.some((i) => i.status === "processing") && (
                    <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  )}
                </div>
                <Progress
                  value={
                    (queueDisplay.filter((i) => i.status === "done" || i.status === "failed").length /
                      Math.max(1, queueDisplay.filter((i) => i.status !== "cancelled").length)) *
                    100
                  }
                  className="h-1.5"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                {queueDisplay.some((i) => i.status === "queued") && (
                  <Button size="sm" variant="ghost" onClick={cancelRemaining} className="h-7 text-xs text-muted-foreground">
                    Cancel remaining
                  </Button>
                )}
                {queueDisplay.every((i) => i.status !== "queued" && i.status !== "processing") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setQueueVisible(false);
                      queueRef.current = [];
                      setQueueDisplay([]);
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-52 overflow-y-auto divide-y">
              {queueDisplay.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="shrink-0 w-5 flex items-center">
                    {item.status === "queued" && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                    {item.status === "processing" && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                    {item.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    {item.status === "failed" && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                    {item.status === "cancelled" && <X className="w-3.5 h-3.5 text-muted-foreground opacity-40" />}
                  </div>
                  <span className="flex-1 truncate text-xs font-medium" title={item.file.name}>
                    {item.file.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {fmtSize(item.file.size)}
                  </span>
                  {item.status === "failed" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.failureReason && (
                        <span className="text-[10px] text-destructive max-w-[120px] truncate" title={item.failureReason}>
                          {item.failureReason}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-700"
                        onClick={() => handleRetryQueueItem(item)}
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                  {item.status === "cancelled" && (
                    <Badge variant="secondary" className="text-[10px] opacity-50">Cancelled</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

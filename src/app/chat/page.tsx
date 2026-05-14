"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useStore, ChatMessage } from "@/lib/store";
import { useChats } from "@/hooks/useChats";
import { useDocuments } from "@/hooks/useDocuments";
import { auth } from "@/lib/firebase";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Send,
  Bot,
  User,
  Loader2,
  ArrowLeft,
  FileText,
  ShieldCheck,
  MoreVertical,
  Pencil,
  Trash2,
  Plus,
  AlertCircle,
  Zap,
  CheckCircle2,
  XCircle,
  CreditCard,
  Mic,
  MicOff,
} from "lucide-react";
import { getAIPoweredAnswersFromDocuments } from "@/ai/flows/get-ai-powered-answers-from-documents";
import { interpretActionResult } from "@/ai/flows/interpret-action-result";
import { executeIntegration } from "@/lib/integration-actions";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render common Markdown patterns without any external dependency. */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={idx}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={idx} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      if (part.startsWith("*") && part.endsWith("*")) return <em key={idx}>{part.slice(1, -1)}</em>;
      return part;
    });
  };

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = level === 1 ? "text-base font-bold mt-3 mb-1" : level === 2 ? "text-sm font-bold mt-2 mb-1" : "text-sm font-semibold mt-1.5 mb-0.5";
      elements.push(<p key={i} className={cls}>{renderInline(hMatch[2])}</p>);
      i++; continue;
    }

    // Bullet list — collect consecutive items
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s+/, "")); i++;
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc pl-4 my-1 space-y-0.5">{items.map((item, j) => <li key={j} className="text-sm">{renderInline(item)}</li>)}</ul>);
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, "")); i++;
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal pl-4 my-1 space-y-0.5">{items.map((item, j) => <li key={j} className="text-sm">{renderInline(item)}</li>)}</ol>);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { elements.push(<hr key={i} className="my-2 border-border" />); i++; continue; }

    // Empty line
    if (!line.trim()) { elements.push(<div key={i} className="h-1.5" />); i++; continue; }

    // Normal paragraph
    elements.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// ─── Smart result renderer helpers ──────────────────────────────────────────

/** camelCase / snake_case → "Title Case" */
function toTitleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\burl\b/gi, 'URL')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a cell value for display. */
function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // ISO datetime → locale date string
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    try { return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { /* fall through */ }
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return s.length > 60 ? s.slice(0, 60) + '…' : s;
}

/** Score a field key/values to decide if it's worth showing. Lower = better. */
function fieldScore(key: string, values: unknown[]): number {
  let score = 0;
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  // Penalise high-null fields
  if (nonNull.length / values.length < 0.3) score += 50;
  // Penalise likely UUID / hash columns
  if (/^(id|_id|uuid|hash|token|key|secret|password|code|sku|ref)$/i.test(key)) score += 30;
  if (nonNull.slice(0, 5).every((v) => /^[a-f0-9]{8,}$/i.test(String(v)))) score += 20;
  // Penalise deeply nested / object values
  if (nonNull.slice(0, 3).some((v) => typeof v === 'object' && v !== null)) score += 40;
  // Reward date-like keys
  if (/(date|at|time|created|updated|deadline|posted)/i.test(key)) score -= 10;
  // Reward name / title / description keys
  if (/(name|title|desc|label|status|stage|agency|type)/i.test(key)) score -= 10;
  return score;
}

const ROW_LIMIT = 25;
const COL_LIMIT = 8;

function DataTable({ items, extraMeta }: { items: Record<string, unknown>[]; extraMeta?: [string, unknown][] }) {
  const [showAll, setShowAll] = React.useState(false);
  const [showAllCols, setShowAllCols] = React.useState(false);

  const allKeys = Object.keys(items[0] ?? {});
  const scored = allKeys
    .map((k) => ({ k, score: fieldScore(k, items.map((r) => r[k])) }))
    .sort((a, b) => a.score - b.score);
  const visibleKeys = showAllCols ? allKeys : scored.slice(0, COL_LIMIT).map((s) => s.k);
  const hiddenCount = allKeys.length - COL_LIMIT;

  const displayRows = showAll ? items : items.slice(0, ROW_LIMIT);

  return (
    <div className="space-y-2">
      {/* Meta bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground">
          <strong className="text-foreground text-sm">{items.length}</strong> record{items.length !== 1 ? 's' : ''}
        </span>
        {extraMeta?.map(([k, v]) => (
          <span key={k} className="text-xs text-muted-foreground">
            <span className="font-semibold">{toTitleCase(k)}:</span> {String(v)}
          </span>
        ))}
        {!showAllCols && hiddenCount > 0 && (
          <button
            className="text-xs text-primary font-medium underline underline-offset-2"
            onClick={() => setShowAllCols(true)}
          >
            +{hiddenCount} more columns
          </button>
        )}
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto overflow-y-auto max-h-80 rounded-lg border border-border text-xs touch-pan-x shadow-sm">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-primary/10 border-b-2 border-primary/20">
              {visibleKeys.map((k) => (
                <th key={k} className="px-3 py-2 text-left text-[11px] font-bold text-primary/80 uppercase tracking-wide whitespace-nowrap">
                  {toTitleCase(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "transition-colors hover:bg-primary/5",
                  i % 2 === 0 ? "bg-background" : "bg-muted/30"
                )}
              >
                {visibleKeys.map((k) => {
                  const raw = row[k];
                  const display = formatCell(raw);
                  const full = raw === null || raw === undefined ? '' : String(raw);
                  return (
                    <td key={k} className="px-3 py-2 border-b border-border/30 align-top">
                      <div className="max-w-[160px] truncate leading-snug" title={full || undefined}>
                        {!display ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          display
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showAll && items.length > ROW_LIMIT && (
        <button
          className="text-xs text-primary font-medium underline underline-offset-2"
          onClick={() => setShowAll(true)}
        >
          Show all {items.length} rows
        </button>
      )}
    </div>
  );
}

/** Try to parse a JSON result and render it as a structured visual. */
function SmartResultRenderer({ raw }: { raw: string }) {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { /* not JSON */ }

  // Array of objects → table
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null) {
    return <DataTable items={parsed as Record<string, unknown>[]} />;
  }

  // Object with a top-level array property (e.g. { bids: [...], total: 3 })
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const arrayKey = Object.keys(obj).find(
      (k) => Array.isArray(obj[k]) && (obj[k] as unknown[]).length > 0 && typeof (obj[k] as unknown[])[0] === "object"
    );
    if (arrayKey) {
      const items = obj[arrayKey] as Record<string, unknown>[];
      const meta = Object.entries(obj).filter(([k]) => k !== arrayKey) as [string, unknown][];
      return <DataTable items={items} extraMeta={meta} />;
    }
    // Plain object → key/value grid
    return (
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs rounded-lg border border-border p-3 bg-muted/20">
        {Object.entries(obj).map(([k, v]) => (
          <React.Fragment key={k}>
            <span className="font-semibold text-muted-foreground whitespace-nowrap text-[11px] uppercase tracking-wide">{toTitleCase(k)}</span>
            <span className="break-all text-foreground" title={String(v ?? "")}>
              {v === null || v === undefined ? <span className="opacity-30">—</span> : formatCell(v)}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  }

  // Fallback — raw text
  return <pre className="whitespace-pre-wrap break-all text-xs max-h-48 overflow-auto font-mono bg-muted/30 p-3 rounded-lg border border-border">{raw}</pre>;
}

// useSearchParams requires Suspense in Next.js 14+
export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("id");
  const { currentUser } = useStore();

  // Ensure the Firebase Auth token carries the tenantId custom claim before
  // any Firestore operation.  DashboardLayout does this for /dashboard/** routes,
  // but /chat is a separate layout tree and needs its own guard.
  const [claimsReady, setClaimsReady] = useState(false);
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setClaimsReady(true); return; }
    user.getIdTokenResult().then(async (result) => {
      if (!result.claims.tenantId) await user.getIdToken(true);
      setClaimsReady(true);
    });
  }, []);

  const {
    chats,
    createChat: createChatInFirestore,
    addMessage,
    patchMessage,
    renameChat: renameChatInFirestore,
    removeChat,
  } = useChats(claimsReady ? currentUser?.tenantId : undefined, claimsReady ? currentUser?.userId : undefined);
  const { documents } = useDocuments(claimsReady ? currentUser?.tenantId : undefined);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [runningActionIdx, setRunningActionIdx] = useState<number | null>(null);
  const [interpretingActionIdx, setInterpretingActionIdx] = useState<number | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  // Sentinel element at the bottom of the message list — scrolling it into
  // view is more reliable than manipulating scrollTop on the ScrollArea wrapper.
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const currentChat = chats.find((c) => c.id === chatId);
  const tenantDocs = documents.filter(
    (d) => d.tenantId === currentUser?.tenantId && d.status === "indexed"
  );
  const hasIndexedDocs = tenantDocs.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages, isLoading]);

  useEffect(() => {
    setVoiceSupported(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUser || isLoading) return;

    let activeChatId = chatId;
    if (!activeChatId) {
      activeChatId = await createChatInFirestore(
        input.substring(0, 40) + (input.length > 40 ? "…" : ""),
        currentUser.tenantId,
        currentUser.userId,
      );
      router.push(`/chat?id=${activeChatId}`);
    }

    const userMessage: ChatMessage = { role: "user", content: input };
    await addMessage(activeChatId, userMessage);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const chat = chats.find((c) => c.id === activeChatId);
      // Build history including execution results as synthetic turns so the AI can
      // extract IDs (bidId, runId, etc.) from previous actions and chain them automatically.
      const history: { role: "user" | "model"; content: string }[] = [];
      for (const m of chat?.messages ?? []) {
        history.push({ role: m.role, content: m.content });
        if (m.executedAction?.success && m.executedAction.result) {
          history.push({
            role: "user",
            content: `[Action result from "${m.executedAction.integrationName}"]\n${m.executedAction.result}`,
          });
        }
      }

      const response = await getAIPoweredAnswersFromDocuments({
        tenantId: currentUser.tenantId,
        query: currentInput,
        chatHistory: history,
        topK: 15,
        // Re-hydrate the server's in-memory index from Firestore-persisted chunks.
        rehydrateChunks: documents
          .filter((d) => d.status === "indexed" && d.chunks)
          .flatMap((d) =>
            (d.chunks ?? []).map((content) => ({
              documentId: d.id,
              filename: d.filename,
              content,
            }))
          ),
      });

      await addMessage(activeChatId, {
        role: "model",
        content: response.answer,
        citations: response.citations,
        proposedAction: response.proposedAction,
      });
      // Start typewriter animation — clear loading spinner first
      setIsLoading(false);
      if (response.answer && response.answer !== "__QUOTA_EXCEEDED__") {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setStreamingText("");
        let charIdx = 0;
        const fullText = response.answer;
        const tick = () => {
          charIdx = Math.min(charIdx + 4, fullText.length);
          setStreamingText(fullText.slice(0, charIdx));
          if (charIdx < fullText.length) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            setStreamingText(null);
            rafRef.current = null;
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch (error: unknown) {
      const msg = (error as Error).message ?? "";
      const isQuotaError = msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("quota");
      console.error("[Chat] Message error:", msg);
      await addMessage(activeChatId, {
        role: "model",
        content: isQuotaError
          ? "__QUOTA_EXCEEDED__"
          : "I encountered an error while processing your request. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAction = async (msgIdx: number) => {
    if (!currentChat || !chatId || runningActionIdx !== null) return;
    const message = currentChat.messages[msgIdx];
    if (!message?.proposedAction) return;
    setRunningActionIdx(msgIdx);
    let execResult: Awaited<ReturnType<typeof executeIntegration>> | null = null;
    try {
      execResult = await executeIntegration(
        message.proposedAction.integrationId,
        message.proposedAction.parameters
      );
      await patchMessage(chatId, msgIdx, {
        executedAction: {
          integrationName: message.proposedAction.integrationName,
          success: execResult.success,
          statusCode: execResult.statusCode,
          result: execResult.result,
          executedAt: execResult.executedAt,
        },
      });
    } catch (e: unknown) {
      await patchMessage(chatId, msgIdx, {
        executedAction: {
          integrationName: message.proposedAction.integrationName,
          success: false,
          statusCode: 0,
          result: (e as Error).message,
          executedAt: Date.now(),
        },
      });
    } finally {
      setRunningActionIdx(null);
    }

    // Auto-interpretation — only on success, non-blocking
    if (execResult?.success && execResult.result) {
      setInterpretingActionIdx(msgIdx);
      try {
        const interpretation = await interpretActionResult({
          actionName: message.proposedAction.integrationName,
          parameters: message.proposedAction.parameters as Record<string, unknown>,
          statusCode: execResult.statusCode,
          result: execResult.result,
        });
        if (interpretation) {
          await addMessage(chatId, { role: "model", content: interpretation });
        }
      } catch {
        // silent
      } finally {
        setInterpretingActionIdx(null);
      }
    }
  };

  const handleDismissAction = async (msgIdx: number) => {
    if (!currentChat || !chatId) return;
    const message = currentChat.messages[msgIdx];
    if (!message?.proposedAction) return;
    await patchMessage(chatId, msgIdx, {
      executedAction: {
        integrationName: message.proposedAction.integrationName,
        success: false,
        dismissed: true,
        executedAt: Date.now(),
      },
    });
  };

  const handleRename = async () => {
    if (currentChat && renameValue.trim()) {
      await renameChatInFirestore(currentChat.id, renameValue.trim());
    }
    setRenameDialogOpen(false);
  };

  const handleDelete = async () => {
    if (currentChat) {
      await removeChat(currentChat.id);
      router.push("/chat");
    }
    setDeleteDialogOpen(false);
  };

  const openRenameDialog = () => {
    setRenameValue(currentChat?.title ?? "");
    setRenameDialogOpen(true);
  };

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as any;
    if (!SR) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new SR() as any;
    r.continuous = false; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = Array.from(e.results as any[]).map((res: any) => res[0].transcript as string).join("");
      setInput(t);
    };
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.start();
    recognitionRef.current = r;
    setIsListening(true);
  };

  const lastModelIdx = (currentChat?.messages ?? []).reduce(
    (last, m, i) => (m.role === "model" ? i : last),
    -1
  );

  return (
    <>
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-5xl mx-auto bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-primary text-primary-foreground flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard")}
              className="text-white hover:bg-white/10 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-none truncate">
                {currentChat?.title ?? "New Consultation"}
              </h1>
              <p className="text-[10px] opacity-70 tracking-widest font-medium uppercase mt-1">
                Lumxia · Knowledge Chat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-[10px] bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
              <ShieldCheck className="w-3 h-3 text-accent" />
              <span>{currentUser?.tenantId}</span>
            </div>

            {currentChat && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 h-8 w-8"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={openRenameDialog}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename chat
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 h-8 w-8"
              title="New chat"
              onClick={() => router.push("/chat")}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* No-docs warning banner */}
        {!hasIndexedDocs && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-xs shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>
              No documents indexed yet.{" "}
              {currentUser?.role === "Admin" ? (
                <button
                  className="underline font-medium hover:text-yellow-900"
                  onClick={() => router.push("/documents")}
                >
                  Upload documents
                </button>
              ) : (
                "Ask your administrator to upload documents."
              )}{" "}
              before asking questions.
            </span>
          </div>
        )}

        {/* Messages — plain div so nested tables can scroll horizontally (ScrollArea root has overflow:hidden which clips them) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-background/40">
          <div className="space-y-6 pb-4">
            {!currentChat?.messages.length && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-xl font-bold text-foreground">
                    How can I help you today?
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Ask questions about your uploaded documents. Answers are
                    strictly grounded in your knowledge base.
                  </p>
                  {hasIndexedDocs && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-6">
                      {[
                        "What documents are uploaded?",
                        "Give me a summary of my files",
                        "What are the key policies?",
                        "Explain the latest report",
                      ].map((s) => (
                        <Button
                          key={s}
                          variant="outline"
                          className="text-xs justify-start h-auto py-2"
                          onClick={() => setInput(s)}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentChat?.messages.map((message, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                <div
                  className={cn(
                    "flex flex-col space-y-2",
                    message.role === "user" ? "items-end max-w-[85%]" : "items-start",
                    // Widen to full available width when there's a table result to scroll
                    message.role === "model" && message.executedAction
                      ? "w-[calc(100%-2.25rem)] sm:w-[calc(100%-2.75rem)]"
                      : message.role === "model" ? "max-w-[92%] sm:max-w-[85%]" : ""
                  )}
                >
                  {message.role === "model" && message.content === "__QUOTA_EXCEEDED__" ? (
                    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm max-w-sm">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-semibold">Monthly query limit reached</span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        You&apos;ve used all your AI queries for this month. Upgrade your plan to keep asking questions — no waiting for the monthly reset.
                      </p>
                      <Button asChild size="sm" className="w-full">
                        <Link href="/dashboard/billing">
                          <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                          View upgrade options
                        </Link>
                      </Button>
                    </div>
                  ) : (
                  <div
                    className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none whitespace-pre-wrap"
                        : "bg-secondary text-secondary-foreground border border-border rounded-tl-none"
                    )}
                  >
                    {message.role === "user" ? (
                      message.content
                    ) : (
                      <MarkdownContent content={streamingText !== null && idx === lastModelIdx ? streamingText : message.content} />
                    )}
                  </div>
                  )}

                  {message.citations && message.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground self-center">
                        Sources:
                      </span>
                      {message.citations.map((cite, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border rounded-md text-[10px] font-medium text-muted-foreground shadow-sm hover:border-primary/50 transition-colors"
                          title={cite.pageSection}
                        >
                          <FileText className="w-3 h-3 text-accent shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {cite.documentName}
                          </span>
                          {cite.pageSection && (
                            <span className="opacity-50">• {cite.pageSection}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action proposal card */}
                  {message.role === "model" && message.proposedAction && !message.executedAction && (
                    <div className="mt-2 border border-primary/30 bg-primary/5 rounded-xl p-3 shadow-sm w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-semibold text-primary">
                          Suggested Action: {message.proposedAction.integrationName}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{message.proposedAction.reason}</p>
                      {Object.entries(message.proposedAction.parameters).length > 0 && (
                        <div className="bg-muted/60 rounded-lg p-2 mb-3 space-y-1">
                          {Object.entries(message.proposedAction.parameters).map(([k, v]) => (
                            <div key={k} className="flex items-start gap-1.5 text-xs">
                              <code className="font-mono text-primary/70 shrink-0">{k}:</code>
                              <span className="text-muted-foreground break-all">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs px-3"
                          onClick={() => handleRunAction(idx)}
                          disabled={runningActionIdx !== null}
                        >
                          {runningActionIdx === idx ? (
                            <><Loader2 className="w-3 h-3 animate-spin mr-1" />Running…</>
                          ) : (
                            <><Zap className="w-3 h-3 mr-1" />Run</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-3"
                          onClick={() => handleDismissAction(idx)}
                          disabled={runningActionIdx !== null}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Executed action result */}
                  {message.role === "model" && message.executedAction && (
                    <div className={cn(
                      "mt-2 rounded-xl p-3 sm:p-4 w-full border",
                      message.executedAction.dismissed
                        ? "border-border bg-muted/30 text-muted-foreground"
                        : message.executedAction.success
                          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
                          : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/40"
                    )}>
                      <div className={cn(
                        "flex items-center gap-2 font-semibold text-sm mb-3",
                        message.executedAction.dismissed
                          ? "text-muted-foreground"
                          : message.executedAction.success
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                      )}>
                        {message.executedAction.dismissed ? (
                          <><XCircle className="w-4 h-4 shrink-0" /><span>Action dismissed</span></>
                        ) : message.executedAction.success ? (
                          <><CheckCircle2 className="w-4 h-4 shrink-0" /><span>{message.executedAction.integrationName} — Success <span className="font-normal opacity-70">({message.executedAction.statusCode})</span></span></>
                        ) : (
                          <><XCircle className="w-4 h-4 shrink-0" /><span>{message.executedAction.integrationName} — Failed <span className="font-normal opacity-70">({message.executedAction.statusCode})</span></span></>
                        )}
                      </div>
                      {!message.executedAction.dismissed && message.executedAction.result && (
                        <SmartResultRenderer raw={message.executedAction.result} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-secondary border border-border rounded-tl-none">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Retrieving from documents…</span>
                  </div>
                </div>
              </div>
            )}

            {interpretingActionIdx !== null && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-secondary border border-border rounded-tl-none">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Analyzing results…</span>
                  </div>
                </div>
              </div>
            )}
            {/* Sentinel — keep at end so scroll always lands here */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border bg-card shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? "Listening…"
                  : hasIndexedDocs
                  ? "Ask a question about your documents…"
                  : "Upload documents first to start asking questions…"
              }
              className="flex-1"
              disabled={isLoading}
              maxLength={2000}
            />
            {voiceSupported && (
              <Button
                type="button"
                size="icon"
                variant={isListening ? "default" : "outline"}
                className={cn("shrink-0 transition-colors", isListening && "bg-red-500 hover:bg-red-600 border-red-500")}
                onClick={toggleVoice}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="bg-primary hover:bg-primary/90 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-[10px] text-center text-muted-foreground mt-2 uppercase tracking-tighter">
            Strictly grounded in your documents • No external information used
          </p>
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">Chat title</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              maxLength={80}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              All messages in &quot;{currentChat?.title}&quot; will be permanently
              deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

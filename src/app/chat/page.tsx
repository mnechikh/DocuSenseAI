"use client";

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, Suspense } from "react";
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
} from "lucide-react";
import { getAIPoweredAnswersFromDocuments } from "@/ai/flows/get-ai-powered-answers-from-documents";
import { executeIntegration } from "@/lib/integration-actions";
import { cn } from "@/lib/utils";

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
  const [runningActionIdx, setRunningActionIdx] = useState<number | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  // Sentinel element at the bottom of the message list — scrolling it into
  // view is more reliable than manipulating scrollTop on the ScrollArea wrapper.
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentChat = chats.find((c) => c.id === chatId);
  const tenantDocs = documents.filter(
    (d) => d.tenantId === currentUser?.tenantId && d.status === "indexed"
  );
  const hasIndexedDocs = tenantDocs.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages, isLoading]);

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
      const history =
        chat?.messages.map((m) => ({ role: m.role, content: m.content })) ?? [];

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
    try {
      const result = await executeIntegration(
        message.proposedAction.integrationId,
        message.proposedAction.parameters
      );
      await patchMessage(chatId, msgIdx, {
        executedAction: {
          integrationName: message.proposedAction.integrationName,
          success: result.success,
          statusCode: result.statusCode,
          result: result.result,
          executedAt: result.executedAt,
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

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
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

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 md:p-6 bg-background/40">
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
                    "flex flex-col space-y-2 max-w-[85%]",
                    message.role === "user" ? "items-end" : "items-start"
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
                      "p-4 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-secondary text-secondary-foreground border border-border rounded-tl-none"
                    )}
                  >
                    {message.content}
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
                      "mt-2 rounded-xl p-3 w-full border text-xs",
                      message.executedAction.dismissed
                        ? "border-border bg-muted/40 text-muted-foreground"
                        : message.executedAction.success
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-red-200 bg-red-50 text-red-800"
                    )}>
                      <div className="flex items-center gap-1.5 font-medium mb-1">
                        {message.executedAction.dismissed ? (
                          <><XCircle className="w-3.5 h-3.5" />Action dismissed</>
                        ) : message.executedAction.success ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" />{message.executedAction.integrationName} — Success ({message.executedAction.statusCode})</>
                        ) : (
                          <><XCircle className="w-3.5 h-3.5" />{message.executedAction.integrationName} — Failed ({message.executedAction.statusCode})</>
                        )}
                      </div>
                      {!message.executedAction.dismissed && message.executedAction.result && (
                        <pre className="mt-1 whitespace-pre-wrap break-all opacity-80 text-[10px] max-h-24 overflow-auto">
                          {message.executedAction.result}
                        </pre>
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
            {/* Sentinel — keep at end so scroll always lands here */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="p-4 border-t border-border bg-card shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                hasIndexedDocs
                  ? "Ask a question about your documents…"
                  : "Upload documents first to start asking questions…"
              }
              className="flex-1"
              disabled={isLoading}
              maxLength={2000}
            />
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

"use client";

import { useState, useRef, useEffect } from "react";
import { useStore, ChatMessage } from "@/lib/store";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  ArrowLeft, 
  Link as LinkIcon, 
  Quote,
  FileText,
  AlertCircle
} from "lucide-react";
import { getAIPoweredAnswersFromDocuments } from "@/ai/flows/get-ai-powered-answers-from-documents";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("id");
  const { currentUser, chats, addMessageToChat, createChat } = useStore();
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const currentChat = chats.find(c => c.id === chatId);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentChat?.messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUser || isLoading) return;

    let activeChatId = chatId;
    
    // Create new chat if none exists or active
    if (!activeChatId) {
      activeChatId = createChat(input.substring(0, 30) + (input.length > 30 ? "..." : ""));
      router.push(`/chat?id=${activeChatId}`);
    }

    const userMessage: ChatMessage = { role: "user", content: input };
    addMessageToChat(activeChatId, userMessage);
    setInput("");
    setIsLoading(true);

    try {
      // Collect history
      const history = currentChat?.messages.map(m => ({ 
        role: m.role, 
        content: m.content 
      })) || [];
      
      const response = await getAIPoweredAnswersFromDocuments({
        tenantId: currentUser.tenantId,
        query: input,
        chatHistory: history
      });

      const assistantMessage: ChatMessage = {
        role: "model",
        content: response.answer,
        citations: response.citations
      };
      
      addMessageToChat(activeChatId, assistantMessage);
    } catch (error) {
      console.error("Chat error:", error);
      addMessageToChat(activeChatId, {
        role: "model",
        content: "I encountered an error while processing your request. Please ensure you have documents uploaded for your tenant or try a different query."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-primary text-primary-foreground flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-bold text-lg leading-none">
              {currentChat?.title || "New Consultation"}
            </h1>
            <p className="text-[10px] opacity-70 tracking-widest font-medium uppercase mt-1">DocuSense AI Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
          <ShieldCheck className="w-3 h-3 text-accent" />
          <span>Tenant Isolated • {currentUser?.tenantId}</span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 md:p-6" ref={scrollRef}>
        <div className="space-y-6 pb-4">
          {!currentChat?.messages.length && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
                <Bot className="w-8 h-8 text-accent" />
              </div>
              <div className="max-w-md">
                <h3 className="text-xl font-bold text-primary">How can I help you today?</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Ask questions about your business documents. I will retrieve relevant sections and provide grounded answers with citations.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-6">
                  {["What's our return policy?", "Summarize the annual report", "Check HR policies", "Explain Q4 performance"].map(suggestion => (
                    <Button 
                      key={suggestion} 
                      variant="outline" 
                      className="text-xs justify-start h-auto py-2"
                      onClick={() => setInput(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
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
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
              )}>
                {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              
              <div className={cn(
                "flex flex-col space-y-2 max-w-[85%]",
                message.role === "user" ? "items-end" : "items-start"
              )}>
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed shadow-sm border",
                  message.role === "user" 
                    ? "bg-primary/5 border-primary/10 rounded-tr-none" 
                    : "bg-muted/50 border-muted rounded-tl-none"
                )}>
                  {message.content}
                </div>
                
                {message.citations && message.citations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {message.citations.map((cite, cIdx) => (
                      <div 
                        key={cIdx} 
                        className="flex items-center gap-1.5 px-2 py-1 bg-white border border-border/50 rounded-md text-[10px] font-medium text-muted-foreground shadow-sm hover:border-accent transition-colors cursor-pointer"
                      >
                        <FileText className="w-3 h-3 text-accent" />
                        <span>{cite.documentName}</span>
                        {cite.pageSection && <span className="opacity-50">• {cite.pageSection}</span>}
                      </div>
                    ))}
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
              <div className="p-4 rounded-2xl bg-muted/50 border border-muted rounded-tl-none">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question about tenant documents..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="bg-primary hover:bg-primary/90">
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-[10px] text-center text-muted-foreground mt-3 uppercase tracking-tighter">
          Strictly grounded in your documents • No external information leaks
        </p>
      </div>
    </div>
  );
}

function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

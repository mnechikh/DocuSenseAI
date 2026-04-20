"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useChats } from "@/hooks/useChats";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Users,
  LogOut,
  Database,
  History,
  Plus,
  Trash2,
  KeyRound,
  BookOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { revokeSessionCookie } from "@/lib/auth-actions";

export function DashboardSidebar({ claimsReady }: { claimsReady: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useStore();
  // Only register the Firestore listener once the Auth token carries custom claims.
  const { chats: tenantChats, removeChat } = useChats(
    claimsReady ? currentUser?.tenantId : undefined,
    claimsReady ? currentUser?.userId : undefined,
  );

  const handleLogout = async () => {
    await revokeSessionCookie();
    await signOut(auth).catch(() => {});
    logout();
    router.push("/login");
  };

  const isAdmin = currentUser?.role === "Admin";
  const { setOpenMobile } = useSidebar();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "AI Chat", href: "/chat", icon: MessageSquare },
    { label: "Documents", href: "/documents", icon: FileText, hidden: !isAdmin },
    { label: "User Management", href: "/users", icon: Users, hidden: !isAdmin },
    { label: "API Keys", href: "/dashboard/api-keys", icon: KeyRound, hidden: !isAdmin },
    { label: "API Docs", href: "/dashboard/api-docs", icon: BookOpen },
  ];

  const isActive = (href: string) => {
    if (href === "/chat") return pathname.startsWith("/chat");
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <Sidebar className="border-r border-sidebar-border shadow-xl">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%)', boxShadow: '0 4px 14px rgba(124,140,255,0.35)' }}
          >
            {/* Soft glowing dot — Lumxia mark */}
            <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 6px 3px rgba(255,255,255,0.5)' }} />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-none tracking-tight">Lumxia</h2>
            <p className="text-[10px] opacity-50 tracking-widest font-semibold uppercase">AI Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 px-4 mb-2 uppercase tracking-widest font-semibold text-[10px]">
            Navigation
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.filter((item) => !item.hidden).map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  className={cn(
                    "w-full h-10 px-4",
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-sidebar-accent/20"
                  )}
                >
                  <Link href={item.href} className="flex items-center gap-3" onClick={() => setOpenMobile(false)}>
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator className="my-2 opacity-20" />

        {/* Tenant info */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 px-4 mb-2 uppercase tracking-widest font-semibold text-[10px]">
            Workspace
          </SidebarGroupLabel>
          <div className="px-4 space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
              <Database className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-xs font-medium truncate">{currentUser?.tenantId}</span>
            </div>
          </div>
        </SidebarGroup>

        <SidebarSeparator className="my-2 opacity-20" />

        {/* Chat history */}
        <SidebarGroup className="flex-1 overflow-hidden">
          <SidebarGroupLabel className="text-sidebar-foreground/60 px-4 mb-2 uppercase tracking-widest font-semibold text-[10px] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <History className="w-3 h-3" />
              Conversations
            </span>
            <button
              onClick={() => router.push("/chat")}
              className="p-0.5 rounded hover:bg-white/10 transition-colors"
              title="New chat"
            >
              <Plus className="w-3 h-3" />
            </button>
          </SidebarGroupLabel>
          <ScrollArea className="h-[280px] px-2">
            <SidebarMenu>
              {tenantChats.length > 0 ? (
                tenantChats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <div className="flex items-center gap-1 w-full rounded-md group">
                      <SidebarMenuButton
                        asChild
                        className="flex-1 text-xs opacity-80 hover:opacity-100 h-8 hover:bg-sidebar-accent/20 truncate"
                      >
                        <Link href={`/chat?id=${chat.id}`} className="truncate block">
                          {chat.title || "Untitled Conversation"}
                        </Link>
                      </SidebarMenuButton>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          removeChat(chat.id);
                          if (pathname.startsWith("/chat")) router.push("/chat");
                        }}
                        className="p-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-300 transition-all shrink-0"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="px-4 py-3 text-[10px] text-sidebar-foreground/40 italic text-center">
                  No conversations yet.
                  <br />
                  Start a new chat above.
                </div>
              )}
            </SidebarMenu>
          </ScrollArea>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border/50">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm shrink-0">
            {currentUser?.name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none truncate">{currentUser?.name}</p>
            <p className="text-[10px] opacity-60 mt-1">{currentUser?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/10 gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

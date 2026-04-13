"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  Shield, 
  Database,
  History
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
  SidebarSeparator
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout, chats } = useStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isAdmin = currentUser?.role === "Admin";

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "AI Chat", href: "/chat", icon: MessageSquare },
    { label: "Documents", href: "/documents", icon: FileText, hidden: !isAdmin },
    { label: "User Management", href: "/users", icon: Users, hidden: !isAdmin },
  ];

  return (
    <Sidebar className="border-r border-sidebar-border shadow-xl">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-accent rounded-lg">
            <Shield className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-none">DocuSense</h2>
            <p className="text-[10px] opacity-70 tracking-wider font-medium">KNOWLEDGE BASE</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 px-4 mb-2 uppercase tracking-widest font-semibold text-[10px]">
            Navigation
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.filter(item => !item.hidden).map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.href}
                  className={cn(
                    "w-full h-10 px-4",
                    pathname === item.href ? "bg-accent text-accent-foreground" : "hover:bg-sidebar-accent/20"
                  )}
                >
                  <Link href={item.href} className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator className="my-2 opacity-20" />

        <SidebarGroup className="flex-1 overflow-hidden">
          <SidebarGroupLabel className="text-sidebar-foreground/60 px-4 mb-2 uppercase tracking-widest font-semibold text-[10px] flex items-center justify-between">
            Recent Chats
            <History className="w-3 h-3" />
          </SidebarGroupLabel>
          <ScrollArea className="h-[300px] px-2">
            <SidebarMenu>
              {chats.length > 0 ? (
                chats.slice(0, 5).map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton 
                      asChild 
                      className="w-full text-xs opacity-80 hover:opacity-100 h-8 hover:bg-sidebar-accent/20"
                    >
                      <Link href={`/chat?id=${chat.id}`} className="truncate">
                        {chat.title || "Untitled Conversation"}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="px-4 py-2 text-[10px] text-sidebar-foreground/40 italic">
                  No previous sessions
                </div>
              )}
            </SidebarMenu>
          </ScrollArea>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-4">
        <div className="bg-white/10 rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-xs">
              {currentUser?.name?.[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate leading-none">{currentUser?.name}</p>
              <p className="text-[10px] opacity-70 truncate mt-1">{currentUser?.role}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] opacity-60">
              <Database className="w-3 h-3" />
              <span>{currentUser?.tenantId}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-sidebar-foreground/60 hover:text-white hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

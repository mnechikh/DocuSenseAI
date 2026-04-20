"use client";

export const dynamic = 'force-dynamic';

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { auth } from "@/lib/firebase";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser } = useStore();
  // Gate rendering until the Firebase Auth token has the tenantId custom claim.
  // Old sessions (from before claims were added) need a force-refresh.
  const [claimsReady, setClaimsReady] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    const user = auth.currentUser;
    if (!user) { setClaimsReady(true); return; }
    user.getIdTokenResult().then(async (result) => {
      if (!result.claims.tenantId) {
        // Token predates custom claims — force a refresh to pick them up.
        await user.getIdToken(true);
      }
      setClaimsReady(true);
    });
  }, [currentUser, router]);

  if (!currentUser || !claimsReady) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <DashboardSidebar claimsReady={claimsReady} />
        <SidebarInset className="flex-1 overflow-auto">
          {/* Mobile sticky topbar — hidden on md+ where the sidebar is always visible */}
          <header className="sticky top-0 z-50 flex md:hidden items-center gap-3 h-14 px-4 border-b border-border/60 bg-background/95 backdrop-blur-sm shrink-0">
            <SidebarTrigger className="h-8 w-8" />
            <Link href="/dashboard" className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%)' }}
              >
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 5px 2px rgba(255,255,255,0.5)' }} />
              </div>
              <span className="font-bold text-sm tracking-tight">Lumxia</span>
            </Link>
          </header>
          <main className="h-full p-4 md:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

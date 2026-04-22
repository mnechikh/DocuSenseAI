"use client";

export const dynamic = 'force-dynamic';

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useStore } from "@/lib/store";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useStore();
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const [claimsReady, setClaimsReady] = useState(false);
  // authResolved = Firebase has told us whether a user exists (prevents premature redirect on page reload)
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          // Confirmed: no logged-in user
          setAuthResolved(true);
          return;
        }

        // Page-reload case: Firebase has a user but Zustand lost its state.
        // Restore the profile from the session cookie via server action.
        if (!currentUserRef.current) {
          const { getSessionUser } = await import("@/lib/auth-actions");
          const profile = await getSessionUser();
          if (profile) {
            setCurrentUser({
              userId: profile.uid,
              tenantId: profile.tenantId,
              email: profile.email,
              role: profile.role,
              name: profile.name,
              status: profile.status,
            });
          }
        }

        // Ensure the ID token carries the custom claims (tenantId / role).
        const result = await firebaseUser.getIdTokenResult();
        if (!result.claims.tenantId) {
          await firebaseUser.getIdToken(true);
        }
        setClaimsReady(true);
      } finally {
        setAuthResolved(true);
      }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Redirect only after Firebase confirms there's no authenticated user.
  useEffect(() => {
    if (!authResolved) return;
    if (!currentUser) router.push("/login");
  }, [authResolved, currentUser, router]);

  if (!authResolved || !currentUser || !claimsReady) return null;

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

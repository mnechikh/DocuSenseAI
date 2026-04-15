"use client";

import { useStore } from "@/lib/store";
import { revokeSessionCookie } from "@/lib/auth-actions";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Shield, Clock, LogOut, Mail } from "lucide-react";

export default function PendingPage() {
  const { currentUser, logout } = useStore();
  const router = useRouter();

  const handleLogout = async () => {
    await revokeSessionCookie();
    await signOut(auth).catch(() => {});
    logout();
    router.push("/login");
  };

  const statusLabel = currentUser?.status === "suspended" ? "suspended" : "pending approval";
  const isSuspended = currentUser?.status === "suspended";

  return (
    <div className="flex min-h-screen bg-background items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className={`p-4 rounded-full ${isSuspended ? "bg-destructive/10" : "bg-amber-100 dark:bg-amber-900/30"}`}>
            {isSuspended
              ? <Shield className="w-10 h-10 text-destructive" />
              : <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            }
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {isSuspended ? "Account Suspended" : "Awaiting Approval"}
          </h1>
          <p className="text-muted-foreground">
            {isSuspended
              ? "Your workspace has been suspended. Please contact the platform administrator."
              : `Your workspace request is ${statusLabel}. The platform administrator will review it shortly.`
            }
          </p>
        </div>

        {!isSuspended && (
          <div className="p-4 bg-muted rounded-xl text-sm text-muted-foreground space-y-1">
            <div className="flex items-center justify-center gap-2 font-medium text-foreground">
              <Mail className="w-4 h-4" />
              <span>What happens next?</span>
            </div>
            <p>Once approved, you&apos;ll have full access to your workspace. You can sign in again at any time to check your status.</p>
          </div>
        )}

        {currentUser && (
          <div className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{currentUser.email}</span>
            {" "}· Workspace: <span className="font-medium text-foreground">{currentUser.tenantId}</span>
          </div>
        )}

        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="w-4 h-4" />Sign out
        </Button>
      </div>
    </div>
  );
}

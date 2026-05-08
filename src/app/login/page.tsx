"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createSessionCookie } from "@/lib/auth-actions";
import { logAuthEvent } from "@/lib/activity-log-actions";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleGoogleSignIn = async () => {
    setError("");
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      const { error: sessionError } = await createSessionCookie(idToken);
      if (sessionError) {
        await firebaseSignOut(auth);
        // Log the failure so we can diagnose in production
        logAuthEvent(cred.user.email ?? '', 'session-create-failed').catch(() => {});
        setError(`Sign-in failed: ${sessionError}`);
        return;
      }
      await cred.user.getIdToken(true);
      const { getSessionUser } = await import("@/lib/auth-actions");
      const profile = await getSessionUser();
      if (!profile) {
        await firebaseSignOut(auth);
        setError("No Lumxia account found for this Google account. Please sign up first.");
        return;
      }
      setCurrentUser({
        userId: profile.uid,
        tenantId: profile.tenantId,
        email: profile.email,
        role: profile.role,
        name: profile.name,
        status: profile.status,
      });
      if (profile.status === "pending" || profile.status === "suspended") {
        router.push("/pending");
        return;
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      if (code === "auth/account-exists-with-different-credential") {
        setError("An account with this email already exists. Please sign in with email and password.");
        return;
      }
      if (code === "auth/unauthorized-domain") {
        setError("This domain is not authorized for Google sign-in. Contact support.");
        return;
      }
      logAuthEvent(email, code || 'google-signin-failed').catch(() => {});
      setError((err as Error).message || "Google sign-in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError("");
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const { error: sessionError } = await createSessionCookie(idToken);
      if (sessionError) {
        setError(`Sign-in failed: ${sessionError}`);
        return;
      }
      // Force token refresh so Firestore picks up the new custom claims (tenantId/role)
      await cred.user.getIdToken(true);

      // Fetch user profile from Firestore via server action
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
        // Gate access based on approval status
        if (profile.status === "pending" || profile.status === "suspended") {
          router.push("/pending");
          return;
        }
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      const message = (err as Error).message ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        logAuthEvent(email, code).catch(() => {});
        setError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        logAuthEvent(email, code).catch(() => {});
        setError("Too many attempts. Please try again later.");
      } else if (message.includes("unexpected response")) {
        // Server action failed to serialize — usually a transient server error.
        setError("Server error. Please try again.");
      } else {
        console.error("[Login] unexpected error:", code, message, err);
        setError(message || "Sign in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  return (
    <div className="flex min-h-screen bg-background items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%)', boxShadow: '0 8px 24px rgba(124,140,255,0.35)' }}
            >
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 8px 4px rgba(255,255,255,0.45)' }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Lumxia</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Your intelligent knowledge companion</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary: Google */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading}
          className="w-full flex items-center justify-center gap-3 h-12 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%)', boxShadow: '0 4px 14px rgba(124,140,255,0.4)' }}
        >
          {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>

        {/* Email toggle */}
        {!showEmailForm ? (
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowEmailForm(true)}
            >
              Or sign in with email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : "Sign In"}
            </Button>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">Create workspace</Link>
        </p>
      </div>
    </div>
  );
}

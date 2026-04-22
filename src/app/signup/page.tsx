"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createSessionCookie, createUserProfile, createTenant, validateInviteToken, consumeInviteToken } from "@/lib/auth-actions";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, Building2, UserPlus } from "lucide-react";
import Link from "next/link";
import { UserRole } from "@/lib/store";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setCurrentUser } = useStore();

  const inviteToken = searchParams.get("token") ?? "";
  const defaultTab = inviteToken ? "join" : "create";

  const [tab, setTab] = useState<"create" | "join">(defaultTab as "create" | "join");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [role, setRole] = useState<UserRole>("Admin");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [error, setError] = useState("");
  const [inviteValid, setInviteValid] = useState<null | { tenantId: string; role: UserRole; email: string | null }>(null);
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Validate invite token on load
  useEffect(() => {
    if (!inviteToken) return;
    setIsValidatingToken(true);
    validateInviteToken(inviteToken).then((result) => {
      if (result) {
        setInviteValid(result);
        setTenantId(result.tenantId);
        setRole(result.role);
        if (result.email) setEmail(result.email);
      } else {
        setError("This invite link is invalid, expired, or already used.");
      }
      setIsValidatingToken(false);
    });
  }, [inviteToken]);

  const handleGoogleAuth = async () => {
    setError("");
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      setGoogleUser(cred.user);
      if (cred.user.displayName && !name) setName(cred.user.displayName);
      if (cred.user.email) setEmail(cred.user.email);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      if (code === "auth/account-exists-with-different-credential") {
        setError("An account with this email already exists. Please use email and password instead.");
        return;
      }
      setError("Google sign-in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    if (!googleUser && !password) return;
    if (!googleUser && password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (tab === "create" && !tenantId) return;
    setError("");
    setIsLoading(true);
    try {
      const firebaseUser = googleUser
        ?? (await createUserWithEmailAndPassword(auth, email, password)).user;
      const uid = firebaseUser.uid;

      if (tab === "create") {
        // Create workspace tenant + user profile — auto-approved on free tier
        const resolvedTenantId = tenantId.toLowerCase().trim().replace(/\s+/g, "-");
        await createTenant(resolvedTenantId, tenantName || resolvedTenantId, uid);
        await createUserProfile(uid, email, name, resolvedTenantId, "Admin", "active");
        const idToken = await firebaseUser.getIdToken();
        await createSessionCookie(idToken);
        setCurrentUser({ userId: uid, tenantId: resolvedTenantId, email, role: "Admin", name, status: "active" });
        router.push("/dashboard");
      } else {
        // Join via invite — active immediately
        if (!inviteValid) { setError("Invalid invite token."); setIsLoading(false); return; }
        await createUserProfile(uid, email, name, inviteValid.tenantId, inviteValid.role, "active");
        await consumeInviteToken(inviteToken, uid);
        const idToken = await firebaseUser.getIdToken();
        await createSessionCookie(idToken);
        setCurrentUser({ userId: uid, tenantId: inviteValid.tenantId, email, role: inviteValid.role, name, status: "active" });
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/email-already-in-use") setError("An account with this email already exists.");
      else if (code === "auth/weak-password") setError("Password must be at least 6 characters.");
      else setError((err as Error).message ?? "Sign up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%)', boxShadow: '0 8px 24px rgba(124,140,255,0.35)' }}
            >
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 8px 4px rgba(255,255,255,0.45)' }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Lumxia</h1>
          <p className="mt-2 text-muted-foreground text-sm">Join the knowledge platform</p>
        </div>

        <Card className="border-none shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => { setTab(v as "create" | "join"); setError(""); }}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="create" className="gap-2">
                  <Building2 className="w-4 h-4" />New Workspace
                </TabsTrigger>
                <TabsTrigger value="join" className="gap-2">
                  <UserPlus className="w-4 h-4" />Join with Invite
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!googleUser ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-3 font-medium"
                      onClick={handleGoogleAuth}
                      disabled={isGoogleLoading || isLoading}
                    >
                      {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                      )}
                      Continue with Google
                    </Button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">or with email</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span>Signed in as <strong>{googleUser.email}</strong></span>
                    </div>
                    <button type="button" className="text-xs underline text-green-700 hover:text-green-900" onClick={() => { setGoogleUser(null); setName(""); setEmail(""); }}>Change</button>
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                  </div>
                )}

                <TabsContent value="create" className="mt-0 space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 rounded-lg text-sm flex gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Free tier — get started instantly. No approval required.</span>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenantId-create">Workspace ID</Label>
                    <Input id="tenantId-create" placeholder="acme-corp" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required={tab === "create"} />
                    <p className="text-[10px] text-muted-foreground">Lowercase, no spaces. All users at your company share this.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenantName">Company Name</Label>
                    <Input id="tenantName" placeholder="Acme Corporation" value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Your Role</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin — can upload docs & manage users</SelectItem>
                        <SelectItem value="User">User — chat only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="join" className="mt-0 space-y-4">
                  {isValidatingToken ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />Validating invite…
                    </div>
                  ) : inviteValid ? (
                    <div className="p-3 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 rounded-lg text-sm flex gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Valid invite for workspace <strong>{inviteValid.tenantId}</strong> as <strong>{inviteValid.role}</strong>.</span>
                    </div>
                  ) : !inviteToken ? (
                    <div className="space-y-2">
                      <Label htmlFor="tokenInput">Invite Token</Label>
                      <Input id="tokenInput" placeholder="Paste your invite token" onChange={(e) => {
                        if (e.target.value.length === 36) {
                          setIsValidatingToken(true);
                          validateInviteToken(e.target.value).then((r) => {
                            if (r) { setInviteValid(r); setTenantId(r.tenantId); setRole(r.role); if (r.email) setEmail(r.email); }
                            else setError("Invalid, expired, or already used invite.");
                            setIsValidatingToken(false);
                          });
                        }
                      }} />
                    </div>
                  ) : null}
                </TabsContent>

                {/* Shared fields */}
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" readOnly={!!(inviteValid?.email)} />
                </div>
                {!googleUser && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
                  </div>
                )}

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading || isValidatingToken || (tab === "join" && !inviteValid && !!inviteToken)}>
                  {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tab === "create" ? "Creating workspace…" : "Joining workspace…"}</>
                    : tab === "create" ? "Create Workspace" : "Join Workspace"}
                </Button>
              </form>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

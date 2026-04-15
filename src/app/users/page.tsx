"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { generateInviteToken, getTenantMembers, removeUserFromTenant } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users, UserPlus, Shield, Lock, Mail, CheckCircle,
  ShieldCheck, AlertCircle, Loader2, Copy, Check, UserX, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Member = {
  uid: string;
  name: string;
  email: string;
  role: "Admin" | "User";
  status: "pending" | "active" | "suspended";
  createdAt: number;
};

export default function UsersPage() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<"Admin" | "User">("User");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!currentUser?.tenantId) return;
    setLoadingMembers(true);
    try {
      const data = await getTenantMembers(currentUser.tenantId);
      setMembers(data);
    } catch (e: unknown) {
      toast({ title: "Failed to load members", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoadingMembers(false);
    }
  }, [currentUser?.tenantId, toast]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  if (currentUser?.role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can manage users.</p>
      </div>
    );
  }

  const handleGenerateInvite = async () => {
    if (!currentUser) return;
    setGeneratingInvite(true);
    try {
      const token = await generateInviteToken(currentUser.tenantId, inviteRole, currentUser.userId, inviteEmail || undefined);
      const url = `${window.location.origin}/signup?token=${token}`;
      setInviteLink(url);
    } catch (e: unknown) {
      toast({ title: "Failed to generate invite", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemove = async (uid: string, name: string) => {
    setRemovingUid(uid);
    try {
      await removeUserFromTenant(uid);
      setMembers((prev) => prev.map((m) => m.uid === uid ? { ...m, status: "suspended" } : m));
      toast({ title: "User suspended", description: `${name} has been suspended from this workspace.` });
    } catch (e: unknown) {
      toast({ title: "Failed to remove user", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRemovingUid(null);
    }
  };

  const statusBadge = (status: Member["status"]) => {
    if (status === "active") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-0">Active</Badge>;
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-0">Pending</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-0">Suspended</Badge>;
  };

  return (
    <TooltipProvider>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">User Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage roles and permissions for <span className="font-semibold text-primary">{currentUser.tenantId}</span>.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={loadMembers} disabled={loadingMembers}>
              <RefreshCw className={`w-4 h-4 ${loadingMembers ? "animate-spin" : ""}`} />
            </Button>
            <Button className="bg-primary hover:bg-primary/90 shadow-md" onClick={() => { setInviteLink(""); setInviteEmail(""); setInviteRole("User"); setInviteOpen(true); }}>
              <UserPlus className="mr-2 h-4 w-4" />Invite Member
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white/50 dark:bg-background border-b">
            <CardTitle className="text-lg">Team Members</CardTitle>
            <CardDescription>All users in the <strong>{currentUser.tenantId}</strong> workspace</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />Loading members…
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No members yet. Invite your team!</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[220px]">Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.uid}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs shrink-0">
                            {member.name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <span className="truncate">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {member.role === "Admin"
                            ? <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                            : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                          <span className="text-sm">{member.role}</span>
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(member.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.uid !== currentUser.userId && member.status !== "suspended" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemove(member.uid, member.name)}
                                disabled={removingUid === member.uid}
                              >
                                {removingUid === member.uid
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <UserX className="w-4 h-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Suspend user</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Role definitions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />Role Definitions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Administrator</p>
                <p className="text-xs text-muted-foreground">Full access to document management, user invitations, and AI chat with all sources.</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Regular User</p>
                <p className="text-xs text-muted-foreground">AI Chat and viewing citations only. Cannot upload or delete documents.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-base">Invite via Link</CardTitle>
              <CardDescription className="text-primary-foreground/70">Generate a secure one-time invite link</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs opacity-80">Each link is single-use, expires in 7 days, and is scoped to your workspace. Click &quot;Invite Member&quot; to generate one.</p>
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { setInviteLink(""); setInviteEmail(""); setInviteRole("User"); setInviteOpen(true); }}>
                <UserPlus className="mr-2 h-4 w-4" />Generate Invite Link
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Invite Dialog */}
        <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) setInviteLink(""); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Generate a secure invite link for your <strong>{currentUser.tenantId}</strong> workspace. Links expire in 7 days and are single-use.
              </DialogDescription>
            </DialogHeader>
            {!inviteLink ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Role for new member</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "Admin" | "User")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="User">User — chat only</SelectItem>
                      <SelectItem value="Admin">Admin — full access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email (optional)</Label>
                  <Input placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" />
                  <p className="text-[10px] text-muted-foreground">If provided, the link will pre-fill the email on signup.</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                  <Button onClick={handleGenerateInvite} disabled={generatingInvite} className="gap-2">
                    {generatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Generate Link
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 rounded-lg text-sm flex gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  Invite link generated! Share it with your colleague. It expires in 7 days.
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={inviteLink} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteLink("")}>Generate Another</Button>
                  <Button onClick={() => setInviteOpen(false)}>Done</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

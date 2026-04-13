"use client";

import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Lock, 
  MoreVertical, 
  Mail,
  CheckCircle,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function UsersPage() {
  const { currentUser } = useStore();

  if (currentUser?.role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can manage users.</p>
      </div>
    );
  }

  // Mock users for the tenant
  const mockUsers = [
    { id: "1", name: currentUser.name, email: currentUser.email, role: "Admin", status: "Active" },
    { id: "2", name: "Sarah Jenkins", email: "sarah@company.com", role: "User", status: "Active" },
    { id: "3", name: "Michael Ross", email: "michael@company.com", role: "User", status: "Pending" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage roles and permissions for <span className="font-semibold text-primary">{currentUser.tenantId}</span>.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 shadow-md">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white/50 border-b">
            <CardTitle className="text-lg">Team Members</CardTitle>
            <CardDescription>Grant access to tenant datasets and AI features</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[250px]">Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
                          {user.name[0].toUpperCase()}
                        </div>
                        {user.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.role === "Admin" ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="text-sm">{user.role}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.status === "Active" ? "default" : "secondary"}
                        className={user.status === "Active" ? "bg-green-500 hover:bg-green-500" : ""}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Role Definitions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Administrator</p>
                <p className="text-xs text-muted-foreground">Full access to document management, user invitations, system settings, and AI chat with all sources.</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Regular User</p>
                <p className="text-xs text-muted-foreground">Restricted to AI Chat and viewing document citations. Cannot upload or delete tenant data.</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-sm bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-base">Invite via Link</CardTitle>
              <CardDescription className="text-primary-foreground/70">Quickly bring your team on board</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs opacity-80">
                Generate a unique invitation link for your tenant workspace. Members joining via this link will be assigned the 'User' role by default.
              </p>
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Copy Invitation Link
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

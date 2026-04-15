import Link from "next/link";
import { Shield, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="p-3 bg-primary rounded-xl text-primary-foreground shadow-lg">
            <Shield className="w-8 h-8" />
          </div>
        </div>
        <div>
          <p className="text-6xl font-black text-primary/20">404</p>
          <h1 className="text-2xl font-bold text-primary mt-2">Page Not Found</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            The page you are looking for does not exist or you do not have
            permission to access it.
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}

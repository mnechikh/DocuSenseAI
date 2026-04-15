"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in production
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="p-3 bg-destructive/10 rounded-xl text-destructive">
            <AlertCircle className="w-8 h-8" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">Something went wrong</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            An unexpected error occurred. The error has been logged and our team
            has been notified.
          </p>
          {error.digest && (
            <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <Button onClick={reset} className="bg-primary hover:bg-primary/90">
          <RotateCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}

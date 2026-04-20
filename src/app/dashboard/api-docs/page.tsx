"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ApiDocsPage() {
  return (
    <div className="flex flex-col gap-0 -m-4 md:-m-8" style={{ height: "calc(100vh - 56px)" }}>
      {/* Slim toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-background shrink-0">
        <div>
          <h1 className="text-sm font-semibold">API Reference</h1>
          <p className="text-xs text-muted-foreground">OpenAPI 3.0 — v1</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer">
              openapi.json
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            <a href="/api/openapi-ui" target="_blank" rel="noopener noreferrer">
              Full screen
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </div>
      </div>

      {/* Swagger UI iframe — CSS-isolated */}
      <iframe
        src="/api/openapi-ui"
        title="Lumxia API Reference"
        className="flex-1 w-full border-0"
        loading="lazy"
      />
    </div>
  );
}

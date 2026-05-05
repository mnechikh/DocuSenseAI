"use client";

import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { listActivityLogs } from "@/lib/activity-log-actions";
import type { ActivityLog, ActivityLevel, ActivityCategory } from "@/lib/activity-log-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, RefreshCw, ChevronDown } from "lucide-react";
import { format } from "date-fns";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<ActivityLevel, string> = {
  info:    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  error:   "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  auth:        "Auth",
  document:    "Document",
  user:        "User",
  webhook:     "Webhook",
  api:         "API",
  integration: "Integration",
  system:      "System",
};

function LevelBadge({ level }: { level: ActivityLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLES[level]}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function formatTs(ts: number) {
  try {
    return format(new Date(ts), "MMM d, yyyy HH:mm:ss");
  } catch {
    return String(ts);
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const { currentUser } = useStore();
  const isAdmin = currentUser?.role === "Admin";

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [levelFilter, setLevelFilter] = useState<ActivityLevel | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory | "all">("all");

  const fetchLogs = useCallback(
    async (cursor?: number, append = false) => {
      setLoading(true);
      try {
        const { logs: newLogs, hasMore: more } = await listActivityLogs({
          level: levelFilter !== "all" ? levelFilter : undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          cursor,
        });
        setLogs((prev) => (append ? [...prev, ...newLogs] : newLogs));
        setHasMore(more);
      } finally {
        setLoading(false);
      }
    },
    [levelFilter, categoryFilter]
  );

  // Refetch on filter change
  useEffect(() => {
    fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, categoryFilter]);

  const loadMore = () => {
    const last = logs[logs.length - 1];
    if (last) fetchLogs(last.timestamp, true);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You do not have permission to view activity logs.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Activity Logs</h1>
            <p className="text-sm text-muted-foreground">Audit trail for security and compliance</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4">
          <Select
            value={levelFilter}
            onValueChange={(v) => setLevelFilter(v as ActivityLevel | "all")}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as ActivityCategory | "all")}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {logs.length} log{logs.length !== 1 ? "s" : ""}
            {levelFilter !== "all" || categoryFilter !== "all" ? " (filtered)" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && logs.length === 0 ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No activity logs yet. Events will appear here as users interact with the platform.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground text-xs">
                    <th className="px-4 py-3 text-left font-medium">Time</th>
                    <th className="px-4 py-3 text-left font-medium">Level</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Action</th>
                    <th className="px-4 py-3 text-left font-medium">Actor</th>
                    <th className="px-4 py-3 text-left font-medium">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                        {formatTs(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <LevelBadge level={log.level} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[log.category] ?? log.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-xs truncate max-w-[160px]" title={log.actorEmail}>
                        {log.actorEmail ?? log.actorId ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span title={log.metadata ? JSON.stringify(log.metadata, null, 2) : undefined}>
                          {log.message}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center py-4 border-t">
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={loading}>
                <ChevronDown className="h-4 w-4 mr-2" />
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SkeletonList } from "@/components/LoadingSkeleton";
import type { TraceListItem } from "@/lib/traces-api";

function riskColor(risk: string): string {
  switch (risk) {
    case "high":
      return "#dc2626";
    case "medium":
      return "#ca8a04";
    case "low":
      return "#ea580c";
    case "safe":
      return "#16a34a";
    default:
      return "#6b7280";
  }
}

export default function HistoryPage() {
  const [traces, setTraces] = useState<TraceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/traces")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load traces");
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setTraces(data.traces ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Trace History
          </h1>
          <p className="text-sm text-muted-foreground">
            Past LLM traces stored in SQLite.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          New Trace
        </Link>
      </header>

      {loading && <SkeletonList />}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && traces.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-muted-foreground">
            No traces yet. Run your first trace to get started.
          </p>
          <Link
            href="/"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Create Trace
          </Link>
        </div>
      )}

      {traces.length > 0 && (
        <ul className="space-y-2">
          {traces.map((t) => {
            const color = riskColor(t.riskSummary.risk);
            return (
              <li key={t.id}>
                <Link
                  href={`/trace/${t.id}`}
                  className="block rounded-md border bg-card px-4 py-3 text-sm text-card-foreground transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.question}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()} &middot;{" "}
                        {t.model} &middot; {t.tokenCount} tokens
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
                        style={{
                          backgroundColor: color + "1a",
                          color,
                        }}
                      >
                        {t.riskSummary.risk}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(t.riskSummary.avgProb * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {(t.riskSummary.lowCount > 0 ||
                    t.riskSummary.criticalCount > 0) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.riskSummary.lowCount} low-confidence
                      {t.riskSummary.criticalCount > 0 &&
                        `, ${t.riskSummary.criticalCount} critical`}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

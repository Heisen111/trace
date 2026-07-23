"use client";

import type { AblationResultItem } from "@/lib/ablation";

interface AblationViewProps {
  segments: AblationResultItem[];
  loading: boolean;
  error: string;
  onRunAblation: () => void;
  hasAnswer: boolean;
}

function scoreColor(sim: number | null): string {
  if (sim === null) return "#6b7280";
  if (sim >= 0.9) return "#16a34a";
  if (sim >= 0.7) return "#2563eb";
  if (sim >= 0.6) return "#ca8a04";
  return "#dc2626";
}

function scoreLabel(sim: number | null): string {
  if (sim === null) return "—";
  return (sim * 100).toFixed(1) + "%";
}

export default function AblationView({
  segments,
  loading,
  error,
  onRunAblation,
  hasAnswer,
}: AblationViewProps) {
  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!hasAnswer) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Submit a question first to get an answer before running ablation.
      </p>
    );
  }

  if (segments.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-muted-foreground">
          Remove each segment of your question to find which parts are
          load-bearing.
        </p>
        <button
          onClick={onRunAblation}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Running ablation..." : "Run Ablation"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {segments.length === 0 ? null : (
        <ul className="space-y-3">
          {segments.map((seg, i) => {
            const simColor = scoreColor(seg.embedding_similarity);
            return (
              <li
                key={i}
                className="rounded-md border bg-card px-4 py-3 text-sm text-card-foreground"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="font-medium">Removed:</span>{" "}
                    <span className="font-mono text-destructive">
                      &ldquo;{seg.segment}&rdquo;
                    </span>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
                    style={{ backgroundColor: simColor + "1a", color: simColor }}
                  >
                    {scoreLabel(seg.embedding_similarity)}
                  </span>
                </div>

                <details className="group mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Details
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Ablated question:
                      </span>
                      <p className="mt-0.5 font-mono text-xs">
                        {seg.ablated_question}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Ablated answer:
                      </span>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs">
                        {seg.ablated_answer || seg.error || "(empty)"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {seg.embedding_similarity !== null && (
                        <span className="text-xs text-muted-foreground">
                          Similarity:{" "}
                          <span
                            className="font-medium tabular-nums"
                            style={{ color: simColor }}
                          >
                            {scoreLabel(seg.embedding_similarity)}
                          </span>
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        LLM verdict:{" "}
                        <span
                          className={`font-medium ${
                            seg.llm_verdict_changed === true
                              ? "text-destructive"
                              : seg.llm_verdict_changed === false
                                ? "text-green-600"
                                : "text-muted-foreground"
                          }`}
                        >
                          {seg.llm_verdict_changed === null
                            ? "unavailable"
                            : seg.llm_verdict_changed
                              ? "CHANGED"
                              : "unchanged"}
                        </span>
                      </span>
                    </div>
                  </div>
                </details>

                {seg.load_bearing && (
                  <div className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                    Load-bearing segment
                  </div>
                )}
                {seg.error && (
                  <div className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                    {seg.error}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

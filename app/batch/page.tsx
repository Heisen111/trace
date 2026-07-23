"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { processQuestion, computeAggregate } from "@/lib/batch";
import type { BatchQuestionResult, BatchAggregate } from "@/lib/batch";

export default function BatchPage() {
  const [questionsText, setQuestionsText] = useState("");
  const [results, setResults] = useState<BatchQuestionResult[]>([]);
  const [aggregate, setAggregate] = useState<BatchAggregate | null>(null);
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function handleRun() {
    const questions = questionsText
      .split("\n")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    if (questions.length === 0) {
      setError("Paste at least one question.");
      return;
    }

    setError("");
    setResults([]);
    setAggregate(null);
    setRunning(true);
    setCurrentIndex(0);

    const abort = new AbortController();
    abortRef.current = abort;
    const batchResults: BatchQuestionResult[] = [];

    for (let i = 0; i < questions.length; i++) {
      if (abort.signal.aborted) break;
      setCurrentIndex(i);

      try {
        const r = await processQuestion(questions[i], abort.signal);
        batchResults.push(r);
      } catch (e: unknown) {
        if ((e as Error).name === "AbortError") break;
        batchResults.push({
          question: questions[i],
          answer_text: "",
          token_confidence: [],
          claims: [],
          avgConfidence: 0,
          lowConfCount: 0,
          criticalConfCount: 0,
          confidenceStdDev: 0,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }

      setResults([...batchResults]);
    }

    if (!abort.signal.aborted) {
      setAggregate(computeAggregate(batchResults));
    }
    setRunning(false);
    setCurrentIndex(-1);
  }

  function handleStop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  const questions = questionsText
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              &larr; Dashboard
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Batch Mode
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Run multiple questions sequentially and compare aggregate stats.
          </p>
        </div>
      </header>

      <div className="rounded-md border bg-card p-4">
        <label className="mb-1.5 block text-sm font-medium text-card-foreground">
          Questions (one per line)
        </label>
        <textarea
          value={questionsText}
          onChange={(e) => setQuestionsText(e.target.value)}
          placeholder={`What is the capital of France?\nExplain quantum computing\nWhat is the speed of light?`}
          rows={6}
          disabled={running}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={running || questions.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {running
              ? `Running ${currentIndex + 1}/${questions.length}...`
              : `Run Batch (${questions.length} question${questions.length !== 1 ? "s" : ""})`}
          </button>
          {running && (
            <button
              onClick={handleStop}
              className="rounded-md border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {running && (
        <div>
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Processing question {currentIndex + 1} of {questions.length}
            </span>
            <span>
              {Math.round(((currentIndex) / questions.length) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${(currentIndex / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-md border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-card-foreground">
            Per-Question Results
          </h2>
          <ul className="space-y-1">
            {results.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span
                  className={`shrink-0 text-base ${
                    r.error
                      ? "text-destructive"
                      : currentIndex === i && running
                        ? "text-muted-foreground"
                        : "text-green-600"
                  }`}
                >
                  {r.error ? "\u2716" : currentIndex === i && running ? "\u23F3" : "\u2713"}
                </span>
                <span className="min-w-0 flex-[1_1_160px] truncate">{r.question}</span>
                {!r.error && r.token_confidence.length > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {(r.avgConfidence * 100).toFixed(0)}%
                  </span>
                )}
                {r.error && (
                  <span className="shrink-0 text-xs text-destructive">
                    {r.error}
                  </span>
                )}
                {!r.error && r.claims.filter((c) => c.adjustedRisk === "high").length > 0 && (
                  <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                    {r.claims.filter((c) => c.adjustedRisk === "high").length} high
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {aggregate && (
        <div className="rounded-md border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-card-foreground">
            Aggregate Summary
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-background px-3 py-4 text-center">
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {(aggregate.overallAvgConfidence * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">
                Average Confidence
              </div>
            </div>
            <div className="rounded-md border bg-background px-3 py-4 text-center">
              <div className="text-2xl font-bold tabular-nums text-destructive">
                {aggregate.totalHighRiskClaims}
              </div>
              <div className="text-xs text-muted-foreground">
                High-Risk Claims
              </div>
            </div>
            <div className="rounded-md border bg-background px-3 py-4 text-center">
              <div className="text-lg font-bold tabular-nums text-foreground">
                {aggregate.mostInconsistent
                  ? (aggregate.mostInconsistent.stdDev * 100).toFixed(1) + "%"
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {aggregate.mostInconsistent
                  ? "Highest Std Dev"
                  : "Std Dev"}
              </div>
            </div>
          </div>

          {aggregate.mostInconsistent && (
            <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
              <strong>Most inconsistent:</strong>{" "}
              {aggregate.mostInconsistent.question}
            </div>
          )}

          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span>{aggregate.totalQuestions} total questions</span>
            <span>{aggregate.completedCount} completed</span>
            {aggregate.errorCount > 0 && (
              <span className="text-destructive">
                {aggregate.errorCount} errors
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

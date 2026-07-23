"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import TraceDisplay from "@/components/TraceDisplay";
import ClaimsView from "@/components/ClaimsView";
import ConsensusView from "@/components/ConsensusView";
import AblationView from "@/components/AblationView";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { SkeletonTraceDetail } from "@/components/LoadingSkeleton";
import { extractClaims } from "@/lib/claims";
import { generateTraceHtml } from "@/lib/export";
import type { TokenData } from "@/lib/types";
import type { ConsensusResult } from "@/lib/consensus";
import type { AblationResultItem } from "@/lib/ablation";

type Tab = "answer" | "walkthrough" | "claims" | "consensus" | "ablation";

interface TraceData {
  id: string;
  question: string;
  model_config: Record<string, unknown>;
  created_at: string;
  answer_text: string;
  token_confidence: TokenData[];
}

export default function TraceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("answer");
  const [consensusResult, setConsensusResult] =
    useState<ConsensusResult | null>(null);
  const [consensusLoading, setConsensusLoading] = useState(false);
  const [consensusError, setConsensusError] = useState("");
  const [ablationSegments, setAblationSegments] = useState<
    AblationResultItem[]
  >([]);
  const [ablationLoading, setAblationLoading] = useState(false);
  const [ablationError, setAblationError] = useState("");

  useEffect(() => {
    fetch(`/api/traces/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Trace not found");
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setTrace(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const claims = useMemo(
    () => extractClaims(trace?.answer_text ?? "", trace?.token_confidence ?? [], consensusResult),
    [trace?.answer_text, trace?.token_confidence, consensusResult]
  );

  async function handleRunConsensus() {
    if (!trace) return;
    setConsensusLoading(true);
    setConsensusError("");
    setConsensusResult(null);
    try {
      const res = await fetch("/api/consensus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trace.question,
          model_config: trace.model_config,
          num_runs: 3,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConsensusResult(data);
    } catch (e: unknown) {
      setConsensusError(
        e instanceof Error ? e.message : "Consensus request failed"
      );
    } finally {
      setConsensusLoading(false);
    }
  }

  async function handleRunAblation() {
    if (!trace) return;
    setAblationLoading(true);
    setAblationError("");
    setAblationSegments([]);
    try {
      const res = await fetch("/api/ablation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trace.question,
          answer: trace.answer_text,
          model_config: trace.model_config,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAblationSegments(data.segments ?? []);
    } catch (e: unknown) {
      setAblationError(
        e instanceof Error ? e.message : "Ablation request failed"
      );
    } finally {
      setAblationLoading(false);
    }
  }

  function handleExport() {
    if (!trace) return;
    const html = generateTraceHtml({
      question: trace.question,
      model: modelName,
      created_at: trace.created_at,
      id: trace.id,
      answer_text: trace.answer_text,
      token_confidence: trace.token_confidence,
      claims,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trace-${trace.id.slice(0, 8)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <SkeletonTraceDetail />;
  }

  if (error || !trace) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error || "Trace not found"}
        </div>
        <Link
          href="/history"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          &larr; Back to history
        </Link>
      </div>
    );
  }

  const modelName =
    (trace.model_config?.model as string) || "unknown";

  const tabs: { key: Tab; label: string }[] = [
    { key: "answer", label: "Answer" },
    { key: "walkthrough", label: "Walkthrough" },
    { key: "claims", label: "Claims" },
    { key: "consensus", label: "Consensus" },
    { key: "ablation", label: "Ablation" },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href="/history"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              &larr; History
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="truncate text-lg font-bold tracking-tight text-foreground">
              {trace.question}
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {modelName} &middot;{" "}
            {new Date(trace.created_at).toLocaleString()} &middot;{" "}
            {trace.id.slice(0, 8)}...
          </p>
        </div>
        <button
          onClick={handleExport}
          className="shrink-0 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
        >
          Export HTML
        </button>
      </header>

      <OnboardingGuide />

      <div className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[200px]">
        {activeTab === "answer" && (
          <div className="whitespace-pre-wrap rounded-md border bg-card p-4 font-sans text-sm leading-relaxed text-card-foreground">
            {trace.answer_text || (
              <span className="italic text-muted-foreground">
                No answer recorded.
              </span>
            )}
          </div>
        )}

        {activeTab === "walkthrough" && (
          <div className="rounded-md border bg-card p-4">
            <TraceDisplay tokens={trace.token_confidence} />
          </div>
        )}

        {activeTab === "claims" && (
          <div className="rounded-md border bg-card p-4">
            <ClaimsView claims={claims} />
          </div>
        )}

        {activeTab === "consensus" && (
          <div className="rounded-md border bg-card p-4">
            <ConsensusView
              result={consensusResult}
              loading={consensusLoading}
              error={consensusError}
              onRunConsensus={handleRunConsensus}
            />
          </div>
        )}

        {activeTab === "ablation" && (
          <div className="rounded-md border bg-card p-4">
            <AblationView
              segments={ablationSegments}
              loading={ablationLoading}
              error={ablationError}
              onRunAblation={handleRunAblation}
              hasAnswer={!!trace.answer_text}
            />
          </div>
        )}
      </div>
    </div>
  );
}

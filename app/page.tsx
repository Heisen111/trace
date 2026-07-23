"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import TraceDisplay from "@/components/TraceDisplay";
import ConsensusView from "@/components/ConsensusView";
import AblationView from "@/components/AblationView";
import ClaimsView from "@/components/ClaimsView";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { SkeletonCard } from "@/components/LoadingSkeleton";
import type { TokenData } from "@/lib/types";
import type { ConsensusResult } from "@/lib/consensus";
import type { AblationResultItem } from "@/lib/ablation";
import { extractClaims } from "@/lib/claims";

type Tab = "answer" | "walkthrough" | "claims" | "consensus" | "ablation";

interface TraceResult {
  trace_id: string;
  full_text: string;
  token_confidence: TokenData[];
  claims: string[];
  consensus_answers: string[];
  ablation_results: Record<string, unknown>;
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TraceResult | null>(null);
  const [streamText, setStreamText] = useState("");
  const [streamTokens, setStreamTokens] = useState<TokenData[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("answer");
  const [consensusResult, setConsensusResult] = useState<ConsensusResult | null>(null);
  const [consensusLoading, setConsensusLoading] = useState(false);
  const [consensusError, setConsensusError] = useState("");
  const [ablationSegments, setAblationSegments] = useState<AblationResultItem[]>([]);
  const [ablationLoading, setAblationLoading] = useState(false);
  const [ablationError, setAblationError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    setStreamText("");
    setStreamTokens([]);
    setAblationSegments([]);
    setAblationError("");
    setActiveTab("answer");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, model_config: {} }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data: ")) continue;
          const payload = t.slice(6).trim();
          try {
            const data = JSON.parse(payload);
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.done) {
              setResult({
                trace_id: data.trace_id,
                full_text: data.full_text,
                token_confidence: data.token_confidence ?? [],
                claims: data.claims ?? [],
                consensus_answers: data.consensus_answers ?? [],
                ablation_results: data.ablation_results ?? {},
              });
              setLoading(false);
            } else if (data.token) {
              setStreamText((prev) => prev + data.token);
              if (data.logprobs?.length) {
                setStreamTokens((prev) => [...prev, ...data.logprobs]);
              }
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Request failed");
      setLoading(false);
    }
  }

  async function handleRunConsensus() {
    setConsensusLoading(true);
    setConsensusError("");
    setConsensusResult(null);

    try {
      const res = await fetch("/api/consensus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, model_config: {}, num_runs: 3 }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConsensusResult(data);
    } catch (e: unknown) {
      setConsensusError(e instanceof Error ? e.message : "Consensus request failed");
    } finally {
      setConsensusLoading(false);
    }
  }

  async function handleRunAblation() {
    setAblationLoading(true);
    setAblationError("");
    setAblationSegments([]);

    const answer = result?.full_text || streamText;
    if (!answer) {
      setAblationError("No answer available to ablate.");
      setAblationLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/ablation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, model_config: {} }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAblationSegments(data.segments ?? []);
    } catch (e: unknown) {
      setAblationError(e instanceof Error ? e.message : "Ablation request failed");
    } finally {
      setAblationLoading(false);
    }
  }

  const displayResult = result ?? {
    full_text: streamText,
    token_confidence: streamTokens,
  };

  const claims = useMemo(
    () =>
      extractClaims(
        displayResult.full_text,
        displayResult.token_confidence,
        consensusResult
      ),
    [displayResult.full_text, displayResult.token_confidence, consensusResult]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "answer", label: "Answer" },
    { key: "walkthrough", label: "Walkthrough" },
    { key: "claims", label: "Claims" },
    { key: "consensus", label: "Consensus" },
    { key: "ablation", label: "Ablation" },
  ];

  function renderTabContent() {
    if (!streamText && !result && !loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Submit a question above to see the model&apos;s response here.
          </p>
        </div>
      );
    }

    if (loading && !streamText) {
      return (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      );
    }

    switch (activeTab) {
      case "answer":
        return (
          <div className="whitespace-pre-wrap rounded-md border bg-card p-4 font-sans text-sm leading-relaxed text-card-foreground">
            {displayResult.full_text || (
              <span className="italic text-muted-foreground">Waiting for response...</span>
            )}
          </div>
        );

      case "walkthrough":
        return (
          <div className="rounded-md border bg-card p-4">
            <TraceDisplay tokens={displayResult.token_confidence} />
          </div>
        );

      case "claims":
        return (
          <div className="rounded-md border bg-card p-4">
            <ClaimsView claims={claims} />
          </div>
        );

      case "consensus":
        return (
          <div className="rounded-md border bg-card p-4">
            <ConsensusView
              result={consensusResult}
              loading={consensusLoading}
              error={consensusError}
              onRunConsensus={handleRunConsensus}
            />
          </div>
        );

      case "ablation":
        return (
          <div className="rounded-md border bg-card p-4">
            <AblationView
              segments={ablationSegments}
              loading={ablationLoading}
              error={ablationError}
              onRunAblation={handleRunAblation}
              hasAnswer={!!(result?.full_text || streamText)}
            />
          </div>
        );
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Trace Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Send a question to a local LLM and inspect per-token confidence.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/batch"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            Batch
          </Link>
          <Link
            href="/history"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            History
          </Link>
        </div>
      </header>

      <OnboardingGuide />

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question..."
          disabled={loading}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Streaming..." : "Submit"}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {result?.trace_id && (
        <p className="text-xs text-muted-foreground">
          Trace ID: <code className="font-mono">{result.trace_id}</code>
        </p>
      )}

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

      <div className="min-h-[200px]">{renderTabContent()}</div>
    </div>
  );
}

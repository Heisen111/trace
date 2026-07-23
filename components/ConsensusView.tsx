"use client";

import type { ConsensusResult } from "@/lib/consensus";

interface ConsensusViewProps {
  result: ConsensusResult | null;
  loading: boolean;
  error: string;
  onRunConsensus: () => void;
}

function ClaimBucket({
  title,
  claims,
  emptyLabel,
  color,
}: {
  title: string;
  claims: { text: string; runs: number; totalRuns: number }[];
  emptyLabel: string;
  color: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold" style={{ color }}>
        {title}{" "}
        {claims.length > 0 && (
          <span className="text-muted-foreground font-normal">
            ({claims.length})
          </span>
        )}
      </h3>
      {claims.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {claims.map((c, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm text-card-foreground"
            >
              <span className="flex-1">{c.text}</span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
                style={{
                  backgroundColor: color + "1a",
                  color,
                }}
              >
                {c.runs}/{c.totalRuns}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ConsensusView({
  result,
  loading,
  error,
  onRunConsensus,
}: ConsensusViewProps) {
  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-muted-foreground">
          Run the same question multiple times to find consensus claims.
        </p>
        <button
          onClick={onRunConsensus}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Running consensus..." : "Run Consensus (3×)"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ClaimBucket
        title="Shared Claims"
        claims={result.sharedClaims}
        emptyLabel="No claims shared across all runs."
        color="#16a34a"
      />
      <ClaimBucket
        title="Partial Claims"
        claims={result.partialClaims}
        emptyLabel="No partially-shared claims."
        color="#ca8a04"
      />
      <ClaimBucket
        title="Unique Claims"
        claims={result.uniqueClaims}
        emptyLabel="No unique claims."
        color="#dc2626"
      />
    </div>
  );
}

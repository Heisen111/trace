"use client";

import type { Claim } from "@/lib/claims";

interface ClaimsViewProps {
  claims: Claim[];
}

function riskColor(risk: string): string {
  switch (risk) {
    case "high":
      return "#dc2626";
    case "medium":
      return "#ca8a04";
    case "low":
      return "#ea580c";
    default:
      return "#16a34a";
  }
}

function riskBadge(risk: string) {
  const color = riskColor(risk);
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
      style={{ backgroundColor: color + "1a", color }}
    >
      {risk}
    </span>
  );
}

function agreementColor(agr: number | null): string {
  if (agr === null) return "#6b7280";
  if (agr >= 0.8) return "#16a34a";
  if (agr >= 0.5) return "#ca8a04";
  return "#dc2626";
}

export default function ClaimsView({ claims }: ClaimsViewProps) {
  if (claims.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        No claims could be extracted from the answer.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {claims.map((c, i) => {
        const showAdjusted = c.risk !== c.adjustedRisk;
        return (
          <li
            key={i}
            className="rounded-md border bg-card px-4 py-3 text-sm text-card-foreground"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex-1 leading-relaxed">{c.text}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {showAdjusted && (
                  <>
                    {riskBadge(c.risk)}
                    <span className="text-xs text-muted-foreground">→</span>
                  </>
                )}
                {riskBadge(c.adjustedRisk)}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                avg confidence:{" "}
                <span className="tabular-nums font-medium">
                  {(c.avgProb * 100).toFixed(0)}%
                </span>
              </span>
              <span>
                min confidence:{" "}
                <span className="tabular-nums font-medium">
                  {(c.minProb * 100).toFixed(0)}%
                </span>
              </span>
              <span>
                low-conf tokens:{" "}
                <span className="tabular-nums font-medium">{c.lowTokens}</span>
              </span>
              {c.consensusAgreement !== null && (
                <span>
                  consensus agreement:{" "}
                  <span
                    className="tabular-nums font-medium"
                    style={{ color: agreementColor(c.consensusAgreement) }}
                  >
                    {(c.consensusAgreement * 100).toFixed(0)}%
                  </span>
                </span>
              )}
            </div>

            {c.flaggedEntities.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {c.flaggedEntities.map((e, j) => (
                  <span
                    key={j}
                    className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-xs text-destructive"
                  >
                    {e}
                  </span>
                ))}
                <span className="text-xs text-muted-foreground">
                  (hallucination-prone)
                </span>
              </div>
            )}

            {showAdjusted && (
              <p className="mt-1 text-xs text-muted-foreground">
                {c.adjustedRisk === "safe"
                  ? "Risk lowered — claim appears consistently across consensus runs."
                  : c.adjustedRisk === "low"
                    ? "Risk raised — low consensus agreement."
                    : ""}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import type { TokenData } from "@/lib/types";

function logprobBg(lp: number) {
  const p = Math.exp(Math.max(lp, -10));
  if (p >= 0.9) return "#dcfce7";
  if (p >= 0.7) return "#dbeafe";
  if (p >= 0.5) return "#fef9c3";
  if (p >= 0.2) return "#ffedd5";
  return "#fce8e8";
}

function logprobColor(lp: number) {
  const p = Math.exp(Math.max(lp, -10));
  if (p >= 0.9) return "#16a34a";
  if (p >= 0.7) return "#2563eb";
  if (p >= 0.5) return "#ca8a04";
  if (p >= 0.2) return "#ea580c";
  return "#dc2626";
}

function probPct(lp: number) {
  return (Math.exp(Math.max(lp, -10)) * 100).toFixed(0) + "%";
}

interface TraceDisplayProps {
  tokens: TokenData[];
}

export default function TraceDisplay({ tokens }: TraceDisplayProps) {
  if (!tokens || tokens.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic">
        Token-level confidence data unavailable.
      </p>
    );
  }

  const forks = tokens.filter((t) => {
    const p = Math.exp(Math.max(t.logprob ?? 0, -10));
    return p < 0.3 && t.top_logprobs && t.top_logprobs.length >= 2;
  }).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-0 leading-relaxed">
        {tokens.map((t, i) => {
          const lp = t.logprob ?? 0;
          const bg = logprobBg(lp);
          const color = logprobColor(lp);
          const alternatives = t.top_logprobs?.slice(0, 5) ?? [];

          return (
            <span
              key={i}
              className="relative group cursor-help rounded-sm px-[1px] transition-shadow hover:shadow-md"
              style={{ backgroundColor: bg, color }}
            >
              {t.token}
              {alternatives.length > 0 && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-max max-w-[220px] -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs shadow-lg group-hover:block">
                  <div className="mb-1 font-medium text-foreground">
                    Alternatives
                  </div>
                  <ul className="space-y-0.5">
                    {alternatives.map((alt, j) => (
                      <li key={j} className="flex justify-between gap-3 text-muted-foreground">
                        <span className="truncate font-mono">{alt.token}</span>
                        <span className="shrink-0 tabular-nums">{probPct(alt.logprob)}</span>
                      </li>
                    ))}
                    <li className="border-t pt-0.5 text-foreground/60">
                      chosen: <span className="font-mono">{t.token}</span> —{" "}
                      {probPct(lp)}
                    </li>
                  </ul>
                </div>
              )}
            </span>
          );
        })}
      </div>

      {forks.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Fork Points ({forks.length})
          </h3>
          <ul className="space-y-2">
            {forks.map((f, i) => {
              const topAlts = f.top_logprobs!.slice(0, 3);
              return (
                <li
                  key={i}
                  className="rounded-md border bg-card px-3 py-2 text-sm text-card-foreground"
                >
                  <span className="font-mono font-medium">&ldquo;{f.token}&rdquo;</span>{" "}
                  was torn between{" "}
                  {topAlts.map((alt, j) => (
                    <span key={j}>
                      <span className="font-mono">&ldquo;{alt.token}&rdquo;</span>{" "}
                      <span className="text-muted-foreground">
                        ({probPct(alt.logprob)})
                      </span>
                      {j < topAlts.length - 1 && ", "}
                    </span>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

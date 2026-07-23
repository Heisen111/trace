import type { TokenData } from "./types";
import type { ConsensusResult } from "./consensus";

export interface Claim {
  text: string;
  avgProb: number;
  minProb: number;
  lowTokens: number;
  criticalTokens: number;
  risk: "safe" | "low" | "medium" | "high";
  adjustedRisk: "safe" | "low" | "medium" | "high";
  flaggedEntities: string[];
  tokenCount: number;
  consensusAgreement: number | null;
}

function wordOverlap(s1: string, s2: string): number {
  const words1 = s1.toLowerCase().split(/\W+/).filter(Boolean);
  const words2 = s2.toLowerCase().split(/\W+/).filter(Boolean);
  if (words1.length === 0 || words2.length === 0) return 0;
  const set2 = new Set(words2);
  let inter = 0;
  for (let i = 0; i < words1.length; i++) {
    if (set2.has(words1[i])) inter++;
  }
  return inter / Math.min(words1.length, words2.length);
}

const RISK_LEVELS: Record<string, number> = { safe: 0, low: 1, medium: 2, high: 3 };
const RISK_NAMES: ("safe" | "low" | "medium" | "high")[] = ["safe", "low", "medium", "high"];

function adjustRiskByConsensus(
  risk: Claim["risk"],
  agreement: number | null
): Claim["risk"] {
  if (agreement === null) return risk;
  const level = RISK_LEVELS[risk];

  if (agreement >= 0.8 && level > 0) {
    return RISK_NAMES[level - 1];
  }
  if (agreement <= 0.2 && level === 0) {
    return "low";
  }
  return risk;
}

function findBestConsensusMatch(
  text: string,
  claims: { text: string; runs: number; totalRuns: number }[]
): { agreement: number; runs: number; totalRuns: number } | null {
  let bestSim = 0;
  let best: { runs: number; totalRuns: number } | null = null;

  for (const c of claims) {
    const sim = wordOverlap(text, c.text);
    if (sim > bestSim) {
      bestSim = sim;
      best = { runs: c.runs, totalRuns: c.totalRuns };
    }
  }

  if (!best || bestSim < 0.3) return null;
  return { agreement: best.runs / best.totalRuns, ...best };
}

export function extractClaims(
  text: string,
  logprobs: TokenData[],
  consensusResult?: ConsensusResult | null
): Claim[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  const sentences: { text: string; start: number; end: number }[] = [];
  let pos = 0;
  for (const p of parts) {
    const t = p.trim();
    if (t.length < 3) {
      pos += p.length;
      continue;
    }
    sentences.push({ text: t, start: pos, end: pos + p.length });
    pos += p.length;
  }

  let tPos = 0;
  const tokenMap = (logprobs || []).map((t) => {
    const s = tPos;
    const tokenText = t.token || "";
    tPos += tokenText.length;
    return { ...t, charStart: s, charEnd: tPos };
  });

  const allConsensus: { text: string; runs: number; totalRuns: number }[] = [];
  if (consensusResult) {
    allConsensus.push(
      ...consensusResult.sharedClaims,
      ...consensusResult.partialClaims,
      ...consensusResult.uniqueClaims
    );
  }

  const claims: Claim[] = [];

  for (const sent of sentences) {
    const tokens = tokenMap.filter(
      (t) => t.charStart >= sent.start && t.charEnd <= sent.end
    );
    if (tokens.length === 0) continue;

    const probs = tokens.map((t) =>
      Math.exp(Math.max(t.logprob ?? 0, -10))
    );
    const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length;
    const minProb = Math.min(...probs);
    const lowTokens = tokens.filter(
      (t) => Math.exp(Math.max(t.logprob ?? 0, -10)) < 0.5
    );
    const criticalTokens = tokens.filter(
      (t) => Math.exp(Math.max(t.logprob ?? 0, -10)) < 0.2
    );

    let risk: Claim["risk"] = "safe";
    if (criticalTokens.length > 0) risk = "high";
    else if (lowTokens.length > 1) risk = "medium";
    else if (lowTokens.length === 1) risk = "low";

    const flaggedEntities: string[] = [];
    for (const t of lowTokens) {
      const w = t.token || "";
      if (/\d/.test(w) || (w.length > 1 && /^[A-Z]/.test(w)))
        flaggedEntities.push(w.trim());
    }

    let consensusAgreement: number | null = null;
    if (allConsensus.length > 0) {
      const match = findBestConsensusMatch(sent.text, allConsensus);
      consensusAgreement = match ? match.agreement : 0;
    }

    const adjustedRisk = adjustRiskByConsensus(risk, consensusAgreement);

    claims.push({
      text: sent.text,
      avgProb,
      minProb,
      lowTokens: lowTokens.length,
      criticalTokens: criticalTokens.length,
      risk,
      adjustedRisk,
      flaggedEntities,
      tokenCount: tokens.length,
      consensusAgreement,
    });
  }

  return claims;
}

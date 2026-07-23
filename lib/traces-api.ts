import type { TokenData } from "./types";

export interface RiskSummary {
  avgProb: number;
  lowCount: number;
  criticalCount: number;
  risk: "safe" | "low" | "medium" | "high" | "unknown";
}

export interface TraceListItem {
  id: string;
  question: string;
  model: string;
  created_at: string;
  riskSummary: RiskSummary;
  tokenCount: number;
}

export interface TraceDetail {
  id: string;
  question: string;
  model_config: Record<string, unknown>;
  created_at: string;
  answer_text: string;
  token_confidence: TokenData[];
  claims: string[];
  consensus_answers: string[];
  ablation_results: Record<string, unknown>;
}

export function computeRiskSummary(
  tokenConfidence: TokenData[]
): RiskSummary {
  if (!tokenConfidence || tokenConfidence.length === 0) {
    return { avgProb: 0, lowCount: 0, criticalCount: 0, risk: "unknown" };
  }
  const probs = tokenConfidence.map((t) =>
    Math.exp(Math.max(t.logprob ?? 0, -10))
  );
  const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length;
  const lowCount = probs.filter((p) => p < 0.5).length;
  const criticalCount = probs.filter((p) => p < 0.2).length;
  let risk: RiskSummary["risk"];
  if (criticalCount >= 1) risk = "high";
  else if (lowCount >= 3) risk = "medium";
  else if (lowCount >= 1) risk = "low";
  else risk = "safe";
  return { avgProb, lowCount, criticalCount, risk };
}

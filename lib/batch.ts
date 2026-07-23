import type { TokenData } from "./types";
import type { Claim } from "./claims";
import { extractClaims } from "./claims";

export interface BatchQuestionResult {
  question: string;
  answer_text: string;
  token_confidence: TokenData[];
  claims: Claim[];
  avgConfidence: number;
  lowConfCount: number;
  criticalConfCount: number;
  confidenceStdDev: number;
  error?: string;
}

export interface BatchAggregate {
  totalQuestions: number;
  completedCount: number;
  errorCount: number;
  overallAvgConfidence: number;
  totalHighRiskClaims: number;
  mostInconsistent: { question: string; stdDev: number } | null;
}

export interface BatchState {
  results: BatchQuestionResult[];
  currentIndex: number;
  running: boolean;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export async function processQuestion(
  question: string,
  signal?: AbortSignal
): Promise<BatchQuestionResult> {
  let fullText = "";
  const allTokens: TokenData[] = [];

  const res = await fetch("/api/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, model_config: {} }),
    signal,
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
        if (data.error) throw new Error(data.error);
        if (data.done) {
          fullText = data.full_text;
          allTokens.push(...(data.token_confidence ?? []));
        } else if (data.token) {
          fullText += data.token;
          if (data.logprobs?.length) {
            allTokens.push(...data.logprobs);
          }
        }
      } catch {}
    }
  }

  const probs = allTokens.map((t) =>
    Math.exp(Math.max(t.logprob ?? 0, -10))
  );
  const avgConfidence =
    probs.length > 0
      ? probs.reduce((a, b) => a + b, 0) / probs.length
      : 0;
  const lowConfCount = probs.filter((p) => p < 0.5).length;
  const criticalConfCount = probs.filter((p) => p < 0.2).length;
  const confidenceStdDev = stdDev(probs);

  const claims = extractClaims(fullText, allTokens);

  return {
    question,
    answer_text: fullText,
    token_confidence: allTokens,
    claims,
    avgConfidence,
    lowConfCount,
    criticalConfCount,
    confidenceStdDev,
  };
}

export function computeAggregate(
  results: BatchQuestionResult[]
): BatchAggregate {
  const completed = results.filter((r) => !r.error);
  const errors = results.filter((r) => r.error);

  const allProbs = completed.flatMap((r) =>
    r.token_confidence.map((t) => Math.exp(Math.max(t.logprob ?? 0, -10)))
  );
  const overallAvgConfidence =
    allProbs.length > 0
      ? allProbs.reduce((a, b) => a + b, 0) / allProbs.length
      : 0;

  const totalHighRiskClaims = completed.reduce(
    (sum, r) => sum + r.claims.filter((c) => c.adjustedRisk === "high").length,
    0
  );

  let mostInconsistent: { question: string; stdDev: number } | null = null;
  for (const r of completed) {
    if (
      !mostInconsistent ||
      r.confidenceStdDev > mostInconsistent.stdDev
    ) {
      mostInconsistent = {
        question: r.question,
        stdDev: r.confidenceStdDev,
      };
    }
  }

  return {
    totalQuestions: results.length,
    completedCount: completed.length,
    errorCount: errors.length,
    overallAvgConfidence,
    totalHighRiskClaims,
    mostInconsistent,
  };
}

import { getEmbedding, cosineSimilarity } from "./embedding";

const DEFAULT_ENDPOINT = "http://localhost:11434/v1/chat/completions";
const SIMILARITY_THRESHOLD = 0.7;

interface ModelConfig {
  endpoint?: string;
  model?: string;
  temperature?: number;
}

interface ClaimCluster {
  text: string;
  runIndices: Set<number>;
  embedding: number[];
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

async function callModelOnce(
  question: string,
  config: ModelConfig,
  temperature: number
): Promise<string> {
  const endpoint = config.endpoint || DEFAULT_ENDPOINT;
  const model = config.model || "qwen2.5:3b";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: question }],
      temperature,
      max_tokens: 2048,
      stream: false,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function clusterSentences(
  sentences: { text: string; runIndex: number; embedding: number[] }[]
): ClaimCluster[] {
  const clusters: ClaimCluster[] = [];

  for (const s of sentences) {
    let bestIdx = -1;
    let bestSim = 0;

    for (let i = 0; i < clusters.length; i++) {
      const sim = cosineSimilarity(s.embedding, clusters[i].embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestSim >= SIMILARITY_THRESHOLD) {
      clusters[bestIdx].runIndices.add(s.runIndex);
      if (s.text.length > clusters[bestIdx].text.length) {
        clusters[bestIdx].text = s.text;
        clusters[bestIdx].embedding = s.embedding;
      }
    } else {
      clusters.push({
        text: s.text,
        runIndices: new Set([s.runIndex]),
        embedding: s.embedding,
      });
    }
  }

  return clusters;
}

export interface ConsensusResult {
  sharedClaims: { text: string; runs: number; totalRuns: number }[];
  partialClaims: { text: string; runs: number; totalRuns: number }[];
  uniqueClaims: { text: string; runs: number; totalRuns: number }[];
}

export async function runConsensus(
  question: string,
  modelConfig: ModelConfig,
  numRuns: number
): Promise<ConsensusResult> {
  const answers = await Promise.all(
    Array.from({ length: numRuns }, () =>
      callModelOnce(question, modelConfig, 0.8)
    )
  );

  const allSentences: { text: string; runIndex: number; embedding: number[] }[] = [];

  for (let i = 0; i < answers.length; i++) {
    const sents = splitSentences(answers[i]);
    for (const text of sents) {
      const embedding = await getEmbedding(text);
      allSentences.push({ text, runIndex: i, embedding });
    }
  }

  const clusters = clusterSentences(allSentences);

  const sharedClaims: ConsensusResult["sharedClaims"] = [];
  const partialClaims: ConsensusResult["partialClaims"] = [];
  const uniqueClaims: ConsensusResult["uniqueClaims"] = [];

  for (const c of clusters) {
    const runCount = c.runIndices.size;
    const entry = { text: c.text, runs: runCount, totalRuns: numRuns };

    if (runCount === numRuns) {
      sharedClaims.push(entry);
    } else if (runCount > 1) {
      partialClaims.push(entry);
    } else {
      uniqueClaims.push(entry);
    }
  }

  return { sharedClaims, partialClaims, uniqueClaims };
}

import { getEmbedding, cosineSimilarity } from "./embedding";

const DEFAULT_ENDPOINT = "http://localhost:11434/v1/chat/completions";

interface ModelConfig {
  endpoint?: string;
  model?: string;
  temperature?: number;
}

export interface AblationResultItem {
  segment: string;
  ablated_question: string;
  ablated_answer: string;
  embedding_similarity: number | null;
  llm_verdict_changed: boolean | null;
  load_bearing: boolean;
  error?: string;
}

export function segmentQuestion(q: string): string[] {
  const segments: string[] = [];
  const sentences = q.split(/[.!?]+\s*/).filter((s) => s.trim().length > 5);
  if (sentences.length >= 2) {
    for (const s of sentences) {
      const t = s.trim();
      if (t.length > 5) segments.push(t);
    }
  } else {
    const clauses = q
      .split(/\s*(?:,|\band\b|\bor\b|\bbut\b)\s*/)
      .filter((s) => s.trim().length > 5);
    if (clauses.length >= 2) {
      for (const c of clauses) segments.push(c.trim());
    } else {
      const mid = Math.floor(q.length / 2);
      let split = q.lastIndexOf(" ", mid);
      if (split < 10) split = q.indexOf(" ", mid);
      if (split > 0 && split < q.length - 5) {
        segments.push(q.slice(0, split).trim());
        segments.push(q.slice(split).trim());
      }
    }
  }
  return segments.slice(0, 3);
}

async function callModel(
  question: string,
  config: ModelConfig
): Promise<string> {
  const endpoint = config.endpoint || DEFAULT_ENDPOINT;
  const model = config.model || "qwen2.5:3b";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: question }],
      temperature: config.temperature ?? 0.3,
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

async function llmVerdict(
  question: string,
  ablatedQuestion: string,
  originalAnswer: string,
  ablatedAnswer: string
): Promise<boolean | null> {
  const prompt = `Original question: "${question}"

Modified question (one part removed): "${ablatedQuestion}"

Original answer: "${originalAnswer}"

Answer after removing that part: "${ablatedAnswer}"

Did removing this part change the MAIN CONCLUSION or CORE CLAIM of the answer? Reply ONLY "YES" (conclusion changed) or "NO" (same conclusion).`;

  try {
    const model = "qwen2.5:3b";
    const res = await fetch(DEFAULT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 10,
        stream: false,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const verdict = (data.choices?.[0]?.message?.content || "")
      .trim()
      .toUpperCase();
    return verdict.startsWith("YES");
  } catch {
    return null;
  }
}

export interface AblationOutput {
  segments: AblationResultItem[];
}

export async function runAblation(
  question: string,
  originalAnswer: string,
  modelConfig: ModelConfig
): Promise<AblationOutput> {
  const segments = segmentQuestion(question);
  if (segments.length === 0) {
    return { segments: [] };
  }

  const originalEmbedding = await getEmbedding(originalAnswer);
  const items: AblationResultItem[] = [];

  for (const seg of segments) {
    const ablated = question
      .replace(seg, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!ablated || ablated.length < 3) {
      items.push({
        segment: seg,
        ablated_question: ablated,
        ablated_answer: "",
        embedding_similarity: null,
        llm_verdict_changed: null,
        load_bearing: false,
        error: "Removed segment leaves empty question",
      });
      continue;
    }

    let ablatedAnswer = "";
    try {
      ablatedAnswer = await callModel(ablated, modelConfig);
    } catch (e: unknown) {
      items.push({
        segment: seg,
        ablated_question: ablated,
        ablated_answer: "",
        embedding_similarity: null,
        llm_verdict_changed: null,
        load_bearing: true,
        error: e instanceof Error ? e.message : "Model call failed",
      });
      continue;
    }

    let embedding_similarity: number | null = null;
    let llm_verdict_changed: boolean | null = null;

    try {
      const emb = await getEmbedding(ablatedAnswer);
      embedding_similarity = cosineSimilarity(originalEmbedding, emb);
    } catch {
      embedding_similarity = null;
    }

    llm_verdict_changed = await llmVerdict(
      question,
      ablated,
      originalAnswer,
      ablatedAnswer
    );

    const load_bearing =
      (embedding_similarity !== null && embedding_similarity < 0.6) ||
      llm_verdict_changed === true;

    items.push({
      segment: seg,
      ablated_question: ablated,
      ablated_answer: ablatedAnswer,
      embedding_similarity,
      llm_verdict_changed,
      load_bearing,
    });
  }

  return { segments: items };
}

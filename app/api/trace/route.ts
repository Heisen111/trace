import { prisma } from "@/lib/prisma";

const DEFAULT_ENDPOINT = "http://localhost:11434/v1/chat/completions";

interface ModelConfig {
  endpoint?: string;
  model?: string;
  temperature?: number;
}

interface TraceRequestBody {
  question: string;
  model_config: ModelConfig;
}

interface TokenData {
  token: string;
  logprob: number;
  top_logprobs: { token: string; logprob: number }[];
}

interface RawLogprobToken {
  token?: string;
  logprob?: number;
  top_logprobs?: { token?: string; logprob?: number }[];
  bytes?: number[] | null;
}

function extractTokens(logprobsContent: RawLogprobToken[] | RawLogprobToken | null | undefined): TokenData[] {
  if (!logprobsContent) return [];
  const entries = Array.isArray(logprobsContent) ? logprobsContent : [logprobsContent];
  return entries.map((raw) => ({
    token: raw.token ?? "",
    logprob: raw.logprob ?? 0,
    top_logprobs: (raw.top_logprobs ?? []).map((t) => ({
      token: t.token ?? "",
      logprob: t.logprob ?? 0,
    })),
  }));
}

export async function POST(req: Request) {
  const body: TraceRequestBody = await req.json();
  const { question, model_config } = body;
  const endpoint = model_config.endpoint || DEFAULT_ENDPOINT;
  const model = model_config.model || "qwen2.5:3b";
  const temperature = model_config.temperature ?? 0;

  const trace = await prisma.trace.create({
    data: { question, model_config: JSON.parse(JSON.stringify(model_config)) },
  });

  const apiBody = {
    model,
    messages: [{ role: "user", content: question }],
    temperature,
    max_tokens: 2048,
    stream: true,
    logprobs: true,
    top_logprobs: 3,
  };

  let fullText = "";
  const allTokens: TokenData[] = [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiBody),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let done = false;

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data: ")) continue;
            const payload = t.slice(6).trim();
            if (payload === "[DONE]") { done = true; break; }
            try {
              const chunk = JSON.parse(payload);
              const choice = chunk.choices?.[0];
              if (!choice) continue;
              const delta = choice.delta?.content || "";
              const lp = choice.logprobs?.content || null;
              if (delta) {
                const tokens = extractTokens(lp);
                allTokens.push(...tokens);
                fullText += delta;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token: delta, logprobs: tokens })}\n\n`)
                );
              }
              if (choice.finish_reason) { done = true; break; }
            } catch {}
          }
          if (done) break;
        }

        await prisma.traceResult.create({
          data: {
            trace_id: trace.id,
            answer_text: fullText,
            token_confidence: JSON.parse(JSON.stringify(allTokens)),
            claims: [],
            consensus_answers: [],
            ablation_results: {},
          },
        });

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            done: true,
            trace_id: trace.id,
            full_text: fullText,
            token_confidence: allTokens,
          })}\n\n`)
        );
        controller.close();
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

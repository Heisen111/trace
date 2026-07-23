import { prisma } from "@/lib/prisma";
import type { TokenData } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const trace = await prisma.trace.findUnique({
      where: { id: params.id },
      include: { result: true },
    });

    if (!trace) {
      return Response.json({ error: "Trace not found" }, { status: 404 });
    }

    const cfg =
      typeof trace.model_config === "string"
        ? JSON.parse(trace.model_config)
        : trace.model_config;

    return Response.json({
      id: trace.id,
      question: trace.question,
      model_config: cfg,
      created_at: trace.created_at.toISOString(),
      answer_text: trace.result?.answer_text ?? "",
      token_confidence: (trace.result?.token_confidence ?? []) as unknown as TokenData[],
      claims: (trace.result?.claims ?? []) as unknown as string[],
      consensus_answers: (trace.result?.consensus_answers ?? []) as unknown as string[],
      ablation_results: (trace.result?.ablation_results ?? {}) as unknown as Record<
        string,
        unknown
      >,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to fetch trace";
    return Response.json({ error: msg }, { status: 500 });
  }
}

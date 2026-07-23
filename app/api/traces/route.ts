import { prisma } from "@/lib/prisma";
import { computeRiskSummary } from "@/lib/traces-api";
import type { TraceListItem } from "@/lib/traces-api";
import type { TokenData } from "@/lib/types";

export async function GET() {
  try {
    const traces = await prisma.trace.findMany({
      orderBy: { created_at: "desc" },
      include: { result: true },
    });

    const items: TraceListItem[] = traces.map((t) => {
      const cfg =
        typeof t.model_config === "string"
          ? JSON.parse(t.model_config)
          : (t.model_config as Record<string, unknown>);
      const model = (cfg?.model as string) || "unknown";

      const rawTokens = t.result?.token_confidence;
      const riskSummary = rawTokens
        ? computeRiskSummary(rawTokens as unknown as TokenData[])
        : { avgProb: 0, lowCount: 0, criticalCount: 0, risk: "unknown" as const };

      const tokenCount = Array.isArray(rawTokens)
        ? rawTokens.length
        : 0;

      return {
        id: t.id,
        question: t.question,
        model: model as string,
        created_at: t.created_at.toISOString(),
        riskSummary,
        tokenCount,
      };
    });

    return Response.json({ traces: items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to fetch traces";
    return Response.json({ error: msg }, { status: 500 });
  }
}

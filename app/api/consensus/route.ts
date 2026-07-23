import { runConsensus } from "@/lib/consensus";

export async function POST(req: Request) {
  const body = await req.json();
  const { question, model_config, num_runs = 3 } = body;

  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const result = await runConsensus(question, model_config || {}, num_runs);
    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Consensus failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

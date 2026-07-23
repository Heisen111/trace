import { runAblation } from "@/lib/ablation";

export async function POST(req: Request) {
  const body = await req.json();
  const { question, answer, model_config } = body;

  if (!question || !answer) {
    return Response.json(
      { error: "question and answer are required" },
      { status: 400 }
    );
  }

  try {
    const result = await runAblation(question, answer, model_config || {});
    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Ablation failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

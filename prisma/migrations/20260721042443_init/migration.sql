-- CreateTable
CREATE TABLE "Trace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "model_config" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TraceResult" (
    "trace_id" TEXT NOT NULL PRIMARY KEY,
    "answer_text" TEXT NOT NULL,
    "token_confidence" JSONB NOT NULL,
    "claims" JSONB NOT NULL,
    "consensus_answers" JSONB NOT NULL,
    "ablation_results" JSONB NOT NULL,
    CONSTRAINT "TraceResult_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "Trace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

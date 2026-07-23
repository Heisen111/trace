# Trace Dashboard — LLM Response Inspector

A Next.js app that streams LLM responses token-by-token and analyzes them from multiple angles: per-token confidence coloring, claim extraction with risk scoring, consensus clustering (multi-run), and ablation testing (segment removal).

## Architecture

```
User → page.tsx → /api/trace (SSE) → Ollama → SQLite
                         ↓
              ┌── Answer (raw text)
              ├── Walkthrough (colored tokens)
              ├── Claims (extracted facts + risk)
              ├── Consensus (3× run → shared/unique claims)
              └── Ablation (segment removal → load-bearing flags)
```

- **Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma 7 + SQLite
- **LLM Backend:** Ollama (default `http://localhost:11434/v1/chat/completions`), model `qwen2.5:3b`
- **Embeddings:** Transformers.js (`all-MiniLM-L6-v2`) runs server-side for cosine similarity

## Prerequisites

1. [Ollama](https://ollama.com) installed and running
2. Pull a model: `ollama pull qwen2.5:3b`

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run Prisma migration + start dev server (one command)
npm run setup
```

This creates the SQLite database (`prisma/dev.db`) and starts the dev server at `http://localhost:3000`.

If you prefer separate steps:

```bash
npx prisma migrate dev
npm run dev
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main page — ask a question, see the streamed response, inspect via 5 tabs |
| `/history` | Past traces stored in SQLite, sorted by date with risk badges |
| `/trace/[id]` | Full trace detail — re-run consensus/ablation, export as HTML |
| `/batch` | Paste many questions, run sequentially, see aggregate stats |

## Tabs

| Tab | What it shows |
|-----|---------------|
| **Answer** | Raw model response as plain text |
| **Walkthrough** | Every token colored by log-probability confidence. Hover to see alternatives. |
| **Claims** | Sentences extracted as claims with risk scores (safe/low/medium/high). Low-confidence tokens and consensus disagreement raise risk. |
| **Consensus** | Runs the same question 3 more times at temperature 0.8, clusters sentences by embedding similarity → shared, partial, and unique claims. |
| **Ablation** | Removes each segment of the question one at a time, reruns the model, and measures how much the answer changes (embedding similarity + LLM-as-judge). Load-bearing segments are flagged. |

## Scripts

```bash
npm run setup    # Prisma migrate + dev server (one command)
npm run dev      # Start dev server only
npm run build    # Production build
npm run lint     # Run ESLint
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── trace/route.ts         # SSE streaming endpoint
│   │   ├── consensus/route.ts     # Multi-run consensus
│   │   ├── ablation/route.ts      # Segment ablation
│   │   ├── traces/route.ts        # List all traces
│   │   └── traces/[id]/route.ts   # Single trace detail
│   ├── page.tsx                   # Main dashboard
│   ├── history/page.tsx           # History list
│   ├── trace/[id]/page.tsx        # Trace detail page
│   └── batch/page.tsx             # Batch mode
├── components/
│   ├── TraceDisplay.tsx           # Token walkthrough
│   ├── ClaimsView.tsx             # Claim cards
│   ├── ConsensusView.tsx          # Consensus buckets
│   ├── AblationView.tsx           # Ablation cards
│   ├── ErrorBoundary.tsx          # Error boundary
│   ├── LoadingSkeleton.tsx        # Skeleton loaders
│   └── OnboardingGuide.tsx        # First-time help
├── lib/
│   ├── claims.ts                  # Claim extraction + risk
│   ├── consensus.ts               # Consensus logic
│   ├── ablation.ts                # Ablation logic
│   ├── embedding.ts               # Transformers.js pipeline
│   ├── batch.ts                   # Batch processing
│   ├── export.ts                  # HTML export
│   ├── prisma.ts                  # Prisma client
│   └── types.ts                   # Shared types
└── prisma/
    └── schema.prisma              # Trace + TraceResult models
```

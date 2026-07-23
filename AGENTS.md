# Trace Dashboard — Project Context

## Stack
- **Next.js 14** App Router + TypeScript
- **Tailwind CSS** with shadcn/ui styling (CSS variables theming)
- **Prisma 7** with **SQLite** via `@prisma/adapter-libsql`
- **@xenova/transformers** for embedding similarity (all-MiniLM-L6-v2)
- **Ollama** default endpoint: `http://localhost:11434/v1/chat/completions`
- **Default model**: `qwen2.5:3b`

## Key Files

| File | Purpose |
|------|---------|
| `app/api/trace/route.ts` | POST — streams LLM response with logprobs, saves Trace + TraceResult to DB |
| `app/api/consensus/route.ts` | POST — runs question N times (temp 0.8), embeds sentences, clusters by cosine sim → shared/partial/unique buckets |
| `app/api/ablation/route.ts` | POST — segments question, reruns with each segment removed, scores via embedding sim + LLM verdict → load-bearing flags |
| `app/api/traces/route.ts` | GET — list all traces with risk summary |
| `app/api/traces/[id]/route.ts` | GET — full trace detail with result |
| `app/page.tsx` | Main UI — question input, SSE stream, 5 tabs, links to Batch & History |
| `app/batch/page.tsx` | Batch mode — paste multiple questions, run sequentially, see aggregate stats |
| `app/history/page.tsx` | History list page — past traces sorted by date |
| `app/trace/[id]/page.tsx` | Trace detail page — full review with all tabs + Export HTML button |
| `lib/export.ts` | Standalone HTML generator for sharing a trace |
| `lib/batch.ts` | Batch processing — per-question SSE fetch + aggregate stats computation |
| `components/TraceDisplay.tsx` | Token walkthrough with confidence coloring and hover tooltips |
| `components/ConsensusView.tsx` | Bucketed claims with run-fraction badges |
| `components/AblationView.tsx` | Ablation results with similarity scores, LLM verdicts, load-bearing flags |
| `components/ClaimsView.tsx` | Claim extraction display with risk badges and consensus agreement |
| `components/ErrorBoundary.tsx` | React error boundary wrapping the app — catches render errors with retry button |
| `components/LoadingSkeleton.tsx` | Reusable skeleton loaders: `SkeletonCard`, `SkeletonTraceDetail`, `SkeletonList`, `SkeletonBatchProgress` |
| `components/OnboardingGuide.tsx` | First-time user guide explaining each tab, shown once via localStorage |
| `lib/prisma.ts` | Prisma client singleton (libSQL adapter) |
| `lib/embedding.ts` | Transformers.js pipeline + cosine similarity |
| `lib/claims.ts` | Claim extraction + risk scoring (token confidence + consensus agreement) |
| `lib/consensus.ts` | Consensus logic: N model calls, sentence split, embedding clustering |
| `lib/traces-api.ts` | Shared types + risk summary computation for trace list |
| `lib/ablation.ts` | Ablation logic: segment question, per-segment model calls, combined scoring |
| `lib/types.ts` | Shared TokenData type |
| `prisma/schema.prisma` | Trace + TraceResult models |
| `next.config.mjs` | Server external packages for native Node addons |
| `components.json` | shadcn/ui configuration |
| `.env` | `DATABASE_URL="file:./dev.db"` |

## Database Schema

- **Trace**: `id` (cuid), `question`, `model_config` (JSON), `created_at`
- **TraceResult**: `trace_id` (PK/FK), `answer_text`, `token_confidence` (JSON), `claims` (JSON), `consensus_answers` (JSON), `ablation_results` (JSON)

## Available Scripts
- `npm run setup` — Prisma migrate + dev server (one-command setup for new clones)
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npx prisma studio` — browse SQLite DB
- `npx prisma migrate dev` — apply schema changes

## Consensus Flow
1. User clicks "Run Consensus (3×)" in Consensus tab
2. Server calls model 3× at temp 0.8
3. Answers split into sentences, each embedded via Transformers.js
4. Sentences clustered by cosine similarity (threshold 0.7)
5. Output: shared claims (3/3), partial (2/3), unique (1/3)

## Ablation Flow
1. User clicks "Run Ablation" in Ablation tab
2. Question segmented (sentences → clauses → forced split, max 3)
3. For each segment: remove it, call model on ablated question
4. Compute embedding cosine similarity between original and ablated answers
5. Run LLM-as-judge (YES/NO on conclusion change)
6. Combined: `load_bearing = similarity < 0.6 OR verdict == YES`

## Claims Flow
1. Claims extracted automatically from answer text + token logprobs (client-side)
2. Each sentence becomes a claim; token-level confidence averaged per claim
3. Base risk: `high` (any token <20%), `medium` (2+ tokens <50%), `low` (1 token <50%), `safe`
4. Consensus agreement incorporated as second signal (word-overlap matching against consensus result)
5. If agreement >= 80%: risk downgraded one level
6. If agreement <= 20% and risk was `safe`: upgraded to `low`
7. Flagged entities: numbers and capitalized words in low-confidence tokens (hallucination-prone)

## Batch Mode
- `/batch` — paste multiple questions (one per line), run sequentially
- Each question calls `/api/trace` with SSE streaming, collects tokens + claims
- Progress bar + per-question status (done/running/error)
- Aggregate view shows:
  - **Average confidence** across all tokens in all traces
  - **High-risk claim count** (claims with `adjustedRisk === "high"`)
  - **Most inconsistent question** — highest standard deviation of token confidences
- Stop button to abort mid-run

## History & Trace Detail Pages
- `/history` — lists all past traces from SQLite sorted by date (newest first)
  - Each entry shows: question (truncated), model name, date, risk badge (safe/low/medium/high), average confidence %, low/critical token counts
  - Risk summary computed from token_confidence: `risk = critical>=1 → high, low>=3 → medium, low>=1 → low, else safe`
  - Click any trace to open its detail page
- `/trace/[id]` — full trace review with all 5 tabs (Answer, Walkthrough, Claims, Consensus, Ablation)
  - Consensus and Ablation can be re-run from the detail page
  - **Export HTML** button downloads a standalone self-contained HTML file (inline CSS, no JS or external deps)
  - Answers stored in SQLite persist across sessions

## UX Features
- **Error Boundary** — `components/ErrorBoundary.tsx` wraps `app/layout.tsx`; catches any render crash, shows error + retry button
- **Loading Skeletons** — `components/LoadingSkeleton.tsx` provides `SkeletonCard`, `SkeletonTraceDetail`, `SkeletonList`, and `SkeletonBatchProgress`; used in history, trace detail, and main page while data loads
- **Empty States** — every list/view shows a contextual empty message (e.g. "No traces yet", "No claims extracted", "Paste at least one question")
- **Mobile Responsiveness** — tab bars use `overflow-x-auto` with `min-w-max` for horizontal scroll; result rows use `flex-wrap`; content uses `p-4 sm:p-8` padding
- **Onboarding Guide** — `components/OnboardingGuide.tsx` shown on first visit (tracked via localStorage); explains all 5 tabs in a compact grid, dismissed permanently
- **README.md** — full project doc with architecture diagram, prerequisites, quick start, page reference, tab explanations, and project structure

## Trace Route (SSE Protocol)
- Each token: `data: {"token":"...","logprobs":[...]}`
- Completion: `data: {"done":true,"trace_id":"...","full_text":"...","token_confidence":[...]}`
- Error: `data: {"error":"..."}`

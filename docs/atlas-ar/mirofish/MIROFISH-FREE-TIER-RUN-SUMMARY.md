# MiroFish on Free Tier — Full Run Summary

**Project:** Atlas AR GTM prediction  
**Date:** June 2026  
**Simulation ID:** `sim_4fa4b86a352a` · **Project ID:** `proj_74a5fa4cd43e`

---

## Goal

Run a **live MiroFish prediction** for Atlas AR: seed → graph → simulation → report, using free or low-cost LLM APIs.

---

## Steps Completed

| Step | Status | Notes |
|------|--------|-------|
| Clone MiroFish to `d:\AI\agency-agents\MiroFish` | Done | From GitHub |
| Install deps (Node + Python) | Done | `pip` failed on Windows; fixed with **uv sync** (~132 packages) |
| Configure `.env` (Zep + LLM keys) | Done | Zep key worked throughout |
| Seed upload + ontology generation | Done | After fixes (see obstacles) |
| Graph build | Done | ~7 minutes |
| Agent preparation | Done | ~3 minutes |
| **40-round simulation** | Done | Completed on backend |
| **Report generation** | **Not finished** | Blocked by LLM quotas |

---

## Models Used

### Simulation (steps 1–5) — COMPLETED

| Model | Provider | Result |
|-------|----------|--------|
| `gemini-2.0-flash` | Google Gemini | **Blocked** — free tier quota = 0 for this model |
| **`gemini-2.5-flash`** | Google Gemini | **Used to complete full simulation** |
| Second Gemini key | Google Gemini | Works for single calls; **blocked for report** (20 req/day limit) |

### Report only (step 6) — ALL BLOCKED

| Model | Provider | Result |
|-------|----------|--------|
| `gemini-2.5-flash` | Gemini | 20 requests/day free limit |
| `gemini-2.5-flash-lite` | Gemini | Same daily limit |
| `openai/gpt-4o-mini` | OpenRouter | **402 — no credits purchased** |
| `meta-llama/llama-3.2-3b-instruct:free` | OpenRouter | Upstream rate limits (429) |
| `openrouter/free` | OpenRouter | **Best progress** (~14 min into report), then daily + per-minute limits |
| `nvidia/nemotron-3-nano-30b-a3b:free` | OpenRouter | JSON works; used as fallback |
| `nvidia/nemotron-nano-9b-v2:free` | OpenRouter | Often returns empty content |
| `nvidia/llama-nemotron-rerank-vl-1b-v2:free` | OpenRouter | **Wrong model type** — reranker only, not chat |

---

## Obstacles (Chronological)

### 1. Setup and environment

- **Missing LLM key** — Zep alone is not enough; MiroFish needs an OpenAI-compatible LLM for every step.
- **`pip install` failed on Windows** — `camel-oasis` not available via pip; fixed with **uv sync**.
- **No Docker** — native Windows path required `uv`.
- **Backend would not start from script** — health check used wrong URL; fixed to `http://127.0.0.1:5001/health`.
- **Duplicate processes on port 5001** — old backends kept stale model config until killed.

### 2. Gemini (simulation + early report attempts)

- **`gemini-2.0-flash`**: free tier limit = **0** → switched to `gemini-2.5-flash`.
- **Ontology JSON truncated** at 4096 tokens → increased to **16384** in `ontology_generator.py`.
- **Simulation timeout in client script** — simulation actually **finished on backend**; client poll limit was too short (~30 min).
- **Gemini free tier**: **20 LLM requests/day per model** — too low for report agent (~20+ calls with tool use).

### 3. OpenRouter (report attempts)

- **Paid models (`gpt-4o-mini`)**: **402 Insufficient credits** — account never purchased credits.
- **Free models**: **429 rate limits** — per-minute (16/min) and per-day caps.
- OpenRouter message: **Add 10 credits to unlock 1000 free model requests/day.**
- **Empty responses** from some free models (`None` content) → crashed report agent until **model fallback chain** was added in `llm_client.py`.

### 4. Wrong model choice

- **NVIDIA Llama Nemotron Rerank VL 1B V2** is a **reranking** model (`/rerank` API), not a chat model — cannot generate reports.

---

## What Worked vs What Did Not

**Worked (free tier)**

- Zep graph memory
- Gemini 2.5 Flash → full 40-round simulation
- OpenRouter free models → short calls, partial report progress
- Manual prediction doc (`PREDICTION-REPORT.md`) when engine could not finish

**Blocked (free tier)**

- Gemini → 20 req/day (simulation used most of budget)
- OpenRouter paid → no credits
- OpenRouter free → daily + per-minute caps mid-report
- Nemotron Rerank → wrong API (rerank, not chat)

---

## Artifacts Created

| File | Purpose |
|------|---------|
| `docs/atlas-ar/mirofish/SEED-ATLAS-AR.md` | Simulation seed |
| `docs/atlas-ar/mirofish/PREDICTION-REPORT.md` | Manual/spec-driven prediction |
| `docs/atlas-ar/mirofish/runs/CHECKPOINT-live-run.json` | Resume point for report-only |
| `scripts/run-mirofish-prediction.mjs` | Full pipeline orchestrator |
| `scripts/resume-mirofish-report.mjs` | Report-only resume script |

No live `REPORT.md` was saved under `runs/` — the report step never completed.

---

## Bottom Line

**Free tier can run a MiroFish simulation** if you use the right Gemini model (`gemini-2.5-flash`) and accept setup friction on Windows.

**Free tier cannot reliably finish the report** — the report agent is a multi-step LLM workflow (tool calls + reflection) that needs dozens of API calls. Gemini's 20/day limit and OpenRouter's free caps are both too tight.

**Cheapest path to finish:** add ~$10 OpenRouter credits or use a direct OpenAI key, then run report-only:

```
node d:\AI\agency-agents\atlas-webxr\scripts\resume-mirofish-report.mjs
```

No re-simulation needed — `sim_4fa4b86a352a` is already done on the backend.

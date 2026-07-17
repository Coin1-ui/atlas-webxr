# MiroFish — multi-API simulation (report via Ollama later)

## NEXUS-Sprint orchestration (MiroFish batch)

| Step | Action |
|------|--------|
| 1 | **Orchestrator** — scope UI/UX, marketing, sales, demographics simulation |
| 2 | **Seed** — `SEED-ATLAS-AR.md` updated with live product (AR dock, AR/3D, owner toggles, MKT-6) |
| 3 | **Run** — `npm run mirofish:multi` (Gemini → Gemini-2 → OpenAI → OpenRouter fallback) |
| 4 | **Checkpoint** — `runs/CHECKPOINT-live-run.json` when simulation completes |
| 5 | **Report (offline)** — local Ollama: `npm run mirofish:report` |

## API key files (do not commit)

Place in `d:\AI\atlas-webxr\`:

| File | Provider |
|------|----------|
| `Gemini API Key.txt` | Google AI Studio (primary) |
| `Gemini Api Key_2.txt` | Google AI Studio (fallback) |
| `OpenAI_Api.txt` | OpenAI |
| `OpenRouter Api key.txt` | OpenRouter |

## Run simulation only (no cloud report)

```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run mirofish:multi
```

Optional env:

| Variable | Default |
|----------|---------|
| `MIROFISH_KEY_DIR` | `d:\AI\atlas-webxr` |
| `MIROFISH_MAX_ROUNDS` | `40` |
| `MIROFISH_SKIP_REPORT` | `1` (skip; use Ollama later) |

## Generate report locally (no internet)

1. Install [Ollama](https://ollama.com) and pull a model, e.g. `ollama pull qwen2.5:7b`
2. Edit `MiroFish/.env`:

```env
LLM_API_KEY=ollama
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL_NAME=qwen2.5:7b
```

3. Start MiroFish backend (`cd MiroFish/backend && uv run python run.py`)
4. From checkpoint in `CHECKPOINT-live-run.json`:

```powershell
cd d:\AI\agency-agents\atlas-webxr
$cp = Get-Content docs/atlas-ar/mirofish/runs/CHECKPOINT-live-run.json | ConvertFrom-Json
$env:MIROFISH_SIMULATION_ID = $cp.simulationId
$env:MIROFISH_PROJECT_ID = $cp.projectId
npm run mirofish:report
```

Output: `docs/atlas-ar/mirofish/runs/{timestamp}/REPORT.md`

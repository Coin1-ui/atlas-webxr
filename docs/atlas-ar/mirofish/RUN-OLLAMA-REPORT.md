# Offline MiroFish report (local Ollama)

Simulation is **complete**. Only the ReportAgent step needs LLM calls — run this **offline** with Ollama (no cloud API quota).

| Field | Value |
|--------|--------|
| Simulation | `sim_e6b7b440cb5a` |
| Project | `proj_e8b9dcc98715` |
| Checkpoint | `docs/atlas-ar/mirofish/runs/CHECKPOINT-live-run.json` |
| Simulation run | `docs/atlas-ar/mirofish/runs/2026-06-18T14-56-14-730Z/` |
| Rounds | 40 (Gemini-2.5-flash) |

**Output:** new folder under `docs/atlas-ar/mirofish/runs/<timestamp>/` with `REPORT.md` + `report.json`.

---

## One-command run (recommended)

From `atlas-webxr`:

```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run mirofish:ollama-report
```

This script:

1. Backs up `MiroFish/.env` → `.env.backup-before-ollama`
2. Points MiroFish at Ollama (`http://127.0.0.1:11434/v1`)
3. Kills any stale backend on port **5001** (old Gemini config)
4. Starts MiroFish backend with Ollama env
5. Runs report for the checkpoint simulation
6. Logs to `docs/atlas-ar/mirofish/runs/ollama-report.log`

**Faster model (less RAM):**

```powershell
$env:LLM_MODEL_NAME = "qwen2.5:7b"
npm run mirofish:ollama-report
```

**Regenerate if checkpoint already says `report_complete`:**

```powershell
$env:MIROFISH_FORCE_REPORT = "1"
npm run mirofish:ollama-report
```

**Restore cloud `.env` after report:**

```powershell
$env:MIROFISH_RESTORE_ENV = "1"
npm run mirofish:ollama-report
```

---

## Manual steps (if you prefer control)

### 1. Install & start Ollama

Download: https://ollama.com/download

Ollama is often **not on PATH** on Windows — use the full path:

```powershell
$ollama = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"

# Pull model (14b = better report, 7b = faster)
& $ollama pull qwen2.5:14b
& $ollama list
```

Keep the **Ollama app running** (tray icon) or run `ollama serve`.

Verify:

```powershell
curl http://127.0.0.1:11434/api/tags
```

### 2. Configure MiroFish for Ollama

```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run mirofish:ollama-config
```

This writes to `d:\AI\agency-agents\MiroFish\.env`:

```env
LLM_API_KEY=ollama
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL_NAME=qwen2.5:14b
LLM_FALLBACK_MODELS=
```

`ZEP_API_KEY` is preserved from your existing `.env` (needed for report context).

### 3. Start MiroFish backend (Ollama — kills stale Gemini process)

```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run mirofish:ollama-backend
```

Leave this terminal open. Verify:

```powershell
curl http://127.0.0.1:5001/health
```

Must show `"local_ollama": true` and `"base_url": "http://127.0.0.1:11434/v1"`.

### 4. Generate report (second terminal)

```powershell
cd d:\AI\agency-agents\atlas-webxr

$env:MIROFISH_SIMULATION_ID = "sim_e6b7b440cb5a"
$env:MIROFISH_PROJECT_ID    = "proj_e8b9dcc98715"
$env:LLM_MODEL_NAME         = "qwen2.5:14b"

npm run mirofish:report
```

Checkpoint IDs are auto-loaded if env vars are omitted.

### 5. Read results

- `docs/atlas-ar/mirofish/runs/<new-timestamp>/REPORT.md`
- `docs/atlas-ar/mirofish/runs/CHECKPOINT-live-run.json` → `status: "report_complete"`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `429` / Gemini quota during report | **Stale backend** — `.env` is Ollama but the process on :5001 was started with Gemini. Run `npm run mirofish:ollama-backend` then `npm run mirofish:report`. Verify: `curl http://127.0.0.1:5001/health` must show `"local_ollama": true` |
| `Ollama not reachable` | Start Ollama app; check `curl http://127.0.0.1:11434/api/tags` |
| `Model not in Ollama` | `ollama pull qwen2.5:14b` (or your `LLM_MODEL_NAME`) |
| `Connection error` at ~20% | Ollama overloaded or model unloaded. Use **qwen2.5:7b** (default now), restart Ollama, then `npm run mirofish:ollama-backend` + `npm run mirofish:report`. Close other heavy apps to free RAM. |
| `uv` not found | Install uv: https://docs.astral.sh/uv/ ; then `cd MiroFish/backend && uv sync` |
| Out of memory on 14b | Use `qwen2.5:7b` or `llama3.2:3b` |

---

## Restore cloud API for future simulations

```powershell
copy d:\AI\agency-agents\MiroFish\.env.backup-before-ollama d:\AI\agency-agents\MiroFish\.env
```

Or re-run `npm run mirofish:multi` (it rewrites `.env` for cloud providers).

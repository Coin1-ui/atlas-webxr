# Run Atlas AR prediction on MiroFish

MiroFish repo: `d:\AI\agency-agents\MiroFish` (clone from https://github.com/666ghj/MiroFish)

## Prerequisites

| Requirement | Check |
|-------------|--------|
| Node.js 18+ | `node -v` |
| Python 3.11–3.12 | `python --version` |
| **uv** (Python package manager) | `uv --version` — install: `pip install uv` |
| LLM API (OpenAI-compatible) | `LLM_API_KEY` in MiroFish `.env` |
| Zep Cloud | `ZEP_API_KEY` in MiroFish `.env` |

> **Windows note:** plain `pip install -r requirements.txt` fails (`camel-oasis` not on PyPI for pip). Use **`uv sync`** in `MiroFish/backend` (already done if you ran setup).

## Current status (Atlas AR workspace)

| Step | Status |
|------|--------|
| MiroFish cloned | ✅ |
| Zep key in `.env` | ✅ |
| LLM key in `.env` | ❌ **required to run** |
| Node deps | ✅ |
| Python deps (`uv sync`) | ✅ |
| Live prediction run | ⏸ blocked on LLM key |

## One-time setup

```powershell
cd d:\AI\agency-agents\MiroFish
copy .env.example .env
# Edit .env — set LLM_API_KEY + ZEP_API_KEY

cd d:\AI\agency-agents\atlas-webxr
# With OPENAI_API_KEY or LLM_API_KEY in your shell:
npm run mirofish:setup
```

Or manually:

```powershell
cd d:\AI\agency-agents\MiroFish\backend
uv sync
```

## Automated Atlas seed run

From `atlas-webxr`:

```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run mirofish:predict
```

This script:

1. Starts MiroFish backend if not running (`http://localhost:5001`)
2. Uploads `docs/atlas-ar/mirofish/SEED-ATLAS-AR.md`
3. Runs graph build → simulation prepare → simulation (40 rounds) → report
4. Saves JSON + markdown report under `docs/atlas-ar/mirofish/runs/`

## Manual UI run

```powershell
cd d:\AI\agency-agents\MiroFish
npm run dev
```

Open `http://localhost:3000`, upload `SEED-ATLAS-AR.md`, paste the simulation requirement from the bottom of that file.

## Cost note

MiroFish README warns LLM consumption is high — use **≤40 simulation rounds** for first runs.

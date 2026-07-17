# External LLM agents for Atlas AR

When Cursor subagent usage limits are hit, run development tasks through **Gemini** or **OpenRouter** instead of Cursor's built-in Task/subagent tool.

## Important limitations

| Approach | Works? | Notes |
|----------|--------|-------|
| Cursor **Task/subagent** tool | No | Always billed to Cursor; cannot use Gemini/OpenRouter |
| Cursor **Agent** mode + Gemini BYOK | Yes (official) | Settings → Models → Google AI API key |
| **`npm run agent:gemini`** (this repo) | Yes | External agent loop; uses your Gemini API quota |

## Gemini setup (recommended — you already have a key)

1. Key file: `d:\AI\atlas-webxr\Gemini API Key.txt` (same file MiroFish uses), **or** set `GEMINI_API_KEY`.
2. Default model: `gemini-2.5-flash` (override with `GEMINI_MODEL`).
3. Test connectivity:

```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run agent:gemini:probe
```

### Run a Gemini task

```powershell
npm run agent:gemini -- --brief agent-briefs/atlas-ar/MKT-1-landing-pricing.md
npm run agent:gemini -- --task "Add LEG-1 privacy page stub at /legal/privacy"
d:\AI\atlas-webxr\run-gemini-agent.ps1 --probe
```

Logs: `.atlas-dev/gemini-runs/*.jsonl`

## OpenRouter setup (alternative)

Requires OpenRouter credits. See key file `OpenRouter Api key.txt`.

```powershell
npm run agent:openrouter:probe
npm run agent:openrouter -- --task "Your task"
```

Logs: `.atlas-dev/openrouter-runs/*.jsonl`

## Cursor BYOK (optional chat in IDE)

**Gemini (official):** Settings → Models → Google AI → paste Gemini API key → select Gemini model in chat.

**OpenRouter (unofficial):** OpenAI API Key + base URL `https://openrouter.ai/api/v1/cursor` — prefer Ask mode.

## Security

- Never commit API keys. Key files live under `d:\AI\atlas-webxr\` (outside git).
- Rotate keys if pasted into chat.

## Next backlog items

See `docs/atlas-ar/backlog.md` — e.g. **MKT-3**, **LEG-1**.

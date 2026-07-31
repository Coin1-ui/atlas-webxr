# OPS — Turn off sandbox Dodo ingest (pre-paid traffic)

**Status:** **PASS** ✅ (2026-07-31 re-probe) — `/health` reports `sandboxDodoIngest: false`, `sandboxUsageSeed: false`  
**Why this doc exists:** Earlier the same day `/health` showed ingest **true**; that risks billing **real** Dodo meters from sandbox seed. Keep **off** for production partners and paid traffic.

**Related:** [LAUNCH-READINESS-2026-07-31.md](./LAUNCH-READINESS-2026-07-31.md) · SAL-4 red flags

---

## Confirm anytime

```bash
curl -s https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/health
```

Expect: `"sandboxDodoIngest":false` and seed false.

---

## If it turns true again (founder)

1. AWS Console → Lambda → **atlas-api** (ap-south-1) → Configuration → Environment variables.
2. Set `ATLAS_SANDBOX_DODO_INGEST` = `false` (and disable usage seed if present).
3. Save → wait ~1–2 min → re-probe `/health`.

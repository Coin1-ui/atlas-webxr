# OPS — Turn off sandbox Dodo ingest (pre-paid traffic)

**Status:** Founder action required (Lambda env)  
**Why:** Live `/health` on 2026-07-31 returned `sandboxDodoIngest: true` and `sandboxUsageSeed: true`. Sandbox seed + ingest can bill **real** Dodo meters. Keep **off** for production partners and paid traffic.

**Related:** [LAUNCH-READINESS-2026-07-31.md](./LAUNCH-READINESS-2026-07-31.md) · SAL-4 red flags

---

## Target env (atlas-api Lambda)

| Variable | Desired for prod soft launch |
|----------|------------------------------|
| `ATLAS_SANDBOX_DODO_INGEST` | `false` |
| Usage seed flag (whatever maps to `sandboxUsageSeed` on `/health`) | `false` / unset |

Exact seed variable name may be `ATLAS_SANDBOX_USAGE_SEED` or similar — match the key shown on `/health` after deploy.

---

## Steps (founder)

1. AWS Console → Lambda → **atlas-api** (ap-south-1) → Configuration → Environment variables.
2. Set `ATLAS_SANDBOX_DODO_INGEST` = `false` (and disable usage seed if present).
3. Save → wait for deploy/propagate (~1–2 min).
4. Confirm:

```bash
curl -s https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/health
```

Expect: `"sandboxDodoIngest":false` (and seed false).

5. Reply in chat / update memory: **OPS-INGEST PASS**.

---

## Agent note

Agents cannot flip production Lambda env without AWS credentials. This checklist is the handoff; readiness doc stays **GO WITH CAVEATS** until founder confirms `/health`.

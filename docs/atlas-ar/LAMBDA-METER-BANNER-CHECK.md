# Lambda meter banner — Growth account (ops note)

**Date:** 2026-07-31  
**Context:** False BILL-METER-SYNC banner after Growth upgrade (storage free threshold uint32 wrap).

## Confirmed (Launch JWT — not the banner account)

Probe with `aryan.barua007@gmail.com` / CT202 Sofa (Launch):

| Field | Value |
|--------|--------|
| `meterSync.ok` | **true** |
| `inOverage` | false |
| Banner expected | No |

## Still open — Growth banner gate

Account that showed the red meter message: **`aryan.barua57@gmail.com`** / workspace **`1ee2cb65-6252-4679-ab53-84ea36b2518f`** (Growth).

1. Upload `backend/lambda/atlas-api-deploy.zip` to Lambda **`atlas-api`** (ap-south-1) if not already done (fix in `f349623` / lean ZIP ~4.67 MB).
2. Sign in as Growth owner → hard-refresh Account.
3. Or probe with a Growth Cognito ID token:
   - `GET /v2/workspaces/1ee2cb65-6252-4679-ab53-84ea36b2518f/billing/status`
   - Expect `meterSync.ok === true` and no `mismatches` on storage.

Do **not** remount checkout for this false positive.  
Do **not** store JWTs in this doc or project memory.

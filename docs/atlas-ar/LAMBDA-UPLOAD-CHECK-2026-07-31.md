# Lambda upload check — 2026-07-31

**Status:** Uploaded by operator · API healthy

## Probe

`GET https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/health`

| Field | Value |
|--------|--------|
| `ok` | true |
| `service` | atlas-api |
| `version` | 2 |

Public settings still return promo / `demoWorkspaceSlug` (API alive).

## Ops hygiene (not blocking)

Health still shows `sandboxDodoIngest: true` / `sandboxUsageSeed: true`. After seed tests set **`ATLAS_SANDBOX_DODO_INGEST=false`** (and seed false if unused). Clear does not reverse Dodo meters.

## Growth meter banner

Launch JWT previously `meterSync.ok`. After this ZIP, Growth account should hard-refresh Account once if the false meter banner was still showing. Do not store JWTs.

# Design-partner gate — Showcase GLB hosting (2026-08-01)

**Status:** Mitigated in code · Console paste still recommended  
**Owner action:** Paste redirects + confirm Amplify deploy includes `public/custom-models/showcase/`

## What was broken

| URL | Observed |
|-----|----------|
| `https://www.atlasar.in/showcase/ct202.glb` | `200 text/html` (SPA shell, ~5 KB) |
| `https://www.atlasar.in/custom-models/Bar-Chair.glb` | `200 model/gltf-binary` (~1.9 MB) |

Cause: `/showcase/*.glb` either missing from CDN and/or Amplify Console SPA rewrite not excluding `glb`. Console overrides `amplify.yml` once edited in UI ([AMPLIFY-REDIRECTS.md](./AMPLIFY-REDIRECTS.md)).

## Code mitigation (shipped)

Showcase catalog now loads GLBs from:

`/custom-models/showcase/{file}.glb`

Files live in `public/custom-models/showcase/` (same four SKUs). After Amplify deploy, verify:

```text
https://www.atlasar.in/custom-models/showcase/ct202.glb
→ Content-Type: model/gltf-binary (or application/octet-stream)
→ Body much larger than 5 KB

https://www.atlasar.in/sales-deck/showcase → open CT202 → View in AR → model loads
```

## Founder Console checklist (still do)

1. Amplify → Hosting → Rewrites and redirects → Manage.  
2. Replace JSON with [AMPLIFY-REDIRECTS.json](./AMPLIFY-REDIRECTS.json) (includes `glb|usdz` + `/sales-deck/showcase` SPA rules).  
3. Save; wait 1–2 min; test in **incognito**.  
4. Trim Amplify env `VITE_ATLAS_API_URL` (no leading tab/space) so `/sales-deck/config.json` bakes clean on next build.  
5. Day-5 proof emails may include `/sales-deck/showcase` **only after** custom-models GLB check passes.

## Day-0/1/2 send gate

| Touch | Allowed without GLB fix? |
|-------|---------------------------|
| Template A (workflow ask) | **Yes** — no showcase URL required |
| Template B LinkedIn | **Yes** |
| Template C (proof) | **No** until custom-models GLB verify PASS |

Inbox: `sales@atlasar.in` — confirmed live 2026-07-31.

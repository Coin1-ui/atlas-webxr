# Atlas AR — Hosting recommendation

You were unsure on hosting. **Recommendation: stay fully on AWS** — you already run Amplify + Lambda + S3 successfully; Cognito fits the same account with minimal new vendors.

## Recommended architecture (MVP)

```
                    ┌─────────────────────────────────────┐
                    │  Route 53 (optional, Phase 2)      │
                    │  *.atlasar.in → Amplify             │
                    └─────────────────┬───────────────────┘
                                      │
┌─────────────────────────────────────▼─────────────────────────────────────┐
│  AWS Amplify Hosting (existing)                                          │
│  • Marketing + app shell + AR client (Vite SPA)                          │
│  • Branches: main (prod), staging                                        │
│  • Env: VITE_ATLAS_API_URL, VITE_COGNITO_* , VITE_BASE_PATH=/           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ API Gateway     │  │ Cognito         │  │ S3              │
│ HTTP API        │  │ User Pool       │  │ atlas-models-*  │
│ /v1/*           │  │ JWT for API     │  │ tenants/{id}/   │
└────────┬────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Lambda          │
│ models-api v2   │
│ + tenant auth   │
└─────────────────┘
```

## Why not split to Vercel/CloudFront for marketing?

| Option | Pros | Cons |
|--------|------|------|
| **A. All Amplify (recommended MVP)** | One deploy, one bill, CORS already solved, private GitHub works | Marketing + app share same release cadence |
| B. Amplify app + separate marketing static site | Marketing team independence | Two deploys, two CORS origins, more DNS |
| C. CloudFront + S3 static only | Cheapest at scale | You rebuild CI; no benefit at MVP scale |

**Decision for MVP: Option A.** Add route-based marketing (`/`, `/pricing`, `/login`) inside the existing Vite app. Split marketing site only if SEO/CM needs grow in Phase 2.

**SEO Phase 1 (2026-07-30):** Canonical host `https://www.atlasar.in`. SPA head manager + `robots.txt` + `sitemap.xml` + JSON-LD shipped in-app. Prerender / content hub / marketing host split remain Phase 2 — see [SEO-OPS-CHECKLIST.md](./SEO-OPS-CHECKLIST.md) and backlog **SEO-1** / **SEO-2**.

## Environments

| Env | Amplify branch | API stage | Cognito pool |
|-----|----------------|-----------|--------------|
| dev | `develop` | `dev` | dev pool |
| staging | `staging` | `staging` | staging pool |
| prod | `main` | `prod` | prod pool |

## Cost expectation (MVP, &lt;20 tenants)

- Amplify: ~$0–15/mo at low traffic
- Lambda + API Gateway: pay per request (&lt;$5/mo early)
- S3: storage + PUT (~$1–10/mo depending on GLB sizes)
- Cognito: free tier covers MAU for pilots

## When to revisit

- &gt;100 active workspaces → CloudFront in front of S3 assets
- Enterprise SSO (SAML) → Cognito federated identities
- Global latency → S3 + CloudFront multi-region (single region fine for v1)

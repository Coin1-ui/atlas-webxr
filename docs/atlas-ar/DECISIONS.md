# Atlas AR — Locked product decisions

**Status:** Approved 2026-05-21  
**Owner:** Product + Senior Project Manager

| # | Topic | Decision |
|---|--------|----------|
| 1 | Product name | **Atlas AR** (customer-facing SaaS). Codebase package may remain `atlas-field-ar-web` until rebrand sprint. |
| 2 | Primary ICP (v1) | **Furniture / home retail** + **B2B field sales** (showroom reps, trade-show demos). |
| 3 | Pricing model | **Hybrid:** base subscription per workspace + usage overage (models, monthly AR sessions, storage). |
| 4 | Auth | **Amazon Cognito** (User Pools + optional Identity Pools for future API keys). |
| 5 | Hosting | **AWS-native stack** (see [HOSTING.md](./HOSTING.md)) — single AWS account, Amplify + API Gateway + Lambda + S3 + Cognito. |
| 6 | MVP billing | **Manual invoicing** for first ~5 design partners; Stripe automation in Phase 3. |
| 7 | iOS v1 | **Quick Look only** (USDZ). No WebXR Viewer positioning in SaaS marketing. Android = WebXR immersive AR. |
| 8 | Multi-tenancy | Workspace = tenant. S3 prefix `tenants/{workspaceId}/`. Subdomain `{slug}.atlasar.com` (domain TBD at DNS setup). |

## Out of scope for MVP

- Native iOS/Android apps
- Automated Stripe billing
- SOC 2 certification (gap analysis only)
- Depth occlusion / ARKit native wrapper
- Customer-built API (read-only analytics export only if time permits)

## Success criteria for MVP launch

1. New customer can sign up, verify email, create workspace, upload ≥1 GLB, open AR on Android phone, place model.
2. iOS user can open same catalog via Quick Look (USDZ per model).
3. Two workspaces cannot read each other's models (verified by security test).
4. White-label: logo + primary color on home screen and AR chrome.
5. Sales can run demo from documented script in &lt;15 minutes.

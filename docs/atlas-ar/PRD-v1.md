# Atlas AR — Product requirements document (MVP v1)

**Version:** 1.0  
**Product:** Atlas AR (SaaS)  
**Codename:** Atlas AR Cloud  
**Status:** Phase 0 approved — ready for Phase 1 build

---

## 1. Problem statement

Retailers and field sales teams need **accurate floor-scale AR** from existing 3D product assets without building native apps or managing fragmented tooling. Atlas AR turns GLB catalogs into **shareable, white-label AR experiences** on Android (WebXR) and iOS (Quick Look).

## 2. Goals

| Goal | Measure |
|------|---------|
| Multi-tenant SaaS | ≥2 isolated workspaces in staging |
| Self-serve onboarding | Sign-up → first AR session &lt;30 min |
| White-label | Logo + primary color per workspace |
| Platform parity (scoped) | Android immersive AR; iOS Quick Look only |
| Revenue-ready | Pricing page + manual contract template |

## 3. Non-goals (MVP)

- Stripe / automated billing
- Native iOS/Android apps
- WebXR on iOS
- Real-time collaboration
- Public unauthenticated API

## 4. User personas

| Persona | Role | Needs |
|---------|------|-------|
| **Workspace admin** | Marketing / ops | Upload models, branding, invite users |
| **Viewer** | Customer / rep | Open link, scan floor, place model |
| **Super admin** | Atlas AR ops | Support, suspend workspace, usage view |

## 5. Functional requirements

### 5.1 Authentication & accounts (Cognito)

- FR-A1: Email/password sign-up with verification
- FR-A2: Sign-in, sign-out, forgot password
- FR-A3: JWT passed to API; API validates `sub` + workspace membership
- FR-A4: Roles: `owner`, `admin`, `viewer` (viewer = AR only, no upload)

### 5.2 Workspaces (tenants)

- FR-W1: User creates workspace on first login (name, slug)
- FR-W2: Slug resolves to tenant config (subdomain or path `/w/{slug}`)
- FR-W3: Workspace settings: display name, logo URL, primary color, plan tier
- FR-W4: Data isolation: all S3 keys under `tenants/{workspaceId}/`

### 5.3 Model catalog (admin)

<<<<<<< Updated upstream
- FR-M1: Upload GLB (max size TBD, start 50MB); server generates USDZ for iOS
=======
- FR-M1: Upload GLB (max **50 MB** all plans); server generates USDZ for iOS (max **50 MB**); workspace storage budget = model slots × 50 MB × 2.5
>>>>>>> Stashed changes
- FR-M2: List, rename, delete models per workspace
- FR-M3: Replace PC-only `#manage-models` with authenticated admin routes
- FR-M4: Catalog API returns only current workspace models

### 5.4 AR client (existing app, tenant-aware)

- FR-C1: Load tenant theme on entry (from slug/subdomain or query param during dev)
- FR-C2: Android: WebXR floor AR (current behavior)
- FR-C3: iOS: Quick Look with USDZ from tenant catalog
- FR-C4: Object mode: available for uploaded GLBs only (not builtins)
- FR-C5: Dimensions overlay off by default; user toggles on
- FR-C6: Session events: `session_start`, `placement`, `session_end` (anonymous or linked to viewer if logged in)

### 5.5 Usage & limits (soft)

- FR-U1: Track model count, storage bytes, monthly session count per workspace
- FR-U2: Show usage in admin dashboard; warn at 80% and 100% of plan limits
- FR-U3: No hard block in MVP (manual sales follow-up)

### 5.6 Marketing & legal (minimal)

- FR-L1: Public landing, pricing, login/sign-up pages
- FR-L2: Privacy policy + Terms of Service placeholders (legal review before prod)

## 6. Technical constraints

- Auth: Amazon Cognito User Pools
- Hosting: AWS Amplify (see HOSTING.md)
- API: Extend existing Lambda models API to v2 with tenant context
- iOS: Quick Look only — no WebXR marketing claims
- Existing AR engine: Babylon.js WebXR (Android); do not regress floor lock fixes

## 7. UX flows

### 7.1 Admin: first model live

```
Sign up → Verify email → Create workspace → Admin dashboard
→ Upload GLB → (async USDZ) → Copy share link → Open on phone → AR works
```

### 7.2 Viewer: furniture shopper

```
Open link (e.g. acme.atlasar.com) → Pick product → Start AR
→ Scan floor → Tap to place → Toggle dimensions / Object mode
```

### 7.3 iOS shopper

```
Same link → Pick product → Quick Look opens → Place in room (Apple UI)
```

## 8. Acceptance criteria (MVP ship)

- [ ] AC-1: Two test workspaces cannot list each other's models
- [ ] AC-2: Cognito login required for admin routes
- [ ] AC-3: Unauthenticated viewer can open public AR link if workspace allows (default: public viewer links)
- [ ] AC-4: Android AR placement works on reference device (Pixel/Samsung)
- [ ] AC-5: iOS Quick Look opens USDZ for uploaded model
- [ ] AC-6: White-label logo visible on home screen
- [ ] AC-7: Amplify CI green on `main`

## 9. Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| Cognito pool + app client | ENG-4 | Not started |
| Tenant S3 layout migration | ENG-1 | Not started |
| API v2 auth middleware | ENG-2 | Not started |
| Admin UI | ENG-5 | Not started |
| Domain DNS | Ops | TBD |

## 10. Risks

| Risk | Mitigation |
|------|------------|
| iOS Quick Look limits vs Android parity | Clear marketing: "Full AR on Android; iOS preview via Quick Look" |
| Cognito + SPA token refresh | Use Amplify Auth library or amazon-cognito-identity-js |
| Legacy single-tenant S3 data | Migration script + default workspace for existing deploy |

## 11. Phase mapping

| Phase | Deliverable |
|-------|-------------|
| P0 | This PRD, backlog, ADR, threat model |
| P1 | Multi-tenant backend + Cognito + admin + white-label |
| P2 | Marketing site, sales kit, support docs |
| P3 | Stripe, hard limits, security audit |

---

**References:** [DECISIONS.md](./DECISIONS.md) · [ICP.md](./ICP.md) · [PRICING.md](./PRICING.md) · [HOSTING.md](./HOSTING.md) · [ARCHITECTURE-ADR-001.md](./ARCHITECTURE-ADR-001.md)

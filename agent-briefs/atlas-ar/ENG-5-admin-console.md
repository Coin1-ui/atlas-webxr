# Brief ENG-5: Admin console (replace #manage-models)

**Agent role:** Frontend Developer + UX Architect  
**Sprint:** 2  
**Priority:** P0  
**Effort:** 5–7 days  

## Context

Today model upload is PC-only via hash route `#manage-models`. SaaS admins need authenticated pages for catalog management and branding.

## Inputs

- `src/data/model-catalog.ts` — current catalog fetch
- `src/config/api.ts` — `VITE_ATLAS_API_URL`
- Existing upload flow in backend

## Deliverables

1. Routes (vanilla or lightweight router):
   - `/admin` — dashboard (usage summary placeholder)
   - `/admin/models` — list, upload, delete
   - `/admin/settings` — workspace name, logo URL, primary color
2. Auth guard: redirect to `/login` if no Cognito session
3. Upload uses API v2 presigned URL flow (when ENG-8 ready)
4. Deprecate `#manage-models` for production builds (keep dev flag optional)

## UX requirements

- Mobile-friendly list; upload optimized for desktop
- Clear copy: "Share this link with customers: `{workspaceUrl}`"
- Show USDZ status per model (processing / ready / failed)

## Acceptance criteria

- [ ] Logged-in admin uploads GLB → appears in AR picker for that workspace
- [ ] Logged-out user cannot access `/admin/*`
- [ ] Matches tenant theme preview in settings

## Out of scope

- Stripe billing UI
- Multi-workspace switcher (single workspace per user MVP)

## Handoff

→ QA-3 E2E admin → AR flow

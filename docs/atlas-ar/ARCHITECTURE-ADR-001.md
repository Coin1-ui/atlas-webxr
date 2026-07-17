# ADR-001: Multi-tenant architecture for Atlas AR Cloud

**Status:** Accepted  
**Date:** 2026-05-21  
**Context:** Convert single-tenant Atlas Field AR deploy into sellable SaaS with Cognito and AWS-native hosting.

## Decision

Implement **workspace-based multi-tenancy** with:

1. **Cognito User Pool** for authentication
2. **JWT claims + DynamoDB membership** for authorization
3. **S3 prefix isolation** per workspace
4. **Single Amplify-hosted SPA** with tenant resolution at runtime
5. **API Gateway HTTP API** with Lambda authorizer validating Cognito JWT

## Tenant model

```
User (Cognito sub)
  └── WorkspaceMember (DynamoDB: userId + workspaceId + role)
        └── Workspace (DynamoDB: id, slug, plan, branding, limits)
              └── Assets (S3: tenants/{workspaceId}/models/{modelId}.glb)
```

### Workspace resolution (client)

Priority order:

1. Subdomain: `{slug}.atlasar.com` → lookup workspace by slug
2. Path: `/w/{slug}` (dev + fallback)
3. Query: `?workspace=demo` (local dev only)

Public config endpoint: `GET /v2/workspaces/{slug}/public-config` (no auth) returns branding + feature flags.

### Authorization

| Route class | Auth |
|-------------|------|
| Public AR viewer | Optional; rate-limited by workspace |
| Admin API | Cognito JWT + `owner|admin` role |
| Super admin | Separate Cognito group `atlas-ops` |

## API versioning

- **v1** (current): Single-tenant models API — deprecate after migration
- **v2**: All routes prefixed `/v2/workspaces/{workspaceId}/...` with JWT

Migration: create default workspace `legacy`, map existing S3 bucket root or prefix into `tenants/legacy/`.

## DynamoDB tables (MVP)

| Table | PK | SK | Notes |
|-------|----|----|-------|
| `atlas-workspaces` | `WORKSPACE#{id}` | `META` | slug, plan, branding JSON |
| `atlas-workspaces` | `SLUG#{slug}` | `WORKSPACE` | GSI lookup |
| `atlas-members` | `USER#{sub}` | `WORKSPACE#{id}` | role |
| `atlas-usage` | `WORKSPACE#{id}` | `MONTH#{yyyy-mm}` | sessionCount, storageBytes |

## Cognito configuration

- User Pool: email sign-in, MFA optional (off MVP)
- App client: SPA, PKCE, no client secret
- Groups: `atlas-ops` for internal super admin
- Custom attributes: none required MVP (membership in DynamoDB)

## Frontend auth flow

```
Amplify Auth (or cognito SDK) → ID token in memory
→ API calls: Authorization: Bearer {idToken}
→ Admin routes: React/Vanilla guard checks session
→ AR public link: no token; workspace from slug
```

## iOS strategy (locked)

- **Quick Look only** for SaaS v1
- USDZ generated on GLB upload (existing pipeline)
- No WebXR code path changes for iOS SaaS positioning

## Consequences

**Positive:** Reuses Amplify/Lambda/S3; clear isolation; familiar AWS billing.

**Negative:** DynamoDB + Cognito add ops surface; subdomain SSL needs Amplify custom domains.

**Follow-ups:** ADR-002 for analytics event schema; ADR-003 for Stripe metering (Phase 3).

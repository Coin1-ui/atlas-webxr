# Brief ENG-1: Tenant data model (DynamoDB)

**Agent role:** Backend Architect  
**Sprint:** 1  
**Priority:** P0  
**Effort:** 2–3 days  

## Context

Multi-tenant SaaS needs workspace records, user membership, and usage counters separate from S3 asset storage.

## Deliverables

1. DynamoDB table definitions (CloudFormation, CDK, or documented CLI):
   - `atlas-workspaces` (workspace meta + slug GSI)
   - `atlas-members` (user ↔ workspace ↔ role)
   - `atlas-usage` (monthly aggregates)
2. TypeScript types in `backend/lib/tenant-types.ts` (or equivalent)
3. CRUD helpers:
   - `createWorkspace(ownerSub, name, slug)`
   - `getWorkspaceBySlug(slug)`
   - `addMember(workspaceId, userSub, role)`
   - `getMembership(userSub, workspaceId)`
4. Migration note: map existing single-tenant bucket to `workspaceId=legacy`

## Acceptance criteria

- [ ] Slug lookup is unique (conditional write on create)
- [ ] Owner auto-added as `owner` role on workspace create
- [ ] Unit tests or script demonstrating create + lookup

## Out of scope

- API routes exposing these (ENG-4, ENG-7)
- Billing/plan enforcement logic

## Handoff

→ ENG-4 public-config endpoint  
→ ENG-7 workspace creation UI

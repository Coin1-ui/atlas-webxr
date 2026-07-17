# Brief ENG-2 + ENG-3: Cognito + JWT authorizer

**Agent role:** Backend Architect / DevOps Automator  
**Sprint:** 1  
**Priority:** P0  
**Effort:** 3–5 days  

## Context

Atlas AR MVP requires Cognito for admin authentication and a Lambda authorizer so API v2 routes only serve data for workspaces the user belongs to.

## Locked constraints

- AWS-native only; no Auth0
- SPA with PKCE (no client secret)
- Existing API lives in `backend/` — extend, don't rewrite AR client

## Inputs

- `docs/atlas-ar/ARCHITECTURE-ADR-001.md`
- `backend/README-AWS.md`
- Current models Lambda handler

## Deliverables

1. **Cognito User Pool** (dev + staging documented in README)
   - Email verification required
   - Password policy: min 8 chars
2. **App client** for SPA with callback URLs:
   - `http://localhost:5173`
   - Amplify staging/prod URLs (placeholders OK)
3. **HTTP API JWT authorizer** (or Lambda authorizer) validating:
   - Issuer = Cognito pool
   - Audience = app client id
4. **IaC or CLI script** in `backend/scripts/` to reproduce dev pool
5. **Authorizer context** passed to handlers: `sub`, `email` (optional)

## Acceptance criteria

- [ ] Valid ID token → 200 on protected test route
- [ ] Expired/missing token → 401
- [ ] Document env vars: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`

## Out of scope

- Social login, MFA, SAML
- Frontend login UI (ENG-6)
- DynamoDB membership (ENG-1)

## Handoff

→ ENG-6 Frontend wires Amplify Auth  
→ ENG-8 API v2 uses authorizer context + membership table

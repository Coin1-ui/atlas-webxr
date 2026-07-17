# Atlas AR — Threat model (MVP baseline)

**Scope:** Multi-tenant SaaS MVP (Cognito, API Gateway, Lambda, S3, Amplify)  
**Method:** STRIDE-lite for prioritization — full pen test before enterprise sales.

## Assets

- Customer GLB/USDZ models (S3)
- Workspace branding and config (DynamoDB)
- Cognito credentials
- Session analytics events
- API keys (future; not MVP)

## Trust boundaries

```
[Browser viewer] ──public──► [CloudFront/Amplify static]
[Browser admin]  ──JWT────► [API Gateway] ──► [Lambda] ──► [S3 / DynamoDB]
[Attacker]       ──?──────► [All public endpoints]
```

## STRIDE summary

| Threat | Example | Mitigation (MVP) | Phase |
|--------|---------|------------------|-------|
| **S** Spoofing | Fake JWT | API Gateway JWT authorizer (Cognito issuer) | P1 |
| **T** Tampering | Modify another tenant's modelId | Enforce workspaceId from JWT, not client body | P1 |
| **R** Repudiation | Admin denies upload | CloudWatch logs + S3 object versioning | P1 |
| **I** Info disclosure | List all tenants' models | S3 bucket policy deny public; presigned URLs scoped to prefix | P1 |
| **D** DoS | Flood public AR endpoint | API Gateway throttling; WAF optional | P2 |
| **E** Elevation | Viewer uploads GLB | Role check on admin routes only | P1 |

## Critical controls (must ship P1)

1. **S3:** Block public access; IAM role per Lambda with `s3:prefix/tenants/{workspaceId}/*` derived from authorizer context
2. **API:** Never trust `workspaceId` from query without membership check
3. **Cognito:** Strong password policy; rate limit sign-up if abuse
4. **CORS:** Restrict to known Amplify domains + localhost dev
5. **Upload:** Validate GLB magic bytes; size cap; virus scan deferred to P3

## Known gaps (accepted for MVP)

- No SOC 2
- No automated secret rotation runbook
- Soft usage limits (no billing fraud prevention)
- Public viewer links are shareable by design (workspace slug is not secret)

## Pre-launch checklist

- [ ] Cross-tenant read test (automated)
- [ ] Cross-tenant write test (automated)
- [ ] Expired JWT rejected
- [ ] S3 bucket public access block enabled
- [ ] Dependencies audit (`npm audit` review)

**Owner:** Security engineer agent + ENG lead sign-off before prod.

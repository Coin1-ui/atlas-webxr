# Agent brief template — Atlas AR

Use this structure when delegating work to specialist agents.

---

## Brief ID: `{AGENT}-{N}`

**Title:**  
**Agent role:** (e.g. Backend Architect, Product Manager)  
**Sprint / Phase:**  
**Priority:** P0 | P1 | P2  
**Estimated effort:**  

### Context

2–3 sentences on why this task exists and how it fits Atlas AR Cloud.

### Locked constraints

- Product name: **Atlas AR**
- Auth: **Cognito**
- Hosting: **AWS Amplify + Lambda + S3**
- iOS v1: **Quick Look only**
- Billing MVP: **Manual** (no Stripe)

### Inputs (read first)

- `docs/atlas-ar/DECISIONS.md`
- `docs/atlas-ar/PRD-v1.md`
- Relevant ADR / threat model sections

### Deliverables

- [ ] Concrete artifact (file path or PR scope)
- [ ] Acceptance criteria (testable)

### Out of scope

Explicit list to prevent scope creep.

### Handoff

Who consumes this output next?

---

## Quality bar

- Cite existing code paths in `atlas-webxr/` when touching AR client
- Do not break Android floor AR or Object mode DOM overlay (`#ar-overlay`)
- Cross-tenant isolation must have a test or manual verification script

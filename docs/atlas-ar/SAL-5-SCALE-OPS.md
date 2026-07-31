# SAL-5 — Scale ops runbook (sales-led)

**Sales Ops + Owner dashboard**  
**Quote / invoice:** **sales@atlasar.in**  
**Owner UI:** `/owner` → **Customer accounts**  
**Related offer (not Scale):** [SAL-4-DESIGN-PARTNER-OPS.md](./SAL-4-DESIGN-PARTNER-OPS.md) · Growth @ $59  
**3D modeling add-on:** [SERVICES-3D-MODELING-RATE-CARD.md](./SERVICES-3D-MODELING-RATE-CARD.md)

---

## Locked product rule

**Scale is not a Dodo self-serve SKU.** Customers cannot checkout Scale from Account. Owner grants **Scale** entitlement only **after** a signed quote / invoice via **sales@atlasar.in**.

Do **not** promise custom domain, SAML SSO, or multi-workspace (ENG-20 / ENG-21 / ENG-39) unless separately contracted.

---

## How customers get the Scale CTA

| Path | What they see |
|------|----------------|
| Public pricing | Scale card → **Contact sales** (`mailto` + clipboard + on-page status) |
| Account (on Growth / highest self-serve) | **Contact sales for Scale** → `/pricing` |
| Owner-assisted | Owner → Customers → **Send Scale CTA** emails the workspace owner (cc sales@) with `/pricing` instructions |

---

## Owner workflow — after a Scale deal

1. **Qualify** — multi-brand, custom limits, volume sessions; confirm browser AR path (Chrome + Safari).
2. **Quote** via **sales@atlasar.in** (From/Reply-To). Invoice manually (no Scale Dodo product).
3. **Send Scale CTA** (optional) from Owner → Customers if they need the Contact-sales path before signing.
4. **Entitle** — Owner → Customer accounts → plan **Scale — From $499/mo** → **Save plan** (`billingTier: scale` → backend `enterprise`).
5. **Kickoff** — confirm Account shows Scale; upload / floor placement; enable session log if contracted.
6. **Modeling** — if they need poly optimize + PBR, quote separately per SERVICES-1 (not bundled free).

---

## Owner UI checklist

| Action | Where |
|--------|--------|
| Send Scale CTA | Customers row → **Send Scale CTA** (needs owner email from Cognito) |
| Copy Scale CTA | Same row → **Copy Scale CTA** |
| Set entitlement | Plan dropdown → Scale → **Save plan** |
| Design partner Growth@$59 | Use **Design partners** tab + SAL-4 — not this runbook |

---

## Red flags

- Do not create a “Scale” coupon for self-serve checkout — Scale is blocked in Account upgrade (`Scale requires a sales-assisted contract`).
- Do not confuse Scale with design-partner / Founding 10 (Growth limits @ $59).
- Keep `ATLAS_SANDBOX_DODO_INGEST=false` for production partner/Scale workspaces.
- Unlimited free modeling is out of scope (SERVICES-1).

---

## Related

- Pricing public CTA: `https://www.atlasar.in/pricing`
- Contact SoT: `src/shared/contact.ts` → `sales@atlasar.in`
- Design partners: [SAL-4-DESIGN-PARTNER-OPS.md](./SAL-4-DESIGN-PARTNER-OPS.md)

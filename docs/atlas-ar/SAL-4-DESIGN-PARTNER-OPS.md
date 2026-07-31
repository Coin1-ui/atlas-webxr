# SAL-4 — Design partner ops runbook

**Batch 32 · Sales Ops + Owner dashboard**  
**Offer source:** [SAL-2-DESIGN-PARTNER-OUTREACH.md](./SAL-2-DESIGN-PARTNER-OUTREACH.md)  
**Owner UI:** `/owner` → **Design partners** tab

---

## Offers (locked)

| Program | Slots | Duration | Price | Partner gives |
|---------|-------|----------|-------|----------------|
| **Design partner** | **3** active | 90 days | Growth limits @ **$59/mo** (Launch price) | 30 min biweekly feedback · quote if metric hit · 1 referral |
| **Founding 10** | 10 | 12 months | Growth @ **$59/mo** | Lighter ask — no structured feedback |

**Success metric (design partner):** ≥50 AR sessions/mo with ≥1 floor placement each + first SKU live ≤15 min on kickoff.

**Conversion bonus:** Hit 50 sessions/mo in pilot → 15% off annual at conversion (see PRICING.md).

---

## What is automated vs manual today

| Step | Automated | Manual (owner) |
|------|-----------|----------------|
| Coupon create / Dodo sync | Owner **Discount coupons** + Sync from Dodo | Create `DESIGN59` / `FOUNDING10` style codes |
| Checkout at $59 | Dodo coupon on checkout | Send coupon code + `/pricing` or checkout link |
| Growth entitlement | Billing webhook after paid sub | Confirm Account shows Growth / Launch price coupon |
| Session log download | Workspace feature toggle | Enable **JSON / session log** on partner workspace if promised |
| Slot tracking (3) | Owner **Design partners** panel | Fill workspace, dates, checklist |
| CRM export | — | Out of scope this batch — use panel + spreadsheet if needed |

---

## Owner workflow — design partner (checklist)

1. **Qualify** via SAL-2 outreach; confirm Android Chrome + iOS Safari path.
2. **Reserve a slot** in Owner → Design partners (max 3 `active`).
3. **Create / reuse coupon** — fixed promo Growth @ $59, duration months as agreed (e.g. 3 for pilot, 12 for Founding).
4. **Kickoff call** — `/demo` or their `/w/{slug}` · first GLB · first floor placement ≤15 min.
5. **Plan set** — partner completes checkout with coupon; confirm entitlement in Customer accounts.
6. **Session log** — enable if contract includes analytics export / JSON log.
7. **Kickoff done** — mark checklist in Design partners panel; set start date.
8. **Biweekly** — feedback; watch sessions toward ≥50/mo.
9. **Day 90** — convert (annual / full Growth), extend Founding terms, or churn → update status.

---

## Founding 10 path

1. Coupon: Growth @ $59 × **12** months (`durationMonths: 12`).
2. Track separately in notes or status `active` with note `founding10` (slots are for the **3** design partners; Founding 10 is not limited by the 3-slot UI — use notes or a fourth “overflow” only in docs/spreadsheet).
3. No biweekly requirement; still do kickoff placement proof.

---

## Red flags

- Do not promise Scale SSO / custom domain / multi-workspace (ENG-20/21/39).
- Seed overage with `ATLAS_SANDBOX_DODO_INGEST=true` **bills real Dodo meters**; Clear does not reverse them. Keep ingest **off** for partner workspaces.
- Hybrid Upgrade/Downgrade remounts via checkout — not classic change-plan.

---

## Related

- Outreach templates: `/sales-deck/outreach`
- Training: `/sales-deck/training`
- Coupons: Owner → Discount coupons

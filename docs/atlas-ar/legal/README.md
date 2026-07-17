# Atlas AR — Legal documents (counsel review pack)

**Effective date:** 21 May 2026  
**Entity:** Omni Manual Private Limited (product name: Atlas AR)  
**Canonical in-app source:** [`src/ui/legal-content.ts`](../../src/ui/legal-content.ts)

These markdown files mirror the live Terms, Privacy Policy, and Acceptable Use Policy shown at `/legal/*`. Update `legal-content.ts` first, then sync these files before external legal review.

## Review checklist

- [ ] Confirm registered company name and address for Omni Manual Private Limited
- [ ] Confirm governing law (Delaware) and dispute forum
- [ ] Subprocessor list (AWS, Cognito, Stripe when live) — request from engineering
- [ ] Cookie / analytics consent for EU/UK traffic — LEG-2
- [ ] Sector-specific addenda (healthcare, minors) if targeting regulated verticals

## Documents

| File | Route |
|------|-------|
| [TERMS-OF-SERVICE.md](./TERMS-OF-SERVICE.md) | `/legal/terms` |
| [PRIVACY-POLICY.md](./PRIVACY-POLICY.md) | `/legal/privacy` |
| [ACCEPTABLE-USE.md](./ACCEPTABLE-USE.md) | `/legal/acceptable-use` |

## Contacts

- Legal: legal@atlas-ar.com  
- Privacy: privacy@atlas-ar.com  
- Grievance (India DPDPA): grievance@atlas-ar.com  

**Disclaimer:** These documents are operational drafts for transparency and counsel review. They are not legal advice.

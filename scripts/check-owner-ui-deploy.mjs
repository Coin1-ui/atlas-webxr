#!/usr/bin/env node
const DEPLOY =
  process.env.ATLAS_DEPLOY_URL?.replace(/\/$/, "") ||
  "https://main.d3t9wmef56h86w.amplifyapp.com";
const home = await fetch(`${DEPLOY}/`).then((r) => r.text());
// Vite emits the entry chunk as `main-*.js` (multi-input) or `index-*.js`.
const scriptMatch = home.match(/src="(\/assets\/(?:main|index)-[^"]+\.js)"/);
const js = scriptMatch
  ? await fetch(`${DEPLOY}${scriptMatch[1]}`).then((r) => r.text())
  : "";
console.log(
  JSON.stringify(
    {
      deployUrl: DEPLOY,
      bundle: scriptMatch ? scriptMatch[1] : null,
      // Owner dashboard markers
      hasDeleteCustomerButton: js.includes("Delete account") && js.includes("data-delete-customer"),
      hasPlatformOwnerBadge: js.includes("Platform owner"),
      hasProtectedFromDeletion: js.includes("protectedFromDeletion"),
      // Post-28 frontend markers (coupon promo + Subscribe/Upgrade matrix + billing upgrade)
      hasCouponPricingBadge: js.includes("On pricing banner"),
      hasShowOnPricing: js.includes("showOnPricing"),
      hasBillingUpgrade: js.includes("billing/upgrade"),
      hasSubscribeVerb: js.includes("Subscribe"),
      // Batch 34 — owner customer emails
      hasOwnerEmailColumn: js.includes("Owner email"),
      hasOwnerEmailLink: js.includes("owner-email-link"),
    },
    null,
    2,
  ),
);

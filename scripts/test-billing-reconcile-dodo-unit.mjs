#!/usr/bin/env node
import assert from "node:assert/strict";
import { dodoLiveDivergesFromAtlas } from "../backend/lambda/atlas-api/lib/billing-reconcile-dodo.mjs";

assert.equal(
  dodoLiveDivergesFromAtlas(
    { status: "active", cancelAtPeriodEnd: false },
    { status: "cancelled", cancel_at_next_billing_date: false },
  ),
  true,
);

assert.equal(
  dodoLiveDivergesFromAtlas(
    { status: "active", cancelAtPeriodEnd: false },
    { status: "active", cancel_at_next_billing_date: true },
  ),
  true,
);

assert.equal(
  dodoLiveDivergesFromAtlas(
    { status: "active", cancelAtPeriodEnd: true },
    { status: "active", cancel_at_next_billing_date: true },
  ),
  false,
);

assert.equal(
  dodoLiveDivergesFromAtlas(
    { status: "expired", cancelAtPeriodEnd: false },
    { status: "cancelled", cancel_at_next_billing_date: false },
  ),
  false,
);

console.log("test-billing-reconcile-dodo-unit: PASS");

#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  DODO_BILLING_COUNTRIES,
  billingCountryOptions,
  formatBillingCountryLabel,
  isSupportedBillingCountry,
} from "../src/shared/dodo-billing-countries.ts";

assert.ok(DODO_BILLING_COUNTRIES.length > 100, "expected a large Dodo country list");
assert.equal(isSupportedBillingCountry("US"), true);
assert.equal(isSupportedBillingCountry("IN"), true);
assert.equal(isSupportedBillingCountry("XX"), false);
assert.equal(isSupportedBillingCountry("", "dodo"), false);
assert.equal(isSupportedBillingCountry("US", "zoho"), false);
assert.equal(isSupportedBillingCountry("IN", "zoho"), true);
assert.deepEqual(billingCountryOptions("zoho"), [{ code: "IN", name: "India" }]);
assert.match(formatBillingCountryLabel({ code: "US", name: "United States" }), /^US — /);

const sorted = [...DODO_BILLING_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, "en"));
assert.deepEqual(DODO_BILLING_COUNTRIES, sorted, "country list should stay name-sorted");

console.log("test:dodo-billing-countries-unit — OK");

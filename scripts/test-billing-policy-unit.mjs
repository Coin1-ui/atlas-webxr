#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  assertProviderPaymentCurrency,
  billingCurrencyForProvider,
  planChangeEffectiveAt,
  providerForBillingCountry,
} from "../backend/lambda/atlas-api/lib/billing-policy.mjs";

assert.equal(providerForBillingCountry("IN"), "zoho");
assert.equal(providerForBillingCountry("in"), "zoho");
assert.equal(providerForBillingCountry("US"), "dodo");
assert.equal(providerForBillingCountry("GB"), "dodo");

assert.equal(billingCurrencyForProvider("dodo"), "USD");
assert.equal(billingCurrencyForProvider("zoho"), "INR");
assert.equal(assertProviderPaymentCurrency("dodo", "usd"), "USD");
assert.equal(assertProviderPaymentCurrency("zoho", "INR"), "INR");
assert.throws(() => assertProviderPaymentCurrency("dodo", "INR"));
assert.throws(() => assertProviderPaymentCurrency("zoho", "USD"));

assert.equal(planChangeEffectiveAt("starter", "growth"), "next_billing_date");
assert.equal(planChangeEffectiveAt("growth", "launch"), "next_billing_date");
assert.throws(() => planChangeEffectiveAt("launch", "launch"));
assert.throws(() => planChangeEffectiveAt("scale", "growth"));

console.log("test:billing-policy-unit — OK");

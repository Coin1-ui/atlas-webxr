#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  assertProviderPaymentCurrency,
  billingCurrencyForProvider,
  planChangeEffectiveAt,
  providerForBillingCountry,
} from "../backend/lambda/atlas-api/lib/billing-policy.mjs";

const prevZoho = process.env.ATLAS_ZOHO_CHECKOUT_ENABLED;
delete process.env.ATLAS_ZOHO_CHECKOUT_ENABLED;

assert.equal(providerForBillingCountry("IN"), "dodo");
assert.equal(providerForBillingCountry("in"), "dodo");
assert.equal(providerForBillingCountry("US"), "dodo");
assert.equal(providerForBillingCountry("GB"), "dodo");

process.env.ATLAS_ZOHO_CHECKOUT_ENABLED = "true";
assert.equal(providerForBillingCountry("IN"), "zoho");
assert.equal(providerForBillingCountry("in"), "zoho");
assert.equal(providerForBillingCountry("US"), "dodo");

if (prevZoho === undefined) delete process.env.ATLAS_ZOHO_CHECKOUT_ENABLED;
else process.env.ATLAS_ZOHO_CHECKOUT_ENABLED = prevZoho;

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

#!/usr/bin/env node
/**
 * Live billing/usage diagnose — pass token via env, never commit tokens.
 *   set ATLAS_ID_TOKEN=... && node scripts/diagnose-overage-live.mjs
 */
const API = process.env.ATLAS_API_URL || "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const token = process.env.ATLAS_ID_TOKEN || process.argv[2];
if (!token) {
  console.error("Usage: ATLAS_ID_TOKEN=... node scripts/diagnose-overage-live.mjs");
  process.exit(1);
}

function parts(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* raw */
  }
  return { status: res.status, json, text: text.slice(0, 800) };
}

const claims = parts(token);
console.log("token.email=", claims?.email);
console.log("token.exp=", claims?.exp ? new Date(claims.exp * 1000).toISOString() : null);
console.log("token.expired=", claims?.exp ? Date.now() / 1000 > claims.exp : null);

const me = await req("/v2/me/workspaces");
console.log("\nGET /v2/me/workspaces", me.status);
if (!me.json) {
  console.log(me.text);
  process.exit(1);
}
const list = Array.isArray(me.json) ? me.json : me.json.workspaces || me.json.items || [];
console.log(
  "workspaces=",
  list.map((w) => ({ id: w.id, slug: w.slug, name: w.name, billingStatus: w.billingStatus, billingTier: w.billingTier || w.billingEntitlementTier }))
);

for (const w of list.slice(0, 5)) {
  const id = w.id;
  console.log(`\n=== workspace ${w.slug || id} ===`);
  const usage = await req(`/v2/workspaces/${id}/usage`);
  console.log("GET usage", usage.status);
  if (usage.json) {
    const u = usage.json;
    console.log({
      month: u.usage?.month,
      sessions: `${u.usage?.sessionCount} / ${u.limits?.sessionsPerMonth}`,
      effectiveSessions: u.effectiveLimits?.sessionsPerMonth,
      overagePaid: u.overagePaid,
      overageAccepted: u.overageAccepted,
      overageAmountUsd: u.overageAmountUsd,
      overageHasPayment: u.overageHasPayment,
      overageSandbox: u.overageSandbox,
      sandboxSeedEnabled: u.sandboxSeedEnabled,
      sandboxClearAvailable: u.sandboxClearAvailable,
      usageIsSandboxSeeded: u.usageIsSandboxSeeded,
      sandboxSeededAt: u.sandboxSeededAt,
    });
  } else console.log(usage.text);

  const overageGet = await req(`/v2/workspaces/${id}/billing/overage`);
  console.log("GET billing/overage", overageGet.status, {
    status: overageGet.json?.status,
    overagePaid: overageGet.json?.overagePaid,
    amountUsd: overageGet.json?.amountUsd,
    clearable: overageGet.json?.clearable,
    overageHasPayment: overageGet.json?.overageHasPayment,
    paymentId: overageGet.json?.paymentId,
  });

  const clear = await req(`/v2/workspaces/${id}/billing/overage`, {
    method: "POST",
    body: JSON.stringify({ clearTestOverage: true, force: true }),
  });
  console.log("POST clearTestOverage force", clear.status, clear.json || clear.text);

  if (clear.status >= 400) {
    const sandbox = await req(`/v2/workspaces/${id}/sandbox/usage`, {
      method: "POST",
      body: JSON.stringify({ resetAll: true, force: true }),
    });
    console.log("POST sandbox resetAll force", sandbox.status, sandbox.json || sandbox.text);
  }
}

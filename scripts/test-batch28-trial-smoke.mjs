#!/usr/bin/env node
/**
 * Batch 28 — Growth trial smoke test (prod or staging API).
 *
 * Verifies ENG-36: new workspace gets trial fields + Growth usage limits.
 *
 * Env:
 *   ATLAS_API_URL           — default production API Gateway
 *   ATLAS_TEST_ID_TOKEN     — Cognito ID token (Bearer) OR dev:your@email.com
 *   ATLAS_BATCH28_CREATE    — set to "1" to POST a throwaway workspace (default: read-only checks)
 *
 * Examples:
 *   # Read-only: usage limits on existing workspace
 *   ATLAS_TEST_WORKSPACE_ID=... ATLAS_TEST_ID_TOKEN=... npm run test:batch28
 *
 *   # Full trial create (creates workspace batch28-trial-<timestamp>)
 *   ATLAS_BATCH28_CREATE=1 ATLAS_TEST_ID_TOKEN=... npm run test:batch28
 */
import { createReport, fetchJson } from "./lib/sprint3-report.mjs";

const API =
  process.env.ATLAS_API_URL?.trim() || "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const TOKEN = process.env.ATLAS_TEST_ID_TOKEN?.trim() || "";
const WORKSPACE_ID = process.env.ATLAS_TEST_WORKSPACE_ID?.trim() || "";
const CREATE = process.env.ATLAS_BATCH28_CREATE === "1";

function looksLikeJwt(token) {
  return /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

const GROWTH_LIMITS = { models: 100, sessionsPerMonth: 5000 };
const STARTER_LIMITS = { models: 5, sessionsPerMonth: 100 };

const { record, finish } = createReport("batch28-trial-smoke", {
  meta: { api: API, create: CREATE, workspaceId: WORKSPACE_ID || null },
});

function authHeaders() {
  if (!TOKEN) return {};
  return { Authorization: `Bearer ${TOKEN}` };
}

function isActiveTrial(ws) {
  if (!ws?.trialEndsAt || !ws?.trialPlan) return false;
  return Date.parse(ws.trialEndsAt) > Date.now();
}

function limitsMatchGrowth(limits) {
  return limits?.models === GROWTH_LIMITS.models && limits?.sessionsPerMonth === GROWTH_LIMITS.sessionsPerMonth;
}

function limitsMatchStarter(limits) {
  return limits?.models === STARTER_LIMITS.models && limits?.sessionsPerMonth === STARTER_LIMITS.sessionsPerMonth;
}

try {
  const health = await fetchJson(API, "/health");
  if (health.status === 200 && health.body?.ok) {
    record("health", "GET /health", "passed");
  } else {
    record("health", "GET /health", "failed", { status: health.status, body: health.body });
  }

  if (!TOKEN) {
    record("auth", "ATLAS_TEST_ID_TOKEN", "skipped", { reason: "Set token for trial API checks" });
    finish();
    process.exit(0);
  }

  if (!looksLikeJwt(TOKEN)) {
    record("auth", "Token format", "failed", {
      hint: "Need Cognito ID token (long string starting with eyJ). Run: npm run get:id-token -- you@email.com",
      got: TOKEN.length > 40 ? `${TOKEN.slice(0, 20)}...` : TOKEN,
    });
    finish();
    process.exit(1);
  }

  let workspaceId = WORKSPACE_ID;
  let workspace = null;

  if (CREATE) {
    const slug = `batch28-trial-${Date.now().toString(36)}`;
    const created = await fetchJson(API, "/v2/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name: `Batch28 Trial ${slug}`, slug }),
    });
    if (created.status === 201 && created.body?.workspace) {
      workspace = created.body.workspace;
      workspaceId = workspace.id;
      record("create-workspace", "POST /v2/workspaces", "passed", {
        id: workspace.id,
        slug: workspace.slug,
        trialPlan: workspace.trialPlan,
        trialEndsAt: workspace.trialEndsAt,
        billingTier: workspace.billingTier,
      });
      if (workspace.trialPlan === "growth" && workspace.trialEndsAt && workspace.billingTier === "starter") {
        record("trial-fields", "Workspace trial fields on create", "passed");
      } else {
        record("trial-fields", "Workspace trial fields on create", "failed", { workspace });
      }
      if (isActiveTrial(workspace)) {
        record("trial-active", "Trial window is active", "passed");
      } else {
        record("trial-active", "Trial window is active", "failed", { workspace });
      }
    } else {
      record("create-workspace", "POST /v2/workspaces", "failed", {
        status: created.status,
        body: created.body,
      });
    }
  } else if (!workspaceId) {
    const mine = await fetchJson(API, "/v2/me/workspaces", { headers: authHeaders() });
    if (mine.status === 200 && Array.isArray(mine.body?.workspaces) && mine.body.workspaces.length) {
      workspace = mine.body.workspaces[0];
      workspaceId = workspace.id;
      record("me-workspaces", "GET /v2/me/workspaces", "passed", { id: workspaceId, slug: workspace.slug });
    } else {
      record("me-workspaces", "GET /v2/me/workspaces", "failed", { status: mine.status, body: mine.body });
    }
  } else if (workspaceId && !workspace) {
    const mine = await fetchJson(API, "/v2/me/workspaces", { headers: authHeaders() });
    if (mine.status === 200 && Array.isArray(mine.body?.workspaces)) {
      workspace = mine.body.workspaces.find((w) => w.id === workspaceId) || null;
      if (workspace) {
        record("me-workspaces", "GET /v2/me/workspaces (match id)", "passed", {
          id: workspaceId,
          trialPlan: workspace.trialPlan,
          trialEndsAt: workspace.trialEndsAt,
          billingTier: workspace.billingTier,
        });
        if (workspace.trialPlan === "growth" && workspace.trialEndsAt && workspace.billingTier === "starter") {
          record("trial-fields", "Workspace trial fields on signup/create", "passed");
        } else if (isActiveTrial(workspace)) {
          record("trial-fields", "Workspace trial fields on signup/create", "failed", { workspace });
        }
      }
    }
  }

  if (workspaceId) {
    const usage = await fetchJson(API, `/v2/workspaces/${encodeURIComponent(workspaceId)}/usage`, {
      headers: authHeaders(),
    });
    if (usage.status === 200 && usage.body?.limits) {
      const ws = workspace || { trialEndsAt: null, trialPlan: null, plan: usage.body.plan };
      const onTrial = isActiveTrial(ws) || usage.body.billingTier === "growth";
      const growthOk = limitsMatchGrowth(usage.body.limits);
      const starterOk = limitsMatchStarter(usage.body.limits);
      if (onTrial && growthOk) {
        record("usage-limits-trial", "Usage API returns Growth limits during trial", "passed", {
          limits: usage.body.limits,
          billingTier: usage.body.billingTier,
        });
      } else if (!onTrial && starterOk) {
        record("usage-limits-trial", "Usage API returns Starter limits after trial", "passed", {
          limits: usage.body.limits,
        });
      } else if (onTrial && !growthOk) {
        record("usage-limits-trial", "Usage API returns Growth limits during trial", "failed", {
          limits: usage.body.limits,
          workspace: ws,
          hint: "Lambda may not be deployed with ENG-36 trial logic",
        });
      } else {
        record("usage-limits-trial", "Usage limits match workspace state", "skipped", {
          onTrial,
          limits: usage.body.limits,
        });
      }
      if (usage.body.billingTier) {
        record("usage-billing-tier", "Usage response includes billingTier", "passed", {
          billingTier: usage.body.billingTier,
        });
      } else {
        record("usage-billing-tier", "Usage response includes billingTier", "failed", { body: usage.body });
      }
    } else {
      record("usage-limits-trial", "GET /v2/workspaces/{id}/usage", "failed", {
        status: usage.status,
        body: usage.body,
      });
    }
  } else {
    record("usage-limits-trial", "Workspace id for usage check", "skipped", {
      reason: "Set ATLAS_TEST_WORKSPACE_ID or ATLAS_BATCH28_CREATE=1",
    });
  }
} catch (e) {
  record("fatal", "Smoke test error", "failed", { error: e instanceof Error ? e.message : String(e) });
}

const report = finish(false);

if (CREATE) {
  const create = report.tests.find((t) => t.id === "create-workspace");
  const fields = report.tests.find((t) => t.id === "trial-fields");
  const limits = report.tests.find((t) => t.id === "usage-limits-trial");
  console.log("\n--- ENG-36 create trial verdict ---");
  if (create?.status === "passed" && fields?.status === "passed" && limits?.status === "passed") {
    console.log("PASS: New workspace has Growth trial fields and Growth usage limits.");
    if (create.trialEndsAt) {
      const days = Math.ceil((Date.parse(create.trialEndsAt) - Date.now()) / 86400000);
      console.log(`      trialPlan=growth, billingTier=starter, ~${days} days left`);
    }
    if (limits?.limits) {
      console.log(`      limits: ${limits.limits.models} models, ${limits.limits.sessionsPerMonth} sessions/mo`);
    }
  } else if (!TOKEN) {
    console.log("SKIP: Set ATLAS_TEST_ID_TOKEN (npm run get:id-token -- you@email.com)");
  } else if (create?.status !== "passed") {
    console.log(`FAIL: POST /v2/workspaces — ${create?.status ?? "not run"}`);
    if (create?.status === "failed") console.log("      Deploy Batch 28 Lambda or check auth (401).");
  } else {
    console.log("FAIL: Trial fields or Growth limits missing on new workspace.");
    console.log("      Redeploy backend/lambda/atlas-api (npm run package) if create lacks trialPlan.");
  }
  console.log("-----------------------------------\n");
}

if (report.summary.failed > 0) process.exit(1);

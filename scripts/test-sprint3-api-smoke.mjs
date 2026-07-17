#!/usr/bin/env node
/**
 * QA Sprint 3 — API smoke (health, public-config, catalog, analytics, usage).
 *
 * Env:
 *   ATLAS_API_URL              — default: production API Gateway
 *   ATLAS_TEST_WORKSPACE_SLUG  — tenant slug for live tests (optional)
 *   ATLAS_TEST_WORKSPACE_ID    — workspace UUID for usage API (optional)
 *   ATLAS_TEST_ID_TOKEN        — Cognito ID token or dev:sub for usage (optional)
 */
import { createReport, fetchJson } from "./lib/sprint3-report.mjs";

const API =
  process.env.ATLAS_API_URL?.trim() ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const SLUG = process.env.ATLAS_TEST_WORKSPACE_SLUG?.trim() || "";
const WORKSPACE_ID = process.env.ATLAS_TEST_WORKSPACE_ID?.trim() || "";
const ID_TOKEN = process.env.ATLAS_TEST_ID_TOKEN?.trim() || "";

const { record, finish } = createReport("sprint3-api-smoke", {
  meta: { api: API, slug: SLUG || null, workspaceId: WORKSPACE_ID || null },
});

try {
  const health = await fetchJson(API, "/health");
  if (health.status === 200 && health.body?.ok) {
    record("api-health", "GET /health", "passed", { body: health.body });
  } else {
    record("api-health", "GET /health", "failed", { status: health.status, body: health.body });
  }

  const missing = await fetchJson(API, "/v2/workspaces/__no_such_slug__/public-config");
  if (missing.status === 404) {
    record("api-public-config-404", "Unknown slug returns 404", "passed");
  } else {
    record("api-public-config-404", "Unknown slug returns 404", "failed", {
      status: missing.status,
      body: missing.body,
    });
  }

  if (SLUG) {
    const config = await fetchJson(API, `/v2/workspaces/${encodeURIComponent(SLUG)}/public-config`);
    if (config.status === 200 && config.body?.slug === SLUG) {
      record("api-public-config", "GET public-config for test slug", "passed", {
        name: config.body.name,
        plan: config.body.plan,
      });
    } else {
      record("api-public-config", "GET public-config for test slug", "failed", {
        status: config.status,
        body: config.body,
      });
    }

    const catalog = await fetchJson(API, `/v2/workspaces/${encodeURIComponent(SLUG)}/catalog`);
    if (catalog.status === 200 && Array.isArray(catalog.body?.models)) {
      record("api-public-catalog", "GET public catalog", "passed", {
        modelCount: catalog.body.models.length,
      });
    } else {
      record("api-public-catalog", "GET public catalog", "failed", {
        status: catalog.status,
        body: catalog.body,
      });
    }

    const sessionId = crypto.randomUUID();
    const analytics = await fetchJson(
      API,
      `/v2/workspaces/${encodeURIComponent(SLUG)}/analytics/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          events: [
            { type: "session_start", at: new Date().toISOString() },
            { type: "placement", at: new Date().toISOString(), modelId: "smoke-test" },
            {
              type: "session_end",
              at: new Date().toISOString(),
              placementCount: 1,
              durationMs: 1200,
            },
          ],
        }),
      }
    );
    if (analytics.status === 202 && analytics.body?.ok) {
      record("api-analytics", "POST analytics events (qualified session)", "passed", {
        sessionCounted: analytics.body.sessionCounted,
      });
    } else {
      record("api-analytics", "POST analytics events (qualified session)", "failed", {
        status: analytics.status,
        body: analytics.body,
      });
    }
  } else {
    record("api-public-config", "GET public-config for test slug", "skipped", {
      reason: "Set ATLAS_TEST_WORKSPACE_SLUG to run tenant API checks against AWS.",
    });
    record("api-public-catalog", "GET public catalog", "skipped", {
      reason: "Set ATLAS_TEST_WORKSPACE_SLUG",
    });
    record("api-analytics", "POST analytics events", "skipped", {
      reason: "Set ATLAS_TEST_WORKSPACE_SLUG",
    });
  }

  const usageTarget = WORKSPACE_ID || "ws-smoke-unauthorized";
  const usageNoAuth = await fetchJson(API, `/v2/workspaces/${encodeURIComponent(usageTarget)}/usage`);
  if (usageNoAuth.status === 401 || usageNoAuth.status === 403) {
    record("api-usage-unauth", "GET usage without token is rejected", "passed", {
      status: usageNoAuth.status,
    });
  } else {
    record("api-usage-unauth", "GET usage without token is rejected", "failed", {
      status: usageNoAuth.status,
      body: usageNoAuth.body,
    });
  }

  if (WORKSPACE_ID && ID_TOKEN) {
    const usage = await fetchJson(
      API,
      `/v2/workspaces/${encodeURIComponent(WORKSPACE_ID)}/usage`,
      { headers: { Authorization: `Bearer ${ID_TOKEN}` } }
    );
    if (
      usage.status === 200 &&
      usage.body?.usage &&
      usage.body?.limits &&
      typeof usage.body.usage.storageBytes === "number"
    ) {
      record("api-usage-auth", "GET usage with admin token", "passed", {
        plan: usage.body.plan,
        modelCount: usage.body.usage.modelCount,
        sessionCount: usage.body.usage.sessionCount,
        storageBytes: usage.body.usage.storageBytes,
      });
    } else {
      record("api-usage-auth", "GET usage with admin token", "failed", {
        status: usage.status,
        body: usage.body,
      });
    }
  } else {
    record("api-usage-auth", "GET usage with admin token", "skipped", {
      reason: "Set ATLAS_TEST_WORKSPACE_ID + ATLAS_TEST_ID_TOKEN for authenticated usage check.",
    });
  }
} catch (e) {
  record("api-fatal", "API smoke harness", "failed", {
    error: e instanceof Error ? e.message : String(e),
  });
}

finish(true);

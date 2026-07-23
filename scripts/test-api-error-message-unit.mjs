import assert from "node:assert/strict";
import { apiErrorMessage } from "../src/shared/api-error-message.ts";

assert.equal(
  apiErrorMessage('{"message":"Internal Server Error"}', 500),
  "Atlas service is temporarily unavailable. Please try again in a moment.",
);
assert.equal(
  apiErrorMessage('{"error":"Workspace suspended — subscribe to restore service"}', 403),
  "Workspace suspended — subscribe to restore service",
);
assert.equal(apiErrorMessage("", 503), "Atlas service is temporarily unavailable. Please try again in a moment.");

console.log("test-api-error-message-unit: PASS");

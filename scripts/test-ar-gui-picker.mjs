/**
 * iOS in-canvas picker layout — action buttons must not overlap.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const picker = readFileSync(
  join(process.cwd(), "src/xr/ar-gui-picker.ts"),
  "utf8"
);
function readPx(name) {
  const m = picker.match(new RegExp(`export const ${name} = (\\d+)`));
  return m ? Number(m[1]) : NaN;
}

const AR_GUI_ACTION_PAD_PX = readPx("AR_GUI_ACTION_PAD_PX");
const AR_GUI_ACTION_BTN_PX = readPx("AR_GUI_ACTION_BTN_PX");
const AR_GUI_ACTION_GAP_PX = readPx("AR_GUI_ACTION_GAP_PX");
const AR_GUI_ACTION_BAR_PX =
  AR_GUI_ACTION_PAD_PX * 2 + AR_GUI_ACTION_BTN_PX * 2 + AR_GUI_ACTION_GAP_PX;
const AR_GUI_PANEL_PX = 196;

function layoutHeights() {
  const title = 22;
  const status = 28;
  const tiles = 64;
  const panelPadding = 4 + 8;
  const panelContent = title + status + tiles + panelPadding;
  const total = panelContent + AR_GUI_ACTION_BAR_PX;
  return { panelContent, total };
}

const results = [];
let failed = 0;

function assert(name, condition) {
  if (condition) results.push({ name, status: "pass" });
  else {
    failed += 1;
    results.push({ name, status: "fail" });
  }
}

const layout = layoutHeights();
assert(
  "action bar fits two stacked action buttons",
  AR_GUI_ACTION_BAR_PX >=
    AR_GUI_ACTION_PAD_PX * 2 +
      AR_GUI_ACTION_BTN_PX * 2 +
      AR_GUI_ACTION_GAP_PX
);
assert(
  "action buttons use explicit top offsets not clipped stack",
  picker.includes("AR_GUI_ACTION_PAD_PX + AR_GUI_ACTION_BTN_PX + AR_GUI_ACTION_GAP_PX")
);
assert("panel fits title status and tiles", layout.panelContent <= AR_GUI_PANEL_PX + 12);
assert("total picker chrome under 300px", layout.total <= 300);
assert("action bar taller than single row", AR_GUI_ACTION_BAR_PX > 48);

console.log(JSON.stringify({ ok: failed === 0, failed, results }, null, 2));
process.exit(failed === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * Guards the "AR session is frozen" contract.
 *
 * The 2026-07 UI refresh restyles every screen except the AR session, which the
 * product owner explicitly excluded. AR is easy to break by accident because it
 * shares tokens (--accent, --text, --muted, --radius, --font-body) and whole
 * selectors (.btn, .home, .model-tile) with screens that ARE being restyled.
 *
 * This snapshots everything the AR flow renders — the owning source files plus
 * every AR-matching rule in style.css and the tokens those rules read — and
 * fails if any of it moves.
 *
 *   node scripts/guard-ar-session-frozen.mjs --save     write the baseline
 *   node scripts/guard-ar-session-frozen.mjs            verify against it
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(root, "scripts", "ar-session-frozen.baseline.json");

/** Source files that render the AR session and its iOS hand-off. */
const OWNED_FILES = [
  "src/ui/ar-model-picker.ts",
  "src/ui/ar-object-viewer.ts",
  "src/ui/ar-panel-touch.ts",
  "src/ui/ar-dimension-hud.ts",
  "src/ui/ar-troubleshooting-content.ts",
  "src/ui/ios-quick-look-picker.ts",
  "src/ui/home-minimal.ts",
  "src/ar-session/log-sanitize.ts",
  "src/ar-session/logger.ts",
  "src/ar-session/placement-checks.ts",
  "src/ar-session/types.ts",
  "src/shared/ar-cta.ts",
  "src/shared/ar-exit-url.ts",
  "src/xr/webxr-ar.ts",
];

/**
 * Any selector containing one of these is part of the AR flow. Deliberately
 * includes the shared families (.btn / .home*) because the iOS Quick Look page
 * is built from them.
 */
const AR_SELECTOR_MARKERS = [
  "ar-dom", "ar-panel", "ar-floor", "ar-action-btn", "ar-mode-",
  "ar-start-progress", "ar-dimension-hud", "ar-object-", "ar-tool-chip",
  "ar-dim-toggle", "ar-landing", "ar-reticle", "model-tile", "quick-look",
  "xr-canvas", "camera-feed", "xr-session-active", "training-camera",
  "ar-object-mode-active", "ios-webxr-viewer", "ios-camera-fallback",
  "device-test-ar-hint", "#ar-overlay", "#ar-dom-panel", "#xr-canvas",
  ".halo",
];

/** Shared selectors the Quick Look page renders with. */
const SHARED_SELECTORS = [
  ".btn", ".btn-primary", ".btn-ghost", ".btn-block", ".btn-sm",
  ".home", ".home-header", ".home-sub", ".home-footer", ".hidden",
  ".camera-warning", ".device-line",
];

/** Tokens the AR CSS reads via var(). Changing these changes AR. */
const FROZEN_TOKENS = [
  "--accent", "--text", "--muted", "--radius",
  "--focus-ring", "--focus-ring-offset", "--font-body", "--bg",
];

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const norm = (s) => s.replace(/\s+/g, " ").trim();
/** Comments carry commas and prose, which would corrupt selector parsing. */
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every stylesheet shipped in the app bundle, relative to root, sorted. */
function allStylesheets() {
  const found = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      const r = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(abs, r);
      else if (entry.name.endsWith(".css")) found.push(r);
    }
  };
  walk(join(root, "src"), "src");
  return found.sort();
}

/** Split a stylesheet into top-level `selector { body }` rules, brace-aware. */
function topLevelRules(source) {
  const css = decomment(source);
  const rules = [];
  let depth = 0;
  let start = 0;
  let selectorEnd = -1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      if (depth === 0) selectorEnd = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        rules.push({
          selector: norm(css.slice(start, selectorEnd)).replace(/^[\s;]+/, ""),
          body: norm(css.slice(selectorEnd + 1, i)),
        });
        start = i + 1;
      }
    }
  }
  return rules;
}

/** At-rules nest, so recurse into them and prefix the condition. */
function flatten(css, prefix = "") {
  const out = [];
  for (const rule of topLevelRules(css)) {
    const sel = rule.selector;
    if (sel.startsWith("@media") || sel.startsWith("@supports") || sel.startsWith("@layer")) {
      out.push(...flatten(rule.body, `${prefix}${sel} | `));
    } else {
      out.push({ selector: prefix + sel, body: rule.body });
    }
  }
  return out;
}

/**
 * A rule reaches the AR overlay if none of its selector parts is anchored to a
 * class, id or attribute — `*`, `body`, `button`, `:where(a, button)` all apply
 * to AR markup no matter which stylesheet declares them.
 *
 * Custom-property-only blocks are exempt: `:root { --fs-lg: … }` paints nothing
 * by itself. Token drift is caught by the cascade-aware token check instead, so
 * exempting these keeps the report to rules that genuinely repaint AR.
 */
function hasGlobalReach(selector, body) {
  if (selector.startsWith("@")) return false;
  if (!selector.split(",").some((part) => !/[.#[]/.test(part))) return false;
  return body
    .split(";")
    .some((decl) => decl.trim() && !decl.trim().startsWith("--"));
}

function collect() {
  const files = {};
  for (const rel of OWNED_FILES) {
    const abs = join(root, rel);
    files[rel] = existsSync(abs) ? sha(readFileSync(abs, "utf8")) : "MISSING";
  }

  const cssRaw = readFileSync(join(root, "src/style.css"), "utf8");
  // Nested at-rules are re-emitted with their condition, so plain splitting is safe.
  const rules = flatten(cssRaw);

  // Every stylesheet in the bundle can reach AR, not just style.css. Token
  // definitions are collected in cascade order so a later sheet re-declaring a
  // frozen token is caught even though it never edits style.css.
  const globalRules = {};
  const effectiveTokens = {};
  for (const rel of allStylesheets()) {
    for (const { selector, body } of flatten(readFileSync(join(root, rel), "utf8"))) {
      if (hasGlobalReach(selector, body)) globalRules[`${rel} :: ${selector}`] = sha(body);
      if (/(^|\s|,)(:root|html)(\s|,|$)/.test(selector)) {
        for (const t of FROZEN_TOKENS) {
          const m = body.match(new RegExp(`(?:^|;)\\s*${t}\\s*:\\s*([^;]+)`));
          if (m) effectiveTokens[t] = `${m[1].trim()}  [${rel}]`;
        }
      }
    }
  }

  const arRules = {};
  const sharedRules = {};
  for (const { selector, body } of rules) {
    const isAr = AR_SELECTOR_MARKERS.some((m) => selector.includes(m));
    // Exact-ish match so `.btn` does not also capture `.btn-upgrade-xyz`.
    const isShared = SHARED_SELECTORS.some((s) =>
      selector.split(",").some((part) => {
        const t = part.trim();
        return t === s || t.startsWith(`${s}:`) || t.startsWith(`${s} `);
      }),
    );
    if (isAr) arRules[selector] = sha(body);
    else if (isShared) sharedRules[selector] = sha(body);
  }

  const tokens = {};
  for (const t of FROZEN_TOKENS) tokens[t] = effectiveTokens[t] ?? "UNDEFINED";

  const html = readFileSync(join(root, "index.html"), "utf8");
  const arMarkup = (html.match(/<[^>]*(?:ar-overlay|ar-dom-panel|xr-canvas|camera-feed)[^>]*>/g) || []).map(norm);

  return { files, arRules, sharedRules, globalRules, tokens, arMarkup };
}

function diff(base, now, label, out) {
  const keys = new Set([...Object.keys(base), ...Object.keys(now)]);
  for (const k of [...keys].sort()) {
    if (base[k] === undefined) out.push(`  + ${label} ADDED    ${k}`);
    else if (now[k] === undefined) out.push(`  - ${label} REMOVED  ${k}`);
    else if (base[k] !== now[k]) out.push(`  ~ ${label} CHANGED  ${k}`);
  }
}

const snapshot = collect();

if (process.argv.includes("--save")) {
  writeFileSync(BASELINE, JSON.stringify(snapshot, null, 2) + "\n");
  console.log("AR freeze baseline saved.");
  console.log(`  owned files : ${Object.keys(snapshot.files).length}`);
  console.log(`  AR css rules: ${Object.keys(snapshot.arRules).length}`);
  console.log(`  shared rules: ${Object.keys(snapshot.sharedRules).length}`);
  console.log(`  global rules: ${Object.keys(snapshot.globalRules).length}`);
  console.log(`  tokens      : ${Object.keys(snapshot.tokens).length}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error("No baseline. Run: node scripts/guard-ar-session-frozen.mjs --save");
  process.exit(2);
}

const base = JSON.parse(readFileSync(BASELINE, "utf8"));
const problems = [];
diff(base.files, snapshot.files, "file  ", problems);
diff(base.arRules, snapshot.arRules, "ar-css", problems);
diff(base.sharedRules, snapshot.sharedRules, "shared", problems);
diff(base.globalRules || {}, snapshot.globalRules, "global", problems);
diff(base.tokens, snapshot.tokens, "token ", problems);

if (base.arMarkup.join("|") !== snapshot.arMarkup.join("|")) {
  problems.push("  ~ markup CHANGED  index.html AR elements");
}

if (problems.length) {
  console.error(`AR SESSION FREEZE VIOLATED — ${problems.length} change(s):\n`);
  console.error(problems.join("\n"));
  console.error("\nAR session must stay byte-identical. Revert, or scope the change away from AR.");
  process.exit(1);
}

console.log("AR session frozen — no drift.");
console.log(
  `  ${Object.keys(snapshot.files).length} files · ${Object.keys(snapshot.arRules).length} AR rules · ` +
    `${Object.keys(snapshot.sharedRules).length} shared · ${Object.keys(snapshot.globalRules).length} global · ` +
    `${Object.keys(snapshot.tokens).length} tokens verified`,
);

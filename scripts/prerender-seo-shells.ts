/**
 * SEO-2: after vite build, write per-route HTML shells so crawlers see
 * correct title/canonical/OG/JSON-LD without executing the SPA.
 *
 * Usage: npx --yes tsx scripts/prerender-seo-shells.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  INDEXABLE_SEO_ROUTES,
  applySeoTagsToHtml,
} from "../src/shared/seo.ts";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(rootDir, "..", "dist");
const templatePath = path.join(distDir, "index.html");

function shellOutPath(routePath: string): string {
  if (routePath === "/") return path.join(distDir, "index.html");
  const segments = routePath.replace(/^\//, "").split("/");
  return path.join(distDir, ...segments, "index.html");
}

function main(): void {
  if (!fs.existsSync(templatePath)) {
    console.error(`prerender-seo: missing ${templatePath} — run vite build first`);
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const written: string[] = [];

  for (const meta of INDEXABLE_SEO_ROUTES) {
    const html = applySeoTagsToHtml(template, meta);
    const out = shellOutPath(meta.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html, "utf8");
    written.push(path.relative(distDir, out).replace(/\\/g, "/"));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        shells: written,
        note: "Amplify must 200-rewrite /pricing → /pricing/index.html (etc.) before SPA catch-all",
      },
      null,
      2,
    ),
  );
}

main();

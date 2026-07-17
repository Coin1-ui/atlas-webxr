import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

/** Serve /sales-deck/ as static index in dev + preview (Vite does not auto-index public dirs). */
export function salesDeckPlugin(): Plugin {
  const redirect = (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: () => void) => {
    const raw = req.url?.split("?")[0] ?? "";
    const base = (process.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
    const deckRoot = `${base}/sales-deck`.replace("//", "/");
    if (raw === deckRoot || raw === `${deckRoot}/`) {
      const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      res.writeHead(302, { Location: `${deckRoot}/index.html${qs}` });
      res.end();
      return;
    }
    const trainingRoot = `${deckRoot}/training`.replace("//", "/");
    if (raw === trainingRoot || raw === `${trainingRoot}/`) {
      const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      res.writeHead(302, { Location: `${deckRoot}/training.html${qs}` });
      res.end();
      return;
    }
    const outreachRoot = `${deckRoot}/outreach`.replace("//", "/");
    if (raw === outreachRoot || raw === `${outreachRoot}/`) {
      const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      res.writeHead(302, { Location: `${deckRoot}/outreach.html${qs}` });
      res.end();
      return;
    }
    const storyboardRoot = `${base}/mkt-3-storyboard`.replace("//", "/");
    if (raw === storyboardRoot || raw === `${storyboardRoot}/`) {
      const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      res.writeHead(302, { Location: `${storyboardRoot}/index.html${qs}` });
      res.end();
      return;
    }
    next();
  };

  const serveIndex = (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: () => void) => {
    const raw = req.url?.split("?")[0] ?? "";
    const base = (process.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
    const indexPath = `${base}/sales-deck/index.html`.replace("//", "/");
    if (raw === indexPath) {
      const file = path.join(process.cwd(), "public", "sales-deck", "index.html");
      if (fs.existsSync(file)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(fs.readFileSync(file));
        return;
      }
    }
    next();
  };

  const stack = (server: { middlewares: { use: (fn: typeof redirect) => void } }) => {
    server.middlewares.use(redirect);
    server.middlewares.use(serveIndex);
  };

  return {
    name: "atlas-sales-deck",
    configureServer: stack,
    configurePreviewServer: stack,
  };
}

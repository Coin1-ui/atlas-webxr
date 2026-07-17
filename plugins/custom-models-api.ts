import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import { IncomingMessage, ServerResponse } from "node:http";
import { convertGlbFileToUsdz } from "../scripts/glb-to-usdz-cli.mjs";

const MODELS_DIR = "custom-models";
const MANIFEST = "manifest.json";

type ManifestModel = {
  id: string;
  name: string;
  builtinType?: string;
  icon?: string;
  glb?: string;
  usdz?: string;
};

function modelsRoot(root: string): string {
  return path.join(root, "public", MODELS_DIR);
}

function readManifest(root: string): { version: number; models: ManifestModel[] } {
  const p = path.join(modelsRoot(root), MANIFEST);
  if (!fs.existsSync(p)) return { version: 1, models: [] };
  return JSON.parse(fs.readFileSync(p, "utf8")) as { version: number; models: ManifestModel[] };
}

function writeManifest(root: string, data: { version: number; models: ManifestModel[] }): void {
  const dir = modelsRoot(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(data, null, 2));
}

function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 48) || `model-${Date.now()}`;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function parseMultipart(
  body: Buffer,
  boundary: string
): { fields: Record<string, string>; files: Record<string, { data: Buffer; filename: string }> } {
  const fields: Record<string, string> = {};
  const files: Record<string, { data: Buffer; filename: string }> = {};
  const parts = body.toString("binary").split(`--${boundary}`);
  for (const part of parts) {
    if (!part || part === "--\r\n" || part === "--") continue;
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const header = part.slice(0, headerEnd);
    const content = part.slice(headerEnd + 4).replace(/\r\n$/, "");
    const nameMatch = /name="([^"]+)"/.exec(header);
    const fileMatch = /filename="([^"]+)"/.exec(header);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    if (fileMatch) {
      files[name] = { data: Buffer.from(content, "binary"), filename: fileMatch[1] };
    } else {
      fields[name] = content;
    }
  }
  return { fields, files };
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

/** Local dev API when VITE_ATLAS_API_URL is not set. */
export function customModelsApiPlugin(): Plugin {
  return {
    name: "custom-models-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/custom-models")) return next();
        const root = server.config.root;
        const url = new URL(req.url, "http://localhost");

        if (req.method === "GET" && url.pathname === "/api/custom-models/manifest") {
          sendJson(res, 200, readManifest(root));
          return;
        }

        if (req.method === "DELETE" && url.pathname.startsWith("/api/custom-models/")) {
          const id = decodeURIComponent(url.pathname.replace("/api/custom-models/", ""));
          if (!id || id.startsWith("builtin-")) {
            sendJson(res, 400, { error: "Cannot delete built-in model" });
            return;
          }
          const manifest = readManifest(root);
          const entry = manifest.models.find((m) => m.id === id);
          manifest.models = manifest.models.filter((m) => m.id !== id);
          writeManifest(root, manifest);
          const dir = modelsRoot(root);
          for (const f of [entry?.icon, entry?.glb, entry?.usdz]) {
            if (f) {
              try {
                fs.unlinkSync(path.join(dir, f));
              } catch {
                /* ignore */
              }
            }
          }
          sendJson(res, 200, { ok: true });
          return;
        }

        if (req.method === "POST" && url.pathname === "/api/custom-models/upload") {
          const ctype = req.headers["content-type"] ?? "";
          const boundaryMatch = /boundary=(.+)$/i.exec(ctype);
          if (!boundaryMatch) {
            sendJson(res, 400, { error: "Expected multipart form" });
            return;
          }
          try {
            const body = await readBody(req);
            const { fields, files } = parseMultipart(body, boundaryMatch[1]);
            const name = (fields.name ?? "Untitled").trim();
            const iconFile = files.icon;
            const glbFile = files.glb;
            const usdzFile = files.usdz;
            if (!iconFile?.data.length || !glbFile?.data.length) {
              sendJson(res, 400, { error: "icon and glb files required" });
              return;
            }
            const id = safeId(fields.id?.trim() || name);
            const iconExt = path.extname(iconFile.filename) || ".png";
            const iconName = `${id}${iconExt}`;
            const glbName = `${id}.glb`;
            const dir = modelsRoot(root);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, iconName), iconFile.data);
            fs.writeFileSync(path.join(dir, glbName), glbFile.data);
            let usdzName: string | undefined;
            if (usdzFile?.data.length) {
              usdzName = `${id}.usdz`;
              fs.writeFileSync(path.join(dir, usdzName), usdzFile.data);
            } else {
              const usdzPath = path.join(dir, `${id}.usdz`);
              const converted = await convertGlbFileToUsdz(
                path.join(dir, glbName),
                usdzPath
              );
              if (converted.ok) {
                usdzName = `${id}.usdz`;
              }
            }
            const manifest = readManifest(root);
            manifest.models = manifest.models.filter((m) => m.id !== id);
            manifest.models.push({
              id,
              name,
              icon: iconName,
              glb: glbName,
              ...(usdzName ? { usdz: usdzName } : {}),
            });
            writeManifest(root, manifest);
            sendJson(res, 200, { ok: true, id });
          } catch (e) {
            sendJson(res, 500, {
              error: e instanceof Error ? e.message : "Upload failed",
            });
          }
          return;
        }

        sendJson(res, 404, { error: "Not found" });
      });
    },
  };
}

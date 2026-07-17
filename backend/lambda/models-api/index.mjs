import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});
const BUCKET = process.env.ATLAS_MODELS_BUCKET;
const PREFIX = process.env.ATLAS_MODELS_PREFIX || "models/";
const MANIFEST_KEY = `${PREFIX}manifest.json`;

const EMPTY_MANIFEST = { version: 1, models: [] };

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function parseJsonBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw);
}

function extFromFilename(name, fallback = ".png") {
  const i = String(name).lastIndexOf(".");
  return i >= 0 ? String(name).slice(i) : fallback;
}

function iconContentType(ext) {
  const e = ext.toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".webp") return "image/webp";
  return "image/png";
}

async function presignPut(key, contentType) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 900 }
  );
}

async function readManifest() {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: MANIFEST_KEY }));
    const body = await out.Body.transformToString();
    return JSON.parse(body);
  } catch {
    return { ...EMPTY_MANIFEST, models: [] };
  }
}

async function writeManifest(data) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: MANIFEST_KEY,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}

function safeId(raw) {
  return String(raw).replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 48) || `model-${Date.now()}`;
}

function parseMultipart(bodyBuf, boundary) {
  const fields = {};
  const files = {};
  const parts = bodyBuf.toString("binary").split(`--${boundary}`);
  for (const part of parts) {
    if (!part || part.startsWith("--")) continue;
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const header = part.slice(0, headerEnd);
    const content = part.slice(headerEnd + 4).replace(/\r\n$/, "");
    const nameM = /name="([^"]+)"/.exec(header);
    const fileM = /filename="([^"]+)"/.exec(header);
    if (!nameM) continue;
    if (fileM) {
      files[nameM[1]] = { data: Buffer.from(content, "binary"), filename: fileM[1] };
    } else {
      fields[nameM[1]] = content;
    }
  }
  return { fields, files };
}

async function presignUpload(body) {
  const name = (body.name || "Untitled").trim();
  const id = safeId(body.id || name);
  const iconExt = extFromFilename(body.iconFilename || "icon.png", ".png");
  const iconName = `${id}${iconExt}`;
  const glbName = `${id}.glb`;
  const includeUsdz = Boolean(body.includeUsdz);
  const uploads = {
    icon: {
      url: await presignPut(`${PREFIX}${iconName}`, iconContentType(iconExt)),
      filename: iconName,
      contentType: iconContentType(iconExt),
    },
    glb: {
      url: await presignPut(`${PREFIX}${glbName}`, "model/gltf-binary"),
      filename: glbName,
      contentType: "model/gltf-binary",
    },
  };
  if (includeUsdz) {
    const usdzName = `${id}.usdz`;
    uploads.usdz = {
      url: await presignPut(`${PREFIX}${usdzName}`, "model/vnd.usdz+zip"),
      filename: usdzName,
      contentType: "model/vnd.usdz+zip",
    };
  }
  return { id, name, uploads };
}

async function completeUpload(body) {
  const id = safeId(body.id || body.name || "");
  const name = (body.name || "Untitled").trim();
  const iconName = body.icon;
  const glbName = body.glb || `${id}.glb`;
  const usdzName = body.usdz || null;
  if (!id || !iconName || !glbName) {
    return { error: "id, icon, glb required", status: 400 };
  }
  const manifest = await readManifest();
  manifest.models = (manifest.models || []).filter((m) => m.id !== id);
  manifest.models.push({
    id,
    name,
    icon: iconName,
    glb: glbName,
    ...(usdzName ? { usdz: usdzName } : {}),
  });
  await writeManifest(manifest);
  return { ok: true, id };
}

function isJsonRequest(event) {
  const ctype =
    event.headers["content-type"] ||
    event.headers["Content-Type"] ||
    event.headers["content-Type"] ||
    "";
  return /application\/json/i.test(ctype);
}

export const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path || "";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin), body: "" };
  }

  if (process.env.ATLAS_LEGACY_MODELS_API !== "true") {
    return {
      statusCode: 410,
      headers: corsHeaders(origin),
      body: JSON.stringify({
        error: "Legacy models API retired",
        hint: "Use POST /v2/workspaces/{id}/models/upload with JWT auth.",
      }),
    };
  }

  if (!BUCKET) {
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ error: "ATLAS_MODELS_BUCKET not configured" }),
    };
  }

  try {
    if (method === "GET" && path.endsWith("/models/manifest")) {
      const manifest = await readManifest();
      return { statusCode: 200, headers: corsHeaders(origin), body: JSON.stringify(manifest) };
    }

    if (method === "GET" && path.includes("/models/assets/")) {
      const file = decodeURIComponent(path.split("/models/assets/")[1] || "");
      const key = `${PREFIX}${file}`;
      const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const bytes = await out.Body.transformToByteArray();
      const ext = file.split(".").pop()?.toLowerCase();
      const ct =
        ext === "glb"
          ? "model/gltf-binary"
          : ext === "usdz"
            ? "model/vnd.usdz+zip"
          : ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : "application/octet-stream";
      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), "Content-Type": ct },
        body: Buffer.from(bytes).toString("base64"),
        isBase64Encoded: true,
      };
    }

    if (method === "POST" && path.endsWith("/models/upload/presign")) {
      const payload = await presignUpload(parseJsonBody(event));
      return {
        statusCode: 200,
        headers: corsHeaders(origin),
        body: JSON.stringify(payload),
      };
    }

    if (method === "POST" && path.endsWith("/models/upload/complete")) {
      const result = await completeUpload(parseJsonBody(event));
      if (result.error) {
        return {
          statusCode: result.status || 400,
          headers: corsHeaders(origin),
          body: JSON.stringify({ error: result.error }),
        };
      }
      return {
        statusCode: 200,
        headers: corsHeaders(origin),
        body: JSON.stringify(result),
      };
    }

    if (method === "POST" && (path.endsWith("/models/upload") || path === "/models/upload")) {
      if (isJsonRequest(event)) {
        const body = parseJsonBody(event);
        if (body.action === "presign") {
          const payload = await presignUpload(body);
          return {
            statusCode: 200,
            headers: corsHeaders(origin),
            body: JSON.stringify(payload),
          };
        }
        if (body.action === "complete") {
          const result = await completeUpload(body);
          if (result.error) {
            return {
              statusCode: result.status || 400,
              headers: corsHeaders(origin),
              body: JSON.stringify({ error: result.error }),
            };
          }
          return {
            statusCode: 200,
            headers: corsHeaders(origin),
            body: JSON.stringify(result),
          };
        }
        return {
          statusCode: 400,
          headers: corsHeaders(origin),
          body: JSON.stringify({
            error: "unknown action",
            hint: 'Use action "presign" or "complete", or multipart form for legacy upload',
          }),
        };
      }

      const ctype =
        event.headers["content-type"] ||
        event.headers["Content-Type"] ||
        event.headers["content-Type"] ||
        "";
      const boundaryM = /boundary=(.+)$/i.exec(ctype);
      if (!boundaryM) {
        return {
          statusCode: 400,
          headers: corsHeaders(origin),
          body: JSON.stringify({ error: "multipart required", contentType: ctype }),
        };
      }
      const boundary = boundaryM[1].replace(/^["'\s]+|["'\s]+$/g, "");
      const bodyBuf = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
      const { fields, files } = parseMultipart(bodyBuf, boundary);
      const name = (fields.name || "Untitled").trim();
      const icon = files.icon;
      const glb = files.glb;
      const usdz = files.usdz;
      if (!icon?.data?.length || !glb?.data?.length) {
        return {
          statusCode: 400,
          headers: corsHeaders(origin),
          body: JSON.stringify({
            error: "icon and glb required",
            got: Object.keys(files),
          }),
        };
      }
      const id = safeId(fields.id || name);
      const iconExt = icon.filename.includes(".") ? icon.filename.slice(icon.filename.lastIndexOf(".")) : ".png";
      const iconKey = `${PREFIX}${id}${iconExt}`;
      const glbKey = `${PREFIX}${id}.glb`;
      await s3.send(
        new PutObjectCommand({ Bucket: BUCKET, Key: iconKey, Body: icon.data, ContentType: "image/png" })
      );
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: glbKey,
          Body: glb.data,
          ContentType: "model/gltf-binary",
        })
      );
      let usdzName;
      if (usdz?.data?.length) {
        usdzName = `${id}.usdz`;
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: `${PREFIX}${usdzName}`,
            Body: usdz.data,
            ContentType: "model/vnd.usdz+zip",
          })
        );
      }
      const manifest = await readManifest();
      const iconName = `${id}${iconExt}`;
      const glbName = `${id}.glb`;
      manifest.models = (manifest.models || []).filter((m) => m.id !== id);
      manifest.models.push({
        id,
        name,
        icon: iconName,
        glb: glbName,
        ...(usdzName ? { usdz: usdzName } : {}),
      });
      await writeManifest(manifest);
      return {
        statusCode: 200,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: true, id }),
      };
    }

    if (method === "DELETE" && path.includes("/models/") && !path.endsWith("/manifest")) {
      const id = decodeURIComponent(path.split("/models/")[1] || "");
      if (!id || id.startsWith("builtin-")) {
        return {
          statusCode: 400,
          headers: corsHeaders(origin),
          body: JSON.stringify({ error: "invalid id" }),
        };
      }
      const manifest = await readManifest();
      const entry = (manifest.models || []).find((m) => m.id === id);
      manifest.models = (manifest.models || []).filter((m) => m.id !== id);
      await writeManifest(manifest);
      for (const f of [entry?.icon, entry?.glb, entry?.usdz]) {
        if (f) {
          try {
            await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}${f}` }));
          } catch {
            /* ignore */
          }
        }
      }
      return { statusCode: 200, headers: corsHeaders(origin), body: JSON.stringify({ ok: true }) };
    }

    return {
      statusCode: 404,
      headers: corsHeaders(origin),
      body: JSON.stringify({ error: "Not found" }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }),
    };
  }
};

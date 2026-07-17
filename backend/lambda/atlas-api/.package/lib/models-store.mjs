import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  assetContentType,
  EMPTY_MANIFEST,
  extFromFilename,
  iconContentType,
  modelsPrefixForWorkspace,
  safeModelId,
} from "./models-paths.mjs";

const s3 = new S3Client({});

function bucket() {
  return process.env.ATLAS_MODELS_BUCKET;
}

function manifestKey(workspaceId) {
  return `${modelsPrefixForWorkspace(workspaceId)}manifest.json`;
}

function assetKey(workspaceId, filename) {
  const safe = String(filename).replace(/[/\\]/g, "");
  if (!safe || safe.includes("..")) {
    const err = new Error("Invalid asset filename");
    err.statusCode = 400;
    throw err;
  }
  return `${modelsPrefixForWorkspace(workspaceId)}${safe}`;
}

async function presignPut(key, contentType, maxBytes) {
  /** @type {import("@aws-sdk/client-s3").PutObjectCommandInput} */
  const input = {
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  };
  return getSignedUrl(s3, new PutObjectCommand(input), { expiresIn: 900 });
}

async function assertObjectExists(key, maxBytes) {
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  const size = Number(head.ContentLength ?? 0);
  if (!size) {
    const err = new Error(`Upload missing for ${key.split("/").pop()}`);
    err.statusCode = 400;
    throw err;
  }
  if (maxBytes && size > maxBytes) {
    const err = new Error(`File exceeds max upload size (${Math.round(maxBytes / (1024 * 1024))} MB)`);
    err.statusCode = 400;
    throw err;
  }
  return size;
}

/**
 * @param {string} workspaceId
 */
export async function readManifest(workspaceId) {
  if (!bucket()) {
    const err = new Error("ATLAS_MODELS_BUCKET not configured");
    err.statusCode = 500;
    throw err;
  }
  try {
    const out = await s3.send(
      new GetObjectCommand({ Bucket: bucket(), Key: manifestKey(workspaceId) })
    );
    const body = await out.Body.transformToString();
    return JSON.parse(body);
  } catch (e) {
    if (e?.name === "NoSuchKey") return { ...EMPTY_MANIFEST, models: [] };
    return { ...EMPTY_MANIFEST, models: [] };
  }
}

/**
 * @param {string} workspaceId
 * @param {object} data
 */
export async function writeManifest(workspaceId, data) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: manifestKey(workspaceId),
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}

/**
 * @param {string} workspaceId
 * @param {object} body
 */
export async function presignUpload(workspaceId, body, maxAssetBytes) {
  const name = (body.name || "Untitled").trim();
  const id = safeModelId(body.id || name);
  const iconExt = extFromFilename(body.iconFilename || "icon.png", ".png");
  const iconName = `${id}${iconExt}`;
  const glbName = `${id}.glb`;
  const includeUsdz = Boolean(body.includeUsdz);
  const prefix = modelsPrefixForWorkspace(workspaceId);

  const uploads = {
    icon: {
      url: await presignPut(`${prefix}${iconName}`, iconContentType(iconExt), maxAssetBytes),
      filename: iconName,
      contentType: iconContentType(iconExt),
    },
    glb: {
      url: await presignPut(`${prefix}${glbName}`, "model/gltf-binary", maxAssetBytes),
      filename: glbName,
      contentType: "model/gltf-binary",
    },
  };
  if (includeUsdz) {
    const usdzName = `${id}.usdz`;
    uploads.usdz = {
      url: await presignPut(`${prefix}${usdzName}`, "model/vnd.usdz+zip", maxAssetBytes),
      filename: usdzName,
      contentType: "model/vnd.usdz+zip",
    };
  }
  return { id, name, uploads };
}

/**
 * @param {string} workspaceId
 * @param {object} body
 */
export async function completeUpload(workspaceId, body, maxAssetBytes) {
  const id = safeModelId(body.id || body.name || "");
  const name = (body.name || "Untitled").trim();
  const iconName = body.icon;
  const glbName = body.glb || `${id}.glb`;
  const usdzName = body.usdz || null;
  if (!id || !iconName || !glbName) {
    const err = new Error("id, icon, glb required");
    err.statusCode = 400;
    throw err;
  }
  await assertObjectExists(assetKey(workspaceId, iconName), maxAssetBytes);
  await assertObjectExists(assetKey(workspaceId, glbName), maxAssetBytes);
  if (usdzName) {
    await assertObjectExists(assetKey(workspaceId, usdzName), maxAssetBytes);
  }
  const manifest = await readManifest(workspaceId);
  const existing = (manifest.models || []).find((m) => m.id === id);
  manifest.models = (manifest.models || []).filter((m) => m.id !== id);
  manifest.models.push({
    id,
    name,
    icon: iconName,
    glb: glbName,
    ...(usdzName ? { usdz: usdzName } : {}),
    ...(existing?.arExitUrl ? { arExitUrl: existing.arExitUrl } : {}),
  });
  await writeManifest(workspaceId, manifest);
  return { ok: true, id, modelCount: manifest.models.length };
}

/**
 * @param {string} workspaceId
 * @param {string} modelId
 */
export async function deleteModel(workspaceId, modelId) {
  if (!modelId || modelId.startsWith("builtin-")) {
    const err = new Error("invalid id");
    err.statusCode = 400;
    throw err;
  }
  const manifest = await readManifest(workspaceId);
  const entry = (manifest.models || []).find((m) => m.id === modelId);
  manifest.models = (manifest.models || []).filter((m) => m.id !== modelId);
  await writeManifest(workspaceId, manifest);
  for (const f of [entry?.icon, entry?.glb, entry?.usdz]) {
    if (f) {
      try {
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucket(), Key: assetKey(workspaceId, f) })
        );
      } catch {
        /* ignore */
      }
    }
  }
  return { ok: true, modelCount: manifest.models.length };
}

function normalizeArExitUrl(raw) {
  if (raw == null || raw === "") return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
    return url.toString();
  } catch {
    const err = new Error("Exit URL must be a path starting with / or a valid http(s) URL");
    err.statusCode = 400;
    throw err;
  }
}

/**
 * @param {string} workspaceId
 * @param {string} modelId
 * @param {{ arExitUrl?: string | null }} body
 */
export async function updateModelSettings(workspaceId, modelId, body) {
  if (!modelId || modelId.startsWith("builtin-")) {
    const err = new Error("invalid id");
    err.statusCode = 400;
    throw err;
  }
  const manifest = await readManifest(workspaceId);
  const idx = (manifest.models || []).findIndex((m) => m.id === modelId);
  if (idx < 0) {
    const err = new Error("Model not found");
    err.statusCode = 404;
    throw err;
  }
  const entry = { ...manifest.models[idx] };
  if (body.arExitUrl !== undefined) {
    entry.arExitUrl = normalizeArExitUrl(body.arExitUrl);
  }
  manifest.models[idx] = entry;
  await writeManifest(workspaceId, manifest);
  return { model: entry };
}

/**
 * @param {string} workspaceId
 * @param {string} filename
 */
export async function getAssetBytes(workspaceId, filename) {
  const out = await s3.send(
    new GetObjectCommand({ Bucket: bucket(), Key: assetKey(workspaceId, filename) })
  );
  const bytes = await out.Body.transformToByteArray();
  return { bytes, contentType: assetContentType(filename) };
}

/**
 * Sum bytes under tenants/{workspaceId}/models/ in S3.
 * @param {string} workspaceId
 */
export async function sumWorkspaceStorageBytes(workspaceId) {
  const b = bucket();
  if (!b) return 0;

  const prefix = modelsPrefixForWorkspace(workspaceId);
  let total = 0;
  /** @type {string | undefined} */
  let continuationToken;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: b,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const item of list.Contents ?? []) {
      total += item.Size ?? 0;
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return total;
}

/**
 * Skips legacy workspace root prefix — never call for legacy id.
 * @param {string} workspaceId
 */
export async function deleteWorkspaceStorage(workspaceId) {
  const legacyId = process.env.ATLAS_LEGACY_WORKSPACE_ID || "legacy";
  if (workspaceId === legacyId) return;

  const b = bucket();
  if (!b) return;

  const prefix = modelsPrefixForWorkspace(workspaceId);
  /** @type {string | undefined} */
  let continuationToken;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: b,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    const objects = (list.Contents ?? [])
      .map((item) => (item.Key ? { Key: item.Key } : null))
      .filter(Boolean);

    if (objects.length) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: b,
          Delete: { Objects: objects },
        })
      );
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
}

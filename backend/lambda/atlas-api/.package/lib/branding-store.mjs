import { GetObjectCommand, PutObjectCommand, S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { modelsPrefixForWorkspace } from "./models-paths.mjs";
import { assertSafeRemoteUrl } from "./safe-url.mjs";

const s3 = new S3Client({});

/** Stored in Dynamo when logo was uploaded directly to tenant S3 (not a remote URL). */
export const LOGO_UPLOAD_MARKER_URL = "https://atlas-ar.app/branding/uploaded";

export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

function bucket() {
  return process.env.ATLAS_MODELS_BUCKET;
}

function brandingLogoKey(workspaceId) {
  return `${modelsPrefixForWorkspace(workspaceId)}branding/logo`;
}

function extFromContentType(contentType) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("svg")) return ".svg";
  return ".jpg";
}

function extFromUrl(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.endsWith(".png")) return ".png";
    if (path.endsWith(".webp")) return ".webp";
    if (path.endsWith(".gif")) return ".gif";
    if (path.endsWith(".svg")) return ".svg";
    if (path.endsWith(".jpeg") || path.endsWith(".jpg")) return ".jpg";
  } catch {
    /* ignore */
  }
  return ".jpg";
}

/**
 * @param {string} workspaceId
 */
export async function readWorkspaceLogoBytes(workspaceId) {
  const b = bucket();
  if (!b) return null;

  const prefix = `${modelsPrefixForWorkspace(workspaceId)}branding/`;
  for (const name of ["logo.png", "logo.jpg", "logo.webp", "logo.gif", "logo.svg"]) {
    try {
      const out = await s3.send(new GetObjectCommand({ Bucket: b, Key: `${prefix}${name}` }));
      const bytes = await out.Body.transformToByteArray();
      return { bytes, contentType: out.ContentType || "image/jpeg" };
    } catch (e) {
      if (e?.name !== "NoSuchKey") throw e;
    }
  }
  return null;
}

/**
 * Fetch remote logo and cache in tenant S3 prefix.
 * @param {string} workspaceId
 * @param {string} sourceUrl
 */
export async function cacheWorkspaceLogoFromUrl(workspaceId, sourceUrl) {
  const b = bucket();
  if (!b || !sourceUrl?.trim()) return null;

  assertSafeRemoteUrl(sourceUrl);
  const res = await fetch(sourceUrl.trim());
  if (!res.ok) {
    const err = new Error(`Could not fetch logo (HTTP ${res.status})`);
    err.statusCode = 400;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = extFromContentType(contentType) || extFromUrl(sourceUrl);
  const key = `${brandingLogoKey(workspaceId)}${ext}`;
  const bytes = Buffer.from(await res.arrayBuffer());

  await s3.send(
    new PutObjectCommand({
      Bucket: b,
      Key: key,
      Body: bytes,
      ContentType: contentType.split(";")[0],
      CacheControl: "public, max-age=86400",
    })
  );

  return key;
}

/**
 * @param {string} sourceUrl
 */
export async function fetchRemoteLogoBytes(sourceUrl) {
  assertSafeRemoteUrl(sourceUrl);
  const res = await fetch(sourceUrl.trim());
  if (!res.ok) return null;
  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { bytes, contentType: contentType.split(";")[0] };
}

async function assertLogoObject(key) {
  const b = bucket();
  const head = await s3.send(new HeadObjectCommand({ Bucket: b, Key: key }));
  const size = Number(head.ContentLength ?? 0);
  if (!size) {
    const err = new Error("Logo upload missing — try again");
    err.statusCode = 400;
    throw err;
  }
  if (size > LOGO_MAX_BYTES) {
    const err = new Error(`Logo exceeds max size (${Math.round(LOGO_MAX_BYTES / (1024 * 1024))} MB)`);
    err.statusCode = 400;
    throw err;
  }
  return size;
}

/**
 * Presign PUT for a direct logo upload.
 * @param {string} workspaceId
 * @param {{ contentType?: string; filename?: string }} input
 */
export async function presignLogoUpload(workspaceId, input) {
  const b = bucket();
  if (!b) {
    const err = new Error("ATLAS_MODELS_BUCKET not configured");
    err.statusCode = 500;
    throw err;
  }
  const contentType = String(input.contentType || "image/png").split(";")[0];
  const ext = extFromContentType(contentType) || extFromUrl(input.filename || "") || ".png";
  const key = `${brandingLogoKey(workspaceId)}${ext}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: b,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 900 },
  );
  return { url, key, ext, contentType };
}

/**
 * Verify uploaded logo exists in S3.
 * @param {string} workspaceId
 * @param {string} ext e.g. ".png"
 */
export async function assertLogoUploadComplete(workspaceId, ext) {
  const normalized = ext.startsWith(".") ? ext : `.${ext}`;
  const key = `${brandingLogoKey(workspaceId)}${normalized}`;
  await assertLogoObject(key);
  return key;
}

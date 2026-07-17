import "@babylonjs/core/Helpers/sceneHelpers";
import {
  BaseTexture,
  AbstractMesh,
  Color3,
  DirectionalLight,
  HemisphericLight,
  PBRMaterial,
  Texture,
  Vector3,
  MultiMaterial,
  Scene,
  type Material,
  type TransformNode,
} from "@babylonjs/core";
import { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture";
import neutralHdrBundledUrl from "../../assets/environments/neutral.hdr?url";

export type ArEnvironmentSource = "none" | "fallback-ibl" | "light-estimation" | "preview-neutral-hdr";

/** Cap anisotropic filtering on model textures (device may support less). */
export const AR_TEXTURE_ANISOTROPY_CAP = 16;

let environmentSource: ArEnvironmentSource = "none";

export function getArEnvironmentSource(): ArEnvironmentSource {
  return environmentSource;
}

/** Neutral indoor IBL so glTF PBR materials have reflections before / without XR light-estimation. */
export function ensureArFallbackEnvironment(scene: Scene): void {
  if (scene.environmentTexture) {
    if (environmentSource === "none") environmentSource = "fallback-ibl";
    return;
  }
  scene.createDefaultEnvironment({
    createGround: false,
    createSkybox: false,
    enableGroundShadow: false,
    cameraExposure: 1,
  });
  scene.environmentIntensity = 0.95;
  environmentSource = "fallback-ibl";
}

/**
 * iOS WebXR passthrough: `createDefaultEnvironment` registers an EnvironmentHelper that can
 * paint an opaque background over the AR camera feed (see Babylon AR / designdebt.club guides).
 * Use lights + ambient only until passthrough is confirmed; add IBL after XR enter if needed.
 */
export function ensureArFallbackEnvironmentIosPassthrough(scene: Scene): void {
  scene.environmentTexture = null;
  scene.environmentIntensity = 0.85;
  scene.ambientColor = new Color3(0.45, 0.45, 0.48);
  environmentSource = "none";
}

/** After XR session is live, add IBL without skybox/ground helper meshes. */
export function ensureArFallbackIblOnly(scene: Scene): void {
  if (scene.environmentTexture) {
    if (environmentSource === "none") environmentSource = "fallback-ibl";
    return;
  }
  scene.createDefaultEnvironment({
    createGround: false,
    createSkybox: false,
    enableGroundShadow: false,
    cameraExposure: 1,
  });
  scene.environmentIntensity = 0.95;
  environmentSource = "fallback-ibl";
}

export function markLightEstimationEnvironmentActive(): void {
  environmentSource = "light-estimation";
}

/**
 * Same neutral HDR as `<model-viewer environment-image="neutral">`.
 * Vite-bundled URL first, then public path (respects BASE_URL), then CDN.
 */
export const OBJECT_PREVIEW_NEUTRAL_HDR_CDN =
  "https://modelviewer.dev/shared-assets/environments/neutral.hdr";
/** @deprecated Use publicAssetUrl("assets/environments/neutral.hdr") */
export const OBJECT_PREVIEW_NEUTRAL_HDR_LOCAL = "/assets/environments/neutral.hdr";
/** @deprecated Prefer bundled + publicAssetUrl — kept for callers/tests. */
export const OBJECT_PREVIEW_NEUTRAL_HDR_URL = OBJECT_PREVIEW_NEUTRAL_HDR_LOCAL;

export function publicAssetUrl(relativeFromPublic: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const path = relativeFromPublic.replace(/^\//, "");
  if (typeof location !== "undefined") {
    return new URL(path, new URL(base, location.origin)).href;
  }
  return new URL(path, base).href;
}

function neutralHdrCandidateUrls(): string[] {
  return [
    neutralHdrBundledUrl,
    publicAssetUrl("assets/environments/neutral.hdr"),
    OBJECT_PREVIEW_NEUTRAL_HDR_CDN,
  ];
}

let neutralHdrBlobUrl: string | null = null;
let neutralHdrArrayBuffer: ArrayBuffer | null = null;
let lastPreviewHdrError: string | null = null;
let lastPreviewHdrSourceUrl: string | null = null;

export function getLastPreviewHdrError(): string | null {
  return lastPreviewHdrError;
}

export function getLastPreviewHdrSourceUrl(): string | null {
  return lastPreviewHdrSourceUrl;
}

/** Cache HDR bytes so WebGL preview during live WebXR does not stall on network. */
export async function prefetchNeutralHdrBlob(): Promise<void> {
  if (neutralHdrBlobUrl && neutralHdrArrayBuffer) return;
  for (const url of neutralHdrCandidateUrls()) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) continue;
      neutralHdrArrayBuffer = await res.arrayBuffer();
      if (!neutralHdrBlobUrl) {
        neutralHdrBlobUrl = URL.createObjectURL(new Blob([neutralHdrArrayBuffer]));
      }
      lastPreviewHdrSourceUrl = url;
      lastPreviewHdrError = null;
      return;
    } catch {
      /* try next source */
    }
  }
  lastPreviewHdrError = "prefetch: all neutral HDR sources failed";
}

function neutralHdrDecodeUrls(): string[] {
  const urls = [
    neutralHdrBundledUrl,
    publicAssetUrl("assets/environments/neutral.hdr"),
    OBJECT_PREVIEW_NEUTRAL_HDR_CDN,
  ];
  if (neutralHdrBlobUrl) urls.push(neutralHdrBlobUrl);
  return urls;
}

type SceneWithEnvHelper = Scene & { environmentHelper?: { dispose(): void } | null };

/** Drop procedural IBL from createDefaultEnvironment so neutral.hdr can bind cleanly. */
function releasePreviewFallbackIbl(scene: Scene): void {
  const helper = (scene as SceneWithEnvHelper).environmentHelper;
  if (helper) {
    helper.dispose();
    (scene as SceneWithEnvHelper).environmentHelper = null;
  }
  const tex = scene.environmentTexture;
  if (tex && !(tex instanceof HDRCubeTexture)) {
    tex.dispose();
    scene.environmentTexture = null;
  }
}

const previewHdrByScene = new WeakMap<Scene, HDRCubeTexture>();
let sharedPreviewHdr: HDRCubeTexture | null = null;
let previewHdrLoad: Promise<HDRCubeTexture> | null = null;
let previewHdrLoadEngine: import("@babylonjs/core").AbstractEngine | null = null;
const previewEnvSourceByScene = new WeakMap<Scene, ArEnvironmentSource>();

function configureObjectPreviewImageProcessing(scene: Scene): void {
  // Brighter base than AR — dark albedo textures (wood, leather) must read on the navy gradient.
  scene.ambientColor = new Color3(0.38, 0.38, 0.42);
  const ipc = scene.imageProcessingConfiguration;
  if (!ipc) return;
  // model-viewer parity: exposure 1 with HDR; keep fabric readable on navy gradient.
  const neutralHdr = getPreviewEnvironmentSource(scene) === "preview-neutral-hdr";
  ipc.exposure = neutralHdr ? 1.12 : 1.22;
  ipc.contrast = 1;
  ipc.toneMappingEnabled = true;
}

/**
 * Soft lights when neutral HDR is active (IBL drives metal); stronger fill without HDR.
 * Heavy diffuse was the original regression after swapping away from model-viewer.
 */
function configureObjectPreviewLights(scene: Scene): void {
  const neutralHdr = getPreviewEnvironmentSource(scene) === "preview-neutral-hdr";
  const hemiIntensity = neutralHdr ? 0.48 : 0.62;
  const keyIntensity = neutralHdr ? 0.68 : 0.95;
  const fillIntensity = neutralHdr ? 0.4 : 0.55;

  let hemi = scene.getLightByName("preview-hemi") as HemisphericLight | null;
  if (!hemi) {
    hemi = new HemisphericLight("preview-hemi", new Vector3(0.1, 1, 0.05), scene);
    hemi.groundColor = new Color3(0.28, 0.28, 0.32);
    hemi.diffuse = new Color3(1, 1, 1);
  }
  hemi.intensity = hemiIntensity;

  let key = scene.getLightByName("preview-key") as DirectionalLight | null;
  if (!key) {
    key = new DirectionalLight("preview-key", new Vector3(-0.55, -0.9, -0.3), scene);
    key.position = new Vector3(2, 3.5, 1.2);
  }
  key.intensity = keyIntensity;

  let fill = scene.getLightByName("preview-fill") as DirectionalLight | null;
  if (!fill) {
    fill = new DirectionalLight("preview-fill", new Vector3(0.15, -0.25, 0.92), scene);
    fill.position = new Vector3(-2, 2.5, 2.8);
  }
  fill.intensity = fillIntensity;
}

const PREVIEW_HDR_TIMEOUT_MS = 12000;

export function applyPreviewIblFast(scene: Scene): void {
  configureObjectPreviewImageProcessing(scene);
  configureObjectPreviewLights(scene);
  if (scene.environmentTexture instanceof HDRCubeTexture) {
    return;
  }
  if (!scene.environmentTexture) {
    // Temporary IBL until neutral.hdr binds — createSkybox:false still installs a cubemap.
    scene.createDefaultEnvironment({
      createGround: false,
      createSkybox: false,
      enableGroundShadow: false,
      cameraExposure: 1.05,
    });
    scene.environmentIntensity = 1.15;
    previewEnvSourceByScene.set(scene, "fallback-ibl");
  }
}

/** Instantly bind a previously decoded HDR cubemap on this preview engine. */
export function tryBindCachedPreviewNeutralHdr(scene: Scene): boolean {
  const sceneEngine = scene.getEngine();
  const cached =
    previewHdrByScene.get(scene) ??
    (sharedPreviewHdr?.getScene()?.getEngine() === sceneEngine ? sharedPreviewHdr : null);
  if (!cached) return false;
  releasePreviewFallbackIbl(scene);
  scene.environmentTexture = cached;
  scene.environmentIntensity = 1.22;
  previewEnvSourceByScene.set(scene, "preview-neutral-hdr");
  previewNeutralHdrReady = true;
  lastPreviewHdrError = null;
  configureObjectPreviewImageProcessing(scene);
  configureObjectPreviewLights(scene);
  return true;
}

/** Decode neutral.hdr to GPU cache — does not bind scene.environmentTexture (keeps fallback visible). */
export async function prefetchPreviewNeutralHdrDecode(scene: Scene): Promise<boolean> {
  const sceneEngine = scene.getEngine();
  if (
    sharedPreviewHdr &&
    sharedPreviewHdr.getScene()?.getEngine() === sceneEngine &&
    previewHdrByScene.has(scene)
  ) {
    return true;
  }
  await prefetchNeutralHdrBlob();
  try {
    const hdr = await loadNeutralPreviewHdr(scene, {
      size: 256,
      prefilterOnLoad: true,
      timeoutMs: PREVIEW_HDR_TIMEOUT_MS,
    });
    previewHdrByScene.set(scene, hdr);
    sharedPreviewHdr = hdr;
    previewNeutralHdrReady = true;
    lastPreviewHdrError = null;
    return true;
  } catch (e) {
    lastPreviewHdrError = e instanceof Error ? e.message : String(e);
    return false;
  }
}

/** Bind model-viewer neutral HDR (bundled asset first). Required for chrome metal specular. */
export async function upgradePreviewNeutralHdr(scene: Scene): Promise<boolean> {
  if (tryBindCachedPreviewNeutralHdr(scene)) return true;
  await prefetchNeutralHdrBlob();
  try {
    const hdr = await loadNeutralPreviewHdr(scene, {
      size: 256,
      prefilterOnLoad: true,
      timeoutMs: PREVIEW_HDR_TIMEOUT_MS,
    });
    // Keep fallback IBL until HDR is ready — never leave the scene without reflections.
    releasePreviewFallbackIbl(scene);
    scene.environmentTexture = hdr;
    scene.environmentIntensity = 1.22;
    previewEnvSourceByScene.set(scene, "preview-neutral-hdr");
    previewNeutralHdrReady = true;
    lastPreviewHdrError = null;
    configureObjectPreviewImageProcessing(scene);
    configureObjectPreviewLights(scene);
    return true;
  } catch (e) {
    lastPreviewHdrError = e instanceof Error ? e.message : String(e);
    if (!scene.environmentTexture) {
      applyPreviewIblFast(scene);
    }
    configureObjectPreviewImageProcessing(scene);
    configureObjectPreviewLights(scene);
    return false;
  }
}

/** Retry HDR bind in background after 3D preview is visible (non-blocking). */
export function schedulePreviewHdrRetries(
  scene: Scene,
  onBound?: () => void,
  attempts = 4,
  intervalMs = 2000
): void {
  void (async () => {
    if (getPreviewEnvironmentSource(scene) === "preview-neutral-hdr") return;
    for (let i = 0; i < attempts; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      if (getPreviewEnvironmentSource(scene) === "preview-neutral-hdr") return;
      const ok = await upgradePreviewNeutralHdr(scene);
      if (ok) {
        onBound?.();
        return;
      }
    }
  })();
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out (${Math.round(ms / 1000)}s)`)), ms);
    }),
  ]);
}

type NeutralHdrLoadOptions = {
  size?: number;
  prefilterOnLoad?: boolean;
  timeoutMs?: number;
};

function loadNeutralPreviewHdr(
  scene: Scene,
  options: NeutralHdrLoadOptions = {}
): Promise<HDRCubeTexture> {
  const cached = previewHdrByScene.get(scene);
  if (cached) return Promise.resolve(cached);

  const sceneEngine = scene.getEngine();
  if (sharedPreviewHdr) {
    const sharedEngine = sharedPreviewHdr.getScene()?.getEngine();
    if (sharedEngine === sceneEngine) {
      previewHdrByScene.set(scene, sharedPreviewHdr);
      return Promise.resolve(sharedPreviewHdr);
    }
  }

  const errors: string[] = [];
  const urls = neutralHdrDecodeUrls();
  const attempt = async (urlIndex: number): Promise<HDRCubeTexture> => {
    if (urlIndex >= urls.length) {
      throw new Error(errors.join(" | ") || "Failed to load neutral HDR for 3D preview.");
    }
    const sourceUrl = urls[urlIndex]!;
    lastPreviewHdrSourceUrl = sourceUrl;
    try {
      return await loadNeutralPreviewHdrOnce(scene, sourceUrl, options);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${sourceUrl}: ${msg}`);
      return attempt(urlIndex + 1);
    }
  };
  return attempt(0);
}

function loadNeutralPreviewHdrOnce(
  scene: Scene,
  sourceUrl: string,
  options: NeutralHdrLoadOptions
): Promise<HDRCubeTexture> {
  const sceneEngine = scene.getEngine();

  if (previewHdrLoad && previewHdrLoadEngine === sceneEngine) {
    return previewHdrLoad.then((tex) => {
      previewHdrByScene.set(scene, tex);
      return tex;
    });
  }

  const size = options.size ?? 256;
  const prefilterOnLoad = options.prefilterOnLoad ?? true;

  previewHdrLoadEngine = sceneEngine;
  previewHdrLoad = new Promise<HDRCubeTexture>((resolve, reject) => {
    const tex = new HDRCubeTexture(
      sourceUrl,
      scene,
      size,
      false,
      true,
      false,
      prefilterOnLoad,
      () => {
        if (tex.getScene()?.getEngine() === sceneEngine) {
          sharedPreviewHdr = tex;
          previewNeutralHdrReady = true;
        }
        previewHdrByScene.set(scene, tex);
        previewHdrLoad = null;
        previewHdrLoadEngine = null;
        resolve(tex);
      },
      (message, exception) => {
        previewHdrLoad = null;
        previewHdrLoadEngine = null;
        const detail =
          message?.trim() ||
          (exception instanceof Error ? exception.message : String(exception ?? "")) ||
          "Failed to load neutral HDR for 3D preview.";
        reject(new Error(detail));
      },
    );
  });
  return withTimeout(
    previewHdrLoad,
    options.timeoutMs ?? PREVIEW_HDR_TIMEOUT_MS,
    "Neutral HDR load"
  );
}

let previewNeutralHdrReady = false;

export function isPreviewNeutralHdrReady(): boolean {
  return previewNeutralHdrReady;
}

export function getPreviewEnvironmentSource(scene: Scene): ArEnvironmentSource {
  return previewEnvSourceByScene.get(scene) ?? "none";
}

/** Prefetch HDR bytes only — do not decode on NullEngine (cannot share to WebGL preview). */
export function preloadObjectPreviewHdr(): Promise<void> {
  return prefetchNeutralHdrBlob();
}

/**
 * model-viewer parity: neutral HDR IBL + enough direct fill for dark dielectric textures.
 * Does not touch the shared AR environmentSource flag (preview uses its own Scene).
 */
export async function applyObjectPreviewEnvironment(scene: Scene): Promise<void> {
  applyPreviewIblFast(scene);
  await upgradePreviewNeutralHdr(scene);
}

/** @deprecated Use applyObjectPreviewEnvironment — sync lights only. */
export function ensureObjectPreviewEnvironment(scene: Scene): void {
  configureObjectPreviewImageProcessing(scene);
  configureObjectPreviewLights(scene);
  if (!scene.environmentTexture) {
    ensureArFallbackEnvironment(scene);
    scene.environmentIntensity = 1.05;
  }
}

/** Chrome wire / polished metal — do not apply to leather/fabric dielectrics. */
export function isChromeLikePreviewMaterial(
  matName: string,
  metallic: number,
  roughness: number,
  hasMetallicMap: boolean
): boolean {
  if (/wire_/i.test(matName)) return true;
  return hasMetallicMap && metallic >= 0.85 && roughness <= 0.25;
}

/** Soft dielectrics (leather seat, fabric) — high roughness or fabric-ish names. */
export function isDielectricPreviewMaterial(
  matName: string,
  roughness: number,
  chromelike: boolean
): boolean {
  if (chromelike) return false;
  if (/^(top|leather|fabric|seat|cushion|cloth|upholstery)/i.test(matName)) return true;
  return roughness >= 0.4;
}

/** Per-material PBR for 3D preview — chrome wire vs leather/fabric get separate recipes. */
export function tunePbrMaterialForObjectPreview(mat: Material, scene: Scene): void {
  if (mat instanceof MultiMaterial) {
    for (const sub of mat.subMaterials) {
      if (sub) tunePbrMaterialForObjectPreview(sub, scene);
    }
    return;
  }
  if (!isPbr(mat)) return;
  upgradeMaterialTexturesForAR(mat, scene);
  mat.unlit = false;
  // glTF MR maps: B = metalness, G = roughness — keep channel flags so chrome wire reads metallic.
  if (mat.metallicTexture) {
    mat.useMetallnessFromMetallicTextureBlue = true;
    mat.useRoughnessFromMetallicTextureGreen = true;
    mat.useAmbientOcclusionFromMetallicTextureRed = false;
  }
  const ibl = Boolean(scene.environmentTexture);
  const metallic = Math.min(Math.max(mat.metallic ?? 0, 0), 1);
  const roughness = Math.min(Math.max(mat.roughness ?? 0.5, 0), 1);
  const hasMetallicMap = Boolean(mat.metallicTexture);
  const chromelike = isChromeLikePreviewMaterial(mat.name, metallic, roughness, hasMetallicMap);
  const dielectric = isDielectricPreviewMaterial(mat.name, roughness, chromelike);
  const neutralHdr = getPreviewEnvironmentSource(scene) === "preview-neutral-hdr";

  if (chromelike) {
    // Polished chrome needs strong IBL specular (model-viewer neutral HDR).
    if (neutralHdr) {
      mat.environmentIntensity = ibl ? 1.45 : 1.05;
      mat.directIntensity = 1.05;
      mat.specularIntensity = Math.max(mat.specularIntensity ?? 1, 1.35);
    } else {
      mat.environmentIntensity = ibl ? 1.82 : 1.05;
      mat.directIntensity = 0.72;
      mat.specularIntensity = Math.max(mat.specularIntensity ?? 1, 1.48);
    }
  } else if (dielectric) {
    // Leather/fabric: soft diffuse, weak specular — high env makes seat look plastic.
    if (neutralHdr) {
      mat.environmentIntensity = ibl ? 0.92 : 0.8;
      mat.directIntensity = 1.32;
      mat.specularIntensity = Math.min(mat.specularIntensity ?? 1, 0.88);
    } else {
      mat.environmentIntensity = ibl ? 1.05 : 0.8;
      mat.directIntensity = 1.28;
      mat.specularIntensity = Math.min(mat.specularIntensity ?? 1, 0.92);
    }
  } else if (hasMetallicMap) {
    // Mixed MR materials that are neither chrome nor soft dielectric.
    mat.environmentIntensity = ibl ? (neutralHdr ? 1.15 : 1.28) : 1.0;
    mat.directIntensity = 1.1;
    mat.specularIntensity = Math.min(Math.max(mat.specularIntensity ?? 1, 0.95), 1.05);
  } else if (metallic > 0.35) {
    mat.environmentIntensity = ibl ? 1.28 : 0.9;
    mat.directIntensity = 1.05;
    mat.specularIntensity = Math.max(mat.specularIntensity ?? 1, 1.12);
  } else {
    mat.environmentIntensity = ibl ? 1.0 : 0.88;
    mat.directIntensity = roughness > 0.4 ? 1.28 : 1.12;
    mat.specularIntensity = Math.min(mat.specularIntensity ?? 1, 1);
  }
  if (mat.roughness != null) {
    mat.roughness = Math.min(Math.max(mat.roughness, 0), 1);
  }
  // Never add emissive on MR-map materials — it flattens chrome wire to matte paint.
  if (!hasMetallicMap && mat.albedoColor) {
    const c = mat.albedoColor;
    const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    if (lum < 0.22) {
      mat.emissiveColor = c.scale(mat.albedoTexture ? 0.08 : 0.14);
    }
  } else if (hasMetallicMap && mat.emissiveColor) {
    mat.emissiveColor = Color3.Black();
  }
  mat.usePhysicalLightFalloff = true;
  mat.useSpecularOverAlpha = true;
  mat.markDirty();
}

export function tunePreviewMaterials(scene: Scene, roots: TransformNode[]): void {
  const seen = new Set<Material>();
  for (const mat of collectMaterialsFromRoots(roots)) {
    if (seen.has(mat)) continue;
    seen.add(mat);
    tunePbrMaterialForObjectPreview(mat, scene);
  }
}

export function tunePreviewContainerMaterials(
  scene: Scene,
  materials: Material[]
): void {
  for (const mat of materials) {
    tunePbrMaterialForObjectPreview(mat, scene);
  }
}

export type PbrMaterialDiagnostics = {
  materialTypes: string;
  pbrCount: number;
  standardCount: number;
  otherCount: number;
  unlitCount: number;
  withAlbedoTexture: number;
  withNormalTexture: number;
  withMetallicRoughnessTexture: number;
  maxAlbedoTexturePx: number | null;
  sceneHasEnvironment: boolean;
  environmentSource: ArEnvironmentSource;
  environmentIntensity: number | null;
};

function isPbr(mat: Material): mat is PBRMaterial {
  return mat instanceof PBRMaterial;
}

/** Sharper glTF textures — trilinear sampling + max anisotropy (no resolution upscaling). */
export function upgradeTextureForAR(tex: BaseTexture, scene: Scene): void {
  const caps = scene.getEngine().getCaps();
  const maxAniso = Math.min(
    caps.maxAnisotropy ?? 4,
    AR_TEXTURE_ANISOTROPY_CAP
  );
  if (tex instanceof Texture) {
    tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  }
  tex.anisotropicFilteringLevel = maxAniso;
}

export function upgradeMaterialTexturesForAR(mat: Material, scene: Scene): void {
  if (!isPbr(mat)) return;
  const textures = [
    mat.albedoTexture,
    mat.bumpTexture,
    mat.metallicTexture,
    mat.ambientTexture,
    mat.emissiveTexture,
    mat.lightmapTexture,
    mat.reflectionTexture,
  ];
  for (const tex of textures) {
    if (tex) upgradeTextureForAR(tex, scene);
  }
}

export function collectMaterialsFromRoots(roots: TransformNode[]): Material[] {
  const seen = new Set<Material>();
  const out: Material[] = [];
  const add = (mat: Material | null | undefined) => {
    if (!mat || seen.has(mat)) return;
    seen.add(mat);
    out.push(mat);
    if (mat instanceof MultiMaterial) {
      for (const sub of mat.subMaterials) add(sub ?? undefined);
    }
  };
  for (const root of roots) {
    // false = all descendants. true only walks direct children and misses
    // glTF primitive meshes parented under __root__ (Bar-Chair wire + fabric).
    if (root instanceof AbstractMesh) add(root.material);
    for (const mesh of root.getChildMeshes(false)) {
      add(mesh.material);
      if (mesh.material instanceof MultiMaterial) {
        for (const sub of mesh.material.subMaterials) add(sub ?? undefined);
      }
      for (const sm of mesh.subMeshes ?? []) {
        add(sm.getMaterial());
      }
    }
  }
  return out;
}

function maxTextureDimensionPx(tex: BaseTexture | null | undefined): number {
  if (!tex || !(tex instanceof Texture)) return 0;
  const size = tex.getSize();
  return Math.max(size.width, size.height);
}

export function scanPbrMaterials(
  root: TransformNode,
  collectMaterials: (node: TransformNode) => Material[]
): PbrMaterialDiagnostics {
  const scene = root.getScene();
  const mats = collectMaterials(root);
  const types = new Set<string>();
  let pbrCount = 0;
  let standardCount = 0;
  let otherCount = 0;
  let unlitCount = 0;
  let withAlbedoTexture = 0;
  let withNormalTexture = 0;
  let withMetallicRoughnessTexture = 0;
  let maxAlbedoTexturePx = 0;

  for (const mat of mats) {
    const countMat = (m: Material) => {
      types.add(m.getClassName());
      if (isPbr(m)) {
        pbrCount += 1;
        if (m.unlit) unlitCount += 1;
        if (m.albedoTexture) {
          withAlbedoTexture += 1;
          maxAlbedoTexturePx = Math.max(
            maxAlbedoTexturePx,
            maxTextureDimensionPx(m.albedoTexture)
          );
        }
        if (m.bumpTexture) withNormalTexture += 1;
        if (m.metallicTexture) withMetallicRoughnessTexture += 1;
      } else if (m.getClassName() === "StandardMaterial") {
        standardCount += 1;
      } else {
        otherCount += 1;
      }
    };
    if (mat instanceof MultiMaterial) {
      for (const sub of mat.subMaterials) {
        if (sub) countMat(sub);
      }
      continue;
    }
    countMat(mat);
  }

  return {
    materialTypes:
      [...types].join(", ") ||
      (root.getChildMeshes(false).length > 0 ? "MeshWithoutStandardMaterial" : "NoGeometry"),
    pbrCount,
    standardCount,
    otherCount,
    unlitCount,
    withAlbedoTexture,
    withNormalTexture,
    withMetallicRoughnessTexture,
    maxAlbedoTexturePx: maxAlbedoTexturePx > 0 ? maxAlbedoTexturePx : null,
    sceneHasEnvironment: Boolean(scene?.environmentTexture),
    environmentSource: getArEnvironmentSource(),
    environmentIntensity:
      scene?.environmentIntensity != null
        ? Math.round(scene.environmentIntensity * 100) / 100
        : null,
  };
}

export function tunePbrMaterialForAR(
  mat: Material,
  options: { lightEstimationActive: boolean; sceneHasEnvironment: boolean }
): void {
  if (!isPbr(mat)) return;

  const scene = mat.getScene();
  if (scene) upgradeMaterialTexturesForAR(mat, scene);

  mat.unlit = false;
  if (mat.metallicTexture) {
    mat.useMetallnessFromMetallicTextureBlue = true;
    mat.useRoughnessFromMetallicTextureGreen = true;
    mat.useAmbientOcclusionFromMetallicTextureRed = false;
  }
  const chromelike =
    Boolean(mat.metallicTexture) &&
    (mat.metallic ?? 0) >= 0.85 &&
    (mat.roughness ?? 1) <= 0.2;
  const ibl = options.sceneHasEnvironment;
  mat.environmentIntensity = ibl
    ? chromelike
      ? options.lightEstimationActive
        ? 1.45
        : 1.25
      : options.lightEstimationActive
        ? 1.2
        : 1.0
    : chromelike
      ? 0.9
      : 0.55;
  mat.directIntensity = options.lightEstimationActive ? 1.08 : 1.0;
  mat.specularIntensity = Math.max(
    mat.specularIntensity ?? 1,
    chromelike ? 1.2 : 0.65
  );
  if (mat.roughness != null && !mat.metallicTexture) {
    mat.roughness = Math.min(Math.max(mat.roughness, 0.15), 1);
  }
  if (mat.metallic != null) {
    mat.metallic = Math.min(Math.max(mat.metallic, 0), 1);
  }
  mat.usePhysicalLightFalloff = true;
  mat.useSpecularOverAlpha = true;
  if (mat.albedoColor) {
    const c = mat.albedoColor;
    const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    if (lum < 0.04 && !mat.albedoTexture) {
      mat.emissiveColor = c.scale(0.18);
    }
  }
  mat.markDirty();
}

export function pbrDiagnosticsForLog(
  diag: PbrMaterialDiagnostics
): Record<string, string | number | boolean | null | undefined> {
  return {
    materialTypes: diag.materialTypes,
    pbrCount: diag.pbrCount,
    standardCount: diag.standardCount,
    unlitCount: diag.unlitCount,
    withAlbedoTexture: diag.withAlbedoTexture,
    withNormalTexture: diag.withNormalTexture,
    withMetallicRoughnessTexture: diag.withMetallicRoughnessTexture,
    maxAlbedoTexturePx: diag.maxAlbedoTexturePx,
    sceneHasEnvironment: diag.sceneHasEnvironment,
    environmentSource: diag.environmentSource,
    environmentIntensity: diag.environmentIntensity,
  };
}

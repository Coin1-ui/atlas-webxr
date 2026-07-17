#!/usr/bin/env node
/** Design audit fixes smoke test — Batch 36b–e + model icon paths. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");

const checks = [
  ["model-catalog slug-aware assetUrl", read("src/data/model-catalog.ts").includes("tenantSlug?: string | null")],
  ["model-icon helper", read("src/shared/model-icon.ts").includes("modelIconSrc")],
  ["admin models pass workspace slug", read("src/ui/admin-models.ts").includes("modelIconUrl(m, workspace.slug)")],
  ["admin sets catalog slug", read("src/main.ts").includes("setCatalogWorkspaceSlug(activeWorkspace.slug)")],
  ["mobile admin hub", read("src/ui/mobile-admin-hub.ts").includes("renderMobileAdminHub")],
  ["brand defaults accent", read("src/shared/brand-defaults.ts").includes("#2dd4bf")],
  ["brand assets Atlas AR alt", read("src/shared/brand-assets.ts").includes('alt="${PRODUCT_NAME}"') || read("src/shared/brand-assets.ts").includes("PRODUCT_NAME")],
  ["ar cta taxonomy", read("src/shared/ar-cta.ts").includes("View in AR")],
  ["model tile spinner css", read("src/style.css").includes(".model-tile-spinner")],
  ["design tokens", read("src/style.css").includes("--space-4")],
  ["pricing launch dedupe", read("src/ui/marketing-pricing.ts").includes("Choose Launch")],
  ["hero picture element", read("src/ui/marketing-landing.ts").includes("mkt-hero-img") && read("src/ui/marketing-landing.ts").includes("MKT_ASSETS.heroPhone")],
  ["legacy halo removed", !read("src/style.css").includes(".halo-rail")],
  ["owner demo json toggle", read("src/ui/owner-dashboard.ts").includes("owner-demo-json-card")],
  ["ar session features helper", read("src/main.ts").includes("function arSessionFeatures")],
  ["catalog prefers filename fields", read("src/data/model-catalog.ts").includes("Prefer manifest filename fields")],
  ["sync ar session features", read("src/main.ts").includes("function syncArSessionFeatures")],
  ["json log patch helper", read("src/ui/ar-model-picker.ts").includes("function patchJsonLogButton")],
  ["catalog slug route fallback", read("src/main.ts").includes("parseTenantRoute()?.slug")],
  ["getCatalogAssets slug param", read("src/data/model-catalog.ts").includes("tenantSlug?: string | null")],
  ["catalog cache bust", read("src/data/model-catalog.ts").includes("bustCache?: boolean")],
  ["demo AR full catalog helper", read("src/main.ts").includes("function showFullCatalogInAr")],
  ["tenant direct AR filters picker", read("src/main.ts").includes("records.filter((m) => m.id === directArModelId)")],
  ["demo catalog uses admin manifest", read("src/data/model-catalog.ts").includes("fetchAdminManifestMerged")],
  ["demo json log flag", read("src/main.ts").includes("demoArSessionLogEnabled")],
  ["3d mode before place", read("src/main.ts").includes("pickerFocusModelId")],
  ["production demo upload defaults remote", read("src/ui/model-manager-pc.ts").includes('canUploadDemoRemote() ? "remote" : "local"')],
  ["demo workspace catalog slug", read("src/data/catalog-context.ts").includes("getDemoCatalogWorkspaceSlug")],
  ["owner demo uses workspace upload", read("src/ui/model-manager-pc.ts").includes("uploadModelToWorkspace")],
  ["3d viewer uses babylon canvas", read("src/ui/ar-object-viewer.ts").includes("ar-object-viewer-canvas")],
  ["3d viewer preview container cache", read("src/ui/ar-object-viewer.ts").includes("ensurePreviewContainer")],
  ["demo json skips catalog slug tenant sync", read("src/main.ts").includes("tenantSlug && !isGlobalAr")],
  ["demo json uses tenantFeatures fallback", read("src/main.ts").includes("tenantFeatures.sessionLogDownload")],
  ["3d viewer json footer", read("src/ui/ar-object-viewer.ts").includes('data-action="log"')],
  ["picker preview before place", read("src/main.ts").includes("pickerPreviewModelId")],
  ["object mode session logging", read("src/main.ts").includes('logArEvent("object-mode"')],
  ["demo catalog resolver", read("src/data/demo-catalog-resolver.ts").includes("resolveDemoWorkspaceSlug")],
  ["demo skips legacy slug", read("src/data/demo-catalog-resolver.ts").includes("LEGACY_DEMO_SLUG")],
  ["demo json from public config", read("src/main.ts").includes("fetchPublicWorkspaceConfig(demoSlug")],
  ["3d preview neutral hdr", read("src/xr/shared/ar-pbr-environment.ts").includes("OBJECT_PREVIEW_NEUTRAL_HDR_URL")],
  ["3d preview fill light", read("src/xr/shared/ar-pbr-environment.ts").includes("preview-fill")],
  ["3d preview mr metal ibl", read("src/xr/shared/ar-pbr-environment.ts").includes("isChromeLikePreviewMaterial") && read("src/xr/shared/ar-pbr-environment.ts").includes("isDielectricPreviewMaterial")],
  ["3d preview dielectric direct", read("src/xr/shared/ar-pbr-environment.ts").includes("roughness > 0.4 ? 1.28")],
  ["3d preview warmup on picker", read("src/main.ts").includes("warmPreviewForFocusModel")],
  ["3d preview uses catalog cache", read("src/main.ts").includes("resolveCatalogAssets(item, catalogAssetSlug())") && !read("src/main.ts").includes("getCatalogAssets(id, catalogAssetSlug(), { bustCache: true })")],
  ["3d preview busy guard", read("src/main.ts").includes("objectModeBusy")],
  ["3d preview warmup after place", read("src/main.ts").includes("warmObjectPreviewModel")],
  ["3d preview object mode ring guard", read("src/xr/android/session.ts").includes("if (objectViewerMode)")],
  ["3d preview hidden warmup canvas", read("src/ui/ar-object-viewer.ts").includes("ar-object-preview-canvas")],
  ["3d preview instantiate cache", read("src/xr/shared/glb-offline-cache.ts").includes("instantiatePreviewFromContainer")],
  ["3d preview sync materials", read("src/xr/shared/glb-offline-cache.ts").includes("syncMaterialsFromContainer(container, meshes)")],
  ["3d preview engine-safe hdr", read("src/xr/shared/ar-pbr-environment.ts").includes("previewHdrLoadEngine")],
  ["3d preview neutral hdr source", read("src/xr/shared/ar-pbr-environment.ts").includes("getPreviewEnvironmentSource")],
  ["usdz texture embed before export", read("src/data/glb-to-usdz.ts").includes("prepareAndEmbedTextures")],
  ["usdz center for quick look", read("src/data/glb-to-usdz.ts").includes("centerSceneForQuickLook")],
  ["dimension overlay depth test", read("src/xr/android/ar-placement-fx.ts").includes("depthFunction = Constants.ALWAYS")],
  ["ar panel click suppress", read("src/ui/ar-panel-touch.ts").includes("suppressClickAfterPointerUntil")],
  ["ios quick look only", read("src/main.ts").includes("startIosQuickLookAr") && !read("src/main.ts").includes("showDemoCatalogForAr")],
  ["ios safari ar picker not tenant catalog", read("src/main.ts").includes("renderIosQuickLookPicker") && !read("src/main.ts").includes("showDemoCatalogForAr")],
  ["ios 3d canvas hidden in object mode", read("src/style.css").includes("ar-object-mode-active .xr-canvas")],
  ["ios safari ar demo footer", read("src/ui/home-minimal.ts").includes("Safari AR: move phone over the floor")],
  ["ios session log on picker", read("src/ui/ios-quick-look-picker.ts").includes('data-action="session-log"')],
  ["ios session log on demo home", read("src/ui/home-minimal.ts").includes('data-action="session-log"')],
  ["usdz quick look compatible", read("src/data/glb-to-usdz.ts").includes("quickLookCompatible: true")],
  ["usdz decompress function export", read("src/data/glb-to-usdz.ts").includes("{ decompress }") && !read("src/data/glb-to-usdz.ts").includes("new WebGLTextureUtils")],
  ["usdz mr factor bake", read("src/data/glb-to-usdz.ts").includes("bakeMetalRoughFactors")],
  ["optional manual usdz upload", read("src/ui/model-manager-pc.ts").includes('name="usdz"')],
  ["hero png only no webp", !read("src/ui/marketing-landing.ts").includes("image/webp")],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    console.error(`FAIL: ${name}`);
    failed++;
  } else {
    console.log(`ok: ${name}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log(`\n${checks.length} checks passed`);

import "./style.css";
import "@babylonjs/loaders/glTF";
import "@babylonjs/loaders/glTF/2.0/pbrMaterialLoadingAdapter";
import "@babylonjs/loaders/glTF/2.0/openpbrMaterialLoadingAdapter";
import { preloadBabylonGltfPipeline } from "./xr/babylon-preload";
import { getCameraSupport } from "./xr/fallback-camera";
import type { WebXRSession } from "./xr/webxr-ar";
import { tryStartWebXR } from "./xr/webxr-ar";
import { renderHomeMinimal } from "./ui/home-minimal";
import { renderMarketingLanding } from "./ui/marketing-landing";
import { renderPricingPage } from "./ui/marketing-pricing";
import { renderAboutPage } from "./ui/marketing-about";
import { renderAccountPage } from "./ui/account-page";
import { renderTenantCatalog } from "./ui/tenant-catalog";
import {
  catalogToQuickLookItems,
  renderIosQuickLookPicker,
} from "./ui/ios-quick-look-picker";
import { renderLegalPage } from "./ui/legal-page";
import type { LegalDocId } from "./ui/legal-content";
import { MKT, customerDeviceLine } from "./ui/marketing-copy";
import { downloadDeviceTestReport } from "./device-test/export";
import { runDeviceHardwareCheck } from "./device-test/runner";
import {
  renderDeviceTestArStart,
  renderDeviceTestComplete,
  renderDeviceTestRunning,
} from "./ui/device-test-screen";
import {
  fetchCatalog,
  findCatalogModelById,
  getCatalogAssets,
  resolveCatalogAssets,
  defaultIconForBuiltin,
  catalogSourceLabel,
  isDemoCatalogModel,
  setCatalogWorkspaceSlug,
  getCatalogWorkspaceSlug,
  setDemoCatalogWorkspaceSlug,
  getDemoCatalogWorkspaceSlug,
  type CatalogModel,
} from "./data/model-catalog";
import { getApiBase, useRemoteModelApi } from "./config/api";
import {
  demoCatalogMissingMessage,
  demoCatalogEmptyMessage,
  resolveDemoWorkspaceSlug,
} from "./data/demo-catalog-resolver";
import {
  renderArModelPicker,
  patchArModelPicker,
  patchArScanning,
  renderArScanning,
  type ModelPickerItem,
} from "./ui/ar-model-picker";
import { renderPcModelManager } from "./ui/model-manager-pc";
import { renderOwnerDashboard, renderRestrictedAccount, renderTrialSuspendedAccount, type OwnerTab } from "./ui/owner-dashboard";
import { fetchMyWorkspaces } from "./data/workspace-api";
import {
  applyPlatformOverrides,
  createPlatformCoupon,
  deletePlatformCoupon,
  fetchPlatformCoupons,
  fetchPlatformWorkspaces,
  fetchPlatformWorkspacesDetail,
  isWorkspaceRestricted,
  platformSetWorkspacePlan,
  platformSetWorkspaceRestriction,
  platformSetWorkspaceFeatures,
  platformDeleteCustomerAccount,
  platformRefundPayment,
  fetchPlatformSettings,
  fetchPublicPromo,
  platformSetSalesDeckActive,
  platformSetMkt3StoryboardActive,
  platformSetDemoWorkspaceSlug,
  type PublicPromo,
} from "./data/platform-api";
import { fetchPublicSalesDeckConfig } from "./shared/sales-deck-settings";
import { isPlatformOwnerEmail } from "./shared/platform-owner";
import { validateCouponCreateInput } from "./shared/coupon-offer-form";
import {
  useDomOverlayInAR,
  useHtmlArTouchOverlay,
  isIOS,
  usesArHtmlPanel,
  iosQuickLookHint,
  getDeviceSummary,
} from "./utils/platform";
import { isDesktopAdmin, isDesktopOnlyRoute, isMobileExperience } from "./utils/device";
import { clearGlbCache, prefetchCatalogGlbs, getCachedGlb } from "./data/glb-cache";
import { disposeOfflineCache, getPreviewContainerForUrl, isGlbParsed, getCachedFootprintM, parseGlbsOfflineAtHome } from "./xr/glb-offline-cache";
import { scaledFootprintM } from "./xr/model-real-world-scale";
import {
  RETICLE_BUILTIN_PAD_FOOTPRINT_M,
  RETICLE_DEFAULT_FOOTPRINT_M,
} from "./xr/ring-pose";
import {
  ensureSessionLog,
  logArEvent,
  logFlowEvent,
  downloadArSessionReport,
  finishArSessionReport,
} from "./ar-session/logger";
import {
  enrichPlacementChecks,
  placementDetailsForLog,
  resetPlacementBaselines,
} from "./ar-session/placement-checks";
import {
  hideArDimensionHud,
  updateArDimensionHud,
} from "./ui/ar-dimension-hud";
import {
  disposeArObjectViewer,
  finishArObjectViewerLoad,
  hideArObjectViewer,
  prefetchArObjectViewer,
  showArObjectViewerLoading,
  warmObjectPreviewModel,
} from "./ui/ar-object-viewer";
import { renderAuthLogin } from "./ui/auth-login";
import { renderAuthSignup } from "./ui/auth-signup";
import { renderAuthForgotPassword } from "./ui/auth-forgot-password";
import { renderAuthOnboard } from "./ui/auth-onboard";
import { getIntendedTrialPlan, clearIntendedTrialPlan } from "./shared/intended-plan";
import { renderAdminDashboard } from "./ui/admin-dashboard";
import { renderAdminHelp } from "./ui/admin-help";
import { renderOnboardingGetStarted } from "./ui/onboarding-get-started";
import {
  beginNavTransition,
  installGlobalNavLoading,
  installNavLoadingAutoRelease,
  notifyRouteContentReady,
  releaseAuthSubmitLoading,
} from "./ui/nav-loading";
import {
  dismissOnboarding,
  isOnboardingComplete,
  loadOnboarding,
  markOnboardingStep,
  syncOnboardingUpload,
} from "./shared/onboarding-progress";
import { renderAdminModels } from "./ui/admin-models";
import { fetchWorkspaceAdminManifest, updateWorkspaceModelSettings } from "./data/tenant-model-api";
import { isCognitoAuthEnabled, changePassword } from "./auth/cognito-auth";
import {
  deleteAccount,
  ensureWorkspaceAfterAuth,
  forgotPassword,
  getCurrentUser,
  isUserNotConfirmedError,
  login,
  logout,
  onboardWorkspace,
  register,
  resetPassword,
  verifyEmail,
} from "./auth/flow";
import {
  cancelBillingSubscription,
  cancelScheduledBillingPlanChange,
  changeBillingPlan,
  createBillingCheckout,
  createBillingPortal,
  fetchPublicWorkspaceConfig,
  getBillingStatus,
  PublicShowroomBlockedError,
  updateWorkspaceSettings,
  uploadWorkspaceLogo,
  type BillingStatus,
} from "./data/workspace-api";
import { fetchWorkspaceUsage } from "./data/usage-api";
import { acceptOverageCharge, isOveragePaidLocally, seedSandboxUsage } from "./data/billing-api";
import type { PlanTier } from "./shared/plan-display";
import { planChangeScheduledMessage, planDisplayName } from "./shared/plan-display";
import {
  hasLiveBillingSubscription,
  isTrialSuspended,
  planActionVerb,
  planActionVerbForTier,
  subscribedBillingTier,
  trialFallbackTier,
} from "./shared/trial";
import {
  clearDeployRecoveryFlag,
  flushAnalyticsSessionEnd,
  installDeployRecovery,
  resetAnalyticsSession,
  trackAnalyticsEvent,
} from "./data/session-analytics";
import { renderAdminBranding } from "./ui/admin-branding";
import { renderMobileAdminHub } from "./ui/mobile-admin-hub";
import { modelIconSrc } from "./shared/model-icon";
import { applyWorkspaceTheme, workspaceLogoUrl } from "./branding/workspace-theme";
import type { Workspace } from "./shared/tenant";
import { isSupportedBillingCountry } from "./shared/dodo-billing-countries";
import {
  DEFAULT_WORKSPACE_FEATURES,
  normalizeWorkspaceFeatures,
  type WorkspaceFeatures,
} from "./shared/workspace-features";

const app = document.getElementById("app")!;
const arOverlay = document.getElementById("ar-overlay")!;
const arUiRoot = document.getElementById("ar-dom-panel")!;
const video = document.getElementById("camera-feed") as HTMLVideoElement;
const xrCanvas = document.getElementById("xr-canvas") as HTMLCanvasElement;

let webxr: WebXRSession | null = null;
let deviceTestCancelled = false;
let deviceTestArHint = "";
let lastDeviceTestReport: import("./device-test/types").DeviceTestReport | null = null;
let activeModelId: string | null = null;
/** Model highlighted in picker / 3D preview before or without floor placement. */
let pickerPreviewModelId: string | null = null;
let arFloorReady = false;
let pickerItemsCache: ModelPickerItem[] = [];
let placingModelId: string | null = null;
let lastPlacementFinishedAt = 0;
const PLACEMENT_DEBOUNCE_MS = 1800;
let downloadStatusHint = "";
let sessionFloorYs: number[] = [];
let floorStateUnsub: (() => void) | null = null;
let glbWarmupStarted = false;
let pendingWarmupUrls: string[] = [];
let pickerShownLogged = false;
let dimensionHudFrame = 0;
let arObjectModeActive = false;
let objectModeBusy = false;
/** True while enterArPlacementMode is awaiting WebXR — blocks route races. */
let arSessionStarting = false;
let activeTenantSlug: string | null = null;
let activeWorkspace: Workspace | null = null;
/** Exit AR destination from tenant public config (anonymous viewers). */
let tenantArExitUrl: string | null = null;
let tenantFeatures: WorkspaceFeatures = { ...DEFAULT_WORKSPACE_FEATURES };
/** Set when operator enables JSON log on any owned workspace — applies to live demo AR. */
let demoArSessionLogEnabled = false;

/** Live demo / global AR — full model picker. Tenant direct links — linked model only. */
function showFullCatalogInAr(): boolean {
  return (
    globalDemoLanding ||
    routePath() === "/demo" ||
    (routePath().startsWith("/ar/") && !activeTenantSlug)
  );
}

function arWarmupModelUrls(items: ModelPickerItem[], catalogSlug: string | null): string[] {
  const all = items
    .map((m) => resolveCatalogAssets(m, catalogSlug).modelUrl)
    .filter((u): u is string => Boolean(u));
  if (showFullCatalogInAr()) return all;
  if (!directArModelId) return all;
  return items
    .filter((m) => m.id === directArModelId)
    .map((m) => resolveCatalogAssets(m, catalogSlug).modelUrl)
    .filter((u): u is string => Boolean(u));
}

/** Catalog asset slug — null for legacy global manifest only. */
function catalogAssetSlug(): string | null {
  if (globalDemoLanding || routePath() === "/demo") {
    return getDemoCatalogWorkspaceSlug();
  }
  if (routePath().startsWith("/ar/") && !activeTenantSlug) {
    return getDemoCatalogWorkspaceSlug();
  }
  return getCatalogWorkspaceSlug() ?? activeTenantSlug ?? parseTenantRoute()?.slug ?? null;
}

/** Refresh workspace feature flags before AR (owner may have toggled JSON log). */
async function syncArSessionFeatures(): Promise<void> {
  const route = parseTenantRoute();
  const isGlobalAr =
    globalDemoLanding ||
    routePath() === "/demo" ||
    (routePath().startsWith("/ar/") && !activeTenantSlug);
  const tenantSlug = activeTenantSlug ?? route?.slug ?? null;
  if (tenantSlug && !isGlobalAr) {
    try {
      const config = await fetchPublicWorkspaceConfig(tenantSlug, { bustCache: true });
      if (config?.features) {
        tenantFeatures = normalizeWorkspaceFeatures(config.features);
      }
      if (config?.arExitUrl !== undefined) {
        tenantArExitUrl = config.arExitUrl ?? null;
      }
      const user = getCurrentUser();
      if (user) {
        const mine = (await fetchMyWorkspaces()).find((w) => w.slug === tenantSlug);
        if (mine?.features) {
          tenantFeatures = normalizeWorkspaceFeatures({
            ...tenantFeatures,
            ...mine.features,
          });
        }
      }
    } catch {
      /* keep cached tenantFeatures */
    }
    return;
  }
  if (isGlobalAr) {
    demoArSessionLogEnabled = false;
    try {
      let demoSlug = getDemoCatalogWorkspaceSlug();
      if (!demoSlug) {
        demoSlug = await resolveDemoWorkspaceSlug();
      }
      if (demoSlug) {
        const config = await fetchPublicWorkspaceConfig(demoSlug, { bustCache: true });
        if (config?.features) {
          tenantFeatures = normalizeWorkspaceFeatures(config.features);
        }
        if (normalizeWorkspaceFeatures(config?.features).sessionLogDownload) {
          demoArSessionLogEnabled = true;
        }
      }
      if (!demoArSessionLogEnabled) {
        const base = getApiBase().replace(/\/$/, "");
        const url = base ? `${base}/v2/platform/public-settings` : "/v2/platform/public-settings";
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const json = (await res.json()) as { demoSessionLogDownload?: boolean };
          if (json.demoSessionLogDownload) demoArSessionLogEnabled = true;
        }
      }
    } catch {
      /* keep false — owner sign-in path below may still enable */
    }
    const user = getCurrentUser();
    if (!demoArSessionLogEnabled && user && isPlatformOwnerEmail(user.email)) {
      await ensureOwnerWorkspaceLoaded();
      try {
        const workspaces = await fetchMyWorkspaces();
        demoArSessionLogEnabled = workspaces.some(
          (w) => normalizeWorkspaceFeatures(w.features).sessionLogDownload,
        );
        const wsId = activeWorkspace?.id;
        const fresh = wsId
          ? workspaces.find((w) => w.id === wsId)
          : workspaces[0];
        if (fresh) {
          activeWorkspace = applyPlatformOverrides(fresh);
        }
      } catch {
        /* keep activeWorkspace */
      }
    }
  }
}

function defaultPickerPreviewId(items = pickerItemsCache): string | null {
  const ready = items.find(
    (m) => !m.builtinType && Boolean(m.glb || m.glbUrl) && m.glbReady,
  );
  if (ready) return ready.id;
  const any = items.find((m) => !m.builtinType && Boolean(m.glb || m.glbUrl));
  return any?.id ?? null;
}

function pickerFocusModelId(): string | null {
  return (
    pickerPreviewModelId ??
    activeModelId ??
    directArModelId ??
    placingModelId ??
    defaultPickerPreviewId()
  );
}

function ensureDemoArCatalogContext(): void {
  // Tenant /w/{slug} routes must keep the workspace catalog — never swap to live demo.
  if (activeTenantSlug || parseTenantRoute()) return;
  if (!showFullCatalogInAr()) return;
  activeTenantSlug = null;
  const demoSlug = getDemoCatalogWorkspaceSlug();
  setCatalogWorkspaceSlug(demoSlug);
}

async function ensureDemoCatalogReady(): Promise<string | null> {
  if (getCurrentUser() && isPlatformOwnerEmail(getCurrentUser()?.email)) {
    await ensureOwnerWorkspaceLoaded();
  }
  const slug = await resolveDemoWorkspaceSlug();
  if (slug) {
    setDemoCatalogWorkspaceSlug(slug);
    if (showFullCatalogInAr()) {
      activeTenantSlug = null;
      setCatalogWorkspaceSlug(slug);
    }
  }
  return slug;
}

function invalidatePickerCache(): void {
  pickerItemsCache = [];
  homeWarmupStarted = false;
}

/** AR session feature flags — live demo inherits operator workspace toggles. */
function arSessionFeatures(): WorkspaceFeatures {
  const isGlobalAr =
    globalDemoLanding ||
    routePath() === "/demo" ||
    (routePath().startsWith("/ar/") && !activeTenantSlug);
  if (isGlobalAr) {
    if (demoArSessionLogEnabled || tenantFeatures.sessionLogDownload) {
      return {
        ...DEFAULT_WORKSPACE_FEATURES,
        startAr: true,
        sessionLogDownload: true,
      };
    }
    const user = getCurrentUser();
    if (user && isPlatformOwnerEmail(user.email) && activeWorkspace) {
      return normalizeWorkspaceFeatures(activeWorkspace.features);
    }
    return { ...DEFAULT_WORKSPACE_FEATURES, startAr: true };
  }
  return tenantFeatures;
}

async function ensureOwnerWorkspaceLoaded(): Promise<Workspace | null> {
  const user = getCurrentUser();
  if (!user || !isPlatformOwnerEmail(user.email)) return activeWorkspace;
  try {
    const ws = await ensureWorkspaceAfterAuth();
    if (ws !== "onboard") {
      activeWorkspace = applyPlatformOverrides(ws);
      if (ws.slug) setDemoCatalogWorkspaceSlug(ws.slug);
      return activeWorkspace;
    }
  } catch {
    /* optional */
  }
  return activeWorkspace;
}

let signupNeedsVerification = false;
let forgotPasswordNeedsCode = false;
/** After sign-in with an unverified account, verify then route straight to dashboard. */
let verifyThenDashboard = false;
let pendingVerifyEmail = "";
let pendingLoginPassword = "";
/** When set, AR shows only this catalog model (direct share link). */
let directArModelId: string | null = null;

function stopDimensionHudLoop(): void {
  if (dimensionHudFrame) cancelAnimationFrame(dimensionHudFrame);
  dimensionHudFrame = 0;
  hideArDimensionHud();
}

function startDimensionHudLoop(): void {
  stopDimensionHudLoop();
  const tick = () => {
    if (!webxr) return;
    updateArDimensionHud(webxr.getPlacedDimensionHud());
    dimensionHudFrame = requestAnimationFrame(tick);
  };
  dimensionHudFrame = requestAnimationFrame(tick);
}

function sessionMedianFloorY(): number | undefined {
  if (!sessionFloorYs.length) return undefined;
  const sorted = [...sessionFloorYs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function setBodyTrainingState(state: "home" | "webxr"): void {
  document.body.classList.remove("training-camera", "xr-session-active");
  if (state === "webxr") document.body.classList.add("xr-session-active");
}

function showVideo(show: boolean): void {
  video.classList.toggle("hidden", !show);
}

function showXrCanvas(show: boolean): void {
  xrCanvas.classList.toggle("hidden", !show);
}

function arDomOverlayRoot(): HTMLElement | null {
  return useDomOverlayInAR() ? arOverlay : null;
}

function arHtmlUiRoot(): HTMLElement {
  return usesArHtmlPanel() ? arUiRoot : app;
}

function setArOverlayVisible(show: boolean): void {
  if (usesArHtmlPanel()) {
    arOverlay.classList.toggle("hidden", !show);
  } else {
    arOverlay.classList.add("hidden");
  }
  if (!show) {
    arUiRoot.innerHTML = "";
    if (!usesArHtmlPanel()) app.innerHTML = "";
  }
}

function clearSession(options?: { skipSessionLog?: boolean }): void {
  if (webxr && !options?.skipSessionLog) {
    logArEvent("session-end", "AR session ended", "info");
    flushAnalyticsSessionEnd();
    finishArSessionReport();
  }
  pickerItemsCache = [];
  placingModelId = null;
  lastPlacementFinishedAt = 0;
  downloadStatusHint = "";
  clearGlbCache();
  disposeOfflineCache();
  webxr?.dispose();
  webxr = null;
  floorStateUnsub?.();
  floorStateUnsub = null;
  glbWarmupStarted = false;
  pendingWarmupUrls = [];
  pickerShownLogged = false;
  stopDimensionHudLoop();
  disposeArObjectViewer();
  arObjectModeActive = false;
  document.body.classList.remove("ios-webxr-viewer", "ios-camera-fallback", "ar-object-mode-active");
  showVideo(false);
  showXrCanvas(false);
  setArOverlayVisible(false);
  setBodyTrainingState("home");
  activeModelId = null;
  pickerPreviewModelId = null;
  arFloorReady = false;
}

const PLACE_MODEL_TIMEOUT_MS = 18000;

function buildHomeCameraWarning(camera: ReturnType<typeof getCameraSupport>): string | undefined {
  if (!camera.ok) {
    return camera.detail ?? camera.message;
  }
  if (isIOS()) {
    return iosQuickLookHint();
  }
  return undefined;
}

function getEffectiveArExitUrl(modelHint?: CatalogModel | null): string | null {
  const modelId = directArModelId ?? activeModelId ?? modelHint?.id;
  if (modelId) {
    const item = pickerItemsCache.find((m) => m.id === modelId);
    const modelExit = (item?.arExitUrl ?? modelHint?.arExitUrl)?.trim();
    if (modelExit) return modelExit;
  }
  return tenantArExitUrl?.trim() || null;
}

/** Back to catalog — configured product/store URL, or tenant/global catalog home. */
function goToCatalogDestination(modelHint?: CatalogModel): void {
  logFlowEvent("flow-catalog-back-tap", "Back to catalog tapped", "info", {
    modelId: modelHint?.id ?? directArModelId ?? activeModelId,
    exitUrl: getEffectiveArExitUrl(modelHint),
  });
  if (webxr) clearSession();
  navigateAfterCatalogExit(modelHint);
}

function renderDirectModelLanding(
  record: CatalogModel,
  options: {
    slug?: string;
    branding?: import("./shared/tenant").WorkspaceBranding;
    features?: WorkspaceFeatures;
    onBack: () => void;
  }
): void {
  const camera = getCameraSupport();
  const iosOnly = isIOS();
  logFlowEvent("flow-direct-ar-landing", "Direct model AR landing shown", "info", {
    modelId: record.id,
    device: getDeviceSummary(),
    cameraOk: camera.ok,
  });
  const features = normalizeWorkspaceFeatures(options.features ?? tenantFeatures);
  ensureSessionLog();
  renderHomeMinimal(app, {
    title: record.name,
    subtitle: iosOnly
      ? "View this product in AR with Safari AR."
      : "Place this product on the floor in AR.",
    slug: options.slug,
    branding: options.branding,
    deviceLine: getDeviceSummary(),
    cameraWarning: buildHomeCameraWarning(camera),
    iosQuickLookOnly: iosOnly,
    startArEnabled: features.startAr,
    cameraCheckEnabled: features.cameraCheck,
    onQuickLookAr: () => {
      void openIosQuickLookForModel(record, options.slug ?? catalogAssetSlug());
    },
    onStartAr: () => {
      logFlowEvent("flow-start-ar-tap", "Start AR tapped on direct model link", "info", {
        modelId: record.id,
      });
      void enterArPlacementMode();
    },
    onRunDeviceCheck: () => {
      logFlowEvent("flow-device-check-tap", "Device check tapped on direct model link", "info", {
        modelId: record.id,
      });
      void runDeviceCheck();
    },
    onBack: options.onBack,
    variant: "direct-link",
    sessionLogDownload: features.sessionLogDownload,
    onDownloadLog: features.sessionLogDownload
      ? () => runDownloadSessionLogForUi(app)
      : undefined,
  });
  void warmCatalogAtHome();
  routePainted();
}

function arStartFailureMessage(): string {
  if (isIOS()) {
    return "WebXR AR is not available on iOS. Use View in AR (Safari AR) from the home screen.";
  }
  return "AR could not start. Use Chrome on Android and allow camera access.";
}

function cancelModelLoad(): void {
  if (!placingModelId) return;
  webxr?.cancelPlacement();
  placingModelId = null;
  void refreshArPicker();
}

/** Android + iOS: coalesce floor-state picker refreshes to one per frame. */
let pickerRefreshScheduled = false;
function schedulePickerRefresh(): void {
  if (pickerRefreshScheduled) return;
  pickerRefreshScheduled = true;
  requestAnimationFrame(() => {
    pickerRefreshScheduled = false;
    void refreshArPicker();
  });
}

let homeWarmupStarted = false;

/** Prefetch + parse catalog GLBs on home screen — avoids lazy PBR chunks during AR. */
async function warmCatalogAtHome(): Promise<void> {
  if (isIOS()) return;
  if (homeWarmupStarted) return;
  homeWarmupStarted = true;
  try {
    await preloadBabylonGltfPipeline();
    clearDeployRecoveryFlag();
    const items = await loadPickerItemsCache();
    const slug = catalogAssetSlug();
    const warmUrls = arWarmupModelUrls(items, slug);
    if (!warmUrls.length) return;
    await prefetchCatalogGlbs(warmUrls);
    await parseGlbsOfflineAtHome(warmUrls, { timeoutMs: 60000 });
    await loadPickerItemsCache();
  } catch (e) {
    console.warn("[atlas] home GLB warmup failed", e);
  }
}

function routePath(): string {
  const base = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
  let path = location.pathname;
  if (base && path.startsWith(base)) {
    path = path.slice(base.length) || "/";
  }
  return path.replace(/\/$/, "") || "/";
}

function routePainted(): void {
  notifyRouteContentReady(routePath());
}

function navigateTo(path: string, replace = false, source?: HTMLElement): void {
  beginNavTransition(source ?? null, path);
  const base = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
  const full = `${base}${path.startsWith("/") ? path : `/${path}`}` || base || "/";
  if (replace) {
    history.replaceState(null, "", full);
  } else {
    history.pushState(null, "", full);
  }
  routeApp();
}

function globalArModelFromPath(): string | null {
  const match = /^\/ar\/([^/]+)$/.exec(routePath());
  return match ? decodeURIComponent(match[1]!) : null;
}

function parseTenantRoute(): { slug: string; modelId?: string } | null {
  const direct = /^\/w\/([^/]+)\/ar\/([^/]+)$/.exec(routePath());
  if (direct) {
    return {
      slug: decodeURIComponent(direct[1]!),
      modelId: decodeURIComponent(direct[2]!),
    };
  }
  const home = /^\/w\/([^/]+)$/.exec(routePath());
  if (home) return { slug: decodeURIComponent(home[1]!) };
  return null;
}

/** Open a tenant showroom — never the live-demo catalog. Clears demo landing context. */
function openTenantShowroom(slug: string): void {
  globalDemoLanding = false;
  activeTenantSlug = slug;
  setCatalogWorkspaceSlug(slug);
  navigateTo(`/w/${encodeURIComponent(slug)}`, true);
}

async function afterAuthRoute(): Promise<void> {
  const next = await ensureWorkspaceAfterAuth();
  if (next === "onboard") {
    navigateTo("/onboard", true);
    return;
  }
  activeWorkspace = next;
  if (isDesktopAdmin()) {
    void navigateAdminEntry(next);
    return;
  }
  activeTenantSlug = next.slug;
  setCatalogWorkspaceSlug(next.slug);
  openTenantShowroom(next.slug);
}

function showMobileAdminDesktopOnlyGate(): void {
  void showMobileAdminHub();
}

async function showMobileAdminHub(): Promise<void> {
  const user = getCurrentUser();
  const workspace = activeWorkspace;
  if (!user || !workspace) {
    goHome();
    return;
  }
  let modelCount: number | undefined;
  try {
    const usage = await fetchWorkspaceUsage(workspace.id);
    modelCount = usage?.usage.modelCount;
  } catch {
    /* optional */
  }
  const isPlatformOwner = isPlatformOwnerEmail(user.email);
  const modelCountKnown = modelCount ?? (await countUserModels(workspace.id).catch(() => undefined));
  const showGetStarted =
    !isPlatformOwner && !isOnboardingComplete(workspace.id, modelCountKnown ?? 0);
  renderMobileAdminHub(app, {
    workspace,
    email: user.email,
    modelCount: modelCountKnown,
    showOwnerLink: isPlatformOwner,
    onShowroom: () => {
      void openTenantShowroom(workspace.slug);
    },
    onBranding: () => navigateTo("/admin/branding", true),
    onAccount: () => navigateTo("/account", true),
    onGetStarted: showGetStarted ? () => navigateTo("/admin/get-started") : undefined,
    onOwner: isPlatformOwner ? () => navigateTo("/owner") : undefined,
    onSignOut: () => {
      logout();
      activeWorkspace = null;
      goHome();
    },
    onBack: () => goHome(),
  });
  routePainted();
}

/** Mobile users blocked from full admin — redirect or show desktop-only gate. */
async function routeMobileAwayFromDesktopOnly(path: string): Promise<void> {
  if (path.startsWith("/admin")) {
    if (!getCurrentUser()) {
      navigateTo("/login", true);
      return;
    }
    try {
      const ws = await ensureWorkspaceAfterAuth();
      if (ws !== "onboard") activeWorkspace = ws;
    } catch {
      /* gate still useful */
    }
    showMobileAdminDesktopOnlyGate();
    return;
  }
  if (getCurrentUser()) {
    try {
      const ws = await ensureWorkspaceAfterAuth();
      if (ws !== "onboard") {
        activeWorkspace = ws;
        activeTenantSlug = ws.slug;
        setCatalogWorkspaceSlug(ws.slug);
        navigateTo(`/w/${encodeURIComponent(ws.slug)}`, true);
        void showTenantHome(ws.slug);
        return;
      }
    } catch {
      /* fall through to preview home */
    }
  }
  goHome();
}

function showLoginScreen(error?: string): void {
  clearSession({ skipSessionLog: true });
  const mobile = isMobileExperience();
  renderAuthLogin(app, {
    cognitoEnabled: isCognitoAuthEnabled(),
    error,
    subtitle: mobile ? MKT.authLoginSubMobile : MKT.authLoginSubDesktop,
    onSubmit: async (email, password) => {
      try {
        await login(email, password);
        verifyThenDashboard = false;
        pendingLoginPassword = "";
        pendingVerifyEmail = "";
        await afterAuthRoute();
        releaseAuthSubmitLoading(routePath());
      } catch (e) {
        if (isUserNotConfirmedError(e)) {
          signupNeedsVerification = true;
          verifyThenDashboard = true;
          pendingVerifyEmail = email.trim().toLowerCase();
          pendingLoginPassword = password;
          releaseAuthSubmitLoading(routePath());
          showSignupScreen("Confirm your email before signing in.");
          return;
        }
        releaseAuthSubmitLoading(routePath());
        showLoginScreen(e instanceof Error ? e.message : String(e));
      }
    },
    onForgotPassword: () => navigateTo("/forgot-password"),
    onSignUp: () => navigateTo("/signup"),
    onBack: () => goHome(),
  });
  routePainted();
}

function showForgotPasswordScreen(error?: string, info?: string): void {
  clearSession({ skipSessionLog: true });
  renderAuthForgotPassword(app, {
    cognitoEnabled: isCognitoAuthEnabled(),
    error,
    info,
    needsCode: forgotPasswordNeedsCode,
    onRequestCode: async (email) => {
      try {
        await forgotPassword(email);
        forgotPasswordNeedsCode = true;
        showForgotPasswordScreen(undefined, "Reset code sent — check your email (including spam).");
      } catch (e) {
        showForgotPasswordScreen(e instanceof Error ? e.message : String(e));
      }
    },
    onConfirm: async (email, code, password) => {
      try {
        await resetPassword(email, code, password);
        forgotPasswordNeedsCode = false;
        showLoginScreen("Password updated — sign in with your new password.");
      } catch (e) {
        showForgotPasswordScreen(e instanceof Error ? e.message : String(e));
      }
    },
    onSignIn: () => {
      forgotPasswordNeedsCode = false;
      navigateTo("/login");
    },
    onBack: () => goHome(),
  });
  routePainted();
}

function showSignupScreen(error?: string): void {
  renderAuthSignup(app, {
    cognitoEnabled: isCognitoAuthEnabled(),
    error,
    subtitle: isMobileExperience() ? MKT.authSignupSubMobile : undefined,
    needsVerification: signupNeedsVerification,
    prefillEmail: pendingVerifyEmail || undefined,
    onRegister: async (email, password) => {
      try {
        verifyThenDashboard = false;
        pendingLoginPassword = "";
        const result = await register(email, password);
        if (result.needsVerification) {
          signupNeedsVerification = true;
          pendingVerifyEmail = email.trim().toLowerCase();
          releaseAuthSubmitLoading(routePath());
          showSignupScreen();
          return;
        }
        signupNeedsVerification = false;
        pendingVerifyEmail = "";
        await afterAuthRoute();
        releaseAuthSubmitLoading(routePath());
      } catch (e) {
        releaseAuthSubmitLoading(routePath());
        showSignupScreen(e instanceof Error ? e.message : String(e));
      }
    },
    onConfirm: async (email, code) => {
      try {
        await verifyEmail(email, code);
        signupNeedsVerification = false;
        if (verifyThenDashboard && pendingLoginPassword) {
          await login(email, pendingLoginPassword);
          verifyThenDashboard = false;
          pendingLoginPassword = "";
          pendingVerifyEmail = "";
          await afterAuthRoute();
          releaseAuthSubmitLoading(routePath());
          return;
        }
        verifyThenDashboard = false;
        pendingLoginPassword = "";
        pendingVerifyEmail = "";
        releaseAuthSubmitLoading(routePath());
        showLoginScreen("Email verified — sign in to continue.");
      } catch (e) {
        releaseAuthSubmitLoading(routePath());
        showSignupScreen(e instanceof Error ? e.message : String(e));
      }
    },
    onSignIn: () => {
      signupNeedsVerification = false;
      verifyThenDashboard = false;
      pendingLoginPassword = "";
      pendingVerifyEmail = "";
      navigateTo("/login");
    },
    onBack: () => goHome(),
    onLegalTerms: () => navigateTo("/legal/terms"),
    onLegalPrivacy: () => navigateTo("/legal/privacy"),
  });
  routePainted();
}

async function confirmDeleteAccount(): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("/login", true);
    return;
  }

  if (isPlatformOwnerEmail(user.email)) {
    window.alert(
      "Platform operator accounts cannot be deleted from the app. Contact infrastructure support if you need to change operator access."
    );
    return;
  }

  const ok = window.confirm(
    "Delete your Atlas AR account permanently?\n\nThis removes your login, workspace, and uploaded 3D models.\n\nThis cannot be undone."
  );
  if (!ok) return;

  try {
    await deleteAccount();
    activeWorkspace = null;
    goHome();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  }
}

function showOnboardScreen(error?: string): void {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("/login", true);
    return;
  }
  const intendedTrialPlan = getIntendedTrialPlan();
  renderAuthOnboard(app, {
    email: user.email,
    error,
    trialPlan: intendedTrialPlan ?? "growth",
    canDeleteAccount: !isPlatformOwnerEmail(user.email),
    onSubmit: async (name, slug) => {
      try {
        activeWorkspace = await onboardWorkspace(name, slug, intendedTrialPlan ?? undefined);
        clearIntendedTrialPlan();
        activeTenantSlug = activeWorkspace.slug;
        navigateTo("/admin/get-started", true);
      } catch (e) {
        showOnboardScreen(e instanceof Error ? e.message : String(e));
      }
    },
    onSignOut: () => {
      logout();
      goHome();
    },
    onDeleteAccount: () => void confirmDeleteAccount(),
    onLegalTerms: () => navigateTo("/legal/terms"),
    onLegalPrivacy: () => navigateTo("/legal/privacy"),
  });
  routePainted();
}

async function showAdminModelsScreen(): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("/login", true);
    return;
  }
  try {
    const next = await ensureWorkspaceAfterAuth();
    if (next === "onboard") {
      navigateTo("/onboard", true);
      return;
    }
    activeWorkspace = applyPlatformOverrides(next);
    if (blockWorkspaceAccess(activeWorkspace)) return;
    applyWorkspaceTheme(activeWorkspace);
    setCatalogWorkspaceSlug(activeWorkspace.slug);
    const models = await fetchWorkspaceAdminManifest(activeWorkspace.id);
    syncOnboardingUpload(activeWorkspace.id, models.filter((m) => !isDemoCatalogModel(m)).length);
    renderAdminModels(app, activeWorkspace, models, {
      onBack: () => navigateTo("/admin"),
      onHelp: () => navigateTo("/admin/help"),
      onChanged: () => {
        invalidatePickerCache();
        void showAdminModelsScreen();
      },
      onSaveArExitUrl: async (url) => {
        activeWorkspace = await updateWorkspaceSettings(activeWorkspace!.id, {
          arExitUrl: url || null,
        });
        tenantArExitUrl = activeWorkspace.arExitUrl ?? null;
      },
      onSaveModelArExitUrl: async (modelId, url) => {
        await updateWorkspaceModelSettings(activeWorkspace!.id, modelId, {
          arExitUrl: url || null,
        });
      },
      onUpgrade: () => navigateTo("/account"),
    });
    routePainted();
  } catch (e) {
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => navigateTo("/admin"));
    routePainted();
  }
}

function showTrialSuspendedGate(workspace: Workspace): boolean {
  if (!isTrialSuspended(workspace)) return false;
  const required = planDisplayName(workspace.plan, trialFallbackTier(workspace.trialPlan ?? "growth"));
  renderTrialSuspendedAccount(app, required, {
    actionVerb: planActionVerb(workspace),
    onAccount: () => navigateTo("/account"),
    onSignOut: () => {
      logout();
      activeWorkspace = null;
      goHome();
    },
  });
  routePainted();
  return true;
}

/** Restricted or trial-suspended workspace — blocks admin and account flows. */
function blockWorkspaceAccess(workspace: Workspace): boolean {
  if (isWorkspaceRestricted(workspace)) {
    renderRestrictedAccount(
      app,
      workspace.restrictionReason ?? "Policy violation",
      () => {
        logout();
        activeWorkspace = null;
        goHome();
      },
    );
    routePainted();
    return true;
  }
  return showTrialSuspendedGate(workspace);
}

function renderPublicShowroomBlocked(kind: "restricted" | "suspended", message: string): void {
  const title = kind === "suspended" ? "Showroom paused" : "Showroom unavailable";
  const sub =
    kind === "suspended"
      ? "This workspace's trial has ended. The owner can subscribe from Account to restore the catalog."
      : message;
  app.innerHTML = `
    <div class="home ar-landing-page">
      <div class="ar-landing-card ar-landing-card--warn">
        <p class="mkt-eyebrow">${escapeHtml(title)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="home-sub">${escapeHtml(sub)}</p>
        <button type="button" class="btn btn-ghost btn-block" data-action="back">Back</button>
      </div>
    </div>`;
  app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
  routePainted();
}

function mergeBillingStatus(workspace: Workspace, billing: BillingStatus): Workspace {
  if (!billing.subscription) return workspace;
  const entitlementTier = billing.entitlementTier as Workspace["billingEntitlementTier"];
  const paidLive =
    Boolean(entitlementTier) &&
    (billing.subscription.status === "active" ||
      billing.subscription.status === "past_due" ||
      billing.subscription.status === "canceled");
  const merged: Workspace = {
    ...workspace,
    billingProvider: billing.subscription.provider,
    billingStatus: billing.subscription.status as Workspace["billingStatus"],
    billingEntitlementTier: entitlementTier,
    billingSubscriptionId:
      billing.subscription.providerSubscriptionId ?? workspace.billingSubscriptionId,
    billingCurrentPeriodEnd: billing.subscription.currentPeriodEnd,
    billingGraceUntil: billing.subscription.graceUntil,
    billingCancelAtPeriodEnd:
      billing.subscription.status === "active" ||
      billing.subscription.status === "past_due" ||
      billing.subscription.status === "canceled"
        ? billing.subscription.cancelAtPeriodEnd
        : false,
  };
  if (paidLive && entitlementTier) {
    let plan: Workspace["plan"] = "starter";
    if (entitlementTier === "growth") plan = "pro";
    else if (entitlementTier === "scale") plan = "enterprise";
    return {
      ...merged,
      trialEndsAt: null,
      trialPlan: null,
      purchasedBillingTier: entitlementTier,
      billingTier: entitlementTier,
      plan,
    };
  }
  return merged;
}

function requireBillingCountry(country: string, provider: Workspace["billingProvider"] = "dodo"): string {
  const normalized = country.trim().toUpperCase();
  if (!isSupportedBillingCountry(normalized, provider ?? "dodo")) {
    throw new Error("Select a billing country from the list before continuing");
  }
  return normalized;
}

async function showAccountScreen(opts?: {
  passwordError?: string;
  passwordSuccess?: string;
  billingError?: string;
  billingSuccess?: string;
}): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("/login", true);
    return;
  }
  try {
    const next = await ensureWorkspaceAfterAuth();
    if (next === "onboard") {
      navigateTo("/onboard", true);
      return;
    }
    const workspaceBase = applyPlatformOverrides(next);
    let workspace = workspaceBase;
    let scheduledPlanChange: BillingStatus["scheduledPlanChange"] = null;
    try {
      const billing = await getBillingStatus(workspaceBase.id);
      workspace = mergeBillingStatus(workspaceBase, billing);
      scheduledPlanChange = billing.scheduledPlanChange ?? null;
    } catch {
      /* billing status API optional until deployed */
    }
    activeWorkspace = workspace;
    if (isWorkspaceRestricted(workspace)) {
      renderRestrictedAccount(
        app,
        workspace.restrictionReason ?? "Policy violation",
        () => {
          logout();
          activeWorkspace = null;
          goHome();
        },
      );
      routePainted();
      return;
    }
    applyWorkspaceTheme(workspace);
    const isPlatformOwner = isPlatformOwnerEmail(user.email);
    let usage = null;
    try {
      usage = await fetchWorkspaceUsage(workspace.id);
      if (usage && isPlatformOwner) {
        usage = { ...usage, warnings: [] };
      }
    } catch {
      /* usage API optional until deployed */
    }
    renderAccountPage(
      app,
      {
        email: user.email,
        userId: user.sub,
        cognitoEnabled: isCognitoAuthEnabled(),
        workspace: workspace,
        usage,
        usageUnrestricted: isPlatformOwner,
        overagePaid: usage?.overagePaid ?? (usage ? isOveragePaidLocally(workspace.id, usage.usage.month) : false),
        overageAccepted: usage?.overageAccepted ?? false,
        sandboxSeedEnabled: Boolean(usage?.sandboxSeedEnabled) || isPlatformOwner,
        scheduledPlanChange,
        ...opts,
      },
      {
        showAdminLink: isDesktopAdmin(),
        showAdminDesktopNote: isMobileExperience(),
        onChangePassword: async (current, next) => {
          if (next === "__mismatch__") {
            void showAccountScreen({ passwordError: "New passwords do not match." });
            return;
          }
          if (next.length < 8) {
            void showAccountScreen({ passwordError: "Password must be at least 8 characters." });
            return;
          }
          try {
            await changePassword(current, next);
            void showAccountScreen({ passwordSuccess: "Password updated successfully." });
          } catch (e) {
            void showAccountScreen({ passwordError: e instanceof Error ? e.message : String(e) });
          }
        },
        onUpgradePlan: async (tier: PlanTier, checkout) => {
          try {
            if (tier.id === "scale") throw new Error("Scale requires a sales-assisted contract");
            const billingCountry = requireBillingCountry(
              checkout.billingCountry,
              activeWorkspace!.billingProvider,
            );
            if (hasLiveBillingSubscription(activeWorkspace!)) {
              if (subscribedBillingTier(activeWorkspace!) === tier.id) {
                void showAccountScreen({ billingSuccess: `You are already on ${tier.name}.` });
                return;
              }
              const verb = planActionVerbForTier(activeWorkspace!, tier.id);
              await changeBillingPlan(activeWorkspace!.id, tier.id, billingCountry);
              void showAccountScreen({
                billingSuccess: planChangeScheduledMessage(verb, tier.name),
              });
              return;
            }
            const result = await createBillingCheckout(activeWorkspace!.id, {
              tier: tier.id,
              billingCountry,
              email: user.email,
              couponCode: checkout.couponCode,
            });
            window.location.assign(result.checkoutUrl);
          } catch (e) {
            void showAccountScreen({ billingError: e instanceof Error ? e.message : String(e) });
          }
        },
        onManageBilling: hasLiveBillingSubscription(activeWorkspace)
          ? async (checkout) => {
              try {
                const billingCountry = requireBillingCountry(
              checkout.billingCountry,
              activeWorkspace!.billingProvider,
            );
                const session = await createBillingPortal(activeWorkspace!.id, billingCountry);
                window.location.assign(session.portalUrl);
              } catch (e) {
                void showAccountScreen({ billingError: e instanceof Error ? e.message : String(e) });
              }
            }
          : undefined,
        onCancelBilling: hasLiveBillingSubscription(activeWorkspace)
          ? async () => {
              if (!window.confirm("Cancel this subscription at the end of its billing period?")) return;
              try {
                await cancelBillingSubscription(activeWorkspace!.id);
                activeWorkspace = {
                  ...activeWorkspace!,
                  billingCancelAtPeriodEnd: true,
                };
                void showAccountScreen({
                  billingSuccess: "Cancellation requested. Access continues through the paid period.",
                });
              } catch (e) {
                void showAccountScreen({ billingError: e instanceof Error ? e.message : String(e) });
              }
            }
          : undefined,
        onCancelScheduledPlanChange:
          hasLiveBillingSubscription(activeWorkspace) &&
          activeWorkspace?.billingProvider === "dodo"
            ? async () => {
                if (
                  !window.confirm(
                    "Cancel the scheduled plan change? Your current plan stays until you choose a new one.",
                  )
                ) {
                  return;
                }
                try {
                  await cancelScheduledBillingPlanChange(activeWorkspace!.id);
                  void showAccountScreen({
                    billingSuccess: "Scheduled plan change canceled.",
                  });
                } catch (e) {
                  void showAccountScreen({
                    billingError: e instanceof Error ? e.message : String(e),
                  });
                }
              }
            : undefined,
        onPayOverage: async (amountUsd) => {
          if (!usage) return;
          try {
            const result = await acceptOverageCharge(activeWorkspace!.id, usage.usage.month, amountUsd);
            const message =
              result.paymentPending
                ? `Overage of $${amountUsd.toFixed(2)} accepted for ${usage.usage.month}. Invoicing is pending.`
                : `Overage of $${amountUsd.toFixed(2)} accepted for ${usage.usage.month}.`;
            void showAccountScreen({ billingSuccess: message });
          } catch (e) {
            void showAccountScreen({ billingError: e instanceof Error ? e.message : String(e) });
          }
        },
        onSeedSandboxOverage: async () => {
          try {
            const result = await seedSandboxUsage(activeWorkspace!.id, { preset: "overage" });
            void showAccountScreen({
              billingSuccess: `Sandbox overage seeded (sessions ${result.usage?.sessionCount ?? "?"}, est. $${(result.estimatedOverageUsd ?? 0).toFixed(2)}).`,
            });
          } catch (e) {
            void showAccountScreen({ billingError: e instanceof Error ? e.message : String(e) });
          }
        },
        onClearSandboxUsage: async () => {
          try {
            await seedSandboxUsage(activeWorkspace!.id, { reset: true });
            await seedSandboxUsage(activeWorkspace!.id, { resetOverage: true });
            void showAccountScreen({ billingSuccess: "Sandbox usage and overage records cleared." });
          } catch (e) {
            void showAccountScreen({ billingError: e instanceof Error ? e.message : String(e) });
          }
        },
        onAdmin: () => navigateTo("/admin"),
        onBranding: isMobileExperience() ? () => navigateTo("/admin/branding") : undefined,
        onOwner: isPlatformOwnerEmail(user.email) ? () => navigateTo("/owner") : undefined,
        showOwnerLink: isPlatformOwnerEmail(user.email),
        onPricing: () => navigateTo("/pricing"),
        onSignOut: () => {
          logout();
          activeWorkspace = null;
          goHome();
        },
        onBack: () => {
          const slug = activeWorkspace?.slug ?? activeTenantSlug;
          if (slug) {
            openTenantShowroom(slug);
            return;
          }
          goHome();
        },
      }
    );
    routePainted();
  } catch (e) {
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
    routePainted();
  }
}

async function countUserModels(workspaceId: string): Promise<number> {
  try {
    const models = await fetchWorkspaceAdminManifest(workspaceId);
    return models.filter((m) => !isDemoCatalogModel(m)).length;
  } catch {
    return 0;
  }
}

async function navigateAdminEntry(workspace: Workspace): Promise<void> {
  const modelCount = await countUserModels(workspace.id);
  const path = isOnboardingComplete(workspace.id, modelCount) ? "/admin" : "/admin/get-started";
  navigateTo(path, true);
}

function showroomAbsoluteUrl(slug: string): string {
  const base = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
  const path = `${base}/w/${encodeURIComponent(slug)}`.replace(/\/\//g, "/");
  return `${location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

async function showOnboardingGetStartedScreen(): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("/login", true);
    return;
  }
  try {
    const next = await ensureWorkspaceAfterAuth();
    if (next === "onboard") {
      navigateTo("/onboard", true);
      return;
    }
    const workspace = applyPlatformOverrides(next);
    activeWorkspace = workspace;
    if (blockWorkspaceAccess(workspace)) return;
    applyWorkspaceTheme(workspace);
    const modelCount = await countUserModels(workspace.id);
    syncOnboardingUpload(workspace.id, modelCount);
    const showroomUrl = showroomAbsoluteUrl(workspace.slug);
    renderOnboardingGetStarted(app, workspace, {
      email: user.email,
      modelCount,
      showroomUrl,
      onUpload: () => navigateTo("/admin/models"),
      onCopyLink: async () => {
        try {
          await navigator.clipboard.writeText(showroomUrl);
          markOnboardingStep(workspace.id, "share");
        } catch {
          /* clipboard may fail on http localhost */
          markOnboardingStep(workspace.id, "share");
        }
        void showOnboardingGetStartedScreen();
      },
      onOpenShowroom: () => {
        markOnboardingStep(workspace.id, "preview");
        void openTenantShowroom(workspace.slug);
      },
      onPreviewAr: () => {
        if (modelCount < 1) {
          alert(
            "Upload at least one 3D model before Preview AR. Your empty showroom will not open the live demo catalog.",
          );
          navigateTo("/admin/models");
          return;
        }
        markOnboardingStep(workspace.id, "preview");
        void openTenantShowroom(workspace.slug);
      },
      onAdmin: () => navigateTo("/admin"),
      onHelp: () => navigateTo("/admin/help"),
      onDismiss: () => {
        dismissOnboarding(workspace.id);
        navigateTo("/admin");
      },
      onBack: () => goHome(),
    });
    routePainted();
  } catch (e) {
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
    routePainted();
  }
}

async function showAdminHelpScreen(): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("/login", true);
    return;
  }
  try {
    const next = await ensureWorkspaceAfterAuth();
    if (next === "onboard") {
      navigateTo("/onboard", true);
      return;
    }
    activeWorkspace = applyPlatformOverrides(next);
    if (blockWorkspaceAccess(activeWorkspace)) return;
    applyWorkspaceTheme(activeWorkspace);
    const sharePath = `/w/${encodeURIComponent(activeWorkspace.slug)}`;
    renderAdminHelp(app, activeWorkspace, {
      showroomPath: sharePath,
      onGetStarted: () => navigateTo("/admin/get-started"),
      onManageModels: () => navigateTo("/admin/models"),
      onBack: () => navigateTo("/admin"),
    });
    routePainted();
  } catch (e) {
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => navigateTo("/admin"));
    routePainted();
  }
}

async function showAdminScreen(): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("/login", true);
    return;
  }
  try {
    const next = await ensureWorkspaceAfterAuth();
    if (next === "onboard") {
      navigateTo("/onboard", true);
      return;
    }
    const workspace = applyPlatformOverrides(next);
    activeWorkspace = workspace;
    if (blockWorkspaceAccess(workspace)) return;
    applyWorkspaceTheme(workspace);
    const isPlatformOwner = isPlatformOwnerEmail(user.email);
    let usage = null;
    try {
      usage = await fetchWorkspaceUsage(workspace.id);
      if (usage && isPlatformOwner) {
        usage = { ...usage, warnings: [] };
      }
    } catch {
      /* usage API optional until deployed */
    }
    const modelCount = usage?.usage.modelCount ?? (await countUserModels(workspace.id));
    syncOnboardingUpload(workspace.id, modelCount);
    const onboardingState = loadOnboarding(workspace.id);
    const showOnboarding =
      !isPlatformOwner && !isOnboardingComplete(workspace.id, modelCount);
    renderAdminDashboard(app, workspace, {
      email: user.email,
      usage,
      usageUnrestricted: isPlatformOwner,
      showOwnerLink: isPlatformOwner,
      canDeleteAccount: !isPlatformOwner,
      onboarding: showOnboarding ? { state: onboardingState, modelCount } : null,
      onGetStarted: showOnboarding ? () => navigateTo("/admin/get-started") : undefined,
      onOwner: isPlatformOwner ? () => navigateTo("/owner") : undefined,
      onAccount: () => navigateTo("/account"),
      onManageModels: () => navigateTo("/admin/models"),
      onBranding: () => navigateTo("/admin/branding"),
      onHelp: () => navigateTo("/admin/help"),
      onOpenAr: () => {
        const slug = activeWorkspace?.slug;
        if (!slug) {
          navigateTo("/", true);
          return;
        }
        if (modelCount < 1) {
          alert(
            "Upload at least one 3D model before Preview AR. Your workspace catalog stays empty until you upload — it will not show another account’s demo models.",
          );
          navigateTo("/admin/models");
          return;
        }
        void openTenantShowroom(slug);
      },
      onSignOut: () => {
        logout();
        activeWorkspace = null;
        goHome();
      },
      onDeleteAccount: () => confirmDeleteAccount(),
      onBack: () => goHome(),
    });
    routePainted();
  } catch (e) {
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
    routePainted();
  }
}

async function showAdminBrandingScreen(saved = false, error?: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("/login", true);
    return;
  }
  try {
    const next = await ensureWorkspaceAfterAuth();
    if (next === "onboard") {
      navigateTo("/onboard", true);
      return;
    }
    activeWorkspace = applyPlatformOverrides(next);
    if (blockWorkspaceAccess(activeWorkspace)) return;
    applyWorkspaceTheme(activeWorkspace);
    renderAdminBranding(app, activeWorkspace, {
      saved,
      error,
      onPreview: () => {
        activeTenantSlug = activeWorkspace?.slug ?? null;
        navigateTo(activeTenantSlug ? `/w/${encodeURIComponent(activeTenantSlug)}` : "/", true);
      },
      onSubmit: async (input) => {
        try {
          if (input.logoFile) {
            activeWorkspace = await uploadWorkspaceLogo(activeWorkspace!.id, input.logoFile);
            activeWorkspace = await updateWorkspaceSettings(activeWorkspace.id, {
              name: input.name,
              primaryColor: input.primaryColor,
            });
          } else {
            const existingLogo = activeWorkspace!.branding.logoUrl ?? "";
            const settings: {
              name: string;
              primaryColor: string;
              logoUrl?: string | null;
            } = {
              name: input.name,
              primaryColor: input.primaryColor,
            };
            if (input.logoUrl) {
              settings.logoUrl = input.logoUrl;
            } else if (existingLogo.startsWith("https://atlas-ar.app/")) {
              /* keep S3-uploaded logo — omit logoUrl */
            } else if (existingLogo) {
              settings.logoUrl = null;
            }
            activeWorkspace = await updateWorkspaceSettings(activeWorkspace!.id, settings);
          }
          applyWorkspaceTheme(activeWorkspace);
          void showAdminBrandingScreen(true);
        } catch (e) {
          void showAdminBrandingScreen(false, e instanceof Error ? e.message : String(e));
        }
      },
      onBack: () => navigateTo("/admin"),
    });
    routePainted();
  } catch (e) {
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => navigateTo("/admin"));
    routePainted();
  }
}

async function showTenantHome(slug: string): Promise<void> {
  clearSession({ skipSessionLog: true });
  directArModelId = null;
  globalDemoLanding = false;
  activeTenantSlug = slug;
  setCatalogWorkspaceSlug(slug);
  try {
    const config = await fetchPublicWorkspaceConfig(slug);
    if (!config) {
      app.innerHTML = `<div class="home"><h1>Workspace not found</h1><p class="home-sub">No workspace matches “${escapeHtml(slug)}”.</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
      app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
      routePainted();
      return;
    }
    applyWorkspaceTheme({
      ...config,
      branding: config.branding,
      createdAt: "",
      updatedAt: "",
    });
    tenantArExitUrl = config.arExitUrl ?? null;
    tenantFeatures = normalizeWorkspaceFeatures(config.features);
    const records = await fetchCatalog({ bustCache: true });
    const catalog = records.filter((m) => !isDemoCatalogModel(m));
    const logoUrl = workspaceLogoUrl(config.slug, config.branding);
    renderTenantCatalog(
      app,
      {
        workspaceName: config.name,
        logoUrl,
        accentColor: config.branding?.primaryColor,
      },
      catalog,
      (record) => modelIconSrc(record, slug, { bustCache: true }),
      {
        onViewInAr: (record) => {
          logFlowEvent("flow-catalog-ar-tap", "View in AR tapped from tenant catalog", "info", {
            modelId: record.id,
          });
          navigateTo(`/w/${encodeURIComponent(slug)}/ar/${encodeURIComponent(record.id)}`, true);
        },
        ...(getCurrentUser()
          ? {
              onAccount: () => navigateTo("/account"),
              ...(isDesktopAdmin()
                ? { onAdmin: () => navigateTo("/admin") }
                : {
                    onSignOut: () => {
                      logout();
                      goHome();
                    },
                  }),
            }
          : {}),
      },
    );
    void warmCatalogAtHome();
    routePainted();
  } catch (e) {
    if (e instanceof PublicShowroomBlockedError) {
      if (e.kind === "suspended" && getCurrentUser()) {
        app.innerHTML = `
          <div class="home ar-landing-page">
            <div class="ar-landing-card ar-landing-card--warn">
              <p class="mkt-eyebrow">Showroom paused</p>
              <h1>Trial ended</h1>
              <p class="home-sub">${escapeHtml(e.message)}</p>
              <button type="button" class="btn btn-primary btn-block" data-action="account">Go to Account</button>
              <button type="button" class="btn btn-ghost btn-block" data-action="back">Back</button>
            </div>
          </div>`;
        app.querySelector("[data-action=account]")?.addEventListener("click", () => navigateTo("/account"));
        app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
      } else {
        renderPublicShowroomBlocked(e.kind, e.message);
      }
      return;
    }
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
    routePainted();
  }
}

async function showTenantArDirect(slug: string, modelId: string): Promise<void> {
  if (webxr || arSessionStarting) return;
  clearSession({ skipSessionLog: true });
  activeTenantSlug = slug;
  setCatalogWorkspaceSlug(slug);
  directArModelId = modelId;
  resetAnalyticsSession();

  try {
    const config = await fetchPublicWorkspaceConfig(slug);
    if (!config) {
      app.innerHTML = `<div class="home"><h1>Workspace not found</h1><p class="home-sub">No workspace matches “${escapeHtml(slug)}”.</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
      app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
      routePainted();
      return;
    }
    applyWorkspaceTheme({
      ...config,
      branding: config.branding,
      createdAt: "",
      updatedAt: "",
    });
    tenantArExitUrl = config.arExitUrl ?? null;
    tenantFeatures = normalizeWorkspaceFeatures(config.features);

    const records = await fetchCatalog({ bustCache: true });
    const record = findCatalogModelById(records, modelId);
    if (!record || isDemoCatalogModel(record)) {
      app.innerHTML = `<div class="home"><h1>Model not found</h1><p class="home-sub">No model “${escapeHtml(modelId)}” in ${escapeHtml(config.name)}.</p><button class="btn btn-ghost btn-block" data-action="back">Back to catalog</button></div>`;
      app.querySelector("[data-action=back]")?.addEventListener("click", () => goToCatalogDestination());
      routePainted();
      return;
    }

    renderDirectModelLanding(record, {
      slug: config.slug,
      branding: config.branding,
      features: tenantFeatures,
      onBack: () => goToCatalogDestination(record),
    });
    invalidatePickerCache();
    void warmCatalogAtHome();
    routePainted();
  } catch (e) {
    if (e instanceof PublicShowroomBlockedError) {
      renderPublicShowroomBlocked(e.kind, e.message);
      return;
    }
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
    routePainted();
  }
}

async function showGlobalArDirect(modelId: string): Promise<void> {
  if (webxr || arSessionStarting) return;
  clearSession({ skipSessionLog: true });
  activeTenantSlug = null;
  tenantArExitUrl = null;
  tenantFeatures = { ...DEFAULT_WORKSPACE_FEATURES };
  directArModelId = modelId;
  resetAnalyticsSession();
  await ensureDemoCatalogReady();

  try {
    const records = await fetchCatalog({ bustCache: true });
    const record = findCatalogModelById(records, modelId);
    if (!record || isDemoCatalogModel(record)) {
      app.innerHTML = `<div class="home"><h1>Model not found</h1><p class="home-sub">No model “${escapeHtml(modelId)}” in the global catalog.</p><button class="btn btn-ghost btn-block" data-action="back">Back to home</button></div>`;
      app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
      routePainted();
      return;
    }

    renderDirectModelLanding(record, {
      onBack: () => goToCatalogDestination(record),
    });
    routePainted();
  } catch (e) {
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => goHome());
    routePainted();
  }
}

/** Navigate after Back to catalog — per-model exit URL, then workspace default. */
function navigateAfterCatalogExit(modelHint?: CatalogModel): void {
  const exitUrl = getEffectiveArExitUrl(modelHint);
  logFlowEvent("flow-catalog-return", "Returned to catalog destination", "info", {
    exitPath: exitUrl
      ? exitUrl.startsWith("/")
        ? exitUrl
        : (() => {
            try {
              return new URL(exitUrl).pathname;
            } catch {
              return "[external]";
            }
          })()
      : null,
    modelId: modelHint?.id ?? directArModelId ?? activeModelId,
  });
  directArModelId = null;
  if (exitUrl) {
    if (/^https?:\/\//i.test(exitUrl)) {
      location.assign(exitUrl);
    } else {
      const path = exitUrl.startsWith("/") ? exitUrl : `/${exitUrl}`;
      navigateTo(path, true);
      routeApp();
    }
    return;
  }
  const slug = activeTenantSlug;
  if (slug) {
    activeTenantSlug = slug;
    setCatalogWorkspaceSlug(slug);
    navigateTo(`/w/${encodeURIComponent(slug)}`, true);
    void showTenantHome(slug);
    return;
  }
  goHome();
}

/** Return to the AR session start page (Start AR / device check landing). */
function returnToArStartPage(): void {
  logFlowEvent("flow-ar-start-page-return", "Returned to AR start page", "info", {
    slug: activeTenantSlug,
    modelId: directArModelId,
  });
  const slug = activeTenantSlug;
  const modelId = directArModelId;
  if (modelId && slug) {
    navigateTo(`/w/${encodeURIComponent(slug)}/ar/${encodeURIComponent(modelId)}`, true);
    void showTenantArDirect(slug, modelId);
    return;
  }
  if (modelId && !slug) {
    navigateTo(`/ar/${encodeURIComponent(modelId)}`, true);
    void showGlobalArDirect(modelId);
    return;
  }
  if (slug) {
    activeTenantSlug = slug;
    setCatalogWorkspaceSlug(slug);
    navigateTo(`/w/${encodeURIComponent(slug)}`, true);
    void showTenantHome(slug);
    return;
  }
  if (globalDemoLanding || routePath() === "/demo") {
    navigateTo("/demo", true);
    void showGlobalDemoHome();
    return;
  }
  goHome();
}

/** End WebXR and return to the Start AR landing for this session. */
function exitArSession(): void {
  logFlowEvent("flow-ar-exit-tap", "Exit AR tapped", "info");
  clearSession();
  returnToArStartPage();
}

function signedInMarketingNav(): {
  signedIn: true;
  workspaceName?: string;
  onDashboard: () => void;
  onGetStarted: () => void;
  getStartedLabel: string;
  getStartedPath: string;
} | Record<string, never> {
  const user = getCurrentUser();
  if (!user) return {};
  const mobile = isMobileExperience();
  const slug = activeWorkspace?.slug ?? activeTenantSlug;
  const showroomPath = slug ? `/w/${encodeURIComponent(slug)}` : "/";
  return {
    signedIn: true,
    workspaceName: activeWorkspace?.name,
    onDashboard: () => navigateTo("/account"),
    onGetStarted: () => navigateTo(mobile && slug ? showroomPath : "/admin"),
    getStartedLabel: mobile ? "Browse collection" : "Admin dashboard",
    getStartedPath: mobile && slug ? showroomPath : "/admin",
  };
}

function marketingHandlersBase(): {
  onHome: () => void;
  onAbout: () => void;
  onProduct: () => void;
  onPricing: () => void;
  onDemo?: () => void;
  onSignIn: () => void;
  onGetStarted: () => void;
  onLegalTerms: () => void;
  onLegalPrivacy: () => void;
  onLegalAup: () => void;
  mobileExperience: boolean;
} {
  const user = getCurrentUser();
  const mobile = isMobileExperience();
  const slug = activeWorkspace?.slug ?? activeTenantSlug;
  return {
    mobileExperience: mobile,
    onHome: () => navigateTo("/"),
    onAbout: () => navigateTo("/about"),
    onProduct: () => navigateTo("/"),
    onPricing: () => navigateTo("/pricing"),
    ...(mobile ? { onDemo: () => navigateTo("/demo") } : {}),
    onSignIn: () => navigateTo("/login"),
    onGetStarted: () => {
      if (user && mobile && slug) {
        navigateTo(`/w/${encodeURIComponent(slug)}`);
        return;
      }
      navigateTo(user ? "/admin" : "/signup");
    },
    onLegalTerms: () => navigateTo("/legal/terms"),
    onLegalPrivacy: () => navigateTo("/legal/privacy"),
    onLegalAup: () => navigateTo("/legal/acceptable-use"),
  };
}

/** Global demo landing (/demo) — restored after AR exit when user came from demo. */
let globalDemoLanding = false;

/** Global default demo — no account; PC gets model manager. */
async function showGlobalDemoHome(): Promise<void> {
  globalDemoLanding = true;
  activeTenantSlug = null;
  directArModelId = null;
  invalidatePickerCache();
  applyWorkspaceTheme(null);
  const envDemo = (import.meta.env.VITE_DEMO_WORKSPACE_SLUG as string | undefined)?.trim();
  if (envDemo) setDemoCatalogWorkspaceSlug(envDemo.toLowerCase());
  await ensureOwnerWorkspaceLoaded();
  const demoSlug = await ensureDemoCatalogReady();
  const camera = getCameraSupport();
  const iosOnly = isIOS();
  let demoCatalogWarning = demoSlug ? undefined : demoCatalogMissingMessage();
  if (demoSlug) {
    const demoModels = await fetchCatalog({ bustCache: true });
    if (!demoModels.length) {
      demoCatalogWarning = demoCatalogEmptyMessage(demoSlug);
    }
  }
  logFlowEvent("flow-global-demo-shown", "Global demo landing shown", "info", {
    demoWorkspaceSlug: demoSlug,
    demoCatalogReady: Boolean(demoSlug),
  });
  await syncArSessionFeatures();
  const sessionFeatures = arSessionFeatures();
  renderHomeMinimal(app, {
    title: "Atlas AR",
    subtitle: iosOnly ? MKT.demoSubtitleIos : isDesktopAdmin() ? MKT.demoSubtitleDesktop : MKT.demoSubtitleAndroid,
    cameraWarning: demoCatalogWarning ?? buildHomeCameraWarning(camera),
    iosQuickLookOnly: iosOnly,
    deviceLine: customerDeviceLine(),
    onQuickLookAr: () => {
      logFlowEvent("flow-quick-look-tap", "View in AR tapped on global demo", "info");
      void startIosQuickLookAr();
    },
    onStartAr: () => {
      logFlowEvent("flow-start-ar-tap", "Start AR tapped on global demo", "info");
      void enterArPlacementMode();
    },
    onRunDeviceCheck: () => {
      logFlowEvent("flow-device-check-tap", "Device check tapped on global demo", "info");
      void runDeviceCheck();
    },
    onBack: () => {
      globalDemoLanding = false;
      navigateTo("/");
    },
    variant: "preview",
    sessionLogDownload: sessionFeatures.sessionLogDownload,
    onDownloadLog: sessionFeatures.sessionLogDownload
      ? () => runDownloadSessionLogForUi(app)
      : undefined,
  });
  void warmCatalogAtHome();
  routePainted();
}

function showLegalPage(docId: LegalDocId): void {
  clearSession({ skipSessionLog: true });
  applyWorkspaceTheme(null);
  const base = marketingHandlersBase();
  renderLegalPage(app, docId, {
    ...base,
    ...signedInMarketingNav(),
    onLegal: (id) => navigateTo(`/legal/${id}`),
  });
  routePainted();
}

function parseLegalRoute(): LegalDocId | null {
  const match = /^\/legal\/(terms|privacy|acceptable-use)$/.exec(routePath());
  return match ? (match[1] as LegalDocId) : null;
}

function renderGlobalHome(): void {
  globalDemoLanding = false;
  activeTenantSlug = null;
  setCatalogWorkspaceSlug(null);
  directArModelId = null;
  const user = getCurrentUser();
  if (user && activeWorkspace) {
    applyWorkspaceTheme(activeWorkspace);
  } else {
    applyWorkspaceTheme(null);
  }
  const basePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
  if (routePath() !== "/" && routePath() !== "/pricing") {
    history.replaceState(null, "", basePath || "/");
  } else if (location.hash && routePath() === "/") {
    history.replaceState(null, "", basePath || "/");
  }
  logFlowEvent("flow-home-shown", "Marketing landing shown", "info");
  const handlers = marketingHandlersBase();
  renderMarketingLanding(app, {
    ...handlers,
    ...signedInMarketingNav(),
  });
  void warmCatalogAtHome();
  routePainted();
}

function showAboutPage(): void {
  clearSession({ skipSessionLog: true });
  applyWorkspaceTheme(null);
  const base = marketingHandlersBase();
  renderAboutPage(app, {
    ...base,
    ...signedInMarketingNav(),
  });
  routePainted();
}

let cachedPricingPromo: PublicPromo | null = null;

function renderPricingWithPromo(promo: PublicPromo | null): void {
  const base = marketingHandlersBase();
  renderPricingPage(app, {
    ...base,
    ...signedInMarketingNav(),
    promo,
  });
}

function showPricingPage(): void {
  clearSession({ skipSessionLog: true });
  applyWorkspaceTheme(null);
  renderPricingWithPromo(cachedPricingPromo);
  routePainted();
  // Refresh the active promo in the background; re-render only if it changed and we're still on pricing.
  void (async () => {
    const promo = await fetchPublicPromo();
    const changed = JSON.stringify(promo) !== JSON.stringify(cachedPricingPromo);
    cachedPricingPromo = promo;
    if (changed && routePath() === "/pricing") renderPricingWithPromo(promo);
  })();
}

function goHome(): void {
  if (webxr) {
    exitArSession();
    return;
  }
  if (routePath() === "/demo" || globalDemoLanding) {
    if (routePath() !== "/demo") {
      navigateTo("/demo", true);
      return;
    }
    showGlobalDemoHome();
    return;
  }
  if (routePath() !== "/") {
    navigateTo("/", true);
    return;
  }
  renderGlobalHome();
}

async function openIosQuickLookForModel(record: CatalogModel, slug?: string | null): Promise<void> {
  const assets = resolveCatalogAssets(record, slug ?? catalogAssetSlug());
  if (!assets.modelUrl && !assets.usdzUrl) {
    alert(
      "AR model not available yet. On a PC, upload a GLB in Manage 3D models for Safari AR."
    );
    return;
  }
  ensureSessionLog();
  const { openQuickLookFromGlbOrUsdz } = await import("./xr/ios/quick-look-open");
  await openQuickLookFromGlbOrUsdz({
    modelId: record.id,
    modelUrl: assets.modelUrl,
    usdzUrl: assets.usdzUrl,
    posterUrl: assets.iconUrl ?? defaultIconForBuiltin("pad"),
  });
}

/** iOS demo: Safari AR picker on /demo — not the tenant browse-collection page. */
async function startIosQuickLookAr(): Promise<void> {
  clearSession({ skipSessionLog: true });
  ensureSessionLog();
  const demoSlug = await ensureDemoCatalogReady();
  if (!demoSlug) {
    alert(demoCatalogMissingMessage());
    return;
  }
  setCatalogWorkspaceSlug(demoSlug);
  setDemoCatalogWorkspaceSlug(demoSlug);
  globalDemoLanding = true;
  activeTenantSlug = null;
  await syncArSessionFeatures();
  const sessionFeatures = arSessionFeatures();
  try {
    const records = await fetchCatalog();
    const catalog = records.filter((m) => !isDemoCatalogModel(m));
    const items = catalogToQuickLookItems(catalog, demoSlug);
    const withAr = items.filter((m) => m.modelUrl || m.usdzUrl);
    logArEvent("ios-quick-look", "iOS Safari AR catalog", "info", {
      details: {
        modelCount: items.length,
        usdzCount: withAr.filter((m) => m.usdzUrl).length,
        modelIds: items.map((m) => m.id).join(", "),
        usdzModelIds: withAr.map((m) => m.id).join(", ") || null,
      },
    });
    if (!withAr.length) {
      alert(
        "No AR models yet. On a PC, upload a GLB in Manage 3D models for Safari AR."
      );
      return;
    }
    logFlowEvent("flow-ios-ar-picker", "iOS Safari AR model picker shown", "info", {
      modelCount: withAr.length,
    });
    renderIosQuickLookPicker(app, items, {
      onBack: () => showGlobalDemoHome(),
      sessionLogDownload: sessionFeatures.sessionLogDownload,
      onDownloadLog: sessionFeatures.sessionLogDownload
        ? () => runDownloadSessionLogForUi(app)
        : undefined,
    });
    routePainted();
  } catch (e) {
    app.innerHTML = `<div class="home"><p class="camera-warning">${escapeHtml(e instanceof Error ? e.message : String(e))}</p><button class="btn btn-ghost btn-block" data-action="back">Back</button></div>`;
    app.querySelector("[data-action=back]")?.addEventListener("click", () => showGlobalDemoHome());
    routePainted();
  }
}

let ownerTab: OwnerTab = "demo";
let ownerStatus: string | undefined;
let ownerError: string | undefined;
let ownerScreenGen = 0;

async function showOwnerDemoModels(slot: HTMLElement | null): Promise<void> {
  if (!slot) return;
  try {
    const ws = await ensureOwnerWorkspaceLoaded();
    if (!ws) {
      slot.innerHTML = `<p class="upload-status">Load your operator workspace first (sign in and complete onboarding), then refresh this page.</p>`;
      return;
    }
    setDemoCatalogWorkspaceSlug(ws.slug);
    void platformSetDemoWorkspaceSlug(ws.slug).catch(() => {
      /* optional — requires platform settings API */
    });
    const models = await fetchWorkspaceAdminManifest(ws.id);
    renderPcModelManager(slot, models, {
      onBack: () => navigateTo("/owner"),
      onChanged: () => {
        invalidatePickerCache();
        void showOwnerDemoModels(slot);
      },
      embedded: true,
      workspace: { id: ws.id, slug: ws.slug },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    slot.innerHTML = `<p class="upload-status">Could not load demo models: ${escapeHtml(msg)}</p>`;
  }
}

async function showOwnerScreen(tab: OwnerTab = ownerTab): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("/login", true);
    return;
  }
  if (!isPlatformOwnerEmail(user.email)) {
    navigateTo("/");
    return;
  }
  ownerTab = tab;
  const gen = ++ownerScreenGen;
  clearSession({ skipSessionLog: true });
  applyWorkspaceTheme(null);
  let workspaces: Awaited<ReturnType<typeof fetchPlatformWorkspaces>> = [];
  let ownerEmailLookup: "cognito" | "disabled" | undefined;
  let coupons: Awaited<ReturnType<typeof fetchPlatformCoupons>> = [];
  try {
    const myWorkspaces = await fetchMyWorkspaces();
    const platform = await fetchPlatformWorkspacesDetail(
      user.email,
      myWorkspaces.map((w) => w.id),
    );
    workspaces = platform.workspaces;
    ownerEmailLookup = platform.meta?.ownerEmailLookup;
    coupons = await fetchPlatformCoupons();
  } catch (e) {
    ownerError = e instanceof Error ? e.message : String(e);
  }
  const status = ownerStatus;
  const error = ownerError;
  ownerStatus = undefined;
  ownerError = undefined;

  let salesDeckActive = true;
  let mkt3StoryboardActive = true;
  try {
    const settings = await fetchPlatformSettings();
    salesDeckActive = settings.salesDeckActive;
    mkt3StoryboardActive = settings.mkt3StoryboardActive;
  } catch {
    try {
      salesDeckActive = (await fetchPublicSalesDeckConfig()).active;
    } catch {
      /* keep default */
    }
  }

  if (gen !== ownerScreenGen) return;

  renderOwnerDashboard(
    app,
    {
      email: user.email,
      tab,
      workspaces,
      coupons,
      status,
      error,
      salesDeckActive,
      mkt3StoryboardActive,
      ownerEmailLookup,
    },
    {
      onTab: (t) => void showOwnerScreen(t),
      onRefreshWorkspaces: () => void showOwnerScreen("customers"),
      onRefreshCoupons: () => void showOwnerScreen("coupons"),
      onSetPlan: async (workspaceId, billingTier) => {
        try {
          await platformSetWorkspacePlan(workspaceId, billingTier);
          ownerStatus = `Plan updated to ${billingTier} for ${workspaceId}.`;
          await showOwnerScreen("customers");
        } catch (e) {
          ownerError = e instanceof Error ? e.message : String(e);
          await showOwnerScreen("customers");
        }
      },
      onSetFeature: async (workspaceId, feature, enabled) => {
        try {
          await platformSetWorkspaceFeatures(workspaceId, { [feature]: enabled });
          if (activeWorkspace?.id === workspaceId) {
            const refreshed = (await fetchMyWorkspaces()).find((w) => w.id === workspaceId);
            if (refreshed) activeWorkspace = applyPlatformOverrides(refreshed);
          }
          const labels: Record<string, string> = {
            sessionLogDownload: "JSON log",
            startAr: "Start AR",
            cameraCheck: "Camera check",
          };
          ownerStatus = `${labels[feature] ?? feature} ${enabled ? "enabled" : "disabled"} for ${workspaceId}.`;
          await showOwnerScreen("customers");
        } catch (e) {
          ownerError = e instanceof Error ? e.message : String(e);
          await showOwnerScreen("customers");
        }
      },
      onRestrict: async (workspaceId, restricted, reason) => {
        try {
          await platformSetWorkspaceRestriction(workspaceId, restricted, reason || "Policy violation");
          ownerStatus = restricted ? `Restricted ${workspaceId}.` : `Restriction lifted for ${workspaceId}.`;
          await showOwnerScreen("customers");
        } catch (e) {
          ownerError = e instanceof Error ? e.message : String(e);
          await showOwnerScreen("customers");
        }
      },
      onDeleteCustomer: async (workspaceId, name) => {
        try {
          await platformDeleteCustomerAccount(workspaceId);
          ownerStatus = `Deleted customer account “${name}”.`;
          await showOwnerScreen("customers");
        } catch (e) {
          ownerError = e instanceof Error ? e.message : String(e);
          await showOwnerScreen("customers");
        }
      },
      onRefund: async (input) => {
        try {
          const result = await platformRefundPayment(input);
          ownerStatus = `Refund ${result.providerRefundId} issued for ${input.paymentId}.`;
          await showOwnerScreen("customers");
        } catch (e) {
          ownerError = e instanceof Error ? e.message : String(e);
          await showOwnerScreen("customers");
        }
      },
      onCreateCoupon: async (input) => {
        const offerType = input.offerType === "percent" ? "percent" : "fixed";
        const validationError = validateCouponCreateInput({ ...input, offerType });
        if (validationError) {
          ownerError = validationError;
          await showOwnerScreen("coupons");
          return;
        }
        const payload =
          offerType === "fixed"
            ? {
                offerType: "fixed" as const,
                code: input.code.toUpperCase(),
                label: input.label,
                promoPriceMonthly: input.promoPriceMonthly,
                durationMonths: input.durationMonths,
                targetTier: input.targetTier,
                maxUses: input.maxUses,
                showOnPricing: input.showOnPricing,
                bannerText: input.bannerText,
              }
            : {
                offerType: "percent" as const,
                code: input.code.toUpperCase(),
                label: input.label,
                discountPercent: input.discountPercent,
                targetTier: input.targetTier,
                expiresAt: input.expiresAt,
                maxUses: input.maxUses,
                showOnPricing: input.showOnPricing,
                bannerText: input.bannerText,
              };
        try {
          await createPlatformCoupon(payload);
          ownerStatus = `Coupon ${input.code.toUpperCase()} created.`;
          await showOwnerScreen("coupons");
        } catch (e) {
          ownerError = e instanceof Error ? e.message : String(e);
          await showOwnerScreen("coupons");
        }
      },
      onDeleteCoupon: (code) => {
        void (async () => {
          try {
            await deletePlatformCoupon(code);
            ownerStatus = `Coupon ${code} deleted.`;
            await showOwnerScreen("coupons");
          } catch (e) {
            ownerError = e instanceof Error ? e.message : String(e);
            await showOwnerScreen("coupons");
          }
        })();
      },
      onMountDemoManager: (slot) => {
        void showOwnerDemoModels(slot);
      },
      onSignOut: () => {
        logout();
        activeWorkspace = null;
        goHome();
      },
      onBack: () => goHome(),
      onSalesDeckToggle: async (active) => {
        try {
          await platformSetSalesDeckActive(active);
          ownerStatus = `Sales deck ${active ? "enabled" : "disabled"}.`;
        } catch (e) {
          ownerError = e instanceof Error ? e.message : String(e);
        }
        await showOwnerScreen(tab);
      },
      onMkt3StoryboardToggle: async (active) => {
        try {
          await platformSetMkt3StoryboardActive(active);
          ownerStatus = `MKT-3 storyboard ${active ? "enabled" : "disabled"}.`;
        } catch (e) {
          ownerError = e instanceof Error ? e.message : String(e);
        }
        await showOwnerScreen(tab);
      },
    },
  );
  routePainted();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function routeApp(): void {
  if (webxr) return;
  const path = routePath();
  if (isMobileExperience() && isDesktopOnlyRoute(path)) {
    void routeMobileAwayFromDesktopOnly(path);
    return;
  }
  if (path === "/login") {
    showLoginScreen();
    return;
  }
  if (path === "/signup") {
    showSignupScreen();
    return;
  }
  if (path === "/forgot-password") {
    showForgotPasswordScreen();
    return;
  }
  if (path === "/onboard") {
    showOnboardScreen();
    return;
  }
  if (path === "/admin") {
    void showAdminScreen();
    return;
  }
  if (path === "/admin/get-started") {
    void showOnboardingGetStartedScreen();
    return;
  }
  if (path === "/admin/help") {
    void showAdminHelpScreen();
    return;
  }
  if (path === "/admin/models") {
    void showAdminModelsScreen();
    return;
  }
  if (path === "/admin/branding") {
    void showAdminBrandingScreen();
    return;
  }
  if (path === "/pricing") {
    showPricingPage();
    return;
  }
  if (path === "/about") {
    showAboutPage();
    return;
  }
  if (path === "/account") {
    void showAccountScreen();
    return;
  }
  if (path === "/owner") {
    void showOwnerScreen();
    return;
  }
  if (path === "/demo") {
    if (!isMobileExperience()) {
      navigateTo("/");
      return;
    }
    showGlobalDemoHome();
    return;
  }
  const legalDoc = parseLegalRoute();
  if (legalDoc) {
    showLegalPage(legalDoc);
    return;
  }
  const globalModelId = globalArModelFromPath();
  if (globalModelId) {
    void showGlobalArDirect(globalModelId);
    return;
  }
  const tenantRoute = parseTenantRoute();
  if (tenantRoute?.modelId) {
    void showTenantArDirect(tenantRoute.slug, tenantRoute.modelId);
    return;
  }
  if (tenantRoute) {
    void showTenantHome(tenantRoute.slug);
    return;
  }
  goHome();
}

async function loadPickerItemsCache(opts?: { bustCache?: boolean }): Promise<ModelPickerItem[]> {
  const records = await fetchCatalog(opts);
  const scoped =
    showFullCatalogInAr() || !directArModelId
      ? records
      : records.filter((m) => m.id === directArModelId);
  const catalogSlug = catalogAssetSlug();
  pickerItemsCache = scoped.map((r) => {
    const assets = resolveCatalogAssets(r, catalogSlug);
    const iconSrc = modelIconSrc(r, catalogSlug, { bustCache: true });
    const glbReady = Boolean(
      r.builtinType ||
        !assets.modelUrl ||
        getCachedGlb(assets.modelUrl) ||
        isGlbParsed(assets.modelUrl)
    );
    return { ...r, iconSrc, glbReady };
  });
  return pickerItemsCache;
}

function runDownloadSessionLogForUi(root: HTMLElement = app): void {
  void (async () => {
    const statusEl = root.querySelector<HTMLElement>("[data-ios-log-status]");
    const report = finishArSessionReport();
    const result = await downloadArSessionReport(report);
    const msg = result.ok
      ? result.method === "clipboard"
        ? `Log copied — paste into Notes or Files (${result.filename})`
        : result.method === "share"
          ? `Shared ${result.filename}`
          : `Downloaded ${result.filename}`
      : result.error;
    logArEvent("session-log-export", "Session log exported", result.ok ? "ok" : "fail", {
      details: { method: result.ok ? result.method : null },
      error: result.ok ? undefined : result.error,
    });
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.classList.remove("hidden");
    } else if (result.ok) {
      alert(msg);
    } else {
      alert(msg);
    }
  })();
}

function runDownloadSessionLog(): void {
  void (async () => {
    const report = finishArSessionReport();
    const result = await downloadArSessionReport(report);
    if (result.ok) {
      downloadStatusHint =
        result.method === "clipboard"
          ? `Log copied — paste into Notes or Files (${result.filename})`
          : result.method === "share"
            ? `Shared ${result.filename}`
            : `Downloaded ${result.filename}`;
    } else {
      downloadStatusHint = result.error;
    }
    await refreshArPicker();
    window.setTimeout(() => {
      downloadStatusHint = "";
      void refreshArPicker();
    }, 5000);
  })();
}

async function syncReticlePreview(modelId: string | null): Promise<void> {
  if (!webxr) return;
  if (!modelId) {
    webxr.setReticlePreviewFootprintM(null);
    return;
  }
  const assets = await getCatalogAssets(modelId, catalogAssetSlug());
  if (!assets) {
    webxr.setReticlePreviewFootprintM(null);
    return;
  }
  if (assets.modelUrl) {
    const raw = getCachedFootprintM(assets.modelUrl);
    webxr.setReticlePreviewFootprintM(
      raw != null
        ? scaledFootprintM(raw, modelId, assets.modelUrl, assets.record.realWorld)
        : null
    );
    return;
  }
  if (assets.record.builtinType === "pad") {
    webxr.setReticlePreviewFootprintM(RETICLE_BUILTIN_PAD_FOOTPRINT_M);
    return;
  }
  if (assets.record.builtinType) {
    webxr.setReticlePreviewFootprintM(RETICLE_DEFAULT_FOOTPRINT_M);
    return;
  }
  webxr.setReticlePreviewFootprintM(RETICLE_DEFAULT_FOOTPRINT_M);
}

function isBuiltinCatalogModel(id: string | null): boolean {
  if (!id) return false;
  const item = pickerItemsCache.find((m) => m.id === id);
  return item ? isDemoCatalogModel(item) : false;
}

function objectModeAvailable(): boolean {
  const id = pickerFocusModelId();
  if (!id || isBuiltinCatalogModel(id)) return false;
  const item = pickerItemsCache.find((m) => m.id === id);
  if (!item || item.builtinType) return false;
  return Boolean(item.glb || item.glbUrl);
}

async function resolveObjectModeModel(): Promise<{ url: string; name: string } | null> {
  const peeked = peekObjectModeModel();
  if (!peeked) return null;
  const { url: modelUrl, name } = peeked;
  if (!getCachedGlb(modelUrl) && !isGlbParsed(modelUrl)) {
    try {
      await Promise.race([
        (async () => {
          await prefetchCatalogGlbs([modelUrl]);
          if (webxr) {
            await webxr.warmupModels([modelUrl]);
          } else {
            await parseGlbsOfflineAtHome([modelUrl], { timeoutMs: 30000 });
          }
        })(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Model prep timed out")), 8000)
        ),
      ]);
    } catch {
      if (!getCachedGlb(modelUrl) && !isGlbParsed(modelUrl)) {
        return null;
      }
    }
  }
  return { url: modelUrl, name };
}

/** Sync catalog lookup — show 3D shell before any network / warmup await. */
function peekObjectModeModel(): { url: string; name: string } | null {
  const id = pickerFocusModelId();
  if (!id || isBuiltinCatalogModel(id)) return null;
  const item = pickerItemsCache.find((m) => m.id === id);
  if (!item || item.builtinType) return null;
  const assets = resolveCatalogAssets(item, catalogAssetSlug());
  if (!assets.modelUrl) return null;
  return { url: assets.modelUrl, name: item.name };
}

async function setArObjectMode(enabled: boolean): Promise<void> {
  if (!webxr) return;
  if (enabled) {
    if (objectModeBusy || arObjectModeActive) return;
    objectModeBusy = true;
    const focusId = pickerFocusModelId();
    logArEvent("object-mode", "3D preview toggle tapped", "info", {
      details: {
        focusModelId: focusId,
        objectModeAvailable: objectModeAvailable(),
        glbCached: (() => {
          if (!focusId) return false;
          const item = pickerItemsCache.find((m) => m.id === focusId);
          if (!item) return false;
          const url = resolveCatalogAssets(item, catalogAssetSlug()).modelUrl;
          return url ? Boolean(getCachedGlb(url)) : false;
        })(),
      },
    });
    try {
      const model = peekObjectModeModel() ?? (await resolveObjectModeModel());
      if (!model) {
        logArEvent("object-mode", "3D preview unavailable", "fail", {
          error: "No model URL or catalog entry",
          details: { focusModelId: focusId },
        });
        downloadStatusHint = "3D preview needs a downloaded model — wait for tiles to finish loading.";
        void refreshArPicker();
        return;
      }
      arObjectModeActive = true;
      webxr.setObjectViewerMode(true);
      stopDimensionHudLoop();
      setArOverlayVisible(true);
      showXrCanvas(false);
      const sessionFeatures = arSessionFeatures();
      const objectViewerOpts = {
        modelUrl: model.url,
        modelName: model.name,
        onBackToAr: () => void setArObjectMode(false),
        sessionLogDownload: sessionFeatures.sessionLogDownload,
        onDownloadLog: sessionFeatures.sessionLogDownload ? runDownloadSessionLog : undefined,
      };
      showArObjectViewerLoading(objectViewerOpts);
      logArEvent("object-mode", "3D preview shell shown", "info", {
        details: { modelId: focusId, modelUrl: model.url },
      });
      void refreshArPicker();
      try {
        logArEvent("object-mode", "3D preview loading", "info", {
          details: { modelId: focusId, modelUrl: model.url },
        });
        const previewLoad = await finishArObjectViewerLoad(objectViewerOpts);
      logArEvent("object-mode", "3D preview loaded", "ok", {
          details: {
            modelId: focusId,
            modelUrl: model.url,
            previewLoadMs: previewLoad.loadMs,
            previewLoadMethod: previewLoad.loadMethod,
            previewContainerCached: previewLoad.previewContainerCached,
            previewWarmupReady: Boolean(getPreviewContainerForUrl(model.url)),
            previewSceneHasEnvironment: previewLoad.previewSceneHasEnvironment,
            previewEnvironmentIntensity: previewLoad.previewEnvironmentIntensity,
            previewNeutralHdr: previewLoad.previewNeutralHdr,
            previewHdrError: previewLoad.previewHdrError,
            previewHdrSourceUrl: previewLoad.previewHdrSourceUrl,
            previewMeshCount: previewLoad.previewMeshCount,
            previewMeshesVisible: previewLoad.previewMeshesVisible,
            pbrCount: previewLoad.pbrCount,
            withMetallicRoughnessTexture: previewLoad.withMetallicRoughnessTexture,
          },
        });
      } catch (e) {
        arObjectModeActive = false;
        webxr.setObjectViewerMode(false);
        hideArObjectViewer();
        showXrCanvas(true);
        const msg = e instanceof Error ? e.message : "Could not load 3D preview.";
        logArEvent("object-mode", "3D preview load failed", "fail", {
          error: msg,
          details: { modelId: focusId, modelUrl: model.url },
        });
        downloadStatusHint = msg;
        void refreshArPicker();
        window.setTimeout(() => {
          downloadStatusHint = "";
          void refreshArPicker();
        }, 5000);
      }
    } finally {
      objectModeBusy = false;
    }
  } else {
    logArEvent("object-mode", "Exit 3D preview", "info");
    arObjectModeActive = false;
    webxr.setObjectViewerMode(false);
    hideArObjectViewer();
    setArOverlayVisible(true);
    showXrCanvas(true);
    setBodyTrainingState("webxr");
    startDimensionHudLoop();
  }
  void refreshArPicker();
}

function warmPreviewForFocusModel(): void {
  if (!objectModeAvailable()) return;
  const id = pickerFocusModelId();
  if (!id) return;
  const item = pickerItemsCache.find((m) => m.id === id);
  if (!item || item.builtinType) return;
  const url = resolveCatalogAssets(item, catalogAssetSlug()).modelUrl;
  if (!url || !getCachedGlb(url)) return;
  warmObjectPreviewModel(url);
}

async function refreshArPicker(): Promise<void> {
  if (!webxr) return;
  if (!pickerItemsCache.length) {
    void loadPickerItemsCache().then(() => {
      if (webxr) void refreshArPicker();
    });
  }

  const floorState = webxr.getFloorDetectionState();
  arFloorReady = floorState.ready;
  const floorScanComplete = webxr.isFloorScanComplete();
  void syncReticlePreview(placingModelId ?? pickerFocusModelId());
  warmPreviewForFocusModel();

  const statusText = downloadStatusHint
    ? downloadStatusHint
    : placingModelId
      ? `Loading ${pickerItemsCache.find((m) => m.id === placingModelId)?.name ?? "model"}…`
      : floorState.ready
        ? webxr.getStatusText()
        : floorState.graceActive
          ? "Floor lost — point at the floor until the ring returns."
          : floorState.ringPlaceable === false
            ? "Red ring — aim at empty floor (cyan = ready to place)."
            : floorState.liveHit && floorState.floorNormalY < 0.65
              ? "Red ring — surface too steep. Aim at a flat empty floor."
              : floorScanComplete
                ? "Point at empty floor — cyan ring = placeable, red = blocked."
                : "Point camera at the floor — cyan disc and ring while scanning.";

  const skipFloorScan = () => {
    webxr?.skipFloorScan();
    arFloorReady = true;
    void refreshArPicker();
  };

  const sessionFeatures = arSessionFeatures();
  const pickerOptions = {
    items: pickerItemsCache,
    activeId: pickerFocusModelId(),
    loadingId: placingModelId,
    statusText,
    floorReady: floorState.ready,
    floorState,
    floorScanComplete,
    sessionLogDownload: sessionFeatures.sessionLogDownload,
    onSelect: (id: string) => void placeModelById(id),
    onDownloadLog: sessionFeatures.sessionLogDownload ? runDownloadSessionLog : () => {},
    onExit: () => exitArSession(),
    onCancelLoad: () => cancelModelLoad(),
    onSkipFloor: skipFloorScan,
    dimensionsVisible: webxr.getDimensionOverlayVisible(),
    objectModeActive: arObjectModeActive,
    objectModeAvailable: objectModeAvailable(),
    onToggleDimensions: () => {
      if (!webxr) return;
      const next = !webxr.getDimensionOverlayVisible();
      webxr.setDimensionOverlayVisible(next);
      if (next) {
        startDimensionHudLoop();
      } else {
        hideArDimensionHud();
      }
      const hud = webxr.getPlacedDimensionHud();
      const fx = webxr.getDimensionFxDiagnostics();
      logArEvent(
        "dimension-overlay",
        next ? "Dimensions overlay on" : "Dimensions overlay off",
        "info",
        {
          details: {
            visible: next,
            dimensionLabel: hud?.label ?? fx?.dimensionLabel ?? null,
            dimensionLinesBuilt: fx?.dimensionLinesBuilt ?? null,
            dimensionLinesVisible: fx?.dimensionLinesVisible ?? null,
          },
        }
      );
      void refreshArPicker();
    },
    onToggleObjectMode: objectModeAvailable()
      ? () => {
          void setArObjectMode(!arObjectModeActive);
        }
      : undefined,
  };

  if (webxr.updateInCanvasPicker) {
    webxr.updateInCanvasPicker({
      items: pickerItemsCache.map((m) => ({
        id: m.id,
        name: m.name,
        iconUrl: m.iconSrc,
      })),
      activeId: pickerFocusModelId(),
      statusText: pickerOptions.statusText,
      floorReady: arFloorReady,
      floorScanComplete,
    });
  } else if (!floorScanComplete) {
    const scanRoot = arHtmlUiRoot();
    const scanOpts = {
      phase: "scanning" as const,
      onSkipFloor: skipFloorScan,
      onDownloadLog: sessionFeatures.sessionLogDownload ? runDownloadSessionLog : undefined,
      sessionLogDownload: sessionFeatures.sessionLogDownload,
    };
    if (!patchArScanning(scanRoot, statusText, "scanning", scanOpts)) {
      renderArScanning(scanRoot, statusText, () => exitArSession(), scanOpts);
    }
  } else {
    const pickerRoot = arHtmlUiRoot();
    if (!patchArModelPicker(pickerRoot, pickerOptions)) {
      renderArModelPicker(pickerRoot, pickerOptions);
    }
    if (floorScanComplete && !pickerShownLogged) {
      pickerShownLogged = true;
      logFlowEvent("flow-picker-shown", "Model picker shown after floor scan", "info", {
        modelCount: pickerItemsCache.length,
        floorReady: floorState.ready,
        objectModeAvailable: objectModeAvailable(),
        focusModelId: pickerFocusModelId(),
      });
    }
  }
}

async function placeModelById(id: string): Promise<void> {
  if (!webxr) return;
  pickerPreviewModelId = id;
  const now = performance.now();
  if (now - lastPlacementFinishedAt < PLACEMENT_DEBOUNCE_MS) {
    logArEvent("model-place", `Place model: ${id}`, "fail", {
      error: "Wait a moment before placing again",
      details: {
        sinceLastPlacementMs: Math.round(now - lastPlacementFinishedAt),
        debounceMs: PLACEMENT_DEBOUNCE_MS,
      },
    });
    await refreshArPicker();
    return;
  }
  if (!webxr.isFloorScanComplete()) {
    logArEvent("model-place", `Place model: ${id}`, "fail", {
      error: "Floor scan still in progress — wait for floor detection to finish",
      details: webxr.getHitTestStats(),
    });
    await refreshArPicker();
    return;
  }
  if (placingModelId === id) return;
  if (placingModelId) {
    webxr.cancelPlacement();
    placingModelId = null;
  }

  const assets = await getCatalogAssets(id, catalogAssetSlug());
  if (!assets) {
    logArEvent("model-place", `Place model: ${id}`, "fail", {
      error: "Model not found in catalog",
    });
    return;
  }
  if (!assets.record.builtinType && assets.modelUrl && !isGlbParsed(assets.modelUrl)) {
    if (!getCachedGlb(assets.modelUrl)) {
      placingModelId = id;
      await refreshArPicker();
      await prefetchCatalogGlbs([assets.modelUrl]);
      if (webxr) {
        await webxr.warmupModels([assets.modelUrl]);
      } else {
        await parseGlbsOfflineAtHome([assets.modelUrl], { timeoutMs: 30000 });
      }
      await loadPickerItemsCache();
      if (!getCachedGlb(assets.modelUrl) && !isGlbParsed(assets.modelUrl)) {
        placingModelId = null;
        logArEvent("model-place", `Place model: ${id}`, "fail", {
          error: "Model still downloading — wait a moment and try again",
          details: { modelUrl: assets.modelUrl },
        });
        await refreshArPicker();
        return;
      }
      placingModelId = null;
    }
  }
  const floorState = webxr.getFloorDetectionState();
  if (!floorState.ready) {
    webxr.probeFloorFromViewer();
  }
  const floorAfterProbe = webxr.getFloorDetectionState();
  if (!floorAfterProbe.ready) {
    logArEvent("model-place", `Place model: ${id}`, "fail", {
      error: floorAfterProbe.graceActive
        ? "Floor briefly lost — hold camera on floor until placement restores"
        : "No floor detected — point at floor until placement is ready",
      details: {
        ...webxr.getHitTestStats(),
        floorReady: false,
        reticleVisible: floorAfterProbe.reticleVisible,
        ringPlaceable: floorAfterProbe.ringPlaceable,
        poseAgeMs: floorAfterProbe.poseAgeMs,
        floorNormalY: floorAfterProbe.floorNormalY,
      },
    });
    await refreshArPicker();
    return;
  }
  if (!floorAfterProbe.ringPlaceable) {
    logArEvent("model-place", `Place model: ${id}`, "fail", {
      error: "Red ring — aim at empty floor before placing (cyan = ready)",
      details: {
        ...webxr.getHitTestStats(),
        floorReady: true,
        ringPlaceable: false,
        reticleVisible: floorAfterProbe.reticleVisible,
        ringSurfaceReject: floorAfterProbe.ringSurfaceReject ?? null,
      },
    });
    await refreshArPicker();
    return;
  }
  logArEvent("model-place-attempt", `Place: ${assets.record.name}`, "info", {
    details: {
      ...webxr.getHitTestStats(),
      modelId: id,
      floorReady: floorAfterProbe.ready,
      reticleVisible: floorAfterProbe.reticleVisible,
      poseAgeMs: floorAfterProbe.poseAgeMs,
      floorNormalY: floorAfterProbe.floorNormalY,
      glbCached: assets.modelUrl ? Boolean(getCachedGlb(assets.modelUrl)) : false,
    },
  });
  placingModelId = id;
  await syncReticlePreview(id);
  await refreshArPicker();

  const timeoutResult = (): import("./xr/webxr-ar").PlaceModelResult => ({
    ok: false,
    error: `Timed out loading model (${PLACE_MODEL_TIMEOUT_MS / 1000}s). Tap Cancel or Exit, then retry.`,
    diagnostics: {
      loadMethod: "timeout",
      meshCount: 0,
      transformNodeCount: 0,
      topLevelRoots: 0,
      position: { x: 0, y: 0, z: 0 },
      meshesVisible: 0,
      modelUrl: assets.modelUrl ?? undefined,
    },
  });

  try {
    const result = await Promise.race([
      webxr.placeCustomModelAtReticle({
        label: assets.record.name,
        modelId: id,
        modelUrl: assets.modelUrl,
        builtinType: assets.record.builtinType,
        realWorld: assets.record.realWorld,
      }),
      new Promise<import("./xr/webxr-ar").PlaceModelResult>((resolve) => {
        window.setTimeout(() => {
          webxr?.cancelPlacement();
          resolve(timeoutResult());
        }, PLACE_MODEL_TIMEOUT_MS);
      }),
    ]);
    logArEvent(
      "model-place-result",
      result.ok ? `Placed: ${assets.record.name}` : `Place failed: ${assets.record.name}`,
      result.ok ? "ok" : "fail",
      {
        details: result.ok
          ? placementDetailsForLog(
              {
                ...result.diagnostics,
                sessionMedianFloorY: sessionMedianFloorY(),
              },
              enrichPlacementChecks({
                ...result.diagnostics,
                sessionMedianFloorY: sessionMedianFloorY(),
              })
            )
          : (result.diagnostics as unknown as Record<
              string,
              string | number | boolean | null | undefined
            >),
        error: result.error,
      }
    );
    if (result.ok) {
      lastPlacementFinishedAt = performance.now();
      activeModelId = id;
      trackAnalyticsEvent("placement", { modelId: id });
      void prefetchArObjectViewer();
      if (assets.modelUrl) {
        warmObjectPreviewModel(assets.modelUrl);
      }
      if (arObjectModeActive) {
        void setArObjectMode(false);
      }
      if (result.diagnostics.hitTestFloorY !== undefined) {
        sessionFloorYs.push(result.diagnostics.hitTestFloorY);
      }
    }
    arFloorReady = webxr.isReticleVisible();
  } catch (e) {
    logArEvent("model-place-result", `Place failed: ${assets.record.name}`, "fail", {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    placingModelId = null;
    await refreshArPicker();
  }
}

async function enterArPlacementMode(): Promise<void> {
  if (isIOS()) {
    void startIosQuickLookAr();
    return;
  }
  // Never replace a tenant catalog with the live-demo operator catalog.
  if (activeTenantSlug || parseTenantRoute()?.slug) {
    const slug = activeTenantSlug ?? parseTenantRoute()!.slug;
    globalDemoLanding = false;
    activeTenantSlug = slug;
    setCatalogWorkspaceSlug(slug);
  } else {
    ensureDemoArCatalogContext();
  }
  if (showFullCatalogInAr()) {
    const demoSlug = await ensureDemoCatalogReady();
    if (!demoSlug) {
      alert(demoCatalogMissingMessage());
      return;
    }
  }
  await syncArSessionFeatures();
  if (activeTenantSlug && !tenantFeatures.startAr) {
    alert("AR access is disabled for this workspace. Contact your administrator.");
    return;
  }
  // Empty tenant catalog — do not fall through to demo models in the AR picker.
  if (activeTenantSlug && !showFullCatalogInAr()) {
    const records = await fetchCatalog({ bustCache: true });
    if (!records.length) {
      alert(
        "This workspace has no models yet. Upload a GLB in Manage models, then try Preview AR again.",
      );
      navigateTo("/admin/models");
      return;
    }
  }
  invalidatePickerCache();
  const sessionFeatures = arSessionFeatures();
  clearSession({ skipSessionLog: true });
  ensureSessionLog();
  resetPlacementBaselines();
  sessionFloorYs = [];
  pickerShownLogged = false;
  void prefetchArObjectViewer();
  const enterT0 = performance.now();
  logFlowEvent("flow-ar-enter", "Entering AR placement mode", "info");
  arSessionStarting = true;

  showXrCanvas(true);
  setBodyTrainingState("webxr");
  showVideo(false);
  setArOverlayVisible(true);

  const htmlUi = arHtmlUiRoot();
  renderArScanning(htmlUi, "Starting AR camera…", () => exitArSession(), {
    phase: "starting",
    onDownloadLog: sessionFeatures.sessionLogDownload ? runDownloadSessionLog : undefined,
    sessionLogDownload: sessionFeatures.sessionLogDownload,
  });
  logFlowEvent("flow-ar-ui-scanning", "AR scanning UI shown", "info", {
    arUiMode: usesArHtmlPanel() ? (isIOS() ? "ios-html-overlay" : "dom-overlay") : "in-canvas",
  });

  const xrT0 = performance.now();
  logFlowEvent("flow-xr-request", "Requesting WebXR immersive-ar session", "info");
  // Enter immersive AR immediately — do not await preload here (loses user-activation on Android).
  pendingWarmupUrls = [];
  webxr = await tryStartWebXR(
    xrCanvas,
    arDomOverlayRoot(),
    (msg) => {
      if (usesArHtmlPanel()) {
        renderArScanning(htmlUi, msg, () => exitArSession(), {
          phase: "starting",
          onDownloadLog: sessionFeatures.sessionLogDownload ? runDownloadSessionLog : undefined,
          sessionLogDownload: sessionFeatures.sessionLogDownload,
        });
      }
    },
    undefined
  );

  if (!webxr) {
    arSessionStarting = false;
    logArEvent("ar-start", "WebXR start", "fail", {
      error: "Session null",
      details: { xrRequestMs: Math.round(performance.now() - xrT0) },
    });
    alert(arStartFailureMessage());
    exitArSession();
    return;
  }

  logFlowEvent("flow-xr-active", "WebXR session entered", "ok", {
    xrRequestMs: Math.round(performance.now() - xrT0),
    enterSetupMs: Math.round(performance.now() - enterT0),
  });
  arSessionStarting = false;

  const diag = webxr.getDiagnostics();
  logArEvent("ar-start", "WebXR session active", "ok", {
    details: diag as unknown as Record<string, string | number | boolean | null | undefined>,
  });
  resetAnalyticsSession();
  trackAnalyticsEvent("session_start");
  const immersiveEndUnsub = webxr.onImmersiveSessionEnd?.(() => {
    if (arObjectModeActive) {
      arObjectModeActive = false;
      hideArObjectViewer();
      document.body.classList.remove("ar-object-mode-active");
    }
    exitArSession();
  });
  startDimensionHudLoop();
  logArEvent("pbr-setup", "AR PBR environment", "info", {
    details: {
      lightEstimation: diag.lightEstimation,
      sceneHasEnvironment: diag.sceneHasEnvironment,
      environmentSource: diag.environmentSource,
      environmentIntensity: diag.environmentIntensity,
    },
  });

  const depthProbePromise = webxr.whenDepthProbeReady(4000);
  const hitT0 = performance.now();
  const hitReady = await webxr.whenHitTestReady(10000);
  logFlowEvent("flow-hit-test-ready", "Hit-test ready", hitReady ? "ok" : "fail", {
    hitTestWaitMs: Math.round(performance.now() - hitT0),
    hitReady,
  });
  logArEvent("hit-test", "Hit-test ready", hitReady ? "ok" : "fail", {
    details: {
      hitTestReady: hitReady,
      ...webxr.getHitTestStats(),
      domOverlayUsed: useDomOverlayInAR(),
      htmlTouchOverlay: useHtmlArTouchOverlay(),
      arPlatformProfile: diag.arPlatformProfile,
    },
  });

  const startPostFloorAssetWork = () => {
    if (glbWarmupStarted || !webxr || !pendingWarmupUrls.length) return;
    glbWarmupStarted = true;
    void prefetchDuringAr(pendingWarmupUrls).then(() => warmParseModels(pendingWarmupUrls));
  };

  void loadPickerItemsCache({ bustCache: true }).then(async (items) => {
    if (directArModelId && items.some((m) => m.id === directArModelId)) {
      activeModelId = directArModelId;
      pickerPreviewModelId = directArModelId;
    } else if (!pickerPreviewModelId) {
      pickerPreviewModelId = defaultPickerPreviewId(items);
    }
    logArEvent("catalog", "Model catalog loaded", "info", {
      details: {
        modelCount: items.length,
        modelIds: items.map((m) => m.id).join(", "),
        usdzCount: items.filter((m) => m.usdz || m.usdzUrl).length,
        directLinkModelId: directArModelId,
        demoAr: showFullCatalogInAr(),
        sessionLogDownload: arSessionFeatures().sessionLogDownload,
        catalogSource: catalogSourceLabel(),
        demoWorkspaceSlug: getDemoCatalogWorkspaceSlug(),
        awsApiEnabled: useRemoteModelApi(),
      },
    });
    requestAnimationFrame(() => {
      void refreshArPicker();
    });
    const catalogSlug = catalogAssetSlug();
    pendingWarmupUrls = arWarmupModelUrls(items, catalogSlug);
    startPostFloorAssetWork();
  });

  let floorScanLogged = false;
  const logFloorScanOnce = (floor: { ok: boolean; waitedMs: number }, trigger: string) => {
    if (floorScanLogged || !webxr) return;
    floorScanLogged = true;
    logArEvent("floor-scan", "Floor reticle scan", floor.ok ? "ok" : "fail", {
      details: {
        ...webxr.getHitTestStats(),
        floorWaitMs: floor.waitedMs,
        placementRingMode: webxr.isFloorScanComplete() ? "ring-only" : "disc-and-ring",
        trigger,
      },
    });
  };

  floorStateUnsub = webxr.onFloorStateChange((state) => {
    arFloorReady = state.ready;
    schedulePickerRefresh();
  });

  await refreshArPicker();

  void webxr
    .waitForFloorScanComplete({ minMs: 800, minSamples: 3, timeoutMs: 12000 })
    .then((floor) => {
      const stats = webxr!.getHitTestStats();
      if (!floor.ok && !webxr!.isFloorScanComplete()) {
        if (stats.hitReady && webxr!.canCompleteFloorScan()) {
          webxr!.completeFloorScan();
        } else if (webxr!.forceCompleteFloorScanAtTimeout?.()) {
          /* timeout fallback: surface hits, bootstrap samples, or viewer unlock */
        } else if (stats.hitReady && webxr!.bootstrapFloorScanFromViewer?.()) {
          /* locked from viewer bootstrap at timeout */
        } else if (
          stats.floorScanValidSamples != null &&
          stats.floorScanValidSamples >= 3 &&
          webxr!.bootstrapFloorScanFromViewer?.()
        ) {
          /* enough scan samples but phone was not pitched down — bootstrap fallback */
        }
      }
      const scanComplete = webxr!.isFloorScanComplete();
      if (floor.ok || scanComplete) {
        arFloorReady = true;
      }
      startPostFloorAssetWork();
      const trigger = stats.floorSkipped
        ? "floor-skipped"
        : floor.ok || scanComplete
          ? "floor-scan-complete"
          : stats.hitReady && (stats.framesWithResults ?? 0) > 0
            ? "scan-timeout-with-hits"
            : "scan-timeout-fail";
      logFloorScanOnce(
        { ok: floor.ok || scanComplete, waitedMs: floor.waitedMs },
        trigger
      );
      logFlowEvent(
        "flow-floor-scan-done",
        "Floor scan finished",
        floor.ok || scanComplete ? "ok" : "fail",
        {
          floorWaitMs: floor.waitedMs,
          trigger,
          ...stats,
          lockedFloorY: floor.lockedFloorY ?? stats.lockedFloorY,
          floorScanComplete: scanComplete,
        }
      );
      schedulePickerRefresh();
    });

  void depthProbePromise.then(() => {
    if (!webxr) return;
    logArEvent("depth-probe", "Depth occlusion disabled", "info", {
      details: webxr.getDiagnostics() as unknown as Record<
        string,
        string | number | boolean | null | undefined
      >,
    });
  });

  const logHitTestStats = () => {
    if (!webxr) return;
    const stats = webxr.getHitTestStats();
    logArEvent("hit-test-stats", "Hit-test frame stats", stats.hitTestEnabled ? "info" : "fail", {
      details: stats as unknown as Record<string, string | number | boolean | null | undefined>,
    });
  };
  let hitStatsTimer: ReturnType<typeof setInterval> | undefined;
  hitStatsTimer = window.setInterval(logHitTestStats, 5000);
  window.setTimeout(logHitTestStats, 2500);
  const clearHitStatsTimer = () => {
    if (hitStatsTimer !== undefined) window.clearInterval(hitStatsTimer);
  };
  const prevFloorUnsub = floorStateUnsub;
  floorStateUnsub = () => {
    clearHitStatsTimer();
    immersiveEndUnsub?.();
    prevFloorUnsub?.();
  };
}

async function prefetchDuringAr(modelUrls: string[]): Promise<void> {
  if (!webxr) return;
  const prefetch = await prefetchCatalogGlbs(modelUrls);
  logArEvent("glb-prefetch", "GLB prefetch during AR", prefetch.failed.length ? "fail" : "ok", {
    details: {
      catalogSource: catalogSourceLabel(),
      awsApiEnabled: useRemoteModelApi(),
      cachedCount: prefetch.cached.length,
      failedCount: prefetch.failed.length,
      warmupDeferred: true,
      prefetchAfterFloorScan: true,
    },
  });
  await loadPickerItemsCache();
  requestAnimationFrame(() => {
    void refreshArPicker();
  });
}

async function warmParseModels(modelUrls: string[]): Promise<void> {
  if (!webxr) return;
  logArEvent("glb-warmup-start", "GLB parse after floor scan", "info", {
    details: { modelCount: modelUrls.length },
  });
  const warmup = await webxr.warmupModels(modelUrls);
  logArEvent("glb-warmup", "GLB parse during AR", warmup.failed.length ? "fail" : "ok", {
    details: {
      warmedCount: warmup.warmed.length,
      failedCount: warmup.failed.length,
      isolatedParse: true,
    },
  });
  await loadPickerItemsCache();
  await refreshArPicker();
}

function renderDeviceTestProgress(
  progress: import("./device-test/types").DeviceTestProgress
): void {
  renderDeviceTestRunning(
    app,
    progress,
    () => {
      deviceTestCancelled = true;
      goHome();
    },
    { arHint: deviceTestArHint || undefined }
  );
}

function beginDeviceTestArSession(): Promise<WebXRSession | null> {
  return new Promise((resolve) => {
    renderDeviceTestArStart(
      app,
      () => {
        void (async () => {
          showXrCanvas(true);
          setBodyTrainingState("webxr");
          setArOverlayVisible(true);
          const { tryStartWebXR } = await import("./xr/webxr-ar");
          const session = await tryStartWebXR(xrCanvas, arDomOverlayRoot(), (msg) => {
            deviceTestArHint = msg;
          });
          resolve(session);
        })();
      },
      () => resolve(null),
      "Start AR camera",
      "Required on Android — opens immersive AR with the real camera."
    );
  });
}

async function runDeviceCheck(): Promise<void> {
  clearSession();
  deviceTestCancelled = false;
  deviceTestArHint = "";
  lastDeviceTestReport = null;

  renderDeviceTestProgress({
    stepIndex: 0,
    totalSteps: 8,
    currentName: "Starting…",
    steps: [],
  });

  if (deviceTestCancelled) return;

  const report = await runDeviceHardwareCheck(
    {
      video,
      xrCanvas,
      setBodyState: (s) => {
        document.body.classList.remove("training-camera", "xr-session-active");
        if (s === "camera") document.body.classList.add("training-camera");
        if (s === "webxr") document.body.classList.add("xr-session-active");
      },
      showVideo,
      showXrCanvas,
      beginArSession: beginDeviceTestArSession,
      onArHint: (hint) => {
        deviceTestArHint = hint;
      },
    },
    (progress) => {
      if (deviceTestCancelled) return;
      renderDeviceTestProgress(progress);
    }
  );

  if (deviceTestCancelled) return;

  setArOverlayVisible(false);
  lastDeviceTestReport = report;
  renderDeviceTestComplete(
    app,
    report,
    () => {
      if (lastDeviceTestReport) downloadDeviceTestReport(lastDeviceTestReport);
    },
    goHome
  );
}

window.addEventListener("hashchange", () => {
  if (webxr || arObjectModeActive) return;
  routeApp();
});
window.addEventListener("popstate", () => {
  if (webxr || arObjectModeActive) return;
  routeApp();
});

if (new URLSearchParams(location.search).get("selftest") === "glb") {
  void import("./dev/glb-parse-self-test");
} else if (location.pathname.replace(/\/$/, "") === "/sales-deck") {
  location.replace(`${location.origin}/sales-deck/index.html${location.search}${location.hash}`);
} else if (location.pathname.replace(/\/$/, "") === "/sales-deck/training") {
  location.replace(`${location.origin}/sales-deck/training.html${location.search}${location.hash}`);
} else if (location.pathname.replace(/\/$/, "") === "/sales-deck/outreach") {
  location.replace(`${location.origin}/sales-deck/outreach.html${location.search}${location.hash}`);
} else if (location.pathname.replace(/\/$/, "") === "/mkt-3-storyboard") {
  location.replace(`${location.origin}/mkt-3-storyboard/index.html${location.search}${location.hash}`);
} else {
  installDeployRecovery();
  installGlobalNavLoading(app);
  installNavLoadingAutoRelease(app, routePath);
  ensureSessionLog();
  logFlowEvent("flow-app-boot", "App booted", "info", {
    path: `${location.pathname}${location.search}${location.hash || ""}`,
    domOverlay: useDomOverlayInAR(),
  });
  routeApp();
}

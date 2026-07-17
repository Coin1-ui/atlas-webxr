/** Max single GLB / USDZ / icon upload — same for every billing tier. */
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

/** Workspace storage per model = max GLB × this factor (GLB + USDZ + icon headroom). */
export const MODEL_STORAGE_MULTIPLIER = 2.5;

/** Soft warning when GLB is large enough that auto-USDZ (~1.5×) may exceed the 50 MB file cap. */
export const TYPICAL_USDZ_RATIO = 1.5;
export const USDZ_SAFE_GLB_BYTES = Math.floor(MAX_ASSET_BYTES / TYPICAL_USDZ_RATIO);

export function maxAssetBytesMb(): number {
  return Math.round(MAX_ASSET_BYTES / (1024 * 1024));
}

export function storageBytesForModelCount(models: number): number {
  return Math.round(models * MAX_ASSET_BYTES * MODEL_STORAGE_MULTIPLIER);
}

export function formatAssetSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

/** Human label for auto-USDZ safe GLB size (~33 MB at 50 MB cap). */
export function autoUsdzSafeGlbLabel(): string {
  return `~${formatAssetSizeMb(USDZ_SAFE_GLB_BYTES)}`;
}

/** Plain-text hint — reuse in notes, warnings, and help copy. */
export function autoUsdzGlbPreferenceHint(): string {
  return `Prefer GLBs under ${autoUsdzSafeGlbLabel()} if you rely on auto-USDZ so conversion stays under the ${maxAssetBytesMb()} MB cap.`;
}

export type UploadSizeCheck = {
  ok: boolean;
  blocked: boolean;
  warning?: string;
  error?: string;
};

/**
 * Preflight check for GLB / optional USDZ / icon before upload.
 * Blocks files over the plan max; warns when auto-USDZ may exceed the cap.
 */
export function checkModelUploadSizes(opts: {
  glb: File;
  usdz?: File | null;
  icon?: File | null;
  /** True when USDZ will be auto-generated from GLB (no manual USDZ). */
  willAutoConvertUsdz?: boolean;
}): UploadSizeCheck {
  const maxMb = maxAssetBytesMb();
  const max = MAX_ASSET_BYTES;

  if (opts.icon && opts.icon.size > max) {
    return {
      ok: false,
      blocked: true,
      error: `Icon exceeds the ${maxMb} MB max file size (${formatAssetSizeMb(opts.icon.size)}).`,
    };
  }
  if (opts.glb.size > max) {
    return {
      ok: false,
      blocked: true,
      error: `GLB exceeds the ${maxMb} MB max file size (${formatAssetSizeMb(opts.glb.size)}). Compress or simplify the model, then try again.`,
    };
  }
  if (opts.usdz && opts.usdz.size > 0 && opts.usdz.size > max) {
    return {
      ok: false,
      blocked: true,
      error: `USDZ exceeds the ${maxMb} MB max file size (${formatAssetSizeMb(opts.usdz.size)}).`,
    };
  }

  const warnings: string[] = [];
  if (opts.willAutoConvertUsdz && opts.glb.size > USDZ_SAFE_GLB_BYTES) {
    warnings.push(
      `${autoUsdzGlbPreferenceHint()} This GLB is ${formatAssetSizeMb(opts.glb.size)} — auto-converted USDZ is often ~${TYPICAL_USDZ_RATIO}× the GLB and may exceed the ${maxMb} MB file cap. Upload a smaller GLB or add a manual USDZ under ${maxMb} MB.`,
    );
  }
  const estimatedPair = opts.glb.size + (opts.usdz?.size || Math.round(opts.glb.size * MODEL_STORAGE_MULTIPLIER));
  if (estimatedPair > max * MODEL_STORAGE_MULTIPLIER) {
    warnings.push(
      `Estimated GLB + USDZ storage (~${formatAssetSizeMb(estimatedPair)}) is above the ~${formatAssetSizeMb(max * MODEL_STORAGE_MULTIPLIER)} per-model budget.`,
    );
  }

  if (warnings.length) {
    return { ok: true, blocked: false, warning: warnings[0] };
  }
  return { ok: true, blocked: false };
}

/** Short note for upload forms (all plans). */
export function uploadSizeNoteHtml(): string {
  const maxMb = maxAssetBytesMb();
  return `Max <strong>${maxMb} MB</strong> per GLB or USDZ (all plans). Workspace storage budgets ~<strong>${MODEL_STORAGE_MULTIPLIER}×</strong> GLB size per model (GLB + iOS USDZ). ${autoUsdzGlbPreferenceHint()}`;
}

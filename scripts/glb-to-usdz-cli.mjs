/**
 * Optional server-side GLB→USDZ via usd_from_gltf CLI (when installed).
 * Used by custom-models-api when the browser did not supply USDZ.
 *
 * Set USD_FROM_GLTF_BIN to the converter path (default: usd_from_gltf on PATH).
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function usdFromGltfBin() {
  return process.env.USD_FROM_GLTF_BIN?.trim() || "usd_from_gltf";
}

/**
 * @param {string} glbPath absolute path to input .glb
 * @param {string} usdzPath absolute path to output .usdz
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
export async function convertGlbFileToUsdz(glbPath, usdzPath) {
  const bin = usdFromGltfBin();
  try {
    await execFileAsync(bin, [glbPath, usdzPath], {
      timeout: 120_000,
      windowsHide: true,
    });
    if (!fs.existsSync(usdzPath) || fs.statSync(usdzPath).size === 0) {
      return { ok: false, error: `${bin} did not produce ${usdzPath}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

const GLB_MAGIC = 0x46546c67; // "glTF" little-endian

/** MF-5 — reject corrupt/non-GLB uploads before USDZ conversion. */
export async function validateGlbFile(
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!file.name.toLowerCase().endsWith(".glb")) {
    return { ok: false, error: "File must be a .glb (glTF 2.0 binary)." };
  }
  if (file.size < 12) {
    return { ok: false, error: "File is too small to be a valid GLB." };
  }
  const head = await file.slice(0, 12).arrayBuffer();
  const view = new DataView(head);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    return {
      ok: false,
      error: "Invalid GLB — missing glTF header. Re-export as glTF 2.0 binary (.glb).",
    };
  }
  const version = view.getUint32(4, true);
  if (version !== 2) {
    return {
      ok: false,
      error: `Unsupported glTF version ${version}. Export as glTF 2.0 (.glb).`,
    };
  }
  return { ok: true };
}

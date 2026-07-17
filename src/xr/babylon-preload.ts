/**
 * Eager-load Babylon glTF + material adapters so AR placement never hits
 * lazy-loaded chunks that may 404 after a PWA deploy (stale index.html).
 */
import "@babylonjs/loaders/glTF";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";

let preloaded = false;
let preloadPromise: Promise<void> | null = null;

export async function preloadBabylonGltfPipeline(): Promise<void> {
  if (preloaded) return;
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    // Mirror glTFLoader.js dynamic imports so Vite resolves adapters at boot.
    await Promise.all([
      import("@babylonjs/loaders/glTF/2.0/pbrMaterialLoadingAdapter"),
      import("@babylonjs/loaders/glTF/2.0/openpbrMaterialLoadingAdapter"),
    ]);
    preloaded = true;
  })();

  return preloadPromise;
}

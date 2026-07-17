/**
 * Platform isolation map — only catalog GLB assets are shared between Android and iOS.
 * @see shared/ for glb-offline-cache, model-real-world-scale, webxr-ar-types
 * @see android/ for Android Chrome session + helpers
 * @see ios/ for iOS WebXR Viewer session + helpers
 */
export { pickArModule, assertSeparateArModules } from "./ar-module-router";

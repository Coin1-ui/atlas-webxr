/** Re-export ring helpers from Android copy for legacy imports. Prefer platform-local ./android/ring-pose or ./ios/ring-pose. */
export * from "./android/ring-pose";
export {
  RETICLE_BASE_DIAMETER_M,
  RETICLE_DEFAULT_FOOTPRINT_M,
  RETICLE_BUILTIN_PAD_FOOTPRINT_M,
} from "./shared/reticle-constants";

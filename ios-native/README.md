# Atlas Field AR — Native iOS (ARKit)

Native SwiftUI wrapper for catalog USDZ models when Safari Quick Look is not enough (multi-model sessions, custom UI).

## Requirements

- Xcode 15+
- iOS 15+ device with ARKit
- USDZ assets uploaded via the web **Manage 3D models** screen (`.usdz` field, iOS only)

## Convert GLB → USDZ

USDZ is **generated automatically** when you upload a GLB in **Manage 3D models (PC)** using the built-in browser converter (Three.js → Quick Look).

Optional server-side fallback: install [google/usd_from_gltf](https://github.com/google/usd_from_gltf) and set `USD_FROM_GLTF_BIN` for the local dev API.

Manual conversion (if needed): Apple **Reality Converter** on macOS.

## Web integration

- **Safari (iOS)**: `View in AR` on the home screen opens USDZ models via Quick Look — no WebXR, no app install.
- **Android Chrome**: WebXR immersive AR with multi-model floor placement (GLB catalog).

## Native app (optional)

Open `AtlasFieldAR.xcodeproj` in Xcode, set your team signing, and run on device.

The app loads the same manifest URL as the web app (`VITE_ATLAS_API_URL/models/manifest` or bundled manifest) and places USDZ models with `ARView` + horizontal plane detection.

## Files

| File | Purpose |
|------|---------|
| `AtlasFieldAR/ARViewContainer.swift` | ARKit session + tap-to-place |
| `AtlasFieldAR/ContentView.swift` | Model list + AR full-screen |
| `AtlasFieldAR/CatalogModels.swift` | Manifest JSON types |

## Manifest entry

```json
{
  "id": "Bar-Chair",
  "name": "Bar Chair",
  "icon": "Bar-Chair.PNG",
  "glb": "Bar-Chair.glb",
  "usdz": "Bar-Chair.usdz"
}
```

GLB is used for Android/WebXR; USDZ is iOS-only.

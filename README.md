# Atlas Field AR Web

Browser AR for placing custom 3D models on the floor. Private repo: [Coin1-ui/atlas-webxr](https://github.com/Coin1-ui/atlas-webxr).

**Production:** [AWS Amplify](https://main.d3sslgxfippyqn.amplifyapp.com/)  
**Models backend:** AWS Lambda + S3 (see [backend/README-AWS.md](./backend/README-AWS.md))

## Home screen

| Button | Device | Action |
|--------|--------|--------|
| **Start AR** | Phone | AR camera → scan floor → tap model icons to place/swap |
| **Manage 3D models** | PC only | Upload `.glb` + icon (progress % shown) |
| **Run camera + AR check** | Phone | Hardware test; download JSON manually |

## Deploy (AWS Amplify)

1. Connect private GitHub repo in Amplify Console.
2. Set env vars:
   - `VITE_ATLAS_API_URL` — API Gateway URL for model uploads
   - `VITE_BASE_PATH` — `/` for Amplify (default)
3. Deploy uses `amplify.yml`.

## Local dev

```bash
npm install
npm run dev:phone
```

Without `VITE_ATLAS_API_URL`, uploads save to `public/custom-models/` via the dev API plugin.

## Platform notes

| Platform | AR camera |
|----------|-----------|
| Android Chrome | WebXR immersive-ar + dom-overlay UI |
| iPhone WebXR Viewer | Bottom-panel dom-overlay (same as Android) + in-canvas GUI fallback if overlay unavailable. Hide full-screen `#app` during AR for camera passthrough. |
| iOS Safari | No WebXR AR — use [WebXR Viewer app](https://apps.apple.com/app/webxr-viewer/id1295998846) |

## Lighting & shadows

- **WebXR light estimation** when supported (matches real-world brightness)
- Directional sun + soft **contact shadows** on the floor under placed models

## License

Part of agency-agents workspace.

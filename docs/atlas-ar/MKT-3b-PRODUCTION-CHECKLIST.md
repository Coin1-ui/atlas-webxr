# MKT-3b — Production checklist (record → drop → embed)

**Status:** Recording in progress (founder) · Embed plumbing ships empty-state until files land  
**Script:** [MKT-3-DEMO-VIDEO-SCRIPT.md](./MKT-3-DEMO-VIDEO-SCRIPT.md) · Storyboard: `/mkt-3-storyboard/`  
**Canonical site:** `https://www.atlasar.in`

## Cuts to record

| Cut | Device | Length | Aspect | Drop filename |
|-----|--------|--------|--------|----------------|
| **A1** Android hero | Chrome / WebXR | ~90s | 16:9 master | `demo-a1-android.mp4` |
| **A1** Shorts (optional) | same | ~90s | 9:16 | `demo-a1-android-9x16.mp4` |
| **B1** iOS hero | Safari Quick Look | ~75s | 16:9 | `demo-b1-ios.mp4` |
| Posters | still from mid-cut | — | 16:9 | `demo-a1-poster.jpg`, `demo-b1-poster.jpg` |

## Where to put files

**Primary (dev repo → Amplify):**

```
D:\AI\agency-agents\atlas-webxr\public\marketing\demo-a1-android.mp4
D:\AI\agency-agents\atlas-webxr\public\marketing\demo-b1-ios.mp4
D:\AI\agency-agents\atlas-webxr\public\marketing\demo-a1-poster.jpg
D:\AI\agency-agents\atlas-webxr\public\marketing\demo-b1-poster.jpg
```

Optional staging dump (we rename/move on embed): `docs/atlas-ar/assets/demo-video/`

After drop: tell the agent — copy to push repo `D:\AI\atlas-webxr\atlas-webxr` + Amplify push.

## Codec / size

- H.264 + `faststart` (moov at front)
- Target **≤8–12 MB** per 16:9 cut (same discipline as `home-hero.mp4`)
- No WebM required
- **Do not** replace `home-hero*.mp4` (cinema hero loop stays separate)

## Shot checklist (A1)

- [ ] 0:00–0:03 floor placement hook (music only)
- [ ] Open `/demo` in Chrome — no login
- [ ] Start AR → floor scan → place
- [ ] Toggle **3D**
- [ ] Optional: short admin upload B-roll
- [ ] CTA: Atlas AR · try demo / www.atlasar.in

## Shot checklist (B1)

- [ ] Safari open branded or `/demo` link
- [ ] **View in AR** → Quick Look floor place
- [ ] No “WebXR on iOS” claim
- [ ] CTA same as A1

## Messaging (locked)

- “Your catalog. Their floor. No app install.”
- Avoid: metaverse, competitor names, “WebXR” in customer VO (say browser AR / Chrome / Safari)

## Embed targets (code)

- Landing `#product-demo` — Android / iOS players (`src/ui/demo-video.ts`)
- Sales deck slide 4 notes + “Watch demo” → `https://www.atlasar.in/#product-demo`

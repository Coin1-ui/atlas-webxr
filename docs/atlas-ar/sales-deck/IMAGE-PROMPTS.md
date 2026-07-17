# SAL-1 / SAL-1b — Image generation prompts (Image Prompt Engineer)

**Batch 23 (SAL-1) + Batch 24 (SAL-1b graphics refresh)**  
**Rules:** 16:9 (1920×1080) · **no text in image** · navy `#050a14` · teal `#2dd4bf` · gold `#fbbf24` · premium B2B SaaS · match heroes in `assets/`

**Platform notes:** Works in Midjourney v6+, DALL-E 3, Flux, Gemini Imagen. Use `--ar 16:9` (MJ) or explicit 1920×1080 export.

---

## Global negative prompt (append to all)

```
text, words, letters, logos, watermarks, UI chrome with readable labels, app store badges with text, stock photo cliché handshake, cartoon, clip art, oversaturated neon, busy clutter, low resolution, blurry, distorted perspective, people with uncanny faces, generic office stock photo
```

---

## slide-01-title-hero.png — Title / outcome

**Slide narrative:** Floor AR before purchase — retail + field sales.

**Positive prompt:**
```
Cinematic wide 16:9 hero, no text. Modern living room showroom at dusk, single elegant sofa placed on real hardwood floor with subtle augmented reality teal placement ring and soft gold floor reflection, smartphone on coffee table showing abstract glowing AR viewport (no readable UI). Dark navy environment #050a14, teal accent rim light #2dd4bf, warm gold highlights #fbbf24 on floor edge. Premium B2B SaaS marketing photography, shallow depth of field, left third darker and softer for headline overlay, photorealistic, aspirational but professional.
```

**Composition:** Leave **left 40%** darker/emptier for headline stack. Hero subject **right-center**.

**Negative:** extra furniture clutter, readable phone screen text, app icons with labels.

---

## slide-02-problem.png — Problem / returns

**Positive prompt:**
```
Split-concept still life, no text. Left side: muted red-tinted stack of cardboard furniture return boxes and a measuring tape, suggesting wrong-size returns. Right side: floating translucent 3D sofa hovering above a table instead of floor, a PDF document icon, and a smartphone with abstract app tiles — all in desaturated gray. Dark navy background #050a14, subtle teal rim light #2dd4bf, premium B2B infographic style, cinematic, center-left empty band for headline overlay, 16:9.
```

**Composition:** **Upper-left 35%** clear for headline. Split line at **40%** width.

---

## slide-03-solution-hero.png — Solution / branded link

**Positive prompt:**
```
Premium product hero, no text. Sleek smartphone floating at slight angle, screen showing abstract teal AR floor grid and 3D furniture silhouette (no readable UI text), soft teal glow #2dd4bf on screen edges, dark navy studio background #050a14, subtle gold accent line #fbbf24 along device bezel. Left half of frame intentionally dark and minimal for bullet copy overlay. Photorealistic device render, enterprise SaaS launch aesthetic, 16:9, shallow DOF.
```

**Composition:** Phone **right 55%**. **Left 45%** dark gradient for copy.

---

## slide-04-how-it-works.png — Three-step flow

**Positive prompt:**
```
Abstract three-step flow diagram, no text. Three connected teal nodes left to right: upload cloud with GLB cube, brand palette with logo placeholder circle (no letters), smartphone with floor AR ring. Thin gold connector lines #fbbf24 between nodes. Dark navy background #050a14, minimal isometric 3D, enterprise SaaS onboarding aesthetic, lower third empty for three card overlays, upper left darker for headline, 16:9.
```

**Composition:** Flow **middle 50%** vertical band. **Lower 30%** empty. **Top-left** for headline.

---

## slide-05-retail-icp.png — Retail ICP (Elena)

**Positive prompt:**
```
Lifestyle retail showroom scene, no text. Bright but controlled furniture store aisle, mid-century modern sofa and side table on polished floor, subtle teal AR placement halo under sofa suggesting floor AR preview, warm natural window light mixed with navy-teal color grade in shadows #050a14. Professional, diverse-free environment (no faces required), premium merchandising photography, right side visual interest, left third softer for persona card overlay, 16:9, photorealistic.
```

**Composition:** **Left 35%** soft blur/dark for persona card. Hero vignette **right**.

---

## slide-07-comparison.png — Comparison columns

**Positive prompt:**
```
Abstract comparison visual, no text. Three vertical columns of light — dim gray, medium gray, bright teal #2dd4bf — suggesting weak plugin, expensive SaaS, highlighted Atlas path. Center column tallest with soft gold cap #fbbf24. Dark navy floor reflection #050a14, clean corporate, no logos, no words, symmetrical composition for table overlay, 16:9.
```

**Composition:** Columns **center 70%**. **Top 25%** dark for headline. **Bottom 20%** for table overlay.

---

## slide-09-security-trust.png — Security / IT trust

**Positive prompt:**
```
Enterprise security abstract, no text. Shield form built from translucent teal geometric panels #2dd4bf, lock motif integrated subtly, dark navy background #050a14 with fine grid lines suggesting infrastructure, small gold accent nodes #fbbf24 at connection points. Minimal, IT-friendly, no vendor logos, calm and trustworthy, left side darker for check-list overlay, 16:9, crisp 3D render.
```

**Composition:** Shield **right-center**. **Left 40%** dark for bullet/check rows.

---

## slide-10-cta.png — Closing CTA mood

**Positive prompt:**
```
Call-to-action mood background, no text. Teal gradient burst from bottom-left #2dd4bf, dark navy elsewhere #050a14, subtle gold particles #fbbf24 suggesting opportunity. Empty center-right area for QR code overlay. Premium startup sales closing slide, optimistic but professional, soft lens flare, no buttons with text baked in, 16:9.
```

**Composition:** **Center-right 40%** lighter/empty for QR. **Bottom-left** teal energy only.

---

## Regeneration checklist

After generating new PNGs:

1. Export **1920×1080 PNG**, sRGB, no embedded text.
2. Copy to `docs/atlas-ar/sales-deck/assets/` and `public/sales-deck/assets/`.
3. Verify on `/sales-deck/index.html` — slides **1, 4, 7** at **100% opacity**; others **60%** (`public/sales-deck/deck.css`).
4. Run `npm run build` before Amplify deploy.

## Agent handoff

| Role | Next action |
|------|-------------|
| **UI Designer** | Confirm overlay gradients in `DESIGN-SYSTEM.md` match safe zones above |
| **Visual Storyteller** | Cross-check each prompt vs speaker notes in `SALES-DECK.md` |
| **Frontend** | No code change unless new aspect ratios break `deck.css` |
| **User gate** | Confirm Batch 24 before marking SAL-1b done |

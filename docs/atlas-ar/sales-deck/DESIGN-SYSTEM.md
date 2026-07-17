# Atlas AR Sales Deck — Design System (SAL-1 / SAL-1b)

**Batch 23 + Batch 24 · UI Designer + Visual Storyteller spec**  
**Format:** 16:9 (1920×1080) · Export to Google Slides, PowerPoint, or Figma

---

## Brand tokens

| Token | Value | Use |
|-------|-------|-----|
| Background | `#050a14` | Slide base, full bleed |
| Surface | `#0f1c34` | Cards, panels |
| Accent primary | `#2dd4bf` | CTAs, highlights, AR ring |
| Accent warm | `#fbbf24` | Pricing badges, founding offer |
| Text primary | `#f1f5f9` | Headlines |
| Text muted | `#94a3b8` | Body, captions |
| Border | `rgba(148,163,184,0.2)` | Dividers |

**Typography:** DM Sans (UI, bullets) · Instrument Serif (hero headlines, italic emphasis)

---

## Layout grid

- **Margins:** 80px all sides (safe zone for projectors)
- **Title zone:** top 40% — headline + subhead
- **Content zone:** middle 45% — bullets, diagram, or image
- **Footer:** bottom 60px — logo wordmark `Atlas` + `AR` in teal, slide number, optional URL

---

## Slide templates

### A — Title (slide 1)
Full-bleed hero at **100% opacity** + gradient overlay (strong left darken). Center-left headline stack. Safe zone: **left 40%** empty/dark in hero art — see [IMAGE-PROMPTS.md](./IMAGE-PROMPTS.md).

### B — Problem / contrast (slide 2)
Split: left red-tinted pain bullets, right muted “status quo” icons (PDF, floating AR, app store).

### C — Solution hero (slide 3)
Large phone mockup right; copy left. Teal glow on phone screen.

### D — Three-step (slide 4)
Horizontal 3 cards with numbered circles (1–3), icon + one line each.

### E — ICP (slides 5–6)
Left persona card (name, role, quote); right lifestyle image panel.

### F — Comparison table (slide 7)
3 columns: Plugins · Showroom SaaS · **Atlas AR** (highlighted column with teal border).

### G — Pricing (slide 8)
4 tier cards; Launch featured with warm gold “Most teams start here” badge.

### H — Security (slide 9)
Shield/lock motif + 4 check rows; minimal, IT-friendly.

### I — CTA (slide 10)
Teal primary button shape (visual only): “Start free — $5/mo” · QR to live demo URL.

---

## Image assets

Generated heroes live in `./assets/` (synced to `public/sales-deck/assets/`):

| File | Slide | Opacity (web deck) | Safe zone |
|------|-------|-------------------|-----------|
| `slide-01-title-hero.png` | Title | **100%** | Left 40% dark |
| `slide-02-problem.png` | Problem | 60% | Upper-left 35% |
| `slide-03-solution-hero.png` | Solution | 60% | Left 45% dark |
| `slide-04-how-it-works.png` | How it works | **100%** | Lower 30% + top-left |
| `slide-05-retail-icp.png` | Retail ICP | 60% | Left 35% soft |
| `slide-07-comparison.png` | Comparison | **100%** | Top 25% + bottom 20% |
| `slide-09-security-trust.png` | Security | 60% | Left 40% dark |
| `slide-10-cta.png` | CTA | 60% | Center-right 40% empty |

**Rule:** No text baked into AI images — all copy in slide layer.  
**Regeneration:** [IMAGE-PROMPTS.md](./IMAGE-PROMPTS.md) · Batch 24 refresh 2026-05-21.

### Web deck overlay gradient

Interactive deck (`public/sales-deck/deck.css`) applies:

```css
.slide-bg { opacity: 0.6; }
.slide[data-id="1"] .slide-bg,
.slide[data-id="4"] .slide-bg,
.slide[data-id="7"] .slide-bg { opacity: 1; }
.slide-bg::after {
  background: linear-gradient(135deg,
    rgba(5,10,20,0.92) 0%,
    rgba(5,10,20,0.55) 55%,
    rgba(5,10,20,0.85) 100%);
}
```

Slides **1, 4, 7** use full hero opacity; others stay at 60% so bullet copy remains readable.

---

## Accessibility

- Minimum body text 24pt equivalent at 1080p
- Contrast ratio ≥ 4.5:1 for body on `#050a14`
- Do not rely on color alone for tier comparison — use labels

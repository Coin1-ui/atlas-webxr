# SAL-1 — Slide layouts (UI Designer spec)

Slides **without** hero PNGs — build natively in Google Slides / PowerPoint using DESIGN-SYSTEM.md tokens.

---

## Slide 2 — Problem

```
┌─────────────────────────────────────────────────────────────┐
│  [Headline 44pt Instrument Serif]                      │
│  Static catalogs fail at the moment of decision.          │
│                                                       │
│  LEFT 55%                    RIGHT 40%                  │
│  ● Wrong-size returns        [icon grid 2×2]            │
│  ● PDF / PowerPoint          📄  floating AR            │
│  ● $99–450/mo gate          📱  app store              │
│  ● $100k custom stall       💰                         │
│  (24pt DM Sans, muted red    (icons #64748b, 64px)     │
│   tint on first bullet only)                           │
└─────────────────────────────────────────────────────────────┘
```

**Design note:** No photo — keeps pain slide fast. Red tint `#f87171` at 15% opacity on left panel only.

---

## Slide 4 — How it works

```
┌─────────────────────────────────────────────────────────────┐
│  Live in under 10 minutes                             │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ ① teal  │  │ ② teal  │  │ ③ teal  │             │
│  │ circle  │  │ circle  │  │ circle  │             │
│  │ Upload  │  │ Brand   │  │ Share   │             │
│  │ 1 line  │  │ 1 line  │  │ 1 line  │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│  Cards: #0f1c34 bg, 1px border, 16px radius         │
└─────────────────────────────────────────────────────────────┘
```

Optional: use `slide-04-how-it-works.png` as faint 20% background behind cards.

---

## Slide 6 — Field sales (Marcus)

```
┌─────────────────────────────────────────────────────────────┐
│  B2B field sales                                       │
│                                                       │
│  LEFT: Persona card          RIGHT: dark panel          │
│  ┌─────────────────┐         (or solid #0f1c34)       │
│  │ Marcus          │         Quote in Instrument       │
│  │ VP Sales        │         Serif italic 28pt:        │
│  │ ─────────────── │         "My reps won't install    │
│  │ 4 bullets     │          another app."             │
│  └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

No new image required — quote card is the visual anchor.

---

## Slide 7 — Comparison

```
┌─────────────────────────────────────────────────────────────┐
│  White-label workspace — not a plugin, not a gated demo   │
│                                                       │
│  ┌────────┐ ┌────────┐ ┌──────────────┐                 │
│  │Plugins │ │Showroom│ │ ATLAS AR     │ ← 2px teal    │
│  │        │ │ SaaS   │ │ (highlight)│    border      │
│  │ 4 rows │ │ 4 rows│ │ 4 rows ✓   │                 │
│  └────────┘ └────────┘ └──────────────┘                 │
│  Row text 20pt max; checkmarks teal on Atlas column only  │
└─────────────────────────────────────────────────────────────┘
```

Optional: `slide-07-comparison.png` as full-bleed at 8% opacity.

---

## Slide 8 — Pricing

```
┌─────────────────────────────────────────────────────────────┐
│  Start at $5. Scale without seat fees.                  │
│                                                       │
│  [Starter] [Launch ★] [Growth] [Scale]                 │
│   $5/mo    $59/mo     $179/mo   $499+                 │
│            gold badge                                 │
│            "Most teams                                  │
│             start here"                               │
│  Launch card: scale 1.05, teal glow shadow              │
│  Footer: 14-day trial · Founding 10 (14pt muted)      │
└─────────────────────────────────────────────────────────────┘
```

**Copy trim:** Hide Scale details on slide — say "Custom" only; detail on appendix.

---

## Slide 10 — CTA

```
┌─────────────────────────────────────────────────────────────┐
│  Start free this week                                   │
│                                                       │
│  LEFT 50%                    RIGHT 40%                │
│  1. Sign up — $5/mo          [QR placeholder]         │
│  2. Live demo /demo           scan on phone             │
│  3. Founding 10 offer                               │
│  [Teal CTA pill shape]       demo URL under QR        │
│  your@email.com                                       │
└─────────────────────────────────────────────────────────────┘
```

Optional: `slide-10-cta.png` right panel background.

---

## Design improvements (applied to next revision)

1. **Slide 7 table:** Cap cell copy at **18 words max** per row — move overflow to speaker notes.
2. **Footer bar:** Add `Atlas` + `AR` wordmark on every slide (currently spec-only — enforce in build).
3. **Gold usage:** Limit to **one** gold element per slide (badge OR accent, not both).

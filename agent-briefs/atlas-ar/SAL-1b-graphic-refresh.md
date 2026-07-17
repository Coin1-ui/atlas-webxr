# Agent brief — SAL-1b Graphics refresh

**Brief ID:** `SAL-1b`  
**Title:** Sales deck hero graphics — attractive B2B visuals  
**Agent roles:** UI Designer · Image Prompt Engineer · Visual Storyteller  
**Sprint / Phase:** Phase 2 · NEXUS-Sprint **Batch 24** (proposed)  
**Priority:** P1  
**Estimated effort:** 0.5–1 day  

### Context

Batch 23 delivered SAL-1 (interactive deck, copy, design system, 8 hero PNGs). Dedicated Cursor subagents were **blocked by usage limits**; layout/prompt work was done inline. This batch focuses on **graphics quality**: refined design tokens, complete image-generation prompts for all heroes, optional regenerated PNGs, and deck CSS opacity/layout polish.

### Locked constraints

- Product name: **Atlas AR**
- Format: **16:9 (1920×1080)** heroes
- **No text baked into AI images** — copy lives in HTML/CSS layer
- Brand tokens: `#050a14` · `#2dd4bf` · `#fbbf24` · DM Sans / Instrument Serif
- Do not break `/sales-deck/` interactive deck or platform owner toggle

### Inputs (read first)

- `docs/atlas-ar/sales-deck/DESIGN-SYSTEM.md`
- `docs/atlas-ar/sales-deck/IMAGE-PROMPTS.md`
- `docs/atlas-ar/SALES-DECK.md`
- `docs/atlas-ar/sales-deck/SLIDE-LAYOUTS.md`
- Existing heroes: `docs/atlas-ar/sales-deck/assets/` + `public/sales-deck/assets/`

### Deliverables

- [ ] **UI Designer:** Graphics polish spec (spacing, overlay gradients, hero opacity rules) — update `DESIGN-SYSTEM.md` if needed
- [ ] **Image Prompt Engineer:** Complete prompts for all 8 heroes in `IMAGE-PROMPTS.md` (positive + negative + composition safe zones)
- [ ] **Visual Storyteller:** Verify each prompt matches slide narrative in `SALES-DECK.md`
- [ ] **Optional:** Regenerated PNGs synced to `docs/` and `public/sales-deck/assets/`
- [ ] **QA:** Visual check on `/sales-deck/index.html` (slides 1, 4, 7 at 100% opacity per `deck.css`)

### Out of scope

- New slide count or pricing copy changes
- Lambda / Amplify deploy (unless user requests)
- Stripe or billing

### Handoff

- **Frontend Developer** — apply CSS/layout tweaks from UI Designer
- **User gate** — confirm Batch 24 before MKT-3 / LEG-1

### Execution when Cursor subagents unavailable

```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run agent:gemini:probe
npm run agent:gemini -- --brief agent-briefs/atlas-ar/SAL-1b-graphic-refresh.md
```

Or invoke rules: `@image-prompt-engineer`, `@ui-designer`, `@visual-storyteller` in Cursor chat with this brief.

---

## Quality bar

- Prompts must be copy-paste ready for Midjourney, DALL-E, Flux, or Gemini Imagen
- Heroes must read “premium B2B SaaS” not consumer gaming
- Cite slide numbers and filenames in every prompt block

# Agent brief — SAL-3 Sales deck presenter script

**Brief ID:** `SAL-3`  
**Title:** Full presenter script for 10-slide sales deck  
**Agent roles:** Visual Storyteller · Sales Coach · Discovery Coach · Proposal Strategist  
**Sprint / Phase:** Phase 2 · NEXUS-Sprint **Batch 25** · **confirmed** ✅ (2026-05-21)  
**Priority:** P1  
**Estimated effort:** 2–4 hours  

### Context

SAL-1 delivered slide copy ([SALES-DECK.md](../docs/atlas-ar/SALES-DECK.md)) and speaker notes. Reps need a **word-for-word walkthrough script** with discovery pauses, demo beats, persona branches, and close language — not just bullet notes ([SPEAKER-GUIDE.md](../docs/atlas-ar/sales-deck/SPEAKER-GUIDE.md)).

### Locked constraints

- Win theme: *Same floor AR outcome as showroom incumbents — self-serve in an afternoon, from $5/mo, no per-seat tax on field reps.*
- 10 slides — do not add slides without PM approval
- Live demo URL: `/demo` and customer `/w/{slug}`
- Personas: Elena (retail), Marcus (field), Priya (IT)

### Inputs (read first)

- `docs/atlas-ar/SALES-DECK.md`
- `docs/atlas-ar/SALES-PLAYBOOK.md`
- `docs/atlas-ar/sales-deck/SPEAKER-GUIDE.md`
- `docs/atlas-ar/ICP.md`
- `docs/atlas-ar/PRICING.md`

### Deliverables

- [x] **Visual Storyteller:** Narrative flow + transitions — `docs/atlas-ar/sales-deck/PRESENTER-SCRIPT.md`
- [x] **Sales Coach:** Objection inserts + timing discipline per slide
- [x] **Discovery Coach:** `[ASK]` prompts woven before key slides
- [x] **Proposal Strategist:** Four-path close on slide 10 (Starter, live upload, Design partner, Founding 10)
- [x] **Frontend:** Interactive training — `public/sales-deck/training.html`
- [x] **Revision:** Design-partner close aligned with SAL-2 Batch 27

### Out of scope

- Demo **video** script (see backlog **MKT-3**)
- Design partner outreach — **SAL-2 done** ([outreach.html](../../public/sales-deck/outreach.html))
- Pricing changes

### Handoff

- Sales team uses script on live calls + `/sales-deck/` screen share
- **User gate** — Batch 25 confirmed 2026-05-21 · [BATCH-25-CONFIRMED.md](../docs/atlas-ar/BATCH-25-CONFIRMED.md)

### Execution when Cursor subagents unavailable

```powershell
npm run agent:gemini -- --brief agent-briefs/atlas-ar/SAL-3-presenter-script.md
```

Or `@visual-storyteller` + `@sales-coach` + `@discovery-coach` in Cursor chat.

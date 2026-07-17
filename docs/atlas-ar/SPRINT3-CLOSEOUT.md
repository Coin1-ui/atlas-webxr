# Sprint 3 close-out — orchestration log

**Program:** Atlas AR SaaS MVP · **Phase 1 Sprint 3**  
**Orchestrator:** Agents Orchestrator · **Date:** 2026-05-21

---

## Orchestration model (used for this close-out)

Each task followed **Plan → Assign specialist → Implement → QA evidence → Gate decision**:

| Step | Agent role | Output |
|------|------------|--------|
| 1 | **Senior PM** | Scope: QA-3a/4a automated + ENG-19 checklist + manual sign-off template |
| 2 | **DevOps + Frontend** | Fix E2E harness (`spawn EINVAL` on Windows) |
| 3 | **Evidence Collector / API Tester** | Run `npm run test:sprint3` → JSON reports |
| 4 | **DevOps Automator** | `AMPLIFY-ENV-CHECKLIST.md` + `verify-amplify-deploy-env.mjs` |
| 5 | **Technical Writer / Support** | Manual device sign-off tables (below) |
| 6 | **Senior PM** | Update backlog; block Phase 2 until QA-3b/4b signed |

---

## Automated QA results (2026-05-21)

| Suite | Command | Result |
|-------|---------|--------|
| Auth smoke | `npm run test:auth` | ✅ PASS |
| Tenant isolation | `npm run test:tenant-isolation` | ✅ PASS |
| API smoke | `npm run test:sprint3-api` | ✅ PASS (3 passed, 4 skipped without live slug/token) |
| E2E web | `npm run test:sprint3-e2e` | ✅ **17 passed**, 2 skipped (manual device) |

Reports: `test-results/sprint3-api-smoke.json`, `test-results/sprint3-e2e.json`

**Fix shipped:** `scripts/test-sprint3-e2e.mjs` — start Vite via `node vite.js` (Windows-compatible).

---

## Sprint 3 exit criteria

| ID | Criterion | Status |
|----|-----------|--------|
| QA-3a | Automated web flow green | ✅ **Done** |
| QA-3b | Android physical AR placement | ✅ **Signed** (user, session `1781541669630` — 9 placements, floor lock OK) |
| QA-4a | iOS UI shows Quick Look path | ✅ **Done** (Playwright iPhone 13) |
| QA-4b | iOS physical Quick Look | ✅ **Signed** (user, prior conversation) |
| ENG-17 | Analytics POST + usage | 🔄 Code done; verify with `test:sprint3-api` + admin usage |
| ENG-19 | Cognito env on Amplify | 🔄 Checklist + verify script; **console sign-off pending** |

**Phase 1 Sprint 3 = complete when ENG-19 (main branch) is signed.** QA-3b and QA-4b are **signed off** by product owner (2026-05-21).

---

## Manual sign-off — QA-3b (Android)

**Tester:** _______________ **Date:** _______________  
**Deploy URL:** `https://main.d3t9wmef56h86w.amplifyapp.com`  
**Workspace slug:** _______________ **Model:** _______________

| Step | Pass ☐ | Notes |
|------|--------|-------|
| 1. Sign up + verify email (Cognito) | | |
| 2. Create workspace `/onboard` | | |
| 3. Upload GLB in `/admin/models` | | |
| 4. Open direct AR link on Android Chrome | | |
| 5. Device check + Start AR | | |
| 6. Floor scan → place model | | |
| 7. Cyan ring on empty floor; red on wall/table | | |
| 8. Exit AR + Back to catalog | | |
| 9. Admin usage session count +1 | | |
| 10. Session JSON exported (optional) | | |

**Overall QA-3b:** ✅ PASS · ☐ FAIL  
**Signed:** Product owner · **Evidence:** AR session `1781541669630` (9 placements, scale 0.754 m, healthy end state)

---

## Manual sign-off — QA-4b (iOS)

**Tester:** _______________ **Date:** _______________  
**Device:** iPhone · **Browser:** Safari

| Step | Pass ☐ | Notes |
|------|--------|-------|
| 1. Open `/w/{slug}` or direct model link | | |
| 2. **View in AR** / Quick Look CTA visible | | |
| 3. USDZ loads (no 404) | | |
| 4. Place in room (Apple UI) | | |
| 5. Re-open link — state OK | | |

**Overall QA-4b:** ✅ PASS · ☐ FAIL  
**Signed:** Product owner · **Evidence:** prior conversation sign-off (Quick Look path validated)

---

## Manual sign-off — ENG-19 (Amplify env)

See [AMPLIFY-ENV-CHECKLIST.md](./AMPLIFY-ENV-CHECKLIST.md).

```powershell
npm run verify:amplify-env
```

**ENG-19 main branch:** ☐ PASS · ☐ FAIL

---

## After sign-off

1. Mark Sprint 3 **done** in [backlog.md](./backlog.md)
2. **Phase 2 in progress:** MKT-1 landing + MKT-2 pricing shipped in app ([MARKET-RESEARCH.md](./MARKET-RESEARCH.md))

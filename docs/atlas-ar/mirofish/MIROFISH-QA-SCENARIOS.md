# MiroFish-derived QA scenarios — Atlas AR

**Source:** [PREDICTION-REPORT.md](./mirofish/PREDICTION-REPORT.md) conversion-killer analysis  
**Automated coverage:** extend `npm run test:sprint3-e2e` where noted

---

## P0 — Trial conversion killers

| ID | Scenario | Pass criteria | Auto |
|----|----------|---------------|------|
| MF-1 | **10-minute path:** signup → upload (dev fixture) → share link → AR landing visible | ≤15 min manual; dev fixture AR landing in E2E | Yes (guided `/admin/get-started` + E2E) |
| MF-2 | **iOS path:** direct model landing shows Quick Look / View in AR, not WebXR Start | iOS UA test in E2E | Yes |
| MF-3 | **Android path:** tenant catalog → View in AR → Start AR visible | Desktop + Android manual | Partial |
| MF-4 | **Empty catalog:** new workspace shows empty state, not broken page | Helpful setup copy + admin CTA | Partial |
| MF-5 | **Broken GLB:** upload corrupt file → admin shows error, showroom does not crash | GLB header validation in admin upload | Partial |

---

## P1 — Revenue & retention

| ID | Scenario | Pass criteria | Auto |
|----|----------|---------------|------|
| MF-6 | **Account page** loads signed-in: profile, plan, usage | `/account` renders email + workspace ID | Yes |
| MF-7 | **Overage warning** at 80%+ usage shows in admin/account | Mock usage API or dev limits | No |
| MF-8 | **Upgrade CTA** on account page links to pricing / request flow | Button visible, navigates | Manual |
| MF-9 | **Mobile account** without admin: tenant catalog shows Account, not Admin only | Mobile E2E | Yes |

---

## P1 — Marketing / trust

| ID | Scenario | Pass criteria | Auto |
|----|----------|---------------|------|
| MF-10 | **About page** loads from mobile nav | `/about` 200, title present | Yes |
| MF-11 | **Workspace vs plugin** copy on landing | Text present in DOM | Yes |
| MF-12 | **Pricing toggle** Product on `/pricing`, Pricing on `/` | Nav label swap | Manual |
| MF-16 | **Security/privacy** on landing + `/about` | Tenant isolation, no shopper accounts | Yes |

---

## P2 — Sales enablement validation

| ID | Scenario | Pass criteria |
|----|----------|---------------|
| MF-13 | Founding offer visible on pricing page | Banner text |
| MF-14 | Demo works without account | `/demo` + Start AR or View in AR |
| MF-15 | Legal pages linked from footer | terms, privacy, AUP |

---

## Manual retail pilot script (Elena persona)

1. Open `/signup` desktop → create workspace  
2. Upload 3 GLBs → open `/w/{slug}` on Android Chrome  
3. Place each model — floor lock stable 30s  
4. Share link to second device — no login required  
5. Admin usage counter increments  

**Pass:** 3/3 placements, associate can explain flow in <2 min.

---

## Manual field sales script (Marcus persona)

1. Admin curates 5-SKU catalog  
2. Rep opens showroom on buyer’s phone on-site  
3. Session appears in usage (when API live)  
4. Rep cannot edit catalog from phone — Account page accessible  

**Pass:** Buyer sees branded link only; rep never sideloads an app.

---

## Regression after marketing changes

Re-run after each landing/pricing deploy:

```powershell
npm run test:sprint3-e2e
```

Track MF-10, MF-11, MF-6 in `test-results/sprint3-e2e.json`.

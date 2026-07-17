# DES-1 — Admin & Owner UI Wireframes

**Status:** Spec complete (documents shipped screens + intended states)
**Scope:** Tenant **Admin dashboard**, platform **Owner dashboard**, **Account/Billing** page, and
trial **suspension** states. Wireframes are annotated to the actual component labels in
`src/ui/admin-dashboard.ts`, `src/ui/owner-dashboard.ts`, and `src/ui/account-page.ts`.

Design tokens referenced here are defined in [DES-2-BRAND-KIT.md](./DES-2-BRAND-KIT.md).
Notation: `[ Button ]`, `( ) radio`, `[x] checkbox`, `‹badge›`, `====` = accent/highlight band.

---

## 1. Tenant Admin dashboard — `admin-dashboard.ts`

Entry point for a workspace admin after login. Mobile-first single column; widens to a centered
column (max ~720px) on desktop.

```
┌───────────────────────────────────────────────┐
│  ‹workspace logo›   Atlas · <Workspace name>    │  ← admin-shell header
│                                    [ Account ] │
├───────────────────────────────────────────────┤
│ ============ TRIAL / STATUS BANNER =========== │  ← admin-card admin-card-highlight
│  Growth trial active — 13d 07:14:11 remaining   │     (only while trial active OR suspended)
│  Subscribe to Starter/Launch/Growth or Upgrade  │
│  to Scale before it ends.        [ Manage plan ]│
├───────────────────────────────────────────────┤
│  Usage (2026-07)                                │  ← admin-section "Usage (month)"
│   Models        12 / 100                        │
│   AR sessions   842 / 10000                     │     usageStatHtml() progress rows
│   Storage       0.4 / 12.2 GB                   │
├───────────────────────────────────────────────┤
│  ┌───────────────┐ (primary action card)       │
│  │ ▣  Models     │  Manage your 3D catalog      │  ← data-action="models"
│  └───────────────┘                              │
│  ┌───────────────┐ ┌───────────────┐            │
│  │ ✎ Branding    │ │ ⌖ Start AR    │            │  ← data-action="branding" / "ar"
│  └───────────────┘ └───────────────┘            │
└───────────────────────────────────────────────┘
```

**States**
- **No trial / paid:** status banner hidden; usage limits reflect paid tier.
- **Trial active:** highlight banner with live countdown (`Nd HH:MM:SS`) + dynamic
  Subscribe/Upgrade sentence (per-tier matrix).
- **Suspended (trial ended, no qualifying purchase):** banner turns danger; usage rows read
  `0 / 0`; action cards for models/AR are disabled; only **Manage plan** is actionable.

**Responsive:** action cards stack 1-col < 480px, 2-col ≥ 480px. Header logo falls back to
wordmark when no tenant logo set.

---

## 2. Platform Owner dashboard — `owner-dashboard.ts`

Only reachable by platform-owner emails. Tabbed workspace.

```
┌─────────────────────────────────────────────────────────┐
│  Owner dashboard                          [ Sign out ]    │  ← h1
├─────────────────────────────────────────────────────────┤
│  Platform settings                                        │  ← h2 admin-section-title
│   API base ............ https://…execute-api…             │
│   Owner emails ........ a@x.com, b@y.com                  │
│                                          [ Save settings ]│
├─────────────────────────────────────────────────────────┤
│  [ Live demo models ] [ Customer accounts ] [ Discounts ]│  ← owner-tab (active underlined)
└─────────────────────────────────────────────────────────┘
```

### Tab A — Live demo models
```
│  Try live demo — global catalog                          │
│  ‹model card› ‹model card› ‹model card› …                │
│  [ Start AR ]  [ Camera check ]                           │  ← owner-slide-label CTAs
```

### Tab B — Customer accounts
```
│  Customer accounts                                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Acme Showroom  ‹Platform owner›? ‹Trial paused›?   │  │  ← owner-badge / owner-badge-danger
│  │ slug: acme    plan: [ growth ▾ ]                   │  │
│  │ trial: ends 2026-07-18 · purchased: —              │  │
│  │ [ Save plan ] [ Restrict account ] [ Delete account]│  │  ← ghost + owner-btn-danger
│  └───────────────────────────────────────────────────┘  │
│  … repeat per workspace …                                 │
```
- `Save plan` → `PATCH /v2/platform/workspaces/{id}` (clears trial when a paid tier assigned).
- Restricted account shows **[ Lift restriction ]** instead of Restrict.
- Platform-owner workspace is `protectedFromDeletion` (no Delete button).

### Tab C — Discount coupons
```
│  Discount coupons                                         │
│  ── Create coupon ──────────────────────────────────────  │
│   Code        [ FOUNDING10        ]                        │
│   Label       [ Founding offer    ]                        │
│   Discount %  [ 34 ]   Target tier [ growth ▾ ]           │
│   Expires     [ 2026-12-31 ]                               │
│   [x] Show on pricing banner                               │  ← NEW showOnPricing
│   Banner text [ Growth at Launch price for 12 months ]     │  ← NEW bannerText
│                                        [ Create coupon ]   │
│  ── Active coupons ─────────────────────────────────────  │
│   `FOUNDING10`  ‹On pricing banner›  34% · growth · exp…   │  ← owner-coupon-badge
│      "Growth at Launch price for 12 months"     [ Delete ] │
│   `SPRING20`   20% · all · exp 2026-08-01       [ Delete ] │
```
- Create → `POST /v2/platform/coupons` (with `showOnPricing`, `bannerText`).
- Only the most-recent non-expired `showOnPricing` coupon becomes the public promo
  (`getActivePromo()` → `/v2/platform/public-settings.promo`).
- Delete → `DELETE /v2/platform/coupons/{code}` (removes banner if it was the active promo).

**Responsive:** tab bar scrolls horizontally < 520px; customer/coupon rows become stacked cards.

---

## 3. Account / Billing page — `account-page.ts`

Reachable from Admin header and always reachable while suspended (so users can re-subscribe).

```
┌───────────────────────────────────────────────┐
│  Your plan                                      │
│ ============ TRIAL COUNTDOWN ================== │
│  Growth trial active — 13d 07:14:11 remaining   │  ← live countdown, updates each second
│  with Growth limits. Subscribe to Starter/      │
│  Launch/Growth or Upgrade to Scale before your  │
│  showroom pauses.                               │
├───────────────────────────────────────────────┤
│  ┌── Starter ─┐ ┌── Launch ─┐ ┌── Growth ─┐ ┌ Scale ┐ │
│  │ $X/mo      │ │ $59/mo    │ │ $Y/mo     │ │ $Z/mo │ │
│  │ • limits…  │ │ • limits… │ │ • limits… │ │ •limits│ │
│  │[Subscribe] │ │[Subscribe]│ │[Subscribe]│ │[Upgrade]│ │  ← planActionVerbForTier per card
│  └───────────┘ └──────────┘ └──────────┘ └────────┘ │
└───────────────────────────────────────────────┘
```

**Subscribe vs Upgrade matrix** (per-tier CTA verb, from `planActionVerbForTier`):

| Current state | Starter | Launch | Growth | Scale |
|---------------|---------|--------|--------|-------|
| Launch trial  | Subscribe | Subscribe | Upgrade | Upgrade |
| Growth trial  | Subscribe | Subscribe | Subscribe | Upgrade |
| Paid Growth   | — | — | Current | Upgrade |

**States**
- **Trial active:** countdown card + full matrix.
- **Suspended:** countdown card replaced by "Trial ended / Access paused" message; all self-serve
  tiers shown as re-subscribe options; picking one → `POST /v2/workspaces/{id}/billing/upgrade`.
- **Paid:** current tier marked, higher tiers say Upgrade, lower tiers hidden or "Downgrade".

---

## 4. Suspension states — `owner-dashboard.ts` (shared paused shells)

```
┌───────────────────────────────────────┐        ┌───────────────────────────────────────┐
│            Access paused                │        │             Trial ended                 │
│  This showroom is paused. Re-subscribe  │        │  Your 14-day trial has ended. Choose a  │
│  to restore access.                     │        │  plan to reactivate your showroom.      │
│         [ Manage plan ]                 │        │            [ See plans ]                │
│         [ Sign out ]                    │        │            [ Sign out ]                 │
└───────────────────────────────────────┘        └───────────────────────────────────────┘
```
- **Access paused** = owner-restricted (`Restrict account`).
- **Trial ended** = trial expired without qualifying purchase.
- Public routes (`/public-config`, `/catalog`, `/models/upload`) are gated server-side; the AR
  viewer for that tenant shows a paused notice rather than models.

---

## 5. Interaction / route map (for QA)

| UI action | API |
|-----------|-----|
| Admin "Manage plan" | client route → Account page |
| Account tier CTA | `POST /v2/workspaces/{id}/billing/upgrade` |
| Owner "Save plan" | `PATCH /v2/platform/workspaces/{id}` |
| Owner "Restrict / Lift" | `PATCH /v2/platform/workspaces/{id}` |
| Owner "Create coupon" | `POST /v2/platform/coupons` |
| Owner "Delete coupon" | `DELETE /v2/platform/coupons/{code}` |
| Pricing banner | `GET /v2/platform/public-settings` → `promo` |

## 6. Accessibility notes (carried from UI audit)
- All actionable controls are real `<button>`/`<a>` with visible focus ring (`outline: 2px solid var(--accent)`).
- Countdown uses `aria-live="polite"` so screen readers announce trial time without spamming.
- Danger actions (Restrict/Delete) use `owner-btn-danger` + confirm dialog before firing.
- Color is never the only signal: paused = danger color **and** "paused"/"ended" text + badge.

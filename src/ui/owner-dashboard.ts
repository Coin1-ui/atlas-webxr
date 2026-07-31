import type { CatalogModel } from "../data/model-catalog";
import type {
  DesignPartnerSlot,
  PlatformCoupon,
  PlatformWorkspaceRow,
} from "../data/platform-api";
import { padDesignPartnerSlots } from "../data/platform-api";
import { normalizeWorkspaceFeatures } from "../shared/workspace-features";
import {
  billingTierFromWorkspace,
  CUSTOMER_BILLING_TIERS,
  PLAN_TIERS,
  tierOptionLabel,
  type PlanTierId,
} from "../shared/plan-display";
import { isTrialActive, isServicePaused, trialDaysRemaining, trialFallbackTier } from "../shared/trial";
import { planDisplayName } from "../shared/plan-display";
import { couponIsActive, couponOfferSummary, couponUsesLine } from "../shared/coupon";
import {
  couponOfferMode,
  parseCouponCreateForm,
  syncCouponOfferFields,
} from "../shared/coupon-offer-form";
import { MKT_ASSETS } from "./marketing-assets";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type OwnerTab = "demo" | "customers" | "coupons" | "partners";

export function renderOwnerDashboard(
  root: HTMLElement,
  state: {
    email: string;
    tab: OwnerTab;
    workspaces: PlatformWorkspaceRow[];
    coupons: PlatformCoupon[];
    designPartners?: DesignPartnerSlot[];
    status?: string;
    error?: string;
    salesDeckActive?: boolean;
    mkt3StoryboardActive?: boolean;
    ownerEmailLookup?: "cognito" | "disabled";
  },
  handlers: {
    onTab: (tab: OwnerTab) => void;
    onRefreshWorkspaces: () => void;
    onRefreshCoupons: () => void;
    onSetPlan: (workspaceId: string, billingTier: PlanTierId) => void | Promise<void>;
    onSetFeature: (
      workspaceId: string,
      feature: "sessionLogDownload" | "startAr" | "cameraCheck",
      enabled: boolean,
    ) => void | Promise<void>;
    onRestrict: (workspaceId: string, restricted: boolean, reason: string, slug?: string) => void | Promise<void>;
    onDeleteCustomer: (workspaceId: string, name: string, slug: string) => void | Promise<void>;
    onRefund: (input: {
      workspaceId: string;
      provider: "dodo" | "zoho";
      paymentId: string;
      amountMinor: number;
      reason: string;
    }) => void | Promise<void>;
    onCreateCoupon: (input: {
      offerType?: "fixed" | "percent";
      code: string;
      label: string;
      discountPercent?: number;
      targetTier?: string;
      expiresAt?: string;
      showOnPricing?: boolean;
      bannerText?: string;
      maxUses?: number;
      promoPriceMonthly?: number;
      durationMonths?: number;
    }) => void | Promise<void>;
    onDeleteCoupon: (code: string) => void;
    onSaveDesignPartners: (slots: DesignPartnerSlot[]) => void | Promise<void>;
    onMountDemoManager: (slot: HTMLElement) => void;
    onSignOut: () => void;
    onBack: () => void;
    onSalesDeckToggle: (active: boolean) => void | Promise<void>;
    onMkt3StoryboardToggle: (active: boolean) => void | Promise<void>;
  },
): void {
  const tab = state.tab;
  const tierOptions = PLAN_TIERS.map(
    (t) => `<option value="${t.id}">${escapeHtml(tierOptionLabel(t))}</option>`,
  ).join("");

  const tierSelectFor = (ws: PlatformWorkspaceRow) => {
    const current = billingTierFromWorkspace(ws);
    return PLAN_TIERS.map(
      (t) =>
        `<option value="${t.id}" ${current === t.id ? "selected" : ""}>${escapeHtml(tierOptionLabel(t))}</option>`,
    ).join("");
  };

  const customerCount = state.workspaces.length;
  const deletableCount = state.workspaces.filter((w) => !w.protectedFromDeletion).length;
  const missingOwnerEmails = state.workspaces.some((w) => !(w.ownerEmails?.length));
  const partnerSlots = padDesignPartnerSlots(state.designPartners ?? []);
  const activePartnerCount = partnerSlots.filter((s) => s.workspace.trim() && s.status === "active").length;
  const partnerCards = partnerSlots
    .map((slot, index) => {
      const c = slot.checklist;
      return `
        <article class="admin-card owner-partner-card" data-partner-index="${index}">
          <input type="hidden" name="id-${index}" value="${escapeHtml(slot.id)}" />
          <p class="admin-label">Slot ${index + 1}</p>
          <div class="owner-form-grid">
            <label class="auth-label">Workspace (id, slug, or name)
              <input class="auth-input" name="workspace-${index}" maxlength="120" value="${escapeHtml(slot.workspace)}" placeholder="ws_… or brand-slug" autocomplete="off" />
            </label>
            <label class="auth-label">Start date
              <input class="auth-input" name="startDate-${index}" type="date" value="${escapeHtml(slot.startDate)}" />
            </label>
            <label class="auth-label">Status
              <select class="auth-input" name="status-${index}">
                <option value="active" ${slot.status === "active" ? "selected" : ""}>Active</option>
                <option value="converted" ${slot.status === "converted" ? "selected" : ""}>Converted</option>
                <option value="churned" ${slot.status === "churned" ? "selected" : ""}>Churned</option>
              </select>
            </label>
          </div>
          <fieldset class="owner-partner-checklist">
            <legend class="admin-label">Ops checklist</legend>
            <label class="owner-coupon-check"><input type="checkbox" name="couponCreated-${index}" ${c.couponCreated ? "checked" : ""} /><span>Coupon created</span></label>
            <label class="owner-coupon-check"><input type="checkbox" name="planSet-${index}" ${c.planSet ? "checked" : ""} /><span>Plan / entitlement set</span></label>
            <label class="owner-coupon-check"><input type="checkbox" name="sessionLog-${index}" ${c.sessionLog ? "checked" : ""} /><span>Session log enabled</span></label>
            <label class="owner-coupon-check"><input type="checkbox" name="kickoffDone-${index}" ${c.kickoffDone ? "checked" : ""} /><span>Kickoff done</span></label>
          </fieldset>
          <label class="auth-label">Notes
            <textarea class="auth-input owner-partner-notes" name="notes-${index}" maxlength="500" rows="2" placeholder="Feedback cadence, Founding 10 note, referral…">${escapeHtml(slot.notes)}</textarea>
          </label>
        </article>`;
    })
    .join("");
  const emailLookupHint =
    state.ownerEmailLookup === "disabled"
      ? `<p class="owner-email-hint owner-email-hint-warn">Owner emails need <code>COGNITO_USER_POOL_ID</code> on the atlas-api Lambda (plus <code>cognito-idp:ListUsers</code> IAM). Redeploy <code>atlas-api-deploy.zip</code>, then refresh.</p>`
      : missingOwnerEmails
        ? `<p class="owner-email-hint">If emails are still blank, redeploy the latest atlas-api Lambda zip — it backfills from Cognito on each load.</p>`
        : "";

  const featureTogglesFor = (w: PlatformWorkspaceRow) => {
    const features = normalizeWorkspaceFeatures(w.features);
    const operatorNote = w.protectedFromDeletion
      ? `<p class="owner-meta owner-protected-note">Your operator workspace — toggles also apply to <strong>Try live demo</strong> AR.</p>`
      : "";
    return `
      ${operatorNote}
      <div class="owner-feature-toggles">
        <label class="owner-slide-toggle" title="Download session log (JSON) in AR">
          <span class="owner-slide-label">JSON log</span>
          <input type="checkbox" data-feature-toggle="sessionLogDownload" data-workspace-id="${escapeHtml(w.id)}" ${features.sessionLogDownload ? "checked" : ""} />
          <span class="owner-slide-track" aria-hidden="true"></span>
        </label>
        <label class="owner-slide-toggle" title="Start AR button on customer showroom links">
          <span class="owner-slide-label">Start AR</span>
          <input type="checkbox" data-feature-toggle="startAr" data-workspace-id="${escapeHtml(w.id)}" ${features.startAr ? "checked" : ""} />
          <span class="owner-slide-track" aria-hidden="true"></span>
        </label>
        <label class="owner-slide-toggle" title="Run camera + AR check on customer links">
          <span class="owner-slide-label">Camera check</span>
          <input type="checkbox" data-feature-toggle="cameraCheck" data-workspace-id="${escapeHtml(w.id)}" ${features.cameraCheck ? "checked" : ""} />
          <span class="owner-slide-track" aria-hidden="true"></span>
        </label>
      </div>`;
  };

  const operatorWorkspace = state.workspaces.find((w) => w.protectedFromDeletion);
  const operatorJsonLogOn = operatorWorkspace
    ? normalizeWorkspaceFeatures(operatorWorkspace.features).sessionLogDownload
    : false;

  const workspaceRows =
    state.workspaces.length === 0
      ? `<p class="owner-empty">No customer workspaces returned from the API. Click <strong>Refresh</strong> after signing in, or check the error above (Lambda needs <code>ATLAS_PLATFORM_OWNER_EMAILS</code> and <code>GET /v2/platform/workspaces</code>).</p>
         <form class="owner-manual-form" data-form="manual-workspace">
           <label class="auth-label">Workspace ID
             <input class="auth-input" name="workspaceId" placeholder="ws_abc123" required />
           </label>
           <label class="auth-label">Slug (optional)
             <input class="auth-input" name="slug" placeholder="acme-furniture" />
           </label>
           <label class="auth-label">Plan (pricing page tier)
             <select class="auth-input" name="billingTier">${tierOptions}</select>
           </label>
           <button type="submit" class="a-btn a-btn--primary">Apply plan</button>
         </form>`
      : `<div class="owner-table-wrap">
           <table class="owner-table a-table">
             <thead>
               <tr><th>Workspace</th><th>Owner email</th><th>Plan</th><th>Viewer controls</th><th>Status</th><th>Actions</th></tr>
             </thead>
             <tbody>
               ${state.workspaces
                 .map(
                   (w) => `
                 <tr data-workspace-id="${escapeHtml(w.id)}" class="${w.protectedFromDeletion ? "owner-row-protected" : ""}">
                   <td>
                     <strong>${escapeHtml(w.name)}</strong>
                     ${w.protectedFromDeletion ? `<span class="owner-badge owner-badge-platform">Platform owner</span>` : ""}
                     <code class="owner-slug">/w/${escapeHtml(w.slug)}</code>
                     <span class="owner-id">${escapeHtml(w.id)}</span>
                     ${
                       isServicePaused(w)
                         ? `<span class="owner-badge owner-badge-danger">Service paused</span>`
                         : isTrialActive(w)
                           ? `<span class="owner-meta">Trial: ${trialDaysRemaining(w)}d left · needs ${escapeHtml(planDisplayName(w.plan, trialFallbackTier(w.trialPlan ?? "growth")))} paid</span>`
                           : ""
                     }
                     ${w.protectedFromDeletion ? `<p class="owner-protected-note">Cannot be deleted — platform operator account</p>` : ""}
                   </td>
                   <td class="owner-email-cell">
                     ${
                       w.ownerEmails?.length
                         ? w.ownerEmails
                             .map(
                               (email) =>
                                 `<a class="owner-email-link" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`,
                             )
                             .join("<br>")
                         : `<span class="owner-email-missing">—</span><span class="owner-meta">No owner email from API</span>`
                     }
                   </td>
                   <td>
                     <select class="field-input owner-plan-select" data-plan-for="${escapeHtml(w.id)}">
                       ${tierSelectFor(w)}
                     </select>
                   </td>
                   <td>${featureTogglesFor(w)}</td>
                   <td>
                     ${
                       w.restricted
                         ? `<span class="owner-badge owner-badge-danger">Restricted</span><p class="owner-reason">${escapeHtml(w.restrictionReason ?? "Policy violation")}</p>`
                         : `<span class="owner-badge owner-badge-ok">Active</span>`
                     }
                   </td>
                   <td class="owner-row-actions">
                     <button type="button" class="a-btn a-btn--ghost a-btn--sm" data-save-plan="${escapeHtml(w.id)}">Save plan</button>
                     ${
                       w.billingProvider
                         ? `<button type="button" class="a-btn a-btn--ghost a-btn--sm a-btn--danger-ghost" data-refund="${escapeHtml(w.id)}" data-provider="${escapeHtml(w.billingProvider)}">Issue refund</button>`
                         : ""
                     }
                     ${
                       w.restricted
                         ? `<button type="button" class="a-btn a-btn--ghost a-btn--sm" data-unrestrict="${escapeHtml(w.id)}">Lift restriction</button>`
                         : `<button type="button" class="a-btn a-btn--ghost a-btn--sm a-btn--danger-ghost" data-restrict="${escapeHtml(w.id)}" data-slug="${escapeHtml(w.slug)}">Restrict account</button>`
                     }
                     ${
                       w.protectedFromDeletion
                         ? ""
                         : `<button type="button" class="a-btn a-btn--ghost a-btn--sm a-btn--danger-ghost" data-delete-customer="${escapeHtml(w.id)}" data-name="${escapeHtml(w.name)}" data-slug="${escapeHtml(w.slug)}">Delete account</button>`
                     }
                   </td>
                 </tr>`,
                 )
                 .join("")}
             </tbody>
           </table>
         </div>`;

  const couponRows =
    state.coupons.length === 0
      ? `<p class="owner-empty">No coupons yet. Create one for sales or pilot programs.</p>`
      : `<ul class="owner-coupon-list">
           ${state.coupons
             .map(
               (c) => `
             <li class="owner-coupon-card">
               <div>
                 <code class="owner-coupon-code">${escapeHtml(c.code)}</code>${c.showOnPricing ? ` <span class="owner-coupon-badge">On pricing banner</span>` : ""}${!couponIsActive(c) ? ` <span class="owner-coupon-badge owner-coupon-badge-muted">Inactive</span>` : ""}
                 <p>${escapeHtml(c.label)} · ${escapeHtml(couponOfferSummary(c) || "—")}</p>
                 ${c.showOnPricing && c.bannerText ? `<p class="owner-meta">Banner: “${escapeHtml(c.bannerText)}”</p>` : ""}
                 <p class="owner-meta owner-coupon-uses">${escapeHtml(couponUsesLine(c))}</p>
                 ${c.expiresAt ? `<p class="owner-meta">Expires ${escapeHtml(c.expiresAt.slice(0, 10))}</p>` : ""}
               </div>
               <button type="button" class="a-btn a-btn--ghost a-btn--sm a-btn--danger-ghost" data-delete-coupon="${escapeHtml(c.code)}">Delete</button>
             </li>`,
             )
             .join("")}
         </ul>`;

  root.innerHTML = `
    <div class="admin-shell owner-shell">
      <div class="admin-shell-hero" style="background-image: url('${MKT_ASSETS.authWorkspace}')" aria-hidden="true">
        <div class="admin-shell-hero-overlay"></div>
      </div>
      <div class="admin-shell-body">
        <div class="admin-shell-card owner-card">
          <header class="owner-header">
            <p class="mkt-eyebrow">Platform operator</p>
            <h1>Owner dashboard</h1>
            <p class="auth-hint">Signed in as ${escapeHtml(state.email)} · Manage live demo catalog, customer plans, coupons, and policy restrictions.</p>
          </header>

          ${
            state.status
              ? `<div class="camera-success" role="status">${escapeHtml(state.status)}</div>`
              : ""
          }
          ${
            state.error
              ? `<div class="camera-warning" role="alert">${escapeHtml(state.error)}</div>`
              : ""
          }

          <section class="owner-platform-section admin-section">
            <h2 class="admin-section-title">Platform settings</h2>
            <div class="admin-card admin-card-highlight">
              <label class="owner-slide-toggle admin-slide-toggle">
                <span class="admin-slide-toggle-copy">
                  <strong>Sales deck</strong>
                  <span class="auth-hint">/sales-deck/index.html · ${state.salesDeckActive !== false ? "Active" : "Inactive"}</span>
                </span>
                <input type="checkbox" data-sales-deck-toggle ${state.salesDeckActive !== false ? "checked" : ""} aria-label="Sales deck active" />
                <span class="owner-slide-track" aria-hidden="true"></span>
              </label>
              <div class="admin-slide-toggle-actions">
                <a class="mkt-btn mkt-btn-ghost mkt-btn-sm" href="/sales-deck/index.html" target="_blank" rel="noopener">Open deck ↗</a>
              </div>
            </div>
            <div class="admin-card admin-card-highlight">
              <label class="owner-slide-toggle admin-slide-toggle">
                <span class="admin-slide-toggle-copy">
                  <strong>MKT-3 storyboard</strong>
                  <span class="auth-hint">/mkt-3-storyboard/index.html · ${state.mkt3StoryboardActive !== false ? "Active" : "Inactive"}</span>
                </span>
                <input type="checkbox" data-mkt3-storyboard-toggle ${state.mkt3StoryboardActive !== false ? "checked" : ""} aria-label="MKT-3 storyboard active" />
                <span class="owner-slide-track" aria-hidden="true"></span>
              </label>
              <div class="admin-slide-toggle-actions">
                <a class="mkt-btn mkt-btn-ghost mkt-btn-sm" href="/mkt-3-storyboard/index.html" target="_blank" rel="noopener">Open storyboard ↗</a>
              </div>
            </div>
          </section>

          <nav class="owner-tabs" aria-label="Owner sections">
            <button type="button" class="owner-tab ${tab === "demo" ? "active" : ""}" data-tab="demo">Live demo models</button>
            <button type="button" class="owner-tab ${tab === "customers" ? "active" : ""}" data-tab="customers">Customer accounts</button>
            <button type="button" class="owner-tab ${tab === "coupons" ? "active" : ""}" data-tab="coupons">Discount coupons</button>
            <button type="button" class="owner-tab ${tab === "partners" ? "active" : ""}" data-tab="partners">Design partners</button>
          </nav>

          <section class="owner-panel ${tab === "demo" ? "" : "hidden"}" data-panel="demo">
            <h2 class="admin-section-title">Try live demo — global catalog</h2>
            <p class="auth-hint">These models power the mobile <strong>Try live demo</strong> experience. Share links use <code>/w/{slug}/ar/{model}</code>; anonymous <code>/demo</code> uses the same operator workspace slug (not <code>legacy</code>).</p>
            ${
              operatorWorkspace
                ? `<p class="auth-hint owner-demo-slug-hint">Operator workspace slug: <code>${escapeHtml(operatorWorkspace.slug)}</code> — set <code>VITE_DEMO_WORKSPACE_SLUG=${escapeHtml(operatorWorkspace.slug)}</code> in Amplify.</p>
                  <p class="auth-hint">iOS uses USDZ from each upload. If textures look wrong in Quick Look, re-upload with embedded textures or check USDZ was generated (see upload status).</p>
                  <div class="admin-card admin-card-highlight owner-demo-json-card">
                    <p class="admin-label">Live demo AR controls</p>
                    <p class="auth-hint">The <strong>JSON</strong> button in live demo AR follows your operator workspace toggle (same row in Customer accounts).</p>
                    <label class="owner-slide-toggle owner-demo-json-toggle" title="Show JSON session log download in live demo AR">
                      <span class="owner-slide-label">JSON log in live demo AR</span>
                      <input type="checkbox" data-feature-toggle="sessionLogDownload" data-workspace-id="${escapeHtml(operatorWorkspace.id)}" ${operatorJsonLogOn ? "checked" : ""} />
                      <span class="owner-slide-track" aria-hidden="true"></span>
                    </label>
                  </div>`
                : `<p class="auth-hint owner-demo-json-hint">Sign in with your operator workspace loaded to enable the JSON log toggle for live demo AR.</p>`
            }
            <div id="owner-demo-slot" class="owner-demo-slot"></div>
          </section>

          <section class="owner-panel ${tab === "customers" ? "" : "hidden"}" data-panel="customers">
            <div class="owner-panel-head">
              <h2 class="admin-section-title">Customer accounts</h2>
              <p class="auth-hint owner-panel-meta">${customerCount} workspace${customerCount === 1 ? "" : "s"} · ${deletableCount} can be deleted · platform owner accounts are protected</p>
              <button type="button" class="a-btn a-btn--ghost a-btn--sm" data-action="refresh-workspaces">Refresh</button>
            </div>
            ${emailLookupHint}
            ${workspaceRows}
            <details class="owner-restrict-form-wrap">
              <summary>Restrict account manually</summary>
              <form class="owner-manual-form" data-form="manual-restrict">
                <label class="auth-label">Workspace ID
                  <input class="auth-input" name="workspaceId" required placeholder="ws_abc123" />
                </label>
                <label class="auth-label">Reason
                  <input class="auth-input" name="reason" required placeholder="Acceptable use violation — spam uploads" />
                </label>
                <button type="submit" class="a-btn a-btn--danger">Restrict account</button>
              </form>
            </details>
          </section>

          <section class="owner-panel ${tab === "coupons" ? "" : "hidden"}" data-panel="coupons">
            <div class="owner-panel-head">
              <h2 class="admin-section-title">Discount coupons</h2>
              <button type="button" class="a-btn a-btn--ghost a-btn--sm" data-action="refresh-coupons">Sync from Dodo</button>
            </div>
            <p class="auth-hint owner-coupon-sync-hint">Use counts sync from Dodo Payments when you open or refresh this panel.</p>
            <form class="owner-coupon-form" data-form="create-coupon" novalidate>
              <div class="owner-form-grid">
                <label class="auth-label">Code
                  <input class="auth-input" name="code" required maxlength="32" placeholder="FOUNDING10" pattern="[A-Za-z0-9_-]+" autocomplete="off" />
                </label>
                <label class="auth-label">Label
                  <input class="auth-input" name="label" required maxlength="80" placeholder="Founding offer — Growth at Launch price" autocomplete="off" />
                </label>
                <label class="auth-label">Offer type
                  <select class="auth-input" name="offerType" data-offer-type>
                    <option value="fixed">Fixed promo price (e.g. Growth @ $59/mo)</option>
                    <option value="percent">Percent off</option>
                  </select>
                </label>
              </div>
              <fieldset class="owner-offer-fieldset" data-offer-group="fixed">
                <legend class="owner-offer-legend">Fixed promo details</legend>
                <div class="owner-form-grid">
                  <label class="auth-label">Promo price (USD/mo)
                    <input class="auth-input" name="promoPriceMonthly" type="number" min="1" step="1" value="59" placeholder="59" inputmode="numeric" />
                  </label>
                  <label class="auth-label">Duration (months)
                    <input class="auth-input" name="durationMonths" type="number" min="1" step="1" value="12" placeholder="12" inputmode="numeric" />
                  </label>
                  <label class="auth-label">Plan tier
                    <select class="auth-input" name="targetTierFixed" data-target-tier-fixed>
                      ${CUSTOMER_BILLING_TIERS.map((t) => `<option value="${t.id}"${t.id === "growth" ? " selected" : ""}>${escapeHtml(tierOptionLabel(t))}</option>`).join("")}
                    </select>
                  </label>
                  <label class="auth-label">Max uses
                    <input class="auth-input" name="maxUsesFixed" type="number" min="1" step="1" placeholder="10 — e.g. first 10 customers" inputmode="numeric" />
                  </label>
                </div>
              </fieldset>
              <fieldset class="owner-offer-fieldset hidden" data-offer-group="percent" hidden>
                <legend class="owner-offer-legend">Percent-off details</legend>
                <div class="owner-form-grid">
                  <label class="auth-label">Discount %
                    <input class="auth-input" name="discountPercent" type="number" min="1" max="100" value="25" inputmode="numeric" />
                  </label>
                  <label class="auth-label">Target tier (optional)
                    <select class="auth-input" name="targetTierPercent" data-target-tier-percent>
                      <option value="">Any tier</option>
                      ${CUSTOMER_BILLING_TIERS.map((t) => `<option value="${t.id}">${escapeHtml(tierOptionLabel(t))}</option>`).join("")}
                    </select>
                  </label>
                <label class="auth-label">Expires (optional)
                  <input class="auth-input" name="expiresAt" type="date" />
                </label>
                <label class="auth-label">Max uses (optional)
                  <input class="auth-input" name="maxUses" type="number" min="1" step="1" placeholder="Unlimited if empty" inputmode="numeric" />
                </label>
                </div>
              </fieldset>
              <label class="owner-coupon-check">
                <input type="checkbox" name="showOnPricing" checked />
                <span>Show this offer on the public pricing-page banner</span>
              </label>
              <label class="auth-label">Pricing banner text (optional — defaults to the label)
                <input class="auth-input" name="bannerText" maxlength="160" placeholder="Founding offer — first 10 customers get Growth at Launch price ($59/mo) for 12 months" />
              </label>
              <p class="auth-hint" data-offer-hint="fixed">Fixed promo: set plan tier + promo price. Max uses drives the banner countdown (e.g. “7 of 10 spots left”). No discount % or expiry date.</p>
              <p class="auth-hint hidden" data-offer-hint="percent" hidden>Percent off: set discount % and optional tier/expiry/max uses. No promo price or duration.</p>
              <button type="submit" class="a-btn a-btn--primary">Create coupon</button>
            </form>
            ${couponRows}
          </section>

          <section class="owner-panel ${tab === "partners" ? "" : "hidden"}" data-panel="partners">
            <div class="owner-panel-head">
              <h2 class="admin-section-title">Design partners</h2>
              <p class="auth-hint owner-panel-meta">${activePartnerCount} of 3 active slots · Growth @ $59 · 90-day pilot</p>
            </div>
            <p class="auth-hint">Track the three design-partner slots (ops truth only — coupons stay on the Discount coupons tab). Runbook: <code>docs/atlas-ar/SAL-4-DESIGN-PARTNER-OPS.md</code>.</p>
            <form class="owner-partners-form" data-form="design-partners" novalidate>
              <div class="owner-partners-grid">
                ${partnerCards}
              </div>
              <button type="submit" class="a-btn a-btn--primary">Save design partners</button>
            </form>
          </section>

          <div class="admin-footer-actions">
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="back">← Back to home</button>
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="signout">Sign out</button>
          </div>
        </div>
      </div>
    </div>`;

  root.querySelectorAll<HTMLElement>("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-tab") as OwnerTab;
      handlers.onTab(t);
    });
  });

  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-action=signout]")?.addEventListener("click", handlers.onSignOut);
  root.querySelector("[data-action=refresh-workspaces]")?.addEventListener("click", handlers.onRefreshWorkspaces);
  root.querySelector("[data-action=refresh-coupons]")?.addEventListener("click", handlers.onRefreshCoupons);

  root.querySelector<HTMLInputElement>("[data-sales-deck-toggle]")?.addEventListener("change", (e) => {
    const input = e.currentTarget as HTMLInputElement;
    void handlers.onSalesDeckToggle(input.checked);
  });

  root.querySelector<HTMLInputElement>("[data-mkt3-storyboard-toggle]")?.addEventListener("change", (e) => {
    const input = e.currentTarget as HTMLInputElement;
    void handlers.onMkt3StoryboardToggle(input.checked);
  });

  root.querySelectorAll<HTMLInputElement>("[data-feature-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.getAttribute("data-workspace-id");
      const feature = input.getAttribute("data-feature-toggle") as
        | "sessionLogDownload"
        | "startAr"
        | "cameraCheck"
        | null;
      if (!id || !feature) return;
      void handlers.onSetFeature(id, feature, input.checked);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-save-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-save-plan");
      if (!id) return;
      const sel = root.querySelector<HTMLSelectElement>(`[data-plan-for="${id}"]`);
      if (sel) void handlers.onSetPlan(id, sel.value as PlanTierId);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-restrict]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-restrict");
      const slug = btn.getAttribute("data-slug") ?? undefined;
      if (!id) return;
      const reason = window.prompt("Restriction reason (shown internally):") ?? "";
      if (!reason.trim()) return;
      void handlers.onRestrict(id, true, reason.trim(), slug);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-unrestrict]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-unrestrict");
      if (!id) return;
      void handlers.onRestrict(id, false, "");
    });
  });

  root.querySelectorAll<HTMLElement>("[data-delete-customer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete-customer");
      const name = btn.getAttribute("data-name") ?? "this customer";
      const slug = btn.getAttribute("data-slug") ?? "";
      if (!id) return;
      const ok = window.confirm(
        `Permanently delete customer account “${name}” (/w/${slug})?\n\nThis removes their workspace, uploaded models, and login. This cannot be undone.`,
      );
      if (!ok) return;
      void handlers.onDeleteCustomer(id, name, slug);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-refund]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const workspaceId = btn.getAttribute("data-refund");
      const provider = btn.getAttribute("data-provider");
      if (!workspaceId || (provider !== "dodo" && provider !== "zoho")) return;
      const paymentId = window.prompt("Provider payment ID to refund:")?.trim();
      if (!paymentId) return;
      const amount = window.prompt("Refund amount (for example, 5.00):")?.trim();
      if (!amount || !/^\d+(?:\.\d{1,2})?$/.test(amount)) {
        window.alert("Enter a valid positive amount with no more than two decimal places.");
        return;
      }
      const [whole, fraction = ""] = amount.split(".");
      const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return;
      const reason = window.prompt("Refund reason:")?.trim();
      if (!reason) return;
      if (!window.confirm(`Issue a ${provider.toUpperCase()} refund of ${amount} for ${paymentId}?`)) return;
      void handlers.onRefund({ workspaceId, provider, paymentId, amountMinor, reason });
    });
  });

  root.querySelectorAll<HTMLElement>("[data-delete-coupon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-delete-coupon");
      if (code) handlers.onDeleteCoupon(code);
    });
  });

  const couponForm = root.querySelector<HTMLFormElement>("[data-form=create-coupon]");
  const offerTypeSelect = couponForm?.querySelector<HTMLSelectElement>("[data-offer-type]");
  const syncOfferFields = () => {
    if (!couponForm) return;
    syncCouponOfferFields(couponForm, couponOfferMode(offerTypeSelect ?? null));
  };
  offerTypeSelect?.addEventListener("change", syncOfferFields);
  syncOfferFields();

  couponForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!couponForm) return;
    void handlers.onCreateCoupon(parseCouponCreateForm(couponForm));
  });

  const partnersForm = root.querySelector<HTMLFormElement>("[data-form=design-partners]");
  partnersForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!partnersForm) return;
    const fd = new FormData(partnersForm);
    const slots: DesignPartnerSlot[] = [0, 1, 2].map((index) => ({
      id: String(fd.get(`id-${index}`) ?? `dp-${index + 1}`).trim() || `dp-${index + 1}`,
      workspace: String(fd.get(`workspace-${index}`) ?? "").trim(),
      startDate: String(fd.get(`startDate-${index}`) ?? "").trim(),
      status: (() => {
        const s = String(fd.get(`status-${index}`) ?? "active");
        return s === "converted" || s === "churned" ? s : "active";
      })(),
      notes: String(fd.get(`notes-${index}`) ?? "").trim().slice(0, 500),
      checklist: {
        couponCreated: fd.get(`couponCreated-${index}`) === "on",
        planSet: fd.get(`planSet-${index}`) === "on",
        sessionLog: fd.get(`sessionLog-${index}`) === "on",
        kickoffDone: fd.get(`kickoffDone-${index}`) === "on",
      },
    }));
    void handlers.onSaveDesignPartners(slots);
  });

  const manualPlan = root.querySelector<HTMLFormElement>("[data-form=manual-workspace]");
  manualPlan?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(manualPlan);
    const id = String(fd.get("workspaceId") ?? "").trim();
    const billingTier = String(fd.get("billingTier") ?? "starter") as PlanTierId;
    if (id) void handlers.onSetPlan(id, billingTier);
  });

  const manualRestrict = root.querySelector<HTMLFormElement>("[data-form=manual-restrict]");
  manualRestrict?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(manualRestrict);
    const id = String(fd.get("workspaceId") ?? "").trim();
    const reason = String(fd.get("reason") ?? "").trim();
    if (id && reason) void handlers.onRestrict(id, true, reason);
  });

  if (tab === "demo") {
    const slot = root.querySelector("#owner-demo-slot");
    if (slot) handlers.onMountDemoManager(slot as HTMLElement);
  }
}

/** Restricted-account screen for policy violations. */
export function renderRestrictedAccount(root: HTMLElement, reason: string, onSignOut: () => void): void {
  root.innerHTML = `
    <div class="home ar-landing-page">
      <div class="ar-landing-card ar-landing-card--warn">
        <p class="mkt-eyebrow">Account restricted</p>
        <h1>Access paused</h1>
        <p class="home-sub">This workspace was restricted for policy reasons. Contact support if you believe this is an error.</p>
        <p class="owner-reason">${escapeHtml(reason)}</p>
        <button type="button" class="btn btn-ghost btn-block" data-action="signout">Sign out</button>
      </div>
    </div>`;
  root.querySelector("[data-action=signout]")?.addEventListener("click", onSignOut);
}

/** Trial/subscription pause — admin/showroom paused; account stays open to resubscribe. */
export function renderTrialSuspendedAccount(
  root: HTMLElement,
  requiredPlan: string,
  handlers: {
    onAccount: () => void;
    onSignOut: () => void;
    actionVerb?: "Subscribe" | "Upgrade";
    title?: string;
    body?: string;
  },
): void {
  const verb = handlers.actionVerb ?? "Subscribe";
  const title = handlers.title ?? "Trial ended";
  const body =
    handlers.body ??
    `Your trial has ended. ${verb} to ${requiredPlan} to restore your showroom, model uploads, and admin dashboard.`;
  root.innerHTML = `
    <div class="home ar-landing-page">
      <div class="ar-landing-card ar-landing-card--warn">
        <p class="mkt-eyebrow">Service paused</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="home-sub">${escapeHtml(body)}</p>
        <button type="button" class="btn btn-primary btn-block" data-action="account">${escapeHtml(verb)} on Account</button>
        <button type="button" class="btn btn-ghost btn-block" data-action="signout">Sign out</button>
      </div>
    </div>`;
  root.querySelector("[data-action=account]")?.addEventListener("click", handlers.onAccount);
  root.querySelector("[data-action=signout]")?.addEventListener("click", handlers.onSignOut);
}

export type { CatalogModel };

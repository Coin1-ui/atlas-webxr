import { escapeHtml } from "../shared/escape-html";
import type { CatalogModel } from "../data/model-catalog";
import { DEFAULT_TENANT_ACCENT } from "../shared/brand-defaults";
import { bindModelIconFallbacks } from "../shared/model-icon";
import { MKT } from "./marketing-copy";

export type TenantCatalogHandlers = {
  onViewInAr: (record: CatalogModel) => void;
  onAccount?: () => void;
  onAdmin?: () => void;
  onSignOut?: () => void;
  onBack?: () => void;
};

export type TenantCatalogOptions = {
  /** Safari AR path — show placement steps instead of Android floor-ring hints. */
  iosSafariAr?: boolean;
};

export type TenantCatalogBranding = {
  workspaceName: string;
  logoUrl?: string;
  accentColor?: string;
};

export function renderTenantCatalog(
  root: HTMLElement,
  branding: TenantCatalogBranding,
  catalog: CatalogModel[],
  iconForRecord: (record: CatalogModel) => string,
  handlers: TenantCatalogHandlers,
  options: TenantCatalogOptions = {},
): void {
  const accent = branding.accentColor?.trim() || DEFAULT_TENANT_ACCENT;
  const hasItems = catalog.length > 0;
  const iosAr = options.iosSafariAr === true;
  const heroLead = iosAr
    ? "Tap <strong>View in AR</strong> — Safari AR opens. Move your phone to find the floor, then tap to place."
    : "Tap <strong>View in AR</strong> to place any piece on your floor at true scale — no app install.";
  const heroBadges = iosAr
    ? `<ul class="catalog-hero-badges" aria-label="Safari AR tips">
          <li>Tap model → Safari AR opens</li>
          <li>Move phone slowly over the floor</li>
          <li>Tap screen to place</li>
        </ul>`
    : `<ul class="catalog-hero-badges" aria-label="AR tips">
          <li>Cyan ring = placeable</li>
          <li>Red = blocked</li>
          <li>True floor scale</li>
        </ul>`;

  root.innerHTML = `
    <div class="catalog-page catalog-page--v2" style="--tenant-accent: ${escapeHtml(accent)}">
      <header class="catalog-header">
        <div class="catalog-brand">
          ${
            branding.logoUrl
              ? `<img class="catalog-logo" src="${escapeHtml(branding.logoUrl)}" alt="" />`
              : `<div class="catalog-logo-placeholder" aria-hidden="true">${escapeHtml(branding.workspaceName.slice(0, 1).toUpperCase())}</div>`
          }
          <div>
            <p class="catalog-eyebrow">Showroom</p>
            <h1>${escapeHtml(branding.workspaceName)}</h1>
          </div>
        </div>
        <div class="catalog-header-actions">
          ${handlers.onBack ? `<button type="button" class="catalog-admin-link catalog-admin-link-secondary" data-action="back">Back</button>` : ""}
          ${handlers.onAccount ? `<button type="button" class="catalog-admin-link" data-action="account">Account</button>` : ""}
          ${handlers.onAdmin ? `<button type="button" class="catalog-admin-link catalog-admin-link-secondary" data-action="admin">Admin</button>` : ""}
          ${handlers.onSignOut ? `<button type="button" class="catalog-admin-link catalog-admin-link-secondary" data-action="signout">Sign out</button>` : ""}
        </div>
      </header>

      <section class="catalog-hero catalog-hero--v2">
        <div class="catalog-hero-copy">
          <h2>Browse the collection</h2>
          <p>${heroLead}</p>
        </div>
        ${heroBadges}
      </section>

      ${
        hasItems
          ? `<div class="catalog-grid catalog-grid--v2" role="list">
        ${catalog
          .map(
            (record, index) => `
          <article class="catalog-card catalog-card--v2" role="listitem" data-index="${index}">
            <div class="catalog-card-media">
              <img src="${escapeHtml(iconForRecord(record))}" alt="" loading="lazy" />
              <span class="catalog-card-badge">AR ready</span>
            </div>
            <div class="catalog-card-body">
              <h3>${escapeHtml(record.name || record.id)}</h3>
              <p class="catalog-card-meta">Floor placement · browser AR</p>
              <button type="button" class="catalog-btn-ar catalog-btn-ar--v2" data-action="ar" data-index="${index}">View in AR</button>
            </div>
          </article>
        `,
          )
          .join("")}
      </div>`
          : `<div class="catalog-empty catalog-empty--v2" role="status">
        <p class="catalog-empty-title">Showroom is being set up</p>
        <p class="catalog-empty-body">Your team uploads 3D models from the desktop admin dashboard. Once the first model is live, <strong>View in AR</strong> buttons appear here — shoppers open this link on Chrome or Safari with no app install.</p>
        ${handlers.onAdmin ? `<button type="button" class="catalog-btn-ar catalog-btn-ar--v2" data-action="admin">Open admin to upload</button>` : `<p class="catalog-empty-hint">Check back soon — your associate will share this link when models are ready.</p>`}
      </div>`
      }

      <footer class="catalog-footer catalog-footer--v2">
        <ul class="catalog-trust">
          <li>${MKT.catalogTrust1}</li>
          <li>${MKT.catalogTrust2}</li>
          <li>${MKT.catalogTrust3}</li>
          <li>${MKT.catalogTrust4}</li>
        </ul>
        <p class="catalog-powered">Powered by <strong>Atlas AR</strong></p>
      </footer>
    </div>
  `;

  bindModelIconFallbacks(root);

  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest("[data-action]");
    if (!el) return;
    const action = el.getAttribute("data-action");
    if (action === "back") handlers.onBack?.();
    if (action === "account") handlers.onAccount?.();
    if (action === "admin") handlers.onAdmin?.();
    if (action === "signout") handlers.onSignOut?.();
    if (action === "ar") {
      const idx = Number(el.getAttribute("data-index"));
      const record = catalog[idx];
      if (record) handlers.onViewInAr(record);
    }
  };
}

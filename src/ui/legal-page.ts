import { escapeHtml } from "../shared/escape-html";
import { MKT_ASSETS } from "./marketing-assets";
import { marketingFooterLegalHtml, marketingNavHtml, bindMarketingNav, type MarketingNavHandlers } from "./marketing-nav";
import { LEGAL_DOCS, type LegalDocId } from "./legal-content";

export type LegalPageHandlers = MarketingNavHandlers & {
  onLegal?: (id: LegalDocId) => void;
  signedIn?: boolean;
  workspaceName?: string;
  mobileExperience?: boolean;
};

function renderSections(doc: (typeof LEGAL_DOCS)[LegalDocId]): string {
  return doc.sections
    .map(
      (s) => `
      <section class="legal-section" id="${escapeHtml(s.id)}">
        <h2>${escapeHtml(s.title)}</h2>
        ${s.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        ${
          s.bullets?.length
            ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
            : ""
        }
      </section>`,
    )
    .join("");
}

export function renderLegalPage(root: HTMLElement, docId: LegalDocId, handlers: LegalPageHandlers): void {
  const doc = LEGAL_DOCS[docId];
  const mobile = Boolean(handlers.mobileExperience);

  root.innerHTML = `
    <div class="mkt-page legal-page">
      <div class="mkt-bg" style="background-image: url('${MKT_ASSETS.heroBg}')"></div>
      <div class="mkt-bg-vignette" aria-hidden="true"></div>
      ${marketingNavHtml(handlers, {
        mobileExperience: mobile,
        signedIn: handlers.signedIn,
        workspaceName: handlers.workspaceName,
      })}
      <article class="legal-doc">
        <header class="legal-doc-header">
          <p class="mkt-eyebrow">Legal</p>
          <h1>${escapeHtml(doc.title)}</h1>
          <p class="legal-effective">Effective ${escapeHtml(doc.effectiveDate)}</p>
          <p class="legal-intro">${escapeHtml(doc.intro)}</p>
        </header>
        ${renderSections(doc)}
        <footer class="legal-disclaimer">
          <p><strong>Important:</strong> ${escapeHtml(doc.disclaimer)}</p>
        </footer>
        <nav class="legal-doc-nav" aria-label="Other policies">
          ${docId !== "terms" ? `<button type="button" class="mkt-nav-link" data-action="legal-terms">Terms of Service</button>` : ""}
          ${docId !== "privacy" ? `<button type="button" class="mkt-nav-link" data-action="legal-privacy">Privacy Policy</button>` : ""}
          ${docId !== "acceptable-use" ? `<button type="button" class="mkt-nav-link" data-action="legal-aup">Acceptable Use</button>` : ""}
          <button type="button" class="mkt-nav-link" data-action="home">← Back to home</button>
        </nav>
      </article>
      <footer class="mkt-footer">
        ${marketingFooterLegalHtml()}
      </footer>
    </div>
  `;

  bindMarketingNav(root, handlers, {
    onLegalTerms: () => handlers.onLegal?.("terms"),
    onLegalPrivacy: () => handlers.onLegal?.("privacy"),
    onLegalAup: () => handlers.onLegal?.("acceptable-use"),
  });
}

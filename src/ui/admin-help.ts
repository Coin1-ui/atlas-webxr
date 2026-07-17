import type { Workspace } from "../shared/tenant";

import { brandedHeaderHtml, mountWorkspaceLogo } from "../branding/workspace-theme";

import { ADMIN_HELP_SECTIONS } from "./admin-help-content";

import { MKT } from "./marketing-copy";

import { MKT_ASSETS } from "./marketing-assets";

import { beginNavTransition } from "./nav-loading";



function escapeHtml(s: string): string {

  return s

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;");

}



function scrollHelpSection(sectionId: string): void {

  const section = document.getElementById(sectionId);

  if (!section) return;

  section.scrollIntoView({ behavior: "smooth", block: "start" });

}



export function renderAdminHelp(

  root: HTMLElement,

  workspace: Workspace,

  handlers: {

    showroomPath: string;

    onGetStarted: () => void;

    onManageModels: () => void;

    onBack: () => void;

  },

): void {

  const sections = ADMIN_HELP_SECTIONS.map(

    (s) => `

      <section class="admin-help-section" id="help-${escapeHtml(s.id)}">

        <h2 class="admin-section-title">${escapeHtml(s.title)}</h2>

        ${s.paragraphs.map((p) => `<p class="auth-hint admin-help-p">${escapeHtml(p)}</p>`).join("")}

        ${

          s.bullets?.length

            ? `<ul class="admin-help-list">${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`

            : ""

        }

        ${s.tip ? `<p class="admin-help-tip">${escapeHtml(s.tip)}</p>` : ""}

      </section>`,

  ).join("");



  root.innerHTML = `

    <div class="admin-shell admin-help-shell">

      <div class="admin-shell-hero" style="background-image: url('${MKT_ASSETS.authWorkspace}')" aria-hidden="true">

        <div class="admin-shell-hero-overlay"></div>

      </div>

      <div class="admin-shell-body">

        <div class="admin-shell-card admin-help-card">

          ${brandedHeaderHtml("Admin help", `${workspace.name} · ${MKT.onboardingTarget}`)}



          <nav class="admin-help-toc" aria-label="Help topics">

            ${ADMIN_HELP_SECTIONS.map(

              (s) =>

                `<button type="button" class="admin-help-toc-link" data-action="help-toc" data-target="help-${escapeHtml(s.id)}">${escapeHtml(s.title)}</button>`,

            ).join("")}

          </nav>



          <div class="admin-card admin-card-highlight admin-help-quick">

            <p class="admin-label">Your showroom link</p>

            <code class="admin-code">${escapeHtml(handlers.showroomPath)}</code>

          </div>



          ${sections}



          <div class="admin-footer-actions">

            <button type="button" class="mkt-btn mkt-btn-primary" data-action="get-started">Open setup wizard</button>

            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="models">Manage 3D models</button>

            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="back">← Back to admin</button>

          </div>

        </div>

      </div>

    </div>`;



  mountWorkspaceLogo(root, workspace.slug, workspace.branding);



  root.querySelector("[data-action=get-started]")?.addEventListener("click", (e) => {

    beginNavTransition(e.currentTarget as HTMLElement);

    handlers.onGetStarted();

  });

  root.querySelector("[data-action=models]")?.addEventListener("click", (e) => {

    beginNavTransition(e.currentTarget as HTMLElement);

    handlers.onManageModels();

  });

  root.querySelector("[data-action=back]")?.addEventListener("click", (e) => {

    beginNavTransition(e.currentTarget as HTMLElement);

    handlers.onBack();

  });



  for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-action=help-toc]")) {

    btn.addEventListener("click", (e) => {

      e.preventDefault();

      const target = btn.getAttribute("data-target");

      if (!target) return;

      beginNavTransition(btn);

      scrollHelpSection(target);

    });

  }

}



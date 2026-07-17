import {
  TRAINING_FOLLOWUP,
  TRAINING_INTRO,
  TRAINING_MODULES,
} from "./training-slides.js";
import { loadSalesDeckActive, renderSalesDeckInactive } from "./deck-access.js";

const STORAGE_KEY = "atlas-sal3-training";
const PERSONA_KEY = "atlas-sal3-persona";

const $ = (sel, root = document) => root.querySelector(sel);

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function saveProgress(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
}

function loadPersona() {
  return localStorage.getItem(PERSONA_KEY) || "general";
}

function savePersona(value) {
  localStorage.setItem(PERSONA_KEY, value);
}

class SalesTraining {
  constructor() {
    this.index = -1; // -1 intro, 0-9 modules, 10 follow-up
    this.progress = loadProgress();
    this.persona = loadPersona();

    this.main = $("#training-main");
    this.progressFill = $("#training-progress-fill");
    this.progressLabel = $("#training-progress-label");
    this.lessonList = $("#training-lesson-list");
    this.personaSelect = $("#training-persona");

    this.buildLessonList();
    this.personaSelect.value = this.persona;
    this.personaSelect.addEventListener("change", () => {
      this.persona = this.personaSelect.value;
      savePersona(this.persona);
      this.render();
    });

    this.bindEvents();

    const hash = parseInt(location.hash.replace("#", ""), 10);
    if (hash === 0) this.go(-1);
    else if (hash >= 1 && hash <= TRAINING_MODULES.length) this.go(hash - 1);
    else if (hash === 11) this.go(TRAINING_MODULES.length);
    else this.go(-1);
  }

  buildLessonList() {
    this.lessonList.innerHTML = TRAINING_MODULES.map(
      (m, i) => `
      <li>
        <button type="button" class="training-lesson-btn" data-lesson="${i}">
          <span class="lesson-num">${m.slideId}</span>
          <span class="lesson-title">${esc(m.title)}</span>
        </button>
      </li>`,
    ).join("");

    this.lessonList.querySelectorAll("[data-lesson]").forEach((btn) => {
      btn.addEventListener("click", () => this.go(Number(btn.getAttribute("data-lesson"))));
    });
    this.lessonBtns = [...this.lessonList.querySelectorAll(".training-lesson-btn")];
  }

  bindEvents() {
    $("#btn-prev")?.addEventListener("click", () => this.prev());
    $("#btn-next")?.addEventListener("click", () => this.next());
    $("#btn-reset")?.addEventListener("click", () => {
      if (window.confirm("Reset all practiced checkpoints?")) {
        this.progress = [];
        saveProgress([]);
        this.updateProgressUi();
        this.render();
      }
    });
    $("#btn-help")?.addEventListener("click", () => $("#training-help")?.classList.add("open"));
    $("#btn-help-close")?.addEventListener("click", () => $("#training-help")?.classList.remove("open"));

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select")) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        this.next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.prev();
      } else if (e.key === "?") $("#training-help")?.classList.toggle("open");
      else if (e.key === "Escape") $("#training-help")?.classList.remove("open");
    });
  }

  practicedCount() {
    return TRAINING_MODULES.filter((m) => this.progress.includes(m.slideId)).length;
  }

  updateProgressUi() {
    const done = this.practicedCount();
    const total = TRAINING_MODULES.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    this.progressFill.style.width = `${pct}%`;
    this.progressLabel.textContent = `${done} / ${total} lessons practiced`;

    this.lessonBtns.forEach((btn, i) => {
      const mod = TRAINING_MODULES[i];
      const active = this.index === i;
      btn.classList.toggle("active", active);
      btn.classList.toggle("done", this.progress.includes(mod.slideId));
    });
  }

  shouldSkipModule(mod) {
    if (mod.personaBranch === "retail" && this.persona === "field") return true;
    if (mod.personaBranch === "field" && this.persona === "retail") return true;
    return false;
  }

  renderIntro() {
    this.main.innerHTML = `
      <article class="training-panel training-intro-card">
        <p class="mkt-eyebrow" style="color:var(--accent);font-size:0.75rem;margin-bottom:8px">SAL-3 · Batch 25</p>
        <h1>${esc(TRAINING_INTRO.title)}</h1>
        <p class="training-deck-ref">${esc(TRAINING_INTRO.subtitle)}</p>
        <p>Use this module to rehearse the presenter script slide-by-slide. Mark each lesson <strong>Practiced aloud</strong> when your manager or peer has heard you deliver it.</p>
        <h3 style="margin-top:20px;font-size:0.85rem;color:var(--muted)">Before you start</h3>
        <ul class="training-checklist">
          ${TRAINING_INTRO.checklist.map((c) => `<li>${esc(c)}</li>`).join("")}
        </ul>
        <div class="training-actions">
          <a class="deck-btn" href="./index.html" target="_blank" rel="noopener">Open sales deck ↗</a>
          <a class="deck-btn deck-btn-outreach" href="./outreach.html">SAL-2 outreach</a>
          <button type="button" class="deck-btn deck-btn-primary" id="btn-start">Start lesson 1 →</button>
        </div>
      </article>`;
    $("#btn-start")?.addEventListener("click", () => this.go(0));
  }

  renderFollowUp() {
    this.main.innerHTML = `
      <article class="training-panel training-followup-card">
        <h1>${esc(TRAINING_FOLLOWUP.title)}</h1>
        <p class="training-deck-ref">Complete the walkthrough — send within 24 hours of every call.</p>
        <p><strong>Subject:</strong> ${esc(TRAINING_FOLLOWUP.subject)}</p>
        <pre>${esc(TRAINING_FOLLOWUP.body)}</pre>
        <div class="training-actions">
          <button type="button" class="deck-btn" id="btn-back-lesson">← Lesson 10</button>
          <a class="deck-btn deck-btn-primary" href="./index.html#10" target="_blank" rel="noopener">Review CTA slide ↗</a>
        </div>
      </article>`;
    $("#btn-back-lesson")?.addEventListener("click", () => this.go(TRAINING_MODULES.length - 1));
  }

  renderModule(mod) {
    if (this.shouldSkipModule(mod)) {
      this.main.innerHTML = `
        <article class="training-panel">
          <div class="training-module-header">
            <h1>Slide ${mod.slideId} — optional for your persona</h1>
          </div>
          <div class="training-block branch-note">
            <h3>Persona branch</h3>
            <p>You selected <strong>${esc(this.persona)}</strong>. This lesson targets the other ICP track. Skim for awareness or skip to the next lesson.</p>
            <p class="persona-skip-hint">Retail reps focus on slide 5 · Field reps focus on slide 6.</p>
          </div>
          <div class="training-actions">
            <label class="training-check">
              <input type="checkbox" data-practiced="${mod.slideId}" ${this.progress.includes(mod.slideId) ? "checked" : ""} />
              Skimmed / practiced
            </label>
            <div class="training-nav-row">
              <button type="button" class="deck-btn" id="btn-mod-prev">← Previous</button>
              <button type="button" class="deck-btn deck-btn-primary" id="btn-mod-next">Next →</button>
            </div>
          </div>
        </article>`;
      this.wireModuleActions(mod);
      return;
    }

    const demoBlock = mod.demo
      ? `<div class="training-block demo">
          <h3>Live demo beat</h3>
          <ol>${mod.demoSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        </div>`
      : "";

    const objectionBlock = mod.objection
      ? `<div class="training-block objection"><h3>If they push back</h3><p>${esc(mod.objection)}</p></div>`
      : "";

    const coachBlock = mod.coach
      ? `<div class="training-block coach"><h3>Coach note</h3><p>${esc(mod.coach)}</p></div>`
      : "";

    const transitionBlock = mod.transition
      ? `<div class="training-block transition"><h3>Transition</h3><p>${esc(mod.transition)}</p></div>`
      : "";

    this.main.innerHTML = `
      <article class="training-panel">
        <div class="training-module-header">
          <div>
            <p class="mkt-eyebrow" style="color:var(--accent);font-size:0.72rem;margin-bottom:6px">Lesson ${mod.slideId} of ${TRAINING_MODULES.length}</p>
            <h1>${esc(mod.title)}</h1>
          </div>
          <div class="training-badges">
            <span class="training-badge accent">⏱ ${esc(mod.timing)}</span>
            ${mod.personaBranch ? `<span class="training-badge warm">${esc(mod.personaBranch)} track</span>` : ""}
            ${mod.demo ? `<span class="training-badge accent">Demo</span>` : ""}
          </div>
        </div>
        <p class="training-deck-ref">Deck slide: <em>${esc(mod.deckHeadline)}</em> · <a href="./index.html#${mod.slideId}" target="_blank" rel="noopener">Open slide ${mod.slideId} ↗</a></p>

        <div class="training-block ask">
          <h3>Discovery — ask first</h3>
          <p>${esc(mod.ask)}</p>
        </div>

        <div class="training-block say">
          <h3>Say — presenter script</h3>
          ${mod.say.map((p) => `<p>${esc(p)}</p>`).join("")}
        </div>

        ${objectionBlock}
        ${demoBlock}
        ${coachBlock}
        ${transitionBlock}

        <div class="training-actions">
          <label class="training-check">
            <input type="checkbox" data-practiced="${mod.slideId}" ${this.progress.includes(mod.slideId) ? "checked" : ""} />
            Practiced aloud
          </label>
          <a class="deck-btn" href="./index.html#${mod.slideId}" target="_blank" rel="noopener">View deck slide</a>
          <div class="training-nav-row">
            <button type="button" class="deck-btn" id="btn-mod-prev">← Previous</button>
            <button type="button" class="deck-btn deck-btn-primary" id="btn-mod-next">Next →</button>
          </div>
        </div>
      </article>`;
    this.wireModuleActions(mod);
  }

  wireModuleActions(mod) {
    const cb = this.main.querySelector("[data-practiced]");
    cb?.addEventListener("change", () => {
      const id = mod.slideId;
      if (cb.checked) {
        if (!this.progress.includes(id)) this.progress.push(id);
      } else {
        this.progress = this.progress.filter((x) => x !== id);
      }
      saveProgress(this.progress);
      this.updateProgressUi();
    });
    $("#btn-mod-prev")?.addEventListener("click", () => this.prev());
    $("#btn-mod-next")?.addEventListener("click", () => this.next());
  }

  render() {
    this.updateProgressUi();
    if (this.index < 0) {
      this.renderIntro();
      history.replaceState(null, "", "#0");
      return;
    }
    if (this.index >= TRAINING_MODULES.length) {
      this.renderFollowUp();
      history.replaceState(null, "", "#11");
      return;
    }
    this.renderModule(TRAINING_MODULES[this.index]);
    history.replaceState(null, "", `#${this.index + 1}`);
  }

  go(i) {
    const max = TRAINING_MODULES.length;
    this.index = Math.max(-1, Math.min(max, i));
    this.render();
  }

  next() {
    if (this.index < TRAINING_MODULES.length) this.go(this.index + 1);
  }

  prev() {
    if (this.index > -1) this.go(this.index - 1);
  }
}

async function bootTraining() {
  const active = await loadSalesDeckActive();
  if (!active) {
    renderSalesDeckInactive();
    return;
  }
  new SalesTraining();
}

void bootTraining();

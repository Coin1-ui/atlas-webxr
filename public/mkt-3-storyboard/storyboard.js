import { STORY_CUTS, GLOBAL_MESSAGING, PRODUCTION_CHECKLIST } from "./frames.js";
import { loadMkt3StoryboardActive, renderStoryboardInactive } from "./storyboard-access.js";

const STORAGE_KEY = "atlas-mkt3-storyboard-v1";

/** @typedef {{ cutId: string; frameIndex: number; view: "grid" | "detail"; planned: Record<string, boolean> }} StoryboardState */

/** @returns {StoryboardState} */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        cutId: parsed.cutId || STORY_CUTS[0].id,
        frameIndex: Number(parsed.frameIndex) || 0,
        view: parsed.view === "detail" ? "detail" : "grid",
        planned: parsed.planned && typeof parsed.planned === "object" ? parsed.planned : {},
      };
    }
  } catch {
    /* ignore */
  }
  return { cutId: STORY_CUTS[0].id, frameIndex: 0, view: "grid", planned: {} };
}

/** @param {StoryboardState} state */
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function allFrames() {
  return STORY_CUTS.flatMap((cut) => cut.frames.map((f) => ({ ...f, cutId: cut.id, cutTitle: cut.title })));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

class Mkt3Storyboard {
  /** @param {StoryboardState} initial */
  constructor(initial) {
    /** @type {StoryboardState} */
    this.state = initial;
    this.cutListEl = document.getElementById("sb-cut-list");
    this.mainEl = document.getElementById("sb-main");
    this.progressLabel = document.getElementById("sb-progress-label");
    this.progressFill = document.getElementById("sb-progress-fill");
    this.bindToolbar();
    this.render();
  }

  getCut() {
    return STORY_CUTS.find((c) => c.id === this.state.cutId) || STORY_CUTS[0];
  }

  getFrame() {
    const cut = this.getCut();
    const idx = Math.max(0, Math.min(this.state.frameIndex, cut.frames.length - 1));
    return cut.frames[idx];
  }

  bindToolbar() {
    document.getElementById("btn-prev")?.addEventListener("click", () => this.prev());
    document.getElementById("btn-next")?.addEventListener("click", () => this.next());
    document.getElementById("btn-reset")?.addEventListener("click", () => {
      if (window.confirm("Reset all shot progress?")) {
        this.state.planned = {};
        this.state.frameIndex = 0;
        saveState(this.state);
        this.render();
      }
    });
    document.getElementById("btn-print")?.addEventListener("click", () => window.print());
    document.getElementById("btn-help")?.addEventListener("click", () => {
      document.getElementById("sb-help")?.classList.add("open");
    });
    document.getElementById("btn-help-close")?.addEventListener("click", () => {
      document.getElementById("sb-help")?.classList.remove("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        this.next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.prev();
      } else if (e.key === "Escape") {
        document.getElementById("sb-help")?.classList.remove("open");
      }
    });
  }

  prev() {
    const cut = this.getCut();
    if (this.state.view === "detail" && this.state.frameIndex > 0) {
      this.state.frameIndex -= 1;
    } else if (this.state.view === "detail" && this.state.frameIndex === 0) {
      this.state.view = "grid";
    } else {
      const cutIdx = STORY_CUTS.findIndex((c) => c.id === this.state.cutId);
      if (cutIdx > 0) {
        this.state.cutId = STORY_CUTS[cutIdx - 1].id;
        this.state.frameIndex = STORY_CUTS[cutIdx - 1].frames.length - 1;
        this.state.view = "detail";
      }
      saveState(this.state);
      this.render();
      return;
    }
    saveState(this.state);
    this.render();
  }

  next() {
    const cut = this.getCut();
    if (this.state.view === "grid") {
      this.state.view = "detail";
      this.state.frameIndex = 0;
    } else if (this.state.frameIndex < cut.frames.length - 1) {
      this.state.frameIndex += 1;
    } else {
      const cutIdx = STORY_CUTS.findIndex((c) => c.id === this.state.cutId);
      if (cutIdx < STORY_CUTS.length - 1) {
        this.state.cutId = STORY_CUTS[cutIdx + 1].id;
        this.state.frameIndex = 0;
      }
    }
    saveState(this.state);
    this.render();
  }

  selectCut(cutId) {
    this.state.cutId = cutId;
    this.state.frameIndex = 0;
    this.state.view = "grid";
    saveState(this.state);
    this.render();
  }

  selectFrame(index) {
    this.state.frameIndex = index;
    this.state.view = "detail";
    saveState(this.state);
    this.render();
  }

  togglePlanned(frameId) {
    this.state.planned[frameId] = !this.state.planned[frameId];
    saveState(this.state);
    this.render();
  }

  updateProgress() {
    const total = allFrames().length;
    const done = Object.values(this.state.planned).filter(Boolean).length;
    if (this.progressLabel) {
      this.progressLabel.textContent = `${done} / ${total} shots planned`;
    }
    if (this.progressFill) {
      this.progressFill.style.width = total ? `${(done / total) * 100}%` : "0%";
    }
  }

  renderSidebar() {
    if (!this.cutListEl) return;
    this.cutListEl.innerHTML = STORY_CUTS.map(
      (cut) => `
      <button type="button" class="sb-cut-btn ${cut.id === this.state.cutId ? "active" : ""}" data-cut="${cut.id}">
        <strong>${escapeHtml(cut.title)}</strong>
        <span>${escapeHtml(cut.duration)} · ${cut.frames.length} shots</span>
      </button>`,
    ).join("");
    this.cutListEl.querySelectorAll("[data-cut]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-cut");
        if (id) this.selectCut(id);
      });
    });
  }

  renderGrid(cut) {
    return `
      <header class="sb-cut-header">
        <h1>${escapeHtml(cut.title)}</h1>
        <dl class="sb-cut-meta">
          <dt>Platform</dt><dd>${escapeHtml(cut.platform)}</dd>
          <dt>Duration</dt><dd>${escapeHtml(cut.duration)}</dd>
          <dt>Aspect</dt><dd>${escapeHtml(cut.aspect)}</dd>
          <dt>Use</dt><dd>${escapeHtml(cut.use)}</dd>
        </dl>
      </header>
      <div class="sb-view-toggle">
        <button type="button" class="sb-view-btn active" data-view="grid">Grid view</button>
        <button type="button" class="sb-view-btn" data-view="detail">Frame detail →</button>
      </div>
      <div class="sb-frame-grid">
        ${cut.frames
          .map(
            (frame, i) => `
          <article class="sb-frame-card ${this.state.planned[frame.id] ? "planned" : ""}" data-frame="${i}">
            <div class="sb-frame-thumb-wrap ${frame.aspect === "9:16" ? "portrait" : ""}">
              <img class="sb-frame-thumb" src="${escapeHtml(frame.thumb)}" alt="" loading="lazy" onerror="this.src='../sales-deck/assets/slide-04-how-it-works.png'" />
              <span class="sb-frame-badge">${escapeHtml(frame.time)}</span>
            </div>
            <div class="sb-frame-body">
              <div class="sb-frame-time">${escapeHtml(frame.shotType || "Shot")}</div>
              <p class="sb-frame-visual">${escapeHtml(frame.visual)}</p>
              <div class="sb-frame-tags">
                ${frame.aspect ? `<span class="sb-tag">${escapeHtml(frame.aspect)}</span>` : ""}
                ${frame.onScreen ? `<span class="sb-tag">OS: ${escapeHtml(frame.onScreen)}</span>` : ""}
              </div>
            </div>
          </article>`,
          )
          .join("")}
      </div>
      ${
        cut.id === "a1"
          ? `
      <section class="sb-checklist">
        <h3>Global messaging</h3>
        <ul>
          <li><strong>Hook:</strong> ${escapeHtml(GLOBAL_MESSAGING.hook)}</li>
          <li><strong>Promise:</strong> ${escapeHtml(GLOBAL_MESSAGING.promise)}</li>
          <li><strong>Avoid:</strong> ${escapeHtml(GLOBAL_MESSAGING.avoid)}</li>
        </ul>
      </section>
      <section class="sb-checklist">
        <h3>Production checklist</h3>
        <ul>${PRODUCTION_CHECKLIST.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>`
          : ""
      }`;
  }

  renderDetail(cut, frame, frameIndex) {
    const portrait = frame.aspect === "9:16";
    return `
      <header class="sb-cut-header">
        <h1>${escapeHtml(cut.title)}</h1>
        <p class="sb-detail-shot">${escapeHtml(cut.subtitle)} · Frame ${frameIndex + 1} of ${cut.frames.length}</p>
      </header>
      <div class="sb-view-toggle">
        <button type="button" class="sb-view-btn" data-view="grid">← Grid view</button>
        <button type="button" class="sb-view-btn active" data-view="detail">Frame detail</button>
      </div>
      <div class="sb-detail">
        <div class="sb-detail-thumb ${portrait ? "portrait" : ""}">
          <img src="${escapeHtml(frame.thumb)}" alt="" onerror="this.src='../sales-deck/assets/slide-04-how-it-works.png'" />
        </div>
        <div class="sb-detail-copy">
          <h2>${escapeHtml(frame.time)}</h2>
          <p class="sb-detail-shot">${escapeHtml(frame.shotType || "Shot")}${frame.aspect ? ` · ${frame.aspect}` : ""}</p>
          <div class="sb-field">
            <label>Visual</label>
            <p>${escapeHtml(frame.visual)}</p>
          </div>
          <div class="sb-field vo">
            <label>Voiceover</label>
            <p>${escapeHtml(frame.vo)}</p>
          </div>
          ${
            frame.onScreen
              ? `<div class="sb-field"><label>On-screen text</label><p><span class="sb-onscreen">${escapeHtml(frame.onScreen)}</span></p></div>`
              : ""
          }
          ${
            frame.notes
              ? `<div class="sb-field"><label>Notes</label><p>${escapeHtml(frame.notes)}</p></div>`
              : ""
          }
          <label class="sb-planned-toggle">
            <input type="checkbox" data-planned="${escapeHtml(frame.id)}" ${this.state.planned[frame.id] ? "checked" : ""} />
            <span>Shot planned / blocked on set</span>
          </label>
        </div>
      </div>
      <div class="sb-frame-nav">
        <button type="button" class="deck-btn" id="btn-detail-prev">← Previous</button>
        <span class="sb-frame-counter">${frameIndex + 1} / ${cut.frames.length}</span>
        <button type="button" class="deck-btn deck-btn-primary" id="btn-detail-next">Next →</button>
      </div>`;
  }

  render() {
    this.renderSidebar();
    this.updateProgress();
    const cut = this.getCut();
    if (!this.mainEl) return;

    if (this.state.view === "detail") {
      const frameIndex = Math.max(0, Math.min(this.state.frameIndex, cut.frames.length - 1));
      this.state.frameIndex = frameIndex;
      const frame = cut.frames[frameIndex];
      this.mainEl.innerHTML = this.renderDetail(cut, frame, frameIndex);
    } else {
      this.mainEl.innerHTML = this.renderGrid(cut);
    }

    this.mainEl.querySelectorAll("[data-frame]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.getAttribute("data-frame"));
        if (!Number.isNaN(idx)) this.selectFrame(idx);
      });
    });

    this.mainEl.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-view");
        if (view === "grid") {
          this.state.view = "grid";
          saveState(this.state);
          this.render();
        } else if (view === "detail") {
          this.state.view = "detail";
          this.state.frameIndex = 0;
          saveState(this.state);
          this.render();
        }
      });
    });

    this.mainEl.querySelector("[data-planned]")?.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-planned");
      if (id) this.togglePlanned(id);
    });

    document.getElementById("btn-detail-prev")?.addEventListener("click", () => this.prev());
    document.getElementById("btn-detail-next")?.addEventListener("click", () => this.next());
  }
}

async function boot() {
  const active = await loadMkt3StoryboardActive();
  if (!active) {
    renderStoryboardInactive();
    return;
  }
  new Mkt3Storyboard(loadState());
}

boot();

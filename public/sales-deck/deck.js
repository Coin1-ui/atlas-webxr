import { SLIDES } from "./slides.js";
import { loadSalesDeckActive, renderSalesDeckInactive } from "./deck-access.js";

/** No-op WebGL so slides still render if Three.js fails to load. */
class NullDeckWebGL {
  setMode() {}
  dispose() {}
}

async function createDeckWebGL(canvas) {
  if (!canvas) return new NullDeckWebGL();
  try {
    const { DeckWebGL } = await import("./webgl.js");
    return new DeckWebGL(canvas);
  } catch (err) {
    console.warn("[sales-deck] WebGL background unavailable:", err);
    return new NullDeckWebGL();
  }
}

const $ = (sel, root = document) => root.querySelector(sel);

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlight(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderBullets(items) {
  return `<ul class="slide-bullets">${items.map((b) => `<li>${highlight(b)}</li>`).join("")}</ul>`;
}

function renderSlide(slide) {
  const bg = slide.image
    ? `<div class="slide-bg" style="background-image:url('${esc(slide.image)}')"></div>`
    : "";

  const footer = `
    <div class="slide-footer">
      <div class="logo-wordmark">Atlas <span>AR</span></div>
      <div>${slide.id} / ${SLIDES.length}</div>
    </div>`;

  let body = "";

  switch (slide.template) {
    case "title":
      body = `
        <div class="slide-inner slide-title">
          <h1 class="slide-headline">${esc(slide.headline)} <em>${esc(slide.headlineEm)}</em></h1>
          <p class="slide-subhead">${esc(slide.subhead)}</p>
        </div>`;
      break;

    case "problem":
      body = `
        <div class="slide-inner slide-problem">
          <h2 class="slide-headline">${esc(slide.headline)}</h2>
          <div class="slide-body">${renderBullets(slide.bullets)}</div>
        </div>`;
      break;

    case "solution":
      body = `
        <div class="slide-inner slide-solution">
          <div class="slide-body">
            <div class="slide-copy">
              <h2 class="slide-headline">${esc(slide.headline)}</h2>
              ${renderBullets(slide.bullets)}
            </div>
            <img class="slide-hero-img" src="${esc(slide.image)}" alt="" loading="lazy" />
          </div>
        </div>`;
      break;

    case "steps":
      body = `
        <div class="slide-inner slide-steps">
          <h2 class="slide-headline">${esc(slide.headline)}</h2>
          <div class="slide-body">
            <div class="step-cards">
              ${slide.steps
                .map(
                  (s) => `
                <article class="step-card">
                  <div class="step-num">${s.num}</div>
                  <h3>${esc(s.title)}</h3>
                  <p>${esc(s.detail)}</p>
                </article>`
                )
                .join("")}
            </div>
            ${
              slide.demoLink
                ? `<p class="slide-demo-cta"><a class="deck-btn" href="${esc(slide.demoLink)}" target="_blank" rel="noopener">Watch product demo ↗</a></p>`
                : ""
            }
          </div>
        </div>`;
      break;

    case "icp-image":
      body = `
        <div class="slide-inner slide-icp">
          <h2 class="slide-headline">${esc(slide.headline)}</h2>
          <div class="slide-body">
            <div class="persona-card">
              <div class="name">${esc(slide.persona.name)}</div>
              <div class="role">${esc(slide.persona.role)}</div>
              ${renderBullets(slide.bullets)}
            </div>
            <img class="slide-hero-img" src="${esc(slide.image)}" alt="" loading="lazy" />
          </div>
        </div>`;
      break;

    case "icp-quote":
      body = `
        <div class="slide-inner slide-icp">
          <h2 class="slide-headline">${esc(slide.headline)}</h2>
          <div class="slide-body">
            <div class="persona-card">
              <div class="name">${esc(slide.persona.name)}</div>
              <div class="role">${esc(slide.persona.role)}</div>
              <blockquote class="persona-quote">${esc(slide.quote)}</blockquote>
            </div>
            <div class="slide-copy">${renderBullets(slide.bullets)}</div>
          </div>
        </div>`;
      break;

    case "comparison":
      body = `
        <div class="slide-inner slide-comparison">
          <h2 class="slide-headline">${esc(slide.headline)}</h2>
          <div class="slide-body">
            <div class="comparison-table">
              ${slide.columns
                .map((col, ci) => {
                  const hl = ci === 2 ? " highlight" : "";
                  const rows = slide.rows
                    .map(
                      (r) => `
                    <div class="comparison-row">
                      <span class="label">${esc(r.label)}</span>
                      ${esc(r.values[ci])}
                    </div>`
                    )
                    .join("");
                  return `<div class="comparison-col${hl}"><h3>${esc(col)}</h3>${rows}</div>`;
                })
                .join("")}
            </div>
          </div>
        </div>`;
      break;

    case "pricing":
      body = `
        <div class="slide-inner slide-pricing">
          <h2 class="slide-headline">${esc(slide.headline)}</h2>
          <div class="slide-body">
            <div class="pricing-grid">
              ${slide.tiers
                .map((t) => {
                  const feat = t.featured ? " featured" : "";
                  const badge = t.featured
                    ? `<span class="pricing-badge">Most teams start here</span>`
                    : "";
                  return `
                <article class="pricing-card${feat}">
                  ${badge}
                  <h3>${esc(t.name)}</h3>
                  <div class="price">${esc(t.price)}</div>
                  <p>${esc(t.detail)}</p>
                </article>`;
                })
                .join("")}
            </div>
            <p class="pricing-offers">${esc(slide.offers)}</p>
          </div>
        </div>`;
      break;

    case "security":
      body = `
        <div class="slide-inner slide-security">
          <div class="slide-body">
            <div class="slide-copy">
              <h2 class="slide-headline">${esc(slide.headline)}</h2>
              ${renderBullets(slide.bullets)}
            </div>
            <img class="slide-hero-img" src="${esc(slide.image)}" alt="" loading="lazy" />
          </div>
        </div>`;
      break;

    case "cta":
      body = `
        <div class="slide-inner slide-cta">
          <h2 class="slide-headline">${esc(slide.headline)}</h2>
          <div class="slide-body">
            <div class="cta-stack">
              ${slide.ctas
                .map(
                  (c) => `
                <div class="cta-item">
                  <h3>${esc(c.title)}</h3>
                  <p>${esc(c.detail)}</p>
                </div>`
                )
                .join("")}
            </div>
            <div class="cta-panel">
              <div class="qr-box"><canvas id="demo-qr" width="120" height="120" aria-label="Demo QR code"></canvas></div>
              <p class="cta-url"><a href="${esc(slide.demoUrl)}" target="_blank" rel="noopener">${esc(slide.contact)}</a></p>
            </div>
          </div>
        </div>`;
      break;

    default:
      body = `<div class="slide-inner"><h2>${esc(slide.headline || "Slide")}</h2></div>`;
  }

  return `<section class="slide slide-${slide.template}" data-id="${slide.id}" aria-hidden="true">${bg}${body}${footer}</section>`;
}

/** Minimal QR for demo URL (no external lib). */
function drawDemoQr(canvas, url) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = 120;
  const cells = 21;
  const cell = Math.floor(size / cells);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);

  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) >>> 0;

  ctx.fillStyle = "#050a14";
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const corner =
        (x < 7 && y < 7) || (x >= cells - 7 && y < 7) || (x < 7 && y >= cells - 7);
      const finder = corner && (x === 0 || x === 6 || y === 0 || y === 6 || (x > 1 && x < 5 && y > 1 && y < 5));
      const rnd = ((hash ^ (x * 92837111) ^ (y * 689287499)) >>> 0) % 100;
      if (finder || rnd < 42) {
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }
}

class SalesDeck {
  /** @param {{ setMode: (mode: string) => void }} webgl */
  constructor(webgl) {
    this.index = 0;
    this.notesOpen = false;
    this.touchStartX = 0;

    this.stage = $("#deck-stage");
    this.counter = $("#slide-counter");
    this.notesPanel = $("#notes-panel");
    this.notesText = $("#notes-text");
    this.dots = $("#deck-dots");
    this.help = $("#deck-help");

    this.webgl = webgl ?? new NullDeckWebGL();

    this.stage.innerHTML = SLIDES.map(renderSlide).join("");
    this.slides = [...this.stage.querySelectorAll(".slide")];

    SLIDES.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "deck-dot";
      dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
      dot.addEventListener("click", () => this.go(i));
      this.dots.appendChild(dot);
    });
    this.dotEls = [...this.dots.querySelectorAll(".deck-dot")];

    const ctaSlide = SLIDES.find((s) => s.template === "cta");
    const qr = $("#demo-qr");
    if (qr && ctaSlide) drawDemoQr(qr, ctaSlide.demoUrl);

    this.bindEvents();
    this.go(0);
  }

  bindEvents() {
    $("#btn-prev")?.addEventListener("click", () => this.prev());
    $("#btn-next")?.addEventListener("click", () => this.next());
    $("#btn-notes")?.addEventListener("click", () => this.toggleNotes());
    $("#btn-fullscreen")?.addEventListener("click", () => this.toggleFullscreen());
    $("#btn-help")?.addEventListener("click", () => this.help?.classList.add("open"));
    $("#btn-help-close")?.addEventListener("click", () => this.help?.classList.remove("open"));

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        this.next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        this.prev();
      } else if (e.key === "Home") this.go(0);
      else if (e.key === "End") this.go(SLIDES.length - 1);
      else if (e.key === "n" || e.key === "N") this.toggleNotes();
      else if (e.key === "f" || e.key === "F") this.toggleFullscreen();
      else if (e.key === "?" || e.key === "h") this.help?.classList.toggle("open");
      else if (e.key === "Escape") {
        this.help?.classList.remove("open");
        if (this.notesOpen) this.toggleNotes();
      }
    });

    this.stage.addEventListener(
      "touchstart",
      (e) => {
        this.touchStartX = e.changedTouches[0]?.clientX ?? 0;
      },
      { passive: true }
    );
    this.stage.addEventListener(
      "touchend",
      (e) => {
        const dx = (e.changedTouches[0]?.clientX ?? 0) - this.touchStartX;
        if (Math.abs(dx) > 48) dx < 0 ? this.next() : this.prev();
      },
      { passive: true }
    );
  }

  go(i) {
    this.index = Math.max(0, Math.min(SLIDES.length - 1, i));
    const slide = SLIDES[this.index];

    this.slides.forEach((el, idx) => {
      const active = idx === this.index;
      el.classList.toggle("active", active);
      el.setAttribute("aria-hidden", active ? "false" : "true");
    });
    this.dotEls.forEach((d, idx) => d.classList.toggle("active", idx === this.index));

    this.counter.textContent = `${this.index + 1} / ${SLIDES.length}`;
    this.notesText.textContent = slide.notes || "";
    this.webgl.setMode(slide.webgl || "none");

    history.replaceState(null, "", `#${this.index + 1}`);
  }

  next() {
    if (this.index < SLIDES.length - 1) this.go(this.index + 1);
  }
  prev() {
    if (this.index > 0) this.go(this.index - 1);
  }

  toggleNotes() {
    this.notesOpen = !this.notesOpen;
    this.notesPanel?.classList.toggle("open", this.notesOpen);
    $("#btn-notes")?.classList.toggle("active", this.notesOpen);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }
}

const hash = parseInt(location.hash.replace("#", ""), 10);

async function bootDeck() {
  const active = await loadSalesDeckActive();
  if (!active) {
    renderSalesDeckInactive();
    return;
  }
  // Render slides first; WebGL is optional (Three vendor graph must not block the deck).
  const webgl = await createDeckWebGL($("#webgl-bg"));
  const deck = new SalesDeck(webgl);
  if (hash >= 1 && hash <= SLIDES.length) deck.go(hash - 1);
}

void bootDeck();

/**
 * Product demo players on the marketing landing (#product-demo).
 * Empty-state until H.264 files land in public/marketing/.
 * Reduced motion → poster / empty only (no autoplay; controls still OK when files exist).
 */

const base = import.meta.env.BASE_URL;

export const DEMO_VIDEO_PATHS = {
  android: `${base}marketing/demo-a1-android.mp4`,
  ios: `${base}marketing/demo-b1-ios.mp4`,
  androidPoster: `${base}marketing/demo-a1-poster.jpg`,
  iosPoster: `${base}marketing/demo-b1-poster.jpg`,
} as const;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) return true;
    // Some static hosts omit HEAD — try a tiny ranged GET
    const get = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-store",
    });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}

function emptyStateHtml(label: string): string {
  return `
    <div class="mkt-demo-empty" role="status">
      <p class="mkt-demo-empty-title">${label} demo video coming soon</p>
      <p class="mkt-demo-empty-body">Place your catalog on the floor in under a minute — no app install.</p>
      <a class="mkt-btn mkt-btn-ghost mkt-btn-sm" href="/demo">Try live demo</a>
    </div>`;
}

function playerHtml(opts: {
  src: string;
  poster: string;
  label: string;
  reducedMotion: boolean;
}): string {
  const posterAttr = opts.poster ? ` poster="${opts.poster}"` : "";
  if (opts.reducedMotion) {
    return `
      <div class="mkt-demo-player mkt-demo-player--still">
        ${opts.poster ? `<img class="mkt-demo-poster" src="${opts.poster}" alt="" loading="lazy" decoding="async" />` : ""}
        <p class="mkt-demo-still-hint">Motion reduced — <a href="${opts.src}">download ${opts.label} demo</a> or <a href="/demo">try live demo</a>.</p>
      </div>`;
  }
  return `
    <div class="mkt-demo-player">
      <video class="mkt-demo-video" controls playsinline preload="metadata"${posterAttr}>
        <source src="${opts.src}" type="video/mp4" />
      </video>
    </div>`;
}

/**
 * Mount Android / iOS demo players (or empty states) into `host`.
 */
export function mountProductDemo(host: HTMLElement): () => void {
  let cancelled = false;
  const reducedMotion = prefersReducedMotion();

  host.innerHTML = `
    <div class="mkt-demo-tabs" role="tablist" aria-label="Product demo device">
      <button type="button" class="mkt-demo-tab active" role="tab" aria-selected="true" data-demo-tab="android">Android</button>
      <button type="button" class="mkt-demo-tab" role="tab" aria-selected="false" data-demo-tab="ios">iOS</button>
    </div>
    <div class="mkt-demo-panels">
      <div class="mkt-demo-panel" data-demo-panel="android" role="tabpanel">${emptyStateHtml("Android")}</div>
      <div class="mkt-demo-panel hidden" data-demo-panel="ios" role="tabpanel">${emptyStateHtml("iOS")}</div>
    </div>`;

  const onTab = (e: Event) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-demo-tab]");
    if (!btn) return;
    const id = btn.getAttribute("data-demo-tab");
    if (!id) return;
    host.querySelectorAll<HTMLButtonElement>("[data-demo-tab]").forEach((b) => {
      const on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    host.querySelectorAll<HTMLElement>("[data-demo-panel]").forEach((p) => {
      p.classList.toggle("hidden", p.getAttribute("data-demo-panel") !== id);
    });
  };
  host.addEventListener("click", onTab);

  void (async () => {
    const [androidOk, iosOk, androidPosterOk, iosPosterOk] = await Promise.all([
      urlExists(DEMO_VIDEO_PATHS.android),
      urlExists(DEMO_VIDEO_PATHS.ios),
      urlExists(DEMO_VIDEO_PATHS.androidPoster),
      urlExists(DEMO_VIDEO_PATHS.iosPoster),
    ]);
    if (cancelled) return;

    const androidPanel = host.querySelector<HTMLElement>('[data-demo-panel="android"]');
    const iosPanel = host.querySelector<HTMLElement>('[data-demo-panel="ios"]');
    if (androidPanel) {
      androidPanel.innerHTML = androidOk
        ? playerHtml({
            src: DEMO_VIDEO_PATHS.android,
            poster: androidPosterOk ? DEMO_VIDEO_PATHS.androidPoster : "",
            label: "Android",
            reducedMotion,
          })
        : emptyStateHtml("Android");
    }
    if (iosPanel) {
      iosPanel.innerHTML = iosOk
        ? playerHtml({
            src: DEMO_VIDEO_PATHS.ios,
            poster: iosPosterOk ? DEMO_VIDEO_PATHS.iosPoster : "",
            label: "iOS",
            reducedMotion,
          })
        : emptyStateHtml("iOS");
    }
  })();

  return () => {
    cancelled = true;
    host.removeEventListener("click", onTab);
    host.replaceChildren();
  };
}

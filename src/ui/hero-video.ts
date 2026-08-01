/**
 * Cinematic marketing hero backdrop.
 *
 * Ports atlas-sandbox HeroVideo to vanilla TS: muted looping H.264 with
 * poster fallback, reduced-motion respect, off-screen / hidden-tab pause,
 * and a user-facing play/pause toggle.
 */

const base = import.meta.env.BASE_URL;

const POSTER = `${base}marketing/home-hero-poster.jpg`;
const SRC_DESKTOP = `${base}marketing/home-hero.mp4`;
const SRC_MOBILE = `${base}marketing/home-hero-480.mp4`;

const ICON_PLAY = `<svg class="mk-motion-toggle-icon" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_PAUSE = `<svg class="mk-motion-toggle-icon" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isPhoneViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
}

/**
 * Mount the cinema hero video into `host` (typically `.mk-hero-media`).
 * Returns a cleanup function the caller may ignore.
 */
export function mountHeroVideo(host: HTMLElement): () => void {
  const reducedMotion = prefersReducedMotion();
  let paused = reducedMotion;
  let onScreen = true;

  host.replaceChildren();
  host.classList.add("mk-hero-media");

  const video = document.createElement("video");
  video.className = "mk-hero-video";
  video.setAttribute("aria-hidden", "true");
  video.tabIndex = -1;
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "metadata";
  video.poster = POSTER;

  /* Single source via matchMedia — `<source media>` is unreliable across browsers. */
  const source = document.createElement("source");
  source.src = isPhoneViewport() ? SRC_MOBILE : SRC_DESKTOP;
  source.type = "video/mp4";
  video.append(source);

  const scrim = document.createElement("div");
  scrim.className = "mk-hero-scrim";
  scrim.setAttribute("aria-hidden", "true");

  const tint = document.createElement("div");
  tint.className = "mk-hero-tint";
  tint.setAttribute("aria-hidden", "true");

  host.append(video, scrim, tint);

  let toggle: HTMLButtonElement | null = null;

  const syncToggle = (): void => {
    if (!toggle) return;
    const label = paused ? "Play motion" : "Pause motion";
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("aria-pressed", paused ? "true" : "false");
    toggle.innerHTML = `${paused ? ICON_PLAY : ICON_PAUSE}<span>${label}</span>`;
  };

  const syncPlayback = (): void => {
    const shouldPlay = onScreen && !paused && !document.hidden && !reducedMotion;
    if (shouldPlay) void video.play().catch(() => undefined);
    else video.pause();
  };

  if (!reducedMotion) {
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mk-motion-toggle";
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      paused = !paused;
      syncToggle();
      syncPlayback();
    });
    syncToggle();
    host.append(toggle);
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      syncPlayback();
    },
    { threshold: 0.01 },
  );
  observer.observe(host);

  const onVisibility = (): void => {
    syncPlayback();
  };
  document.addEventListener("visibilitychange", onVisibility);

  syncPlayback();

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    video.pause();
    host.replaceChildren();
  };
}

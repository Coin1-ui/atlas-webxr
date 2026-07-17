/** MKT-3 storyboard access gate (config.json + platform API). */

export function publicSettingsUrl(config) {
  const trimmed = (config.apiUrl || "").replace(/\/$/, "");
  if (trimmed) return `${trimmed}/v2/platform/public-settings`;
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "/v2/platform/public-settings";
  }
  return null;
}

export async function loadMkt3StoryboardActive() {
  let fileConfig = { active: true, apiUrl: "" };
  try {
    const res = await fetch("./config.json", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      fileConfig = {
        active: json.active !== false,
        apiUrl: typeof json.apiUrl === "string" ? json.apiUrl.replace(/\/$/, "") : "",
      };
    }
  } catch {
    /* default active */
  }

  const settingsUrl = publicSettingsUrl(fileConfig);
  if (settingsUrl) {
    try {
      const res = await fetch(settingsUrl, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        return json.mkt3StoryboardActive !== false;
      }
    } catch {
      /* fall through */
    }
  }

  return fileConfig.active !== false;
}

export function renderStoryboardInactive() {
  document.body.innerHTML = `
    <div class="deck-inactive">
      <div class="deck-inactive-inner">
        <h1>Storyboard unavailable</h1>
        <p>The MKT-3 production storyboard is temporarily inactive. Contact your Atlas AR representative or return to the main site.</p>
        <p style="margin-top:16px"><a href="/">← Atlas AR home</a></p>
      </div>
    </div>`;
}

/** Shared sales-deck / training access gate (config.json + platform API). */

export function publicSettingsUrl(config) {
  const trimmed = (config.apiUrl || "").replace(/\/$/, "");
  if (trimmed) return `${trimmed}/v2/platform/public-settings`;
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "/v2/platform/public-settings";
  }
  return null;
}

export async function loadSalesDeckActive() {
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
        return json.salesDeckActive !== false;
      }
    } catch {
      /* fall through */
    }
  }

  return fileConfig.active !== false;
}

export function renderSalesDeckInactive() {
  document.body.innerHTML = `
    <div class="deck-inactive">
      <div class="deck-inactive-inner">
        <h1>Sales deck unavailable</h1>
        <p>This presentation is temporarily inactive. Contact your Atlas AR representative or return to the main site.</p>
        <p style="margin-top:16px"><a href="/">← Atlas AR home</a></p>
      </div>
    </div>`;
}

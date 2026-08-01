export type SalesDeckConfig = { active: boolean; apiUrl?: string };

const DEFAULT: SalesDeckConfig = { active: true, apiUrl: "" };

function publicSettingsUrl(apiUrl?: string): string | null {
  const trimmed = apiUrl?.replace(/\/$/, "") ?? "";
  if (trimmed) return `${trimmed}/v2/platform/public-settings`;
  if (
    typeof location !== "undefined" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ) {
    return "/v2/platform/public-settings";
  }
  return null;
}

/** Public config — prefers live API when apiUrl is set (production). */
export async function fetchPublicSalesDeckConfig(): Promise<SalesDeckConfig> {
  let fileConfig: SalesDeckConfig = DEFAULT;
  try {
    const res = await fetch("/sales-deck/config.json", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as Partial<SalesDeckConfig>;
      fileConfig = {
        active: json.active !== false,
        apiUrl: typeof json.apiUrl === "string" ? json.apiUrl.replace(/\/$/, "") : "",
      };
    }
  } catch {
    /* static fallback */
  }

  const settingsUrl = publicSettingsUrl(fileConfig.apiUrl);
  if (settingsUrl) {
    try {
      const res = await fetch(settingsUrl, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { salesDeckActive?: boolean };
        return {
          active: json.salesDeckActive !== false,
          apiUrl: fileConfig.apiUrl,
        };
      }
    } catch {
      /* use fileConfig */
    }
  }

  return fileConfig;
}

export function isSalesDeckPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return (
    p === "/sales-deck" ||
    p === "/sales-deck/index.html" ||
    p === "/sales-deck/training.html" ||
    p === "/sales-deck/outreach.html" ||
    p === "/sales-deck.html" ||
    p === "/sales-deck/showcase" ||
    p.startsWith("/sales-deck/showcase/")
  );
}

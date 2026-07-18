import { getApiBase } from "../config/api";
import { authBearerToken, loadSession } from "../auth/session";
import type { PublicWorkspaceConfig, Workspace } from "../shared/tenant";

function saasApiUrl(path: string): string {
  const base = getApiBase();
  if (base) return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return path.startsWith("/") ? path : `/${path}`;
}

function authHeaders(): HeadersInit {
  const token = authBearerToken(loadSession());
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export class PublicShowroomBlockedError extends Error {
  readonly kind: "restricted" | "suspended";

  constructor(message: string, kind: "restricted" | "suspended") {
    super(message);
    this.name = "PublicShowroomBlockedError";
    this.kind = kind;
  }
}

export async function fetchPublicWorkspaceConfig(
  slug: string,
  opts?: { bustCache?: boolean },
): Promise<PublicWorkspaceConfig | null> {
  const bust = opts?.bustCache ? `?t=${Date.now()}` : "";
  const res = await fetch(
    saasApiUrl(`/v2/workspaces/${encodeURIComponent(slug)}/public-config${bust}`),
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (res.status === 403) {
    let data: { error?: string; restricted?: boolean; suspended?: boolean } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      /* ignore */
    }
    const kind = data.suspended ? "suspended" : "restricted";
    throw new PublicShowroomBlockedError(data.error ?? "Showroom unavailable", kind);
  }
  if (!res.ok) {
    throw new Error(`Workspace config failed (HTTP ${res.status})`);
  }
  return (await res.json()) as PublicWorkspaceConfig;
}

export async function fetchMyWorkspaces(): Promise<Workspace[]> {
  const res = await fetch(saasApiUrl("/v2/me/workspaces"), { headers: authHeaders() });
  if (res.status === 401) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { workspaces: Workspace[] };
  return data.workspaces ?? [];
}

export async function createWorkspace(
  name: string,
  slug?: string,
  trialPlan?: "growth" | "launch",
): Promise<Workspace> {
  const res = await fetch(saasApiUrl("/v2/workspaces"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(trialPlan ? { name, slug, trialPlan } : { name, slug }),
  });
  const text = await res.text();
  let data: { workspace?: Workspace; error?: string } = {};
  try {
    data = JSON.parse(text) as { workspace?: Workspace; error?: string };
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  if (!data.workspace) {
    throw new Error("Invalid workspace response");
  }
  return data.workspace;
}

export async function deleteMyAccount(): Promise<void> {
  const res = await fetch(saasApiUrl("/v2/me/account"), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text) as { error?: string };
      message = data.error || text;
    } catch {
      /* use raw text */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  input: {
    name?: string;
    logoUrl?: string | null;
    primaryColor?: string;
    arExitUrl?: string | null;
  }
): Promise<Workspace> {
  const res = await fetch(saasApiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/settings`), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const text = await res.text();
  let data: { workspace?: Workspace; error?: string } = {};
  try {
    data = JSON.parse(text) as { workspace?: Workspace; error?: string };
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  if (!data.workspace) {
    throw new Error("Invalid workspace response");
  }
  return data.workspace;
}

type LogoPresignResponse = {
  url: string;
  key: string;
  ext: string;
  contentType: string;
};

async function putLogoFile(url: string, file: File, contentType: string): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Logo upload failed (HTTP ${res.status})`);
  }
}

/** Upload workspace logo image directly to tenant S3 (presign → PUT → complete). */
export async function uploadWorkspaceLogo(workspaceId: string, file: File): Promise<Workspace> {
  const uploadUrl = saasApiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/branding/logo`);
  const presignRes = await fetch(uploadUrl, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      action: "presign",
      contentType: file.type || "image/png",
      filename: file.name,
    }),
  });
  const presignText = await presignRes.text();
  if (!presignRes.ok) {
    let message = presignText.slice(0, 200) || `HTTP ${presignRes.status}`;
    try {
      const errJson = JSON.parse(presignText) as { error?: string };
      if (errJson.error) message = errJson.error;
    } catch {
      /* use raw */
    }
    throw new Error(message);
  }
  let session: LogoPresignResponse;
  try {
    session = JSON.parse(presignText) as LogoPresignResponse;
  } catch {
    throw new Error("Invalid logo presign response");
  }

  await putLogoFile(session.url, file, session.contentType || file.type || "image/png");

  const completeRes = await fetch(uploadUrl, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      action: "complete",
      ext: session.ext,
    }),
  });
  const completeText = await completeRes.text();
  if (!completeRes.ok) {
    let message = completeText.slice(0, 200) || `HTTP ${completeRes.status}`;
    try {
      const errJson = JSON.parse(completeText) as { error?: string };
      if (errJson.error) message = errJson.error;
    } catch {
      /* use raw */
    }
    throw new Error(message);
  }
  let data: { workspace?: Workspace; error?: string } = {};
  try {
    data = JSON.parse(completeText) as { workspace?: Workspace; error?: string };
  } catch {
    data = { error: completeText };
  }
  if (!data.workspace) {
    throw new Error(data.error || "Invalid logo upload response");
  }
  return data.workspace;
}

/** Admin UI hint — never expose production API hostnames. */
export function workspaceApiHint(): string {
  return getApiBase()
    ? "Workspace API: connected (tenant catalog & branding)"
    : "Workspace API: local dev (/v2/*)";
}

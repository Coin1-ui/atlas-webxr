export type ArSessionEventStatus = "ok" | "fail" | "info";

export type ArSessionEvent = {
  at: string;
  elapsedMs: number;
  id: string;
  name: string;
  status: ArSessionEventStatus;
  details?: Record<string, string | number | boolean | null | undefined>;
  error?: string;
};

export type SessionPlacementSummary = {
  placementCount: number;
  warnCount: number;
  failCount: number;
  submergedCount: number;
  shadowIssues: number;
  floorYMedianM: number | null;
  issues: string[];
};

export type ArSessionReport = {
  meta: {
    type: "atlas-ar-live-session";
    version: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    userAgent: string;
    platform: string;
  };
  environment: {
    isSecureContext: boolean;
    protocol: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
  };
  events: ArSessionEvent[];
  placementSummary?: SessionPlacementSummary;
};

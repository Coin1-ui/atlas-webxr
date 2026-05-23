export type DeviceTestStatus = "passed" | "failed" | "skipped";

export type DeviceTestStep = {
  id: string;
  name: string;
  status: DeviceTestStatus;
  durationMs: number;
  details?: Record<string, string | number | boolean | null | undefined>;
  error?: string;
};

export type DeviceTestProgress = {
  stepIndex: number;
  totalSteps: number;
  currentName: string;
  steps: DeviceTestStep[];
};

export type DeviceTestReport = {
  meta: {
    type: "atlas-device-hardware-check";
    version: "1.0.0";
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    userAgent: string;
    platform: string;
  };
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    overall: "pass" | "fail";
  };
  environment: {
    isSecureContext: boolean;
    protocol: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
  };
  steps: DeviceTestStep[];
};

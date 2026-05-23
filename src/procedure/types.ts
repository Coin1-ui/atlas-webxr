export type SafetyClass = "normal" | "critical";

export type ValidationRule =
  | { type: "manual_confirm" }
  | { type: "dwell_ms"; ms: number }
  | { type: "qr_code"; expected: string };

export type PlacementObjectType = "arrow" | "pad" | "zone";

export type ProcedureStep = {
  id: string;
  title: string;
  instruction: string;
  safetyClass: SafetyClass;
  validation: ValidationRule;
  hint?: string;
  /** When set, WebXR mode can place this 3D object on the detected floor. */
  placement?: {
    object: PlacementObjectType;
    prompt?: string;
  };
};

export type TrainingModule = {
  moduleId: string;
  title: string;
  version: string;
  estimatedMinutes: number;
  assetQrCode?: string;
  steps: ProcedureStep[];
};

export type StepStatus = "pending" | "active" | "validating" | "passed" | "failed";

export type SessionMode = "camera" | "webxr" | "home";

export type CompletionRecord = {
  moduleId: string;
  version: string;
  completedAt: string;
  durationMs: number;
  mode: SessionMode;
  stepsPassed: number;
  stepsTotal: number;
  overrides: number;
};

import type { ProcedureStep, StepStatus, TrainingModule } from "./types";

export class StepEngine {
  private index = 0;
  private statuses: StepStatus[];

  constructor(private readonly module: TrainingModule) {
    this.statuses = module.steps.map((_, i) => (i === 0 ? "active" : "pending"));
  }

  getModule(): TrainingModule {
    return this.module;
  }

  getCurrentIndex(): number {
    return this.index;
  }

  getCurrentStep(): ProcedureStep | null {
    return this.module.steps[this.index] ?? null;
  }

  getStatuses(): StepStatus[] {
    return [...this.statuses];
  }

  isComplete(): boolean {
    return this.index >= this.module.steps.length;
  }

  markValidating(): void {
    if (this.statuses[this.index] === "active") {
      this.statuses[this.index] = "validating";
    }
  }

  passStep(): boolean {
    if (this.isComplete()) return false;
    this.statuses[this.index] = "passed";
    this.index += 1;
    if (this.index < this.module.steps.length) {
      this.statuses[this.index] = "active";
    }
    return true;
  }

  failStep(): void {
    if (!this.isComplete()) {
      this.statuses[this.index] = "failed";
    }
  }

  resetFailed(): void {
    if (this.statuses[this.index] === "failed") {
      this.statuses[this.index] = "active";
    }
  }
}

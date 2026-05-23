import type { DeviceTestReport } from "./types";

const HISTORY_KEY = "atlas-device-test-history";

export function downloadDeviceTestReport(report: DeviceTestReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `atlas-device-test-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  saveToHistory(report);
}

function saveToHistory(report: DeviceTestReport): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: DeviceTestReport[] = raw ? JSON.parse(raw) : [];
    list.unshift(report);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* ignore quota */
  }
}

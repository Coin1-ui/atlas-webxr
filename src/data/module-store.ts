import type { CompletionRecord, TrainingModule } from "../procedure/types";

const COMPLETIONS_KEY = "atlas-completions";

export async function loadModule(moduleId: string): Promise<TrainingModule> {
  const res = await fetch(`./modules/${moduleId}.json`);
  if (!res.ok) {
    throw new Error(`Module not found: ${moduleId}`);
  }
  return res.json() as Promise<TrainingModule>;
}

export function listBuiltInModules(): { id: string; title: string }[] {
  return [
    { id: "loto-pump-7a", title: "LOTO — Pump 7A Disconnect" },
    { id: "ppe-zone-entry", title: "PPE Zone Entry" },
  ];
}

export function saveCompletion(record: CompletionRecord): void {
  const existing = getCompletions();
  existing.unshift(record);
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(existing.slice(0, 50)));
}

export function getCompletions(): CompletionRecord[] {
  try {
    const raw = localStorage.getItem(COMPLETIONS_KEY);
    return raw ? (JSON.parse(raw) as CompletionRecord[]) : [];
  } catch {
    return [];
  }
}

export function exportCompletionsJson(): string {
  return JSON.stringify(getCompletions(), null, 2);
}

import type { PlacementObjectType } from "../xr/webxr-ar";

export type CustomModelRecord = {
  id: string;
  name: string;
  createdAt: string;
  /** Procedural mesh when no GLB uploaded */
  builtinType?: PlacementObjectType;
};

type StoredRow = CustomModelRecord & {
  iconBlob?: Blob;
  glbBlob?: Blob;
};

const DB_NAME = "atlas-custom-models";
const DB_VERSION = 1;
const STORE = "models";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function listModelRecords(): Promise<CustomModelRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as StoredRow[]).map(({ id, name, createdAt, builtinType }) => ({
        id,
        name,
        createdAt,
        builtinType,
      }));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getModelAssets(
  id: string
): Promise<{ iconUrl: string | null; modelUrl: string | null; record: CustomModelRecord } | null> {
  const db = await openDb();
  const row = await new Promise<StoredRow | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as StoredRow | undefined);
    req.onerror = () => reject(req.error);
  });
  if (!row) return null;
  const record: CustomModelRecord = {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
  };
  return {
    iconUrl: row.iconBlob ? URL.createObjectURL(row.iconBlob) : null,
    modelUrl: row.glbBlob ? URL.createObjectURL(row.glbBlob) : null,
    record,
  };
}

export async function saveCustomModel(
  name: string,
  iconFile: File,
  glbFile: File
): Promise<string> {
  const id = `model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const row: StoredRow = {
    id,
    name: name.trim() || "Untitled model",
    createdAt: new Date().toISOString(),
    iconBlob: iconFile,
    glbBlob: glbFile,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return id;
}

export async function deleteCustomModel(id: string): Promise<void> {
  if (id.startsWith("builtin-")) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function defaultIconForBuiltin(type: PlacementObjectType): string {
  if (type === "arrow") {
    return "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#1565c0"/><path fill="#42a5f5" d="M32 12 L44 40 L36 40 L36 52 L28 52 L28 40 L20 40 Z"/></svg>`
    );
  }
  if (type === "zone") {
    return "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="#ef5350" stroke-width="6"/><circle cx="32" cy="32" r="30" fill="#1565c0" opacity="0.3"/></svg>`
    );
  }
  return "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="28" width="48" height="20" rx="4" fill="#42a5f5"/><rect x="8" y="8" width="48" height="48" fill="none" stroke="#1565c0" stroke-width="4" opacity="0.5"/></svg>`
  );
}

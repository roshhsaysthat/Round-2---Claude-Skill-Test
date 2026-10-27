/**
 * Persistence adapter. The app talks only to this interface, so replacing
 * localStorage with an API or database later means swapping one object.
 */
import { DATA_VERSION } from "./seed";
import type { AppData } from "./types";

export interface LoadResult {
  data: AppData | null;
  /** Set when stored data existed but could not be used. */
  error?: string;
}

export interface PersistenceAdapter {
  load(): LoadResult;
  save(data: AppData): void;
  clear(): void;
}

const KEY = "taskflow.data.v1";

function looksValid(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AppData>;
  return (
    v.version === DATA_VERSION &&
    typeof v.seq === "number" &&
    typeof v.currentUserId === "string" &&
    Array.isArray(v.users) &&
    Array.isArray(v.projects) &&
    Array.isArray(v.tasks) &&
    Array.isArray(v.activity) &&
    Array.isArray(v.notifications)
  );
}

export const localStorageAdapter: PersistenceAdapter = {
  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return { data: null };
      const parsed: unknown = JSON.parse(raw);
      if (!looksValid(parsed)) return { data: null, error: "Saved data was from an incompatible version, so demo data was loaded." };
      return { data: parsed };
    } catch {
      return { data: null, error: "Saved data couldn't be read, so demo data was loaded." };
    }
  },
  save(data) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage can be full or blocked (private mode). The app keeps working in memory.
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};

export const STORAGE_KEY = KEY;

const PREFIX = "fasopay:offline:";

export function saveOfflineData<T>(key: string, value: T): T {
  try { localStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ value, savedAt: Date.now() })); } catch { /* unavailable */ }
  return value;
}

export function readOfflineData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as { value: T }).value : null;
  } catch { return null; }
}

export const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;
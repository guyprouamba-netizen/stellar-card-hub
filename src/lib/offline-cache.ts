const PREFIX = "fasopay:offline:";
const IMAGE_PREFIX = "fasopay:offline-image:";

export interface OfflineEntry<T> {
  value: T;
  savedAt: number;
}

export function saveOfflineData<T>(key: string, value: T): T {
  try { localStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ value, savedAt: Date.now() })); } catch { /* unavailable */ }
  return value;
}

export function readOfflineData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as OfflineEntry<T>).value : null;
  } catch { return null; }
}

export function readOfflineEntry<T>(key: string): OfflineEntry<T> | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as OfflineEntry<T>) : null;
  } catch { return null; }
}

export const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function cacheImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    localStorage.setItem(`${IMAGE_PREFIX}${url}`, JSON.stringify({ value: dataUrl, savedAt: Date.now() }));
    return dataUrl;
  } catch {
    return readCachedImage(url);
  }
}

export function readCachedImage(url: string): string | null {
  try {
    const raw = localStorage.getItem(`${IMAGE_PREFIX}${url}`);
    return raw ? (JSON.parse(raw) as OfflineEntry<string>).value : null;
  } catch { return null; }
}

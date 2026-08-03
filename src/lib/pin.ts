import { supabase } from "@/integrations/supabase/client";

const LOCK_AFTER_MS = 3 * 60 * 1000; // 3 minutes en arrière-plan

function pinEnabledKey(userId: string) {
  return `fasopay:pin:enabled:${userId}`;
}

export function getLastEmail(): string {
  try { return localStorage.getItem("fasopay:pin:lastEmail") || ""; } catch { return ""; }
}
export function setLastEmail(email: string) {
  try { localStorage.setItem("fasopay:pin:lastEmail", email); } catch { /**/ }
}

export function isPinEnabledOnDevice(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try { return localStorage.getItem(pinEnabledKey(userId)) === "1"; } catch { return false; }
}
export function markPinEnabledOnDevice(userId: string) {
  try { localStorage.setItem(pinEnabledKey(userId), "1"); } catch { /**/ }
}
export function clearPinEnabledOnDevice(userId: string) {
  try { localStorage.removeItem(pinEnabledKey(userId)); } catch { /**/ }
}

// --- Verrouillage de session locale ---
function lockedKey() {
  return "fasopay:pin:locked";
}
export function isSessionLocked(): boolean {
  try { return localStorage.getItem(lockedKey()) !== "0"; } catch { return true; }
}
export function setSessionLocked(locked: boolean) {
  try { localStorage.setItem(lockedKey(), locked ? "1" : "0"); } catch { /**/ }
}

function lastActiveKey() {
  return "fasopay:pin:lastActive";
}
export function markActiveNow() {
  try { localStorage.setItem(lastActiveKey(), String(Date.now())); } catch { /**/ }
}
export function shouldLockAfterBackground(): boolean {
  try {
    const last = Number(localStorage.getItem(lastActiveKey()) || "0");
    if (!last) return false;
    return Date.now() - last > LOCK_AFTER_MS;
  } catch {
    return false;
  }
}

// --- Appels à la fonction edge `pin` ---
async function invokePin(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("pin", { body: { action, ...payload } });
  if (error) {
    const message = (data as any)?.error || error.message || "Une erreur est survenue.";
    throw new Error(message);
  }
  return data as any;
}

export async function getPinStatus(): Promise<{ hasPin: boolean }> {
  return invokePin("status");
}

export async function setPin(pin: string): Promise<{ ok: boolean }> {
  return invokePin("set", { pin });
}

export async function verifyPin(pin: string): Promise<{ ok: boolean; locked?: boolean; remaining?: number; message?: string }> {
  return invokePin("verify", { pin });
}

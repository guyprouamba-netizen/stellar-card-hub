import { supabase } from "@/integrations/supabase/client";

// Aucun nom de prestataire technique ne doit apparaître côté client.
export function sanitizeErrorMessage(raw?: string): string {
  const msg = String(raw || "").trim();
  if (!msg) return "Une erreur est survenue. Réessayez ou contactez l'administrateur.";
  const low = msg.toLowerCase();
  const insufficient =
    /insufficient|insuffisan|not enough|solde insuffisant|low balance|balance is too low/.test(low);
  if (insufficient) {
    return "Les recharges sont momentanément suspendues. Merci de contacter l'administrateur.";
  }
  if (/strowallet|bitvcard/.test(low)) {
    return "Service de cartes momentanément indisponible. Merci de contacter l'administrateur.";
  }
  return msg;
}

export async function callApi<T = any>(fn: string, data?: any): Promise<T> {
  const { data: res, error } = await supabase.functions.invoke("api", { body: { fn, data } });
  if (error) {
    const ctx: any = (error as any).context;
    let msg: string | undefined;
    if (ctx && typeof ctx.json === "function") {
      try { const j = await ctx.json(); msg = j?.error; } catch { /**/ }
    }
    throw new Error(sanitizeErrorMessage(msg || error.message || "Erreur API"));
  }
  if (res && typeof res === "object" && "error" in res && !("ok" in res)) {
    throw new Error(sanitizeErrorMessage((res as any).error));
  }
  return res as T;
}
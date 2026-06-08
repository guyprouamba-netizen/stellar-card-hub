import { supabase } from "@/integrations/supabase/client";

export async function callApi<T = any>(fn: string, data?: any): Promise<T> {
  const { data: res, error } = await supabase.functions.invoke("api", { body: { fn, data } });
  if (error) {
    const ctx: any = (error as any).context;
    let msg: string | undefined;
    if (ctx && typeof ctx.json === "function") {
      try { const j = await ctx.json(); msg = j?.error; } catch { /**/ }
    }
    throw new Error(msg || error.message || "Erreur API");
  }
  if (res && typeof res === "object" && "error" in res && !("ok" in res)) {
    throw new Error((res as any).error);
  }
  return res as T;
}
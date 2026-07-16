import { supabase } from "@/integrations/supabase/client";

export async function callSms<T = any>(fn: string, data?: any): Promise<T> {
  const { data: res, error } = await supabase.functions.invoke("sms", { body: { fn, data } });
  if (error) {
    const ctx: any = (error as any).context;
    let msg: string | undefined;
    if (ctx && typeof ctx.text === "function") {
      try { const t = await ctx.text(); try { msg = JSON.parse(t)?.error; } catch { msg = t; } } catch { /* */ }
    }
    throw new Error(msg || error.message);
  }
  if (res && typeof res === "object" && "error" in res) throw new Error((res as any).error);
  return res as T;
}

export const smsGetConfig = () => callSms<{ config: any; templates: any[] }>("getConfig");
export const smsUpdateConfig = (data: any) => callSms("updateConfig", data);
export const smsUpdateTemplate = (data: { id: string; body?: string; enabled?: boolean; label?: string }) => callSms("updateTemplate", data);
export const smsListContacts = () => callSms<{ contacts: any[] }>("listContacts");
export const smsAddContact = (data: { label: string; phone: string; notes?: string }) => callSms("addContact", data);
export const smsDeleteContact = (id: string) => callSms("deleteContact", { id });
export const smsSendCustom = (data: { recipients: string[] | string; message: string; sender_id?: string }) => callSms("sendCustom", data);
export const smsSendTest = (data: { phone: string; message?: string }) => callSms("sendTest", data);
export const smsListLogs = (limit = 100) => callSms<{ logs: any[] }>("listLogs", { limit });
export const smsGetBalance = () => callSms<{ ok: boolean; endpoint?: string; response?: any; error?: string }>("getBalance");
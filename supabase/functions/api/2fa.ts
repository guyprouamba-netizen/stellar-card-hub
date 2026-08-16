import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { sendSmsRaw, normalizeBfPhone } from "../_shared/sms.ts";

export async function handle2FA(admin: any, userId: string, phone: string, action: "send" | "verify", code?: string) {
  const normalized = normalizeBfPhone(phone);
  if (!normalized) throw new Error("Numéro de téléphone invalide");

  if (action === "send") {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 mins

    const { error } = await admin.from("user_otp").upsert({
      user_id: userId,
      phone: normalized,
      code: otp,
      expires_at: expiresAt,
      purpose: "2fa"
    });
    if (error) throw error;

    const r = await sendSmsRaw({
      recipient: normalized,
      message: otp,
      sender_id: "FASOINVEST",
      type: "whatsapp"
    });

    if (!r.ok) throw new Error("Erreur lors de l'envoi WhatsApp OTP");
    return { ok: true, expires_at: expiresAt };
  } else {
    if (!code) throw new Error("Code OTP requis");
    const { data, error } = await admin.from("user_otp")
      .select("*")
      .eq("user_id", userId)
      .eq("code", code)
      .eq("purpose", "2fa")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) throw new Error("Code invalide ou expiré");

    await admin.from("user_otp").delete().eq("id", data.id);
    return { ok: true };
  }
}

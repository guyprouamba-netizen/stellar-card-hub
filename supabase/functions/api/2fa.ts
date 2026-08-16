import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { sendSmsRaw, normalizeBfPhone } from "../_shared/sms.ts";

export async function handle2FA(admin: any, userId: string, phone: string, action: "send" | "verify", code?: string, purpose: "2fa" | "registration" = "2fa") {
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
      purpose
    });
    if (error) throw error;

    console.log(`[handle2FA] Sending WhatsApp OTP to ${normalized} for purpose ${purpose}`);
    const r = await sendSmsRaw({
      recipient: normalized,
      message: purpose === "registration" 
        ? `Bienvenue sur FASO-INVEST PAY ! Votre code de confirmation est : ${otp}`
        : `Votre code de sécurité FASO-INVEST PAY est : ${otp}`,
      sender_id: "FASOINVEST",
      type: "whatsapp"
    });

    console.log(`[handle2FA] BBG SMS response:`, JSON.stringify(r.body));

    if (!r.ok) {
      console.error(`[handle2FA] BBG SMS Error:`, r.body);
      throw new Error(`Erreur lors de l'envoi WhatsApp OTP: ${r.body?.message || r.body?.error || "Erreur inconnue"}`);
    }
    return { ok: true, expires_at: expiresAt };
  } else {
    if (!code) throw new Error("Code OTP requis");
    const { data, error } = await admin.from("user_otp")
      .select("*")
      .eq("user_id", userId)
      .eq("code", code)
      .eq("purpose", purpose)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) throw new Error("Code invalide ou expiré");

    await admin.from("user_otp").delete().eq("id", data.id);
    
    // Si c'est une inscription, on marque le téléphone comme vérifié
    if (purpose === "registration") {
      await admin.from("profiles").update({ 
        phone_verified: true, 
        phone_verified_at: new Date().toISOString() 
      }).eq("id", userId);
    }

    return { ok: true };
  }
}

/**
 * Version simplifiée spécifique pour l'inscription (registration) 
 * pour éviter les conflits de types ou de paramètres optionnels.
 */
export async function handleRegistrationOTP(admin: any, userId: string, phone: string, action: "send" | "verify", code?: string) {
  const normalized = normalizeBfPhone(phone);
  if (!normalized) throw new Error("Numéro de téléphone invalide");

  if (action === "send") {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

    const { error } = await admin.from("user_otp").upsert({
      user_id: userId,
      phone: normalized,
      code: otp,
      expires_at: expiresAt,
      purpose: "registration"
    });
    if (error) throw error;

    const r = await sendSmsRaw({
      recipient: normalized,
      message: `Bienvenue sur FASO-INVEST PAY ! Votre code de confirmation est : ${otp}`,
      sender_id: "FASOINVEST",
      type: "whatsapp"
    });

    if (!r.ok) {
      console.error(`[handleRegistrationOTP] BBG SMS Error:`, JSON.stringify(r.body));
      throw new Error(`Erreur lors de l'envoi WhatsApp OTP: ${r.body?.message || r.body?.error || "Réponse invalide de l'API"}`);
    }
    return { ok: true, expires_at: expiresAt };
  } else {
    if (!code) throw new Error("Code OTP requis");
    const { data, error } = await admin.from("user_otp")
      .select("*")
      .eq("user_id", userId)
      .eq("code", code)
      .eq("purpose", "registration")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) throw new Error("Code invalide ou expiré");

    await admin.from("user_otp").delete().eq("id", data.id);
    
    await admin.from("profiles").update({ 
      phone_verified: true, 
      phone_verified_at: new Date().toISOString() 
    }).eq("id", userId);

    return { ok: true };
  }
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendSmsRaw, normalizeBfPhone } from "../_shared/sms.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const jwt = auth.slice(7);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: cErr } = await userClient.auth.getClaims(jwt);
  if (cErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ error: "Forbidden - admin only" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* GET-less */ }
  const fn = String(body?.fn || "");
  const data = body?.data || {};

  try {
    switch (fn) {
      case "getConfig": {
        const { data: cfg } = await admin.from("sms_config").select("*").limit(1).maybeSingle();
        const { data: templates } = await admin.from("sms_templates").select("*").order("event_key");
        return json({ config: cfg, templates });
      }
      case "updateConfig": {
        const { data: cfg } = await admin.from("sms_config").select("id").limit(1).maybeSingle();
        if (!cfg) return json({ error: "Config manquante" }, 500);
        const allowed: any = {};
        for (const k of ["enabled", "sender_id", "admin_phones", "notify_admin", "event_wallet_recharge", "event_card_recharge", "event_withdrawal", "event_withdrawal_paid", "daily_limit"]) {
          if (k in data) allowed[k] = data[k];
        }
        const { data: updated, error } = await admin.from("sms_config").update(allowed).eq("id", cfg.id).select("*").single();
        if (error) throw error;
        return json({ ok: true, config: updated });
      }
      case "updateTemplate": {
        const { id, body: tplBody, enabled, label } = data;
        if (!id) return json({ error: "id requis" }, 400);
        const patch: any = {};
        if (tplBody !== undefined) patch.body = tplBody;
        if (enabled !== undefined) patch.enabled = enabled;
        if (label !== undefined) patch.label = label;
        const { data: t, error } = await admin.from("sms_templates").update(patch).eq("id", id).select("*").single();
        if (error) throw error;
        return json({ ok: true, template: t });
      }
      case "listContacts": {
        const { data: contacts } = await admin.from("sms_contacts").select("*").order("created_at", { ascending: false });
        return json({ contacts });
      }
      case "addContact": {
        const phone = normalizeBfPhone(data.phone);
        if (!phone) return json({ error: "Numéro invalide" }, 400);
        const { data: c, error } = await admin.from("sms_contacts").insert({ label: data.label || phone, phone, notes: data.notes || null }).select("*").single();
        if (error) throw error;
        return json({ ok: true, contact: c });
      }
      case "deleteContact": {
        await admin.from("sms_contacts").delete().eq("id", data.id);
        return json({ ok: true });
      }
      case "sendCustom": {
        // data.recipients: string[] or comma string; data.message
        const rawList: string[] = Array.isArray(data.recipients) ? data.recipients : String(data.recipients || "").split(",");
        const list = rawList.map((p) => normalizeBfPhone(p)).filter(Boolean) as string[];
        if (!list.length) return json({ error: "Aucun destinataire valide" }, 400);
        if (!data.message) return json({ error: "Message requis" }, 400);
        const { data: cfg } = await admin.from("sms_config").select("sender_id,enabled").limit(1).maybeSingle();
        if (!cfg?.enabled) return json({ error: "SMS désactivés globalement" }, 400);
        const recipient = list.join(",");
        const r = await sendSmsRaw({ 
          recipient, 
          message: data.message, 
          sender_id: data.sender_id || cfg.sender_id,
          type: data.type || "plain"
        });
        await admin.from("sms_logs").insert({
          recipient, message: data.message, event_key: "custom", user_id: userId,
          status: r.ok ? "success" : "failed", provider_response: r.body,
          error: r.ok ? undefined : String(r.body?.message || r.body?.error || `HTTP ${r.status}`),
        });
        return json({ ok: r.ok, response: r.body });
      }
      case "sendTest": {
        const phone = normalizeBfPhone(data.phone);
        if (!phone) return json({ error: "Numéro invalide" }, 400);
        const { data: cfg } = await admin.from("sms_config").select("sender_id").limit(1).maybeSingle();
        const r = await sendSmsRaw({
          recipient: phone,
          message: data.message || "Test FASO-INVEST PAY - Notifications SMS actives ✅",
          sender_id: cfg?.sender_id || "FASOINVEST",
          type: data.type || "plain"
        });
        await admin.from("sms_logs").insert({
          recipient: phone, message: data.message || "Test", event_key: "test", user_id: userId,
          status: r.ok ? "success" : "failed", provider_response: r.body,
          error: r.ok ? undefined : String(r.body?.message || r.body?.error || `HTTP ${r.status}`),
        });
        return json({ ok: r.ok, response: r.body });
      }
      case "listLogs": {
        const limit = Math.min(Number(data.limit || 100), 500);
        const { data: logs } = await admin.from("sms_logs").select("*").order("created_at", { ascending: false }).limit(limit);
        return json({ logs });
      }
      case "getBalance": {
        // BBG SMS: pas d'endpoint officiel de solde documenté publiquement.
        // On tente plusieurs URLs candidates et on renvoie la 1re qui répond en 2xx.
        const token = Deno.env.get("BBG_SMS_API_TOKEN");
        if (!token) return json({ error: "BBG_SMS_API_TOKEN manquant" }, 500);
        const candidates = [
          "https://bbgsmsapp.betterbegoing.com/api/v3/wallet/balance",
          "https://bbgsmsapp.betterbegoing.com/api/v3/balance",
          "https://bbgsmsapp.betterbegoing.com/api/v3/user",
          "https://bbgsmsapp.betterbegoing.com/api/http/balance",
          "https://bbgsmsapp.betterbegoing.com/api/http/user",
        ];
        for (const url of candidates) {
          try {
            const r = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify({ api_token: token }),
            });
            const txt = await r.text();
            let bodyJ: any = txt; try { bodyJ = JSON.parse(txt); } catch { /* */ }
            if (r.ok) return json({ ok: true, endpoint: url, response: bodyJ });
          } catch { /* try next */ }
        }
        return json({ ok: false, error: "Aucun endpoint solde BBG accessible — vérifiez auprès de BBG le point de terminaison exact." }, 200);
      }
      case "sendersList": {
        // Utilisé côté front pour lister les sender_id disponibles.
        // BBG ne documente pas d'endpoint public; on renvoie celui configuré + suggestions.
        const { data: cfg } = await admin.from("sms_config").select("sender_id").limit(1).maybeSingle();
        return json({ current: cfg?.sender_id, suggestions: [cfg?.sender_id, "FASOINVEST", "BBG"].filter(Boolean) });
      }
      default:
        return json({ error: `Unknown fn: ${fn}` }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
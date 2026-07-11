// Bridge Chat PAY: reçoit les événements du worker Baileys distant
// et lui fournit la file d'envoi. Authentifié via x-session-secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function getSession(req: Request) {
  const secret = req.headers.get("x-session-secret") || "";
  if (!secret) throw new Error("missing session secret");
  const { data } = await admin.from("whatsapp_sessions")
    .select("*").eq("connection_secret", secret).maybeSingle();
  if (!data) throw new Error("invalid session");
  const workerVersion = req.headers.get("x-worker-version") || null;
  await admin.from("whatsapp_sessions")
    .update({ last_seen_at: new Date().toISOString(), worker_version: workerVersion })
    .eq("id", data.id);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/whatsapp-bridge/, "") || "/";

  try {
    const session = await getSession(req);

    // POST /status  { status, qr_data_url?, phone_number? }
    if (path === "/status" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const patch: any = {};
      if (body.status) patch.status = body.status;
      if (body.qr_data_url !== undefined) patch.qr_data_url = body.qr_data_url;
      if (body.phone_number !== undefined) patch.phone_number = body.phone_number;
      await admin.from("whatsapp_sessions").update(patch).eq("id", session.id);
      return jsonResponse({ ok: true });
    }

    // POST /event  { kind, payload }
    if (path === "/event" && req.method === "POST") {
      const { kind, payload } = await req.json().catch(() => ({}));
      if (!kind) return jsonResponse({ error: "missing kind" }, 400);
      await admin.from("whatsapp_events").insert({ session_id: session.id, kind, payload: payload || {} });
      return jsonResponse({ ok: true });
    }

    // GET /outbox  → jusqu'à 10 messages en attente
    if (path === "/outbox" && req.method === "GET") {
      const { data } = await admin.from("whatsapp_outbound")
        .select("id,to_jid,body")
        .eq("session_id", session.id).eq("status", "queued")
        .order("created_at", { ascending: true }).limit(10);
      return jsonResponse({ messages: data ?? [] });
    }

    // POST /outbox/:id/ack  { ok, error? }
    const ackMatch = path.match(/^\/outbox\/([0-9a-f-]{36})\/ack$/);
    if (ackMatch && req.method === "POST") {
      const id = ackMatch[1];
      const body = await req.json().catch(() => ({}));
      await admin.from("whatsapp_outbound").update({
        status: body.ok ? "sent" : "failed",
        error: body.error || null,
        sent_at: body.ok ? new Date().toISOString() : null,
      }).eq("id", id).eq("session_id", session.id);
      return jsonResponse({ ok: true });
    }

    // POST /heartbeat  (auth suffit)
    if (path === "/heartbeat" && req.method === "POST") {
      return jsonResponse({ ok: true });
    }

    // GET /config  → renvoie la config bot + les groupes actifs
    if (path === "/config" && req.method === "GET") {
      const { data: cfg } = await admin.from("bot_config").select("*").eq("session_id", session.id).maybeSingle();
      const { data: groups } = await admin.from("bot_groups").select("*").eq("session_id", session.id);
      return jsonResponse({ config: cfg, groups: groups || [] });
    }

    // POST /group  { group_jid, name?, member_count? }  → upsert
    if (path === "/group" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (!b.group_jid) return jsonResponse({ error: "missing group_jid" }, 400);
      await admin.from("bot_groups").upsert({
        session_id: session.id, group_jid: b.group_jid,
        name: b.name || null, member_count: b.member_count ?? null,
      }, { onConflict: "session_id,group_jid" });
      return jsonResponse({ ok: true });
    }

    // POST /log  { kind, group_jid?, user_jid?, payload? }
    if (path === "/log" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (!b.kind) return jsonResponse({ error: "missing kind" }, 400);
      await admin.from("bot_logs").insert({
        session_id: session.id, kind: b.kind,
        group_jid: b.group_jid || null, user_jid: b.user_jid || null,
        payload: b.payload || {},
      });
      return jsonResponse({ ok: true });
    }

    // POST /warn  { group_jid, user_jid, reason? }
    // Retourne { count, banned: boolean } — le worker décide de l'action.
    if (path === "/warn" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (!b.group_jid || !b.user_jid) return jsonResponse({ error: "missing fields" }, 400);
      const { data: cfg } = await admin.from("bot_config").select("warnings_threshold,warning_expire_days").eq("session_id", session.id).maybeSingle();
      const threshold = cfg?.warnings_threshold ?? 3;
      const expireDays = cfg?.warning_expire_days ?? 7;

      const { data: existing } = await admin.from("bot_warnings").select("*")
        .eq("session_id", session.id).eq("group_jid", b.group_jid).eq("user_jid", b.user_jid).maybeSingle();
      const now = new Date();
      const expired = existing?.expires_at && new Date(existing.expires_at) < now;
      const count = (expired || !existing) ? 1 : (existing.count + 1);
      const expires_at = new Date(now.getTime() + expireDays * 86400_000).toISOString();
      const banned = count >= threshold;

      await admin.from("bot_warnings").upsert({
        session_id: session.id, group_jid: b.group_jid, user_jid: b.user_jid,
        count, reason: b.reason || null, last_at: now.toISOString(), expires_at,
        banned_at: banned ? now.toISOString() : null,
      }, { onConflict: "session_id,group_jid,user_jid" });

      await admin.from("bot_logs").insert({
        session_id: session.id, kind: banned ? "ban" : "warning",
        group_jid: b.group_jid, user_jid: b.user_jid,
        payload: { count, threshold, reason: b.reason || null },
      });
      return jsonResponse({ count, threshold, banned });
    }

    // POST /call  { from_jid }  → applique la logique anti-spam d'appels
    if (path === "/call" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (!b.from_jid) return jsonResponse({ error: "missing from_jid" }, 400);
      const { data: cfg } = await admin.from("bot_config").select("call_spam_threshold,call_spam_window_min,call_block_hours").eq("session_id", session.id).maybeSingle();
      const threshold = cfg?.call_spam_threshold ?? 3;
      const windowMin = cfg?.call_spam_window_min ?? 10;
      const blockH = cfg?.call_block_hours ?? 24;
      const sinceIso = new Date(Date.now() - windowMin * 60_000).toISOString();
      const { count } = await admin.from("bot_call_events")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id).eq("from_jid", b.from_jid).gte("created_at", sinceIso);
      const shouldBlock = (count || 0) + 1 >= threshold;
      const blocked_until = shouldBlock ? new Date(Date.now() + blockH * 3600_000).toISOString() : null;
      await admin.from("bot_call_events").insert({
        session_id: session.id, from_jid: b.from_jid,
        event: shouldBlock ? "blocked" : "rejected", blocked_until,
      });
      return jsonResponse({ block: shouldBlock, blocked_until });
    }

    // POST /ai_reply  { from_jid, from_name?, text }
    if (path === "/ai_reply" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (!b.text) return jsonResponse({ error: "missing text" }, 400);
      const secret = req.headers.get("x-session-secret") || "";
      const aiResp = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/bot-ai`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            session_secret: secret,
            from_jid: b.from_jid, from_name: b.from_name || null, text: b.text,
          }),
        },
      );
      const j = await aiResp.json().catch(() => ({}));
      return jsonResponse(j, aiResp.status);
    }

    return jsonResponse({ error: "not found" }, 404);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
});
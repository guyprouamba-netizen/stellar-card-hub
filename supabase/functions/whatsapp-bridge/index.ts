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

    return jsonResponse({ error: "not found" }, 404);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
});
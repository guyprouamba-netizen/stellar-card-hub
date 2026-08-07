// Assistant IA du tableau de bord admin — répond en langage naturel sur les
// métriques de la plateforme (trafic, financier, rétention) via Lovable AI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function db() { return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } }); }

async function getAdmin(req: Request) {
  const h = req.headers.get("Authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) throw new Error("Unauthorized");
  const token = h.slice(7);
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  const admin = db();
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  if (!role) throw new Error("Forbidden");
  return data.user;
}

const num = (v: unknown) => Number(v || 0);

async function snapshot(admin: ReturnType<typeof db>, days: number) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const prevSince = new Date(Date.now() - 2 * days * 86400_000).toISOString();

  const [tx, sessions, cards, users, withdrawals, transfers] = await Promise.all([
    admin.from("transactions").select("type,status,amount,currency,created_at").gte("created_at", prevSince).limit(5000),
    admin.from("analytics_sessions").select("id,user_id,device_type,browser,country,city,traffic_source,started_at,duration_seconds,page_views").gte("started_at", prevSince).limit(5000),
    admin.from("cards").select("id,status,balance,created_at").limit(2000),
    admin.from("profiles").select("id,created_at").gte("created_at", prevSince).limit(5000),
    admin.from("withdrawals").select("amount,status,created_at").gte("created_at", prevSince).limit(2000),
    admin.from("internal_transfers").select("amount,status,created_at").gte("created_at", prevSince).limit(2000),
  ]);

  const inWindow = <T extends { created_at?: string; started_at?: string }>(rows: T[] | null) =>
    (rows || []).filter((r) => String(r.created_at || r.started_at || "") >= since);

  const txCur = inWindow(tx.data as any[]);
  const sumType = (t: string) => txCur.filter((r: any) => r.type === t && r.status === "success").reduce((s: number, r: any) => s + num(r.amount), 0);

  const sessCur = inWindow(sessions.data as any[]) as any[];
  const tally = (rows: any[], key: string) => {
    const m = new Map<string, number>();
    for (const r of rows) { const k = String(r[key] || "inconnu"); m.set(k, (m.get(k) || 0) + 1); }
    return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));
  };

  const allCards = (cards.data || []) as any[];
  return {
    periode_jours: days,
    utilisateurs: {
      nouveaux: inWindow(users.data as any[]).length,
      periode_precedente: (users.data || []).length - inWindow(users.data as any[]).length,
    },
    trafic: {
      sessions: sessCur.length,
      visiteurs_uniques: new Set(sessCur.map((s) => s.user_id || s.id)).size,
      duree_moyenne_s: sessCur.length ? Math.round(sessCur.reduce((s, r) => s + num(r.duration_seconds), 0) / sessCur.length) : 0,
      pages_vues: sessCur.reduce((s, r) => s + num(r.page_views), 0),
      par_appareil: tally(sessCur, "device_type"),
      par_source: tally(sessCur, "traffic_source"),
      par_pays: tally(sessCur, "country"),
      par_ville: tally(sessCur, "city"),
    },
    financier_xof: {
      depots: sumType("deposit"),
      retraits: sumType("withdrawal"),
      frais: sumType("fee"),
      emissions_carte: sumType("card_issue"),
      recharges_carte: sumType("card_fund"),
      transferts_internes: inWindow(transfers.data as any[]).reduce((s: number, r: any) => s + num(r.amount), 0),
      retraits_en_attente: (withdrawals.data || []).filter((w: any) => w.status === "pending").length,
    },
    cartes: {
      total: allCards.length,
      actives: allCards.filter((c) => c.status === "active").length,
      gelees: allCards.filter((c) => String(c.status).startsWith("frozen")).length,
      solde_total_usd: Math.round(allCards.reduce((s, c) => s + num(c.balance), 0) * 100) / 100,
      creees_periode: inWindow(allCards).length,
    },
  };
}

async function callAI(messages: unknown[]) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({ model: "google/gemini-3.6-flash", messages }),
  });
  if (r.status === 429) throw new Error("Limite IA atteinte — réessayez dans quelques minutes");
  if (r.status === 402) throw new Error("Crédits IA épuisés — rechargez votre espace de travail");
  if (!r.ok) throw new Error(`Assistant IA: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const user = await getAdmin(req);
    const admin = db();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "chat");

    if (action === "history") {
      const { data: conv } = await admin.from("dashboard_ai_conversations")
        .select("id,title,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (!conv) return jsonResponse({ ok: true, conversation: null, messages: [] });
      const { data: msgs } = await admin.from("dashboard_ai_messages")
        .select("id,role,content,created_at").eq("conversation_id", conv.id).order("created_at").limit(100);
      return jsonResponse({ ok: true, conversation: conv, messages: msgs || [] });
    }

    if (action !== "chat") return jsonResponse({ error: "Action inconnue" }, 400);

    const question = String(body.message || "").slice(0, 2000);
    if (!question) return jsonResponse({ error: "message requis" }, 400);
    const days = Math.min(90, Math.max(1, Number(body.days) || 30));

    let conversationId: string | null = body.conversation_id || null;
    if (!conversationId) {
      const { data: conv, error } = await admin.from("dashboard_ai_conversations")
        .insert({ user_id: user.id, title: question.slice(0, 60) }).select("id").single();
      if (error) throw new Error(error.message);
      conversationId = conv.id;
    }

    const { error: umErr } = await admin.from("dashboard_ai_messages")
      .insert({ conversation_id: conversationId, role: "user", content: question });
    if (umErr) throw new Error(umErr.message);

    const { data: hist } = await admin.from("dashboard_ai_messages")
      .select("role,content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(12);

    const snap = await snapshot(admin, days);
    const system = `Tu es l'analyste IA du tableau de bord administrateur de FASO (néobanque burkinabè).
Tu réponds en français, de façon sobre et professionnelle, avec des chiffres précis.
Structure: une réponse directe en 1-2 phrases, puis les chiffres clés en liste courte, puis 1-3 recommandations concrètes si pertinent.
N'invente jamais un chiffre : utilise UNIQUEMENT les données ci-dessous, et dis clairement quand une donnée manque.
Les montants sont en XOF sauf le solde des cartes en USD.

DONNÉES (${days} derniers jours):
${JSON.stringify(snap, null, 1)}`;

    const reply = await callAI([
      { role: "system", content: system },
      ...((hist || []).reverse().slice(0, -1).map((m: any) => ({ role: m.role, content: m.content }))),
      { role: "user", content: question },
    ]);

    const { data: saved, error: amErr } = await admin.from("dashboard_ai_messages")
      .insert({ conversation_id: conversationId, role: "assistant", content: reply })
      .select("id,role,content,created_at").single();
    if (amErr) throw new Error(amErr.message);
    await admin.from("dashboard_ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    await admin.from("admin_audit_log").insert({ actor_id: user.id, action: "dashboard_ai_query", metadata: { question, days } });

    return jsonResponse({ ok: true, conversation_id: conversationId, message: saved, snapshot: snap });
  } catch (e) {
    const m = (e as Error).message;
    return jsonResponse({ error: m }, m === "Unauthorized" ? 401 : m === "Forbidden" ? 403 : 400);
  }
});

// AI Business Coach — uses Lovable AI Gateway (Gemini) to deliver strategic
// advice, motivational tips and alerts based on the merchant's recent activity.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function getUser(req: Request) {
  const h = req.headers.get("Authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) throw new Error("Unauthorized");
  const token = h.slice(7);
  const c = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await c.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user;
}
function db() { return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } }); }

async function gatherContext(admin: any, businessId: string, projectId?: string) {
  const { data: biz } = await admin.from("businesses").select("id,name,balance,currency").eq("id", businessId).single();
  const projects = projectId
    ? (await admin.from("projects").select("*").eq("id", projectId)).data
    : (await admin.from("projects").select("*").eq("business_id", businessId)).data;
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: payments } = await admin.from("payment_link_payments")
    .select("amount,net_amount,status,created_at,project_id")
    .eq("business_id", businessId).gte("created_at", since).limit(500);
  const totalIn = (payments || []).filter((p: any) => p.status === "success").reduce((s: number, p: any) => s + Number(p.net_amount || 0), 0);
  const count = (payments || []).filter((p: any) => p.status === "success").length;
  return { biz, projects: projects || [], payments30d: payments || [], summary: { totalIn, count, days: 30 } };
}

function systemPrompt(ctx: any) {
  return `Tu es FASO Coach, un coach business IA pour micro-entrepreneurs ouest-africains (Burkina Faso). Tu es chaleureux, encourageant comme Duolingo, direct et concret.
Tu réponds TOUJOURS en français simple. Tes conseils sont actionnables, locaux (réalité BF, mobile money, marché informel) et adaptés au stade du commerçant.
Tu peux: féliciter une réussite (streak), alerter sur une baisse de CA, proposer 1-3 actions concrètes, suggérer un objectif chiffré, recommander un canal (présentiel/QR/lien).
Style: 3-6 phrases max, émojis utilisés avec parcimonie (max 2), pas de blabla.

CONTEXTE BUSINESS:
- Nom: ${ctx.biz?.name}
- Solde encaissé: ${ctx.biz?.balance} ${ctx.biz?.currency}
- Projets actifs: ${ctx.projects.length} (${ctx.projects.map((p: any) => `${p.name}: solde ${p.balance}/objectif ${p.financial_goal}`).join("; ")})
- CA des 30 derniers jours: ${ctx.summary.totalIn} XOF sur ${ctx.summary.count} paiements

Si l'utilisateur demande "tip du jour" → propose UN micro-défi concret pour la journée.
Si "stratégie" → propose un plan en 3 étapes.
Si "alerte" → analyse les chiffres et signale les risques.`;
}

async function callAI(messages: any[]) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.7 }),
  });
  if (r.status === 429) throw new Error("Limite IA atteinte — réessayez dans quelques minutes");
  if (r.status === 402) throw new Error("Crédits IA épuisés — contactez l'admin");
  if (!r.ok) throw new Error(`Coach IA: ${r.status}`);
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content || "").trim();
}

async function assertOwner(admin: any, userId: string, businessId: string) {
  const { data } = await admin.from("businesses").select("owner_id").eq("id", businessId).maybeSingle();
  if (!data || data.owner_id !== userId) throw new Error("Forbidden");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const user = await getUser(req);
    const admin = db();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "chat");
    const businessId = String(body.business_id || "");
    if (!businessId) return jsonResponse({ error: "business_id requis" }, 400);
    await assertOwner(admin, user.id, businessId);
    const ctx = await gatherContext(admin, businessId, body.project_id);

    if (action === "chat") {
      const userMsg = String(body.message || "").slice(0, 2000);
      if (!userMsg) return jsonResponse({ error: "message requis" }, 400);
      // Save user message
      await admin.from("coach_messages").insert({
        business_id: businessId, project_id: body.project_id || null,
        role: "user", kind: "tip", content: userMsg,
      });
      // History (last 10)
      const { data: hist } = await admin.from("coach_messages")
        .select("role,content").eq("business_id", businessId).order("created_at", { ascending: false }).limit(10);
      const messages = [
        { role: "system", content: systemPrompt(ctx) },
        ...((hist || []).reverse().map((m: any) => ({ role: m.role, content: m.content }))),
        { role: "user", content: userMsg },
      ];
      const reply = await callAI(messages);
      const { data: saved } = await admin.from("coach_messages").insert({
        business_id: businessId, project_id: body.project_id || null,
        role: "assistant", kind: "tip", content: reply,
      }).select("*").single();
      return jsonResponse({ ok: true, message: saved });
    }

    if (action === "daily_tip" || action === "alert" || action === "strategy") {
      const prompts: Record<string, string> = {
        daily_tip: "Donne-moi le tip du jour: un micro-défi concret pour booster mes ventes aujourd'hui.",
        alert: "Analyse mes chiffres et donne-moi UNE alerte importante (positive ou négative).",
        strategy: "Propose-moi une stratégie en 3 étapes pour atteindre mon objectif financier.",
      };
      const reply = await callAI([
        { role: "system", content: systemPrompt(ctx) },
        { role: "user", content: prompts[action] },
      ]);
      const kind = action === "alert" ? "alert" : action === "strategy" ? "strategy" : "tip";
      const { data: saved } = await admin.from("coach_messages").insert({
        business_id: businessId, project_id: body.project_id || null,
        role: "assistant", kind, content: reply,
      }).select("*").single();
      return jsonResponse({ ok: true, message: saved });
    }

    if (action === "generate_plan") {
      const projectId = String(body.project_id || "");
      if (!projectId) return jsonResponse({ error: "project_id requis" }, 400);
      const reply = await callAI([
        { role: "system", content: systemPrompt(ctx) + "\n\nRENDS UN JSON STRICT: {\"title\": string, \"steps\": [{\"label\": string, \"done\": false}], \"description\": string}" },
        { role: "user", content: "Propose un plan d'action concret en 4-6 étapes pour atteindre mon objectif financier sur ce projet. Réponds UNIQUEMENT en JSON valide." },
      ]);
      let parsed: any = null;
      try { parsed = JSON.parse(reply.replace(/^```json\s*|\s*```$/g, "")); } catch { parsed = { title: "Plan d'action", steps: [], description: reply }; }
      const { data: plan } = await admin.from("action_plans").insert({
        business_id: businessId, project_id: projectId,
        title: parsed.title || "Plan d'action IA", description: parsed.description || null,
        steps: parsed.steps || [], ai_generated: true, status: "todo",
      }).select("*").single();
      return jsonResponse({ ok: true, plan });
    }

    return jsonResponse({ error: "Action inconnue" }, 400);
  } catch (e) {
    const m = (e as Error).message;
    return jsonResponse({ error: m }, m === "Unauthorized" ? 401 : m === "Forbidden" ? 403 : 400);
  }
});
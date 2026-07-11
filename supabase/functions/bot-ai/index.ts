// Agent IA du bot Chat PAY. Appelé par le worker via le bridge.
// Génère une réponse dans le style du marchand en tenant compte : persona, langue,
// FAQ personnalisée, produits actifs et derniers messages de la conversation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function loadContext(session_id: string, business_id: string | null) {
  const [{ data: cfg }, faqRes, prodRes, bizRes] = await Promise.all([
    admin.from("bot_config").select("*").eq("session_id", session_id).maybeSingle(),
    business_id ? admin.from("bot_ai_faq").select("question,answer").eq("business_id", business_id).eq("active", true).limit(30) : Promise.resolve({ data: [] }),
    business_id ? admin.from("products").select("name,price,currency,description").limit(20) : Promise.resolve({ data: [] }),
    business_id ? admin.from("businesses").select("name,description,contact_email,contact_phone,public_slug").eq("id", business_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { cfg, faq: (faqRes as any).data || [], products: (prodRes as any).data || [], business: (bizRes as any).data || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const { session_secret, from_jid, from_name, text } = await req.json();
    if (!session_secret || !text) return jsonResponse({ error: "missing fields" }, 400);

    const { data: session } = await admin.from("whatsapp_sessions")
      .select("id,business_id").eq("connection_secret", session_secret).maybeSingle();
    if (!session) return jsonResponse({ error: "invalid session" }, 401);

    const ctx = await loadContext(session.id, session.business_id);
    if (!ctx.cfg?.ai_enabled) return jsonResponse({ reply: null, reason: "ai_disabled" });

    // Upsert conversation
    const { data: conv } = await admin.from("bot_ai_conversations")
      .upsert({
        session_id: session.id, business_id: session.business_id,
        contact_jid: from_jid, contact_name: from_name || null,
        last_message_at: new Date().toISOString(),
      }, { onConflict: "session_id,contact_jid" })
      .select("id,handoff").single();

    // Persist user message
    await admin.from("bot_ai_messages").insert({ conversation_id: conv!.id, role: "user", content: text });

    if (conv!.handoff) {
      // Le marchand a repris la main → ne pas répondre automatiquement
      return jsonResponse({ reply: null, reason: "handoff" });
    }

    // Historique récent
    const { data: history } = await admin.from("bot_ai_messages")
      .select("role,content").eq("conversation_id", conv!.id)
      .order("created_at", { ascending: false }).limit(12);
    const past = (history || []).reverse().filter((m) => m.role === "user" || m.role === "assistant");

    const persona = ctx.cfg.ai_persona || "Assistant du marchand.";
    const lang = ctx.cfg.ai_language || "fr";
    const biz = ctx.business;
    const faqText = ctx.faq.map((f: any, i: number) => `${i + 1}. Q: ${f.question}\n   R: ${f.answer}`).join("\n") || "(aucune)";
    const prodText = ctx.products.map((p: any) => `- ${p.name}${p.price ? ` — ${p.price} ${p.currency || ""}` : ""}${p.description ? ` (${String(p.description).slice(0, 80)})` : ""}`).join("\n") || "(aucun produit renseigné)";
    const shopLink = biz?.public_slug ? `https://${new URL(Deno.env.get("SUPABASE_URL")!).host.replace(".supabase.co", ".lovable.app")}/shop/${biz.public_slug}` : "";

    const system = [
      persona,
      `Langue de réponse : ${lang}.`,
      biz ? `Marchand : ${biz.name}. ${biz.description || ""}` : "",
      `Contact : ${biz?.contact_email || ""} ${biz?.contact_phone || ""}`.trim(),
      shopLink ? `Lien boutique : ${shopLink}` : "",
      "\nCatalogue produits :\n" + prodText,
      "\nFAQ prioritaire :\n" + faqText,
      "\nRègles : Réponse courte (max 3 phrases), naturelle, jamais robotique. Si tu ne sais pas, propose de mettre un humain en ligne. N'invente jamais de prix ni de délais.",
    ].filter(Boolean).join("\n");

    const messages = [
      { role: "system", content: system },
      ...past.map((m) => ({ role: m.role, content: m.content })),
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({ model: "openai/gpt-5.5", messages }),
    });
    if (resp.status === 429) return jsonResponse({ error: "rate_limited" }, 429);
    if (resp.status === 402) return jsonResponse({ error: "credits_exhausted" }, 402);
    if (!resp.ok) return jsonResponse({ error: await resp.text() }, 502);
    const j = await resp.json();
    const reply = j?.choices?.[0]?.message?.content?.trim() || "";

    if (reply) {
      await admin.from("bot_ai_messages").insert({ conversation_id: conv!.id, role: "assistant", content: reply });
    }
    return jsonResponse({ reply, conversation_id: conv!.id });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
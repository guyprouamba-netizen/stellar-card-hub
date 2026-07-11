// OAuth Meta / Facebook Ads : échange le code contre un access_token long durée
// et enregistre l'intégration pour le business.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const APP_ID = Deno.env.get("META_APP_ID") || "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

async function getUserId(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const c = createClient(Deno.env.get("SUPABASE_URL")!, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await c.auth.getUser(auth.slice(7));
  return data.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/facebook-oauth/, "") || "/";

  try {
    if (!APP_ID || !APP_SECRET) {
      return jsonResponse({ error: "Meta app non configurée : ajoute META_APP_ID et META_APP_SECRET dans les secrets." }, 400);
    }

    if (path === "/authorize" && req.method === "POST") {
      const uid = await getUserId(req);
      if (!uid) return jsonResponse({ error: "Unauthorized" }, 401);
      const { business_id, redirect_uri } = await req.json();
      const { data: biz } = await admin.from("businesses").select("id,owner_id").eq("id", business_id).maybeSingle();
      if (!biz || biz.owner_id !== uid) return jsonResponse({ error: "Forbidden" }, 403);
      const state = btoa(JSON.stringify({ business_id, ts: Date.now() }));
      const scopes = "ads_management,ads_read,business_management,pages_show_list,pages_read_engagement";
      const auth = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state}&scope=${scopes}&response_type=code`;
      return jsonResponse({ url: auth });
    }

    if (path === "/callback" && req.method === "POST") {
      const uid = await getUserId(req);
      if (!uid) return jsonResponse({ error: "Unauthorized" }, 401);
      const { code, state, redirect_uri } = await req.json();
      const dec = JSON.parse(atob(state));
      const business_id = dec.business_id;
      const { data: biz } = await admin.from("businesses").select("id,owner_id").eq("id", business_id).maybeSingle();
      if (!biz || biz.owner_id !== uid) return jsonResponse({ error: "Forbidden" }, 403);

      const p1 = new URLSearchParams({
        client_id: APP_ID, client_secret: APP_SECRET, redirect_uri, code,
      });
      const r1 = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${p1}`);
      const j1 = await r1.json();
      if (!r1.ok) return jsonResponse({ error: j1?.error?.message || "OAuth exchange failed" }, 400);

      const p2 = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: APP_ID, client_secret: APP_SECRET,
        fb_exchange_token: j1.access_token,
      });
      const r2 = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${p2}`);
      const j2 = await r2.json();
      const token = j2.access_token || j1.access_token;

      const me = await (await fetch(`https://graph.facebook.com/v20.0/me?access_token=${token}`)).json();
      const adRes = await (await fetch(`https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name,currency&access_token=${token}`)).json();
      const pageRes = await (await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=id,name&access_token=${token}`)).json();
      const ad = adRes?.data?.[0];
      const pg = pageRes?.data?.[0];
      const expires_at = j2.expires_in ? new Date(Date.now() + j2.expires_in * 1000).toISOString() : null;

      await admin.from("facebook_integrations").upsert({
        business_id, meta_user_id: me.id, access_token: token,
        ad_account_id: ad?.id || null, page_id: pg?.id || null, page_name: pg?.name || null,
        scopes: "ads_management,ads_read,business_management,pages_show_list",
        expires_at,
      }, { onConflict: "business_id" });

      return jsonResponse({
        ok: true, meta_user: me, ad_accounts: adRes?.data || [], pages: pageRes?.data || [],
      });
    }

    return jsonResponse({ error: "not found" }, 404);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
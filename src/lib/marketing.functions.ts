import { callApi } from "./api-client";
import { supabase } from "@/integrations/supabase/client";

export const getFacebookIntegration = (business_id: string) =>
  callApi("getFacebookIntegration", { business_id });
export const disconnectFacebook = (business_id: string) =>
  callApi("disconnectFacebook", { business_id });
export const listFacebookCampaigns = (business_id: string) =>
  callApi("listFacebookCampaigns", { business_id });
export const createFacebookCampaign = (business_id: string, data: { name: string; objective?: string; daily_budget?: number }) =>
  callApi("createFacebookCampaign", { business_id, ...data });

export async function startFacebookOAuth(business_id: string) {
  const redirect_uri = `${window.location.origin}/business/${business_id}/marketing?fb=callback`;
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-oauth/authorize`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ business_id, redirect_uri }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "OAuth init failed");
  window.location.href = j.url;
}

export async function completeFacebookOAuth(code: string, state: string, business_id: string) {
  const redirect_uri = `${window.location.origin}/business/${business_id}/marketing?fb=callback`;
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-oauth/callback`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ code, state, redirect_uri }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "OAuth completion failed");
  return j;
}
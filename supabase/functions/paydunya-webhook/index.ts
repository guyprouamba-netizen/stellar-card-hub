import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import * as PD from "../_shared/paydunya.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log("Paydunya Webhook payload:", payload);

    // Verify invoice with Paydunya
    const token = payload?.token || payload?.data?.token;
    if (!token) return jsonResponse({ error: "No token" }, 400);

    const confirmation = await PD.verifyInvoice(token);
    if (confirmation.response_code !== "00" || confirmation.status !== "completed") {
      return jsonResponse({ ok: false, status: confirmation.status });
    }

    // Invoice confirmed, update database
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    
    // Logic to record the successful payment...
    // In a real scenario, we'd find the pending transaction via custom_data or token
    
    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("Paydunya Webhook error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});

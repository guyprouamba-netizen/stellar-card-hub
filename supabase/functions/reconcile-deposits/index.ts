import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

// Cron-callable: scans ALL pending YengaPay deposit transactions and credits any
// that the provider reports as paid. Self-healing path that does NOT rely on webhooks.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const apiKey = Deno.env.get("YENGAPAY_API_KEY");
  const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
  if (!apiKey || !groupId) {
    return new Response(JSON.stringify({ ok: false, error: "YengaPay env missing" }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pendings } = await admin
    .from("transactions")
    .select("id,user_id,amount,status,metadata,provider_ref,currency,type")
    .eq("type", "deposit").eq("status", "pending").eq("provider", "yengapay")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(200);

  let credited = 0, failed = 0, stillPending = 0;

  for (const tx of pendings ?? []) {
    const piid = (tx.metadata as any)?.paymentIntentId;
    const candidates: string[] = [];
    if (piid) candidates.push(`https://api.yengapay.com/api/v1/groups/${groupId}/payment-intent/${piid}`);
    candidates.push(`https://api.yengapay.com/api/v1/groups/${groupId}/payment-intent/reference/${tx.provider_ref}`);

    let body: any = null, ok = false;
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: { "x-api-key": apiKey } });
        const t = await r.text();
        try { body = JSON.parse(t); } catch { body = t; }
        if (r.ok) { ok = true; break; }
      } catch { /* try next */ }
    }
    if (!ok) { stillPending++; continue; }

    const st = String(body?.status || body?.paymentStatus || body?.data?.status || "").toUpperCase();
    const paid = ["DONE", "SUCCESS", "SUCCEEDED", "COMPLETED", "PAID"].includes(st);
    const isFailed = ["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(st);

    if (paid) {
      // Claim the row atomically so concurrent runs cannot double-credit.
      const { data: updated } = await admin.from("transactions")
        .update({ status: "success", metadata: { ...(tx.metadata as any), reconcile_cron: body } })
        .eq("id", tx.id).eq("status", "pending").select("id").maybeSingle();
      if (updated) {
        const { data: w } = await admin.from("wallets")
          .select("id,balance").eq("user_id", tx.user_id).eq("currency", tx.currency || "XOF").maybeSingle();
        if (w) await admin.from("wallets").update({ balance: Number(w.balance) + Number(tx.amount) }).eq("id", w.id);
        credited++;
      }
    } else if (isFailed) {
      await admin.from("transactions")
        .update({ status: "failed", metadata: { ...(tx.metadata as any), reconcile_cron: body } })
        .eq("id", tx.id).eq("status", "pending");
      failed++;
    } else {
      stillPending++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: pendings?.length ?? 0, credited, failed, pending: stillPending, at: new Date().toISOString() }),
    { headers: { ...corsHeaders, "content-type": "application/json" } },
  );
});
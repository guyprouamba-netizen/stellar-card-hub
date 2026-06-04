import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/yengapay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.YENGAPAY_WEBHOOK_SECRET;
        if (!secret) return new Response("Missing webhook secret", { status: 500 });

        const raw = await request.text();
        const sig = request.headers.get("x-yengapay-signature") || request.headers.get("x-signature") || "";
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        try {
          const a = Buffer.from(sig);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try { payload = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

        const reference: string | undefined = payload?.reference || payload?.data?.reference;
        const status: string | undefined = (payload?.status || payload?.data?.status || "").toLowerCase();
        if (!reference) return new Response("Missing reference", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tx } = await supabaseAdmin
          .from("transactions").select("id,user_id,amount,status").eq("provider_ref", reference).maybeSingle();
        if (!tx) return new Response("Tx not found", { status: 404 });
        if (tx.status === "success") return new Response("ok");

        if (status === "success" || status === "completed" || status === "paid") {
          await supabaseAdmin.from("transactions").update({ status: "success", metadata: payload }).eq("id", tx.id);
          const { data: w } = await supabaseAdmin.from("wallets").select("id,balance").eq("user_id", tx.user_id).eq("currency", "XOF").maybeSingle();
          if (w) await supabaseAdmin.from("wallets").update({ balance: Number(w.balance) + Number(tx.amount) }).eq("id", w.id);
        } else if (status === "failed" || status === "cancelled") {
          await supabaseAdmin.from("transactions").update({ status: "failed", metadata: payload }).eq("id", tx.id);
        }
        return new Response("ok");
      },
    },
  },
});
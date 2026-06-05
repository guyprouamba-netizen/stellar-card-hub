import { createFileRoute } from "@tanstack/react-router";
import { strowalletCardAction } from "@/lib/strowallet.server";
import { createHmac, timingSafeEqual } from "crypto";

// Webhook Strowallet :
// - vérifie la signature HMAC si STROWALLET_WEBHOOK_SECRET est configuré
// - traite les événements KYC (approved/rejected) → MAJ kyc_submissions
// - traite les événements carte (success/failure) → met à jour status + gèle auto si échec
export const Route = createFileRoute("/api/public/strowallet-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STROWALLET_WEBHOOK_SECRET;
        if (!secret) {
          console.error("STROWALLET_WEBHOOK_SECRET not configured — refusing webhook");
          return new Response("Webhook secret not configured", { status: 500 });
        }
        const body = await request.text();
        const sig = request.headers.get("x-strowallet-signature") || request.headers.get("x-webhook-signature") || "";
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }
        let payload: any;
        try { payload = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }

        const eventType: string = payload?.event || payload?.type || "";
        const lowerEvent = eventType.toLowerCase();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // --- KYC events --------------------------------------------------
        if (lowerEvent.includes("kyc") || lowerEvent.includes("customer")) {
          const customerId: string | undefined = payload?.data?.customerId || payload?.customerId || payload?.data?.bitvcard_customer_id;
          const customerEmail: string | undefined = payload?.data?.customerEmail || payload?.customerEmail || payload?.data?.email;
          let userId: string | null = null;
          if (customerId) {
            const { data: p } = await supabaseAdmin.from("profiles").select("id").eq("strowallet_customer_id", customerId).maybeSingle();
            userId = p?.id ?? null;
          }
          if (!userId && customerEmail) {
            const { data: p } = await supabaseAdmin.from("profiles").select("id").eq("email", customerEmail).maybeSingle();
            userId = p?.id ?? null;
          }
          if (userId) {
            const { normalizeKycVerdict } = await import("@/lib/strowallet.server");
            const { raw, verdict } = normalizeKycVerdict(payload);
            const status = verdict === "approved" ? "approved" : verdict === "rejected" ? "rejected" : undefined;
            await supabaseAdmin.from("kyc_submissions").update({
              provider_status: raw ?? verdict,
              provider_response: payload as any,
              ...(status ? { status } : {}),
            }).eq("user_id", userId);
            if (customerId) {
              await supabaseAdmin.from("profiles").update({ strowallet_customer_id: customerId }).eq("id", userId);
            }
          }
          return new Response("ok", { status: 200 });
        }

        // --- Card events --------------------------------------------------
        const cardId: string | undefined = payload?.data?.card_id || payload?.card_id;
        if (!cardId) return new Response("ok", { status: 200 });

        const { data: card } = await supabaseAdmin.from("cards").select("id,user_id,failed_attempts,status").eq("provider_card_id", cardId).maybeSingle();
        if (!card) return new Response("unknown card", { status: 200 });

        const failureEvents = ["card.transaction.declined","card.payment.failed","transaction.declined","payment_failed","card.transaction.failed"];
        const successEvents = ["card.transaction.success","card.payment.success","transaction.success"];

        if (failureEvents.some((e) => lowerEvent.includes(e.toLowerCase()))) {
          const attempts = (card.failed_attempts ?? 0) + 1;
          // gèle dès la 1ʳᵉ tentative échouée
          try { await strowalletCardAction("freeze", cardId); } catch (_) { /* ignore */ }
          await supabaseAdmin.from("cards").update({
            failed_attempts: attempts,
            status: "frozen_auto",
            auto_frozen_at: new Date().toISOString(),
          }).eq("id", card.id);
          await supabaseAdmin.from("transactions").insert({
            user_id: card.user_id, type: "card_auto_freeze", status: "success",
            amount: 0, currency: "USD", provider: "strowallet", provider_ref: cardId,
            description: "Carte gelée automatiquement après tentative de paiement échouée",
            metadata: payload,
          });
        } else if (successEvents.some((e) => lowerEvent.includes(e.toLowerCase()))) {
          await supabaseAdmin.from("cards").update({ failed_attempts: 0 }).eq("id", card.id);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
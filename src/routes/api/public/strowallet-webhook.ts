import { createFileRoute } from "@tanstack/react-router";
import { strowalletCardAction } from "@/lib/strowallet.server";

// Webhook Strowallet : sur 1ʳᵉ tentative de paiement échouée → gèle automatique
// TODO: ajouter la vérification HMAC dès que STROWALLET_WEBHOOK_SECRET sera fourni
export const Route = createFileRoute("/api/public/strowallet-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        let payload: any;
        try { payload = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }

        const eventType: string = payload?.event || payload?.type || "";
        const cardId: string | undefined = payload?.data?.card_id || payload?.card_id;
        if (!cardId) return new Response("ok", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: card } = await supabaseAdmin.from("cards").select("id,user_id,failed_attempts,status").eq("provider_card_id", cardId).maybeSingle();
        if (!card) return new Response("unknown card", { status: 200 });

        const failureEvents = ["card.transaction.declined","card.payment.failed","transaction.declined","payment_failed","card.transaction.failed"];
        const successEvents = ["card.transaction.success","card.payment.success","transaction.success"];

        if (failureEvents.some((e) => eventType.toLowerCase().includes(e.toLowerCase()))) {
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
        } else if (successEvents.some((e) => eventType.toLowerCase().includes(e.toLowerCase()))) {
          await supabaseAdmin.from("cards").update({ failed_attempts: 0 }).eq("id", card.id);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
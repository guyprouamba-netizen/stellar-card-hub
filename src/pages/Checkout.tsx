import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getCheckout } from "@/lib/pay.functions";
import { MomoPayment } from "@/components/momo-payment";
import { Loader2, X } from "lucide-react";

/** Page de paiement hébergée par FASO-INVEST PAY (sessions API marchands). */
export default function CheckoutPage() {
  const { reference = "" } = useParams();
  const [ctx, setCtx] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCheckout(reference).then(setCtx).catch((e) => setError(e.message));
  }, [reference]);

  if (error) return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <X className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 font-[Space_Grotesk] text-2xl font-bold">Paiement indisponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    </div>
  );
  if (!ctx) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const biz = ctx.business;
  const p = ctx.payment;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="text-center">
          {biz?.logo_url
            ? <img src={biz.logo_url} alt={biz.name} className="mx-auto h-16 w-16 rounded-2xl object-cover" />
            : <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-primary font-[Space_Grotesk] text-2xl font-bold text-primary-foreground">{biz?.name?.[0] || "F"}</div>}
          <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Vous payez</p>
          <h1 className="mt-1 font-[Space_Grotesk] text-2xl font-bold">{biz?.name || "Marchand"}</h1>
          {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
        </div>
        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card-premium">
          <MomoPayment
            reference={p.reference} amount={p.amount} currency={p.currency}
            onSuccess={() => { if (p.return_url) setTimeout(() => { window.location.href = p.return_url + (p.return_url.includes("?") ? "&" : "?") + `pay_ref=${encodeURIComponent(p.reference)}`; }, 1800); }}
          />
        </div>
      </div>
    </div>
  );
}

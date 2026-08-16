import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicLink, initCheckout, verifyPayment } from "@/lib/pay.functions";
import { MomoPayment } from "@/components/momo-payment";
import { Loader2, ShieldCheck, Smartphone, Check, X } from "lucide-react";

type Ctx = {
  business: { id: string; name: string; slug: string; logo_url: string | null };
  link: { id: string; slug: string; title: string; description: string | null; amount: number | null; min_amount: number | null; max_amount: number | null; currency: string };
};

export default function PayPage() {
  const { slug = "" } = useParams();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "checking" | "success" | "failed" | "pending">("idle");
  const [payRef, setPayRef] = useState<string | null>(null);

  useEffect(() => {
    getPublicLink(slug).then((r: any) => {
      setCtx({ business: r.business, link: r.link });
      setAmount(Number(r.link.amount ?? r.link.min_amount ?? 1000));
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, [slug]);

  // Auto verify on return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("pay_ref");
    if (!ref) return;
    setVerifyStatus("checking");
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const r: any = await verifyPayment(ref);
        if (r.status === "success") { setVerifyStatus("success"); return; }
        if (r.status === "failed") { setVerifyStatus("failed"); return; }
      } catch { /**/ }
      if (attempts < 20) setTimeout(tick, 3000);
      else setVerifyStatus("pending");
    };
    tick();
  }, []);

  async function submit() {
    if (!ctx) return;
    setSubmitting(true); setError(null);
    try {
      const r: any = await initCheckout({
        slug, amount: ctx.link.amount ? undefined : amount,
        customer_email: email,
        customer_name: name || undefined, customer_phone: phone || undefined,
      });
      
      if (r?.checkoutUrl) {
        window.location.href = r.checkoutUrl;
        return;
      }

      if (!r?.reference) throw new Error("Paiement indisponible pour le moment");
      setPayRef(r.reference);
      setSubmitting(false);
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !ctx) return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <X className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 font-[Space_Grotesk] text-2xl font-bold">Lien indisponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error || "Ce lien de paiement n'existe pas ou a été désactivé."}</p>
      </div>
    </div>
  );

  if (verifyStatus === "success") return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><Check className="h-10 w-10" /></div>
        <h1 className="mt-6 font-[Space_Grotesk] text-3xl font-bold">Paiement confirmé</h1>
        <p className="mt-2 text-sm text-muted-foreground">Merci ! Votre paiement à {ctx.business.name} a bien été reçu.</p>
      </div>
    </div>
  );
  if (verifyStatus === "failed") return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-destructive/15 text-destructive"><X className="h-10 w-10" /></div>
        <h1 className="mt-6 font-[Space_Grotesk] text-3xl font-bold">Paiement échoué</h1>
        <p className="mt-2 text-sm text-muted-foreground">Le paiement n'a pas abouti. Vous pouvez réessayer.</p>
        <button onClick={() => { window.history.replaceState({}, "", window.location.pathname); setVerifyStatus("idle"); }}
          className="mt-6 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Réessayer</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg px-6 py-12">
        {/* Merchant header */}
        <div className="text-center">
          {ctx.business.logo_url ? (
            <img src={ctx.business.logo_url} alt={ctx.business.name} className="mx-auto h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-primary font-[Space_Grotesk] text-2xl font-bold text-primary-foreground">
              {ctx.business.name[0]}
            </div>
          )}
          <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Vous payez</p>
          <h1 className="mt-1 font-[Space_Grotesk] text-2xl font-bold">{ctx.business.name}</h1>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card-premium">
          <h2 className="font-[Space_Grotesk] text-xl font-bold">{ctx.link.title}</h2>
          {ctx.link.description && <p className="mt-1 text-sm text-muted-foreground">{ctx.link.description}</p>}

          {payRef ? (
            <div className="mt-6 text-center py-12">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <p className="mt-6 font-bold text-lg">Redirection en cours...</p>
              <div className="hidden">
                <MomoPayment reference={payRef} amount={amount} currency={ctx.link.currency} defaultPhone={phone}
                  onSuccess={() => setVerifyStatus("success")} onCancel={() => setPayRef(null)} />
              </div>
            </div>
          ) : (
          <>
          <div className="mt-6">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant</label>
            <div className="mt-2 flex items-baseline gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <input type="number" inputMode="numeric" value={amount} disabled={!!ctx.link.amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-full bg-transparent font-[Space_Grotesk] text-3xl font-bold tabular-nums outline-none disabled:opacity-100" />
              <span className="text-sm font-semibold text-muted-foreground">{ctx.link.currency}</span>
            </div>
            {!ctx.link.amount && (ctx.link.min_amount || ctx.link.max_amount) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {ctx.link.min_amount && `min ${Number(ctx.link.min_amount).toLocaleString("fr-FR")}`} {ctx.link.max_amount && `· max ${Number(ctx.link.max_amount).toLocaleString("fr-FR")}`}
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom (optionnel)"
              className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-primary" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone (optionnel)"
              className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-primary" />
          </div>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Votre email (pour recevoir le reçu) *"
            className="mt-3 w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-primary" />

          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3">
            <Smartphone className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Paiement via Mobile Money — Orange · MTN · Moov · Wave</p>
          </div>

          {error && <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

          <button onClick={submit} disabled={submitting || amount <= 0 || !email || verifyStatus === "checking"}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {submitting || verifyStatus === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : `Continuer · ${Number(amount).toLocaleString("fr-FR")} ${ctx.link.currency}`}
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Paiement sécurisé
          </p>
          </>
          )}
        </div>

        {verifyStatus === "pending" && (
          <p className="mt-6 text-center text-xs text-amber-500">Paiement en cours de confirmation — vous serez crédité dès réception.</p>
        )}
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import {
  getPaypalWithdrawConfig, quotePaypalWithdrawal, initPaypalWithdrawal, listMyPaypalWithdrawals,
  type PaypalWdConfig,
} from "@/lib/paypal.functions";

const OPERATORS = [
  { code: "ORANGE_MONEY", label: "Orange Money" },
  { code: "MOOV_MONEY", label: "Moov Money" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "En attente de paiement PayPal",
  paid: "Paiement reçu — envoi en cours",
  disbursing: "Envoi vers le numéro…",
  delivered: "Versé ✅",
  failed: "Échoué",
};

export default function PaypalWithdrawPage() {
  const [cfg, setCfg] = useState<PaypalWdConfig | null>(null);
  const [amount, setAmount] = useState("");
  const [operator, setOperator] = useState<"ORANGE_MONEY" | "MOOV_MONEY">("ORANGE_MONEY");
  const [phone, setPhone] = useState("");
  const [holder, setHolder] = useState("");
  const [quote, setQuote] = useState<{ fees_xof: number; total_charged_xof: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  async function refresh() {
    try {
      const [c, h] = await Promise.all([getPaypalWithdrawConfig(), listMyPaypalWithdrawals()]);
      setCfg(c); setHistory(h || []);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { setQuote(null); return; }
    const t = setTimeout(async () => {
      try {
        const q = await quotePaypalWithdrawal(Math.floor(n));
        if (q.ok) setQuote({ fees_xof: q.fees_xof!, total_charged_xof: q.total_charged_xof! });
        else setQuote(null);
      } catch { setQuote(null); }
    }, 350);
    return () => clearTimeout(t);
  }, [amount]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await initPaypalWithdrawal({
        amount: Math.floor(Number(amount)), dest_operator: operator,
        dest_phone: phone, dest_holder: holder,
        returnUrl: `${window.location.origin}/paypal-withdraw`,
      });
      if (!r.ok || !r.checkout_url) { toast.error(r.error || "Impossible d'initier le retrait"); return; }
      window.location.href = r.checkout_url;
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString("fr-FR");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface-1/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="font-[Space_Grotesk] text-lg font-bold">Retrait PayPal</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-card-premium">
          <p className="text-sm text-muted-foreground">
            Renseignez le numéro Mobile Money qui doit recevoir l'argent, puis validez le paiement PayPal.
            Dès la confirmation, le versement part automatiquement vers votre numéro.
          </p>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Montant à recevoir (XOF)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-lg font-semibold outline-none focus:border-primary"
              placeholder="10000" required />
            {cfg && <p className="mt-1 text-xs text-muted-foreground">Min {fmt(cfg.min)} — Max {fmt(cfg.max)} XOF</p>}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opérateur</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {OPERATORS.map((o) => (
                <button type="button" key={o.code} onClick={() => setOperator(o.code)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${operator === o.code ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 hover:bg-muted"}`}>
                  <Smartphone className="mr-1.5 inline h-4 w-4" /> {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Seuls Orange Money et Moov Money sont acceptés.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Numéro bénéficiaire</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required
                className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 outline-none focus:border-primary" placeholder="70 00 00 00" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom du bénéficiaire</label>
              <input value={holder} onChange={(e) => setHolder(e.target.value)} required
                className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 outline-none focus:border-primary" placeholder="Nom Prénom" />
            </div>
          </div>

          {quote && (
            <div className="rounded-2xl border border-border bg-surface-2 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Montant reçu</span><span className="font-semibold">{fmt(Number(amount))} XOF</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Frais de retrait</span><span className="font-semibold">{fmt(quote.fees_xof)} XOF</span></div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base"><span>Total à payer</span><span className="font-bold text-primary">{fmt(quote.total_charged_xof)} XOF</span></div>
            </div>
          )}

          <button type="submit" disabled={loading || !quote}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Payer et retirer
          </button>
        </form>

        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="mb-3 font-[Space_Grotesk] font-bold">Mes retraits PayPal</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun retrait pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{fmt(h.amount_send)} XOF → {h.dest_phone}</p>
                    <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-FR")} · {h.dest_operator.replace("_", " ")}</p>
                  </div>
                  <span className="text-xs font-semibold">{STATUS_LABEL[h.status] || h.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
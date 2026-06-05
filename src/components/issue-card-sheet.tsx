import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ArrowRight, Check, AlertTriangle, CreditCard, Wallet } from "lucide-react";
import { cardApi, walletApi } from "@/lib/api";

type Brand = "visa" | "mastercard";
type Currency = "USD" | "XOF";
const FUND_PRESETS = [5, 10, 25, 50, 100];
const FUND_PRESETS_XOF = [2500, 5000, 10000, 25000, 50000];

export function IssueCardSheet({ open, onClose, onIssued }: { open: boolean; onClose: () => void; onIssued?: () => void }) {
  const [brand, setBrand] = useState<Brand>("visa");
  const [amount, setAmount] = useState<number>(10);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [checking, setChecking] = useState(false);
  const [afford, setAfford] = useState<{ can_afford: boolean; required: number; available: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Re-check funds whenever amount/currency changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setChecking(true);
    setError(null);
    walletApi
      .canAffordCard(amount, currency)
      .then((res) => {
        if (!cancelled) setAfford(res.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Vérification du solde impossible");
      })
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [open, amount, currency]);

  async function submit() {
    if (!afford?.can_afford) return;
    setSubmitting(true);
    setError(null);
    try {
      await cardApi.buy({ amount, currency, brand });
      setSuccess(true);
      onIssued?.();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Émission de la carte impossible");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl border border-border bg-card p-6 shadow-card-premium sm:bottom-1/2 sm:translate-y-1/2 sm:rounded-3xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-[Space_Grotesk] text-2xl font-bold tracking-tight">Nouvelle carte</h2>
                <p className="mt-1 text-sm text-muted-foreground">Carte virtuelle · {currency}</p>
              </div>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Currency */}
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Devise de la carte</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["USD","XOF"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCurrency(c); setAmount(c === "USD" ? 10 : 5000); }}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      currency === c ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:bg-muted"
                    }`}
                  >
                    <span>{c === "USD" ? "Dollar US ($)" : "Franc CFA (F)"}</span>
                    {currency === c && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand */}
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Réseau</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["visa", "mastercard"] as Brand[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBrand(b)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                      brand === b ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> {b}
                    </span>
                    {brand === b && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Initial funding */}
            <div className="mt-6">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Approvisionnement initial
              </label>
              <div className="mt-2 flex items-baseline gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-3">
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="w-full bg-transparent font-[Space_Grotesk] text-3xl font-bold tabular-nums outline-none"
                />
                <span className="text-sm font-semibold text-muted-foreground">{currency}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(currency === "USD" ? FUND_PRESETS : FUND_PRESETS_XOF).map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      amount === q ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface-2 hover:bg-muted"
                    }`}
                  >
                    {currency === "USD" ? `$${q}` : q.toLocaleString("fr-FR")}
                  </button>
                ))}
              </div>
            </div>

            {/* Funds check */}
            <div
              className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 ${
                checking
                  ? "border-border bg-surface-2"
                  : afford?.can_afford
                    ? "border-success/40 bg-success/5"
                    : "border-warning/40 bg-warning/5"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                  checking
                    ? "bg-muted text-muted-foreground"
                    : afford?.can_afford
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning"
                }`}
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : afford?.can_afford ? <Wallet className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </span>
              <div className="text-sm">
                {checking && <p className="font-medium">Vérification du solde…</p>}
                {!checking && afford && (
                  <>
                    <p className="font-medium">
                      {afford.can_afford ? "Fonds suffisants" : "Solde insuffisant"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Requis&nbsp;: <span className="tabular-nums">{afford.required.toLocaleString("fr-FR")} {currency}</span>{" "}
                      · Disponible&nbsp;: <span className="tabular-nums">{afford.available.toLocaleString("fr-FR")} {currency}</span>
                    </p>
                  </>
                )}
                {!checking && !afford && !error && <p className="text-xs text-muted-foreground">Saisissez un montant pour vérifier.</p>}
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={submitting || checking || !afford?.can_afford || amount <= 0}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : success ? (
                <>Carte émise <Check className="h-4 w-4" /></>
              ) : afford && !afford.can_afford ? (
                <>Recharger d'abord <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Émettre la carte <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Le montant est débité de votre portefeuille puis votre carte est créée instantanément.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
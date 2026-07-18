import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, Loader2, ArrowRight, Check } from "lucide-react";
import { walletApi } from "@/lib/api";

const QUICK = [5000, 10000, 25000, 50000, 100000];

export function RechargeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState<number>(10000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setManualUrl(null);
    try {
      const returnUrl = `${window.location.origin}/dashboard`;
      const res = await walletApi.rechargeYengapay(amount, "XOF", returnUrl);
      const url = res?.data?.checkout_url;
      if (!url) throw new Error("Lien de paiement introuvable");
      // 1) Navigation au niveau top (échappe à l'iframe de preview Lovable)
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = url;
          return;
        }
      } catch { /* cross-origin, on ignore */ }
      // 2) Nouvel onglet (peut être bloqué par le navigateur)
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (win) return;
      // 3) Fallback : navigation classique dans la même fenêtre
      window.location.href = url;
      // 4) Filet de sécurité : si rien n'a fonctionné après 800ms, on montre le lien
      setTimeout(() => setManualUrl(url), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
      setLoading(false);
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
                <h2 className="font-[Space_Grotesk] text-2xl font-bold tracking-tight">Recharger</h2>
                <p className="mt-1 text-sm text-muted-foreground">Via Mobile Money</p>
              </div>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant</label>
              <div className="mt-2 flex items-baseline gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-3">
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="w-full bg-transparent font-[Space_Grotesk] text-3xl font-bold tabular-nums outline-none"
                />
                <span className="text-sm font-semibold text-muted-foreground">XOF</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      amount === q ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface-2 hover:bg-muted"
                    }`}
                  >
                    {q.toLocaleString("fr-FR")}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Méthode</p>
              <div className="flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Mobile Money</p>
                    <p className="text-xs text-muted-foreground">Orange · MTN · Moov · Wave</p>
                  </div>
                </div>
                <Check className="h-4 w-4 text-primary" />
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={loading || amount < 100}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continuer vers le paiement <ArrowRight className="h-4 w-4" /></>}
            </button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Vous serez redirigé(e) vers la page de paiement Mobile Money sécurisée.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
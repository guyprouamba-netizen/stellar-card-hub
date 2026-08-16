import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ArrowRight, Check, ShieldCheck, WifiOff } from "lucide-react";
import {
  FALLBACK_OPERATORS, type DepositOperator,
  depositStatus, initDeposit, listDepositOperators, payDeposit, sendDepositOtp,
} from "@/lib/deposit.functions";

const QUICK = [5000, 10000, 25000, 50000, 100000];
type Step = "amount" | "otp" | "confirm" | "done";

export function RechargeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState<number>(10000);
  const [operators, setOperators] = useState<DepositOperator[]>(FALLBACK_OPERATORS);
  const [operator, setOperator] = useState<string>(FALLBACK_OPERATORS[0].code);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("amount");
  const [reference, setReference] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  const current = useMemo(() => operators.find((o) => o.code === operator) ?? operators[0], [operators, operator]);

  useEffect(() => {
    if (!open) return;
    listDepositOperators()
      .then((r) => { if (r?.operators?.length) setOperators(r.operators); })
      .catch(() => { /* liste par défaut */ });
  }, [open]);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  function reset() {
    setStep("amount"); setOtp(""); setReference(null); setError(null); setInfo(null); setLoading(false);
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }

  function close() { reset(); onClose(); }

  function startPolling(ref: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let ticks = 0;
    pollRef.current = window.setInterval(async () => {
      ticks += 1;
      try {
        const r = await depositStatus({ reference: ref });
        if (r.status === "success") {
          window.clearInterval(pollRef.current!); pollRef.current = null;
          setStep("done"); setInfo("Dépôt confirmé, votre solde a été crédité.");
        } else if (r.status === "failed") {
          window.clearInterval(pollRef.current!); pollRef.current = null;
          setError("Le paiement a été refusé ou annulé sur votre téléphone.");
          setStep("amount");
        }
      } catch { /* on réessaie */ }
      if (ticks > 40 && pollRef.current) {
        window.clearInterval(pollRef.current); pollRef.current = null;
        setInfo("Paiement toujours en attente. Le solde sera crédité dès confirmation de l'opérateur.");
      }
    }, 4000);
  }

  async function start() {
    setLoading(true); setError(null); setInfo(null);
    try {
      const res = await initDeposit({ amount, operator, phone: phone.replace(/\s+/g, "") });
      if (!res?.ok) throw new Error(res?.error || "Dépôt impossible pour le moment.");
      setReference(res.reference);
      if (res.requiresOtp) {
        try { await sendDepositOtp({ reference: res.reference }); } catch { /* déjà envoyé */ }
        setStep("otp");
        setInfo("Un code de confirmation vous a été envoyé par votre opérateur.");
      } else {
        const pay = await payDeposit({ reference: res.reference });
        if (pay.status === "success") { setStep("done"); setInfo("Dépôt confirmé, votre solde a été crédité."); }
        else if (pay.status === "failed") throw new Error(pay.message || "Paiement refusé.");
        else { setStep("confirm"); startPolling(res.reference); }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally { setLoading(false); }
  }

  async function confirmOtp() {
    if (!reference) return;
    setLoading(true); setError(null);
    try {
      const pay = await payDeposit({ reference, otp: otp.trim() });
      if (pay.status === "success") { setStep("done"); setInfo("Dépôt confirmé, votre solde a été crédité."); }
      else if (pay.status === "failed") throw new Error(pay.message || "Code incorrect ou paiement refusé.");
      else { setStep("confirm"); startPolling(reference); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally { setLoading(false); }
  }

  const phoneOk = /^[0-9]{8,15}$/.test(phone.replace(/\s+/g, ""));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92vh] max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-6 shadow-card-premium sm:bottom-1/2 sm:translate-y-1/2 sm:rounded-3xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-[Space_Grotesk] text-2xl font-bold tracking-tight">Recharger</h2>
                <p className="mt-1 text-sm text-muted-foreground">Dépôt Mobile Money sécurisé, sans quitter l'application</p>
              </div>
              <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {offline && (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" /> Mode hors connexion : les dépôts sont indisponibles.
              </p>
            )}

            {step === "amount" && (
              <>
                <div className="mt-6">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant</label>
                  <div className="mt-2 flex items-baseline gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-3">
                    <input
                      type="number" inputMode="numeric" value={amount}
                      onChange={(e) => setAmount(Number(e.target.value) || 0)}
                      className="w-full bg-transparent font-[Space_Grotesk] text-3xl font-bold tabular-nums outline-none"
                    />
                    <span className="text-sm font-semibold text-muted-foreground">XOF</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUICK.map((q) => (
                      <button key={q} onClick={() => setAmount(q)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          amount === q ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface-2 hover:bg-muted"
                        }`}>{q.toLocaleString("fr-FR")}</button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Opérateur</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {operators.map((o) => (
                      <button key={o.code} onClick={() => setOperator(o.code)}
                        className={`flex items-center justify-between rounded-2xl border p-3 text-left text-sm font-semibold transition-colors ${
                          operator === o.code ? "border-primary bg-primary/5" : "border-border bg-surface-2 hover:bg-muted"
                        }`}>
                        {o.label}
                        {operator === o.code && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Numéro {current?.label}</label>
                  <input
                    value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="70 00 00 00"
                    className="mt-2 w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-base outline-none focus:border-primary"
                  />
                </div>
              </>
            )}

            {step === "otp" && (
              <div className="mt-6">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Code de confirmation</label>
                <input
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={8}
                  className="mt-2 w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-center font-[Space_Grotesk] text-2xl font-bold tracking-[0.4em] outline-none focus:border-primary"
                />
                <button
                  onClick={() => reference && sendDepositOtp({ reference }).then(() => setInfo("Nouveau code envoyé.")).catch(() => setError("Envoi du code impossible."))}
                  className="mt-3 text-xs text-primary hover:underline">Renvoyer le code</button>
              </div>
            )}

            {step === "confirm" && (
              <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-5 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                <p className="mt-3 text-sm font-semibold">Validez le paiement sur votre téléphone</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Composez la demande reçue par {current?.label} et saisissez votre code secret. Le crédit est automatique.
                </p>
              </div>
            )}

            {step === "done" && (
              <div className="mt-6 rounded-2xl border border-success/40 bg-success/10 p-5 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/20 text-success"><Check className="h-6 w-6" /></span>
                <p className="mt-3 font-[Space_Grotesk] text-xl font-bold">{amount.toLocaleString("fr-FR")} XOF crédités</p>
                <p className="mt-1 text-xs text-muted-foreground">Votre portefeuille a été mis à jour.</p>
              </div>
            )}

            {error && <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {info && !error && <p className="mt-4 rounded-xl border border-border bg-surface-2 p-3 text-xs text-muted-foreground">{info}</p>}

            {step === "amount" && (
              <button onClick={start} disabled={loading || offline || amount < 100 || !phoneOk}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Valider le dépôt <ArrowRight className="h-4 w-4" /></>}
              </button>
            )}
            {step === "otp" && (
              <button onClick={confirmOtp} disabled={loading || otp.length < 4}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Confirmer <ArrowRight className="h-4 w-4" /></>}
              </button>
            )}
            {(step === "confirm" || step === "done") && (
              <button onClick={close} className="mt-6 w-full rounded-full border border-border py-3.5 text-sm font-semibold hover:bg-muted">
                Fermer
              </button>
            )}

            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Paiement chiffré traité par FASO INVEST PAY
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

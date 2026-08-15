import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, Smartphone, Check, X, ArrowLeft } from "lucide-react";
import {
  FALLBACK_MOMO_OPERATORS, confirmDirect, listOperators, payDirect, verifyPayment,
  type MomoOperator, type PayStatus,
} from "@/lib/pay.functions";

type Props = {
  reference: string;
  amount: number;
  currency?: string;
  defaultPhone?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

/**
 * Paiement Mobile Money 100% intégré : le client ne quitte jamais la plateforme.
 * Orange Money → code OTP ; autres opérateurs → confirmation USSD sur le téléphone.
 */
export function MomoPayment({ reference, amount, currency = "XOF", defaultPhone = "", onSuccess, onCancel }: Props) {
  const [operators, setOperators] = useState<MomoOperator[]>(FALLBACK_MOMO_OPERATORS);
  const [operator, setOperator] = useState<string>(FALLBACK_MOMO_OPERATORS[0].code);
  const [phone, setPhone] = useState(defaultPhone);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"form" | "otp" | "waiting" | "done" | "failed">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const poll = useRef<number | null>(null);

  useEffect(() => {
    listOperators().then((r) => {
      if (r?.operators?.length) { setOperators(r.operators); setOperator(r.operators[0].code); }
    }).catch(() => { /* fallback conservé */ });
    return () => { if (poll.current) window.clearInterval(poll.current); };
  }, []);

  const flow = operators.find((o) => o.code === operator)?.flow || "push";

  function startPolling() {
    if (poll.current) window.clearInterval(poll.current);
    let tries = 0;
    poll.current = window.setInterval(async () => {
      tries++;
      try {
        const r: any = await verifyPayment(reference);
        const st: PayStatus = r?.status || "pending";
        if (st === "success") { finish("done"); return; }
        if (st === "failed") { finish("failed"); return; }
      } catch { /* on continue */ }
      if (tries >= 40) { // ~3 min
        if (poll.current) window.clearInterval(poll.current);
        setInfo("Paiement toujours en attente. Vous recevrez la confirmation dès validation.");
      }
    }, 4500);
  }

  function finish(state: "done" | "failed") {
    if (poll.current) window.clearInterval(poll.current);
    setStep(state);
    if (state === "done") onSuccess?.();
  }

  async function start() {
    setBusy(true); setError(null); setInfo(null);
    try {
      const r = await payDirect({ reference, operator, phone });
      if (r.status === "success") { finish("done"); return; }
      if (r.status === "failed") { finish("failed"); return; }
      if (r.requiresOtp) { setStep("otp"); setInfo(r.message || "Un code de confirmation vous a été envoyé par SMS."); }
      else { setStep("waiting"); setInfo(r.message || "Confirmez le paiement sur votre téléphone."); startPolling(); }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function confirm() {
    setBusy(true); setError(null);
    try {
      const r = await confirmDirect({ reference, otp });
      if (r.status === "success") { finish("done"); return; }
      if (r.status === "failed") { finish("failed"); return; }
      setStep("waiting"); setInfo("Paiement en cours de confirmation…"); startPolling();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  const money = `${Number(amount).toLocaleString("fr-FR")} ${currency === "XOF" ? "FCFA" : currency}`;

  if (step === "done") return (
    <div className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><Check className="h-8 w-8" /></div>
      <h3 className="mt-4 font-[Space_Grotesk] text-xl font-bold">Paiement confirmé</h3>
      <p className="mt-1 text-sm text-muted-foreground">{money} — référence {reference}</p>
    </div>
  );
  if (step === "failed") return (
    <div className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive/15 text-destructive"><X className="h-8 w-8" /></div>
      <h3 className="mt-4 font-[Space_Grotesk] text-xl font-bold">Paiement échoué</h3>
      <p className="mt-1 text-sm text-muted-foreground">L'opération n'a pas abouti. Vous pouvez réessayer.</p>
      <button onClick={() => { setStep("form"); setOtp(""); setError(null); setInfo(null); }}
        className="mt-5 rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">Réessayer</button>
    </div>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Montant à payer</p>
        <p className="font-[Space_Grotesk] text-2xl font-bold tabular-nums">{money}</p>
      </div>

      {step === "form" && (
        <>
          <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Opérateur</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {operators.map((o) => (
              <button key={o.code} type="button" onClick={() => setOperator(o.code)}
                className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${operator === o.code ? "border-primary bg-primary/10" : "border-border bg-surface-2"}`}>
                <Smartphone className="mb-1 h-4 w-4 text-primary" />
                {o.label}
              </button>
            ))}
          </div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Numéro Mobile Money (ex : 70000000)"
            className="mt-4 w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-primary" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {flow === "otp" ? "Un code de confirmation vous sera envoyé par SMS." : "Vous validerez le paiement directement sur votre téléphone."}
          </p>
          {error && <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button onClick={start} disabled={busy || phone.replace(/\D/g, "").length < 8}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Payer ${money}`}
          </button>
          {onCancel && (
            <button onClick={onCancel} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ArrowLeft className="h-3 w-3" /> Annuler
            </button>
          )}
        </>
      )}

      {step === "otp" && (
        <>
          {info && <p className="mt-5 rounded-xl border border-primary/40 bg-primary/5 p-3 text-xs text-muted-foreground">{info}</p>}
          <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric"
            placeholder="Code de confirmation"
            className="mt-4 w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-center font-[Space_Grotesk] text-xl font-bold tracking-[0.4em] outline-none focus:border-primary" />
          {error && <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button onClick={confirm} disabled={busy || otp.length < 4}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer le paiement"}
          </button>
          <button onClick={() => setStep("form")} className="mt-3 w-full text-xs text-muted-foreground">Modifier le numéro</button>
        </>
      )}

      {step === "waiting" && (
        <div className="mt-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm font-semibold">En attente de votre validation</p>
          <p className="mt-1 text-xs text-muted-foreground">{info || "Confirmez la transaction sur votre téléphone."}</p>
        </div>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3" /> Paiement sécurisé par FASO-INVEST PAY
      </p>
    </div>
  );
}

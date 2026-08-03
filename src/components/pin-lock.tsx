import { useEffect, useMemo, useState } from "react";
import { Delete, Loader2, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { setPin, verifyPin, markPinEnabledOnDevice, setSessionLocked, markActiveNow } from "@/lib/pin";

type Mode = "create" | "unlock";

function Dots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
            i < filled ? "border-primary bg-primary" : "border-border bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

export function PinLock({ mode, onSuccess }: { mode: Mode; onSuccess: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"first" | "confirm">("first");
  const [firstPin, setFirstPin] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attemptsInfo, setAttemptsInfo] = useState<string | null>(null);

  const title = useMemo(() => {
    if (mode === "unlock") return "Déverrouillez votre compte";
    return step === "first" ? "Créez votre code PIN" : "Confirmez votre code PIN";
  }, [mode, step]);

  async function handleComplete(pin: string) {
    setError(null);
    if (mode === "create") {
      if (step === "first") {
        setFirstPin(pin);
        setStep("confirm");
        setValue("");
        return;
      }
      if (pin !== firstPin) {
        setError("Les deux codes ne correspondent pas. Recommencez.");
        setStep("first");
        setFirstPin("");
        setValue("");
        return;
      }
      setLoading(true);
      try {
        await setPin(pin);
        markPinEnabledOnDevice((await supabase.auth.getUser()).data.user?.id || "");
        setSessionLocked(false);
        markActiveNow();
        toast.success("Code PIN activé.");
        onSuccess();
      } catch (e: any) {
        setError(e?.message || "Impossible de créer le code PIN.");
        setStep("first");
        setFirstPin("");
        setValue("");
      } finally {
        setLoading(false);
      }
      return;
    }

    // mode unlock
    setLoading(true);
    try {
      const res = await verifyPin(pin);
      if (res.ok) {
        setSessionLocked(false);
        markActiveNow();
        onSuccess();
      } else {
        setAttemptsInfo(res.message || null);
        setError(res.message || "Code PIN incorrect.");
        setValue("");
      }
    } catch (e: any) {
      setError(e?.message || "Une erreur est survenue.");
      setValue("");
    } finally {
      setLoading(false);
    }
  }

  function press(digit: string) {
    if (loading) return;
    setError(null);
    setValue((prev) => {
      if (prev.length >= 6) return prev;
      const next = prev + digit;
      if (next.length === 6) {
        setTimeout(() => handleComplete(next), 50);
      }
      return next;
    });
  }

  function backspace() {
    if (loading) return;
    setValue((prev) => prev.slice(0, -1));
  }

  async function useEmailInstead() {
    await supabase.auth.signOut();
    setSessionLocked(false);
    navigate("/auth", { replace: true });
  }

  useEffect(() => {
    setValue("");
  }, [step]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background px-6">
      <div className="w-full max-w-xs text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
          {mode === "unlock" ? <Lock className="h-6 w-6 text-primary-foreground" /> : <ShieldCheck className="h-6 w-6 text-primary-foreground" />}
        </div>
        <h1 className="font-[Space_Grotesk] text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "unlock"
            ? "Saisissez votre code à 6 chiffres pour continuer."
            : step === "first"
              ? "Choisissez un code à 6 chiffres. Évitez les suites simples (123456, 000000…)."
              : "Ressaisissez le même code pour confirmer."}
        </p>

        <div className="mt-8">
          <Dots length={6} filled={value.length} />
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {!error && attemptsInfo && <p className="mt-4 text-sm text-muted-foreground">{attemptsInfo}</p>}

        <div className="mt-8 grid grid-cols-3 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              disabled={loading}
              onClick={() => press(d)}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface-2 text-xl font-semibold transition-transform active:scale-95 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            type="button"
            disabled={loading}
            onClick={() => press("0")}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface-2 text-xl font-semibold transition-transform active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={backspace}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-muted-foreground transition-transform active:scale-95 disabled:opacity-50"
            aria-label="Effacer"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Vérification…
          </div>
        )}

        {mode === "unlock" && (
          <button
            type="button"
            onClick={useEmailInstead}
            className="mt-8 text-sm font-medium text-primary hover:underline"
          >
            Utiliser email + mot de passe
          </button>
        )}

        {mode === "create" && (
          <button
            type="button"
            onClick={() => onSuccess()}
            className="mt-8 text-sm font-medium text-muted-foreground hover:underline"
          >
            Plus tard
          </button>
        )}
      </div>
    </div>
  );
}

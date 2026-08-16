import { useState, useEffect } from "react";
import { Shield, Smartphone, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { send2FAOTP, verify2FAOTP, update2FASettings, getMyProfile } from "@/lib/profile.functions";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function TwoFactorSetup() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"intro" | "verify" | "success">("intro");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyProfile().then(({ data }) => {
      setProfile(data);
      setLoading(false);
    });
  }, []);

  async function handleToggle(enable: boolean) {
    if (enable) {
      setBusy(true);
      try {
        await send2FAOTP();
        setStep("verify");
        toast.success("Code envoyé sur votre WhatsApp");
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setBusy(false);
      }
    } else {
      if (!confirm("Désactiver la sécurité 2FA ?")) return;
      setBusy(true);
      try {
        await update2FASettings(false);
        setProfile((p: any) => ({ ...p, two_factor_enabled: false }));
        toast.success("Authentification 2FA désactivée");
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setBusy(false);
      }
    }
  }

  async function confirmOtp() {
    if (code.length < 6) return;
    setBusy(true);
    try {
      await verify2FAOTP(code);
      await update2FASettings(true);
      setProfile((p: any) => ({ ...p, two_factor_enabled: true }));
      setStep("success");
      toast.success("Authentification 2FA activée !");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-24 rounded-2xl bg-muted" /></div>;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Shield className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold">Authentification à deux facteurs (2FA)</h3>
          <p className="text-sm text-muted-foreground">Protégez votre compte avec des codes WhatsApp OTP.</p>
        </div>
        <button
          onClick={() => handleToggle(!profile?.two_factor_enabled)}
          disabled={busy}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
            profile?.two_factor_enabled 
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20" 
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (profile?.two_factor_enabled ? "Désactiver" : "Activer")}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === "verify" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-6 space-y-4 overflow-hidden border-t pt-6"
          >
            <div className="flex items-center gap-3 rounded-xl bg-success/10 p-4 text-sm text-success">
              <Smartphone className="h-5 w-5" />
              <span>Un code de vérification a été envoyé au <b>{profile?.phone}</b> via WhatsApp.</span>
            </div>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Code à 6 chiffres"
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-primary"
            />
            <button
              onClick={confirmOtp}
              disabled={busy || code.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer l'activation"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-6 flex flex-col items-center gap-3 text-center border-t pt-6"
          >
            <CheckCircle2 className="h-12 w-12 text-success" />
            <h4 className="font-bold text-success">Sécurité renforcée !</h4>
            <p className="text-sm text-muted-foreground">Votre compte est désormais protégé par 2FA via WhatsApp.</p>
            <button onClick={() => setStep("intro")} className="mt-2 text-xs font-bold text-primary hover:underline">Fermer</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

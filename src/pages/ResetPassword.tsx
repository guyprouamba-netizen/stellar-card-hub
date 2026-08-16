import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase pose une session de récupération automatiquement à l'arrivée du lien.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) { setErr("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (password !== confirm) { setErr("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Impossible de mettre à jour le mot de passe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 sm:px-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 inline-flex items-center gap-2 font-semibold">
          <img src={logo} alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
          FASO INVEST PAY
        </div>
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Nouveau mot de passe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choisissez un mot de passe sécurisé d'au moins 8 caractères.
        </p>

        {done ? (
          <div className="mt-8 flex items-start gap-2 rounded-2xl border border-success/40 bg-success/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="font-medium">Mot de passe mis à jour</p>
              <p className="mt-1 text-muted-foreground">Redirection vers votre tableau de bord...</p>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={submit}>
            {err && (
              <div role="alert" className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{err}</span>
              </div>
            )}
            {!ready && (
              <div className="rounded-2xl border border-border bg-card/50 p-3 text-xs text-muted-foreground">
                Validation du lien en cours... Si rien ne se passe, redemandez un email de récupération.
              </div>
            )}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nouveau mot de passe"
                className="w-full rounded-full border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input required type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmer le mot de passe"
                className="w-full rounded-full border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </div>
            <button type="submit" disabled={loading || !ready}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Mettre à jour <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
import { Link } from "react-router-dom";
import { Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("Adresse email invalide.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setErr(e?.message ?? "Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 sm:px-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 font-semibold">
          <img src={logo} alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
          FASO-INVEST PAY
        </Link>
        <BackButton to="/auth" className="mb-4" />
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Mot de passe oublié</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Renseignez l'email de votre compte. Nous vous enverrons un lien sécurisé pour définir un nouveau mot de passe.
        </p>

        {sent ? (
          <div className="mt-8 flex items-start gap-2 rounded-2xl border border-success/40 bg-success/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="font-medium">Email envoyé !</p>
              <p className="mt-1 text-muted-foreground">
                Si un compte existe avec <b>{email}</b>, vous recevrez sous peu un email contenant le lien de réinitialisation. Pensez à vérifier vos courriers indésirables.
              </p>
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
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
                className="w-full rounded-full border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </div>
            <button type="submit" disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Envoyer le lien <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="font-semibold text-primary hover:underline">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
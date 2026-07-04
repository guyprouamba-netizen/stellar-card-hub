import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, ArrowRight, User, Phone, Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { VirtualCard } from "@/components/virtual-card";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { queryClient } from "@/lib/query-client";
import { getDashboardData } from "@/lib/dashboard.functions";

function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [refCode, setRefCode] = useState<string>("");
  useEffect(() => {
    const r = (searchParams.get("ref") || "").trim().toUpperCase();
    if (r) {
      setRefCode(r);
      setMode("signup");
      // Mémorise pour survivre au refresh / OAuth
      try { localStorage.setItem("fip_ref", r); } catch { /**/ }
    } else {
      try {
        const saved = localStorage.getItem("fip_ref");
        if (saved) setRefCode(saved);
      } catch { /**/ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function fastRedirect(user?: { id: string; email?: string | null }) {
    const userId = user?.id;
    if (!userId) return;
    const dashboardWarmup = queryClient.prefetchQuery({
      queryKey: ["dashboard", userId],
      queryFn: () => getDashboardData({ userId }),
      staleTime: 15_000,
    }).catch(() => undefined);
    if (user?.email?.toLowerCase() !== "ilboudoibonydo@gmail.com") {
      void dashboardWarmup;
      navigate("/dashboard", { replace: true, state: { userId } });
      return;
    }
    const rolesResult = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (rolesResult.data ?? []).some((r: any) => r.role === "admin");
    void dashboardWarmup;
    navigate(isAdmin ? "/admin" : "/dashboard", { replace: true, state: { userId } });
  }
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function frenchAuthError(err: any): string {
    const code = err?.code ?? err?.error_code ?? "";
    const msg = (err?.message ?? "").toString();
    if (code === "invalid_credentials" || /invalid login credentials/i.test(msg))
      return "Email ou mot de passe incorrect.";
    if (code === "email_exists" || code === "user_already_exists" || /already registered|already exists/i.test(msg))
      return "Un compte existe déjà avec cet email. Connectez-vous.";
    if (code === "weak_password" || /weak[_ ]password|pwned/i.test(msg))
      return "Mot de passe trop faible ou compromis. Choisissez un mot de passe unique d'au moins 8 caractères (lettres + chiffres + symbole).";
    if (code === "validation_failed" || /invalid.*email/i.test(msg))
      return "Adresse email invalide.";
    if (code === "over_email_send_rate_limit" || /rate limit/i.test(msg))
      return "Trop de tentatives. Patientez quelques minutes puis réessayez.";
    if (code === "email_not_confirmed")
      return "Email non confirmé. Réessayez dans quelques secondes.";
    if (/network|failed to fetch/i.test(msg))
      return "Connexion réseau perdue. Vérifiez votre internet puis réessayez.";
    return msg || "Une erreur est survenue. Réessayez.";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validation côté client avant d'appeler l'API
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Adresse email invalide.");
      return;
    }
    if (password.length < 8) {
      setFormError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (mode === "signup") {
      if (!fullName.trim()) { setFormError("Renseignez votre nom complet."); return; }
      if (!phone.trim())    { setFormError("Renseignez votre numéro de téléphone."); return; }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone, ...(refCode ? { referrer_code: refCode } : {}) },
          },
        });
        if (error) throw error;
        try { localStorage.removeItem("fip_ref"); } catch { /**/ }
        // Supabase renvoie 200 avec identities=[] quand l'email existe déjà
        const identities = (signUpData as any)?.user?.identities;
        if (Array.isArray(identities) && identities.length === 0) {
          throw { code: "user_already_exists", message: "Un compte existe déjà avec cet email." };
        }
        // Auto-confirmation via trigger DB — session est immédiate
        if (signUpData.session) {
          toast.success("Compte créé — bienvenue !");
          await fastRedirect(signUpData.session.user);
        } else {
          // Fallback : connexion explicite si pas de session retournée
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) throw signInErr;
          toast.success("Compte créé — bienvenue !");
          await fastRedirect(signInData.session?.user);
        }
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenue !");
        await fastRedirect(signInData.session?.user);
      }
    } catch (e: any) {
      const message = frenchAuthError(e);
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-hero lg:flex">
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="relative space-y-8 px-12">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <img src={logo} alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
            FASO-INVEST <span className="text-primary">PAY</span>
          </Link>
          <VirtualCard />
          <p className="max-w-sm text-muted-foreground">
            « FASO-INVEST PAY m'a permis de payer en ligne en USD depuis Ouaga, sans tracas. »
          </p>
          <p className="text-sm font-semibold">— Aïcha O., entrepreneure</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-8 inline-flex items-center gap-2 font-semibold">
            <img src={logo} alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            FASO-INVEST PAY
          </Link>
          <BackButton to="/" className="mb-4" />
          <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">
            {mode === "login" ? "Bon retour 👋" : "Créer un compte"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login" ? "Connectez-vous à votre espace FASO-INVEST PAY." : "Lancez vos cartes virtuelles en 2 minutes."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            {formError && (
              <div role="alert" className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            {mode === "signup" && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet"
                    className="w-full rounded-full border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+226 70 00 00 00"
                    className="w-full rounded-full border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
                className="w-full rounded-full border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe"
                className="w-full rounded-full border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </div>
            <button
              type="submit" disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>{mode === "login" ? "Se connecter" : "Créer mon compte"}<ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>

          {mode === "login" && (
            <p className="mt-4 text-center text-sm">
              <Link to="/forgot-password" className="font-medium text-primary hover:underline">
                Mot de passe oublié ?
              </Link>
            </p>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="font-semibold text-primary hover:underline">
              {mode === "login" ? "Inscrivez-vous" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Auth;

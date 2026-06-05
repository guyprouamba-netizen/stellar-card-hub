import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, ArrowRight, User, Phone, Loader2 } from "lucide-react";
import { useState } from "react";
import { VirtualCard } from "@/components/virtual-card";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — FASO-INVEST PAY" }] }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success("Compte créé ! Vérifiez votre email pour confirmer.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenue !");
        navigate({ to: "/dashboard" });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'authentification");
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
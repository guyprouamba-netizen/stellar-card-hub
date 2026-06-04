import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, Mail, Lock, ArrowRight } from "lucide-react";
import { useState } from "react";
import { VirtualCard } from "@/components/virtual-card";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — Volty" }] }),
  component: Auth,
});

function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-hero lg:flex">
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="relative space-y-8 px-12">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <CreditCard className="h-5 w-5 text-primary-foreground" />
            </span>
            Volty
          </Link>
          <VirtualCard />
          <p className="max-w-sm text-muted-foreground">
            « Volty a transformé la façon dont je gère mes paiements en ligne. Tout est rapide, beau et sécurisé. »
          </p>
          <p className="text-sm font-semibold">— Sarah K., freelance designer</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-8 inline-flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary"><CreditCard className="h-4 w-4 text-primary-foreground" /></span>
            Volty
          </Link>
          <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">
            {mode === "login" ? "Bon retour 👋" : "Créer un compte"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login" ? "Connectez-vous à votre espace Volty." : "Lancez vos cartes virtuelles en 2 minutes."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                placeholder="vous@exemple.com"
                className="w-full rounded-full border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                placeholder="Mot de passe"
                className="w-full rounded-full border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              {mode === "login" ? "Se connecter" : "Créer mon compte"}
              <ArrowRight className="h-4 w-4" />
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
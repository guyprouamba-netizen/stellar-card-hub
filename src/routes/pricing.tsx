import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Tarifs — Volty" },
      { name: "description", content: "Des plans simples et transparents." },
    ],
  }),
  component: Pricing,
});

const plans = [
  { name: "Starter", price: "0€", desc: "Pour découvrir Volty.", features: ["1 carte virtuelle", "Recharges illimitées", "Support email"], cta: "Commencer", featured: false },
  { name: "Pro", price: "4,90€", suffix: "/mois", desc: "Pour les indépendants.", features: ["10 cartes virtuelles", "Multi-devises", "Cashback 1%", "Apple & Google Pay"], cta: "Choisir Pro", featured: true },
  { name: "Business", price: "19€", suffix: "/mois", desc: "Pour les équipes.", features: ["Cartes illimitées", "Comptes membres", "API & Webhooks", "Support prioritaire 24/7"], cta: "Nous contacter", featured: false },
];

function Pricing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <section className="container mx-auto px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Tarifs</p>
          <h1 className="mt-3 font-[Space_Grotesk] text-5xl font-bold tracking-tight">Simple. Transparent.</h1>
          <p className="mt-4 text-muted-foreground">Pas de frais cachés. Annulez à tout moment.</p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl border p-8 transition-all hover:-translate-y-1 ${
                p.featured ? "border-primary bg-gradient-primary text-primary-foreground shadow-glow" : "border-border bg-card shadow-soft"
              }`}
            >
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-background px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
                  Le plus populaire
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className={`mt-1 text-sm ${p.featured ? "text-white/80" : "text-muted-foreground"}`}>{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-[Space_Grotesk] text-5xl font-bold">{p.price}</span>
                {p.suffix && <span className={p.featured ? "text-white/80" : "text-muted-foreground"}>{p.suffix}</span>}
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${p.featured ? "text-white" : "text-success"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`mt-8 block rounded-full py-3 text-center text-sm font-semibold transition-all ${
                  p.featured ? "bg-background text-foreground hover:scale-105" : "bg-gradient-primary text-primary-foreground hover:scale-105"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
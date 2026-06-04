import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Globe2, Smartphone, CheckCircle2 } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FASO-INVEST PAY — Cartes virtuelles & Mobile Money" },
      { name: "description", content: "Émettez vos cartes virtuelles USD depuis le Burkina Faso. Rechargez en Mobile Money via YengaPay, payez partout dans le monde." },
      { property: "og:title", content: "FASO-INVEST PAY" },
      { property: "og:description", content: "Cartes virtuelles instantanées + Mobile Money pour l'Afrique de l'Ouest." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Zap, title: "Émission instantanée", desc: "Créez une carte virtuelle USD en quelques secondes après validation KYC." },
  { icon: ShieldCheck, title: "KYC sécurisé", desc: "Vos pièces sont chiffrées et transmises directement à Strowallet pour validation." },
  { icon: Smartphone, title: "Recharge Mobile Money", desc: "Rechargez votre compte en XOF via YengaPay : Orange, Moov, Wave." },
  { icon: Globe2, title: "Paiements mondiaux", desc: "Visa & Mastercard acceptées partout : Netflix, Amazon, AliExpress, AdSense…" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main>
        <section className="container mx-auto grid gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Burkina Faso · UEMOA
            </span>
            <h1 className="mt-6 font-[Space_Grotesk] text-5xl font-bold leading-tight tracking-tight md:text-6xl">
              Cartes virtuelles <span className="bg-gradient-primary bg-clip-text text-transparent">USD</span>,<br />paiements mondiaux.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Rechargez en Mobile Money, validez votre KYC, émettez votre carte Visa/Mastercard et payez partout dans le monde — Netflix, Amazon, AliExpress, AdSense, formations, SaaS.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
                Créer mon compte <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-muted">
                Tableau de bord
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4">
              <Stat value="4 500 F" label="Frais d'émission" />
              <Stat value="1 USD = 869 F" label="Taux plateforme" />
              <Stat value="< 60s" label="Création carte" />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-primary opacity-20 blur-3xl" />
            <div className="rounded-3xl border border-border bg-card p-8 shadow-card-premium">
              <img src={logo} alt="FASO-INVEST PAY" className="h-16 w-16 rounded-2xl" />
              <h3 className="mt-6 font-[Space_Grotesk] text-2xl font-bold">FASO-INVEST PAY</h3>
              <p className="mt-2 text-sm text-muted-foreground">La plateforme qui connecte le Mobile Money africain aux paiements en ligne mondiaux.</p>
              <ul className="mt-6 space-y-3 text-sm">
                {["Recharge Mobile Money instantanée","KYC automatiquement transmis à Strowallet","Carte gelée auto en cas de tentative suspecte","Multi-devises XOF · USD · EUR"].map((t) => (
                  <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {t}</li>
                ))}
              </ul>
            </div>
          </motion.div>
        </section>

        <section className="container mx-auto grid gap-4 px-4 pb-20 sm:px-6 md:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></span>
              <h4 className="mt-4 font-semibold">{f.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-[Space_Grotesk] text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
  { icon: Globe2, title: "Multi-devises", desc: "EUR, USD, GBP, NGN, XOF — payez sans frais cachés à l'international." },
  { icon: Smartphone, title: "Apple & Google Pay", desc: "Ajoutez vos cartes à votre wallet en un tap, payez sans contact." },
  { icon: Lock, title: "Contrôle total", desc: "Gelez, limitez ou supprimez vos cartes en temps réel depuis le dashboard." },
  { icon: Sparkles, title: "Cashback intelligent", desc: "Jusqu'à 3% remboursés sur vos abonnements et achats du quotidien." },
];

const steps = [
  { n: "01", t: "Créez votre compte", d: "Inscription en 2 minutes, KYC instantané." },
  { n: "02", t: "Rechargez votre solde", d: "Mobile money, virement, crypto ou carte bancaire." },
  { n: "03", t: "Émettez votre carte", d: "Choisissez la devise, le plafond, c'est prêt." },
  { n: "04", t: "Payez partout", d: "En ligne, en boutique, en voyage — tout est tracé." },
];

const stats = [
  { v: "250K+", l: "Utilisateurs actifs" },
  { v: "€1.2B", l: "Volume traité" },
  { v: "180", l: "Pays couverts" },
  { v: "99.99%", l: "Disponibilité" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container mx-auto grid grid-cols-1 items-center gap-16 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Nouveau · Cartes Apple Pay disponibles
            </span>
            <h1 className="mt-6 font-[Space_Grotesk] text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              La carte virtuelle <span className="text-gradient">qui pense</span> comme vous.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Émettez, gérez et contrôlez vos cartes virtuelles partout dans le monde. Sans frais cachés, sans attente.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105"
              >
                Ouvrir le dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1/50 px-7 py-3.5 text-sm font-semibold backdrop-blur transition-colors hover:bg-muted"
              >
                Voir les tarifs
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
              {["Aucune carte de crédit", "KYC en 2 min", "Annulation libre"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  {t}
                </span>
              ))}
            </div>
          </motion.div>

          <div className="relative mx-auto flex h-[480px] w-full max-w-md items-center justify-center">
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute right-0 top-4 z-20"
            >
              <VirtualCard variant="primary" balance="€4 820,12" />
            </motion.div>
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute left-0 top-32 z-10 scale-95 opacity-90"
            >
              <VirtualCard variant="teal" floating holder="ALEX MARTIN" number="5320  ****  ****  9821" balance="$1 240,00" brand="Mastercard" />
            </motion.div>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-0 right-8 scale-90 opacity-80"
            >
              <VirtualCard variant="sunset" holder="VOYAGE" number="6011  ****  ****  4421" balance="£610,40" brand="Visa" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Logos / trust */}
      <section className="border-y border-border/50 bg-surface-2/30">
        <div className="container mx-auto grid grid-cols-2 gap-8 px-4 py-10 text-center sm:grid-cols-4 sm:px-6">
          {stats.map((s) => (
            <div key={s.l}>
              <div className="font-[Space_Grotesk] text-3xl font-bold tracking-tight sm:text-4xl">{s.v}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Fonctionnalités</p>
          <h2 className="mt-3 font-[Space_Grotesk] text-4xl font-bold tracking-tight sm:text-5xl">
            Tout ce qu'il faut, rien de superflu.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Une expérience pensée pour les freelances, e-commerçants et voyageurs.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card p-7 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"
            >
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-primary opacity-0 blur-2xl transition-opacity group-hover:opacity-30" />
              <div className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
                  <f.icon className="h-6 w-6 text-primary-foreground" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative overflow-hidden bg-surface-2/40 py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Comment ça marche</p>
            <h2 className="mt-3 font-[Space_Grotesk] text-4xl font-bold tracking-tight sm:text-5xl">
              Lancez-vous en 4 étapes.
            </h2>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative rounded-3xl border border-border bg-card p-6"
              >
                <div className="font-[Space_Grotesk] text-5xl font-bold text-gradient">{s.n}</div>
                <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-primary p-12 text-center text-primary-foreground shadow-glow sm:p-16">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
          <div className="relative">
            <TrendingUp className="mx-auto h-10 w-10" />
            <h2 className="mt-6 font-[Space_Grotesk] text-4xl font-bold tracking-tight sm:text-5xl">
              Prêt à payer comme en 2030 ?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              Rejoignez des milliers d'utilisateurs qui ont déjà adopté Volty.
            </p>
            <Link
              to="/dashboard"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-background px-7 py-3.5 text-sm font-semibold text-foreground shadow-card-premium transition-transform hover:scale-105"
            >
              Accéder à mon espace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Volty. Tous droits réservés.</p>
          <div className="flex gap-6">
            <Link to="/" className="hover:text-foreground">Confidentialité</Link>
            <Link to="/" className="hover:text-foreground">Conditions</Link>
            <Link to="/" className="hover:text-foreground">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

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
    <div className="min-h-screen bg-background text-foreground">
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
              <Stat value="1 $ = 869 F" label="Taux plateforme" />
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

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Globe2, Smartphone, CheckCircle2, Lock, Banknote, CreditCard, TrendingUp, Users, Star, ChevronDown, Sparkles } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { VirtualCard } from "@/components/virtual-card";
import logo from "@/assets/logo.png";
import heroCustomer from "@/assets/hero-customer.jpg";
import sectionPayment from "@/assets/section-payment.jpg";

const features = [
  { icon: Zap, title: "Émission instantanée", desc: "Créez votre carte virtuelle USD ou XOF en quelques secondes après validation KYC." },
  { icon: ShieldCheck, title: "KYC sécurisé", desc: "Vos pièces sont chiffrées et stockées sur notre infrastructure protégée." },
  { icon: Smartphone, title: "Recharge Mobile Money", desc: "Rechargez votre compte en XOF en Mobile Money : Orange, Moov, Wave." },
  { icon: Globe2, title: "Paiements mondiaux", desc: "Visa & Mastercard acceptées partout : Netflix, Amazon, AliExpress, AdSense…" },
];

const steps = [
  { n: "01", t: "Créez votre compte", d: "Inscription en 2 minutes avec votre email et votre numéro mobile." },
  { n: "02", t: "Validez votre KYC", d: "Photo de pièce + selfie. Validation rapide par notre équipe." },
  { n: "03", t: "Rechargez en Mobile Money", d: "Orange Money, Moov, Wave — crédit instantané sur votre portefeuille XOF." },
  { n: "04", t: "Émettez votre carte", d: "Visa ou Mastercard virtuelle en USD ou XOF, utilisable partout dans le monde immédiatement." },
];

const partners: Array<{ name: string; slug: string }> = [
  { name: "Netflix", slug: "netflix" },
  { name: "Amazon", slug: "amazon" },
  { name: "Spotify", slug: "spotify" },
  { name: "AliExpress", slug: "aliexpress" },
  { name: "Google Ads", slug: "googleads" },
  { name: "Meta", slug: "meta" },
  { name: "Apple", slug: "apple" },
  { name: "Microsoft", slug: "microsoft" },
  { name: "OpenAI", slug: "openai" },
  { name: "Shopify", slug: "shopify" },
  { name: "PayPal", slug: "paypal" },
  { name: "Steam", slug: "steam" },
];

const testimonials = [
  { name: "Aïcha O.", role: "Entrepreneure, Ouagadougou", text: "Je paie mes pubs Facebook et mon abonnement Shopify sans souci. Plus besoin de demander à un ami à l'étranger." },
  { name: "Mahamadi S.", role: "Freelance dev", text: "Reçu mon premier paiement client en USD, puis converti et retiré en Mobile Money en moins de 5 minutes." },
  { name: "Fatim K.", role: "Étudiante", text: "Netflix, Spotify, mes formations Udemy — tout marche enfin avec FASO-INVEST PAY." },
];

const faqs = [
  { q: "Combien coûte la création d'une carte ?", a: "4 500 F CFA de frais d'émission unique, plus le montant chargé (taux 1 USD = 869 F + 1,9 $ + 1 % de frais de traitement)." },
  { q: "Quels moyens de recharge sont acceptés ?", a: "Orange Money, Moov Money, et Wave en Mobile Money — crédit instantané sur votre portefeuille XOF." },
  { q: "Que se passe-t-il si un paiement échoue ?", a: "Pour protéger votre carte, nous la gelons automatiquement dès la 1ʳᵉ tentative refusée. Vous pouvez la débloquer en un clic depuis votre tableau de bord." },
  { q: "Où puis-je utiliser la carte ?", a: "Partout où Visa/Mastercard sont acceptées : Netflix, Amazon, AliExpress, Google Ads, Meta Ads, AdSense, SaaS, formations en ligne…" },
  { q: "Mes données sont-elles sécurisées ?", a: "Oui. Vos pièces KYC sont stockées dans un espace privé chiffré, accessible uniquement par notre équipe de validation." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main>
        {/* HERO */}
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
              <Stat value="Visa & MC" label="Réseaux acceptés" />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-primary opacity-20 blur-3xl" />
            <div className="relative">
              <img
                src={heroCustomer}
                alt="Cliente FASO-INVEST PAY effectuant un paiement en ligne"
                width={1024}
                height={1024}
                className="w-full rounded-[2.5rem] object-cover shadow-card-premium aspect-square"
              />
              <div className="absolute -bottom-8 -left-6 w-[60%] rotate-[-6deg] md:-left-10">
                <VirtualCard variant="primary" holder="GUY ROUAMBA" number="4242  ••••  ••••  4242" balance="$ 1 250.00" brand="Visa" />
              </div>
            </div>
          </motion.div>
        </section>

        {/* TRUST BAR — marquee */}
        <section className="border-y border-border bg-muted/30 py-10">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Acceptée sur les plus grandes plateformes
          </p>
          <div
            className="group relative overflow-hidden"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
          >
            <div className="flex w-max animate-marquee gap-14 px-8 group-hover:[animation-play-state:paused]">
              {[...partners, ...partners].map((p, i) => (
                <div key={`${p.slug}-${i}`} className="flex shrink-0 items-center gap-3 opacity-70 transition hover:opacity-100">
                  <img
                    src={`https://cdn.simpleicons.org/${p.slug}`}
                    alt={p.name}
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain dark:invert"
                    loading="lazy"
                  />
                  <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-foreground/80">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="container mx-auto grid gap-4 px-4 pt-20 pb-20 sm:px-6 md:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></span>
              <h4 className="mt-4 font-semibold">{f.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* HOW IT WORKS */}
        <section className="container mx-auto px-4 pb-20 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Comment ça marche</span>
            <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">4 étapes pour payer le monde entier</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-border bg-card p-6">
                <span className="font-[Space_Grotesk] text-3xl font-black text-primary/30">{s.n}</span>
                <h4 className="mt-3 font-semibold">{s.t}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section className="border-y border-border bg-muted/20">
          <div className="container mx-auto grid gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">Tarification transparente</span>
              <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">Pas de surprise. Pas de frais cachés.</h2>
              <p className="mt-4 text-muted-foreground">Tous nos frais sont affichés à l'écran avant la confirmation. Le taux USD est fixe sur notre plateforme.</p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Création de carte : 4 500 F CFA (unique, à vie)",
                  "Taux de change : 1 USD = 869 F CFA",
                  "Frais de traitement : 1,9 $ + 1 % du chargement",
                  "Recharge Mobile Money : frais opérateur uniquement",
                  "Aucun frais mensuel, aucun abonnement",
                ].map((t) => (<li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {t}</li>))}
              </ul>
            </div>
            <div className="rounded-3xl border border-border bg-card p-8 shadow-card-premium">
              <h3 className="font-[Space_Grotesk] text-xl font-bold">Simulation rapide</h3>
              <p className="mt-1 text-sm text-muted-foreground">Carte chargée à 20 $</p>
              <dl className="mt-6 space-y-3 text-sm">
                <Row k="Montant souhaité" v="20,00 $" />
                <Row k="Frais de traitement (1,9 $ + 1 %)" v="2,10 $" />
                <Row k="Total USD" v="22,10 $" />
                <Row k="Conversion (× 869 F)" v="19 205 F" />
                <Row k="Frais d'émission" v="4 500 F" />
                <div className="my-2 h-px bg-border" />
                <Row k="Total à payer" v="23 705 F" strong />
              </dl>
            </div>
          </div>
        </section>

        {/* SECURITY */}
        <section className="container mx-auto grid gap-8 px-4 py-20 sm:px-6 md:grid-cols-3">
          {[
            { i: Lock, t: "Chiffrement bout-en-bout", d: "Toutes vos données KYC sont stockées chiffrées et transmises uniquement à notre émetteur certifié." },
            { i: ShieldCheck, t: "Gèle anti-fraude", d: "Carte automatiquement gelée à la 1ʳᵉ tentative de paiement échouée pour éviter toute résiliation." },
            { i: Banknote, t: "Fonds séparés", d: "Votre solde XOF (recharges Mobile Money) et votre carte USD sont cloisonnés. Vous gardez le contrôle total à tout moment." },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><b.i className="h-6 w-6" /></span>
              <h4 className="mt-4 font-semibold">{b.t}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </section>

        {/* HUMAN PAYMENT SECTION */}
        <section className="container mx-auto grid items-center gap-10 px-4 pb-20 sm:px-6 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Pensé pour vous</span>
            <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">Payez en ligne où que vous soyez, en toute confiance.</h2>
            <p className="mt-4 text-muted-foreground">Que vous régliez vos abonnements, vos publicités en ligne ou vos achats e-commerce, FASO-INVEST PAY vous accompagne avec une carte virtuelle locale et fiable.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Compatible avec tous les marchands en ligne","Suivi instantané dans votre tableau de bord","Support client basé à Ouagadougou"].map(t => (
                <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {t}</li>
              ))}
            </ul>
          </div>
          <div className="order-1 md:order-2">
            <img src={sectionPayment} alt="Entrepreneur effectuant un paiement en ligne" loading="lazy" width={1920} height={1080} className="w-full rounded-3xl object-cover shadow-card-premium" />
          </div>
        </section>

        {/* STATS */}
        <section className="border-y border-border bg-gradient-primary/5">
          <div className="container mx-auto grid gap-6 px-4 py-16 sm:px-6 md:grid-cols-4">
            {[
              { i: Users, v: "10 000+", l: "Utilisateurs servis" },
              { i: CreditCard, v: "25 000+", l: "Cartes émises" },
              { i: TrendingUp, v: "2,8 M $", l: "Volume traité" },
              { i: Star, v: "4.8/5", l: "Note moyenne" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <s.i className="mx-auto h-6 w-6 text-primary" />
                <div className="mt-3 font-[Space_Grotesk] text-3xl font-bold tabular-nums">{s.v}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="container mx-auto px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Ils nous font confiance</span>
            <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">Plus de 10 000 Burkinabè paient déjà le monde entier.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex gap-1 text-primary">{Array.from({length:5}).map((_,i)=>(<Star key={i} className="h-4 w-4 fill-current" />))}</div>
                <p className="mt-4 text-sm text-foreground/90">« {t.text} »</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">{t.name[0]}</div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border bg-muted/20">
          <div className="container mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Questions fréquentes</span>
            <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">Tout ce qu'il faut savoir.</h2>
            <div className="mt-10 space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-border bg-card p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                    {f.q}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-24 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 text-center text-primary-foreground shadow-card-premium md:p-16">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-black/20 blur-3xl" />
            <h2 className="relative font-[Space_Grotesk] text-3xl font-bold md:text-5xl">Prêt à payer le monde entier ?</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">Ouvrez votre compte FASO-INVEST PAY en moins de 2 minutes. Aucun engagement.</p>
            <Link to="/auth" className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-background px-7 py-3 text-sm font-semibold text-foreground hover:scale-[1.02] transition-transform">
              Commencer maintenant <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-border">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
            <div className="flex items-center gap-2">
              <img src={logo} alt="" className="h-8 w-8 rounded-lg" />
              <span className="font-semibold">FASO-INVEST <span className="text-primary">PAY</span></span>
            </div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} FASO-INVEST PAY — Tous droits réservés. Ouagadougou, Burkina Faso.</p>
          </div>
        </footer>
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

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-base font-bold" : ""}`}>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}


export default Index;

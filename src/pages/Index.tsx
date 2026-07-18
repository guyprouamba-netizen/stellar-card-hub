import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, CreditCard, TrendingUp, Users, Star, ChevronDown, Repeat, Wallet, Store, Globe2 } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import logo from "@/assets/logo.png";
import heroCustomer from "@/assets/hero-customer.jpg";
import homeCards from "@/assets/home-cards.jpg";
import homeTransfer from "@/assets/home-transfer.jpg";
import homePaypal from "@/assets/home-paypal.jpg";
import homeBusiness from "@/assets/home-business.jpg";

const services = [
  { icon: CreditCard, title: "Carte prépayée virtuelle", desc: "Visa & Mastercard valable 3 ans." },
  { icon: Repeat, title: "Transfert d'argent", desc: "Orange, Moov, Wave, Sank, Coris, Telecel." },
  { icon: Wallet, title: "Retrait PayPal", desc: "PayPal → Mobile Money." },
  { icon: Store, title: "Espace Business", desc: "Boutique en ligne clé en main." },
  { icon: Globe2, title: "Réception de paiements", desc: "Local et international." },
];

const steps = [
  { n: "01", t: "Créez votre compte", d: "Inscription gratuite en 2 minutes, sans vérification KYC." },
  { n: "02", t: "Rechargez en Mobile Money", d: "Orange, Moov, Wave, Coris — dépôt automatique 24/7." },
  { n: "03", t: "Choisissez votre service", d: "Carte virtuelle, transfert, retrait PayPal, boutique." },
  { n: "04", t: "Retirez automatiquement", d: "Vos retraits arrivent sur Mobile Money en quelques secondes." },
];

const testimonials = [
  { name: "Aïcha O.", role: "Entrepreneure, Ouagadougou", text: "Je paie mes pubs Facebook et mon abonnement Shopify sans souci. Plus besoin de demander à un ami à l'étranger." },
  { name: "Mahamadi S.", role: "Freelance dev", text: "Reçu mon premier paiement client en USD, puis converti et retiré en Mobile Money en moins de 5 minutes." },
  { name: "Fatim K.", role: "Étudiante", text: "Netflix, Spotify, mes formations Udemy — tout marche enfin avec FASO-INVEST PAY." },
];

const faqs = [
  { q: "Faut-il valider une pièce d'identité pour ouvrir un compte ?", a: "Non — la plupart des services de FASO-INVEST PAY sont accessibles sans vérification KYC." },
  { q: "Combien coûte la création d'une carte virtuelle ?", a: "0 F CFA. Vous rechargez seulement le montant que vous souhaitez utiliser, à partir de 2 000 F CFA." },
  { q: "Les dépôts et retraits sont-ils automatiques ?", a: "Oui. Les dépôts et retraits Mobile Money sont crédités automatiquement en quelques secondes, 24/7." },
  { q: "Quels transferts inter-réseaux sont supportés ?", a: "Orange Money, Moov Money, Wave, Sank Money, Coris Money et Telecel Money." },
  { q: "Comment fonctionne l'Espace Business ?", a: "Créez votre boutique, recevez vos paiements au Burkina et à l'international, gérez vos factures et votre comptabilité depuis un tableau de bord unique." },
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
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> La fintech burkinabè du Burkina Faso
            </span>
            <h1 className="mt-6 font-[Space_Grotesk] text-5xl font-bold leading-tight tracking-tight md:text-6xl">
              Prenez le <span className="bg-gradient-primary bg-clip-text text-transparent">contrôle</span> de vos paiements en ligne.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Gérez vos paiements en ligne en toute simplicité, où que vous soyez. Que vous vendiez, achetiez ou transfériez, FASO-INVEST PAY vous accompagne. Inscription gratuite en quelques clics.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
                Créer mon compte <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/download" className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-muted">
                Télécharger l'app
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4">
              <Stat value="Automatique" label="Dépôts & retraits 24/7" />
              <Stat value="Sans KYC" label="Ouverture instantanée" />
              <Stat value="6 réseaux" label="Mobile Money supportés" />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-primary opacity-20 blur-3xl" />
            <img src={heroCustomer} alt="Client FASO-INVEST PAY" width={1024} height={1024} className="w-full rounded-[2.5rem] object-cover shadow-card-premium aspect-square" />
          </motion.div>
        </section>

        {/* SERVICES QUICKGRID */}
        <section className="container mx-auto px-4 py-14 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Nos services</span>
            <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">Une fintech burkinabè, cinq super-pouvoirs.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {services.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></span>
                <h4 className="mt-3 text-sm font-semibold">{f.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 1: CARTE */}
        <section id="carte" className="container mx-auto grid items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">01 · Carte prépayée virtuelle</span>
            <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">Votre Visa & Mastercard, personnalisée FASO-INVEST PAY.</h2>
            <p className="mt-4 text-muted-foreground">Créée en quelques secondes, valable dans le monde entier — Netflix, Amazon, AliExpress, AdSense, formations, SaaS.</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {[
                    ["Validité", "3 ans"],
                    ["Frais de création", "0 F CFA"],
                    ["Recharge minimum", "2 000 F CFA"],
                    ["Dépôts & retraits", "Automatiques via Mobile Money"],
                    ["Frais transfrontaliers", "2,5 % + 0,5 $"],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-4 py-3 text-muted-foreground">{k}</td>
                      <td className="px-4 py-3 text-right font-semibold">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link to="/auth" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
              Commander ma carte <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <img src={homeCards} alt="Cartes Visa et Mastercard FASO-INVEST PAY" loading="lazy" width={1408} height={912} className="w-full rounded-3xl object-cover shadow-card-premium" />
        </section>

        {/* SECTION 2: TRANSFERT */}
        <section id="transfert" className="border-y border-border bg-muted/20">
          <div className="container mx-auto grid items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
            <img src={homeTransfer} alt="Transfert d'argent inter-réseaux" loading="lazy" width={1408} height={912} className="w-full rounded-3xl object-cover shadow-card-premium" />
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">02 · Transfert d'argent inter-réseaux</span>
              <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">D'un réseau à l'autre, en quelques secondes.</h2>
              <p className="mt-4 text-muted-foreground">Orange vers Moov, Wave vers Sank, Coris vers Telecel — tous les réseaux communiquent enfin. Le destinataire reçoit son argent instantanément.</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {["Orange Money","Moov Money","Wave","Sank Money","Coris Money","Telecel"].map((op) => (
                  <div key={op} className="rounded-xl border border-border bg-card px-3 py-2 text-center text-xs font-semibold">{op}</div>
                ))}
              </div>
              <Link to="/transfer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
                Faire un transfert <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 3: PAYPAL */}
        <section id="paypal" className="container mx-auto grid items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">03 · Retrait PayPal</span>
            <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">Transformez votre solde PayPal en Mobile Money.</h2>
            <p className="mt-4 text-muted-foreground">Freelance, dropshipper, créateur — recevez vos revenus PayPal et retirez-les directement sur Orange Money, Moov ou Wave au Burkina Faso.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Taux de change transparent","Aucun compte bancaire requis","Traitement en moins de 24 h"].map((t) => (
                <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t}</li>
              ))}
            </ul>
            <Link to="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-muted">
              Demander un retrait <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <img src={homePaypal} alt="Retrait PayPal via Mobile Money au Burkina Faso" loading="lazy" width={1408} height={912} className="order-1 md:order-2 w-full rounded-3xl object-cover shadow-card-premium" />
        </section>

        {/* SECTION 4: BUSINESS */}
        <section id="business" className="border-t border-border bg-muted/20">
          <div className="container mx-auto grid items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
            <img src={homeBusiness} alt="Espace Business : boutique en ligne, comptabilité et factures" loading="lazy" width={1408} height={912} className="w-full rounded-3xl object-cover shadow-card-premium" />
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">04 · Espace Business</span>
              <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">Votre boutique en ligne, tout-en-un.</h2>
              <p className="mt-4 text-muted-foreground">Créez votre projet, lancez votre boutique, recevez vos paiements au Burkina et à l'international, et pilotez tout depuis un tableau de bord premium.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { i: Store, t: "Boutique en ligne", d: "Catalogue, panier, checkout." },
                  { i: TrendingUp, t: "Comptabilité intégrée", d: "Recettes, dépenses, exports." },
                  { i: Users, t: "Suivi client", d: "CRM, factures et reçus." },
                  { i: Globe2, t: "International", d: "Recevez du monde entier." },
                ].map((b) => (
                  <div key={b.t} className="rounded-xl border border-border bg-card p-4">
                    <b.i className="h-5 w-5 text-primary" />
                    <div className="mt-2 text-sm font-semibold">{b.t}</div>
                    <div className="text-xs text-muted-foreground">{b.d}</div>
                  </div>
                ))}
              </div>
              <Link to="/business" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
                Ouvrir mon Espace Business <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="container mx-auto px-4 py-16 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Comment ça marche</span>
            <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">4 étapes pour tout gérer.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-6">
                <span className="font-[Space_Grotesk] text-3xl font-black text-primary/30">{s.n}</span>
                <h4 className="mt-3 font-semibold">{s.t}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="container mx-auto px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Ils nous font confiance</span>
            <h2 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">Plus de 10 000 Burkinabè utilisent FASO-INVEST PAY.</h2>
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
          <div className="container mx-auto max-w-3xl px-4 py-16 sm:px-6">
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
        <section className="container mx-auto px-4 py-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 text-center text-primary-foreground shadow-card-premium md:p-16">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-black/20 blur-3xl" />
            <h2 className="relative font-[Space_Grotesk] text-3xl font-bold md:text-5xl">Prêt à basculer sur votre fintech burkinabè ?</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">Ouvrez votre compte FASO-INVEST PAY en moins de 2 minutes. Aucun engagement.</p>
            <Link to="/auth" className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-background px-7 py-3 text-sm font-semibold text-foreground hover:scale-[1.02] transition-transform">
              Commencer maintenant <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

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

export default Index;

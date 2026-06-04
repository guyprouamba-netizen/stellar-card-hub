import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Send,
  Wallet,
  CreditCard,
  Snowflake,
  Eye,
  EyeOff,
  MoreHorizontal,
  Coffee,
  ShoppingBag,
  Plane,
  Music,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { VirtualCard } from "@/components/virtual-card";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Volty" },
      { name: "description", content: "Gérez vos cartes, votre solde et vos transactions." },
    ],
  }),
  component: Dashboard,
});

const txs = [
  { icon: Coffee, label: "Starbucks Coffee", cat: "Restauration", amount: -4.5, date: "Aujourd'hui · 09:12", color: "text-amber-500" },
  { icon: ShoppingBag, label: "Amazon EU", cat: "Shopping", amount: -89.99, date: "Aujourd'hui · 08:01", color: "text-blue-500" },
  { icon: ArrowDownLeft, label: "Virement entrant", cat: "Recharge", amount: 1500, date: "Hier · 16:30", color: "text-emerald-500" },
  { icon: Plane, label: "Air France", cat: "Voyage", amount: -312.4, date: "Hier · 11:25", color: "text-rose-500" },
  { icon: Music, label: "Spotify Premium", cat: "Abonnement", amount: -9.99, date: "12 oct.", color: "text-emerald-500" },
  { icon: Smartphone, label: "Orange Mobile", cat: "Téléphonie", amount: -29.99, date: "10 oct.", color: "text-orange-500" },
];

function Dashboard() {
  const [hideBalance, setHideBalance] = useState(false);
  const [activeCard, setActiveCard] = useState(0);

  const cards = [
    { variant: "primary" as const, balance: "€4 820,12", number: "4242  4242  4242  4242", brand: "Visa", label: "Carte principale" },
    { variant: "teal" as const, balance: "$1 240,00", number: "5320  ****  ****  9821", brand: "Mastercard", label: "Carte USD" },
    { variant: "sunset" as const, balance: "£610,40", number: "6011  ****  ****  4421", brand: "Visa", label: "Voyage" },
  ];

  const actions = [
    { icon: Plus, label: "Recharger" },
    { icon: Send, label: "Envoyer" },
    { icon: CreditCard, label: "Nouvelle carte" },
    { icon: Snowflake, label: "Geler" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Bonjour Alex 👋</p>
            <h1 className="mt-1 font-[Space_Grotesk] text-3xl font-bold tracking-tight sm:text-4xl">
              Tableau de bord
            </h1>
          </div>
          <Link
            to="/cards"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <CreditCard className="h-4 w-4" /> Toutes mes cartes
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Balance + Card */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Wallet className="h-4 w-4" /> Solde total
                    <button onClick={() => setHideBalance((v) => !v)} className="ml-1 rounded p-1 hover:bg-muted">
                      {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="mt-2 font-[Space_Grotesk] text-5xl font-bold tabular-nums tracking-tight">
                    {hideBalance ? "•••••" : "€6 670,52"}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-success">
                    <TrendingUp className="h-3.5 w-3.5" /> +12,4% ce mois
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {actions.map((a) => (
                    <button
                      key={a.label}
                      className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3 py-3 text-xs font-medium transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
                        <a.icon className="h-4 w-4" />
                      </span>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card carousel */}
              <div className="mt-8 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
                <motion.div key={activeCard} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
                  <VirtualCard {...cards[activeCard]} />
                </motion.div>
                <div className="space-y-2">
                  {cards.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveCard(i)}
                      className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-all ${
                        activeCard === i ? "border-primary bg-primary/5" : "border-border bg-surface-2 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-14 rounded-md ${c.variant === "primary" ? "bg-gradient-card" : c.variant === "teal" ? "bg-gradient-card-2" : "bg-gradient-card-3"}`} />
                        <div>
                          <p className="text-sm font-medium">{c.label}</p>
                          <p className="text-xs text-muted-foreground">{c.number.slice(-9)}</p>
                        </div>
                      </div>
                      <p className="font-semibold tabular-nums">{c.balance}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Transactions récentes</h2>
                <button className="text-sm text-primary hover:underline">Tout voir</button>
              </div>
              <ul className="mt-4 divide-y divide-border">
                {txs.map((t, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-2">
                        <t.icon className={`h-4 w-4 ${t.color}`} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.cat} · {t.date}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-success" : ""}`}>
                      {t.amount > 0 ? "+" : ""}{t.amount.toFixed(2)} €
                    </p>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-border bg-gradient-primary p-6 text-primary-foreground shadow-glow">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium opacity-80">Cashback du mois</p>
                <MoreHorizontal className="h-5 w-5 opacity-70" />
              </div>
              <p className="mt-3 font-[Space_Grotesk] text-4xl font-bold tabular-nums">€84,20</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-2/3 rounded-full bg-white" />
              </div>
              <p className="mt-2 text-xs opacity-80">66 % vers votre prochain palier</p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dépenses</h3>
              <p className="mt-2 font-[Space_Grotesk] text-3xl font-bold tabular-nums">€1 240,80</p>
              <p className="text-xs text-muted-foreground">sur ce mois</p>

              <div className="mt-5 space-y-3">
                {[
                  { l: "Shopping", v: 45, c: "bg-primary" },
                  { l: "Restauration", v: 25, c: "bg-accent" },
                  { l: "Voyage", v: 18, c: "bg-warning" },
                  { l: "Abonnements", v: 12, c: "bg-success" },
                ].map((s) => (
                  <div key={s.l}>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{s.l}</span>
                      <span className="tabular-nums">{s.v}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${s.v}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${s.c}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-dashed border-border bg-surface-2 p-6 text-center">
              <ArrowUpRight className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-3 text-sm font-medium">Activez la double authentification</p>
              <p className="mt-1 text-xs text-muted-foreground">Sécurisez vos paiements en moins de 2 minutes.</p>
              <button className="mt-4 w-full rounded-full bg-gradient-primary py-2 text-sm font-semibold text-primary-foreground shadow-glow">
                Activer 2FA
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
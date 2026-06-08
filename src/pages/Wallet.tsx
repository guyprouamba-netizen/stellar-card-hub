import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Plus, Repeat, Send, TrendingUp, Wallet as WalletIcon, Zap } from "lucide-react";
import { useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { RechargeSheet } from "@/components/recharge-sheet";

const wallets = [
  { code: "XOF", label: "Franc CFA", balance: 1_245_000, symbol: "FCFA" },
  { code: "USD", label: "Dollar US", balance: 820.5, symbol: "$" },
  { code: "EUR", label: "Euro", balance: 312.2, symbol: "€" },
];

const movements = [
  { type: "in", label: "Recharge Mobile Money", method: "Orange Money", amount: 50000, currency: "XOF", date: "Aujourd'hui · 11:24", status: "success" as const },
  { type: "out", label: "Émission carte USD", method: "FASO-INVEST PAY", amount: -25000, currency: "XOF", date: "Hier · 17:02", status: "success" as const },
  { type: "in", label: "Recharge Mobile Money", method: "MTN MoMo", amount: 25000, currency: "XOF", date: "12 mai · 09:11", status: "success" as const },
  { type: "out", label: "Transfert vers @marie", method: "FASO-INVEST PAY", amount: -7500, currency: "XOF", date: "10 mai · 18:46", status: "success" as const },
  { type: "in", label: "Recharge Mobile Money", method: "Wave", amount: 10000, currency: "XOF", date: "08 mai · 14:00", status: "pending" as const },
];

function WalletPage() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = wallets[active];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="container mx-auto px-4 py-4 sm:px-6">
        <BackButton to="/dashboard" className="mb-2" />
      </div>
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Bonjour Alex 👋</p>
            <h1 className="mt-1 font-[Space_Grotesk] text-3xl font-bold tracking-tight sm:text-4xl">Mon portefeuille</h1>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-105 transition-transform"
          >
            <Plus className="h-4 w-4" /> Recharger
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 overflow-hidden rounded-3xl border border-border bg-gradient-card p-8 text-white shadow-card-premium">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm opacity-80">
                  <WalletIcon className="h-4 w-4" /> Solde {current.code}
                </div>
                <p className="mt-3 font-[Space_Grotesk] text-5xl font-bold tabular-nums tracking-tight">
                  {current.balance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} <span className="text-2xl opacity-80">{current.symbol}</span>
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-300">
                  <TrendingUp className="h-3.5 w-3.5" /> +8,2% ce mois
                </p>
              </div>
              <div className="flex gap-1.5">
                {wallets.map((w, i) => (
                  <button
                    key={w.code}
                    onClick={() => setActive(i)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      active === i ? "bg-white text-foreground" : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    {w.code}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-4 gap-2 sm:gap-3">
              {[
                { icon: Plus, label: "Recharger", onClick: () => setOpen(true) },
                { icon: Send, label: "Envoyer" },
                { icon: Repeat, label: "Convertir" },
                { icon: Zap, label: "Auto-recharge" },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="group flex flex-col items-center gap-2 rounded-2xl bg-white/10 px-3 py-3 text-xs font-medium backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/20"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
                    <a.icon className="h-4 w-4" />
                  </span>
                  {a.label}
                </button>
              ))}
            </div>
          </motion.div>

          <div className="space-y-4">
            {wallets.map((w, i) => (
              <button
                key={w.code}
                onClick={() => setActive(i)}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                  active === i ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{w.label}</p>
                  <p className="mt-1 font-[Space_Grotesk] text-xl font-bold tabular-nums">
                    {w.balance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {w.symbol}
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{w.code}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Mouvements récents</h2>
              <p className="text-xs text-muted-foreground">Recharges Mobile Money, achats de cartes et transferts</p>
            </div>
            <Link to="/dashboard" className="text-sm text-primary hover:underline">Voir tout</Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {movements.map((m, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between py-4"
              >
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-full ${m.type === "in" ? "bg-success/15 text-success" : "bg-rose-500/15 text-rose-500"}`}>
                    {m.type === "in" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.method} · {m.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold tabular-nums ${m.amount > 0 ? "text-success" : ""}`}>
                    {m.amount > 0 ? "+" : ""}{m.amount.toLocaleString("fr-FR")} {m.currency}
                  </p>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    m.status === "success" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  }`}>
                    {m.status === "success" ? "Validé" : "En attente"}
                  </span>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      <RechargeSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export default WalletPage;

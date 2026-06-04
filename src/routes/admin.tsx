import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Users,
  CreditCard,
  Wallet,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — Volty" },
      { name: "description", content: "Console d'administration Volty : utilisateurs, KYC, cartes, transactions." },
    ],
  }),
  component: AdminDashboard,
});

const kpis = [
  { label: "Utilisateurs", value: "12 480", delta: "+8,2%", icon: Users, tone: "text-primary" },
  { label: "Cartes émises", value: "4 921", delta: "+12,4%", icon: CreditCard, tone: "text-accent" },
  { label: "Volume (XOF)", value: "184,2 M", delta: "+5,1%", icon: Wallet, tone: "text-success" },
  { label: "Revenus du mois", value: "8,4 M", delta: "+18,6%", icon: TrendingUp, tone: "text-warning" },
];

const kycQueue = [
  { name: "Aïcha Diallo", email: "aicha@example.com", country: "SN", status: "pending" },
  { name: "Jean-Pierre Kouadio", email: "jp.k@example.com", country: "CI", status: "review" },
  { name: "Mariam Touré", email: "mariam@example.com", country: "ML", status: "pending" },
  { name: "Samuel Boateng", email: "samuel@example.com", country: "GH", status: "approved" },
  { name: "Lina Mensah", email: "lina@example.com", country: "TG", status: "rejected" },
];

const recentTx = [
  { id: "TX-9382", user: "alex.martin@volty.io", type: "Recharge YengaPay", amount: 25000, currency: "XOF", status: "success" },
  { id: "TX-9381", user: "fatou@volty.io", type: "Émission carte USD", amount: -10, currency: "USD", status: "success" },
  { id: "TX-9380", user: "kofi@volty.io", type: "Top-up carte", amount: -50, currency: "USD", status: "pending" },
  { id: "TX-9379", user: "nadia@volty.io", type: "Recharge YengaPay", amount: 50000, currency: "XOF", status: "failed" },
  { id: "TX-9378", user: "ibrahim@volty.io", type: "Frais d'émission", amount: -2.5, currency: "USD", status: "success" },
];

const providerHealth = [
  { name: "Strowallet", latency: "184 ms", status: "ok" },
  { name: "YengaPay", latency: "212 ms", status: "ok" },
  { name: "Webhook signatures", latency: "—", status: "ok" },
];

function statusBadge(s: string) {
  const map: Record<string, { c: string; Icon: typeof CheckCircle2; label: string }> = {
    success: { c: "bg-success/15 text-success", Icon: CheckCircle2, label: "OK" },
    approved: { c: "bg-success/15 text-success", Icon: CheckCircle2, label: "Validé" },
    pending: { c: "bg-warning/15 text-warning", Icon: Clock, label: "En attente" },
    review: { c: "bg-warning/15 text-warning", Icon: Clock, label: "À revoir" },
    failed: { c: "bg-destructive/15 text-destructive", Icon: XCircle, label: "Échec" },
    rejected: { c: "bg-destructive/15 text-destructive", Icon: XCircle, label: "Rejeté" },
    ok: { c: "bg-success/15 text-success", Icon: CheckCircle2, label: "Opérationnel" },
  };
  const cfg = map[s] ?? map.pending;
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.c}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Console Super-Admin
            </p>
            <h1 className="mt-3 font-[Space_Grotesk] text-3xl font-bold tracking-tight sm:text-4xl">
              Tableau de bord administrateur
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Vue d'ensemble de la plateforme Volty</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Rechercher un utilisateur, une transaction…"
              className="w-72 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-3xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="flex items-center justify-between">
                <span className={`grid h-10 w-10 place-items-center rounded-xl bg-surface-2 ${k.tone}`}>
                  <k.icon className="h-4 w-4" />
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <ArrowUpRight className="h-3 w-3" /> {k.delta}
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="mt-1 font-[Space_Grotesk] text-3xl font-bold tabular-nums">{k.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* KYC queue */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">File d'attente KYC</h2>
                <p className="text-xs text-muted-foreground">Validation Strowallet (synchronisation automatique)</p>
              </div>
              <button className="text-sm text-primary hover:underline">Tout voir</button>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Utilisateur</th>
                    <th className="px-4 py-3 text-left">Pays</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {kycQueue.map((u) => (
                    <tr key={u.email} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{u.country}</td>
                      <td className="px-4 py-3">{statusBadge(u.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium hover:bg-muted">
                          Examiner
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Provider health */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">État des intégrations</h3>
              <ul className="mt-4 space-y-3">
                {providerHealth.map((p) => (
                  <li key={p.name} className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 p-3">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">Latence&nbsp;: {p.latency}</p>
                    </div>
                    {statusBadge(p.status)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-warning/30 bg-warning/5 p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-warning/15 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">3 webhooks YengaPay à rejouer</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Signatures vérifiées · échec côté wallet. Relance manuelle disponible.
                  </p>
                  <button className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
                    Rejouer maintenant <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Transactions récentes</h2>
              <p className="text-xs text-muted-foreground">Recharges YengaPay · émissions de cartes Strowallet</p>
            </div>
            <button className="text-sm text-primary hover:underline">Exporter CSV</button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Utilisateur</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {recentTx.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{t.id}</td>
                    <td className="px-4 py-3">{t.user}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t.amount > 0 ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {t.type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${t.amount > 0 ? "text-success" : ""}`}>
                      {t.amount > 0 ? "+" : ""}
                      {t.amount.toLocaleString("fr-FR")} {t.currency}
                    </td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
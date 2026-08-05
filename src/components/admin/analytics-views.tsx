import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, FunnelChart, Funnel, LabelList,
} from "recharts";
import { AnalyticsBundle, DateRange, countBy, pctChange, seriesByDay, sumBy } from "@/lib/analytics/queries";
import { CHART_COLORS, DataTable, ExportButton, KpiCard, Panel, fmtNum, fmtPct, fmtXof } from "./analytics-ui";

const grid = "grid gap-3 sm:grid-cols-2 xl:grid-cols-4";
const axisProps = { stroke: "hsl(var(--muted-foreground))", fontSize: 11 } as const;

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
    color: "hsl(var(--foreground))",
  },
} as const;

function depositRows(b: AnalyticsBundle) {
  return b.transactions.filter((t) => t.type === "deposit" && t.status === "success");
}
function withdrawalRows(b: AnalyticsBundle) {
  return b.transactions.filter((t) => (t.type === "withdrawal") && t.status === "success");
}
function cardRows(b: AnalyticsBundle) {
  return b.transactions.filter((t) => (t.type === "card_issue" || t.type === "card_fund") && t.status === "success");
}

function LineSeries({ data, label, color = CHART_COLORS[0] }: { data: { date: string; value: number }[]; label: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} />
        <Line type="monotone" dataKey="value" name={label} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Donut({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------- Temps réel
export function RealtimeAnalyticsTab({ bundle }: { bundle: AnalyticsBundle }) {
  const now = Date.now();
  const live = bundle.sessions.filter((s) => now - new Date(s.last_seen_at).getTime() < 5 * 60_000);
  const last24h = bundle.sessions.filter((s) => now - new Date(s.started_at).getTime() < 24 * 3600_000);
  const pendingTx = bundle.transactions.filter((t) => t.status === "pending");
  const recentEvents = bundle.events.slice(0, 40);

  const byHour = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now - i * 3600_000);
      map.set(`${String(d.getHours()).padStart(2, "0")}h`, 0);
    }
    for (const s of last24h) {
      const k = `${String(new Date(s.started_at).getHours()).padStart(2, "0")}h`;
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].map(([date, value]) => ({ date, value }));
  }, [bundle.sessions]);

  return (
    <div className="space-y-4">
      <div className={grid}>
        <KpiCard label="Visiteurs connectés maintenant" value={fmtNum(live.length)} hint="Actifs < 5 min" tone="positive" />
        <KpiCard label="Sessions (24 h)" value={fmtNum(last24h.length)} />
        <KpiCard label="Transactions en cours" value={fmtNum(pendingTx.length)} tone={pendingTx.length ? "negative" : "neutral"} />
        <KpiCard label="Pages vues (période)" value={fmtNum(bundle.events.filter((e) => e.kind === "pageview").length)} />
      </div>

      <Panel title="Sessions par heure (24 h)">
        <LineSeries data={byHour} label="Sessions" />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Visiteurs actifs" action={<ExportButton filename="visiteurs-actifs.csv" rows={live} />}>
          <DataTable
            rows={live.slice(0, 25)}
            columns={[
              { key: "landing_path", label: "Entrée" },
              { key: "country", label: "Pays", render: (r: any) => r.country || "—" },
              { key: "device_type", label: "Appareil", render: (r: any) => r.device_type || "—" },
              { key: "last_seen_at", label: "Vu à", align: "right", render: (r: any) => new Date(r.last_seen_at).toLocaleTimeString("fr-FR") },
            ]}
            empty="Aucun visiteur actif en ce moment."
          />
        </Panel>
        <Panel title="Flux d'activité récent">
          <DataTable
            rows={recentEvents}
            columns={[
              { key: "created_at", label: "Heure", render: (r: any) => new Date(r.created_at).toLocaleTimeString("fr-FR") },
              { key: "kind", label: "Type" },
              { key: "path", label: "Page / action", render: (r: any) => r.action || r.path || "—" },
            ]}
            empty="Aucun évènement enregistré pour l'instant."
          />
        </Panel>
      </div>

      <Panel title="Transactions en cours">
        <DataTable
          rows={pendingTx.slice(0, 20)}
          columns={[
            { key: "created_at", label: "Date", render: (r: any) => new Date(r.created_at).toLocaleString("fr-FR") },
            { key: "type", label: "Type" },
            { key: "description", label: "Détail", render: (r: any) => r.description || "—" },
            { key: "amount", label: "Montant", align: "right", render: (r: any) => `${Number(r.amount).toLocaleString("fr-FR")} ${r.currency}` },
          ]}
          empty="Aucune transaction en attente."
        />
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------- Trafic & funnel
export function BehaviourAnalyticsTab({ bundle, onSelectUser }: { bundle: AnalyticsBundle; onSelectUser: (id: string) => void }) {
  const pageviews = bundle.events.filter((e) => e.kind === "pageview");
  const durations = bundle.events.filter((e) => e.kind === "page_duration");
  const actions = bundle.events.filter((e) => e.kind === "action");

  const pages = useMemo(() => {
    const map = new Map<string, { path: string; views: number; totalMs: number; visitors: Set<string> }>();
    for (const e of pageviews) {
      const path = e.path || "—";
      const cur = map.get(path) ?? { path, views: 0, totalMs: 0, visitors: new Set<string>() };
      cur.views += 1; cur.visitors.add(e.session_key);
      map.set(path, cur);
    }
    for (const e of durations) {
      const cur = map.get(e.path || "—");
      if (cur) cur.totalMs += Number(e.duration_ms) || 0;
    }
    return [...map.values()].map((p) => ({
      path: p.path, views: p.views, visiteurs: p.visitors.size,
      tempsMoyen: p.views ? Math.round(p.totalMs / p.views / 1000) : 0,
    })).sort((a, b) => b.views - a.views);
  }, [bundle.events]);

  const funnel = useMemo(() => {
    const steps = [
      { name: "Accueil", key: "accueil" },
      { name: "Boutique", key: "boutique" },
      { name: "Paiement", key: "paiement" },
      { name: "Confirmation", key: "confirmation" },
    ];
    return steps.map((s) => ({
      name: s.name,
      value: new Set(bundle.events.filter((e) => e.funnel_step === s.key).map((e) => e.session_key)).size,
    }));
  }, [bundle.events]);

  const abandon = useMemo(() => funnel.slice(0, -1).map((s, i) => ({
    etape: `${s.name} → ${funnel[i + 1].name}`,
    taux: s.value ? ((s.value - funnel[i + 1].value) / s.value) * 100 : 0,
  })), [funnel]);

  const bounce = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of pageviews) counts.set(e.session_key, (counts.get(e.session_key) ?? 0) + 1);
    const total = counts.size;
    const single = [...counts.values()].filter((v) => v <= 1).length;
    return total ? (single / total) * 100 : 0;
  }, [bundle.events]);

  const unique = new Set(bundle.sessions.map((s) => s.visitor_key)).size;
  const returning = bundle.sessions.filter((s) => s.is_returning).length;

  return (
    <div className="space-y-4">
      <div className={grid}>
        <KpiCard label="Visiteurs uniques" value={fmtNum(unique)} />
        <KpiCard label="Visiteurs récurrents" value={fmtNum(returning)} />
        <KpiCard label="Sessions" value={fmtNum(bundle.sessions.length)} />
        <KpiCard label="Taux de rebond" value={fmtPct(bounce)} tone={bounce > 60 ? "negative" : "positive"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Visiteurs par jour">
          <LineSeries data={seriesByDay(bundle.sessions, (s: any) => s.started_at)} label="Sessions" />
        </Panel>
        <Panel title="Sources de trafic">
          <Donut data={countBy(bundle.sessions, (s: any) => s.source)} />
        </Panel>
        <Panel title="Type d'appareil">
          <Donut data={countBy(bundle.sessions, (s: any) => s.device_type)} />
        </Panel>
        <Panel title="Navigateur">
          <Donut data={countBy(bundle.sessions, (s: any) => s.browser)} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Parcours type (entonnoir)">
          {funnel.some((f) => f.value > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <FunnelChart>
                <Tooltip {...tooltipStyle} />
                <Funnel dataKey="value" data={funnel} isAnimationActive>
                  {funnel.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  <LabelList position="right" dataKey="name" fill="hsl(var(--foreground))" fontSize={12} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          ) : <p className="py-8 text-center text-sm text-muted-foreground">Pas encore de parcours enregistré.</p>}
        </Panel>
        <Panel title="Taux d'abandon par étape">
          <DataTable
            rows={abandon}
            columns={[
              { key: "etape", label: "Étape" },
              { key: "taux", label: "Abandon", align: "right", render: (r: any) => fmtPct(r.taux) },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Pays et villes des visiteurs" action={<ExportButton filename="geographie.csv" rows={countBy(bundle.sessions, (s: any) => s.country)} />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable
            rows={countBy(bundle.sessions, (s: any) => s.country).slice(0, 15)}
            columns={[{ key: "name", label: "Pays" }, { key: "value", label: "Sessions", align: "right" }]}
          />
          <DataTable
            rows={countBy(bundle.sessions, (s: any) => s.city).slice(0, 15)}
            columns={[{ key: "name", label: "Ville" }, { key: "value", label: "Sessions", align: "right" }]}
          />
        </div>
      </Panel>

      <Panel title="Pages visitées et temps passé" action={<ExportButton filename="pages.csv" rows={pages} />}>
        <DataTable
          rows={pages.slice(0, 25)}
          columns={[
            { key: "path", label: "Page" },
            { key: "visiteurs", label: "Visiteurs", align: "right" },
            { key: "views", label: "Vues", align: "right" },
            { key: "tempsMoyen", label: "Temps moyen", align: "right", render: (r: any) => `${r.tempsMoyen} s` },
          ]}
        />
      </Panel>

      <Panel title="Actions clés effectuées" action={<ExportButton filename="actions.csv" rows={countBy(actions, (a: any) => a.action)} />}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={countBy(actions, (a: any) => a.action).slice(0, 10)}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" name="Clics" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Utilisateurs suivis (fiche détaillée sur clic)">
        <DataTable
          rows={bundle.profiles.slice(0, 30)}
          onRowClick={(r: any) => onSelectUser(r.id)}
          columns={[
            { key: "full_name", label: "Utilisateur", render: (r: any) => r.full_name || "—" },
            { key: "country", label: "Pays", render: (r: any) => r.country || "—" },
            { key: "created_at", label: "Inscrit le", align: "right", render: (r: any) => new Date(r.created_at).toLocaleDateString("fr-FR") },
          ]}
        />
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------- Hebdomadaire
export function WeeklyAnalyticsTab({ bundle, previous, range }: { bundle: AnalyticsBundle; previous: AnalyticsBundle | null; range: DateRange }) {
  const deposits = depositRows(bundle);
  const withdrawals = withdrawalRows(bundle);
  const prevDeposits = previous ? depositRows(previous) : [];
  const prevWithdrawals = previous ? withdrawalRows(previous) : [];

  const depositTotal = sumBy(deposits, (t: any) => t.amount);
  const withdrawalTotal = sumBy(withdrawals, (t: any) => t.amount);
  const avgBasket = deposits.length ? depositTotal / deposits.length : 0;
  const payingUsers = new Set(deposits.map((t: any) => t.user_id)).size;
  const visitors = new Set(bundle.sessions.map((s) => s.visitor_key)).size;
  const conversion = visitors ? (payingUsers / visitors) * 100 : 0;

  const perService = [
    { name: "Cartes virtuelles", value: cardRows(bundle).length, volume: sumBy(cardRows(bundle), (t: any) => t.amount) },
    { name: "Boutique", value: bundle.payments.filter((p: any) => p.status === "success").length, volume: sumBy(bundle.payments.filter((p: any) => p.status === "success"), (p: any) => p.amount) },
    { name: "Retraits", value: withdrawals.length, volume: withdrawalTotal },
    { name: "Dépôts", value: deposits.length, volume: depositTotal },
  ];

  const topUsers = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of deposits) map.set(t.user_id, (map.get(t.user_id) ?? 0) + Number(t.amount || 0));
    const names = new Map(bundle.profiles.map((p: any) => [p.id, p.full_name || p.email || p.id.slice(0, 8)]));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([id, volume]) => ({ id, utilisateur: names.get(id) ?? id.slice(0, 8), volume }));
  }, [bundle]);

  return (
    <div className="space-y-4">
      <div className={grid}>
        <KpiCard label="Volume rechargé" value={fmtXof(depositTotal)} delta={pctChange(depositTotal, sumBy(prevDeposits, (t: any) => t.amount))} hint="vs période précédente" />
        <KpiCard label="Volume retiré" value={fmtXof(withdrawalTotal)} delta={pctChange(withdrawalTotal, sumBy(prevWithdrawals, (t: any) => t.amount))} hint="vs période précédente" />
        <KpiCard label="Panier moyen" value={fmtXof(avgBasket)} />
        <KpiCard label="Conversion visiteur → client" value={fmtPct(conversion)} tone={conversion > 2 ? "positive" : "neutral"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Dépôts par jour" action={<ExportButton filename="depots.csv" rows={deposits} />}>
          <LineSeries data={seriesByDay(deposits, (t: any) => t.created_at, (t: any) => Number(t.amount))} label="XOF déposés" />
        </Panel>
        <Panel title="Retraits par jour" action={<ExportButton filename="retraits.csv" rows={withdrawals} />}>
          <LineSeries data={seriesByDay(withdrawals, (t: any) => t.created_at, (t: any) => Number(t.amount))} label="XOF retirés" color={CHART_COLORS[5]} />
        </Panel>
      </div>

      <Panel title="Transactions par service">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={perService}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="value" name="Transactions" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Top utilisateurs par volume" action={<ExportButton filename="top-utilisateurs.csv" rows={topUsers} />}>
        <DataTable
          rows={topUsers}
          columns={[
            { key: "utilisateur", label: "Utilisateur" },
            { key: "volume", label: "Volume rechargé", align: "right", render: (r: any) => fmtXof(r.volume) },
          ]}
        />
      </Panel>

      <p className="text-xs text-muted-foreground">
        Période analysée : {range.from.toLocaleDateString("fr-FR")} → {range.to.toLocaleDateString("fr-FR")}
      </p>
    </div>
  );
}

// -------------------------------------------------------------- Stratégique
export function StrategicAnalyticsTab({ bundle }: { bundle: AnalyticsBundle }) {
  const deposits = depositRows(bundle);
  const fees = bundle.transactions.filter((t: any) => t.type === "fee" && t.status === "success");
  const cardsIssued = bundle.transactions.filter((t: any) => t.type === "card_issue" && t.status === "success");
  const shopFees = sumBy(bundle.payments, (p: any) => p.fee_amount);

  const revenueByService = [
    { name: "Cartes virtuelles", value: sumBy(cardsIssued, (t: any) => t.amount) },
    { name: "Frais plateforme", value: sumBy(fees, (t: any) => t.amount) },
    { name: "Boutique (commissions)", value: shopFees },
  ].filter((r) => r.value > 0);

  const now = Date.now();
  const activeUserIds = new Set(bundle.transactions.filter((t: any) => now - new Date(t.created_at).getTime() < 30 * 86400_000).map((t: any) => t.user_id));
  const churn = bundle.profiles.length ? ((bundle.profiles.length - activeUserIds.size) / bundle.profiles.length) * 100 : 0;

  const cohorts = useMemo(() => {
    const map = new Map<string, { mois: string; inscrits: number; actifs: number }>();
    for (const p of bundle.profiles as any[]) {
      const mois = String(p.created_at).slice(0, 7);
      const cur = map.get(mois) ?? { mois, inscrits: 0, actifs: 0 };
      cur.inscrits += 1;
      if (activeUserIds.has(p.id)) cur.actifs += 1;
      map.set(mois, cur);
    }
    return [...map.values()].sort((a, b) => a.mois.localeCompare(b.mois))
      .map((c) => ({ ...c, retention: c.inscrits ? (c.actifs / c.inscrits) * 100 : 0 }));
  }, [bundle.profiles]);

  const rechargeFrequency = (() => {
    const per = new Map<string, number>();
    for (const d of deposits) per.set(d.user_id, (per.get(d.user_id) ?? 0) + 1);
    const values = [...per.values()];
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  })();

  const totalCardBalance = sumBy(bundle.cards, (c: any) => c.balance);

  return (
    <div className="space-y-4">
      <div className={grid}>
        <KpiCard label="Utilisateurs inscrits" value={fmtNum(bundle.profiles.length)} />
        <KpiCard label="Taux de churn (30 j)" value={fmtPct(churn)} tone={churn > 60 ? "negative" : "positive"} hint="Inactifs depuis 30 jours" />
        <KpiCard label="Fréquence de recharge" value={`${rechargeFrequency.toFixed(1)} / utilisateur`} />
        <KpiCard label="Solde total des cartes" value={`${totalCardBalance.toFixed(2)} USD`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Répartition des revenus par service">
          <Donut data={revenueByService} />
        </Panel>
        <Panel title="Rétention par cohorte d'inscription" action={<ExportButton filename="cohortes.csv" rows={cohorts} />}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cohorts}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mois" {...axisProps} />
              <YAxis {...axisProps} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="retention" name="Rétention" fill={CHART_COLORS[4]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Détail des cohortes">
        <DataTable
          rows={cohorts}
          columns={[
            { key: "mois", label: "Mois d'inscription" },
            { key: "inscrits", label: "Inscrits", align: "right" },
            { key: "actifs", label: "Encore actifs", align: "right" },
            { key: "retention", label: "Rétention", align: "right", render: (r: any) => fmtPct(r.retention) },
          ]}
        />
      </Panel>

      <Panel title="Croissance des inscriptions">
        <LineSeries data={seriesByDay(bundle.profiles, (p: any) => p.created_at)} label="Inscriptions" color={CHART_COLORS[2]} />
      </Panel>
    </div>
  );
}
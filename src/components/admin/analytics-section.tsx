import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { buildRange, loadAnalytics, previousRange, RangeKey } from "@/lib/analytics/queries";
import { DateRangeFilter } from "./date-range-filter";
import { UserDetailDrawer } from "./user-detail-drawer";
import {
  RealtimeAnalyticsTab, BehaviourAnalyticsTab, WeeklyAnalyticsTab, StrategicAnalyticsTab,
} from "./analytics-views";

type View = "realtime" | "behaviour" | "weekly" | "strategic";

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "realtime", label: "Temps réel" },
  { id: "behaviour", label: "Comportement" },
  { id: "weekly", label: "Hebdomadaire" },
  { id: "strategic", label: "Stratégique" },
];

export function AnalyticsSection() {
  const [view, setView] = useState<View>("realtime");
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const range = useMemo(() => buildRange(rangeKey, from, to), [rangeKey, from, to]);
  const prev = useMemo(() => previousRange(range), [range]);
  const rangeId = `${range.from.toISOString()}_${range.to.toISOString()}`;

  const current = useQuery({
    queryKey: ["analytics", rangeId],
    queryFn: () => loadAnalytics(range),
    refetchInterval: rangeKey === "today" ? 30_000 : 120_000,
  });
  const previous = useQuery({
    queryKey: ["analytics-prev", rangeId],
    queryFn: () => loadAnalytics(prev),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Analytique</h1>
          <p className="text-xs text-muted-foreground">Trafic, comportement, finance et rétention — données internes uniquement.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={rangeKey} onChange={setRangeKey} from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <button
            onClick={() => { current.refetch(); previous.refetch(); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${current.isFetching ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 rounded-full border border-border bg-card/40 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${view === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {current.isLoading ? (
        <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : current.isError || !current.data ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
          <p className="mt-2">{current.error instanceof Error ? current.error.message : "Chargement analytique impossible."}</p>
        </div>
      ) : (
        <>
          {view === "realtime" && <RealtimeAnalyticsTab bundle={current.data} />}
          {view === "behaviour" && <BehaviourAnalyticsTab bundle={current.data} onSelectUser={setSelectedUser} />}
          {view === "weekly" && <WeeklyAnalyticsTab bundle={current.data} previous={previous.data ?? null} range={range} />}
          {view === "strategic" && <StrategicAnalyticsTab bundle={current.data} />}
        </>
      )}

      <UserDetailDrawer userId={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { X, Loader2, ShieldAlert } from "lucide-react";
import { loadUserDetail } from "@/lib/analytics/queries";
import { DataTable, Panel, fmtNum } from "./analytics-ui";

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString("fr-FR") : "—");

export function UserDetailDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["userDetail", userId],
    queryFn: () => loadUserDetail(userId!),
    enabled: !!userId,
  });

  if (!userId) return null;

  const pages = (() => {
    const map = new Map<string, { path: string; views: number; totalMs: number }>();
    for (const e of data?.events ?? []) {
      const path = e.path || "—";
      const cur = map.get(path) ?? { path, views: 0, totalMs: 0 };
      if (e.kind === "pageview") cur.views += 1;
      if (e.kind === "page_duration") cur.totalMs += Number(e.duration_ms) || 0;
      map.set(path, cur);
    }
    return [...map.values()].sort((a, b) => b.views - a.views).slice(0, 20);
  })();

  const lastSession = data?.sessions?.[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">{data?.profile?.full_name || "Utilisateur"}</h2>
            <p className="text-xs text-muted-foreground">{data?.profile?.email}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Données personnelles à accès restreint. Cette consultation est enregistrée dans le journal d'audit.</span>
        </div>

        {isLoading ? (
          <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : isError ? (
          <p className="mt-6 text-sm text-destructive">{(error as Error)?.message}</p>
        ) : (
          <div className="mt-5 space-y-4">
            <Panel title="Identité & appareil">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Téléphone" value={data?.profile?.phone || "—"} />
                <Field label="Pays du profil" value={data?.profile?.country || "—"} />
                <Field label="Pays détecté" value={lastSession?.country || "—"} />
                <Field label="Ville" value={lastSession?.city || "—"} />
                <Field label="Appareil" value={lastSession?.device_type || "—"} />
                <Field label="Navigateur" value={lastSession?.browser || "—"} />
                <Field label="Inscrit le" value={fmtDate(data?.profile?.created_at)} />
                <Field label="Dernière activité" value={fmtDate(lastSession?.last_seen_at)} />
              </dl>
            </Panel>

            <Panel title="Pages visitées & temps passé">
              <DataTable
                rows={pages}
                columns={[
                  { key: "path", label: "Page" },
                  { key: "views", label: "Vues", align: "right", render: (r) => fmtNum(r.views) },
                  { key: "totalMs", label: "Temps total", align: "right", render: (r) => `${Math.round(r.totalMs / 1000)} s` },
                ]}
                empty="Aucune navigation enregistrée."
              />
            </Panel>

            <Panel title="Cartes virtuelles">
              <DataTable
                rows={data?.cards ?? []}
                columns={[
                  { key: "brand", label: "Carte", render: (r: any) => `${(r.brand || "—").toUpperCase()} •••• ${r.last4 || "----"}` },
                  { key: "status", label: "Statut" },
                  { key: "balance", label: "Solde", align: "right", render: (r: any) => `${Number(r.balance ?? 0).toFixed(2)} USD` },
                ]}
                empty="Aucune carte."
              />
            </Panel>

            <Panel title="Historique des transactions">
              <DataTable
                rows={data?.transactions ?? []}
                columns={[
                  { key: "created_at", label: "Date", render: (r: any) => fmtDate(r.created_at) },
                  { key: "type", label: "Type" },
                  { key: "status", label: "Statut" },
                  { key: "amount", label: "Montant", align: "right", render: (r: any) => `${Number(r.amount ?? 0).toLocaleString("fr-FR")} ${r.currency}` },
                ]}
                empty="Aucune transaction."
              />
            </Panel>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
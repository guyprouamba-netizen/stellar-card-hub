import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { adminListMomoTransfers, adminRetryMomoTransferPayout, adminUpdateMomoTransferConfig, getMomoTransferConfig } from "@/lib/transfer.functions";
import { RefreshCw, Save, Repeat } from "lucide-react";

export default function AdminTransfersPage() {
  const qc = useQueryClient();
  const cfgQ = useQuery({ queryKey: ["mtr-cfg-admin"], queryFn: getMomoTransferConfig });
  const listQ = useQuery({ queryKey: ["mtr-admin"], queryFn: adminListMomoTransfers, refetchInterval: 15_000 });
  const [cfg, setCfg] = useState<any>(null);
  useEffect(() => { if (cfgQ.data) setCfg(cfgQ.data); }, [cfgQ.data]);

  const saveMut = useMutation({
    mutationFn: () => adminUpdateMomoTransferConfig({ data: {
      fee_bps: Number(cfg.fee_bps), fee_flat_xof: Number(cfg.fee_flat_xof),
      min_xof: Number(cfg.min), max_xof: Number(cfg.max), enabled: !!cfg.enabled,
    } }),
    onSuccess: () => { toast.success("Config enregistrée"); qc.invalidateQueries({ queryKey: ["mtr-cfg-admin"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const retryMut = useMutation({
    mutationFn: (id: string) => adminRetryMomoTransferPayout({ data: { id } }),
    onSuccess: () => { toast.success("Cashout relancé"); qc.invalidateQueries({ queryKey: ["mtr-admin"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const list = listQ.data ?? [];
  const stats = list.reduce((a: any, r: any) => {
    a.total += Number(r.amount_send || 0);
    a.fees += Number(r.fees_xof || 0);
    a[r.status] = (a[r.status] || 0) + 1;
    return a;
  }, { total: 0, fees: 0 });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="container mx-auto px-4 py-4 sm:px-6">
        <BackButton to="/admin" className="mb-2" />
      </div>
      <div className="container mx-auto px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground"><Repeat className="h-5 w-5" /></span>
          <div>
            <h1 className="font-[Space_Grotesk] text-2xl font-bold">Transferts</h1>
            <p className="text-sm text-muted-foreground">Supervision et configuration.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <Kpi label="Volume envoyé" value={`${stats.total.toLocaleString("fr-FR")} XOF`} />
          <Kpi label="Frais collectés" value={`${stats.fees.toLocaleString("fr-FR")} XOF`} />
          <Kpi label="Livrés" value={String(stats.delivered || 0)} />
          <Kpi label="En attente" value={String((stats.awaiting_payment || 0) + (stats.paid || 0) + (stats.disbursing || 0))} />
        </div>

        {cfg && (
          <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Configuration</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <NumField label="Frais % (basis points, ex. 150 = 1.5%)" value={cfg.fee_bps} onChange={(v) => setCfg({ ...cfg, fee_bps: v })} />
              <NumField label="Frais fixes (XOF)" value={cfg.fee_flat_xof} onChange={(v) => setCfg({ ...cfg, fee_flat_xof: v })} />
              <NumField label="Montant min (XOF)" value={cfg.min} onChange={(v) => setCfg({ ...cfg, min: v })} />
              <NumField label="Montant max (XOF)" value={cfg.max} onChange={(v) => setCfg({ ...cfg, max: v })} />
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
                  Fonctionnalité active
                </label>
              </div>
            </div>
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
              <Save className="h-4 w-4" /> Enregistrer
            </button>
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Transferts récents</h2>
            <button onClick={() => listQ.refetch()} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <RefreshCw className="h-3 w-3" /> Actualiser
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Date</th><th>Utilisateur</th><th>Trajet</th><th>Destinataire</th><th className="text-right">Envoyé</th><th className="text-right">Frais</th><th>Statut</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((t: any) => (
                  <tr key={t.id}>
                    <td className="py-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</td>
                    <td className="py-2 text-xs">{t.user?.full_name || t.user?.email || t.user_id.slice(0, 8)}</td>
                    <td className="py-2 text-xs">{t.source_operator} → {t.dest_operator}</td>
                    <td className="py-2 text-xs">{t.dest_phone}{t.dest_holder ? ` · ${t.dest_holder}` : ""}</td>
                    <td className="py-2 text-right tabular-nums">{Number(t.amount_send).toLocaleString("fr-FR")}</td>
                    <td className="py-2 text-right tabular-nums text-xs">{Number(t.fees_xof).toLocaleString("fr-FR")}</td>
                    <td className="py-2 text-xs">{t.status}</td>
                    <td className="py-2 text-right">
                      {["paid", "failed", "disbursing"].includes(t.status) && (
                        <button onClick={() => retryMut.mutate(t.id)} className="text-xs text-primary hover:underline">Relancer cashout</button>
                      )}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">Aucun transfert.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-[Space_Grotesk] text-xl font-bold">{value}</p>
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: any; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
    </div>
  );
}

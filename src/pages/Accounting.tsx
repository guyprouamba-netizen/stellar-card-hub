import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Wallet2, Trash2, Download } from "lucide-react";
import {
  listAccountingEntries, upsertAccountingEntry, deleteAccountingEntry,
  listAccountingCategories, upsertAccountingCategory, deleteAccountingCategory,
  getAccountingSummary,
} from "@/lib/accounting.functions";

const fmt = (n: number, c = "XOF") => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " " + c;

export default function Accounting() {
  const { businessId = "" } = useParams();
  const [entries, setEntries] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [tab, setTab] = useState<"entries" | "categories">("entries");
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [draft, setDraft] = useState<any>({ kind: "income", label: "", amount: "", currency: "XOF", entry_date: new Date().toISOString().slice(0, 10) });

  const load = async () => {
    const [e, c, s] = await Promise.all([
      listAccountingEntries(businessId, filter === "all" ? undefined : { kind: filter }),
      listAccountingCategories(businessId),
      getAccountingSummary(businessId),
    ]);
    setEntries(e); setCats(c); setSummary(s);
  };
  useEffect(() => { load(); }, [businessId, filter]);

  const add = async () => {
    if (!draft.label || !draft.amount) { toast.error("Libellé et montant requis"); return; }
    try { await upsertAccountingEntry(businessId, draft); setDraft({ ...draft, label: "", amount: "" }); await load(); toast.success("Écriture ajoutée"); }
    catch (e: any) { toast.error(e.message); }
  };
  const del = async (id: string) => { await deleteAccountingEntry(id); await load(); };
  const exportCsv = () => {
    const rows = [["date", "type", "libellé", "catégorie", "montant", "devise", "notes"]];
    for (const e of entries) rows.push([e.entry_date, e.kind, e.label, e.category?.name || "", e.amount, e.currency, e.notes || ""]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `compta-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totals = summary?.totals || { income: 0, expense: 0, net: 0 };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link to="/business" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Business
        </Link>
        <h1 className="mt-4 font-[Space_Grotesk] text-2xl font-bold">Comptabilité</h1>
        <p className="text-xs text-muted-foreground">Recettes, dépenses et solde net. Les commandes payées sont enregistrées automatiquement.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard icon={TrendingUp} label="Recettes" value={fmt(totals.income)} color="emerald" />
          <StatCard icon={TrendingDown} label="Dépenses" value={fmt(totals.expense)} color="rose" />
          <StatCard icon={Wallet2} label="Solde net" value={fmt(totals.net)} color={totals.net >= 0 ? "emerald" : "rose"} />
        </div>

        {summary?.monthly?.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">6 derniers mois</p>
            <div className="flex items-end gap-3 overflow-x-auto pb-2">
              {summary.monthly.map((m: any) => {
                const max = Math.max(...summary.monthly.map((x: any) => Math.max(x.income, x.expense)));
                const ih = max > 0 ? Math.round((m.income / max) * 120) : 0;
                const eh = max > 0 ? Math.round((m.expense / max) * 120) : 0;
                return (
                  <div key={m.month} className="flex min-w-[64px] flex-col items-center gap-1">
                    <div className="flex h-[120px] items-end gap-1">
                      <div className="w-3 rounded-t bg-emerald-500" style={{ height: ih }} title={`Recettes ${fmt(m.income)}`} />
                      <div className="w-3 rounded-t bg-rose-500" style={{ height: eh }} title={`Dépenses ${fmt(m.expense)}`} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-b border-border">
          <div className="flex gap-2">
            <TabBtn active={tab === "entries"} onClick={() => setTab("entries")}>Écritures</TabBtn>
            <TabBtn active={tab === "categories"} onClick={() => setTab("categories")}>Catégories</TabBtn>
          </div>
          {tab === "entries" && (
            <div className="flex gap-2">
              <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
                <option value="all">Tout</option><option value="income">Recettes</option><option value="expense">Dépenses</option>
              </select>
              <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                <Download className="h-3 w-3" /> CSV
              </button>
            </div>
          )}
        </div>

        {tab === "entries" && (
          <>
            <div className="mt-4 grid gap-2 rounded-2xl border border-border bg-card p-4 md:grid-cols-6">
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
                <option value="income">Recette</option><option value="expense">Dépense</option>
              </select>
              <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Libellé" className="md:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input type="number" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="Montant" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input type="date" value={draft.entry_date} onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <select value={draft.category_id || ""} onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
                <option value="">Catégorie…</option>
                {cats.filter((c) => c.kind === draft.kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="md:col-span-6">
                <button onClick={add} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
                  <Plus className="h-3.5 w-3.5" /> Ajouter
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs uppercase text-muted-foreground"><tr>
                  <th className="p-3 text-left">Date</th><th className="p-3 text-left">Libellé</th><th className="p-3 text-left">Catégorie</th><th className="p-3 text-right">Montant</th><th className="p-3"></th>
                </tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="p-3 text-xs">{e.entry_date}</td>
                      <td className="p-3">
                        <p className="font-semibold">{e.label}</p>
                        {e.auto_generated && <span className="rounded bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">AUTO</span>}
                      </td>
                      <td className="p-3 text-xs">{e.category?.name || "—"}</td>
                      <td className={`p-3 text-right font-bold ${e.kind === "income" ? "text-emerald-500" : "text-rose-500"}`}>
                        {e.kind === "income" ? "+" : "−"} {fmt(e.amount, e.currency)}
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => del(e.id)} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                  {!entries.length && <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Aucune écriture.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "categories" && <CategoriesTab businessId={businessId} cats={cats} reload={load} />}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colorClass = color === "emerald" ? "text-emerald-500" : "text-rose-500";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </div>
      <p className={`mt-2 text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
function TabBtn({ active, children, ...p }: any) {
  return <button {...p} className={`rounded-t-xl border-b-2 px-4 py-2 text-xs font-semibold ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>{children}</button>;
}

function CategoriesTab({ businessId, cats, reload }: any) {
  const [d, setD] = useState({ name: "", kind: "income" as "income" | "expense", color: "" });
  const add = async () => {
    if (!d.name) return;
    await upsertAccountingCategory(businessId, d); setD({ ...d, name: "" }); await reload();
  };
  const del = async (id: string) => { await deleteAccountingCategory(id); await reload(); };
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-4">
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Nom" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as any })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
          <option value="income">Recette</option><option value="expense">Dépense</option>
        </select>
        <button onClick={add} className="rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">Ajouter</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cats.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div>
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${c.kind === "income" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>{c.kind}</span>
              <p className="mt-1 font-semibold">{c.name}</p>
            </div>
            <button onClick={() => del(c.id)} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, TrendingUp, TrendingDown, Wallet2, Trash2, Download, Paperclip,
  LayoutDashboard, BookOpen, Boxes, FileBarChart2, Settings2, Building2, AlertTriangle, Printer,
} from "lucide-react";
import {
  listAccountingEntries, upsertAccountingEntry, deleteAccountingEntry,
  listAccountingCategories, upsertAccountingCategory, deleteAccountingCategory,
  getAccountingSummary,
  getAccountingSettings, upsertAccountingSettings,
  listAccountingAccounts, upsertAccountingAccount, deleteAccountingAccount,
  listStockItems, upsertStockItem, deleteStockItem, listStockMovements, createStockMovement,
  getAccountingReports,
  createAccountingAttachmentUrl, getAccountingAttachmentUrl,
  SYSCOHADA_ACCOUNTS,
} from "@/lib/accounting.functions";
import { supabase } from "@/integrations/supabase/client";

type TabId = "dashboard" | "journal" | "stock" | "reports" | "settings";
const fmt = (n: number, c = "XOF") => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " " + c;
const todayISO = () => new Date().toISOString().slice(0, 10);

const TABS: { id: TabId; label: string; Icon: any }[] = [
  { id: "dashboard", label: "Tableau de bord", Icon: LayoutDashboard },
  { id: "journal", label: "Journal", Icon: BookOpen },
  { id: "stock", label: "Stock", Icon: Boxes },
  { id: "reports", label: "Rapports", Icon: FileBarChart2 },
  { id: "settings", label: "Paramètres", Icon: Settings2 },
];

export default function Accounting() {
  const { businessId = "" } = useParams();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [settings, setSettings] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);

  const reloadCommon = async () => {
    const [s, a, c] = await Promise.all([
      getAccountingSettings(businessId).catch(() => null),
      listAccountingAccounts(businessId).catch(() => []),
      listAccountingCategories(businessId).catch(() => []),
    ]);
    setSettings(s); setAccounts(a); setCats(c);
  };
  useEffect(() => { if (businessId) reloadCommon(); }, [businessId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={`/business/${businessId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Business
            </Link>
            <h1 className="mt-3 font-[Space_Grotesk] text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {settings?.legal_name || "Comptabilité"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {settings?.legal_name
                ? `${settings.ifu ? "IFU " + settings.ifu + " · " : ""}${settings.rccm ? "RCCM " + settings.rccm + " · " : ""}Exercice ${settings.fiscal_year_start}`
                : "Configurez votre entreprise dans Paramètres pour un rendu 100% pro."}
            </p>
          </div>
        </div>

        <nav className="mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === "dashboard" && <DashboardTab businessId={businessId} settings={settings} />}
          {tab === "journal" && <JournalTab businessId={businessId} accounts={accounts} cats={cats} reloadCommon={reloadCommon} settings={settings} />}
          {tab === "stock" && <StockTab businessId={businessId} />}
          {tab === "reports" && <ReportsTab businessId={businessId} />}
          {tab === "settings" && <SettingsTab businessId={businessId} settings={settings} accounts={accounts} cats={cats} reload={reloadCommon} />}
        </div>
      </div>
    </div>
  );
}

/* ==================== DASHBOARD ==================== */
function DashboardTab({ businessId, settings }: any) {
  const [summary, setSummary] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const [s, r] = await Promise.all([
        getAccountingSummary(businessId),
        getAccountingReports(businessId),
      ]);
      setSummary(s); setReport(r);
    })();
  }, [businessId]);
  const totals = summary?.totals || { income: 0, expense: 0, net: 0 };
  const stock = report?.stock || { value: 0, alerts: [], count: 0 };
  const tva = report?.tva || { collected: 0, deductible: 0, due: 0 };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label="Recettes" value={fmt(totals.income)} tone="emerald" />
        <Kpi icon={TrendingDown} label="Dépenses" value={fmt(totals.expense)} tone="rose" />
        <Kpi icon={Wallet2} label="Résultat net" value={fmt(totals.net)} tone={totals.net >= 0 ? "emerald" : "rose"} />
        <Kpi icon={Boxes} label="Valeur du stock" value={fmt(stock.value)} tone="amber" hint={`${stock.count} article(s)`} />
      </div>

      {settings?.tva_enabled && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="TVA collectée" value={fmt(tva.collected)} tone="emerald" small />
          <Kpi label="TVA déductible" value={fmt(tva.deductible)} tone="rose" small />
          <Kpi label="TVA à payer" value={fmt(tva.due)} tone={tva.due > 0 ? "amber" : "emerald"} small />
        </div>
      )}

      {summary?.monthly?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">6 derniers mois</p>
          <div className="flex items-end gap-3 overflow-x-auto pb-2">
            {summary.monthly.map((m: any) => {
              const max = Math.max(1, ...summary.monthly.map((x: any) => Math.max(x.income, x.expense)));
              const ih = Math.round((m.income / max) * 140);
              const eh = Math.round((m.expense / max) * 140);
              return (
                <div key={m.month} className="flex min-w-[64px] flex-col items-center gap-1">
                  <div className="flex h-[140px] items-end gap-1">
                    <div className="w-4 rounded-t bg-emerald-500" style={{ height: ih }} title={`Recettes ${fmt(m.income)}`} />
                    <div className="w-4 rounded-t bg-rose-500" style={{ height: eh }} title={`Dépenses ${fmt(m.expense)}`} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Comptes de trésorerie</p>
          {report?.byAccount?.length ? (
            <ul className="space-y-2">
              {report.byAccount.map((a: any, i: number) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-semibold">{a.name} <span className="text-[10px] text-muted-foreground">· {a.kind}</span></span>
                  <span className={`font-bold ${a.balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmt(a.balance)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted-foreground">Ajoutez vos comptes (caisse, banque, MoMo) dans Paramètres.</p>}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertes stock
          </p>
          {stock.alerts?.length ? (
            <ul className="space-y-2">
              {stock.alerts.map((it: any) => (
                <li key={it.id} className="flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
                  <span className="font-semibold">{it.name}</span>
                  <span className="text-amber-600 font-bold">{it.stock_qty} / seuil {it.alert_threshold}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted-foreground">Aucune alerte. Votre stock est sain.</p>}
        </div>
      </div>
    </div>
  );
}

/* ==================== JOURNAL ==================== */
function JournalTab({ businessId, accounts, cats, reloadCommon, settings }: any) {
  const [entries, setEntries] = useState<any[]>([]);
  const [filter, setFilter] = useState<{ kind?: string; from?: string; to?: string; q?: string }>({});
  const [draft, setDraft] = useState<any>({ kind: "income", label: "", amount: "", currency: "XOF", entry_date: todayISO(), tva_rate: 0 });
  const [attaching, setAttaching] = useState(false);

  const load = async () => {
    const rows = await listAccountingEntries(businessId, { kind: filter.kind, from: filter.from, to: filter.to });
    setEntries(rows);
  };
  useEffect(() => { load(); }, [businessId, filter.kind, filter.from, filter.to]);

  const filtered = useMemo(() => {
    const q = (filter.q || "").toLowerCase();
    return q ? entries.filter((e) => (e.label || "").toLowerCase().includes(q) || (e.counterparty || "").toLowerCase().includes(q)) : entries;
  }, [entries, filter.q]);

  const addOrUpdate = async () => {
    if (!draft.label || !draft.amount) { toast.error("Libellé et montant requis"); return; }
    const amount = Number(draft.amount);
    const tvaRate = Number(draft.tva_rate || 0);
    const tvaAmount = tvaRate > 0 ? Math.round((amount * tvaRate) / (100 + tvaRate)) : 0;
    try {
      await upsertAccountingEntry(businessId, { ...draft, amount, tva_amount: tvaAmount });
      setDraft({ kind: draft.kind, label: "", amount: "", currency: "XOF", entry_date: todayISO(), tva_rate: draft.tva_rate });
      toast.success("Écriture enregistrée");
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const del = async (id: string) => { if (!confirm("Supprimer cette écriture ?")) return; await deleteAccountingEntry(id); await load(); };

  const onAttach = async (file: File) => {
    if (!file) return;
    setAttaching(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const { path, token } = await createAccountingAttachmentUrl(businessId, ext);
      const { error } = await supabase.storage.from("accounting-attachments").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      setDraft({ ...draft, attachment_url: path });
      toast.success("Justificatif prêt");
    } catch (e: any) { toast.error(e.message); }
    finally { setAttaching(false); }
  };

  const viewAttachment = async (path: string) => {
    const { url } = await getAccountingAttachmentUrl(businessId, path);
    window.open(url, "_blank");
  };

  const exportCsv = () => {
    const rows = [["date", "type", "libellé", "tiers", "compte", "catégorie", "code", "montant", "tva", "devise", "notes"]];
    for (const e of filtered) rows.push([e.entry_date, e.kind, e.label, e.counterparty || "", e.account?.name || "", e.category?.name || "", e.syscohada_code || "", e.amount, e.tva_amount, e.currency, e.notes || ""]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `journal-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const codeOptions = SYSCOHADA_ACCOUNTS.filter((s) => s.kind === draft.kind);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Nouvelle écriture</p>
        <div className="grid gap-2 md:grid-cols-6">
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value, category_id: null, syscohada_code: null })}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
            <option value="income">Recette</option><option value="expense">Dépense</option>
          </select>
          <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Libellé"
            className="md:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="number" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="Montant TTC"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="date" value={draft.entry_date} onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={draft.counterparty || ""} onChange={(e) => setDraft({ ...draft, counterparty: e.target.value })} placeholder="Client / Fournisseur"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={draft.account_id || ""} onChange={(e) => setDraft({ ...draft, account_id: e.target.value || null })}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
            <option value="">Compte…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={draft.category_id || ""} onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
            <option value="">Catégorie…</option>
            {cats.filter((c: any) => c.kind === draft.kind).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={draft.syscohada_code || ""} onChange={(e) => setDraft({ ...draft, syscohada_code: e.target.value || null })}
            className="md:col-span-2 rounded-lg border border-border bg-background px-2 py-2 text-sm">
            <option value="">Compte SYSCOHADA…</option>
            {codeOptions.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
          </select>
          {settings?.tva_enabled && (
            <select value={draft.tva_rate} onChange={(e) => setDraft({ ...draft, tva_rate: Number(e.target.value) })}
              className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
              <option value={0}>TVA 0%</option>
              <option value={18}>TVA 18%</option>
            </select>
          )}
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
            <Paperclip className="h-3.5 w-3.5" />
            {draft.attachment_url ? "Justif. joint ✓" : (attaching ? "Envoi…" : "Reçu / facture")}
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => e.target.files?.[0] && onAttach(e.target.files[0])} />
          </label>
          <div className="md:col-span-6 flex justify-end">
            <button onClick={addOrUpdate} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-glow">
              <Plus className="h-3.5 w-3.5" /> Enregistrer
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <input placeholder="Rechercher…" value={filter.q || ""} onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          className="flex-1 min-w-[160px] rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
        <select value={filter.kind || ""} onChange={(e) => setFilter({ ...filter, kind: e.target.value || undefined })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
          <option value="">Tout</option><option value="income">Recettes</option><option value="expense">Dépenses</option>
        </select>
        <input type="date" value={filter.from || ""} onChange={(e) => setFilter({ ...filter, from: e.target.value || undefined })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
        <input type="date" value={filter.to || ""} onChange={(e) => setFilter({ ...filter, to: e.target.value || undefined })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
          <Download className="h-3 w-3" /> CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Libellé</th>
              <th className="p-3 text-left">Compte</th>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-right">Montant</th>
              <th className="p-3 text-right">TVA</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3 text-xs whitespace-nowrap">{e.entry_date}</td>
                <td className="p-3">
                  <p className="font-semibold">{e.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {e.counterparty || ""} {e.category?.name ? "· " + e.category.name : ""}
                    {e.auto_generated && <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">AUTO</span>}
                  </p>
                </td>
                <td className="p-3 text-xs">{e.account?.name || "—"}</td>
                <td className="p-3 text-xs font-mono">{e.syscohada_code || "—"}</td>
                <td className={`p-3 text-right font-bold whitespace-nowrap ${e.kind === "income" ? "text-emerald-500" : "text-rose-500"}`}>
                  {e.kind === "income" ? "+" : "−"} {fmt(e.amount, e.currency)}
                </td>
                <td className="p-3 text-right text-xs">{e.tva_amount > 0 ? fmt(e.tva_amount) : "—"}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  {e.attachment_url && (
                    <button onClick={() => viewAttachment(e.attachment_url)} className="rounded-full p-2 text-primary hover:bg-primary/10" title="Voir justificatif">
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => del(e.id)} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Aucune écriture.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== STOCK ==================== */
function StockTab({ businessId }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({ name: "", unit: "unité", purchase_price: 0, sale_price: 0, stock_qty: 0, alert_threshold: 0 });
  const [mov, setMov] = useState<any>({ item_id: "", kind: "in", qty: "", unit_cost: "" });

  const load = async () => {
    const [i, m] = await Promise.all([listStockItems(businessId), listStockMovements(businessId)]);
    setItems(i); setMovs(m);
  };
  useEffect(() => { load(); }, [businessId]);

  const save = async () => {
    if (!draft.name) { toast.error("Nom requis"); return; }
    try { await upsertStockItem(businessId, draft); setDraft({ name: "", unit: "unité", purchase_price: 0, sale_price: 0, stock_qty: 0, alert_threshold: 0 }); toast.success("Article enregistré"); await load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const del = async (id: string) => { if (!confirm("Supprimer ?")) return; await deleteStockItem(id); await load(); };
  const move = async () => {
    if (!mov.item_id || !mov.qty) { toast.error("Article + quantité requis"); return; }
    try { await createStockMovement(businessId, { ...mov, qty: Number(mov.qty), unit_cost: mov.unit_cost ? Number(mov.unit_cost) : null }); setMov({ item_id: "", kind: "in", qty: "", unit_cost: "" }); toast.success("Mouvement enregistré"); await load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const totalValue = items.reduce((s, i) => s + Number(i.stock_qty || 0) * Number(i.purchase_price || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Articles" value={String(items.length)} tone="emerald" small />
        <Kpi label="Valeur stock (achat)" value={fmt(totalValue)} tone="amber" small />
        <Kpi label="Alertes" value={String(items.filter((i) => Number(i.alert_threshold || 0) > 0 && Number(i.stock_qty || 0) <= Number(i.alert_threshold || 0)).length)} tone="rose" small />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Nouvel article</p>
        <div className="grid gap-2 md:grid-cols-6">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nom" className="md:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={draft.sku || ""} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="Réf." className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="Unité" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="number" value={draft.purchase_price} onChange={(e) => setDraft({ ...draft, purchase_price: Number(e.target.value) })} placeholder="P. achat" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="number" value={draft.sale_price} onChange={(e) => setDraft({ ...draft, sale_price: Number(e.target.value) })} placeholder="P. vente" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="number" value={draft.stock_qty} onChange={(e) => setDraft({ ...draft, stock_qty: Number(e.target.value) })} placeholder="Stock initial" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="number" value={draft.alert_threshold} onChange={(e) => setDraft({ ...draft, alert_threshold: Number(e.target.value) })} placeholder="Seuil alerte" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={save} className="md:col-span-4 rounded-full bg-gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow">
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Ajouter l'article
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Article</th><th className="p-3 text-right">Stock</th><th className="p-3 text-right">P. achat</th><th className="p-3 text-right">P. vente</th><th className="p-3 text-right">Valeur</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const alert = Number(it.alert_threshold || 0) > 0 && Number(it.stock_qty || 0) <= Number(it.alert_threshold || 0);
              return (
                <tr key={it.id} className={`border-t border-border ${alert ? "bg-amber-500/5" : ""}`}>
                  <td className="p-3">
                    <p className="font-semibold">{it.name}</p>
                    <p className="text-[10px] text-muted-foreground">{it.sku ? "Réf " + it.sku + " · " : ""}{it.unit}</p>
                  </td>
                  <td className={`p-3 text-right font-bold ${alert ? "text-amber-600" : ""}`}>{it.stock_qty}</td>
                  <td className="p-3 text-right">{fmt(it.purchase_price)}</td>
                  <td className="p-3 text-right">{fmt(it.sale_price)}</td>
                  <td className="p-3 text-right font-semibold">{fmt(Number(it.stock_qty) * Number(it.purchase_price))}</td>
                  <td className="p-3 text-right"><button onClick={() => del(it.id)} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Aucun article.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Mouvement de stock</p>
          <div className="space-y-2">
            <select value={mov.item_id} onChange={(e) => setMov({ ...mov, item_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Choisir un article…</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name} (stock : {i.stock_qty})</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <select value={mov.kind} onChange={(e) => setMov({ ...mov, kind: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
                <option value="in">Entrée</option><option value="out">Sortie</option><option value="adjust">Ajustement</option>
              </select>
              <input type="number" value={mov.qty} onChange={(e) => setMov({ ...mov, qty: e.target.value })} placeholder="Qté" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input type="number" value={mov.unit_cost} onChange={(e) => setMov({ ...mov, unit_cost: e.target.value })} placeholder="Coût unit." className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <input value={mov.note || ""} onChange={(e) => setMov({ ...mov, note: e.target.value })} placeholder="Note" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button onClick={move} className="w-full rounded-full bg-gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow">Enregistrer le mouvement</button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Derniers mouvements</p>
          <ul className="space-y-2 max-h-[320px] overflow-y-auto">
            {movs.slice(0, 30).map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                <div>
                  <p className="font-semibold">{m.item?.name || "?"}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString("fr-FR")} · {m.note || ""}</p>
                </div>
                <span className={`font-bold ${m.kind === "in" ? "text-emerald-500" : m.kind === "out" ? "text-rose-500" : "text-amber-500"}`}>
                  {m.kind === "in" ? "+" : m.kind === "out" ? "−" : "="} {m.qty} {m.item?.unit || ""}
                </span>
              </li>
            ))}
            {!movs.length && <li className="text-center text-xs text-muted-foreground">Aucun mouvement.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ==================== RAPPORTS ==================== */
function ReportsTab({ businessId }: any) {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(todayISO());
  const [rep, setRep] = useState<any>(null);

  const load = async () => setRep(await getAccountingReports(businessId, { from, to }));
  useEffect(() => { load(); }, [businessId, from, to]);

  const quick = (kind: "month" | "quarter" | "year") => {
    const d = new Date();
    if (kind === "month") setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
    else if (kind === "quarter") setFrom(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).toISOString().slice(0, 10));
    else setFrom(new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10));
    setTo(todayISO());
  };

  const printPdf = () => window.print();

  if (!rep) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  const s = rep.settings;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 print:hidden">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
        <span className="text-xs text-muted-foreground">→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
        <button onClick={() => quick("month")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Ce mois</button>
        <button onClick={() => quick("quarter")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Trimestre</button>
        <button onClick={() => quick("year")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Année</button>
        <button onClick={printPdf} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-glow">
          <Printer className="h-3 w-3" /> Imprimer / PDF
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 print:border-0 print:p-0">
        <header className="mb-6 border-b border-border pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{s?.legal_name || "—"}</h2>
              <p className="text-xs text-muted-foreground">
                {s?.ifu && `IFU ${s.ifu} · `}{s?.rccm && `RCCM ${s.rccm} · `}{s?.address || ""}
              </p>
            </div>
            {s?.logo_url && <img src={s.logo_url} alt="logo" className="h-14 w-14 rounded object-contain" />}
          </div>
          <p className="mt-2 text-sm font-semibold">Compte de résultat — du {from} au {to}</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase text-emerald-600">Recettes</h3>
            <table className="w-full text-sm">
              <tbody>
                {rep.byCategory.filter((c: any) => c.income > 0).map((c: any, i: number) => (
                  <tr key={i} className="border-b border-border"><td className="py-1.5">{c.name}</td><td className="py-1.5 text-right font-semibold">{fmt(c.income)}</td></tr>
                ))}
                <tr className="font-bold"><td className="py-2">Total recettes</td><td className="py-2 text-right text-emerald-600">{fmt(rep.pnl.income)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase text-rose-600">Dépenses</h3>
            <table className="w-full text-sm">
              <tbody>
                {rep.byCategory.filter((c: any) => c.expense > 0).map((c: any, i: number) => (
                  <tr key={i} className="border-b border-border"><td className="py-1.5">{c.name}</td><td className="py-1.5 text-right font-semibold">{fmt(c.expense)}</td></tr>
                ))}
                <tr className="font-bold"><td className="py-2">Total dépenses</td><td className="py-2 text-right text-rose-600">{fmt(rep.pnl.expense)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-muted/40 p-4">
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Résultat net</span>
            <span className={rep.pnl.net >= 0 ? "text-emerald-600" : "text-rose-600"}>{fmt(rep.pnl.net)}</span>
          </div>
        </div>

        {s?.tva_enabled && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-bold uppercase">Déclaration TVA</h3>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border"><td>TVA collectée</td><td className="text-right">{fmt(rep.tva.collected)}</td></tr>
                <tr className="border-b border-border"><td>TVA déductible</td><td className="text-right">{fmt(rep.tva.deductible)}</td></tr>
                <tr className="font-bold"><td>TVA à payer</td><td className={`text-right ${rep.tva.due > 0 ? "text-amber-600" : "text-emerald-600"}`}>{fmt(rep.tva.due)}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-bold uppercase">Trésorerie par compte</h3>
          <table className="w-full text-sm">
            <tbody>
              {rep.byAccount.map((a: any, i: number) => (
                <tr key={i} className="border-b border-border"><td>{a.name} <span className="text-xs text-muted-foreground">({a.kind})</span></td><td className={`text-right font-semibold ${a.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmt(a.balance)}</td></tr>
              ))}
              {!rep.byAccount.length && <tr><td className="py-3 text-center text-muted-foreground" colSpan={2}>Aucun compte configuré.</td></tr>}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[10px] text-muted-foreground text-center">Édité le {new Date().toLocaleString("fr-FR")} · FASO-INVEST PAY</p>
      </div>
    </div>
  );
}

/* ==================== PARAMÈTRES ==================== */
function SettingsTab({ businessId, settings, accounts, cats, reload }: any) {
  const [form, setForm] = useState<any>(settings || { currency: "XOF", tva_enabled: false, tva_rate: 18, fiscal_year_start: "01-01", regime: "reel_simplifie" });
  useEffect(() => { setForm(settings || form); /* eslint-disable-next-line */ }, [settings]);

  const save = async () => {
    try { await upsertAccountingSettings(businessId, form); toast.success("Paramètres enregistrés"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Identité de l'entreprise</p>
        <div className="grid gap-2 md:grid-cols-2">
          <Field label="Raison sociale" value={form.legal_name || ""} onChange={(v) => setForm({ ...form, legal_name: v })} />
          <Field label="IFU" value={form.ifu || ""} onChange={(v) => setForm({ ...form, ifu: v })} />
          <Field label="RCCM" value={form.rccm || ""} onChange={(v) => setForm({ ...form, rccm: v })} />
          <Field label="Téléphone" value={form.phone || ""} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Email" value={form.email || ""} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Logo (URL)" value={form.logo_url || ""} onChange={(v) => setForm({ ...form, logo_url: v })} />
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Adresse</label>
            <textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Fiscalité & exercice</p>
        <div className="grid gap-2 md:grid-cols-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Devise</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
              <option value="XOF">XOF</option><option value="USD">USD</option><option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Régime</label>
            <select value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
              <option value="reel_normal">Réel normal</option>
              <option value="reel_simplifie">Réel simplifié</option>
              <option value="micro">Micro-entreprise</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Début exercice (MM-JJ)</label>
            <input value={form.fiscal_year_start || "01-01"} onChange={(e) => setForm({ ...form, fiscal_year_start: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">TVA</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="checkbox" checked={!!form.tva_enabled} onChange={(e) => setForm({ ...form, tva_enabled: e.target.checked })} className="h-4 w-4" />
              <input type="number" value={form.tva_rate} onChange={(e) => setForm({ ...form, tva_rate: Number(e.target.value) })} className="w-20 rounded-lg border border-border bg-background px-2 py-2 text-sm" disabled={!form.tva_enabled} />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>
        <button onClick={save} className="mt-4 rounded-full bg-gradient-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-glow">Enregistrer</button>
      </div>

      <AccountsManager businessId={businessId} accounts={accounts} reload={reload} />
      <CategoriesManager businessId={businessId} cats={cats} reload={reload} />
    </div>
  );
}

function AccountsManager({ businessId, accounts, reload }: any) {
  const [d, setD] = useState<any>({ name: "", kind: "cash", currency: "XOF", opening_balance: 0 });
  const add = async () => {
    if (!d.name) return;
    await upsertAccountingAccount(businessId, d);
    setD({ name: "", kind: "cash", currency: "XOF", opening_balance: 0 });
    reload();
  };
  const del = async (id: string) => { if (!confirm("Supprimer ?")) return; await deleteAccountingAccount(id); reload(); };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Comptes de trésorerie</p>
      <div className="grid gap-2 md:grid-cols-5">
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Nom (ex : Caisse principale)" className="md:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
          <option value="cash">Caisse</option><option value="bank">Banque</option><option value="mobile_money">Mobile Money</option>
        </select>
        <input type="number" value={d.opening_balance} onChange={(e) => setD({ ...d, opening_balance: Number(e.target.value) })} placeholder="Solde d'ouverture" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={add} className="rounded-full bg-gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow">Ajouter</button>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {accounts.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm">
            <div><p className="font-semibold">{a.name}</p><p className="text-[10px] text-muted-foreground">{a.kind} · ouverture {fmt(a.opening_balance)}</p></div>
            <button onClick={() => del(a.id)} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {!accounts.length && <p className="col-span-2 text-xs text-muted-foreground">Ajoutez au moins un compte (Caisse, Orange Money…).</p>}
      </div>
    </div>
  );
}

function CategoriesManager({ businessId, cats, reload }: any) {
  const [d, setD] = useState({ name: "", kind: "income" as "income" | "expense" });
  const add = async () => { if (!d.name) return; await upsertAccountingCategory(businessId, d); setD({ ...d, name: "" }); reload(); };
  const del = async (id: string) => { await deleteAccountingCategory(id); reload(); };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Catégories</p>
      <div className="flex flex-wrap gap-2">
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Nom catégorie" className="flex-1 min-w-[160px] rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as any })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
          <option value="income">Recette</option><option value="expense">Dépense</option>
        </select>
        <button onClick={add} className="rounded-full bg-gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow">Ajouter</button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {cats.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-2 text-sm">
            <span><span className={`mr-2 rounded px-2 py-0.5 text-[9px] font-bold ${c.kind === "income" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>{c.kind}</span>{c.name}</span>
            <button onClick={() => del(c.id)} className="rounded-full p-1.5 text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== HELPERS ==================== */
function Kpi({ icon: Icon, label, value, tone, small, hint }: any) {
  const toneCls = tone === "emerald" ? "text-emerald-500" : tone === "rose" ? "text-rose-500" : "text-amber-500";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && <Icon className={`h-4 w-4 ${toneCls}`} />}
      </div>
      <p className={`mt-2 font-bold ${toneCls} ${small ? "text-xl" : "text-2xl"}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
    </div>
  );
}
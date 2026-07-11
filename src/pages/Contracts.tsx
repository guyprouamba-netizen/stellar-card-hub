import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FileText, Plus, Download, Trash2, Send, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";
import {
  listContractTemplates, upsertContractTemplate, deleteContractTemplate,
  listContracts, generateContract, updateContractStatus, deleteContract,
} from "@/lib/contracts.functions";

const DEFAULT_TPL = `# {{titre}}

Entre :
**{{marchand_nom}}** ({{marchand_email}})

Et :
**{{client_nom}}** ({{client_email}})

Date : {{date}}

## Objet
{{objet}}

## Montant
Le montant convenu est de **{{montant}} {{devise}}**.

## Conditions
{{conditions}}

Signé à _____________, le _____________

Signature du client                    Signature du marchand
_______________                        _______________
`;

export default function Contracts() {
  const { businessId = "" } = useParams();
  const [tab, setTab] = useState<"documents" | "templates">("documents");
  const [templates, setTemplates] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  const load = async () => {
    const [t, c] = await Promise.all([listContractTemplates(businessId), listContracts(businessId)]);
    setTemplates(t); setContracts(c);
  };
  useEffect(() => { load(); }, [businessId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link to="/business" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Business
        </Link>
        <h1 className="mt-4 font-[Space_Grotesk] text-2xl font-bold">Contrats & Factures</h1>
        <p className="text-xs text-muted-foreground">Crée des modèles réutilisables, génère des documents personnalisés et exporte en PDF.</p>

        <div className="mt-6 flex gap-2 border-b border-border">
          <TabBtn active={tab === "documents"} onClick={() => setTab("documents")}>Documents</TabBtn>
          <TabBtn active={tab === "templates"} onClick={() => setTab("templates")}>Modèles</TabBtn>
        </div>

        {tab === "documents" && <DocumentsTab businessId={businessId} contracts={contracts} templates={templates} reload={load} />}
        {tab === "templates" && <TemplatesTab businessId={businessId} templates={templates} reload={load} />}
      </div>
    </div>
  );
}
function TabBtn({ active, children, ...p }: any) {
  return <button {...p} className={`rounded-t-xl border-b-2 px-4 py-2 text-xs font-semibold ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>{children}</button>;
}

function downloadContractPdf(c: any) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(37, 99, 235); doc.rect(0, 0, W, 24, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(16).text(c.title, 14, 15);
  doc.setTextColor(15, 23, 42).setFont("helvetica", "normal").setFontSize(9);
  doc.text(`N° ${c.number}  ·  ${new Date(c.created_at).toLocaleDateString("fr-FR")}`, 14, 32);

  // strip markdown headings/bold minimally
  const clean = String(c.content)
    .replace(/^#+\s*/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/^_+$/gm, "________________________");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(clean, W - 28);
  let y = 40;
  for (const line of lines) {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(line, 14, y); y += 5;
  }
  doc.setTextColor(150).setFontSize(8).text("Généré via FASO-INVEST PAY", W / 2, 292, { align: "center" });
  doc.save(`${c.number}.pdf`);
}

function DocumentsTab({ businessId, contracts, templates, reload }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ template_id: "", title: "", client_name: "", client_email: "", client_phone: "", amount: "", currency: "XOF", variables: {} });
  const tpl = templates.find((t: any) => t.id === form.template_id);
  const vars = tpl?.variables || [];

  const generate = async () => {
    if (!form.title) { toast.error("Titre requis"); return; }
    try {
      const c = await generateContract(businessId, form);
      toast.success(`${c.number} généré`);
      setOpen(false); setForm({ ...form, title: "", variables: {} });
      await reload();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="mt-4 space-y-4">
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
        <Plus className="h-4 w-4" /> Nouveau document
      </button>
      {open && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Créer un document</p>
          <div className="grid gap-2 md:grid-cols-2">
            <select value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value, variables: {} })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Sans modèle</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.kind})</option>)}
            </select>
            <input placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Nom client" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Email client" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input type="number" placeholder="Montant" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Devise" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          {vars.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Variables du modèle</p>
              <div className="grid gap-2 md:grid-cols-2">
                {vars.map((v: string) => (
                  <label key={v} className="text-xs">
                    <span className="text-muted-foreground">{`{{${v}}}`}</span>
                    <input value={form.variables[v] || ""} onChange={(e) => setForm({ ...form, variables: { ...form.variables, [v]: e.target.value } })}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                ))}
              </div>
            </div>
          )}
          {!tpl && (
            <textarea rows={8} placeholder="Contenu du document (markdown supporté)" value={form.content || ""}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={generate} className="rounded-full bg-gradient-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-glow">Générer</button>
            <button onClick={() => setOpen(false)} className="rounded-full border border-border px-4 py-2 text-xs">Annuler</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {contracts.map((c: any) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><FileText className="h-5 w-5" /></div>
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="text-[11px] text-muted-foreground">{c.number} · {c.client_name || "sans client"} · {new Date(c.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={c.status} />
              <button onClick={() => downloadContractPdf(c)} className="rounded-full border border-border p-2 hover:bg-muted" title="PDF"><Download className="h-3.5 w-3.5" /></button>
              {c.status === "draft" && (
                <button onClick={async () => { await updateContractStatus(c.id, "sent"); await reload(); }} className="rounded-full border border-border p-2 hover:bg-muted" title="Marquer envoyé"><Send className="h-3.5 w-3.5" /></button>
              )}
              {c.status !== "signed" && (
                <button onClick={async () => { await updateContractStatus(c.id, "signed"); await reload(); }} className="rounded-full border border-border p-2 hover:bg-muted" title="Marquer signé"><CheckCircle2 className="h-3.5 w-3.5" /></button>
              )}
              <button onClick={async () => { await deleteContract(c.id); await reload(); }} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {!contracts.length && <p className="text-sm text-muted-foreground">Aucun document.</p>}
      </div>
    </div>
  );
}
function StatusBadge({ status }: any) {
  const m: any = { draft: "bg-muted text-muted-foreground", sent: "bg-primary/15 text-primary", signed: "bg-emerald-500/15 text-emerald-500", cancelled: "bg-rose-500/15 text-rose-500" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${m[status] || ""}`}>{status}</span>;
}

function TemplatesTab({ businessId, templates, reload }: any) {
  const [d, setD] = useState<any>({ name: "", kind: "contract", content: DEFAULT_TPL });
  const [editing, setEditing] = useState<any>(null);
  const cur = editing || d;
  const save = async () => {
    if (!cur.name || !cur.content) return;
    await upsertContractTemplate(businessId, cur);
    setEditing(null); setD({ name: "", kind: "contract", content: DEFAULT_TPL });
    await reload(); toast.success("Modèle enregistré");
  };
  const del = async (id: string) => { await deleteContractTemplate(id); await reload(); };
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">{editing ? "Modifier" : "Nouveau modèle"}</p>
        <input placeholder="Nom" value={cur.name} onChange={(e) => (editing ? setEditing({ ...editing, name: e.target.value }) : setD({ ...d, name: e.target.value }))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={cur.kind} onChange={(e) => (editing ? setEditing({ ...editing, kind: e.target.value }) : setD({ ...d, kind: e.target.value }))}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="contract">Contrat</option><option value="invoice">Facture</option><option value="quote">Devis</option><option value="other">Autre</option>
        </select>
        <textarea rows={16} value={cur.content} onChange={(e) => (editing ? setEditing({ ...editing, content: e.target.value }) : setD({ ...d, content: e.target.value }))}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs" />
        <p className="mt-2 text-[11px] text-muted-foreground">Utilise <code className="rounded bg-muted px-1">{"{{variable}}"}</code> pour insérer une valeur au moment de la génération.</p>
        <div className="mt-3 flex gap-2">
          <button onClick={save} className="rounded-full bg-gradient-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-glow">Enregistrer</button>
          {editing && <button onClick={() => setEditing(null)} className="rounded-full border border-border px-4 py-2 text-xs">Annuler</button>}
        </div>
      </div>
      <div className="space-y-2">
        {templates.map((t: any) => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-[10px] uppercase text-muted-foreground">{t.kind} · {t.variables?.length || 0} variables</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(t)} className="rounded-full border border-border px-3 py-1 text-[11px]">Éditer</button>
                <button onClick={() => del(t.id)} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            {t.variables?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.variables.map((v: string) => <span key={v} className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">{v}</span>)}
              </div>
            )}
          </div>
        ))}
        {!templates.length && <p className="text-sm text-muted-foreground">Aucun modèle.</p>}
      </div>
    </div>
  );
}
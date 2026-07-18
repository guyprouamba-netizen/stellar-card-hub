import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FileText, Plus, Trash2, Send, CheckCircle2, Receipt, FileImage, Globe } from "lucide-react";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import {
  listContractTemplates, upsertContractTemplate, deleteContractTemplate,
  listContracts, generateContract, updateContractStatus, deleteContract,
} from "@/lib/contracts.functions";
import { listMyBusinesses } from "@/lib/business.functions";

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
  const [biz, setBiz] = useState<any>(null);

  const load = async () => {
    const [t, c, all] = await Promise.all([
      listContractTemplates(businessId),
      listContracts(businessId),
      listMyBusinesses().catch(() => [] as any[]),
    ]);
    setTemplates(t); setContracts(c);
    setBiz((all || []).find((b: any) => b.id === businessId) || null);
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

        {tab === "documents" && <DocumentsTab businessId={businessId} biz={biz} contracts={contracts} templates={templates} reload={load} />}
        {tab === "templates" && <TemplatesTab businessId={businessId} templates={templates} reload={load} />}
      </div>
    </div>
  );
}
function TabBtn({ active, children, ...p }: any) {
  return <button {...p} className={`rounded-t-xl border-b-2 px-4 py-2 text-xs font-semibold ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>{children}</button>;
}

function qrPayload(c: any, biz: any) {
  return JSON.stringify({
    v: 1, n: c.number, t: c.title, k: c.kind,
    amt: c.amount, cur: c.currency, d: c.created_at, s: c.status,
    cli: c.client_name, buy: c.variables?.acheteur_nom || null,
    pro: c.variables?.promoteur_nom || null, biz: biz?.name || null,
  });
}
async function qrDataUrl(text: string, size = 220) {
  return QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: "M" });
}

// Charge une image (logo boutique) en dataURL pour l'insérer dans jsPDF/canvas sans CORS.
async function toDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => resolve(null as any);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

function cleanContent(raw: string) {
  return String(raw || "")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^_+$/gm, "________________________");
}
function escapeHtml(s: string) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[m]);
}
const KIND_LABEL: any = { invoice: "FACTURE", quote: "DEVIS", contract: "CONTRAT", other: "REÇU" };

async function exportA4(c: any, biz: any) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(16, 133, 79); doc.rect(0, 0, W, 28, "F");
  doc.setFillColor(214, 168, 65); doc.rect(0, 28, W, 2, "F");
  const logo = await toDataUrl(biz?.logo_url);
  const nameX = logo ? 34 : 14;
  if (logo) {
    try { doc.addImage(logo, "PNG", 14, 5, 16, 16); } catch { /* ignore */ }
  }
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(18);
  doc.text(biz?.name || "Boutique", nameX, 14);
  doc.setFontSize(10).setFont("helvetica", "normal");
  const contact = [biz?.contact_phone, biz?.contact_email].filter(Boolean).join("  ·  ");
  if (contact) doc.text(contact, nameX, 22);
  doc.setTextColor(15, 23, 42).setFont("helvetica", "bold").setFontSize(15);
  doc.text(`${KIND_LABEL[c.kind] || "DOCUMENT"} — ${c.title}`, 14, 42);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
  doc.text(`N° ${c.number}  ·  ${new Date(c.created_at).toLocaleString("fr-FR")}`, 14, 48);
  const qr = await qrDataUrl(qrPayload(c, biz), 260);
  doc.addImage(qr, "PNG", W - 44, 34, 30, 30);
  doc.setFontSize(7).setTextColor(120).text("Scanner pour vérifier", W - 44, 67);
  doc.setDrawColor(230).setLineWidth(0.2).line(14, 72, W - 14, 72);
  doc.setTextColor(15, 23, 42).setFontSize(9).setFont("helvetica", "bold");
  doc.text("Client", 14, 78);
  doc.setFont("helvetica", "normal");
  doc.text(c.client_name || "—", 14, 84);
  if (c.client_email) doc.text(c.client_email, 14, 89);
  if (c.client_phone) doc.text(c.client_phone, 14, 94);
  if (c.amount != null) {
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(16, 133, 79);
    doc.text(`Montant : ${Number(c.amount).toLocaleString("fr-FR")} ${c.currency}`, W - 14, 84, { align: "right" });
  }
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(cleanContent(c.content), W - 28);
  let y = 108;
  for (const line of lines) {
    if (y > 268) { doc.addPage(); y = 20; }
    doc.text(line, 14, y); y += 5;
  }
  const buyer = c.variables?.acheteur_nom;
  const promoter = c.variables?.promoteur_nom;
  if (buyer || promoter) {
    if (y > 250) { doc.addPage(); y = 30; }
    y += 10;
    doc.setDrawColor(220).line(14, y, W - 14, y); y += 8;
    doc.setFontSize(9);
    if (buyer) doc.text(`Acheteur : ${buyer}`, 14, y);
    if (promoter) doc.text(`Promoteur : ${promoter}`, W - 14, y, { align: "right" });
  }
  doc.setTextColor(150).setFontSize(8).text("Généré via FASO-INVEST PAY · Vérification par QR code", W / 2, 292, { align: "center" });
  doc.save(`${c.number}.pdf`);
}

async function exportTicket80(c: any, biz: any) {
  const width = 80;
  const est = 100 + (String(c.content || "").length / 40) * 4;
  const doc = new jsPDF({ unit: "mm", format: [width, Math.max(160, est)] });
  let y = 6;
  const logo = await toDataUrl(biz?.logo_url);
  if (logo) {
    try { doc.addImage(logo, "PNG", (width - 18) / 2, y, 18, 18); y += 20; } catch { /* ignore */ }
  }
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(biz?.name || "Boutique", width / 2, y, { align: "center" }); y += 5;
  doc.setFont("helvetica", "normal").setFontSize(8);
  if (biz?.contact_phone) { doc.text(biz.contact_phone, width / 2, y, { align: "center" }); y += 4; }
  if (biz?.contact_email) { doc.text(biz.contact_email, width / 2, y, { align: "center" }); y += 4; }
  y += 2;
  doc.setDrawColor(0).line(4, y, width - 4, y); y += 4;
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text(KIND_LABEL[c.kind] || "REÇU", width / 2, y, { align: "center" }); y += 5;
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`N° ${c.number}`, 4, y); y += 4;
  doc.text(new Date(c.created_at).toLocaleString("fr-FR"), 4, y); y += 4;
  if (c.client_name) { doc.text(`Client: ${c.client_name}`, 4, y); y += 4; }
  doc.line(4, y, width - 4, y); y += 4;
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(c.title, 4, y); y += 5;
  doc.setFont("helvetica", "normal").setFontSize(8);
  const wrapped = doc.splitTextToSize(cleanContent(c.content), width - 8);
  for (const line of wrapped) { doc.text(line, 4, y); y += 3.5; }
  y += 2;
  if (c.amount != null) {
    doc.line(4, y, width - 4, y); y += 5;
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text(`${Number(c.amount).toLocaleString("fr-FR")} ${c.currency}`, width / 2, y, { align: "center" });
    y += 6;
  }
  const qr = await qrDataUrl(qrPayload(c, biz), 200);
  doc.addImage(qr, "PNG", (width - 30) / 2, y, 30, 30); y += 32;
  doc.setFont("helvetica", "normal").setFontSize(7);
  doc.text("Scanner pour vérifier", width / 2, y, { align: "center" }); y += 4;
  const buyer = c.variables?.acheteur_nom;
  const promoter = c.variables?.promoteur_nom;
  if (buyer) { doc.text(`Acheteur: ${buyer}`, 4, y); y += 3.5; }
  if (promoter) { doc.text(`Promoteur: ${promoter}`, 4, y); y += 3.5; }
  y += 2;
  doc.setFontSize(7).text("Merci de votre confiance !", width / 2, y, { align: "center" });
  doc.save(`${c.number}-ticket.pdf`);
}

async function exportImage(c: any, biz: any) {
  const qr = await qrDataUrl(qrPayload(c, biz), 300);
  const logo = await toDataUrl(biz?.logo_url);
  const W = 900, H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#10854F"; ctx.fillRect(0, 0, W, 130);
  ctx.fillStyle = "#D6A841"; ctx.fillRect(0, 130, W, 8);
  let nameX = 40;
  if (logo) {
    try {
      const li = new Image(); li.src = logo;
      await new Promise((r) => (li.onload = r));
      ctx.drawImage(li, 40, 25, 80, 80);
      nameX = 140;
    } catch { /* ignore */ }
  }
  ctx.fillStyle = "#fff"; ctx.font = "bold 40px sans-serif";
  ctx.fillText(biz?.name || "Boutique", nameX, 70);
  ctx.font = "20px sans-serif";
  const contact = [biz?.contact_phone, biz?.contact_email].filter(Boolean).join("   ·   ");
  if (contact) ctx.fillText(contact, nameX, 105);
  ctx.fillStyle = "#0f172a"; ctx.font = "bold 32px sans-serif";
  ctx.fillText(`${KIND_LABEL[c.kind] || "DOCUMENT"} — ${c.title}`, 40, 200);
  ctx.font = "18px sans-serif"; ctx.fillStyle = "#64748b";
  ctx.fillText(`N° ${c.number}  ·  ${new Date(c.created_at).toLocaleString("fr-FR")}`, 40, 230);
  ctx.fillStyle = "#0f172a"; ctx.font = "bold 22px sans-serif";
  ctx.fillText("Client", 40, 290);
  ctx.font = "20px sans-serif"; ctx.fillStyle = "#334155";
  ctx.fillText(c.client_name || "—", 40, 320);
  if (c.client_email) ctx.fillText(c.client_email, 40, 348);
  if (c.client_phone) ctx.fillText(c.client_phone, 40, 376);
  if (c.amount != null) {
    ctx.fillStyle = "#10854F"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(`${Number(c.amount).toLocaleString("fr-FR")} ${c.currency}`, W - 40, 320);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "#0f172a"; ctx.font = "18px sans-serif";
  const body = cleanContent(c.content).split("\n");
  let y = 440;
  for (const raw of body) {
    if (y > H - 380) break;
    const words = raw.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > W - 80) { ctx.fillText(line, 40, y); y += 26; line = w; }
      else line = test;
    }
    if (line) { ctx.fillText(line, 40, y); y += 26; }
  }
  const img = new Image(); img.src = qr;
  await new Promise((r) => (img.onload = r));
  ctx.drawImage(img, W - 260, H - 320, 220, 220);
  ctx.fillStyle = "#64748b"; ctx.font = "16px sans-serif"; ctx.textAlign = "right";
  ctx.fillText("Scanner pour vérifier", W - 40, H - 90);
  ctx.textAlign = "left";
  const buyer = c.variables?.acheteur_nom;
  const promoter = c.variables?.promoteur_nom;
  ctx.fillStyle = "#0f172a"; ctx.font = "16px sans-serif";
  if (buyer) ctx.fillText(`Acheteur : ${buyer}`, 40, H - 130);
  if (promoter) ctx.fillText(`Promoteur : ${promoter}`, 40, H - 100);
  ctx.fillStyle = "#94a3b8"; ctx.font = "14px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("Généré via FASO-INVEST PAY", W / 2, H - 30);
  const a = document.createElement("a");
  a.download = `${c.number}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

async function exportHtml(c: any, biz: any) {
  const qr = await qrDataUrl(qrPayload(c, biz), 260);
  const kindLabel = ({ invoice: "Facture", quote: "Devis", contract: "Contrat", other: "Reçu" } as any)[c.kind] || "Document";
  const buyer = c.variables?.acheteur_nom;
  const promoter = c.variables?.promoteur_nom;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(c.title)} · ${c.number}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
.card{max-width:820px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.06)}
.hd{background:#10854F;color:#fff;padding:24px 32px}.hd h1{margin:0 0 6px;font-size:24px}
.strip{height:6px;background:#D6A841}.body{padding:28px 32px}
.row{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;align-items:flex-start}
.badge{background:#10854F;color:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;text-transform:uppercase;display:inline-block}
.meta{color:#64748b;font-size:13px;margin:6px 0 22px}
.blk{padding:16px;border:1px solid #e2e8f0;border-radius:12px}
.amount{font-size:26px;font-weight:800;color:#10854F}
pre{white-space:pre-wrap;font-family:inherit;line-height:1.6;margin:24px 0 0}
.foot{border-top:1px solid #e2e8f0;padding:16px 32px;font-size:12px;color:#64748b;text-align:center}
.sig{display:flex;justify-content:space-between;margin-top:32px;gap:24px;flex-wrap:wrap}
.sig div{font-size:14px}img.qr{border-radius:8px;background:#fff;padding:4px}
@media print{body{background:#fff}.card{box-shadow:none;margin:0}}
</style></head><body>
<div class="card">
  <div class="hd" style="display:flex;align-items:center;gap:16px">
    ${biz?.logo_url ? `<img src="${escapeHtml(biz.logo_url)}" alt="logo" style="width:56px;height:56px;border-radius:12px;object-fit:cover;background:#fff;padding:4px"/>` : ""}
    <div>
      <h1 style="margin:0 0 6px;font-size:24px">${escapeHtml(biz?.name || "Boutique")}</h1>
      <div style="opacity:.9;font-size:13px">${escapeHtml([biz?.contact_phone, biz?.contact_email].filter(Boolean).join(" · "))}</div>
    </div>
  </div><div class="strip"></div>
  <div class="body">
    <div class="row">
      <div>
        <span class="badge">${kindLabel}</span>
        <h2 style="margin:8px 0 0">${escapeHtml(c.title)}</h2>
        <div class="meta">N° ${c.number} · ${new Date(c.created_at).toLocaleString("fr-FR")}</div>
      </div>
      <img class="qr" src="${qr}" width="140" height="140" alt="QR"/>
    </div>
    <div class="row">
      <div class="blk" style="flex:1;min-width:240px">
        <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Client</div>
        <div style="margin-top:6px;font-weight:600">${escapeHtml(c.client_name || "—")}</div>
        ${c.client_email ? `<div style="color:#475569;font-size:13px">${escapeHtml(c.client_email)}</div>` : ""}
        ${c.client_phone ? `<div style="color:#475569;font-size:13px">${escapeHtml(c.client_phone)}</div>` : ""}
      </div>
      ${c.amount != null ? `<div class="blk" style="flex:1;min-width:240px;text-align:right">
        <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Montant</div>
        <div class="amount">${Number(c.amount).toLocaleString("fr-FR")} ${escapeHtml(c.currency)}</div>
      </div>` : ""}
    </div>
    <pre>${escapeHtml(cleanContent(c.content))}</pre>
    <div class="sig">
      <div>${buyer ? `<b>Acheteur</b><br>${escapeHtml(buyer)}` : ""}</div>
      <div style="text-align:right">${promoter ? `<b>Promoteur</b><br>${escapeHtml(promoter)}` : ""}</div>
    </div>
  </div>
  <div class="foot">Généré via FASO-INVEST PAY · Vérifiable par QR code</div>
</div></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function DocumentsTab({ businessId, biz, contracts, templates, reload }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ template_id: "", title: "", client_name: "", client_email: "", client_phone: "", amount: "", currency: "XOF", kind: "other", variables: { acheteur_nom: "", promoteur_nom: "" } });
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
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="other">Reçu de caisse</option>
              <option value="invoice">Facture</option>
              <option value="quote">Devis</option>
              <option value="contract">Contrat</option>
            </select>
            <input placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Nom client" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Email client" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input type="number" placeholder="Montant" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Devise" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Nom acheteur (bas de page)" value={form.variables?.acheteur_nom || ""} onChange={(e) => setForm({ ...form, variables: { ...form.variables, acheteur_nom: e.target.value } })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Nom promoteur/vendeur" value={form.variables?.promoteur_nom || ""} onChange={(e) => setForm({ ...form, variables: { ...form.variables, promoteur_nom: e.target.value } })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
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
              <div className="flex items-center gap-1 rounded-full border border-border px-1">
                <button onClick={() => exportA4(c, biz)} className="rounded-full px-2 py-1 text-[10px] font-semibold hover:bg-muted" title="PDF A4">
                  <FileText className="inline h-3 w-3" /> A4
                </button>
                <button onClick={() => exportTicket80(c, biz)} className="rounded-full px-2 py-1 text-[10px] font-semibold hover:bg-muted" title="Ticket de caisse 80mm">
                  <Receipt className="inline h-3 w-3" /> 80mm
                </button>
                <button onClick={() => exportImage(c, biz)} className="rounded-full px-2 py-1 text-[10px] font-semibold hover:bg-muted" title="Image PNG">
                  <FileImage className="inline h-3 w-3" /> PNG
                </button>
                <button onClick={() => exportHtml(c, biz)} className="rounded-full px-2 py-1 text-[10px] font-semibold hover:bg-muted" title="Page web">
                  <Globe className="inline h-3 w-3" /> Web
                </button>
              </div>
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
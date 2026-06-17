import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import {
  listProjects, updateProject, listProducts, createProduct, updateProduct, deleteProduct,
  addProductMedia, deleteProductMedia, listPaymentLinks, createPaymentLink, updatePaymentLink,
  listLinkPayments, listInvoices, listActionPlans, createActionPlan, updateActionPlan, deleteActionPlan,
} from "@/lib/business.functions";
import { coachChat, coachDailyTip, coachStrategy, coachAlert, coachGeneratePlan, listCoachMessages } from "@/lib/coach.functions";
import { uploadBusinessMedia } from "@/lib/upload";
import { downloadReceipt } from "@/lib/receipt-pdf";
import {
  ArrowLeft, Plus, Upload, Image as ImageIcon, Video, Trash2, QrCode, Copy, Link2,
  Target, ListChecks, Sparkles, Send, Download, FileText, Camera, X, Loader2, TrendingUp,
} from "lucide-react";

type Project = any; type Product = any; type Link2 = any; type Plan = any; type Msg = any; type Invoice = any;

export default function ProjectDetailPage() {
  const { businessId = "", projectId = "" } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coachMsgs, setCoachMsgs] = useState<Msg[]>([]);
  const [chat, setChat] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [tab, setTab] = useState<"overview" | "products" | "links" | "finance" | "coach">("overview");
  const [qrLink, setQrLink] = useState<{ url: string; title: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const chatRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const projects: Project[] = await listProjects(businessId);
    const p = projects.find((x: any) => x.id === projectId);
    if (!p) { toast.error("Projet introuvable"); navigate(`/business`); return; }
    setProject(p);
    const [pr, ln, pm, inv, pl, cm] = await Promise.all([
      listProducts(projectId), listPaymentLinks(businessId), listLinkPayments(businessId),
      listInvoices(businessId, projectId), listActionPlans(businessId, projectId), listCoachMessages(businessId, projectId),
    ]);
    setProducts(pr); setLinks(ln.filter((l: any) => l.project_id === projectId));
    setPayments(pm.filter((x: any) => x.project_id === projectId));
    setInvoices(inv); setPlans(pl); setCoachMsgs(cm);
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth"); else refresh();
    });
    // eslint-disable-next-line
  }, [businessId, projectId]);

  useEffect(() => { if (qrLink) QRCode.toDataURL(qrLink.url, { width: 480, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } }).then(setQrDataUrl); }, [qrLink]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [coachMsgs]);

  if (!project) return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const pct = project.financial_goal > 0 ? Math.min(100, (Number(project.balance) / Number(project.financial_goal)) * 100) : 0;
  const light = pct >= 100 ? "green" : pct >= 50 || Number(project.balance) > 0 ? "yellow" : "red";
  const lightBg = light === "green" ? "bg-emerald-500 shadow-[0_0_24px_#10b981]" : light === "yellow" ? "bg-amber-500 shadow-[0_0_24px_#f59e0b]" : "bg-red-500 shadow-[0_0_24px_#ef4444]";

  async function onUploadLogo(file: File, kind: "logo" | "cover") {
    try {
      toast.loading(`Téléversement ${kind}…`, { id: "up" });
      const url = await uploadBusinessMedia(file, `projects/${projectId}/${kind}`);
      const p = await updateProject({ id: projectId, [kind === "logo" ? "logo_url" : "cover_url"]: url });
      setProject(p); toast.success(`${kind} mis à jour ✅`, { id: "up" });
    } catch (e: any) { toast.error(e.message, { id: "up" }); }
  }

  async function onAddProduct() {
    const name = prompt("Nom du produit"); if (!name) return;
    const priceStr = prompt("Prix en " + project.currency); if (!priceStr) return;
    try {
      const p = await createProduct({ project_id: projectId, name, price: Number(priceStr) || 0, currency: project.currency });
      setProducts((prev) => [{ ...p, product_media: [] }, ...prev]);
      toast.success("Produit ajouté ✅");
    } catch (e: any) { toast.error(e.message); }
  }

  async function onAddMedia(productId: string, file: File) {
    try {
      toast.loading("Téléversement…", { id: "m" });
      const url = await uploadBusinessMedia(file, `products/${productId}`);
      const type = file.type.startsWith("video") ? "video" : "image";
      const m = await addProductMedia({ product_id: productId, type, url });
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, product_media: [...(p.product_media || []), m] } : p));
      toast.success("Média ajouté ✅", { id: "m" });
    } catch (e: any) { toast.error(e.message, { id: "m" }); }
  }

  async function onCreateLinkForProduct(prod: any) {
    const channelAns = window.prompt("Canal: online / pos / both", "both") || "both";
    try {
      const l = await createPaymentLink({
        business_id: businessId, project_id: projectId, product_id: prod.id,
        title: prod.name, description: prod.description || undefined,
        amount: Number(prod.price), currency: prod.currency, channel: channelAns,
      });
      setLinks((prev) => [l, ...prev]);
      toast.success("Lien créé ✅");
      setTab("links");
    } catch (e: any) { toast.error(e.message); }
  }

  async function onCreateFreeLink() {
    const title = prompt("Titre du lien"); if (!title) return;
    const amount = prompt("Montant fixe (vide = libre)");
    try {
      const l = await createPaymentLink({
        business_id: businessId, project_id: projectId, title,
        amount: amount ? Number(amount) : null, currency: project.currency, channel: "both",
      });
      setLinks((prev) => [l, ...prev]); toast.success("Lien créé ✅");
    } catch (e: any) { toast.error(e.message); }
  }

  async function showQr(slug: string, title: string) {
    setQrLink({ url: `${window.location.origin}/pay/${slug}`, title });
  }
  async function downloadQr() {
    if (!qrDataUrl || !qrLink) return;
    const a = document.createElement("a"); a.href = qrDataUrl;
    a.download = `QR-${qrLink.title.replace(/\s+/g, "-")}.png`; a.click();
  }

  async function sendChat() {
    if (!chat.trim()) return;
    const msg = chat; setChat(""); setCoachLoading(true);
    setCoachMsgs((prev) => [...prev, { id: "tmp", role: "user", content: msg, created_at: new Date().toISOString() }]);
    try {
      const r: any = await coachChat(businessId, msg, projectId);
      const fresh = await listCoachMessages(businessId, projectId);
      setCoachMsgs(fresh);
    } catch (e: any) { toast.error(e.message); } finally { setCoachLoading(false); }
  }

  async function quickCoach(kind: "tip" | "alert" | "strategy") {
    setCoachLoading(true);
    try {
      const fn = kind === "tip" ? coachDailyTip : kind === "alert" ? coachAlert : coachStrategy;
      await fn(businessId, projectId);
      const fresh = await listCoachMessages(businessId, projectId);
      setCoachMsgs(fresh); setTab("coach");
    } catch (e: any) { toast.error(e.message); } finally { setCoachLoading(false); }
  }

  async function onGenPlan() {
    setCoachLoading(true);
    try {
      const r: any = await coachGeneratePlan(businessId, projectId);
      setPlans((prev) => [r.plan, ...prev]); toast.success("Plan IA généré ✅");
    } catch (e: any) { toast.error(e.message); } finally { setCoachLoading(false); }
  }

  async function togglePlanStep(plan: any, idx: number) {
    const next = (plan.steps || []).map((s: any, i: number) => i === idx ? { ...s, done: !s.done } : s);
    const allDone = next.every((s: any) => s.done);
    const upd = await updateActionPlan({ id: plan.id, steps: next, status: allDone ? "done" : "doing" });
    setPlans((prev) => prev.map((p) => p.id === plan.id ? upd : p));
  }

  async function onDownloadInvoice(inv: Invoice) {
    downloadReceipt({
      business: { name: project.name },
      invoice: { number: inv.number, kind: inv.kind, created_at: inv.created_at, currency: inv.currency, status: inv.status },
      customer: { name: inv.customer_name, email: inv.customer_email, phone: inv.customer_phone },
      items: inv.items || [],
      totals: { subtotal: Number(inv.subtotal), tax: Number(inv.tax), total: Number(inv.total) },
    });
  }

  const TABS = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "products", label: `Produits (${products.length})` },
    { id: "links", label: `Liens & QR (${links.length})` },
    { id: "finance", label: `Finance & Factures (${invoices.length})` },
    { id: "coach", label: "🤖 Coach IA" },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Cover header */}
      <div className="relative h-48 w-full overflow-hidden border-b border-border" style={project.cover_url ? { backgroundImage: `url(${project.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 mx-auto flex max-w-6xl items-end justify-between px-6 pb-4">
          <Link to="/business" className="absolute top-4 left-6 inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs backdrop-blur hover:bg-background"><ArrowLeft className="h-3.5 w-3.5" /> Retour</Link>
          <label className="absolute top-4 right-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs backdrop-blur hover:bg-background">
            <Camera className="h-3.5 w-3.5" /> Couverture
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadLogo(e.target.files[0], "cover")} />
          </label>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 -mt-12">
        {/* Hero card */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card-premium">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <label className="relative grid h-20 w-20 cursor-pointer place-items-center overflow-hidden rounded-2xl bg-gradient-primary text-2xl font-bold text-primary-foreground">
                {project.logo_url ? <img src={project.logo_url} alt="" className="h-full w-full object-cover" /> : project.name[0]}
                <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition hover:opacity-100"><Camera className="h-5 w-5 text-white" /></div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadLogo(e.target.files[0], "logo")} />
              </label>
              <div>
                <h1 className="font-[Space_Grotesk] text-3xl font-bold">{project.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{project.description || "Aucune description"}</p>
                <p className="mt-1 text-xs text-muted-foreground">slug : <code className="rounded bg-muted px-1.5 py-0.5">{project.slug}</code></p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`h-4 w-4 rounded-full ${lightBg}`} aria-label={light} />
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Caisse projet</p>
                <p className="mt-1 font-[Space_Grotesk] text-3xl font-bold tabular-nums">{Number(project.balance).toLocaleString("fr-FR")} <span className="text-sm text-muted-foreground">{project.currency}</span></p>
                {project.financial_goal > 0 && (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">Objectif : {Number(project.financial_goal).toLocaleString("fr-FR")} {project.currency}</p>
                    <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick coach actions */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
            <button onClick={() => quickCoach("tip")} disabled={coachLoading} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Tip du jour</button>
            <button onClick={() => quickCoach("alert")} disabled={coachLoading} className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 disabled:opacity-50">⚠️ Alerte</button>
            <button onClick={() => quickCoach("strategy")} disabled={coachLoading} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"><Target className="h-3.5 w-3.5" /> Stratégie</button>
            <button onClick={onGenPlan} disabled={coachLoading} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"><ListChecks className="h-3.5 w-3.5" /> Générer un plan IA</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 pb-16">
          {tab === "overview" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi label="Produits" value={products.length} />
              <Kpi label="Liens actifs" value={links.filter((l) => l.status === "active").length} />
              <Kpi label="Paiements reçus" value={payments.length} />
              <Kpi label="Factures émises" value={invoices.length} />
              <Kpi label="Plans en cours" value={plans.filter((p: any) => p.status !== "done").length} />
              <Kpi label="Atteinte objectif" value={`${pct.toFixed(0)}%`} />
              {plans.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-3 font-[Space_Grotesk] font-bold inline-flex items-center gap-2"><ListChecks className="h-4 w-4" /> Plans d'action</h3>
                  <div className="space-y-3">
                    {plans.map((pl: any) => (
                      <div key={pl.id} className="rounded-xl border border-border bg-surface-2 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{pl.title} {pl.ai_generated && <span className="ml-1 text-xs text-primary">✨ IA</span>}</p>
                          <button onClick={async () => { await deleteActionPlan(pl.id); setPlans((p) => p.filter((x) => x.id !== pl.id)); }}
                            className="grid h-7 w-7 place-items-center rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                        </div>
                        {pl.description && <p className="mt-1 text-xs text-muted-foreground">{pl.description}</p>}
                        <div className="mt-2 space-y-1">
                          {(pl.steps || []).map((s: any, i: number) => (
                            <label key={i} className="flex cursor-pointer items-center gap-2 text-sm">
                              <input type="checkbox" checked={!!s.done} onChange={() => togglePlanStep(pl, i)} className="h-4 w-4 rounded accent-primary" />
                              <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "products" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={onAddProduct} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"><Plus className="h-3.5 w-3.5" /> Ajouter un produit</button>
              </div>
              {products.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center text-sm text-muted-foreground">Aucun produit. Ajoutez votre catalogue pour générer des liens et QR.</p>}
              <div className="grid gap-4 md:grid-cols-2">
                {products.map((prod) => (
                  <div key={prod.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{prod.name}</p>
                        <p className="text-xs text-muted-foreground">{prod.description || "—"}</p>
                        <p className="mt-1 font-[Space_Grotesk] text-xl font-bold tabular-nums">{Number(prod.price).toLocaleString("fr-FR")} <span className="text-xs text-muted-foreground">{prod.currency}</span></p>
                      </div>
                      <button onClick={async () => { if (confirm("Supprimer ce produit ?")) { await deleteProduct(prod.id); setProducts((p) => p.filter((x) => x.id !== prod.id)); } }}
                        className="grid h-8 w-8 place-items-center rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    {/* Media gallery */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(prod.product_media || []).map((m: any) => (
                        <div key={m.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                          {m.type === "video" ? <video src={m.url} className="h-full w-full object-cover" /> : <img src={m.url} className="h-full w-full object-cover" alt="" />}
                          <button onClick={async () => { await deleteProductMedia(m.id); setProducts((prev) => prev.map((p) => p.id === prod.id ? { ...p, product_media: p.product_media.filter((x: any) => x.id !== m.id) } : p)); }}
                            className="absolute top-0.5 right-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                      <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-border bg-surface-2 hover:bg-muted">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onAddMedia(prod.id, e.target.files[0])} />
                      </label>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => onCreateLinkForProduct(prod)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background"><Link2 className="h-3.5 w-3.5" /> Créer lien & QR</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "links" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button onClick={onCreateFreeLink} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"><Plus className="h-3.5 w-3.5" /> Nouveau lien</button>
              </div>
              {links.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center text-sm text-muted-foreground">Aucun lien.</p>}
              {links.map((l) => {
                const url = `${window.location.origin}/pay/${l.slug}`;
                return (
                  <div key={l.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{l.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${l.status === "active" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>{l.status}</span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase text-primary">{l.channel || "online"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{l.amount ? `${Number(l.amount).toLocaleString("fr-FR")} ${l.currency}` : "Montant libre"}</p>
                        <p className="mt-1 truncate text-xs text-primary">{url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(url); toast.success("Copié"); }} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>
                        <button onClick={() => showQr(l.slug, l.title)} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background"><QrCode className="h-3.5 w-3.5" /> QR</button>
                        <button onClick={async () => { const u = await updatePaymentLink({ id: l.id, status: l.status === "active" ? "paused" : "active" }); setLinks((prev) => prev.map((x) => x.id === l.id ? u : x)); }} className="rounded-full border border-border px-3 py-1.5 text-xs">{l.status === "active" ? "Pauser" : "Activer"}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "finance" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Kpi label="Caisse projet" value={`${Number(project.balance).toLocaleString("fr-FR")} ${project.currency}`} />
                <Kpi label="Objectif" value={`${Number(project.financial_goal).toLocaleString("fr-FR")} ${project.currency}`} />
                <Kpi label="Atteinte" value={`${pct.toFixed(0)}%`} />
              </div>
              <div className="rounded-2xl border border-border bg-card">
                <h3 className="border-b border-border p-4 font-[Space_Grotesk] font-bold inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Factures & reçus</h3>
                <div className="divide-y divide-border">
                  {invoices.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Aucune facture émise. Elles sont générées automatiquement à chaque paiement réussi.</p>}
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-mono text-sm font-semibold">{inv.number}</p>
                        <p className="text-xs text-muted-foreground">{inv.customer_name || inv.customer_email || "Client anonyme"} · {new Date(inv.created_at).toLocaleString("fr-FR")}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-[Space_Grotesk] text-lg font-bold tabular-nums">{Number(inv.total).toLocaleString("fr-FR")} {inv.currency}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${inv.status === "paid" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>{inv.status}</span>
                        <button onClick={() => onDownloadInvoice(inv)} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background"><Download className="h-3.5 w-3.5" /> PDF</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card">
                <h3 className="border-b border-border p-4 font-[Space_Grotesk] font-bold inline-flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Paiements récents</h3>
                <div className="divide-y divide-border">
                  {payments.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Aucun paiement.</p>}
                  {payments.slice(0, 20).map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-4 text-sm">
                      <div>
                        <p className="font-mono text-xs">{p.reference}</p>
                        <p className="text-xs text-muted-foreground">{p.customer_email || p.customer_name || "—"} · {new Date(p.created_at).toLocaleString("fr-FR")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{Number(p.amount).toLocaleString("fr-FR")} {p.currency}</p>
                        <span className={`text-xs ${p.status === "success" ? "text-emerald-500" : p.status === "failed" ? "text-destructive" : "text-amber-500"}`}>{p.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "coach" && (
            <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
              <div className="rounded-2xl border border-border bg-card">
                <div ref={chatRef} className="max-h-[60vh] min-h-[400px] space-y-3 overflow-y-auto p-4">
                  {coachMsgs.length === 0 && (
                    <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
                      <div>
                        <Sparkles className="mx-auto h-10 w-10 text-primary" />
                        <p className="mt-3 font-semibold text-foreground">Salut ! Je suis FASO Coach 👋</p>
                        <p className="mt-1 max-w-sm">Pose-moi n'importe quelle question business, ou demande un tip, une alerte, une stratégie. Je connais tes chiffres.</p>
                      </div>
                    </div>
                  )}
                  {coachMsgs.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground border border-border"}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {coachLoading && <div className="flex justify-start"><div className="rounded-2xl bg-surface-2 px-4 py-2.5 text-sm border border-border"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
                </div>
                <div className="border-t border-border p-3">
                  <div className="flex gap-2">
                    <input value={chat} onChange={(e) => setChat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      placeholder="Demande conseil, stratégie, analyse…" className="flex-1 rounded-full border border-border bg-surface-2 px-4 py-2 text-sm outline-none focus:border-primary" />
                    <button onClick={sendChat} disabled={coachLoading || !chat.trim()} className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-50"><Send className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <button onClick={() => quickCoach("tip")} className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40"><Sparkles className="mb-2 h-5 w-5 text-primary" /><p className="font-semibold">Tip du jour</p><p className="text-xs text-muted-foreground">Micro-défi quotidien</p></button>
                <button onClick={() => quickCoach("alert")} className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:border-amber-500/40"><span className="text-xl">⚠️</span><p className="mt-2 font-semibold">Alerte</p><p className="text-xs text-muted-foreground">Analyse risques & opportunités</p></button>
                <button onClick={() => quickCoach("strategy")} className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40"><Target className="mb-2 h-5 w-5 text-primary" /><p className="font-semibold">Stratégie</p><p className="text-xs text-muted-foreground">Plan en 3 étapes</p></button>
                <button onClick={onGenPlan} className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40"><ListChecks className="mb-2 h-5 w-5 text-primary" /><p className="font-semibold">Plan IA</p><p className="text-xs text-muted-foreground">Génère un plan trackable</p></button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* QR Modal */}
      {qrLink && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => { setQrLink(null); setQrDataUrl(""); }}>
          <div className="m-4 max-w-sm rounded-3xl border border-border bg-card p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-[Space_Grotesk] text-xl font-bold">{qrLink.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">Scanne pour payer (présentiel ou en ligne)</p>
            {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="mx-auto mt-4 h-64 w-64 rounded-2xl border border-border" /> : <div className="mx-auto mt-4 h-64 w-64 rounded-2xl bg-muted" />}
            <p className="mt-3 break-all text-[10px] text-muted-foreground">{qrLink.url}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={downloadQr} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground"><Download className="h-4 w-4" /> Télécharger</button>
              <button onClick={() => { navigator.clipboard.writeText(qrLink.url); toast.success("Lien copié"); }} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-sm font-semibold"><Copy className="h-4 w-4" /> Lien</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-[Space_Grotesk] text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
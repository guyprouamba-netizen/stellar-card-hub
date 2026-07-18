import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyBusinesses, createBusiness, listPaymentLinks, createPaymentLink,
  updatePaymentLink, listLinkPayments, listApiKeys, createApiKey, revokeApiKey,
  cashoutBusinessBalance, listProjects, createProject, getBusinessDashboard,
  getWhatsappSession, createWhatsappSession, resetWhatsappSession,
  sendWhatsappMessage, listWhatsappEvents,
} from "@/lib/business.functions";
import {
  listOrders, updateOrderStatus,
  listBusinessPosts, createBusinessPost, updateBusinessPost, deleteBusinessPost,
} from "@/lib/orders.functions";
import { uploadBusinessMedia } from "@/lib/upload";
import { ArrowLeft, Building2, Copy, Key, Link2, Plus, Trash2, Wallet, FolderKanban, TrendingUp, TrendingDown, ChevronRight, Sparkles, Store, Package, Megaphone, Image as ImageIcon, ExternalLink, Eye, EyeOff, MessageCircle, QrCode, RefreshCw, Send, Smartphone } from "lucide-react";

type Biz = { id: string; name: string; slug: string; status: string; balance: number; fee_bps: number };
type PLink = { id: string; slug: string; title: string; amount: number | null; currency: string; status: string };
type Payment = { id: string; reference: string; amount: number; status: string; net_amount: number; created_at: string };
type ApiKey = { id: string; label: string; key_prefix: string; mode: string; revoked_at: string | null; last_used_at: string | null };
type Project = { id: string; name: string; slug: string; logo_url: string | null; cover_url: string | null; balance: number; financial_goal: number; currency: string; status: string };
type Dashboard = { business: any; projects: Project[]; kpis: { total30: number; totalPrev: number; trend: number; count30: number; light: "red" | "yellow" | "green" }; series: Array<{ date: string; value: number }> };
type Order = { id: string; order_number: string; public_token: string; status: string; customer_name: string | null; customer_email: string | null; total_amount: number; currency: string; created_at: string; items: Array<{ name: string; quantity: number; unit_price: number }> };
type Post = { id: string; title: string; body: string | null; image_url: string | null; product_id: string | null; published: boolean; published_at: string | null; created_at: string };
type WaSession = { id: string; status: string; qr_data_url: string | null; phone_number: string | null; worker_version: string | null; last_seen_at: string | null; connection_secret: string; worker_online: boolean } | null;
type WaEvent = { id: string; kind: string; payload: any; created_at: string };

export default function BusinessPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(undefined);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [current, setCurrent] = useState<Biz | null>(null);
  const [links, setLinks] = useState<PLink[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postDraft, setPostDraft] = useState<{ title: string; body: string; image_url: string }>({ title: "", body: "", image_url: "" });
  const [uploadingImg, setUploadingImg] = useState(false);
  const [wa, setWa] = useState<WaSession>(null);
  const [waEvents, setWaEvents] = useState<WaEvent[]>([]);
  const [waDraft, setWaDraft] = useState<{ to: string; body: string }>({ to: "", body: "" });
  const [waSending, setWaSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/auth"); return; }
      setSession(data.session);
    });
  }, [navigate]);

  async function refreshAll() {
    try {
      const list = await listMyBusinesses();
      setBusinesses(list);
      if (list.length) {
        const keepId = current?.id;
        const next = (keepId && list.find((b: Biz) => b.id === keepId)) || list[0];
        setCurrent(next);
      }
    } catch (e: any) {
      toast.error("Impossible de charger vos business: " + (e?.message || "erreur"));
    } finally { setLoading(false); }
  }
  async function refreshCurrent(bizId: string) {
    // Un onglet en erreur ne doit pas casser les autres — chaque appel a son propre fallback.
    const safe = <T,>(p: Promise<T>, fb: T): Promise<T> => p.catch((e) => { console.warn("[business fetch]", e?.message); return fb; });
    const [l, p, k, pr, d, o, po, ws, we] = await Promise.all([
      safe(listPaymentLinks(bizId), [] as any),
      safe(listLinkPayments(bizId), [] as any),
      safe(listApiKeys(bizId), [] as any),
      safe(listProjects(bizId), [] as any),
      safe(getBusinessDashboard(bizId), null as any),
      safe(listOrders(bizId), [] as any),
      safe(listBusinessPosts(bizId), [] as any),
      safe(getWhatsappSession(bizId), null as any),
      safe(listWhatsappEvents(bizId), [] as any),
    ]);
    setLinks(l); setPayments(p); setKeys(k); setProjects(pr); setDash(d); setOrders(o); setPosts(po);
    setWa(ws); setWaEvents(we);
  }
  useEffect(() => { if (session) refreshAll(); /* eslint-disable-next-line */ }, [session]);
  useEffect(() => { if (current) refreshCurrent(current.id); }, [current?.id]);

  // Polling léger tant qu'on attend le QR / la connexion
  useEffect(() => {
    if (!current) return;
    if (!wa || wa.status === "connected") return;
    const t = setInterval(async () => {
      try {
        const s = await getWhatsappSession(current.id);
        setWa(s);
      } catch { /* ignore */ }
    }, 3500);
    return () => clearInterval(t);
  }, [current?.id, wa?.status]);

  async function onCreateBusiness() {
    const name = prompt("Nom de votre business / boutique");
    if (!name) return;
    try {
      const b = await createBusiness({ name });
      toast.success("Business créé ✅");
      setBusinesses((prev) => [b, ...prev]);
      setCurrent(b);
    } catch (e: any) { toast.error(e.message); }
  }

  async function onCreateLink() {
    if (!current) return;
    const title = prompt("Titre du lien de paiement");
    if (!title) return;
    const amountStr = prompt("Montant fixe en XOF (laisser vide pour montant libre)");
    const amount = amountStr ? Number(amountStr) : null;
    try {
      const link = await createPaymentLink({ business_id: current.id, title, amount });
      toast.success("Lien créé ✅");
      setLinks((prev) => [link, ...prev]);
    } catch (e: any) { toast.error(e.message); }
  }

  async function onToggleLink(l: PLink) {
    const next = l.status === "active" ? "paused" : "active";
    try {
      const u = await updatePaymentLink({ id: l.id, status: next });
      setLinks((prev) => prev.map((x) => (x.id === l.id ? u : x)));
    } catch (e: any) { toast.error(e.message); }
  }

  async function onEditLink(l: PLink) {
    const title = prompt("Titre du lien", l.title);
    if (title === null) return;
    const amountStr = prompt(
      "Montant fixe en " + l.currency + " (vide = montant libre)",
      l.amount ? String(l.amount) : "",
    );
    if (amountStr === null) return;
    const amount = amountStr.trim() === "" ? null : Number(amountStr);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      toast.error("Montant invalide"); return;
    }
    try {
      const u = await updatePaymentLink({ id: l.id, title, amount });
      setLinks((prev) => prev.map((x) => (x.id === l.id ? u : x)));
      toast.success("Lien mis à jour ✅");
    } catch (e: any) { toast.error(e.message); }
  }

  async function onCreateKey() {
    if (!current) return;
    try {
      const k: any = await createApiKey({ business_id: current.id, label: "default", mode: "live" });
      setNewKey(k.api_key);
      setKeys((prev) => [{ id: k.id, label: k.label, key_prefix: k.key_prefix, mode: k.mode, revoked_at: null, last_used_at: null }, ...prev]);
    } catch (e: any) { toast.error(e.message); }
  }

  async function onRevokeKey(id: string) {
    if (!confirm("Révoquer cette clé API ?")) return;
    try { await revokeApiKey(id); setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k))); }
    catch (e: any) { toast.error(e.message); }
  }

  async function onCashout() {
    if (!current) return;
    try {
      const r: any = await cashoutBusinessBalance(current.id);
      if (r.ok) { toast.success(`${r.transferred.toLocaleString("fr-FR")} XOF transférés vers votre wallet ✅`); refreshAll(); }
      else toast.error(r.error);
    } catch (e: any) { toast.error(e.message); }
  }

  async function onCreateProject() {
    if (!current) return;
    const name = prompt("Nom du projet (ex: Boutique Faso, Atelier couture)");
    if (!name) return;
    const goalStr = prompt("Objectif financier en XOF (optionnel)") || "0";
    try {
      const p = await createProject({ business_id: current.id, name, financial_goal: Number(goalStr) || 0 });
      toast.success("Projet créé ✅");
      setProjects((prev) => [p, ...prev]);
    } catch (e: any) { toast.error(e.message); }
  }

  function copy(text: string) { navigator.clipboard.writeText(text); toast.success("Copié"); }

  async function onOrderStatus(o: Order, next: string) {
    try { const u: any = await updateOrderStatus({ id: o.id, status: next }); setOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, ...u } : x)); toast.success("Statut mis à jour"); }
    catch (e: any) { toast.error(e.message); }
  }

  async function onUploadPostImage(file: File) {
    setUploadingImg(true);
    try { const url = await uploadBusinessMedia(file, "posts"); setPostDraft((d) => ({ ...d, image_url: url })); }
    catch (e: any) { toast.error(e.message); }
    finally { setUploadingImg(false); }
  }

  async function onCreatePost(publish: boolean) {
    if (!current || !postDraft.title.trim()) { toast.error("Titre requis"); return; }
    try {
      const p: any = await createBusinessPost({
        business_id: current.id, title: postDraft.title,
        body: postDraft.body || undefined, image_url: postDraft.image_url || undefined,
        published: publish,
      });
      setPosts((prev) => [p, ...prev]);
      setPostDraft({ title: "", body: "", image_url: "" });
      toast.success(publish ? "Publication publiée ✅" : "Brouillon sauvegardé");
    } catch (e: any) { toast.error(e.message); }
  }

  async function onTogglePost(p: Post) {
    try { const u: any = await updateBusinessPost({ id: p.id, published: !p.published }); setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, ...u } : x)); }
    catch (e: any) { toast.error(e.message); }
  }

  async function onDeletePost(id: string) {
    if (!confirm("Supprimer cette publication ?")) return;
    try { await deleteBusinessPost(id); setPosts((prev) => prev.filter((x) => x.id !== id)); }
    catch (e: any) { toast.error(e.message); }
  }

  async function onWaCreate() {
    if (!current) return;
    if (wa && !confirm("Régénérer un nouveau worker ? L'ancien secret sera invalidé.")) return;
    try {
      const s: any = await createWhatsappSession(current.id);
      setWa({ ...s, worker_online: false });
      toast.success("Worker généré. Copie le secret et déploie.");
    } catch (e: any) { toast.error(e.message); }
  }
  async function onWaReset() {
    if (!current) return;
    if (!confirm("Redemander un QR (déconnecte la session actuelle) ?")) return;
    try { await resetWhatsappSession(current.id); const s: any = await getWhatsappSession(current.id); setWa(s); }
    catch (e: any) { toast.error(e.message); }
  }
  async function onWaSend() {
    if (!current) return;
    setWaSending(true);
    try {
      await sendWhatsappMessage({ business_id: current.id, to: waDraft.to, body: waDraft.body });
      toast.success("Message en file d'envoi");
      setWaDraft({ to: "", body: "" });
      const we = await listWhatsappEvents(current.id); setWaEvents(we);
    } catch (e: any) { toast.error(e.message); }
    finally { setWaSending(false); }
  }

  const WA_STATUS: Record<string, { label: string; color: string }> = {
    disconnected: { label: "Non connecté", color: "bg-muted text-muted-foreground" },
    qr: { label: "QR en attente de scan", color: "bg-amber-500/15 text-amber-500" },
    connecting: { label: "Reconnexion…", color: "bg-blue-500/15 text-blue-500" },
    connected: { label: "🟢 Connecté", color: "bg-emerald-500/15 text-emerald-500" },
    logged_out: { label: "Session expirée", color: "bg-red-500/15 text-red-500" },
  };

  const ORDER_STATUS_LABEL: Record<string, string> = {
    pending_payment: "En attente paiement", paid: "Payée", preparing: "En préparation",
    shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée", refunded: "Remboursée",
  };
  const ORDER_STATUS_COLOR: Record<string, string> = {
    pending_payment: "bg-amber-500/15 text-amber-500",
    paid: "bg-emerald-500/15 text-emerald-500",
    preparing: "bg-blue-500/15 text-blue-500",
    shipped: "bg-indigo-500/15 text-indigo-500",
    delivered: "bg-emerald-600/20 text-emerald-600",
    cancelled: "bg-destructive/15 text-destructive",
    refunded: "bg-muted text-muted-foreground",
  };

  const lightColors: Record<string, string> = {
    green: "from-emerald-500/30 to-emerald-500/5 border-emerald-500/40 text-emerald-400",
    yellow: "from-amber-500/30 to-amber-500/5 border-amber-500/40 text-amber-400",
    red: "from-red-500/30 to-red-500/5 border-red-500/40 text-red-400",
  };
  const lightLabel: Record<string, string> = { green: "🟢 En croissance", yellow: "🟡 Stable", red: "🔴 En baisse" };

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface-1/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <h1 className="order-3 w-full text-center font-[Space_Grotesk] text-lg font-bold tracking-tight sm:order-none sm:w-auto sm:text-xl">Espace Business</h1>
          <button onClick={onCreateBusiness} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-glow sm:px-4 sm:py-2 sm:text-xs">
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nouveau business</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
        {businesses.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-[Space_Grotesk] text-2xl font-bold">Créez votre premier business</h2>
            <p className="mt-2 text-sm text-muted-foreground">Encaissez vos clients via des liens de paiement Mobile Money et une API.</p>
            <button onClick={onCreateBusiness} className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Créer un business
            </button>
          </div>
        ) : (
          <>
            {/* Selector */}
            <div className="mb-6 flex flex-wrap gap-2">
              {businesses.map((b) => (
                <button key={b.id} onClick={() => setCurrent(b)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${current?.id === b.id ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:bg-muted"}`}>
                  {b.name}
                </button>
              ))}
            </div>

            {current && (
              <>
                {/* Quick access to power tools */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <Link to={`/business/${current.id}/bot`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">🤖 Bot WhatsApp</Link>
                  <Link to={`/business/${current.id}/accounting`} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20">📊 Comptabilité</Link>
                  <Link to={`/business/${current.id}/contracts`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">📄 Contrats & Factures</Link>
                  <Link to={`/business/${current.id}/marketing`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">📣 Publicité Facebook</Link>
                </div>
                {/* Header card */}
                <div className="rounded-3xl border border-border bg-card p-4 shadow-card-premium sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Business</p>
                      <h2 className="mt-1 font-[Space_Grotesk] text-2xl font-bold sm:text-3xl">{current.name}</h2>
                      <p className="mt-1 break-all text-xs text-muted-foreground">slug: <code className="rounded bg-muted px-1.5 py-0.5">{current.slug}</code> · commission {(current.fee_bps / 100).toFixed(2)}%</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Solde encaissé</p>
                      <p className="mt-1 font-[Space_Grotesk] text-2xl font-bold tabular-nums sm:text-3xl">{Number(current.balance).toLocaleString("fr-FR")} <span className="text-sm text-muted-foreground">XOF</span></p>
                      <button onClick={onCashout} disabled={Number(current.balance) <= 0}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-40">
                        <Wallet className="h-3.5 w-3.5" /> Transférer vers mon wallet
                      </button>
                    </div>
                  </div>
                  {dash && (
                    <div className={`mt-6 grid gap-3 rounded-2xl border bg-gradient-to-br p-5 sm:grid-cols-3 ${lightColors[dash.kpis.light]}`}>
                      <div>
                        <p className="text-xs uppercase tracking-wider opacity-70">État (30j)</p>
                        <p className="mt-1 text-xl font-bold">{lightLabel[dash.kpis.light]}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider opacity-70">Encaissé 30j</p>
                        <p className="mt-1 font-[Space_Grotesk] text-2xl font-bold tabular-nums text-foreground">{dash.kpis.total30.toLocaleString("fr-FR")} <span className="text-sm opacity-70">XOF</span></p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider opacity-70">Tendance vs 30j précédents</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-2xl font-bold">
                          {dash.kpis.trend >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                          {(dash.kpis.trend * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Boutique publique URL */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Store className="h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Votre boutique publique</p>
                        <p className="truncate text-sm font-mono text-primary">{`${window.location.origin}/shop/${current.slug}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copy(`${window.location.origin}/shop/${current.slug}`)} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted"><Copy className="h-4 w-4" /></button>
                      <a href={`/shop/${current.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
                        <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
                      </a>
                    </div>
                  </div>
                </div>

                {/* Projects */}
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-[Space_Grotesk] text-xl font-bold inline-flex items-center gap-2"><FolderKanban className="h-5 w-5" /> Mes projets</h3>
                    <button onClick={onCreateProject} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
                      <Plus className="h-3.5 w-3.5" /> Nouveau projet
                    </button>
                  </div>
                  {projects.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center">
                      <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-3 text-sm text-muted-foreground">Créez votre premier projet pour ajouter produits, liens, QR codes, factures et un coach IA dédié.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {projects.map((p) => {
                        const pct = p.financial_goal > 0 ? Math.min(100, (Number(p.balance) / Number(p.financial_goal)) * 100) : 0;
                        const status = pct >= 100 ? "green" : pct >= 50 ? "yellow" : Number(p.balance) === 0 ? "red" : "yellow";
                        return (
                          <Link key={p.id} to={`/business/${current.id}/projects/${p.id}`}
                            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-glow">
                            {p.cover_url && <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url(${p.cover_url})`, backgroundSize: "cover" }} />}
                            <div className="relative">
                              <div className="flex items-center gap-3">
                                {p.logo_url ? <img src={p.logo_url} className="h-10 w-10 rounded-xl object-cover" alt="" />
                                  : <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-sm font-bold text-primary-foreground">{p.name[0]}</div>}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-bold">{p.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{p.currency}</p>
                                </div>
                                <span className={`grid h-3 w-3 place-items-center rounded-full ${status === "green" ? "bg-emerald-500" : status === "yellow" ? "bg-amber-500" : "bg-red-500"} shadow-[0_0_12px_currentColor]`} />
                              </div>
                              <p className="mt-4 font-[Space_Grotesk] text-xl font-bold tabular-nums">{Number(p.balance).toLocaleString("fr-FR")} <span className="text-xs text-muted-foreground">/ {Number(p.financial_goal).toLocaleString("fr-FR")}</span></p>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                                Ouvrir <ChevronRight className="h-3 w-3" />
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Payment links */}
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-[Space_Grotesk] text-xl font-bold">Liens de paiement</h3>
                    <button onClick={onCreateLink} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                      <Plus className="h-3.5 w-3.5" /> Nouveau lien
                    </button>
                  </div>
                  <div className="space-y-2">
                    {links.length === 0 && <p className="text-sm text-muted-foreground">Aucun lien pour l'instant.</p>}
                    {links.map((l) => {
                      const url = `${window.location.origin}/pay/${l.slug}`;
                      return (
                        <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 p-4">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{l.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {l.amount ? `${Number(l.amount).toLocaleString("fr-FR")} ${l.currency}` : "Montant libre"} ·
                              <span className={l.status === "active" ? " text-emerald-500" : " text-amber-500"}> {l.status}</span>
                            </p>
                            <p className="mt-1 truncate text-xs text-primary">{url}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => copy(url)} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>
                            <a href={url} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-muted"><Link2 className="h-3.5 w-3.5" /></a>
                            <button onClick={() => onEditLink(l)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">Modifier prix</button>
                            <button onClick={() => onToggleLink(l)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">{l.status === "active" ? "Pauser" : "Activer"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Payments */}
                <section className="mt-8">
                  <h3 className="mb-3 font-[Space_Grotesk] text-xl font-bold">Paiements reçus</h3>
                  <div className="-mx-3 overflow-x-auto rounded-2xl border border-border bg-surface-2 sm:mx-0">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr><th className="px-4 py-3 text-left">Référence</th><th className="px-4 py-3 text-right">Montant</th><th className="px-4 py-3 text-right">Net</th><th className="px-4 py-3 text-left">Statut</th><th className="px-4 py-3 text-left">Date</th></tr>
                      </thead>
                      <tbody>
                        {payments.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun paiement</td></tr>}
                        {payments.map((p) => (
                          <tr key={p.id} className="border-t border-border">
                            <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{Number(p.amount).toLocaleString("fr-FR")}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{Number(p.net_amount).toLocaleString("fr-FR")}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "success" ? "bg-emerald-500/15 text-emerald-500" : p.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-500"}`}>{p.status}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("fr-FR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* ORDERS */}
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-[Space_Grotesk] text-xl font-bold inline-flex items-center gap-2"><Package className="h-5 w-5" /> Commandes ({orders.length})</h3>
                  </div>
                  {orders.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center">
                      <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-3 text-sm text-muted-foreground">Aucune commande. Partagez votre boutique publique pour recevoir vos premières commandes.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orders.map((o) => (
                        <div key={o.id} className="rounded-2xl border border-border bg-surface-2 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-bold">{o.order_number}</p>
                              <p className="text-xs text-muted-foreground">{o.customer_name || "—"} · {o.customer_email || "—"}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-[Space_Grotesk] text-lg font-bold tabular-nums">{Number(o.total_amount).toLocaleString("fr-FR")} <span className="text-xs text-muted-foreground">{o.currency}</span></p>
                              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_STATUS_COLOR[o.status] || "bg-muted"}`}>{ORDER_STATUS_LABEL[o.status] || o.status}</span>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-1 border-t border-border pt-3 text-xs sm:grid-cols-3">
                            {(o.items || []).map((it, i) => (
                              <div key={i} className="text-muted-foreground"><span className="font-semibold text-foreground">{it.name}</span> × {it.quantity}</div>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <a href={`/order/${o.public_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] hover:bg-muted"><ExternalLink className="h-3 w-3" /> Suivi client</a>
                            <select value={o.status} onChange={(e) => onOrderStatus(o, e.target.value)} className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium">
                              {Object.entries(ORDER_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* PUBLICATIONS / POSTS */}
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-[Space_Grotesk] text-xl font-bold inline-flex items-center gap-2"><Megaphone className="h-5 w-5" /> Publications</h3>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <input value={postDraft.title} onChange={(e) => setPostDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Titre de la publication"
                      className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
                    <textarea value={postDraft.body} onChange={(e) => setPostDraft((d) => ({ ...d, body: e.target.value }))} rows={3} placeholder="Contenu (promo, actualité, offre du jour…)"
                      className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {uploadingImg ? "Chargement…" : postDraft.image_url ? "Image ajoutée ✓" : "Ajouter une image"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadPostImage(f); }} />
                      </label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onCreatePost(false)} className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold hover:bg-muted">Brouillon</button>
                        <button onClick={() => onCreatePost(true)} className="rounded-full bg-gradient-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow">Publier</button>
                      </div>
                    </div>
                    {postDraft.image_url && <img src={postDraft.image_url} alt="preview" className="mt-3 h-32 w-full rounded-xl object-cover" />}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {posts.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Aucune publication.</p>}
                    {posts.map((p) => (
                      <div key={p.id} className="overflow-hidden rounded-2xl border border-border bg-surface-2">
                        {p.image_url && <img src={p.image_url} alt="" className="h-32 w-full object-cover" />}
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold">{p.title}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.published ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>{p.published ? "Publié" : "Brouillon"}</span>
                          </div>
                          {p.body && <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{p.body}</p>}
                          <div className="mt-3 flex items-center gap-2">
                            <button onClick={() => onTogglePost(p)} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] hover:bg-muted">
                              {p.published ? <><EyeOff className="h-3 w-3" /> Dépublier</> : <><Eye className="h-3 w-3" /> Publier</>}
                            </button>
                            <button onClick={() => onDeletePost(p.id)} className="grid h-7 w-7 place-items-center rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* CHAT PAY (WhatsApp) */}
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-[Space_Grotesk] text-xl font-bold inline-flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" /> Chat PAY <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">WhatsApp</span>
                    </h3>
                    {wa && (
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${WA_STATUS[wa.status]?.color || "bg-muted"}`}>
                        {WA_STATUS[wa.status]?.label || wa.status}
                        {wa.worker_online ? " · worker en ligne" : wa.status !== "disconnected" ? " · worker hors ligne" : ""}
                      </span>
                    )}
                  </div>

                  {!wa ? (
                    <div className="rounded-2xl border border-border bg-card p-6 text-center">
                      <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-3 text-sm text-muted-foreground">Connecte ton WhatsApp perso pour envoyer des liens de paiement, recevoir des notifications d'encaissement et modérer tes groupes.</p>
                      <button onClick={onWaCreate} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
                        <Plus className="h-3.5 w-3.5" /> Générer un worker Chat PAY
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {/* Panel connexion / QR */}
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Étape 1 · Déploiement du worker</p>
                        <p className="mt-2 text-xs text-muted-foreground">Colle ce secret dans la variable <code className="rounded bg-muted px-1">SESSION_SECRET</code> lors du déploiement (Railway, Fly.io, VPS — voir <code className="rounded bg-muted px-1">worker/README.md</code>).</p>
                        <div className="mt-2 flex items-center gap-2 rounded-xl bg-background p-2">
                          <code className="flex-1 truncate font-mono text-[11px]">{wa.connection_secret}</code>
                          <button onClick={() => copy(wa.connection_secret)} className="rounded-full bg-foreground px-3 py-1 text-[11px] font-semibold text-background"><Copy className="h-3 w-3" /></button>
                        </div>
                        <div className="mt-2 flex items-center gap-2 rounded-xl bg-background p-2">
                          <code className="flex-1 truncate font-mono text-[11px]">BRIDGE_URL={import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-bridge</code>
                          <button onClick={() => copy(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-bridge`)} className="rounded-full bg-foreground px-3 py-1 text-[11px] font-semibold text-background"><Copy className="h-3 w-3" /></button>
                        </div>

                        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Étape 2 · Scanne le QR</p>
                        <div className="mt-2 grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-border bg-surface-2 p-4">
                          {wa.status === "connected" ? (
                            <div className="text-center">
                              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><MessageCircle className="h-7 w-7" /></div>
                              <p className="mt-3 text-sm font-semibold">Connecté</p>
                              {wa.phone_number && <p className="text-xs text-muted-foreground">+{wa.phone_number}</p>}
                            </div>
                          ) : wa.qr_data_url ? (
                            <img src={wa.qr_data_url} alt="QR WhatsApp" className="h-52 w-52 rounded-xl bg-white p-2" />
                          ) : (
                            <div className="text-center text-xs text-muted-foreground">
                              <QrCode className="mx-auto h-10 w-10 opacity-50" />
                              <p className="mt-2">{wa.worker_online ? "En attente du QR…" : "Démarre le worker pour recevoir le QR"}</p>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={onWaCreate} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted"><RefreshCw className="h-3 w-3" /> Régénérer secret</button>
                          <button onClick={onWaReset} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted"><QrCode className="h-3 w-3" /> Redemander un QR</button>
                          <a href={`/business/${current?.id}/bot`} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-glow">
                            <MessageCircle className="h-3 w-3" /> Ouvrir le panel du bot
                          </a>
                        </div>
                      </div>

                      {/* Envoi + activité */}
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-card p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Envoyer un message</p>
                          <input value={waDraft.to} onChange={(e) => setWaDraft((d) => ({ ...d, to: e.target.value }))} placeholder="Numéro (ex: 22670000000)"
                            className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
                          <textarea value={waDraft.body} onChange={(e) => setWaDraft((d) => ({ ...d, body: e.target.value }))} rows={4} placeholder="Ton message… (tu peux coller un lien /pay/xxx)"
                            className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
                          <button onClick={onWaSend} disabled={waSending || wa.status !== "connected" || !waDraft.to || !waDraft.body}
                            className="mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
                            <Send className="h-3.5 w-3.5" /> {waSending ? "Envoi…" : "Envoyer"}
                          </button>
                        </div>

                        <div className="rounded-2xl border border-border bg-card p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activité récente</p>
                          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                            {waEvents.length === 0 && <p className="text-xs text-muted-foreground">Aucun événement pour le moment.</p>}
                            {waEvents.map((ev) => (
                              <div key={ev.id} className="rounded-xl bg-surface-2 p-2 text-[11px]">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold">{ev.kind}</span>
                                  <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString("fr-FR")}</span>
                                </div>
                                {ev.payload?.text && <p className="mt-1 text-muted-foreground line-clamp-2">{ev.payload.text}</p>}
                                {ev.payload?.from && <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{ev.payload.from}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* API keys */}
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-[Space_Grotesk] text-xl font-bold">Clés API</h3>
                    <button onClick={onCreateKey} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                      <Plus className="h-3.5 w-3.5" /> Générer une clé
                    </button>
                  </div>
                  {newKey && (
                    <div className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Copiez votre clé maintenant — elle ne sera plus jamais affichée</p>
                      <div className="mt-2 flex items-center gap-2 rounded-xl bg-background p-3">
                        <code className="flex-1 truncate font-mono text-xs">{newKey}</code>
                        <button onClick={() => { copy(newKey); setNewKey(null); }} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background"><Copy className="h-3 w-3" /></button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {keys.length === 0 && <p className="text-sm text-muted-foreground">Aucune clé.</p>}
                    {keys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 p-4">
                        <div className="flex items-center gap-3">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-mono text-sm">{k.key_prefix}…</p>
                            <p className="text-xs text-muted-foreground">{k.label} · {k.mode} {k.revoked_at ? "· révoquée" : ""}</p>
                          </div>
                        </div>
                        {!k.revoked_at && (
                          <button onClick={() => onRevokeKey(k.id)} className="grid h-8 w-8 place-items-center rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>

                  <details className="mt-6 rounded-2xl border border-border bg-surface-2 p-4 text-sm">
                    <summary className="cursor-pointer font-semibold">Documentation API REST</summary>
                    <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                      <p>Base URL : <code className="rounded bg-muted px-1.5 py-0.5">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/pay/v1</code></p>
                      <p>Authentification : header <code className="rounded bg-muted px-1.5 py-0.5">Authorization: Bearer fip_live_xxx</code></p>
                      <div>
                        <p className="font-semibold text-foreground">Créer un lien :</p>
                        <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-[10px]">{`POST /v1/payment-links
{ "title": "Commande #123", "amount": 5000, "currency": "XOF" }`}</pre>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Récupérer un paiement :</p>
                        <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-[10px]">{`GET /v1/payments/{reference}`}</pre>
                      </div>
                    </div>
                  </details>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
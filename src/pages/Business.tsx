import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyBusinesses, createBusiness, listPaymentLinks, createPaymentLink,
  updatePaymentLink, listLinkPayments, listApiKeys, createApiKey, revokeApiKey,
  cashoutBusinessBalance, listProjects, createProject, getBusinessDashboard,
  updateBusiness, updateProject,
} from "@/lib/business.functions";
import {
  listOrders, updateOrderStatus,
  listBusinessPosts, createBusinessPost, updateBusinessPost, deleteBusinessPost,
} from "@/lib/orders.functions";
import { uploadBusinessMedia } from "@/lib/upload";
import { ArrowLeft, Building2, Copy, Link2, Plus, Trash2, Wallet, FolderKanban, TrendingUp, TrendingDown, ChevronRight, Sparkles, Store, Package, Megaphone, Image as ImageIcon, ExternalLink, Eye, EyeOff, Palette } from "lucide-react";
import { LayoutDashboard, Receipt, CreditCard, Settings2, BarChart3 } from "lucide-react";

const NAV = [
  { id: "overview", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "projects", label: "Projets", icon: FolderKanban },
  { id: "links", label: "Liens de paiement", icon: Link2 },
  { id: "payments", label: "Paiements", icon: CreditCard },
  { id: "orders", label: "Commandes", icon: Package },
  { id: "posts", label: "Publications", icon: Megaphone },
  { id: "settings", label: "Ma boutique", icon: Settings2 },
] as const;
type TabId = typeof NAV[number]["id"];

type Biz = { id: string; name: string; slug: string; status: string; balance: number; fee_bps: number };
type PLink = { id: string; slug: string; title: string; amount: number | null; currency: string; status: string };
type Payment = { id: string; reference: string; amount: number; status: string; net_amount: number; created_at: string };
type ApiKey = { id: string; label: string; key_prefix: string; mode: string; revoked_at: string | null; last_used_at: string | null };
type Project = { id: string; name: string; slug: string; logo_url: string | null; cover_url: string | null; balance: number; financial_goal: number; currency: string; status: string };
type Dashboard = { business: any; projects: Project[]; kpis: { total30: number; totalPrev: number; trend: number; count30: number; light: "red" | "yellow" | "green" }; series: Array<{ date: string; value: number }> };
type Order = { id: string; order_number: string; public_token: string; status: string; customer_name: string | null; customer_email: string | null; total_amount: number; currency: string; created_at: string; items: Array<{ name: string; quantity: number; unit_price: number }> };
type Post = { id: string; title: string; body: string | null; image_url: string | null; product_id: string | null; published: boolean; published_at: string | null; created_at: string };

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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");

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
    const [l, p, k, pr, d, o, po] = await Promise.all([
      safe(listPaymentLinks(bizId), [] as any),
      safe(listLinkPayments(bizId), [] as any),
      safe(listApiKeys(bizId), [] as any),
      safe(listProjects(bizId), [] as any),
      safe(getBusinessDashboard(bizId), null as any),
      safe(listOrders(bizId), [] as any),
      safe(listBusinessPosts(bizId), [] as any),
    ]);
    setLinks(l); setPayments(p); setKeys(k); setProjects(pr); setDash(d); setOrders(o); setPosts(po);
  }
  useEffect(() => { if (session) refreshAll(); /* eslint-disable-next-line */ }, [session]);
  useEffect(() => { if (current) refreshCurrent(current.id); }, [current?.id]);

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
      <header className="sticky top-0 z-30 border-b border-border bg-surface-1/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-sm font-black text-primary-foreground">B</span>
              <h1 className="font-[Space_Grotesk] text-base font-bold tracking-tight sm:text-lg">Espace Business</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {businesses.length > 1 && (
              <select value={current?.id || ""} onChange={(e) => setCurrent(businesses.find((b) => b.id === e.target.value) || null)}
                className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-semibold outline-none">
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <button onClick={onCreateBusiness} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground shadow-glow sm:text-xs">
              <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nouveau business</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
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
          <div className="flex gap-6">
            {/* Menu vertical */}
            <aside className="hidden w-60 shrink-0 lg:block">
              <nav className="sticky top-20 space-y-1 rounded-2xl border border-border bg-card p-3">
                {NAV.map((n) => {
                  const Icon = n.icon;
                  const active = tab === n.id;
                  return (
                    <button key={n.id} onClick={() => setTab(n.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                      <Icon className="h-4 w-4" /> {n.label}
                    </button>
                  );
                })}
                {current && (
                  <div className="mt-3 space-y-1 border-t border-border pt-3">
                    <Link to={`/business/${current.id}/accounting`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
                      <BarChart3 className="h-4 w-4" /> Comptabilité
                    </Link>
                    <Link to={`/business/${current.id}/contracts`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Receipt className="h-4 w-4" /> Contrats & Factures
                    </Link>
                  </div>
                )}
              </nav>
            </aside>

            <div className="min-w-0 flex-1">
            {/* Menu horizontal (mobile) */}
            <div className="-mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1 lg:hidden">
              {NAV.map((n) => (
                <button key={n.id} onClick={() => setTab(n.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${tab === n.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"}`}>
                  {n.label}
                </button>
              ))}
            </div>

            {current && (
              <>
              {tab === "overview" && (<>
                {/* Barre de statistiques (style tableau de bord marchand) */}
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "Solde du business", value: `${Number(current.balance).toLocaleString("fr-FR")} XOF` },
                    { label: "Nb projets", value: String(projects.length) },
                    { label: "Collecté (30j)", value: `${Number(dash?.kpis.total30 || 0).toLocaleString("fr-FR")} XOF` },
                    { label: "Paiements", value: String(payments.length) },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-border bg-card px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      <p className="mt-1 font-[Space_Grotesk] text-base font-bold tabular-nums">{s.value}</p>
                    </div>
                  ))}
                </div>
                {/* Quick access to power tools */}
                <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
                  <Link to={`/business/${current.id}/accounting`} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20">📊 Comptabilité</Link>
                  <Link to={`/business/${current.id}/contracts`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">📄 Contrats & Factures</Link>
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
                      <Link to={`/shop/${encodeURIComponent(current.slug)}`} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
                        <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
                      </Link>
                    </div>
                  </div>
                </div>

                </>)}

                {tab === "settings" && (<>
                <ShopBrandingPanel biz={current} onUpdated={refreshAll} />
                <ShopProjectsPanel projects={projects} onChanged={() => refreshCurrent(current.id)} onGoProjects={() => setTab("projects")} />
                </>)}

                {/* Projects */}
                {tab === "projects" && (
                <section>
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
                         const vitrineUrl = `${window.location.origin}/vitrine/${p.id}`;
                         return (
                           <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-glow">
                           <Link to={`/business/${current.id}/projects/${p.id}`} className="block">
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
                               <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                 Gérer les produits <ChevronRight className="h-3 w-3" />
                               </div>
                             </div>
                           </Link>
                           <div className="relative mt-3 flex items-center gap-2 border-t border-border pt-3">
                             <a href={vitrineUrl} target="_blank" rel="noreferrer"
                               className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-glow">
                               <ExternalLink className="h-3 w-3" /> Voir la vitrine
                             </a>
                             <button onClick={() => copy(vitrineUrl)}
                               className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted">
                               <Copy className="h-3 w-3" /> Copier le lien
                             </button>
                           </div>
                           </div>
                         );
                      })}
                    </div>
                  )}
                </section>

                )}

                {/* Payment links */}
                {tab === "links" && (
                <section>
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
                            <Link to={`/pay/${encodeURIComponent(l.slug)}`} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-muted"><Link2 className="h-3.5 w-3.5" /></Link>
                            <button onClick={() => onEditLink(l)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">Modifier prix</button>
                            <button onClick={() => onToggleLink(l)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">{l.status === "active" ? "Pauser" : "Activer"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                )}

                {/* Payments */}
                {tab === "payments" && (
                <section>
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

                )}

                {/* ORDERS */}
                {tab === "orders" && (
                <section>
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
                            <Link to={`/order/${encodeURIComponent(o.public_token)}`} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] hover:bg-muted"><ExternalLink className="h-3 w-3" /> Suivi client</Link>
                            <select value={o.status} onChange={(e) => onOrderStatus(o, e.target.value)} className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium">
                              {Object.entries(ORDER_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                )}

                {/* PUBLICATIONS / POSTS */}
                {tab === "posts" && (
                <section>
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

                )}

                {/* Section « Clés API » masquée volontairement — accès interne uniquement */}
              </>
            )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
// Panneau : Personnalisation boutique (logo, couverture, description)
// ============================================================
function ShopBrandingPanel({ biz, onUpdated }: { biz: Biz & { logo_url?: string; cover_url?: string; description?: string }; onUpdated: () => void }) {
  const [name, setName] = useState(biz.name || "");
  const [description, setDescription] = useState((biz as any).description || "");
  const [logoUrl, setLogoUrl] = useState((biz as any).logo_url || "");
  const [coverUrl, setCoverUrl] = useState((biz as any).cover_url || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);

  useEffect(() => {
    setName(biz.name || "");
    setDescription((biz as any).description || "");
    setLogoUrl((biz as any).logo_url || "");
    setCoverUrl((biz as any).cover_url || "");
  }, [biz.id]);

  async function onFile(kind: "logo" | "cover", f: File) {
    setUploading(kind);
    try {
      const url = await uploadBusinessMedia(f, kind);
      if (kind === "logo") setLogoUrl(url); else setCoverUrl(url);
      await updateBusiness({ id: biz.id, [kind === "logo" ? "logo_url" : "cover_url"]: url } as any);
      toast.success(kind === "logo" ? "Logo mis à jour ✅" : "Photo de couverture mise à jour ✅");
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(null); }
  }

  async function saveText() {
    setSaving(true);
    try {
      await updateBusiness({ id: biz.id, name, description });
      toast.success("Boutique enregistrée ✅");
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-4 shadow-card-premium sm:p-6">
      <h3 className="font-[Space_Grotesk] text-lg font-bold inline-flex items-center gap-2"><Store className="h-5 w-5" /> Personnalisation boutique</h3>
      <p className="mt-1 text-xs text-muted-foreground">Ces éléments apparaissent sur votre page boutique publique et sur vos reçus/factures.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Logo</p>
          <div className="mt-2 flex items-center gap-3">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-border" />
              : <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">Aucun</div>}
            <label className="cursor-pointer rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              {uploading === "logo" ? "Envoi…" : "Choisir un fichier"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading === "logo"}
                onChange={(e) => e.target.files?.[0] && onFile("logo", e.target.files[0])} />
            </label>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Photo de couverture</p>
          <div className="mt-2 flex items-center gap-3">
            {coverUrl ? <img src={coverUrl} alt="Couverture" className="h-16 w-28 rounded-xl object-cover border border-border" />
              : <div className="grid h-16 w-28 place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">Aucune</div>}
            <label className="cursor-pointer rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              {uploading === "cover" ? "Envoi…" : "Choisir un fichier"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading === "cover"}
                onChange={(e) => e.target.files?.[0] && onFile("cover", e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la boutique"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={saveText} disabled={saving}
          className="rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Description courte (affichée sur la vitrine et les reçus)" rows={3}
          className="md:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </div>
    </section>
  );
}

// ============================================================
// Panneau : Projets affichés dans la boutique
// ============================================================
function ShopProjectsPanel({ projects, onChanged, onGoProjects }: { projects: Project[]; onChanged: () => void; onGoProjects: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(p: Project) {
    setBusy(p.id);
    try {
      await updateProject({ id: p.id, show_in_shop: !(p as any).show_in_shop });
      toast.success(!(p as any).show_in_shop ? "Projet ajouté à la boutique ✅" : "Projet retiré de la boutique");
      onChanged();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-4 shadow-card-premium sm:p-6">
      <h3 className="font-[Space_Grotesk] text-lg font-bold inline-flex items-center gap-2"><FolderKanban className="h-5 w-5" /> Ajouter des projets / produits à la boutique</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Seuls les projets déjà créés et configurés (paiements) peuvent être affichés. Créez d'abord le projet dans l'onglet « Projets », ajoutez-y vos produits, puis activez-le ici.
      </p>
      {projects.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-center">
          <p className="text-sm text-muted-foreground">Aucun projet disponible. Créez d'abord un projet et configurez ses paiements.</p>
          <button onClick={onGoProjects} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
            <Plus className="h-3.5 w-3.5" /> Créer un projet
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {projects.map((p) => {
            const on = Boolean((p as any).show_in_shop);
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {p.logo_url ? <img src={p.logo_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
                    : <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-xs font-bold text-primary-foreground">{p.name[0]}</div>}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.currency} · {p.status === "active" ? "actif" : p.status}</p>
                  </div>
                </div>
                <button onClick={() => toggle(p)} disabled={busy === p.id}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${on ? "bg-emerald-500/15 text-emerald-500" : "border border-border hover:bg-muted"}`}>
                  {busy === p.id ? "…" : on ? "Affiché dans la boutique ✓" : "Ajouter à la boutique"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

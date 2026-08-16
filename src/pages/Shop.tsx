import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShop, initShopCheckout } from "@/lib/pay.functions";
import { MomoPayment } from "@/components/momo-payment";
import { Loader2, ShoppingCart, Plus, Minus, X, ShieldCheck, Store, Mail, Phone } from "lucide-react";

type Product = { id: string; name: string; slug: string; description: string | null; price: number; currency: string; project_id?: string | null; media?: Array<{ url: string; type: string }> };
type Post = { id: string; title: string; body: string | null; image_url: string | null; product_id: string | null; published_at: string };
type Biz = {
  id: string; name: string; slug: string; description: string | null; tagline?: string | null;
  logo_url: string | null; cover_url?: string | null; contact_email: string | null; contact_phone: string | null;
  theme?: { bg?: string; surface?: string; text?: string; muted?: string; primary?: string; primary_text?: string };
};
type ShopProject = { id: string; name: string; description: string | null; cover_url: string | null; logo_url: string | null; products: Product[] };

const DEFAULT_THEME = { bg: "#0b0b0f", surface: "#15151c", text: "#f5f5f7", muted: "#a1a1aa", primary: "#f97316", primary_text: "#ffffff" };

export default function Shop() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [biz, setBiz] = useState<Biz | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<ShopProject[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", address: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [pay, setPay] = useState<{ reference: string; amount: number; currency: string; order_token: string; checkoutUrl?: string } | null>(null);

  useEffect(() => {
    // Retour depuis paiement : rediriger vers le suivi de commande
    const params = new URLSearchParams(window.location.search);
    const orderToken = params.get("order");
    if (orderToken && /^[a-f0-9]{16,64}$/i.test(orderToken)) {
      const payRef = params.get("pay_ref");
      navigate(`/order/${orderToken}${payRef ? `?pay_ref=${encodeURIComponent(payRef)}` : ""}`, { replace: true });
      return;
    }
    getShop(slug).then((r: any) => {
      setBiz(r.business); setProducts(r.products); setProjects(r.projects || []); setPosts(r.posts); setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, [slug, navigate]);

  const currency = products[0]?.currency || "XOF";
  const total = useMemo(() => Object.entries(cart).reduce((s, [pid, qty]) => {
    const p = products.find((x) => x.id === pid);
    return s + (p ? Number(p.price) * qty : 0);
  }, 0), [cart, products]);
  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);

  function addToCart(pid: string) {
    setCart((c) => ({ ...c, [pid]: (c[pid] || 0) + 1 }));
  }
  function setQty(pid: string, qty: number) {
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[pid]; else n[pid] = qty; return n; });
  }

  async function checkout() {
    if (!biz || cartCount === 0) return;
    if (!customer.email) { setError("Email requis pour recevoir le reçu"); return; }
    setSubmitting(true); setError(null);
    try {
      const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }));
      const r: any = await initShopCheckout({
        business_slug: biz.slug, items,
        customer_email: customer.email,
        customer_name: customer.name || undefined,
        customer_phone: customer.phone || undefined,
        shipping_address: customer.address || undefined,
        customer_note: customer.note || undefined,
      });
      if (!r?.reference) throw new Error("Paiement indisponible pour le moment");
      
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
        return;
      }
      
      setPay({ reference: r.reference, amount: Number(r.amount), currency: r.currency, order_token: r.order_token });
      setSubmitting(false);
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error && !biz) return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div><Store className="mx-auto h-12 w-12 text-muted-foreground" /><h1 className="mt-4 text-2xl font-bold">Boutique introuvable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></div>
    </div>
  );
  if (!biz) return null;

  const th = { ...DEFAULT_THEME, ...(biz.theme || {}) };
  const grouped: ShopProject[] = projects.length
    ? projects
    : [{ id: "_all", name: "Produits", description: null, cover_url: null, logo_url: null, products }];

  const card = (p: Product) => {
    const img = p.media?.[0]?.url;
    const qty = cart[p.id] || 0;
    return (
      <div key={p.id} id={`product-${p.id}`} className="overflow-hidden rounded-2xl transition hover:-translate-y-1"
        style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
        {img ? <img src={img} alt={p.name} className="h-56 w-full object-cover" loading="lazy" />
          : <div className="grid h-56 w-full place-items-center" style={{ background: `${th.primary}12` }}><Store className="h-10 w-10" style={{ color: th.muted }} /></div>}
        <div className="p-4">
          <h3 className="font-bold">{p.name}</h3>
          {p.description && <p className="mt-1 text-sm line-clamp-2" style={{ color: th.muted }}>{p.description}</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-lg font-bold tabular-nums">{Number(p.price).toLocaleString("fr-FR")} <span className="text-xs" style={{ color: th.muted }}>{p.currency}</span></p>
            {qty === 0 ? (
              <button onClick={() => addToCart(p.id)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: th.primary, color: th.primary_text }}>
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full px-1 py-0.5" style={{ border: `1px solid ${th.primary}55` }}>
                <button onClick={() => setQty(p.id, qty - 1)} className="grid h-7 w-7 place-items-center rounded-full"><Minus className="h-3 w-3" /></button>
                <span className="w-4 text-center text-sm font-bold tabular-nums">{qty}</span>
                <button onClick={() => setQty(p.id, qty + 1)} className="grid h-7 w-7 place-items-center rounded-full"><Plus className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <nav className="sticky top-0 z-40 w-full border-b backdrop-blur-xl" style={{ backgroundColor: `${th.bg}cc`, borderColor: `${th.primary}22` }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {biz.logo_url ? (
              <img src={biz.logo_url} alt={biz.name} className="h-9 w-9 rounded-xl object-cover" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-xl text-lg font-bold" style={{ background: th.primary, color: th.primary_text }}>{biz.name[0]}</div>
            )}
            <span className="text-lg font-bold tracking-tight">{biz.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCartOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95" style={{ background: th.surface }}>
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow-lg" style={{ background: th.primary, color: th.primary_text }}>{cartCount}</span>}
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="relative mb-12 overflow-hidden rounded-[2rem] shadow-2xl" style={{ backgroundColor: th.surface }}>
          <div className="absolute inset-0 z-0">
            {biz.cover_url ? (
              <img src={biz.cover_url} className="h-full w-full object-cover opacity-60" alt="" />
            ) : (
              <div className="h-full w-full opacity-20" style={{ background: `linear-gradient(135deg, ${th.primary}, ${th.surface})` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col justify-end p-8 pt-48 sm:p-12 sm:pt-64">
            <div className="max-w-2xl">
              <h1 className="font-[Space_Grotesk] text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">{biz.name}</h1>
              <p className="mt-4 text-lg sm:text-xl" style={{ color: th.muted }}>{biz.tagline || biz.description || "Votre destination shopping premium."}</p>
            </div>
          </div>
        </section>

        {/* Publications */}
        {posts.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold">Actualités</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {posts.slice(0, 4).map((p) => (
                <article key={p.id} className="overflow-hidden rounded-2xl" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
                  {p.image_url && <img src={p.image_url} alt={p.title} className="h-40 w-full object-cover" loading="lazy" />}
                  <div className="p-4">
                    <h3 className="font-bold">{p.title}</h3>
                    {p.body && <p className="mt-1 text-sm line-clamp-3" style={{ color: th.muted }}>{p.body}</p>}
                    <p className="mt-2 text-[10px]" style={{ color: th.muted }}>{new Date(p.published_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Produits regroupés par projet */}
        {products.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ border: `1px dashed ${th.primary}44` }}>
            <Store className="mx-auto h-10 w-10" style={{ color: th.muted }} />
            <p className="mt-3 text-sm" style={{ color: th.muted }}>Aucun produit disponible pour l'instant.</p>
          </div>
        ) : (
          grouped.filter((g) => g.products.length > 0).map((g) => (
            <section key={g.id} className="mb-12">
              <div className="mb-5 flex items-center gap-3 border-b pb-3" style={{ borderColor: `${th.primary}33` }}>
                {g.logo_url && <img src={g.logo_url} alt={g.name} className="h-10 w-10 rounded-xl object-cover" />}
                <div>
                  <h2 className="text-2xl font-bold">{g.name}</h2>
                  {g.description && <p className="text-sm" style={{ color: th.muted }}>{g.description}</p>}
                </div>
                <span className="ml-auto text-xs" style={{ color: th.muted }}>{g.products.length} produit(s)</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{g.products.map(card)}</div>
            </section>
          ))
        )}

        {/* Contact & Footer */}
        <footer className="mt-16 overflow-hidden rounded-3xl p-8 sm:p-12" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="flex items-center gap-3">
                {biz.logo_url ? (
                  <img src={biz.logo_url} alt={biz.name} className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-xl text-lg font-bold" style={{ background: th.primary, color: th.primary_text }}>{biz.name[0]}</div>
                )}
                <span className="text-xl font-bold">{biz.name}</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: th.muted }}>{biz.description || biz.tagline || "Votre boutique de confiance pour des achats en toute sécurité."}</p>
            </div>

            <div>
              <h4 className="font-bold uppercase tracking-wider text-xs mb-4" style={{ color: th.primary }}>Navigation</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:opacity-80 transition">Accueil</a></li>
                {projects.map(p => (
                  <li key={p.id}><a href={`#project-${p.id}`} className="hover:opacity-80 transition">{p.name}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold uppercase tracking-wider text-xs mb-4" style={{ color: th.primary }}>Contact</h4>
              <div className="space-y-4 text-sm" style={{ color: th.muted }}>
                {biz.contact_email && (
                  <a href={`mailto:${biz.contact_email}`} className="flex items-center gap-2 hover:text-foreground transition">
                    <Mail className="h-4 w-4" /> {biz.contact_email}
                  </a>
                )}
                {biz.contact_phone && (
                  <a href={`tel:${biz.contact_phone}`} className="flex items-center gap-2 hover:text-foreground transition">
                    <Phone className="h-4 w-4" /> {biz.contact_phone}
                  </a>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span className="text-[11px]">Paiements sécurisés Mobile Money</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t pt-8 text-center text-[11px]" style={{ borderColor: `${th.primary}22`, color: th.muted }}>
            <p>© {new Date().getFullYear()} {biz.name}. Tous droits réservés.</p>
            <p className="mt-1 opacity-60">Propulsé par FASO-INVEST PAY</p>
          </div>
        </footer>
      </main>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
          <div className="absolute inset-0 bg-background/70 backdrop-blur" onClick={() => setCartOpen(false)} />
          <div className="relative flex h-[90vh] w-full flex-col rounded-t-3xl bg-card p-6 shadow-card-premium sm:h-full sm:w-[440px] sm:rounded-none sm:rounded-l-3xl">
            <div className="flex items-center justify-between">
              <h2 className="font-[Space_Grotesk] text-2xl font-bold">Panier</h2>
              <button onClick={() => setCartOpen(false)} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-6 flex-1 space-y-3 overflow-y-auto">
              {pay ? (
                pay.checkoutUrl ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-4 font-bold">Redirection vers YengaPay...</p>
                    <p className="mt-2 text-sm text-muted-foreground">Veuillez patienter pendant que nous préparons votre paiement sécurisé.</p>
                    <a href={pay.checkoutUrl} className="mt-6 inline-block text-primary underline text-sm">Cliquer ici si la redirection ne fonctionne pas</a>
                  </div>
                ) : (
                  <MomoPayment
                    reference={pay.reference} amount={pay.amount} currency={pay.currency} defaultPhone={customer.phone}
                    onSuccess={() => setTimeout(() => navigate(`/order/${pay.order_token}`), 1500)}
                    onCancel={() => setPay(null)}
                  />
                )
              ) : (<>
              {cartCount === 0 && <p className="text-center text-sm text-muted-foreground">Votre panier est vide</p>}
              {Object.entries(cart).map(([pid, qty]) => {
                const p = products.find((x) => x.id === pid); if (!p) return null;
                return (
                  <div key={pid} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{Number(p.price).toLocaleString("fr-FR")} × {qty} = <b>{(Number(p.price) * qty).toLocaleString("fr-FR")} {p.currency}</b></p>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-1 py-0.5">
                      <button onClick={() => setQty(pid, qty - 1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-muted"><Minus className="h-3 w-3" /></button>
                      <span className="w-4 text-center text-xs font-bold tabular-nums">{qty}</span>
                      <button onClick={() => setQty(pid, qty + 1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-muted"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                );
              })}
              {cartCount > 0 && (
                <div className="mt-6 space-y-2">
                  <input value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} type="email" required placeholder="Email * (reçu de commande)"
                    className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} placeholder="Nom"
                      className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
                    <input value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} placeholder="Téléphone"
                      className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
                  </div>
                  <input value={customer.address} onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} placeholder="Adresse de livraison (optionnel)"
                    className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
                  <textarea value={customer.note} onChange={(e) => setCustomer((c) => ({ ...c, note: e.target.value }))} placeholder="Note pour le marchand (optionnel)" rows={2}
                    className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
                </div>
              )}
              </>)}
            </div>
            {cartCount > 0 && !pay && (
              <div className="mt-4 border-t border-border pt-4">
                {error && <p className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-[Space_Grotesk] text-2xl font-bold tabular-nums">{total.toLocaleString("fr-FR")} <span className="text-sm text-muted-foreground">{currency}</span></span>
                </div>
                <button onClick={checkout} disabled={submitting || !customer.email}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Payer ${total.toLocaleString("fr-FR")} ${currency}`}
                </button>
                <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Paiement sécurisé Mobile Money</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
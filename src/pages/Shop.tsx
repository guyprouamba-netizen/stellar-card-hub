import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getShop, initShopCheckout } from "@/lib/pay.functions";
import { Loader2, ShoppingCart, Plus, Minus, X, ShieldCheck, Store, Mail, Phone } from "lucide-react";

type Product = { id: string; name: string; slug: string; description: string | null; price: number; currency: string; media?: Array<{ url: string; type: string }> };
type Post = { id: string; title: string; body: string | null; image_url: string | null; product_id: string | null; published_at: string };
type Biz = { id: string; name: string; slug: string; description: string | null; logo_url: string | null; contact_email: string | null; contact_phone: string | null };

export default function Shop() {
  const { slug = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [biz, setBiz] = useState<Biz | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", address: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getShop(slug).then((r: any) => {
      setBiz(r.business); setProducts(r.products); setPosts(r.posts); setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, [slug]);

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
        returnUrl: `${window.location.origin}/order/${""}`, // remplacé côté serveur via order token
      });
      if (r.checkout_url) {
        // Sauvegarder token localement pour le retour
        try { localStorage.setItem(`order:${r.order_token}`, JSON.stringify({ order_number: r.order_number, at: Date.now() })); } catch { /**/ }
        window.location.href = r.checkout_url;
      } else throw new Error("Redirection paiement introuvable");
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error && !biz) return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div><Store className="mx-auto h-12 w-12 text-muted-foreground" /><h1 className="mt-4 text-2xl font-bold">Boutique introuvable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></div>
    </div>
  );
  if (!biz) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Merchant header */}
      <header className="border-b border-border bg-surface-1/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {biz.logo_url ? (
              <img src={biz.logo_url} alt={biz.name} className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-primary font-bold text-primary-foreground">{biz.name[0]}</div>
            )}
            <div className="min-w-0">
              <h1 className="truncate font-[Space_Grotesk] text-lg font-bold sm:text-xl">{biz.name}</h1>
              {biz.description && <p className="truncate text-xs text-muted-foreground">{biz.description}</p>}
            </div>
          </div>
          <button onClick={() => setCartOpen(true)} className="relative inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Panier</span>
            {cartCount > 0 && <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-background px-1 text-xs font-bold text-foreground">{cartCount}</span>}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Publications feed */}
        {posts.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 font-[Space_Grotesk] text-xl font-bold">Actualités</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {posts.slice(0, 4).map((p) => (
                <article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  {p.image_url && <img src={p.image_url} alt="" className="h-40 w-full object-cover" />}
                  <div className="p-4">
                    <h3 className="font-bold">{p.title}</h3>
                    {p.body && <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{p.body}</p>}
                    {p.product_id && (
                      <button
                        onClick={() => { const el = document.getElementById(`product-${p.product_id}`); el?.scrollIntoView({ behavior: "smooth" }); }}
                        className="mt-3 text-xs font-semibold text-primary hover:underline">
                        Voir le produit →
                      </button>
                    )}
                    <p className="mt-2 text-[10px] text-muted-foreground">{new Date(p.published_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Products */}
        <section>
          <h2 className="mb-4 font-[Space_Grotesk] text-xl font-bold">Produits</h2>
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-12 text-center">
              <Store className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Aucun produit disponible pour l'instant.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const img = p.media?.[0]?.url;
                const qty = cart[p.id] || 0;
                return (
                  <div key={p.id} id={`product-${p.id}`} className="overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40 hover:shadow-glow">
                    {img ? <img src={img} alt={p.name} className="h-48 w-full object-cover" />
                      : <div className="grid h-48 w-full place-items-center bg-gradient-to-br from-muted to-surface-2"><Store className="h-10 w-10 text-muted-foreground" /></div>}
                    <div className="p-4">
                      <h3 className="font-bold">{p.name}</h3>
                      {p.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <p className="font-[Space_Grotesk] text-lg font-bold tabular-nums">{Number(p.price).toLocaleString("fr-FR")} <span className="text-xs text-muted-foreground">{p.currency}</span></p>
                        {qty === 0 ? (
                          <button onClick={() => addToCart(p.id)} className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow">
                            <Plus className="h-3.5 w-3.5" /> Ajouter
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-1 py-0.5">
                            <button onClick={() => setQty(p.id, qty - 1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted"><Minus className="h-3 w-3" /></button>
                            <span className="w-4 text-center text-sm font-bold tabular-nums">{qty}</span>
                            <button onClick={() => setQty(p.id, qty + 1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted"><Plus className="h-3 w-3" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Contact */}
        {(biz.contact_email || biz.contact_phone) && (
          <footer className="mt-16 border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>Contact : </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
              {biz.contact_email && <a href={`mailto:${biz.contact_email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="h-3.5 w-3.5" /> {biz.contact_email}</a>}
              {biz.contact_phone && <a href={`tel:${biz.contact_phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3.5 w-3.5" /> {biz.contact_phone}</a>}
            </div>
            <p className="mt-6 inline-flex items-center gap-1 text-[11px]"><ShieldCheck className="h-3 w-3" /> Boutique propulsée par FASO-INVEST PAY</p>
          </footer>
        )}
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
            </div>
            {cartCount > 0 && (
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
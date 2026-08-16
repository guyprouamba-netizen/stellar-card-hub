import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { getVitrine } from "@/lib/pay.functions";
import { initShopCheckout } from "@/lib/pay.functions";
import { MomoPayment } from "@/components/momo-payment";
import { Loader2, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";

type Product = { id: string; name: string; description: string | null; price: number; currency: string; media: Array<{ url: string; type: string }> };

export default function VitrinePage() {
  const { projectId = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_name: "", customer_email: "", customer_phone: "", shipping_address: "" });
  const [paying, setPaying] = useState(false);
  const [pay, setPay] = useState<{ reference: string; amount: number; currency: string; order_token: string } | null>(null);

  useEffect(() => {
    getVitrine(projectId)
      .then((r) => setData(r))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const products: Product[] = data?.products || [];
  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [products, q],
  );
  const currency = data?.project?.currency || "XOF";
  const fmt = (n: number) => `${Number(n || 0).toLocaleString("fr-FR")} ${currency === "XOF" ? "FCFA" : currency}`;
  const cartItems = products.filter((p) => cart[p.id] > 0);
  const total = cartItems.reduce((s, p) => s + Number(p.price) * cart[p.id], 0);
  const count = cartItems.reduce((s, p) => s + cart[p.id], 0);

  const add = (id: string, d = 1) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + d) }));

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    setPaying(true);
    try {
      const r: any = await initShopCheckout({
        business_slug: data.business.slug,
        items: cartItems.map((p) => ({ product_id: p.id, quantity: cart[p.id] })),
        ...form,
      });
      if (r?.checkoutUrl) {
        window.location.href = r.checkoutUrl;
        return;
      }
      if (r?.reference) setPay({ reference: r.reference, amount: Number(r.amount), currency: r.currency, order_token: r.order_token });
      else toast.error("Paiement indisponible");
    } catch (e: any) { toast.error(e.message); }
    finally { setPaying(false); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Vitrine introuvable</div>;

  const { project, business } = data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {project.logo_url
            ? <img src={project.logo_url} alt={project.name} className="h-9 w-9 rounded-xl object-cover" />
            : <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary font-bold text-primary-foreground">{project.name[0]}</div>}
          <div className="min-w-0 flex-1">
            <p className="truncate font-[Space_Grotesk] font-bold leading-tight">{project.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{business.name}</p>
          </div>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit"
              className="w-64 rounded-full border border-border bg-surface-2 py-2 pl-9 pr-4 text-sm outline-none focus:border-primary" />
          </div>
          <button onClick={() => setOpen(true)} className="relative inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">{fmt(total)}</span>
            {count > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">{count}</span>}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        {project.cover_url && <img src={project.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center">
          <h1 className="font-[Space_Grotesk] text-3xl font-extrabold tracking-tight sm:text-5xl">{project.name}</h1>
          {project.description && <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{project.description}</p>}
          <p className="mt-4 inline-flex rounded-full border border-border bg-surface-2 px-4 py-1.5 text-xs font-semibold">
            {products.length} produit{products.length > 1 ? "s" : ""} disponible{products.length > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      {/* Mobile search */}
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit"
            className="w-full rounded-full border border-border bg-surface-2 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary" />
        </div>
      </div>

      {/* Catalogue */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Aucun produit disponible.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => {
              const img = p.media.find((m) => m.type === "image")?.url;
              return (
                <article key={p.id} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-card-premium">
                  <div className="aspect-square overflow-hidden bg-surface-2">
                    {img
                      ? <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      : <div className="grid h-full w-full place-items-center text-4xl text-muted-foreground">🛍️</div>}
                  </div>
                  <div className="space-y-2 p-3">
                    <h2 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h2>
                    {p.description && <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                    <p className="font-[Space_Grotesk] text-base font-bold text-primary">{fmt(p.price)}</p>
                    {cart[p.id] ? (
                      <div className="flex items-center justify-between rounded-full border border-border bg-surface-2 px-2 py-1">
                        <button onClick={() => add(p.id, -1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="text-sm font-bold">{cart[p.id]}</span>
                        <button onClick={() => add(p.id, 1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => add(p.id, 1)} className="w-full rounded-full bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
                        Ajouter au panier
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">{business.name}</p>
        {business.contact_phone && <p className="mt-1">{business.contact_phone}</p>}
        {business.contact_email && <p>{business.contact_email}</p>}
        <p className="mt-3">Paiement sécurisé · FASO-INVEST PAY</p>
      </footer>

      {/* Cart drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-[Space_Grotesk] text-lg font-bold">Mon panier</h2>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full border border-border"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {cartItems.length === 0 && <p className="text-sm text-muted-foreground">Votre panier est vide.</p>}
              {cartItems.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{cart[p.id]} × {fmt(p.price)}</p>
                  </div>
                  <button onClick={() => setCart((c) => ({ ...c, [p.id]: 0 }))} className="text-xs text-destructive">Retirer</button>
                </div>
              ))}
            </div>
            {cartItems.length > 0 && (pay ? (
                <div className="mt-4 border-t border-border pt-4 text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="mt-4 font-bold text-sm">Redirection vers YengaPay...</p>
                  <div className="hidden">
                    <MomoPayment reference={pay.reference} amount={pay.amount} currency={pay.currency} defaultPhone={form.customer_phone}
                      onSuccess={() => setTimeout(() => { window.location.href = `/order/${pay.order_token}`; }, 1500)}
                      onCancel={() => setPay(null)} />
                  </div>
                </div>
              ) : (
              <form onSubmit={checkout} className="mt-4 space-y-2 border-t border-border pt-4">
                <input required placeholder="Votre nom" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input required type="email" placeholder="Votre email (reçu)" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input placeholder="Téléphone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input placeholder="Adresse de livraison" value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary" />
                <div className="flex items-center justify-between py-1 text-sm"><span>Total</span><span className="font-[Space_Grotesk] text-lg font-bold text-primary">{fmt(total)}</span></div>
                <button type="submit" disabled={paying} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
                  {paying && <Loader2 className="h-4 w-4 animate-spin" />} Commander et payer
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
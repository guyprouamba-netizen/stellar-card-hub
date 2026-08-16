import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShop } from "@/lib/pay.functions";
import { Loader2, ShieldCheck, Store, Mail, Phone, Eye } from "lucide-react";
import { ProductDetailModal } from "@/components/product-detail-modal";

type Product = { id: string; name: string; slug: string; description: string | null; price: number; currency: string; project_id?: string | null; media?: Array<{ url: string; type: string }> };
type Post = { id: string; title: string; body: string | null; image_url: string | null; product_id: string | null; published_at: string };
type Biz = {
  id: string; name: string; slug: string; description: string | null; tagline?: string | null;
  logo_url: string | null; cover_url?: string | null; contact_email: string | null; contact_phone: string | null;
  theme?: { bg?: string; surface?: string; text?: string; muted?: string; primary?: string; primary_text?: string };
  template_id?: string | null;
  template?: { config?: { css_vars?: Record<string, string> }; id: string; name: string } | null;
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
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

  useEffect(() => {
    if (!biz?.template?.config?.css_vars) return;
    const templateVars = biz.template.config.css_vars;
    const root = document.documentElement;
    Object.entries(templateVars).forEach(([k, v]) => {
      root.style.setProperty(k, v as string);
    });
    return () => {
      Object.keys(templateVars).forEach((k) => root.style.removeProperty(k));
    };
  }, [biz?.template]);

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error && !biz) return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div><Store className="mx-auto h-12 w-12 text-muted-foreground" /><h1 className="mt-4 text-2xl font-bold">Boutique introuvable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></div>
    </div>
  );
  if (!biz) return null;

  const th: any = { ...DEFAULT_THEME, ...(biz.theme || {}) };
  const templateVars = biz.template?.config?.css_vars || {};
  Object.entries(templateVars).forEach(([k, v]) => {
    if (k.startsWith('--')) {
      th[k.replace('--', '').replace(/-/g, '_')] = v;
    }
  });

  const grouped: ShopProject[] = projects.length
    ? projects
    : [{ id: "_all", name: "Produits", description: null, cover_url: null, logo_url: null, products }];

  const card = (p: Product) => {
    const img = p.media?.[0]?.url;
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
            <button onClick={() => setSelectedProduct(p)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition transform active:scale-95"
              style={{ background: th.primary, color: th.primary_text }}>
              <Eye className="h-3.5 w-3.5" /> Voir
            </button>
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
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

      {selectedProduct && biz && (
        <ProductDetailModal
          product={selectedProduct}
          biz={biz}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

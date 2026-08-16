import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getShop } from "@/lib/pay.functions";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, Store, Mail, Phone, Eye, ArrowRight, Star } from "lucide-react";

import { ProductDetailModal } from "@/components/product-detail-modal";

type Product = { id: string; name: string; slug: string; description: string | null; price: number; currency: string; project_id?: string | null; media?: any };
type Post = { id: string; title: string; body: string | null; image_url: string | null; product_id: string | null; published_at: string };
type Biz = {
  id: string; name: string; slug: string; description: string | null; tagline?: string | null;
  logo_url: string | null; cover_url?: string | null; contact_email: string | null; contact_phone: string | null;
  theme?: { bg?: string; surface?: string; text?: string; muted?: string; primary?: string; primary_text?: string };
  template_id?: string | null;
  template?: { config?: { 
    css_vars?: Record<string, string>;
    layout?: 'grid' | 'bento' | 'split' | 'minimal';
    animation?: 'fade' | 'slide' | 'zoom';
    card_style?: 'glass' | 'neo' | 'flat';
    header_style?: 'transparent' | 'glass' | 'floating';
  } | null; id: string; name: string } | null;
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
    const templateId = params.get("template_id");
    
    if (slug === "demo" && templateId) {
      const bizId = params.get("biz_id");
      
      const setupDemo = async () => {
        try {
          const { data: t } = await supabase.from("shop_templates").select("*").eq("id", templateId).maybeSingle();
          
          let demoBiz: any = {
            id: "demo",
            name: "Boutique Démo",
            slug: "demo",
            description: "Ceci est une prévisualisation en temps réel de votre futur boutique avec le template sélectionné.",
            tagline: "Découvrez le rendu final de votre site",
            logo_url: null,
            cover_url: t?.thumbnail_url || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop",
            contact_email: "demo@faso-invest.com",
            contact_phone: "+226 00 00 00 00",
            template: t ? { id: t.id, name: t.name, config: t.config } : null
          };

          // Contextual demo data based on template name
          const templateName = t?.name?.toLowerCase() || "";
          let demoProducts = [];

          if (templateName.includes("art") || templateName.includes("gallery")) {
            demoBiz.name = "Galerie d'Art Royale";
            demoBiz.tagline = "L'expression pure de l'esprit";
            demoBiz.cover_url = "https://images.unsplash.com/photo-1460661419201-fd4cecdc8a87?w=1200";
            demoProducts = [
              { id: "a1", name: "Éclats d'Éternité", slug: "a1", description: "Huile sur toile, pièce unique.", price: 1200000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800", type: "image" }] },
              { id: "a2", name: "Sculpture Silencieuse", slug: "a2", description: "Marbre blanc de Carrare.", price: 3500000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1544531586-fde5298cdd40?w=800", type: "image" }] },
              { id: "a3", name: "Ombres Portées", slug: "a3", description: "Photographie noir et blanc numérotée.", price: 450000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1554188248-986adbb73be4?w=800", type: "image" }] },
              { id: "a4", name: "Lumière du Sahel", slug: "a4", description: "Acrylique moderne sur textile.", price: 850000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800", type: "image" }] }
            ];
          } else if (templateName.includes("auto") || templateName.includes("drive") || templateName.includes("car")) {
            demoBiz.name = "Auto Drive Premium";
            demoBiz.tagline = "La route, redéfinie";
            demoBiz.cover_url = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200";
            demoProducts = [
              { id: "c1", name: "Berline Sport S-Line", slug: "c1", description: "Confort absolu et puissance pure.", price: 25000000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800", type: "image" }] },
              { id: "c2", name: "SUV Explorer 4x4", slug: "c2", description: "Prêt pour toutes les aventures au Burkina.", price: 18500000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800", type: "image" }] },
              { id: "c3", name: "Coupé GT Electrique", slug: "c3", description: "L'avenir de la mobilité, dès aujourd'hui.", price: 32000000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800", type: "image" }] },
              { id: "c4", name: "Pick-up Robust X", slug: "c4", description: "L'outil de travail infatigable.", price: 15000000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800", type: "image" }] }
            ];
          } else {
            demoProducts = [
              { id: "p1", name: "Smartphone Futuriste X", slug: "p1", description: "Le summum de la technologie mobile avec écran holographique.", price: 750000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800", type: "image" }] },
              { id: "p2", name: "Montre Connectée Elite", slug: "p2", description: "Design luxueux allié à une intelligence artificielle avancée.", price: 250000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800", type: "image" }] },
              { id: "p3", name: "Casque Audio Immersif", slug: "p3", description: "Une expérience sonore spatiale inégalée.", price: 185000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800", type: "image" }] },
              { id: "p4", name: "Drone de Course Pro", slug: "p4", description: "Vitesse extrême et caméra 8K pour des prises de vue époustouflantes.", price: 450000, currency: "XOF", media: [{ url: "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800", type: "image" }] }
            ];
          }

          if (bizId) {
            const { data: realBiz } = await supabase.from("businesses").select("*").eq("id", bizId).maybeSingle();
            if (realBiz) {
              demoBiz = { ...demoBiz, ...realBiz, template: demoBiz.template };
              const { data: realProducts } = await supabase.from("products").select("*, media:product_media(*)").eq("business_id", bizId).limit(8);
              if (realProducts?.length) demoProducts = realProducts as any[];
            }
          }

          setBiz(demoBiz);
          setProducts(demoProducts);
          setLoading(false);
        } catch (e) {
          console.error("Demo error", e);
          setLoading(false);
        }
      };

      setupDemo();
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

  if (loading) return (
    <div className="grid min-h-screen place-items-center bg-[#050505]">
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} 
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" />
      </motion.div>
    </div>
  );

  if (error && !biz) return (
    <div className="grid min-h-screen place-items-center px-6 text-center bg-[#050505] text-white">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Store className="mx-auto h-16 w-16 text-muted-foreground opacity-20" />
        <h1 className="mt-6 text-3xl font-black tracking-tighter italic uppercase">Boutique introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <button onClick={() => navigate('/')} className="mt-8 rounded-full border border-white/10 px-6 py-2 text-xs font-bold hover:bg-white hover:text-black transition-colors">
          Retour
        </button>
      </motion.div>
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
    const cardStyle = biz.template?.config?.card_style || 'glass';
    
    return (
      <motion.div
        key={p.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        whileHover={{ y: -4, scale: 1.01 }}
        className={`group overflow-hidden rounded-2xl transition-all duration-300 ${
          cardStyle === 'glass' ? 'backdrop-blur-md bg-white/5 border border-white/10' :
          cardStyle === 'neo' ? 'shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] border-2' :
          'border border-border'
        }`}
        style={{ 
          background: cardStyle === 'glass' ? undefined : th.surface, 
          borderColor: cardStyle === 'neo' ? th.primary : `${th.primary}22` 
        }}
      >
        <div className="relative aspect-[1/1] overflow-hidden sm:aspect-[4/3] md:aspect-[1/1]">
          {img ? (
            <motion.img 
              src={img} 
              alt={p.name} 
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" 
              loading="lazy" 
            />
          ) : (
            <div className="grid h-full w-full place-items-center" style={{ background: `${th.primary}08` }}>
              <Store className="h-6 w-6" style={{ color: th.muted }} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
             <button 
              onClick={() => setSelectedProduct(p)} 
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest shadow-lg"
              style={{ background: th.primary, color: th.primary_text }}
            >
              <Eye className="h-3 w-3" /> Voir
            </button>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-bold text-xs leading-tight line-clamp-1">{p.name}</h3>
            {p.price > 10000 && (
              <div className="flex-shrink-0 rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[8px] font-bold text-yellow-500">
                <Star className="h-2 w-2 fill-current inline mr-0.5" />
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: `${th.primary}11` }}>
            <p className="text-sm font-black tracking-tight tabular-nums">
              {Number(p.price).toLocaleString("fr-FR")} 
              <span className="ml-0.5 text-[9px] font-medium opacity-60">{p.currency}</span>
            </p>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedProduct(p)} 
              className="rounded-full p-1 transition-colors hover:bg-white/10"
              style={{ color: th.primary }}
            >
              <ArrowRight className="h-3 w-3" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  };


  return (
    <div className="min-h-screen selection:bg-primary selection:text-primary-foreground" style={{ background: th.bg, color: th.text }}>
      <AnimatePresence mode="wait">
        <motion.nav 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className={`sticky top-0 z-40 w-full transition-all duration-500 ${
            biz.template?.config?.header_style === 'floating' ? 'mt-4 px-4 sm:px-8' : ''
          }`}
        >
          <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-500 ${
            biz.template?.config?.header_style === 'glass' ? 'backdrop-blur-2xl bg-white/5 border-b border-white/10 h-20' :
            biz.template?.config?.header_style === 'floating' ? 'rounded-2xl backdrop-blur-2xl bg-white/5 border border-white/10 shadow-2xl h-16' :
            'bg-transparent border-b border-white/5 h-24'
          } flex items-center justify-between`}>
            <div className="flex items-center gap-4 group cursor-pointer">
              {biz.logo_url ? (
                <div className="relative">
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-tr from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-sm" style={{ backgroundColor: th.primary }} />
                  <img src={biz.logo_url} alt={biz.name} className="relative h-10 w-10 rounded-xl object-cover" />
                </div>
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-xl text-lg font-black italic shadow-lg" style={{ background: th.primary, color: th.primary_text }}>{biz.name[0]}</div>
              )}
              <span className="text-xl font-black tracking-tighter uppercase italic group-hover:tracking-widest transition-all duration-500">{biz.name}</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-[10px] font-black uppercase tracking-widest opacity-60">
              <a href="#" className="hover:opacity-100 transition-opacity">Accueil</a>
              <a href="#products" className="hover:opacity-100 transition-opacity">Produits</a>
              <a href="#footer" className="hover:opacity-100 transition-opacity">Contact</a>
            </div>

            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-5 py-2 text-[10px] font-black uppercase tracking-widest"
            >
              Panier (0)
            </motion.button>
          </div>
        </motion.nav>
      </AnimatePresence>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative mb-20 overflow-hidden rounded-[2.5rem] shadow-2xl sm:min-h-[400px]" style={{ backgroundColor: th.surface }}>
          <motion.div 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 z-0"
          >
            {biz.cover_url ? (
              <img src={biz.cover_url} className="h-full w-full object-cover" alt="" />
            ) : (
              <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${th.primary}, ${th.surface})` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          </motion.div>

          <div className="relative z-10 flex flex-col justify-end p-8 pt-48 sm:p-16 sm:pt-80">
            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="max-w-3xl"
            >
              <h1 className="font-[Space_Grotesk] text-5xl font-black tracking-tighter sm:text-7xl lg:text-8xl text-white uppercase italic leading-[0.9]">
                {biz.name}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <p className="text-xl sm:text-2xl font-medium" style={{ color: th.muted }}>
                  {biz.tagline || biz.description || "L'excellence à portée de main."}
                </p>
                <div className="h-px w-12 bg-white/20 hidden sm:block" />
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full bg-white px-6 py-2 text-sm font-bold text-black"
                >
                  Explorer
                </motion.button>
              </div>
            </motion.div>
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
            <section key={g.id} id="products" className="mb-20">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="mb-8 flex items-end justify-between gap-4 border-b-2 pb-4" 
                style={{ borderColor: `${th.primary}22` }}
              >
                <div>
                  <div className="flex items-center gap-3">
                    {g.logo_url && <img src={g.logo_url} alt={g.name} className="h-8 w-8 rounded-lg object-cover" />}
                    <h2 className="text-3xl font-black tracking-tight uppercase italic">{g.name}</h2>
                  </div>
                  {g.description && <p className="mt-1 text-sm font-medium" style={{ color: th.muted }}>{g.description}</p>}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{g.products.length} Items</span>
                </div>
              </motion.div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-6">
                {g.products.map(card)}
              </div>
            </section>
          ))
        )}

        <footer id="footer" className="mt-32 overflow-hidden rounded-[3rem] p-8 sm:p-20 relative" style={{ background: th.surface, border: `1px solid ${th.primary}11` }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -mr-32 -mt-32" style={{ backgroundColor: `${th.primary}05` }} />
          
          <div className="grid gap-16 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4">
                {biz.logo_url ? (
                  <img src={biz.logo_url} alt={biz.name} className="h-12 w-12 rounded-2xl object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-2xl text-xl font-black italic shadow-2xl" style={{ background: th.primary, color: th.primary_text }}>{biz.name[0]}</div>
                )}
                <span className="text-3xl font-black tracking-tighter uppercase italic">{biz.name}</span>
              </div>
              <p className="mt-8 text-lg font-medium max-w-md leading-relaxed" style={{ color: th.muted }}>
                {biz.description || biz.tagline || "Redéfinir le futur du commerce avec élégance et performance."}
              </p>
            </div>

            <div>
              <h4 className="font-black uppercase tracking-[0.2em] text-[10px] mb-8" style={{ color: th.primary }}>Navigation</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li><a href="#" className="hover:opacity-60 transition-opacity">Accueil</a></li>
                {projects.map(p => (
                  <li key={p.id}><a href={`#project-${p.id}`} className="hover:opacity-60 transition-opacity uppercase italic">{p.name}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-black uppercase tracking-[0.2em] text-[10px] mb-8" style={{ color: th.primary }}>Contact</h4>
              <div className="space-y-6 text-sm font-bold" style={{ color: th.text }}>
                {biz.contact_email && (
                  <a href={`mailto:${biz.contact_email}`} className="flex items-center gap-3 hover:opacity-60 transition-opacity">
                    <Mail className="h-5 w-5 opacity-40" /> {biz.contact_email}
                  </a>
                )}
                {biz.contact_phone && (
                  <a href={`tel:${biz.contact_phone}`} className="flex items-center gap-3 hover:opacity-60 transition-opacity">
                    <Phone className="h-5 w-5 opacity-40" /> {biz.contact_phone}
                  </a>
                )}
                <div className="flex items-center gap-3 pt-4">
                  <div className="h-10 w-10 rounded-full border border-white/5 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Paiements Sécurisés</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-20 border-t pt-10 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: `${th.primary}11` }}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">© {new Date().getFullYear()} {biz.name}.</p>
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest opacity-40">
              <a href="#" className="hover:opacity-100 transition-opacity">Privacy</a>
              <a href="#" className="hover:opacity-100 transition-opacity">Terms</a>
              <span className="text-white italic">FASO-INVEST PAY</span>
            </div>
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

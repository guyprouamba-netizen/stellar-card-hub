import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, Plus, Trash2, Eye, EyeOff, Image as ImageIcon, Loader2, ExternalLink, Download, Settings2, FileUp } from "lucide-react";
import {
  listBusinessProducts, createProduct, updateProduct, deleteProduct,
  listProductCategories,
  addProductMedia, deleteProductMedia,
} from "@/lib/business.functions";
import { uploadBusinessMedia } from "@/lib/upload";

type ProductCategory = { id: string; name: string; slug: string };

type Product = {
  id: string; name: string; description: string | null; price: number; currency: string;
  image_url: string | null; show_in_shop: boolean; status: string;
  type?: string; short_description?: string | null; sale_price?: number | null;
  sku?: string | null; stock?: number | null; manage_stock?: boolean; tax_rate?: number;
  downloadable?: boolean; download_url?: string | null; download_name?: string | null;
  download_limit?: number | null; download_expiry_days?: number | null;
  access_instructions?: string | null; purchase_note?: string | null;
  product_media?: Array<{ id: string; url: string; type: string }>;
  category_id?: string | null;
  product_categories?: ProductCategory | null;
};

const FIELD = "w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary";

const EMPTY = {
  name: "", description: "", short_description: "", price: "", sale_price: "", currency: "XOF", image_url: "",
  type: "physical", sku: "", stock: "", manage_stock: false, tax_rate: "",
  downloadable: false, download_url: "", download_name: "", download_limit: "", download_expiry_days: "",
  access_instructions: "", purchase_note: "",
  category_id: "", media: [] as string[],
};

export default function ProductsPanel({ businessId, shopSlug }: { businessId: string; shopSlug?: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  async function refresh() {
    try { 
      const [p, c] = await Promise.all([
        listBusinessProducts(businessId),
        listProductCategories(businessId)
      ]);
      setItems(p);
      setCategories(c);
    }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { setLoading(true); refresh(); }, [businessId]);

  async function onUpload(file: File) {
    if (draft.media.length >= 5) {
      toast.error("Maximum 5 images autorisées");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadBusinessMedia(file, "products");
      setDraft((d) => ({ ...d, media: [...d.media, url], image_url: d.image_url || url }));
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  }

  async function onUploadFile(file: File) {
    setUploadingFile(true);
    try {
      const url = await uploadBusinessMedia(file, "downloads");
      setDraft((d) => ({ ...d, download_url: url, download_name: d.download_name || file.name, downloadable: true, type: "digital" }));
      toast.success("Fichier prêt à être livré ✅");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploadingFile(false); }
  }

  function num(v: string) { const n = Number(v); return v.trim() === "" || !Number.isFinite(n) ? null : n; }

  async function onCreate() {
    if (draft.name.trim().length < 2) { toast.error("Nom du produit requis"); return; }
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price <= 0) { toast.error("Prix invalide"); return; }
    setSaving(true);
    try {
      const p = await createProduct({
        business_id: businessId, name: draft.name.trim(),
        description: draft.description || null, short_description: draft.short_description || null,
        price, sale_price: num(draft.sale_price),
        currency: draft.currency, image_url: draft.image_url || draft.media[0] || null, show_in_shop: true,
        type: draft.type, sku: draft.sku || null,
        stock: num(draft.stock), manage_stock: draft.manage_stock,
        tax_rate: num(draft.tax_rate) ?? 0,
        downloadable: draft.downloadable || draft.type === "digital",
        download_url: draft.download_url || null, download_name: draft.download_name || null,
        download_limit: num(draft.download_limit), download_expiry_days: num(draft.download_expiry_days),
        access_instructions: draft.access_instructions || null, purchase_note: draft.purchase_note || null,
        category_id: draft.category_id || null,
      });

      if (draft.media.length > 0) {
        await Promise.all(draft.media.map((url, i) => addProductMedia({
          product_id: p.id, type: "image", url, position: i
        })));
      }

      toast.success("Produit ajouté à la boutique ✅");
      setDraft({ ...EMPTY });
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function onToggle(p: Product) {
    try {
      await updateProduct({ id: p.id, show_in_shop: !p.show_in_shop });
      setItems((prev) => prev.map((x) => x.id === p.id ? { ...x, show_in_shop: !x.show_in_shop } : x));
    } catch (e: any) { toast.error(e.message); }
  }
  async function onDelete(p: Product) {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    try { await deleteProduct(p.id); setItems((prev) => prev.filter((x) => x.id !== p.id)); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 font-[Space_Grotesk] text-xl font-bold">
          <Package className="h-5 w-5" /> Gestion des Produits
        </h3>
        {shopSlug && (
          <a href={`/shop/${shopSlug}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted">
            <ExternalLink className="h-3 w-3" /> Boutique
          </a>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
                <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Nom du produit" className={FIELD} />
                <div className="grid grid-cols-2 gap-2">
                    <input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                        inputMode="numeric" placeholder="Prix" className={FIELD} />
                    <select value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))} className={FIELD}>
                        <option value="XOF">XOF</option>
                        <option value="USD">USD</option>
                    </select>
                </div>
            </div>
            <div className="space-y-4">
                <select value={draft.category_id} onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))} className={FIELD}>
                    <option value="">-- Catégorie --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">
                    Les catégories sont définies par l'administrateur de la plateforme.
                </p>
            </div>
        </div>
        <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={3} placeholder="Description" className={`${FIELD} mt-4`} />
        
        <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={onCreate} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
            </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
              <div className="flex items-start justify-between gap-2">
                 <p className="font-bold truncate">{p.name}</p>
                 <button onClick={() => onDelete(p)} className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                 </button>
              </div>
              <p className="text-sm font-bold mt-2">{Number(p.price).toLocaleString("fr-FR")} {p.currency}</p>
              <button onClick={() => onToggle(p)} className={`mt-3 text-xs font-semibold ${p.show_in_shop ? "text-green-600" : "text-muted-foreground"}`}>
                {p.show_in_shop ? "● Visible" : "○ Masqué"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
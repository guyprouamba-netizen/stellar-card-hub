import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, Plus, Trash2, Eye, EyeOff, Image as ImageIcon, Loader2, ExternalLink, Download, Settings2, FileUp } from "lucide-react";
import {
  listBusinessProducts, createProduct, updateProduct, deleteProduct,
} from "@/lib/business.functions";
import { uploadBusinessMedia } from "@/lib/upload";

type Product = {
  id: string; name: string; description: string | null; price: number; currency: string;
  image_url: string | null; show_in_shop: boolean; status: string;
  type?: string; short_description?: string | null; sale_price?: number | null;
  sku?: string | null; stock?: number | null; manage_stock?: boolean; tax_rate?: number;
  downloadable?: boolean; download_url?: string | null; download_name?: string | null;
  download_limit?: number | null; download_expiry_days?: number | null;
  access_instructions?: string | null; purchase_note?: string | null;
  product_media?: Array<{ url: string; type: string }>;
};

const EMPTY = {
  name: "", description: "", short_description: "", price: "", sale_price: "", currency: "XOF", image_url: "",
  type: "physical", sku: "", stock: "", manage_stock: false, tax_rate: "",
  downloadable: false, download_url: "", download_name: "", download_limit: "", download_expiry_days: "",
  access_instructions: "", purchase_note: "",
};

export default function ProductsPanel({ businessId, shopSlug }: { businessId: string; shopSlug?: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  async function refresh() {
    try { setItems(await listBusinessProducts(businessId)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { setLoading(true); refresh(); /* eslint-disable-next-line */ }, [businessId]);

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadBusinessMedia(file, "products");
      setDraft((d) => ({ ...d, image_url: url }));
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
      await createProduct({
        business_id: businessId, name: draft.name.trim(),
        description: draft.description || null, short_description: draft.short_description || null,
        price, sale_price: num(draft.sale_price),
        currency: draft.currency, image_url: draft.image_url || null, show_in_shop: true,
        type: draft.type, sku: draft.sku || null,
        stock: num(draft.stock), manage_stock: draft.manage_stock,
        tax_rate: num(draft.tax_rate) ?? 0,
        downloadable: draft.downloadable || draft.type === "digital",
        download_url: draft.download_url || null, download_name: draft.download_name || null,
        download_limit: num(draft.download_limit), download_expiry_days: num(draft.download_expiry_days),
        access_instructions: draft.access_instructions || null, purchase_note: draft.purchase_note || null,
      });
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
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 font-[Space_Grotesk] text-xl font-bold">
          <Package className="h-5 w-5" /> Produits de la boutique
        </h3>
        {shopSlug && (
          <a href={`/shop/${shopSlug}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted">
            <ExternalLink className="h-3 w-3" /> Voir la boutique
          </a>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Nouveau produit</p>
        <p className="mt-1 text-xs text-muted-foreground">Les produits créés ici s'affichent directement dans votre boutique. Les projets, eux, servent uniquement à encaisser des paiements sur vos sites via l'API.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Nom du produit"
            className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <div className="flex gap-2">
            <input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
              inputMode="numeric" placeholder="Prix"
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary" />
            <select value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}
              className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary">
              <option value="XOF">XOF</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={2} placeholder="Description (optionnel)"
            className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary sm:col-span-2" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
            Photo du produit
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
          </label>
          {draft.image_url && <img src={draft.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" />}
          <button onClick={onCreate} disabled={saving}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center text-sm text-muted-foreground">
          Aucun produit pour le moment. Ajoutez-en un ci-dessus, il apparaîtra aussitôt dans votre boutique.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const img = p.image_url || p.product_media?.[0]?.url;
            return (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                {img ? <img src={img} alt={p.name} className="h-36 w-full object-cover" />
                  : <div className="grid h-36 w-full place-items-center bg-surface-2"><Package className="h-8 w-8 text-muted-foreground" /></div>}
                <div className="p-4">
                  <p className="truncate font-bold">{p.name}</p>
                  {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                  <p className="mt-2 font-[Space_Grotesk] text-lg font-bold tabular-nums">
                    {Number(p.price).toLocaleString("fr-FR")} <span className="text-xs text-muted-foreground">{p.currency}</span>
                  </p>
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <button onClick={() => onToggle(p)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${p.show_in_shop ? "bg-primary/10 text-primary" : "border border-border text-muted-foreground"}`}>
                      {p.show_in_shop ? <><Eye className="h-3 w-3" /> Visible</> : <><EyeOff className="h-3 w-3" /> Masqué</>}
                    </button>
                    <button onClick={() => onDelete(p)}
                      className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-border text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Eye, EyeOff, FolderTree } from "lucide-react";
import {
  adminListProductCategories, adminUpsertProductCategory, adminDeleteProductCategory,
} from "@/lib/business.functions";

type Cat = { id: string; name: string; slug: string; description: string | null; position: number; is_active: boolean };

const FIELD = "w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary";

export function ProductCategoriesTab() {
  const [items, setItems] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", position: "" });

  async function refresh() {
    try { setItems(await adminListProductCategories()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function onCreate() {
    if (draft.name.trim().length < 2) return toast.error("Nom requis");
    setSaving(true);
    try {
      await adminUpsertProductCategory({
        name: draft.name.trim(),
        description: draft.description || undefined,
        position: Number(draft.position) || 0,
      });
      setDraft({ name: "", description: "", position: "" });
      toast.success("Catégorie créée");
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function toggle(c: Cat) {
    try { await adminUpsertProductCategory({ id: c.id, name: c.name, description: c.description || undefined, position: c.position, is_active: !c.is_active }); refresh(); }
    catch (e: any) { toast.error(e.message); }
  }

  async function remove(c: Cat) {
    if (!confirm(`Supprimer la catégorie "${c.name}" ?`)) return;
    try { await adminDeleteProductCategory(c.id); toast.success("Supprimée"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 text-base font-bold"><FolderTree className="h-4 w-4 text-primary" /> Nouvelle catégorie produit</h3>
        <p className="mt-1 text-xs text-muted-foreground">Seules les catégories créées ici sont visibles par les marchands.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Nom (ex: Électronique)" className={FIELD} />
          <input value={draft.description} onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Description (optionnel)" className={FIELD} />
          <input value={draft.position} onChange={(e) => setDraft(d => ({ ...d, position: e.target.value }))} placeholder="Ordre (0)" className={FIELD} />
        </div>
        <button onClick={onCreate} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="grid place-items-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Aucune catégorie pour le moment.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map(c => (
              <li key={c.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name} <span className="ml-2 text-xs text-muted-foreground">#{c.position}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{c.description || c.slug}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {c.is_active ? "Visible" : "Masquée"}
                </span>
                <button onClick={() => toggle(c)} className="grid h-9 w-9 place-items-center rounded-xl bg-muted hover:bg-border" title="Visibilité">
                  {c.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button onClick={() => remove(c)} className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-destructive hover:bg-border">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

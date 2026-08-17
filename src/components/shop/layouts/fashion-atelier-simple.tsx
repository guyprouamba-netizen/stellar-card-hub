import { CategoryChips, ShopFooter, useFiltered } from "./shared";
import { money, type ShopLayoutProps } from "./types";

/** Famille Mode #1 — Grille 3 colonnes classique, header horizontal simple, aucun héro. */
export default function FashionAtelierSimple({ biz, th, products, categories, activeCategory, setActiveCategory, onSelect }: ShopLayoutProps) {
  const list = useFiltered(products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <header className="border-b" style={{ borderColor: `${th.primary}22` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {biz.logo_url && <img src={biz.logo_url} alt={biz.name} className="h-8 w-8 rounded object-cover" />}
            <span className="text-lg font-semibold tracking-tight">{biz.name}</span>
          </div>
          <nav className="flex gap-6 text-xs uppercase tracking-widest" style={{ color: th.muted }}>
            <a href="#products">Collection</a>
            <a href="#footer">Contact</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10" id="products">
        <CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} className="mb-8" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3">
          {list.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="group text-left">
              <div className="aspect-[3/4] w-full overflow-hidden" style={{ background: th.surface }}>
                {p.media?.[0]?.url && (
                  <img src={p.media[0].url} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                )}
              </div>
              <p className="mt-3 text-sm font-medium">{p.name}</p>
              <p className="mt-1 text-xs uppercase tracking-widest" style={{ color: th.muted }}>Tailles S · M · L · XL</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">{money(p)}</p>
            </button>
          ))}
        </div>
        {!list.length && <p className="py-20 text-center text-sm" style={{ color: th.muted }}>Aucun article disponible.</p>}
      </main>

      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}
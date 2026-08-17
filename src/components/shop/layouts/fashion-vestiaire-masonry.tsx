import { useState } from "react";
import { ShopFooter, useFiltered } from "./shared";
import { money, type ShopLayoutProps } from "./types";

const SIZES = ["XS", "S", "M", "L", "XL"];
const COLORS = ["#111111", "#c1440e", "#1f4e79", "#d4af37", "#f2f2f2"];

/** Famille Mode #3 — Masonry à hauteurs variables + sidebar de filtres collée à gauche. */
export default function FashionVestiaireMasonry({ biz, th, products, categories, activeCategory, setActiveCategory, onSelect }: ShopLayoutProps) {
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const list = useFiltered(products, activeCategory);

  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        <aside className="sticky top-8 hidden h-fit w-60 shrink-0 lg:block">
          <div className="flex items-center gap-3">
            {biz.logo_url && <img src={biz.logo_url} alt={biz.name} className="h-9 w-9 rounded object-cover" />}
            <span className="text-base font-semibold">{biz.name}</span>
          </div>

          <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: th.muted }}>Catégories</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><button onClick={() => setActiveCategory(null)} className={!activeCategory ? "font-semibold" : "opacity-60"}>Tout le vestiaire</button></li>
            {categories.map((c) => (
              <li key={c.id}><button onClick={() => setActiveCategory(c.id)} className={activeCategory === c.id ? "font-semibold" : "opacity-60"}>{c.name}</button></li>
            ))}
          </ul>

          <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: th.muted }}>Taille</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button key={s} onClick={() => setSize(size === s ? null : s)}
                className="h-8 w-9 border text-xs font-semibold"
                style={{ borderColor: size === s ? th.primary : `${th.primary}33`, background: size === s ? th.primary : "transparent", color: size === s ? th.primary_text : th.text }}>
                {s}
              </button>
            ))}
          </div>

          <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: th.muted }}>Couleur</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(color === c ? null : c)} aria-label={c}
                className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: color === c ? th.primary : "transparent" }} />
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1" id="products">
          <div className="columns-2 gap-4 lg:columns-3 [&>*]:mb-4">
            {list.map((p, idx) => (
              <button key={p.id} onClick={() => onSelect(p)} className="group block w-full break-inside-avoid text-left">
                <div className="w-full overflow-hidden" style={{ background: th.surface, aspectRatio: idx % 3 === 0 ? "3/5" : idx % 3 === 1 ? "1/1" : "3/4" }}>
                  {p.media?.[0]?.url && <img src={p.media[0].url} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:opacity-80" />}
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs font-semibold tabular-nums">{money(p)}</p>
                </div>
              </button>
            ))}
          </div>
          {!list.length && <p className="py-20 text-center text-sm" style={{ color: th.muted }}>Aucun article.</p>}
        </main>
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}
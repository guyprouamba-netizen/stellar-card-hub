import { useState } from "react";
import { ShopFooter, ShopHeader, CategoryChips, useFiltered, Img, BuyBtn, Price } from "./shared";
import type { ShopLayoutProps } from "./types";

/** Épicerie #1 — Liste de courses : lignes compactes, achat en un clic. */
export function GroceryList(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} className="mb-6" />
        <ul className="divide-y rounded-2xl" style={{ background: th.surface, borderColor: `${th.primary}22`, border: `1px solid ${th.primary}22` }}>
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-4 p-3" style={{ borderColor: `${th.primary}14` }}>
              <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-14 w-14 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <Price p={p} th={th} className="text-xs" />
              </div>
              <BuyBtn th={th} onClick={() => onSelect(p)} label="+" />
            </li>
          ))}
        </ul>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Épicerie #2 — Rayons : sections empilées par catégorie avec rail horizontal. */
export function GroceryAisles(props: ShopLayoutProps) {
  const { biz, th, categories, onSelect, products } = props;
  const groups = categories.length ? categories.map((c) => ({ c, list: products.filter((p) => p.category_id === c.id) })) : [{ c: { id: "all", name: "Tous les produits" } as any, list: products }];
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="space-y-12 py-10">
        {groups.filter((g) => g.list.length).map((g) => (
          <section key={g.c.id}>
            <h2 className="mx-auto max-w-6xl px-6 text-lg font-bold">{g.c.name}</h2>
            <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto px-6">
              {g.list.map((p) => (
                <button key={p.id} onClick={() => onSelect(p)} className="w-40 flex-shrink-0 rounded-2xl p-3 text-left" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
                  <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-28 w-full rounded-xl object-cover" />
                  <p className="mt-2 truncate text-xs font-semibold">{p.name}</p>
                  <Price p={p} th={th} className="text-xs font-bold" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Épicerie #3 — Panier express : recherche en haut, grille dense 3-4 colonnes. */
export function GroceryBasket(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const [q, setQ] = useState("");
  const items = useFiltered(props.products, props.activeCategory).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} right={
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
          className="w-40 rounded-full px-4 py-2 text-sm outline-none sm:w-64" style={{ background: `${th.primary}12`, color: th.text, border: `1px solid ${th.primary}22` }} />
      } />
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 py-8 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <button key={p.id} onClick={() => onSelect(p)} className="rounded-xl p-2 text-left" style={{ background: th.surface, border: `1px solid ${th.primary}1a` }}>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="aspect-square w-full rounded-lg object-cover" />
            <p className="mt-2 line-clamp-1 text-xs font-semibold">{p.name}</p>
            <Price p={p} th={th} className="text-xs font-bold" />
          </button>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Épicerie #4 — Ardoise du marché : tableau typographique prix du jour. */
export function GroceryBoard(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="center" />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-center text-[11px] uppercase tracking-[0.5em]" style={{ color: th.primary }}>Prix du jour</h1>
        <div className="mt-8 space-y-3">
          {items.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="flex w-full items-baseline gap-3 text-left">
              <span className="text-lg font-semibold">{p.name}</span>
              <span className="flex-1 border-b border-dotted" style={{ borderColor: `${th.primary}44` }} />
              <Price p={p} th={th} className="text-lg font-bold" />
            </button>
          ))}
        </div>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Épicerie #5 — Promos : bannière offre + grille avec étiquettes remise. */
export function GroceryPromo(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl p-8" style={{ background: `linear-gradient(120deg, ${th.primary}, ${th.primary}88)`, color: th.primary_text }}>
          <p className="text-[10px] uppercase tracking-[0.4em] opacity-80">Offres de la semaine</p>
          <h1 className="mt-2 text-3xl font-black">{biz.tagline || "Les meilleurs prix, chaque jour"}</h1>
        </div>
        <CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} className="mt-6" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p, i) => (
            <button key={p.id} onClick={() => onSelect(p)} className="relative overflow-hidden rounded-2xl text-left" style={{ background: th.surface, border: `1px solid ${th.primary}1a` }}>
              {i % 3 === 0 && <span className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: th.primary, color: th.primary_text }}>Promo</span>}
              <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="aspect-[4/3] w-full object-cover" />
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
                <Price p={p} th={th} className="text-sm font-bold" />
              </div>
            </button>
          ))}
        </div>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

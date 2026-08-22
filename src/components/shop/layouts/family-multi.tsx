import { ShopFooter, ShopHeader, CategoryChips, useFiltered, Img, BuyBtn, Price } from "./shared";
import type { ShopLayoutProps } from "./types";

/** Multi #1 — Marketplace : barre de recherche factice, grille dense 4 colonnes. */
export function MultiMarket(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-xl" style={{ background: th.surface, border: `1px solid ${th.primary}18` }}>
              <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="aspect-square w-full object-cover" />
              <div className="p-3">
                <h3 className="line-clamp-2 text-xs font-semibold leading-tight">{p.name}</h3>
                <Price p={p} th={th} className="mt-2 block text-sm font-black" />
                <div className="mt-3"><BuyBtn th={th} onClick={() => onSelect(p)} full /></div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Multi #2 — Rayons : une rangée horizontale par catégorie. */
export function MultiRayons(props: ShopLayoutProps) {
  const { biz, th, categories, onSelect, products } = props;
  const groups = categories.length
    ? categories.map((c) => ({ title: c.name, list: products.filter((p) => p.category_id === c.id) })).filter((g) => g.list.length)
    : [{ title: "Tous les produits", list: products }];
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="space-y-12 py-10">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mx-auto max-w-7xl px-6 text-lg font-bold tracking-tight">{g.title}</h2>
            <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto px-6">
              {g.list.map((p) => (
                <article key={p.id} className="w-[180px] flex-shrink-0 overflow-hidden rounded-2xl" style={{ background: th.surface, border: `1px solid ${th.primary}18` }}>
                  <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[160px] w-full object-cover" />
                  <div className="p-3">
                    <h3 className="line-clamp-1 text-xs font-semibold">{p.name}</h3>
                    <Price p={p} th={th} className="mt-1 block text-sm font-bold" />
                    <div className="mt-3"><BuyBtn th={th} onClick={() => onSelect(p)} full /></div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Multi #3 — Bons plans : bandeau promo + grille avec badges. */
export function MultiDeals(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="px-6 py-3 text-center text-[11px] font-black uppercase tracking-widest" style={{ background: th.primary, color: th.primary_text }}>
        Offres du moment — livraison rapide
      </div>
      <div className="mx-auto grid max-w-6xl gap-4 px-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p, i) => (
          <article key={p.id} className="relative overflow-hidden rounded-2xl" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
            {i % 3 === 0 && <span className="absolute left-3 top-3 z-10 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest" style={{ background: th.primary, color: th.primary_text }}>Top vente</span>}
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[200px] w-full object-cover" />
            <div className="p-4">
              <h3 className="line-clamp-1 text-sm font-bold">{p.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs" style={{ color: th.muted }}>{p.description || ""}</p>
              <div className="mt-4 flex items-center justify-between">
                <Price p={p} th={th} className="text-base font-black" />
                <BuyBtn th={th} onClick={() => onSelect(p)} />
              </div>
            </div>
          </article>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Multi #4 — Mega store : sidebar catégories + grille. */
export function MultiMega(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        <aside className="hidden w-52 flex-shrink-0 md:block">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: th.muted }}>Catégories</p>
          <nav className="mt-4 space-y-1">
            <button onClick={() => setActiveCategory(null)} className="block w-full rounded-lg px-3 py-2 text-left text-sm" style={{ background: !activeCategory ? `${th.primary}1a` : "transparent" }}>Tous</button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm" style={{ background: activeCategory === c.id ? `${th.primary}1a` : "transparent" }}>{c.name}</button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="md:hidden"><CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} /></div>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {items.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-2xl" style={{ background: th.surface, border: `1px solid ${th.primary}18` }}>
                <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="aspect-square w-full object-cover" />
                <div className="p-3">
                  <h3 className="line-clamp-1 text-xs font-semibold">{p.name}</h3>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Price p={p} th={th} className="text-sm font-bold" />
                    <BuyBtn th={th} onClick={() => onSelect(p)} label="Voir" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Multi #5 — Carrousel vitrine : grand visuel + miniatures cliquables. */
export function MultiCarousel(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Sélection de la boutique</h1>
        <div className="no-scrollbar mt-6 flex snap-x gap-6 overflow-x-auto pb-6">
          {items.map((p) => (
            <article key={p.id} className="w-[85vw] max-w-[420px] flex-shrink-0 snap-center overflow-hidden rounded-3xl" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
              <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[300px] w-full object-cover" />
              <div className="p-6">
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm" style={{ color: th.muted }}>{p.description || ""}</p>
                <div className="mt-5 flex items-center justify-between">
                  <Price p={p} th={th} className="text-lg font-black" />
                  <BuyBtn th={th} onClick={() => onSelect(p)} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

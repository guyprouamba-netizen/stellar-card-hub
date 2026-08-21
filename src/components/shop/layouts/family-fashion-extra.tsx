import { ShopFooter, ShopHeader, CategoryChips, useFiltered, Img, BuyBtn, Price } from "./shared";
import type { ShopLayoutProps } from "./types";

/** Mode #4 — Rayon suspendu : défilement horizontal type portant. */
export function FashionRayonSuspendu(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Le portant</h1>
        <p className="mt-2 text-sm" style={{ color: th.muted }}>Faites défiler horizontalement pour parcourir la collection.</p>
        <CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} className="mt-6" />
      </div>
      <div className="no-scrollbar flex gap-6 overflow-x-auto px-6 pb-16">
        {items.map((p) => (
          <article key={p.id} className="w-[300px] flex-shrink-0 rounded-3xl p-4" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
            <div className="mx-auto h-6 w-px" style={{ background: `${th.primary}55` }} />
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[360px] w-full rounded-2xl object-cover" />
            <h3 className="mt-4 text-base font-semibold">{p.name}</h3>
            <div className="mt-1 flex items-center justify-between">
              <Price p={p} th={th} className="text-sm font-bold" />
              <BuyBtn th={th} onClick={() => onSelect(p)} label="Voir" />
            </div>
          </article>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Mode #5 — Magazine : blocs éditoriaux alternés, produits insérés dans les articles. */
export function FashionMagazine(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="center" />
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: th.primary }}>Édition {new Date().getFullYear()}</p>
        <h1 className="mt-4 text-5xl font-black leading-[0.95] tracking-tight">{biz.tagline || biz.name}</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed" style={{ color: th.muted }}>{biz.description || "Le magazine de la maison : histoires, silhouettes et pièces à s'offrir."}</p>
      </section>
      <div className="mx-auto max-w-5xl space-y-20 px-6 pb-24">
        {items.map((p, i) => (
          <article key={p.id} className={`flex flex-col items-center gap-8 md:flex-row ${i % 2 ? "md:flex-row-reverse" : ""}`}>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[420px] w-full flex-1 object-cover md:w-1/2" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.35em]" style={{ color: th.primary }}>Chapitre {String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight">{p.name}</h2>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: th.muted }}>{p.description || "Une pièce pensée pour durer, façonnée avec soin."}</p>
              <div className="mt-6 flex items-center gap-4">
                <Price p={p} th={th} className="text-lg font-bold" />
                <BuyBtn th={th} onClick={() => onSelect(p)} />
              </div>
            </div>
          </article>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

import { useState } from "react";
import { ShopFooter, ShopHeader, CategoryChips, useFiltered, Img, BuyBtn, Price } from "./shared";
import type { ShopLayoutProps } from "./types";

/** Tech #1 — Fiche technique : specs listées sous chaque produit. */
export function TechSpec(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        {items.map((p) => (
          <article key={p.id} className="grid gap-6 rounded-2xl p-6 md:grid-cols-[220px_1fr_auto]" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-40 w-full rounded-xl object-cover" />
            <div>
              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed" style={{ color: th.muted }}>{p.description || "Spécifications sur demande."}</p>
            </div>
            <div className="flex flex-col items-start justify-between gap-3 md:items-end">
              <Price p={p} th={th} className="text-xl font-bold" />
              <BuyBtn th={th} onClick={() => onSelect(p)} />
            </div>
          </article>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Tech #2 — Comparateur : tableau de comparaison scrollable. */
export function TechCompare(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold">Comparer les modèles</h1>
        <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid ${th.primary}22` }}>
          <table className="w-full text-left text-sm">
            <thead style={{ background: `${th.primary}12` }}>
              <tr><th className="p-3">Produit</th><th className="p-3">Description</th><th className="p-3">Prix</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${th.primary}14` }}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-10 w-10 rounded-md object-cover" />
                      <span className="font-semibold">{p.name}</span>
                    </div>
                  </td>
                  <td className="max-w-[320px] p-3 text-xs" style={{ color: th.muted }}>{p.description?.slice(0, 120)}</td>
                  <td className="p-3"><Price p={p} th={th} className="font-bold" /></td>
                  <td className="p-3"><BuyBtn th={th} onClick={() => onSelect(p)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Tech #3 — Grille sombre néon : cartes bordées lumineuses. */
export function TechNeon(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} right={<CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} />} />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <button key={p.id} onClick={() => onSelect(p)} className="group relative overflow-hidden rounded-2xl p-5 text-left transition-shadow"
            style={{ background: th.surface, border: `1px solid ${th.primary}55`, boxShadow: `0 0 0 0 ${th.primary}` }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 24px -4px ${th.primary}`)}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 0 0 0 ${th.primary}`)}>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-44 w-full rounded-xl object-cover" />
            <p className="mt-4 font-mono text-xs uppercase tracking-widest" style={{ color: th.primary }}>{p.currency}</p>
            <h3 className="mt-1 text-lg font-bold">{p.name}</h3>
            <Price p={p} th={th} className="mt-2 block font-mono text-lg" />
          </button>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Tech #4 — Lancement : un produit vedette plein écran, le reste en bandeau. */
export function TechLaunch(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  const hero = items[0];
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      {hero && (
        <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
          <Img th={th} src={hero.media?.[0]?.url} alt={hero.name} className="h-[340px] w-full max-w-2xl rounded-3xl object-cover" />
          <h1 className="mt-8 text-5xl font-black tracking-tight">{hero.name}</h1>
          <p className="mt-4 max-w-xl text-sm" style={{ color: th.muted }}>{hero.description || "Nouvelle génération, disponible maintenant."}</p>
          <div className="mt-6 flex items-center gap-4"><Price p={hero} th={th} className="text-2xl font-bold" /><BuyBtn th={th} onClick={() => onSelect(hero)} label="Précommander" /></div>
        </section>
      )}
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-6 pb-16">
        {items.slice(1).map((p) => (
          <button key={p.id} onClick={() => onSelect(p)} className="w-56 flex-shrink-0 rounded-2xl p-4 text-left" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-32 w-full rounded-xl object-cover" />
            <p className="mt-3 truncate text-sm font-semibold">{p.name}</p>
            <Price p={p} th={th} className="text-sm font-bold" />
          </button>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Tech #5 — Modulaire : bento asymétrique avec tuiles de tailles différentes. */
export function TechBento(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  const span = (i: number) => (i % 6 === 0 ? "sm:col-span-2 sm:row-span-2" : i % 5 === 0 ? "sm:col-span-2" : "");
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto grid max-w-6xl auto-rows-[180px] grid-cols-2 gap-3 px-4 py-10 sm:grid-cols-4">
        {items.map((p, i) => (
          <button key={p.id} onClick={() => onSelect(p)} className={`group relative overflow-hidden rounded-3xl text-left ${span(i)}`} style={{ background: th.surface, border: `1px solid ${th.primary}1a` }}>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
              <p className="line-clamp-1 text-sm font-bold">{p.name}</p>
              <p className="text-xs opacity-80">{Number(p.price).toLocaleString("fr-FR")} {p.currency}</p>
            </div>
          </button>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Petit hook utilitaire local (évite un import inutilisé). */
export function useNoop() { return useState(0); }

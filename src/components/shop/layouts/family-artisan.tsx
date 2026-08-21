import { useState } from "react";
import { ShopFooter, ShopHeader, CategoryChips, useFiltered, Img, BuyBtn, Price } from "./shared";
import type { ShopLayoutProps } from "./types";

/** Artisanat #1 — Vitrine carnet : fiches façon fiche produit papier, 2 colonnes. */
export function ArtisanCarnet(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="minimal" />
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 md:grid-cols-2">
        {items.map((p) => (
          <article key={p.id} className="flex gap-5 border-b pb-8" style={{ borderColor: `${th.primary}22` }}>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-32 w-32 flex-shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 line-clamp-3 text-sm" style={{ color: th.muted }}>{p.description || "Pièce artisanale unique."}</p>
              <div className="mt-3 flex items-center gap-3">
                <Price p={p} th={th} className="font-bold" />
                <BuyBtn th={th} onClick={() => onSelect(p)} label="Commander" />
              </div>
            </div>
          </article>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Artisanat #2 — Story : long récit vertical, un savoir-faire par section. */
export function ArtisanStory(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <section className="relative flex h-[70vh] items-end px-6 pb-12" style={{ background: `linear-gradient(160deg, ${th.primary}33, ${th.bg})` }}>
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: th.primary }}>Savoir-faire</p>
          <h1 className="mt-3 max-w-2xl text-5xl font-black leading-[0.95]">{biz.name}</h1>
        </div>
      </section>
      {items.map((p, i) => (
        <section key={p.id} className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16" style={{ borderTop: i ? `1px solid ${th.primary}1a` : undefined }}>
          <span className="text-[10px] uppercase tracking-[0.35em]" style={{ color: th.muted }}>Étape {i + 1}</span>
          <h2 className="text-3xl font-bold">{p.name}</h2>
          <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[300px] w-full rounded-2xl object-cover" />
          <p className="text-sm leading-relaxed" style={{ color: th.muted }}>{p.description || "Fabriqué à la main, en petite série."}</p>
          <div className="flex items-center gap-4"><Price p={p} th={th} className="text-lg font-bold" /><BuyBtn th={th} onClick={() => onSelect(p)} /></div>
        </section>
      ))}
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Artisanat #3 — Mosaïque : grille dense carrée avec survol légende. */
export function ArtisanMosaic(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} right={<CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} />} />
      <div className="grid grid-cols-2 gap-1 p-1 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <button key={p.id} onClick={() => onSelect(p)} className="group relative aspect-square overflow-hidden">
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-3 text-left text-white opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-xs font-semibold">{p.name}</p>
              <p className="text-[11px] opacity-80">{Number(p.price).toLocaleString("fr-FR")} {p.currency}</p>
            </div>
          </button>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Artisanat #4 — Marché : cartes larges avec badge "fait main" et compteur stock. */
export function ArtisanMarket(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-12">
        {items.map((p) => (
          <article key={p.id} className="flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-40 w-full rounded-xl object-cover sm:h-24 sm:w-32" />
            <div className="flex-1">
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: `${th.primary}22`, color: th.primary }}>Fait main</span>
              <h3 className="mt-2 font-semibold">{p.name}</h3>
              <p className="line-clamp-2 text-sm" style={{ color: th.muted }}>{p.description}</p>
            </div>
            <div className="flex items-center gap-3"><Price p={p} th={th} className="font-bold" /><BuyBtn th={th} onClick={() => onSelect(p)} /></div>
          </article>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Artisanat #5 — Catalogue : sommaire cliquable à gauche, fiche détaillée à droite. */
export function ArtisanCatalogue(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  const [i, setI] = useState(0);
  const p = items[Math.min(i, Math.max(items.length - 1, 0))];
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="minimal" />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-[240px_1fr]">
        <nav className="space-y-1">
          {items.map((it, idx) => (
            <button key={it.id} onClick={() => setI(idx)} className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors"
              style={{ background: idx === i ? `${th.primary}1f` : "transparent", color: idx === i ? th.primary : th.muted }}>
              {String(idx + 1).padStart(2, "0")}. {it.name}
            </button>
          ))}
        </nav>
        {p && (
          <div>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[420px] w-full rounded-2xl object-cover" />
            <h2 className="mt-6 text-3xl font-bold">{p.name}</h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: th.muted }}>{p.description}</p>
            <div className="mt-6 flex items-center gap-4"><Price p={p} th={th} className="text-xl font-bold" /><BuyBtn th={th} onClick={() => onSelect(p)} /></div>
          </div>
        )}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

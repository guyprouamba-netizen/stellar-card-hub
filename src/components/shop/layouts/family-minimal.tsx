import { ShopFooter, ShopHeader, CategoryChips, useFiltered, Img, BuyBtn, Price } from "./shared";
import type { ShopLayoutProps } from "./types";

/** Minimal #1 — Liste texte : aucune image, typographie seule. */
export function MinimalListe(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="minimal" />
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-xs uppercase tracking-[0.5em]" style={{ color: th.muted }}>Catalogue</h1>
        <ul className="mt-10">
          {items.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-6 py-5" style={{ borderBottom: `1px solid ${th.primary}18` }}>
              <button onClick={() => onSelect(p)} className="text-left text-base hover:underline">{p.name}</button>
              <span className="flex items-baseline gap-4">
                <Price p={p} th={th} className="text-sm" />
                <button onClick={() => onSelect(p)} className="text-[10px] uppercase tracking-widest" style={{ color: th.primary }}>Acheter</button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Minimal #2 — Cartes blanches : grille aérée, beaucoup d'espace. */
export function MinimalCartes(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} />
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <article key={p.id}>
              <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="aspect-[4/5] w-full rounded-xl object-cover" />
              <h3 className="mt-4 text-sm font-medium">{p.name}</h3>
              <Price p={p} th={th} className="mt-1 block text-sm opacity-70" />
              <button onClick={() => onSelect(p)} className="mt-4 text-[10px] uppercase tracking-[0.3em] hover:opacity-60" style={{ color: th.primary }}>Acheter →</button>
            </article>
          ))}
        </div>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Minimal #3 — Monochrome : nuances de gris, accents rares. */
export function MinimalMono(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  const mono = { ...th, bg: "#ffffff", surface: "#f4f4f5", text: "#111113", muted: "#71717a", primary: "#111113", primary_text: "#ffffff" };
  return (
    <div className="min-h-screen" style={{ background: mono.bg, color: mono.text }}>
      <ShopHeader biz={biz} th={mono} variant="minimal" />
      <div className="mx-auto max-w-4xl px-6 py-20">
        <h1 className="text-5xl font-light tracking-tighter">{biz.name}</h1>
        <div className="mt-16 grid gap-px sm:grid-cols-2" style={{ background: "#e4e4e7" }}>
          {items.map((p) => (
            <article key={p.id} className="p-8" style={{ background: mono.bg }}>
              <Img th={mono} src={p.media?.[0]?.url} alt={p.name} className="aspect-square w-full object-cover grayscale" />
              <h3 className="mt-6 text-sm font-medium uppercase tracking-widest">{p.name}</h3>
              <div className="mt-3 flex items-center justify-between">
                <Price p={p} th={mono} className="text-sm" />
                <BuyBtn th={mono} onClick={() => onSelect(p)} />
              </div>
            </article>
          ))}
        </div>
      </div>
      <ShopFooter biz={biz} th={mono} compact />
    </div>
  );
}

/** Minimal #4 — Index numéroté : tableau sobre avec numérotation. */
export function MinimalIndex(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="minimal" />
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-[10px] uppercase tracking-[0.5em]" style={{ color: th.muted }}>Index</p>
        <div className="mt-10">
          {items.map((p, i) => (
            <button key={p.id} onClick={() => onSelect(p)} className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-6 py-4 text-left" style={{ borderBottom: `1px solid ${th.primary}14` }}>
              <span className="text-[10px] tabular-nums opacity-40">{String(i + 1).padStart(2, "0")}</span>
              <span className="truncate text-base group-hover:translate-x-1 transition-transform">{p.name}</span>
              <Price p={p} th={th} className="text-xs opacity-70" />
            </button>
          ))}
        </div>
      </div>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Minimal #5 — Focus : un seul produit à la fois, navigation verticale plein écran. */
export function MinimalFocus(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="minimal" />
      {items.map((p) => (
        <section key={p.id} className="mx-auto flex min-h-[80vh] max-w-4xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
          <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[380px] w-full max-w-md rounded-2xl object-cover" />
          <div>
            <h2 className="text-2xl font-light tracking-tight">{p.name}</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: th.muted }}>{p.description || ""}</p>
            <div className="mt-6 flex items-center justify-center gap-6">
              <Price p={p} th={th} className="text-base" />
              <BuyBtn th={th} onClick={() => onSelect(p)} />
            </div>
          </div>
        </section>
      ))}
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

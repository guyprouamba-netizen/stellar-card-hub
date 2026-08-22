import { ShopFooter, ShopHeader, CategoryChips, useFiltered, Img, BuyBtn, Price } from "./shared";
import type { ShopLayoutProps } from "./types";

/** Luxe #1 — Vitrine : une pièce mise en avant, le reste en frise discrète. */
export function LuxeVitrine(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  const hero = items[0];
  const rest = items.slice(1);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="minimal" />
      {hero && (
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2">
          <Img th={th} src={hero.media?.[0]?.url} alt={hero.name} className="h-[520px] w-full object-cover" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.5em]" style={{ color: th.primary }}>Pièce d'exception</p>
            <h1 className="mt-5 text-4xl font-light leading-tight">{hero.name}</h1>
            <p className="mt-5 text-sm leading-loose" style={{ color: th.muted }}>{hero.description || biz.description || ""}</p>
            <div className="mt-8 flex items-center gap-6">
              <Price p={hero} th={th} className="text-xl" />
              <BuyBtn th={th} onClick={() => onSelect(hero)} label="Commander" />
            </div>
          </div>
        </section>
      )}
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-6 pb-24">
        {rest.map((p) => (
          <button key={p.id} onClick={() => onSelect(p)} className="w-[220px] flex-shrink-0 text-left">
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[280px] w-full object-cover" />
            <p className="mt-3 text-xs uppercase tracking-[0.2em]">{p.name}</p>
            <Price p={p} th={th} className="text-xs opacity-70" />
          </button>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Luxe #2 — Noir absolu : fond sombre imposé, typographie fine, grille 2 colonnes. */
export function LuxeNoir(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  const dark = { ...th, bg: "#08070a", surface: "#111013", text: "#f4f1ea", muted: "#8a8579" };
  return (
    <div className="min-h-screen" style={{ background: dark.bg, color: dark.text }}>
      <ShopHeader biz={biz} th={dark} variant="center" />
      <section className="px-6 py-24 text-center">
        <h1 className="text-[13vw] font-light leading-none tracking-[-0.04em] md:text-[7vw]">{biz.name}</h1>
        <p className="mx-auto mt-6 max-w-md text-xs uppercase tracking-[0.4em]" style={{ color: dark.muted }}>{biz.tagline || "Maison"}</p>
      </section>
      <div className="mx-auto grid max-w-5xl gap-px px-6 pb-24 sm:grid-cols-2" style={{ background: `${dark.primary}18` }}>
        {items.map((p) => (
          <article key={p.id} className="p-8" style={{ background: dark.bg }}>
            <Img th={dark} src={p.media?.[0]?.url} alt={p.name} className="h-[420px] w-full object-cover" />
            <h3 className="mt-6 text-lg font-light tracking-wide">{p.name}</h3>
            <div className="mt-3 flex items-center justify-between">
              <Price p={p} th={dark} className="text-sm" />
              <BuyBtn th={dark} onClick={() => onSelect(p)} label="Acquérir" />
            </div>
          </article>
        ))}
      </div>
      <ShopFooter biz={biz} th={dark} />
    </div>
  );
}

/** Luxe #3 — Écrin : chaque produit dans un cadre doré centré, une par ligne. */
export function LuxeEcrin(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="text-3xl font-light tracking-[0.2em] uppercase">Écrin</h1>
        <CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} className="mt-6 justify-center" />
      </div>
      <div className="mx-auto max-w-3xl space-y-14 px-6 pb-24">
        {items.map((p) => (
          <article key={p.id} className="p-6 text-center" style={{ border: `1px solid ${th.primary}55`, boxShadow: `0 0 0 6px ${th.bg}, 0 0 0 7px ${th.primary}22` }}>
            <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="mx-auto h-[380px] w-full object-cover" />
            <h3 className="mt-6 text-xl font-light tracking-widest uppercase">{p.name}</h3>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed" style={{ color: th.muted }}>{p.description || ""}</p>
            <div className="mt-6 flex items-center justify-center gap-6">
              <Price p={p} th={th} className="text-base" />
              <BuyBtn th={th} onClick={() => onSelect(p)} />
            </div>
          </article>
        ))}
      </div>
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Luxe #4 — Défilé : plein écran vertical, une pièce par section. */
export function LuxeDefile(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="minimal" />
      {items.map((p, i) => (
        <section key={p.id} className="relative flex min-h-[85vh] items-end">
          <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="absolute inset-0 h-full w-full object-cover opacity-70" />
          <div className="relative z-10 w-full bg-gradient-to-t from-black/80 to-transparent p-8 sm:p-16">
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/70">Look {String(i + 1).padStart(2, "0")}</p>
            <h2 className="mt-3 text-4xl font-light text-white sm:text-6xl">{p.name}</h2>
            <div className="mt-6 flex items-center gap-6">
              <span className="text-lg text-white">{Number(p.price).toLocaleString("fr-FR")} {p.currency}</span>
              <BuyBtn th={th} onClick={() => onSelect(p)} label="Commander" />
            </div>
          </div>
        </section>
      ))}
      <ShopFooter biz={biz} th={th} />
    </div>
  );
}

/** Luxe #5 — Galerie d'art : cartels muséographiques, images encadrées de blanc. */
export function LuxeGalerie(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: "#faf8f4", color: "#16150f" }}>
      <ShopHeader biz={biz} th={{ ...th, bg: "#faf8f4", text: "#16150f" }} variant="center" />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-center text-xs uppercase tracking-[0.6em]">Collection permanente</h1>
        <div className="mt-16 grid gap-16 sm:grid-cols-2">
          {items.map((p, i) => (
            <figure key={p.id}>
              <div className="bg-white p-6 shadow-[0_2px_30px_rgba(0,0,0,0.08)]">
                <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[340px] w-full object-cover" />
              </div>
              <figcaption className="mt-5 border-l-2 pl-4" style={{ borderColor: th.primary }}>
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-50">N° {String(i + 1).padStart(3, "0")}</p>
                <h3 className="mt-1 text-base font-semibold">{p.name}</h3>
                <p className="mt-2 text-xs leading-relaxed opacity-70">{p.description || "Pièce unique."}</p>
                <div className="mt-4 flex items-center gap-4">
                  <span className="text-sm font-bold tabular-nums">{Number(p.price).toLocaleString("fr-FR")} {p.currency}</span>
                  <BuyBtn th={th} onClick={() => onSelect(p)} label="Acquérir" />
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <ShopFooter biz={biz} th={{ ...th, bg: "#faf8f4", text: "#16150f" }} />
    </div>
  );
}

import { ShopFooter, ShopHeader, CategoryChips, useFiltered, Img, BuyBtn, Price } from "./shared";
import type { ShopLayoutProps } from "./types";

/** Services #1 — Liste de prestations : lignes détaillées, pas de grille produit. */
export function ServicePrestations(props: ShopLayoutProps) {
  const { biz, th, categories, activeCategory, setActiveCategory, onSelect } = props;
  const items = useFiltered(props.products, activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <section className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight">Nos prestations</h1>
        <p className="mt-2 text-sm" style={{ color: th.muted }}>{biz.description || "Choisissez la prestation adaptée à votre besoin."}</p>
        <CategoryChips categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} th={th} className="mt-6" />
        <div className="mt-10 divide-y" style={{ borderColor: `${th.primary}22` }}>
          {items.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: `1px solid ${th.primary}18` }}>
              <div className="min-w-0">
                <h3 className="text-base font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm" style={{ color: th.muted }}>{p.description || "Prestation sur mesure."}</p>
              </div>
              <div className="flex items-center gap-4">
                <Price p={p} th={th} className="text-sm font-bold" />
                <BuyBtn th={th} onClick={() => onSelect(p)} label="Réserver" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Services #2 — Prise de rendez-vous : cartes créneaux avec pictos horaires. */
export function ServiceRdv(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight">Prenez rendez-vous</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <article key={p.id} className="rounded-2xl p-5" style={{ background: th.surface, border: `1px solid ${th.primary}22` }}>
              <div className="flex items-center justify-between">
                <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ background: `${th.primary}1a`, color: th.primary }}>Disponible</span>
                <Price p={p} th={th} className="text-sm font-bold" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{p.name}</h3>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: th.muted }}>{p.description || "Séance individuelle."}</p>
              <BuyBtn th={th} onClick={() => onSelect(p)} label="Réserver un créneau" full />
            </article>
          ))}
        </div>
      </section>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Services #3 — Grille tarifaire : colonnes de forfaits comparés. */
export function ServiceTarifs(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} variant="center" />
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h1 className="text-4xl font-black tracking-tight">Nos formules</h1>
        <p className="mt-3 text-sm" style={{ color: th.muted }}>Tarifs clairs, sans engagement.</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((p, i) => (
            <article key={p.id} className="flex flex-col rounded-3xl p-8 text-left" style={{ background: th.surface, border: `2px solid ${i === 1 ? th.primary : `${th.primary}22`}` }}>
              {i === 1 && <span className="mb-4 self-start rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ background: th.primary, color: th.primary_text }}>Populaire</span>}
              <h3 className="text-lg font-bold">{p.name}</h3>
              <Price p={p} th={th} className="mt-4 block text-3xl font-black" />
              <p className="mt-4 flex-1 text-sm leading-relaxed" style={{ color: th.muted }}>{p.description || "Formule complète."}</p>
              <div className="mt-8"><BuyBtn th={th} onClick={() => onSelect(p)} label="Choisir" full /></div>
            </article>
          ))}
        </div>
      </section>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Services #4 — Portfolio : réalisations en grande image, prestation en overlay. */
export function ServicePortfolio(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight">Réalisations</h1>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {items.map((p) => (
            <article key={p.id} className="group relative overflow-hidden rounded-3xl">
              <Img th={th} src={p.media?.[0]?.url} alt={p.name} className="h-[320px] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-6">
                <h3 className="text-lg font-bold text-white">{p.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-white/70">{p.description || ""}</p>
                <div className="mt-4 flex items-center gap-4">
                  <span className="text-sm font-bold text-white">{Number(p.price).toLocaleString("fr-FR")} {p.currency}</span>
                  <BuyBtn th={th} onClick={() => onSelect(p)} label="Demander" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

/** Services #5 — Consultation : parcours en étapes numérotées. */
export function ServiceConsultation(props: ShopLayoutProps) {
  const { biz, th, onSelect } = props;
  const items = useFiltered(props.products, props.activeCategory);
  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text }}>
      <ShopHeader biz={biz} th={th} />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Comment ça marche</h1>
        <p className="mt-2 text-sm" style={{ color: th.muted }}>Sélectionnez l'accompagnement qui vous convient.</p>
        <ol className="mt-12 space-y-8">
          {items.map((p, i) => (
            <li key={p.id} className="flex gap-5">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-sm font-black" style={{ background: th.primary, color: th.primary_text }}>{i + 1}</span>
              <div className="flex-1 rounded-2xl p-5" style={{ background: th.surface, border: `1px solid ${th.primary}18` }}>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  <Price p={p} th={th} className="text-sm font-bold" />
                </div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: th.muted }}>{p.description || "Accompagnement personnalisé."}</p>
                <div className="mt-4"><BuyBtn th={th} onClick={() => onSelect(p)} label="Démarrer" /></div>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { ShopFooter } from "./shared";
import { money, type ShopLayoutProps } from "./types";

/** Famille Mode #2 — Carrousel plein écran vertical: un look par écran, pastilles latérales. */
export default function FashionLookbook({ biz, th, products, onSelect }: ShopLayoutProps) {
  const [i, setI] = useState(0);
  const looks = products;
  if (!looks.length) return <div className="grid min-h-screen place-items-center" style={{ background: th.bg, color: th.muted }}>Aucun look publié.</div>;
  const p = looks[Math.min(i, looks.length - 1)];

  return (
    <div style={{ background: th.bg, color: th.text }}>
      <section className="relative h-screen w-full overflow-hidden">
        {p.media?.[0]?.url && (
          <motion.img key={p.id} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}
            src={p.media[0].url} alt={p.name} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.15) 55%, rgba(0,0,0,.6) 100%)" }} />

        <div className="absolute left-0 top-0 flex w-full items-center justify-between px-6 py-6 text-white">
          <span className="text-sm font-semibold uppercase tracking-[0.3em]">{biz.name}</span>
          <span className="text-[10px] uppercase tracking-[0.3em] opacity-70">Lookbook</span>
        </div>

        <div className="absolute right-6 top-1/2 flex -translate-y-1/2 flex-col gap-3">
          {looks.map((l, idx) => (
            <button key={l.id} onClick={() => setI(idx)} aria-label={l.name}
              className="h-2.5 w-2.5 rounded-full transition-all"
              style={{ background: idx === i ? th.primary : "rgba(255,255,255,.45)", transform: idx === i ? "scale(1.5)" : undefined }} />
          ))}
        </div>

        <div className="absolute bottom-0 left-0 w-full p-8 sm:p-16 text-white">
          <p className="text-[10px] uppercase tracking-[0.4em] opacity-70">Look {i + 1} / {looks.length}</p>
          <h2 className="mt-3 max-w-xl text-4xl font-light leading-tight sm:text-6xl">{p.name}</h2>
          <p className="mt-4 max-w-md text-sm opacity-80">{p.description}</p>
          <div className="mt-6 flex items-center gap-4">
            <button onClick={() => onSelect(p)} className="rounded-full px-7 py-3 text-xs font-bold uppercase tracking-widest"
              style={{ background: th.primary, color: th.primary_text }}>
              Acheter ce look · {money(p)}
            </button>
            <button onClick={() => setI((i + 1) % looks.length)} className="rounded-full border border-white/40 px-6 py-3 text-xs uppercase tracking-widest">
              Look suivant
            </button>
          </div>
        </div>
      </section>

      <ShopFooter biz={biz} th={th} compact />
    </div>
  );
}
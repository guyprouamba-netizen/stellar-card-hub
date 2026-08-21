import { Mail, Phone, ShieldCheck } from "lucide-react";
import type { ShopTheme } from "./types";

export function ShopFooter({ biz, th, compact = false }: { biz: any; th: ShopTheme; compact?: boolean }) {
  return (
    <footer id="footer" className={compact ? "mt-20 px-6 py-10" : "mt-32 px-6 py-16"} style={{ borderTop: `1px solid ${th.primary}22` }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="text-lg font-bold">{biz.name}</p>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: th.muted }}>
            {biz.description || biz.tagline || ""}
          </p>
        </div>
        <div className="space-y-3 text-sm">
          {biz.contact_email && (
            <a href={`mailto:${biz.contact_email}`} className="flex items-center gap-2 hover:opacity-70">
              <Mail className="h-4 w-4 opacity-50" /> {biz.contact_email}
            </a>
          )}
          {biz.contact_phone && (
            <a href={`tel:${biz.contact_phone}`} className="flex items-center gap-2 hover:opacity-70">
              <Phone className="h-4 w-4 opacity-50" /> {biz.contact_phone}
            </a>
          )}
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: th.muted }}>
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Paiements sécurisés
          </div>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-[10px] uppercase tracking-widest" style={{ color: th.muted }}>
        © {new Date().getFullYear()} {biz.name}
      </p>
    </footer>
  );
}

export function CategoryChips({
  categories, activeCategory, setActiveCategory, th, className = "",
}: {
  categories: { id: string; name: string }[];
  activeCategory: string | null;
  setActiveCategory: (id: string | null) => void;
  th: ShopTheme;
  className?: string;
}) {
  if (!categories.length) return null;
  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${active ? "shadow" : "opacity-60 hover:opacity-100"}`;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        onClick={() => setActiveCategory(null)}
        className={chip(!activeCategory)}
        style={{ background: !activeCategory ? th.primary : `${th.primary}14`, color: !activeCategory ? th.primary_text : th.text }}
      >
        Tous
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => setActiveCategory(c.id)}
          className={chip(activeCategory === c.id)}
          style={{ background: activeCategory === c.id ? th.primary : `${th.primary}14`, color: activeCategory === c.id ? th.primary_text : th.text }}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

export function useFiltered(products: any[], activeCategory: string | null) {
  return activeCategory ? products.filter((p) => p.category_id === activeCategory) : products;
}
export function ShopHeader({ biz, th, right, variant = "bar" }: { biz: any; th: ShopTheme; right?: React.ReactNode; variant?: "bar" | "center" | "minimal" }) {
  return (
    <header
      className={`sticky top-0 z-30 w-full backdrop-blur ${variant === "center" ? "py-5 text-center" : "py-4"}`}
      style={{ background: `${th.bg}e6`, borderBottom: `1px solid ${th.primary}1f` }}
    >
      <div className={`mx-auto flex max-w-6xl items-center gap-4 px-6 ${variant === "center" ? "flex-col" : "justify-between"}`}>
        <div className="flex items-center gap-3">
          {biz.logo_url ? (
            <img src={biz.logo_url} alt={biz.name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold" style={{ background: th.primary, color: th.primary_text }}>
              {String(biz.name || "?")[0]}
            </div>
          )}
          <span className={variant === "minimal" ? "text-sm font-medium tracking-[0.3em] uppercase" : "text-lg font-bold tracking-tight"}>{biz.name}</span>
        </div>
        {right}
      </div>
    </header>
  );
}

export function Price({ p, th, className = "" }: { p: any; th: ShopTheme; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`} style={{ color: th.text }}>
      {Number(p.price).toLocaleString("fr-FR")} <span className="text-[0.7em] opacity-60">{p.currency}</span>
    </span>
  );
}

export function Img({ src, alt, className = "", th }: { src?: string; alt: string; className?: string; th: ShopTheme }) {
  if (!src) return <div className={`grid place-items-center ${className}`} style={{ background: `${th.primary}14`, color: th.muted }}><span className="text-[10px] uppercase tracking-widest">{alt.slice(0, 14)}</span></div>;
  return <img src={src} alt={alt} loading="lazy" className={className} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />;
}

export function BuyBtn({ th, onClick, label = "Acheter", full = false }: { th: ShopTheme; onClick: () => void; label?: string; full?: boolean }) {
  return (
    <button onClick={onClick} className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-transform active:scale-95 ${full ? "w-full" : ""}`} style={{ background: th.primary, color: th.primary_text }}>
      {label}
    </button>
  );
}

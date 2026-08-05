import { RangeKey } from "@/lib/analytics/queries";

const PRESETS: Array<{ id: RangeKey; label: string }> = [
  { id: "today", label: "Aujourd'hui" },
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "90d", label: "90 jours" },
  { id: "custom", label: "Personnalisé" },
];

export function DateRangeFilter({ value, onChange, from, to, onFrom, onTo }: {
  value: RangeKey; onChange: (k: RangeKey) => void;
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-full border border-border bg-card/40 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${value === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="rounded-xl border border-border bg-card/40 px-3 py-1.5 text-xs" />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="rounded-xl border border-border bg-card/40 px-3 py-1.5 text-xs" />
        </div>
      )}
    </div>
  );
}
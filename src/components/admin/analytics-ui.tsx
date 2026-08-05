import { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus, Download } from "lucide-react";
import { downloadCsv } from "@/lib/analytics/queries";

export const CHART_COLORS = ["hsl(var(--primary))", "#f5b400", "#3b82f6", "#a855f7", "#14b8a6", "#ef4444", "#64748b"];

export const fmtXof = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} XOF`;
export const fmtUsd = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} USD`;
export const fmtNum = (n: number) => n.toLocaleString("fr-FR");
export const fmtPct = (n: number) => `${n.toFixed(1)} %`;

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card/40 p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function KpiCard({ label, value, delta, hint, tone = "neutral" }: {
  label: string; value: string; delta?: number; hint?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const trend = delta === undefined ? null : delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const trendClass = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-destructive" : "text-muted-foreground";
  const toneClass = tone === "positive" ? "text-emerald-500" : tone === "negative" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend && (
          <span className={`inline-flex items-center gap-1 font-semibold ${trendClass}`}>
            {trend === "up" ? <ArrowUp className="h-3 w-3" /> : trend === "down" ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(delta ?? 0).toFixed(1)} %
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

export function ExportButton({ filename, rows }: { filename: string; rows: Record<string, unknown>[] }) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, rows)}
      disabled={!rows.length}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      <Download className="h-3.5 w-3.5" /> CSV
    </button>
  );
}

export function DataTable<T extends Record<string, any>>({ columns, rows, empty = "Aucune donnée sur la période.", onRowClick }: {
  columns: Array<{ key: keyof T & string; label: string; align?: "left" | "right"; render?: (row: T) => ReactNode }>;
  rows: T[];
  empty?: string;
  onRowClick?: (row: T) => void;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => (
              <th key={c.key} className={`px-2 py-2 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-border/50 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-2 py-2.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SortableTable<T extends Record<string, any>>(props: Parameters<typeof DataTable<T>>[0] & { defaultSort?: keyof T & string }) {
  return <DataTable {...props} />;
}
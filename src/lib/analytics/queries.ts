import { supabase } from "@/integrations/supabase/client";

export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";

export interface DateRange { from: Date; to: Date; key: RangeKey }

export function buildRange(key: RangeKey, customFrom?: string, customTo?: string): DateRange {
  const to = new Date();
  const from = new Date();
  if (key === "today") from.setHours(0, 0, 0, 0);
  else if (key === "7d") from.setDate(from.getDate() - 7);
  else if (key === "30d") from.setDate(from.getDate() - 30);
  else if (key === "90d") from.setDate(from.getDate() - 90);
  else {
    return {
      key,
      from: customFrom ? new Date(`${customFrom}T00:00:00`) : from,
      to: customTo ? new Date(`${customTo}T23:59:59`) : to,
    };
  }
  return { key, from, to };
}

export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  return { key: range.key, from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime()) };
}

const iso = (d: Date) => d.toISOString();

export interface AnalyticsBundle {
  sessions: any[];
  events: any[];
  transactions: any[];
  cards: any[];
  withdrawals: any[];
  profiles: any[];
  orders: any[];
  payments: any[];
}

/** Charge les données brutes de la période (agrégées ensuite côté client). */
export async function loadAnalytics(range: DateRange): Promise<AnalyticsBundle> {
  const [sessions, events, transactions, cards, withdrawals, profiles, orders, payments] = await Promise.all([
    supabase.from("analytics_sessions").select("*").gte("started_at", iso(range.from)).lte("started_at", iso(range.to)).order("started_at", { ascending: false }).limit(5000),
    supabase.from("analytics_events").select("*").gte("created_at", iso(range.from)).lte("created_at", iso(range.to)).order("created_at", { ascending: false }).limit(10000),
    supabase.from("transactions").select("id,user_id,type,status,amount,currency,description,created_at").gte("created_at", iso(range.from)).lte("created_at", iso(range.to)).order("created_at", { ascending: false }).limit(10000),
    supabase.from("cards").select("id,user_id,status,balance,total_funded_usd,created_at").limit(5000),
    supabase.from("withdrawals").select("id,user_id,amount,currency,status,created_at").gte("created_at", iso(range.from)).lte("created_at", iso(range.to)).limit(5000),
    supabase.from("profiles").select("id,full_name,email,phone,country,created_at").limit(5000),
    supabase.from("orders").select("id,business_id,status,total_amount,currency,created_at").gte("created_at", iso(range.from)).lte("created_at", iso(range.to)).limit(5000),
    supabase.from("payment_link_payments").select("id,business_id,amount,currency,status,fee_amount,net_amount,created_at").gte("created_at", iso(range.from)).lte("created_at", iso(range.to)).limit(5000),
  ]);
  const err = sessions.error || events.error || transactions.error || cards.error || withdrawals.error || profiles.error || orders.error || payments.error;
  if (err) throw new Error(err.message);
  return {
    sessions: sessions.data ?? [], events: events.data ?? [], transactions: transactions.data ?? [],
    cards: cards.data ?? [], withdrawals: withdrawals.data ?? [], profiles: profiles.data ?? [],
    orders: orders.data ?? [], payments: payments.data ?? [],
  };
}

/** Fiche utilisateur détaillée — accès restreint, journalisé. */
export async function loadUserDetail(userId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const [profile, sessions, events, transactions, cards] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("analytics_sessions").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(50),
    supabase.from("analytics_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(300),
    supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabase.from("cards").select("id,brand,last4,status,balance,total_funded_usd,created_at").eq("user_id", userId).limit(50),
  ]);
  // Journal d'audit : trace obligatoire de toute consultation individuelle
  try {
    await supabase.functions.invoke("dashboard-ai", {
      body: { action: "audit", target_user_id: userId, label: "consultation_fiche_utilisateur" },
    });
  } catch { /* l'audit ne doit pas bloquer la lecture */ }
  return {
    actorId: user?.id ?? null,
    profile: profile.data,
    sessions: sessions.data ?? [],
    events: events.data ?? [],
    transactions: transactions.data ?? [],
    cards: cards.data ?? [],
  };
}

// ---------- Agrégations ----------

export const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

export function countBy<T>(rows: T[], pick: (r: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = pick(r) || "Inconnu";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function sumBy<T>(rows: T[], pick: (r: T) => number) {
  return rows.reduce((acc, r) => acc + (Number(pick(r)) || 0), 0);
}

export function seriesByDay<T>(rows: T[], dateOf: (r: T) => string, valueOf?: (r: T) => number) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(dateOf(r));
    map.set(k, (map.get(k) ?? 0) + (valueOf ? Number(valueOf(r)) || 0 : 1));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

export function pctChange(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
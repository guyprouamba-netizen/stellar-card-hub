import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, ExternalLink, RefreshCw, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import { BackButton } from "@/components/back-button";
import {
  getMomoTransferConfig, quoteMomoTransfer, initMomoTransfer,
  listMyMomoTransfers, verifyMomoTransfer,
} from "@/lib/transfer.functions";

// Emerald Prestige palette (page-scoped to build banking trust)
const C = {
  bg: "#f5f0e0",
  cream: "#f9f7f0",
  ink: "#064e3b",
  green: "#0d7a5f",
  gold: "#c9a84c",
  border: "#e2decb",
};

const OPERATORS = [
  { code: "ORANGE_MONEY", label: "Orange", color: "#ff6600" },
  { code: "MOOV_MONEY", label: "Moov", color: "#005cff" },
  { code: "TELECEL_MONEY", label: "Telecel", color: "#ed1c24" },
  { code: "WAVE_MONEY", label: "Wave", color: "#00c5ff" },
  { code: "SANK_MONEY", label: "Sank", color: "#22c55e" },
];

function opInfo(code: string) {
  return OPERATORS.find((o) => o.code === code) || { code, label: code, color: "#94a3b8" };
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    awaiting_payment: { label: "En attente", bg: "bg-amber-100", fg: "text-amber-700" },
    paid: { label: "Envoi en cours", bg: "bg-sky-100", fg: "text-sky-700" },
    disbursing: { label: "Envoi en cours", bg: "bg-sky-100", fg: "text-sky-700" },
    delivered: { label: "Livré", bg: "bg-emerald-100", fg: "text-emerald-700" },
    failed: { label: "Échec", bg: "bg-red-100", fg: "text-red-700" },
    refunded: { label: "Remboursé", bg: "bg-slate-100", fg: "text-slate-600" },
  };
  const s = map[status] || map.awaiting_payment;
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.fg}`}>
      {s.label}
    </span>
  );
}

export default function TransferPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    source_operator: "ORANGE_MONEY",
    source_phone: "",
    dest_operator: "MOOV_MONEY",
    dest_phone: "",
    dest_holder: "",
    amount: "" as string,
  });
  const [quote, setQuote] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const cfgQ = useQuery({ queryKey: ["mtr-cfg"], queryFn: getMomoTransferConfig });
  const listQ = useQuery({
    queryKey: ["mtr-list"],
    queryFn: listMyMomoTransfers,
    refetchInterval: 15_000,
  });

  const amountNum = Math.floor(Number(form.amount) || 0);
  useEffect(() => {
    let cancel = false;
    if (!amountNum || !cfgQ.data?.enabled) { setQuote(null); return; }
    const t = setTimeout(async () => {
      try {
        const q = await quoteMomoTransfer({ data: { amount: amountNum } });
        if (!cancel) setQuote(q);
      } catch (e: any) {
        if (!cancel) setQuote({ ok: false, error: e.message });
      }
    }, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [amountNum, cfgQ.data?.enabled]);

  const initMut = useMutation({
    mutationFn: async () => {
      setSubmitting(true);
      const returnUrl = `${window.location.origin}/transfer`;
      return await initMomoTransfer({ data: { ...form, amount: amountNum, returnUrl } });
    },
    onSuccess: (res: any) => {
      toast.success("Redirection vers le paiement…");
      qc.invalidateQueries({ queryKey: ["mtr-list"] });
      if (res?.checkout_url) window.location.href = res.checkout_url;
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
    onSettled: () => setSubmitting(false),
  });

  const verifyMut = useMutation({
    mutationFn: (reference: string) => verifyMomoTransfer({ data: { reference } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mtr-list"] }); toast.success("Statut mis à jour"); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  // Auto-verify on return from checkout
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("mtr");
    if (ref) {
      verifyMomoTransfer({ data: { reference: ref } }).finally(() => {
        qc.invalidateQueries({ queryKey: ["mtr-list"] });
        url.searchParams.delete("mtr");
        window.history.replaceState({}, "", url.toString());
      });
    }
  }, [qc]);

  const valid = useMemo(() => {
    return form.source_operator && form.dest_operator
      && form.source_operator !== form.dest_operator
      && form.source_phone.length >= 8 && form.dest_phone.length >= 8
      && amountNum > 0 && quote?.ok;
  }, [form, amountNum, quote]);

  const cfg = cfgQ.data;

  // KPI aggregates
  const list = listQ.data ?? [];
  const kpis = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    let volume = 0, fees = 0, delivered = 0;
    let last: any = null;
    for (const t of list) {
      const d = new Date(t.created_at);
      if (d >= monthStart && ["paid", "disbursing", "delivered"].includes(t.status)) {
        volume += Number(t.amount_send || 0);
        fees += Number(t.fees_xof || 0);
      }
      if (t.status === "delivered") delivered++;
      if (!last || new Date(t.created_at) > new Date(last.created_at)) last = t;
    }
    return { volume, fees, delivered, last };
  }, [list]);

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: C.bg, color: C.ink, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div className="max-w-6xl mx-auto space-y-8">

        <BackButton to="/dashboard" className="mb-2 !text-[#064e3b] hover:!text-[#0d7a5f]" />

        {/* Header & KPIs */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Libre Baskerville', serif", color: C.ink }}>
              Transfert Inter-Réseaux
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium" style={{ color: C.green }}>
              <ShieldCheck className="h-4 w-4" style={{ color: C.gold }} />
              Transferts sécurisés entre tous les opérateurs nationaux
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="Volume / mois" value={`${kpis.volume.toLocaleString("fr-FR")}`} unit="XOF" accent={C.gold} />
            <KpiCard label="Dernier envoi" value={kpis.last ? `${Number(kpis.last.amount_send).toLocaleString("fr-FR")}` : "—"} unit="XOF" accent={C.green} />
            <KpiCard label="Frais / mois" value={`${kpis.fees.toLocaleString("fr-FR")}`} unit="XOF" accent={C.ink} className="hidden sm:block" />
          </div>
        </header>

        {cfg && !cfg.enabled && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Cette fonctionnalité est temporairement désactivée. Réessayez plus tard.
          </div>
        )}

        {/* Main Transfer Section */}
        <div className="grid lg:grid-cols-3 gap-8 items-start">

          {/* Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl overflow-hidden" style={{ borderColor: C.border, borderWidth: 1 }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: C.ink }}>
              <h2 className="text-white text-lg" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                Configuration du transfert
              </h2>
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded" style={{ color: C.ink, backgroundColor: C.gold }}>
                Sécurisé
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Source operator */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.ink }}>
                  Réseau Source (Débit)
                </label>
                <OperatorChips value={form.source_operator} onChange={(v) => setForm({ ...form, source_operator: v })} exclude={form.dest_operator} />
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center gap-3 -my-1">
                <div className="h-px flex-1" style={{ backgroundColor: C.border }} />
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold" style={{ color: C.gold }}>
                  <ArrowLeft className="h-3 w-3 rotate-180" /> Vers
                </div>
                <div className="h-px flex-1" style={{ backgroundColor: C.border }} />
              </div>

              {/* Dest operator */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.ink }}>
                  Réseau Destinataire (Crédit)
                </label>
                <OperatorChips value={form.dest_operator} onChange={(v) => setForm({ ...form, dest_operator: v })} exclude={form.source_operator} />
              </div>

              {/* Inputs grid */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Field label="Numéro Source" value={form.source_phone} onChange={(v) => setForm({ ...form, source_phone: v })} placeholder="70 00 00 00" mono />
                  <Field label="Numéro Destinataire" value={form.dest_phone} onChange={(v) => setForm({ ...form, dest_phone: v })} placeholder="65 00 00 00" mono />
                </div>
                <div className="space-y-4">
                  <Field label="Nom du Bénéficiaire" value={form.dest_holder} onChange={(v) => setForm({ ...form, dest_holder: v })} placeholder="Ex. Awa Ouédraogo" />
                  <Field
                    label="Montant à envoyer (XOF)"
                    value={form.amount}
                    onChange={(v) => setForm({ ...form, amount: v.replace(/\D/g, "") })}
                    placeholder="10 000"
                    big
                  />
                </div>
              </div>

              {/* Guide */}
              <div className="p-4 rounded-lg flex items-start gap-3" style={{ backgroundColor: C.cream, borderColor: C.border, borderWidth: 1 }}>
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: C.green }}>i</div>
                <p className="text-xs leading-relaxed" style={{ color: C.ink }}>
                  <strong>Comment ça marche :</strong> 1. Choisissez les opérateurs et saisissez les numéros. 2. Confirmez le montant. 3. Validez le paiement sur votre téléphone source — le destinataire est crédité automatiquement.
                </p>
              </div>
            </div>
          </div>

          {/* Receipt */}
          <div className="bg-white rounded-2xl shadow-xl relative" style={{ borderColor: C.border, borderWidth: 1 }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: C.gold, color: C.ink }}>
              Récapitulatif
            </div>

            <div className="p-8 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center" style={{ backgroundColor: C.bg }}>
                <CheckCircle2 className="w-6 h-6" style={{ color: C.green }} />
              </div>

              <div className="w-full space-y-4 pt-4 border-t border-dashed" style={{ borderColor: C.border }}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Reçu par le destinataire</span>
                  <b className="tabular-nums">{amountNum ? amountNum.toLocaleString("fr-FR") : "—"} XOF</b>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Frais {cfg ? `(${((cfg.fee_bps ?? 150) / 100).toFixed(2)}% + ${cfg.fee_flat_xof ?? 100})` : ""}</span>
                  <b className="tabular-nums text-red-600">
                    {quote?.ok ? `- ${quote.fees_xof.toLocaleString("fr-FR")}` : "—"} XOF
                  </b>
                </div>
                <div className="pt-4 border-t flex justify-between items-baseline" style={{ borderColor: C.border }}>
                  <span className="text-xs font-bold uppercase text-slate-400">Total à payer</span>
                  <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'Libre Baskerville', serif", color: C.ink }}>
                    {quote?.ok ? quote.total_charged_xof.toLocaleString("fr-FR") : "—"} <span className="text-xs">XOF</span>
                  </span>
                </div>
                {quote?.error && <p className="text-xs text-red-600 text-right">{quote.error}</p>}
              </div>

              <button
                disabled={!valid || submitting || !cfg?.enabled}
                onClick={() => initMut.mutate()}
                className="w-full mt-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: C.ink, color: C.gold }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Payer et transférer
              </button>

              <p className="mt-4 text-[10px] text-center text-slate-400 leading-relaxed">
                Transaction sécurisée par Faso-Invest Pay.<br />
                Vous serez redirigé vers votre opérateur pour valider le paiement.
              </p>
            </div>
          </div>
        </div>

        {/* History */}
        <section className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ borderColor: C.border, borderWidth: 1 }}>
          <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: C.bg }}>
            <h2 className="font-bold text-lg" style={{ fontFamily: "'Libre Baskerville', serif", color: C.ink }}>
              Mes transferts récents
            </h2>
            <button onClick={() => listQ.refetch()} className="inline-flex items-center gap-1 text-xs font-bold hover:underline" style={{ color: C.green }}>
              <RefreshCw className="h-3 w-3" /> Actualiser
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="text-[10px] uppercase tracking-wider font-bold" style={{ backgroundColor: C.cream, color: C.green }}>
                <tr>
                  <th className="px-6 py-3">Date & Heure</th>
                  <th className="px-6 py-3">Trajet</th>
                  <th className="px-6 py-3">Destinataire</th>
                  <th className="px-6 py-3 text-right">Montant</th>
                  <th className="px-6 py-3 text-center">Statut</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {list.map((t: any) => {
                  const src = opInfo(t.source_operator), dst = opInfo(t.dest_operator);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                        {new Date(t.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: src.color, backgroundColor: src.color + "1a" }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: src.color }} />
                            {src.label}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-300" />
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: dst.color, backgroundColor: dst.color + "1a" }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dst.color }} />
                            {dst.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="font-medium" style={{ color: C.ink }}>{t.dest_holder || "—"}</div>
                        <div className="text-slate-400 tabular-nums">{t.dest_phone}</div>
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums font-bold" style={{ color: C.ink }}>
                        {Number(t.amount_send).toLocaleString("fr-FR")} XOF
                      </td>
                      <td className="px-6 py-4 text-center"><StatusPill status={t.status} /></td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {t.status === "awaiting_payment" && t.checkout_url && (
                          <a href={t.checkout_url} className="mr-3 inline-flex items-center gap-1 text-xs font-bold hover:underline" style={{ color: C.gold }}>
                            <ExternalLink className="h-3 w-3" /> Payer
                          </a>
                        )}
                        <button
                          onClick={() => verifyMut.mutate(t.payment_reference)}
                          className="text-xs font-bold hover:underline"
                          style={{ color: C.green }}
                        >
                          Vérifier
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
                      Aucun transfert pour le moment. Lancez votre premier envoi ci-dessus.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ label, value, unit, accent, className = "" }: { label: string; value: string; unit?: string; accent: string; className?: string }) {
  return (
    <div
      className={`bg-white p-4 rounded shadow-sm min-w-[140px] ${className}`}
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: C.ink }}>
        {value} {unit && <span className="text-xs font-normal text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}

function OperatorChips({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {OPERATORS.map((o) => {
        const disabled = exclude === o.code;
        const active = value === o.code;
        return (
          <button
            key={o.code}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.code)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-25 disabled:cursor-not-allowed"
            style={
              active
                ? { borderWidth: 2, borderColor: o.color, backgroundColor: o.color + "14", color: o.color, fontWeight: 700 }
                : { borderWidth: 1, borderColor: "#e2e8f0", color: "#475569", backgroundColor: "white" }
            }
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: o.color }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, mono, big }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; big?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:outline-none transition-all ${mono ? "font-mono text-lg" : ""} ${big ? "font-bold text-xl" : "text-sm"}`}
        style={{ color: C.ink }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px ${big ? C.gold : C.green}`; e.currentTarget.style.borderColor = "transparent"; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
      />
    </div>
  );
}

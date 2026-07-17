import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Repeat, ExternalLink, RefreshCw, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import {
  getMomoTransferConfig, quoteMomoTransfer, initMomoTransfer,
  listMyMomoTransfers, verifyMomoTransfer,
} from "@/lib/transfer.functions";

const OPERATORS = [
  { code: "ORANGE_MONEY", label: "Orange Money", color: "bg-orange-500" },
  { code: "MOOV_MONEY", label: "Moov Money", color: "bg-blue-500" },
  { code: "TELECEL_MONEY", label: "Telecel Money", color: "bg-red-500" },
  { code: "WAVE_MONEY", label: "Wave", color: "bg-sky-500" },
  { code: "SANK_MONEY", label: "Sank Money", color: "bg-emerald-600" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    awaiting_payment: { label: "Paiement en attente", cls: "bg-warning/15 text-warning", Icon: Clock },
    paid: { label: "Payé — envoi en cours", cls: "bg-info/15 text-info", Icon: Loader2 },
    disbursing: { label: "Envoi en cours", cls: "bg-info/15 text-info", Icon: Loader2 },
    delivered: { label: "Livré", cls: "bg-success/15 text-success", Icon: CheckCircle2 },
    failed: { label: "Échec", cls: "bg-destructive/15 text-destructive", Icon: XCircle },
    refunded: { label: "Remboursé", cls: "bg-muted text-muted-foreground", Icon: RefreshCw },
  };
  const s = map[status] || map.awaiting_payment;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      <s.Icon className="h-3 w-3" /> {s.label}
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="container mx-auto px-4 py-4 sm:px-6">
        <BackButton to="/dashboard" className="mb-2" />
      </div>
      <div className="container mx-auto px-4 py-6 sm:px-6 lg:py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Repeat className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-[Space_Grotesk] text-2xl font-bold tracking-tight sm:text-3xl">Transfert inter-réseaux</h1>
            <p className="text-sm text-muted-foreground">Envoyez de l'argent d'un opérateur Mobile Money vers un autre, en quelques secondes.</p>
          </div>
        </div>

        {cfg && !cfg.enabled && (
          <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
            Cette fonctionnalité est temporairement désactivée. Réessayez plus tard.
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <OperatorSelect label="De (opérateur source)" value={form.source_operator} onChange={(v) => setForm({ ...form, source_operator: v })} />
              <OperatorSelect label="Vers (opérateur destinataire)" value={form.dest_operator} onChange={(v) => setForm({ ...form, dest_operator: v })} exclude={form.source_operator} />
              <Field label="Numéro source (débité)" value={form.source_phone} onChange={(v) => setForm({ ...form, source_phone: v })} placeholder="ex. 70 00 00 00" type="tel" />
              <Field label="Numéro destinataire (crédité)" value={form.dest_phone} onChange={(v) => setForm({ ...form, dest_phone: v })} placeholder="ex. 65 00 00 00" type="tel" />
              <Field label="Nom du destinataire (optionnel)" value={form.dest_holder} onChange={(v) => setForm({ ...form, dest_holder: v })} placeholder="Ex. Awa Ouédraogo" />
              <Field label="Montant à envoyer (XOF)" value={form.amount} onChange={(v) => setForm({ ...form, amount: v.replace(/\D/g, "") })} placeholder="ex. 10000" type="tel" />
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reçu par le destinataire</span>
                <b className="tabular-nums">{amountNum ? amountNum.toLocaleString("fr-FR") : "—"} XOF</b>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Frais</span>
                <b className="tabular-nums">{quote?.ok ? quote.fees_xof.toLocaleString("fr-FR") : "—"} XOF</b>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base">
                <span className="font-semibold">Total à payer</span>
                <b className="tabular-nums text-primary">{quote?.ok ? quote.total_charged_xof.toLocaleString("fr-FR") : "—"} XOF</b>
              </div>
              {quote?.error && <p className="mt-2 text-xs text-destructive">{quote.error}</p>}
            </div>

            <button
              disabled={!valid || submitting || !cfg?.enabled}
              onClick={() => initMut.mutate()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Payer et transférer
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Vous serez redirigé vers le paiement Mobile Money source. Une fois validé, le destinataire est crédité automatiquement.
            </p>
          </div>

          <aside className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-semibold">Comment ça marche</h3>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>1. Choisissez opérateurs et numéros.</li>
              <li>2. Payez depuis votre Mobile Money source.</li>
              <li>3. Le destinataire reçoit sur son réseau automatiquement.</li>
            </ol>
            <div className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              Frais actuels : <b>{cfg?.fee_bps ? (cfg.fee_bps / 100).toFixed(2) : "1.50"} %</b> + <b>{cfg?.fee_flat_xof ?? 100} XOF</b>
            </div>
          </aside>
        </div>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mes transferts</h2>
            <button onClick={() => listQ.refetch()} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <RefreshCw className="h-3 w-3" /> Actualiser
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Trajet</th>
                  <th>Destinataire</th>
                  <th className="text-right">Montant</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(listQ.data ?? []).map((t: any) => (
                  <tr key={t.id}>
                    <td className="py-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</td>
                    <td className="py-2 text-xs">{opLabel(t.source_operator)} → {opLabel(t.dest_operator)}</td>
                    <td className="py-2 text-xs">{t.dest_phone}{t.dest_holder ? ` · ${t.dest_holder}` : ""}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{Number(t.amount_send).toLocaleString("fr-FR")} XOF</td>
                    <td className="py-2"><StatusBadge status={t.status} /></td>
                    <td className="py-2 text-right">
                      {t.status === "awaiting_payment" && t.checkout_url && (
                        <a href={t.checkout_url} className="mr-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> Payer
                        </a>
                      )}
                      <button
                        onClick={() => verifyMut.mutate(t.payment_reference)}
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        Vérifier
                      </button>
                    </td>
                  </tr>
                ))}
                {(!listQ.data || listQ.data.length === 0) && (
                  <tr><td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">Aucun transfert pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function opLabel(code: string) {
  return OPERATORS.find((o) => o.code === code)?.label || code;
}

function OperatorSelect({ label, value, onChange, exclude }: { label: string; value: string; onChange: (v: string) => void; exclude?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OPERATORS.map((o) => {
          const disabled = exclude === o.code;
          const active = value === o.code;
          return (
            <button
              key={o.code}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.code)}
              className={`rounded-xl border p-2 text-xs font-semibold transition-all disabled:opacity-30 ${active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
            >
              <span className={`mb-1 inline-block h-2 w-2 rounded-full ${o.color}`} /> {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}


import { Plus, Snowflake, Trash2, Sun, Wallet, History, Loader2, RefreshCw, MapPin, Copy, ArrowDownToLine } from "lucide-react";
import { useState, useEffect } from "react";
import { useServerFn } from "@/lib/server-fn";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { VirtualCard } from "@/components/virtual-card";
import { IssueCardSheet } from "@/components/issue-card-sheet";
import { listMyCards, cardAction, fundCard, withdrawCard, listCardTransactions, refreshCard, cardDetails } from "@/lib/strowallet.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const variantByIndex = ["primary", "teal", "sunset"] as const;

function statusLabel(s: string) {
  switch (s) {
    case "active": return "Active";
    case "frozen": return "Gelée";
    case "frozen_auto": return "Gelée (auto)";
    case "terminated": return "Résiliée";
    case "processing": return "En cours d'émission";
    default: return s;
  }
}

function CardsPage() {
  const [open, setOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState<{ card_id: string; balance: number } | null>(null);
  const [txOpen, setTxOpen] = useState<string | null>(null);

  const fetchCards = useServerFn(listMyCards);
  const cardsQ = useQuery({ queryKey: ["my-cards"], queryFn: () => fetchCards() });

  const qc = useQueryClient();
  const doAction = useServerFn(cardAction);
  const actionMut = useMutation({
    mutationFn: (v: { card_id: string; action: "freeze" | "unfreeze" | "terminate" }) => doAction({ data: v }),
    onSuccess: (r) => {
      if ((r as any)?.ok === false) toast.error((r as any).error || "Action échouée");
      else toast.success((r as any)?.data?.details ? "Carte dégelée et revalidée" : "Action exécutée");
      qc.invalidateQueries({ queryKey: ["my-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doRefresh = useServerFn(refreshCard);
  const refreshMut = useMutation({
    mutationFn: (card_id: string) => doRefresh({ data: { card_id } }),
    onSuccess: (r: any) => {
      if (r?.ok === false) toast.error(r.error || "Rafraîchissement échoué");
      else toast.success("Carte mise à jour");
      qc.invalidateQueries({ queryKey: ["my-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = (cardsQ.data ?? []) as Array<{
    id: string; brand: string | null; last4: string | null; currency: string;
    balance: number; status: string; provider_card_id: string | null;
  }>;

  const fetchDetails = useServerFn(cardDetails);
  const [details, setDetails] = useState<Record<string, { number?: string; cvv?: string; expiry?: string; holder?: string }>>({});
  async function loadDetails(provider_card_id: string) {
    if (details[provider_card_id]?.number) return;
    try {
      const r: any = await fetchDetails({ data: { card_id: provider_card_id } });
      const raw = r?.response?.card_detail ?? r?.data?.card_detail ?? r?.card_detail ?? r?.response ?? r?.data ?? r ?? {};
      const number = raw.card_number || raw.cardNumber || raw.pan || null;
      const cvv = raw.cvv || raw.cvv2 || raw.card_cvv || null;
      const exp = raw.expiry || raw.expiry_date || raw.expiration || (raw.expiry_month && raw.expiry_year ? `${String(raw.expiry_month).padStart(2, "0")}/${String(raw.expiry_year).slice(-2)}` : null);
      const holder = raw.name_on_card || raw.card_holder_name || raw.holder || raw.card_holder || raw.card_name || raw.name || null;
      setDetails((d) => ({ ...d, [provider_card_id]: { number: number ?? undefined, cvv: cvv ?? undefined, expiry: exp ?? undefined, holder: holder ?? undefined } }));
    } catch { /* silencieux */ }
  }

  // Précharge automatiquement les détails (numéro 16 chiffres, expiration, titulaire) pour toutes les cartes
  useEffect(() => {
    cards.forEach((c) => { if (c.provider_card_id) loadDetails(c.provider_card_id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="container mx-auto px-4 py-4 sm:px-6">
        <BackButton to="/dashboard" className="mb-2" />
      </div>
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight sm:text-4xl">Mes cartes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {cardsQ.isLoading ? "Chargement…" : `${cards.length} carte${cards.length > 1 ? "s" : ""} virtuelle${cards.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-105 transition-transform">
            <Plus className="h-4 w-4" /> Nouvelle carte
          </button>
        </div>

        {cardsQ.isLoading ? (
          <div className="mt-12 flex items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Chargement des cartes…</div>
        ) : cards.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground">
            Vous n'avez pas encore de carte virtuelle. Cliquez sur « Nouvelle carte » pour en émettre une.
          </div>
        ) : (
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {cards.map((c, i) => {
            const variant = variantByIndex[i % variantByIndex.length];
            const det = c.provider_card_id ? details[c.provider_card_id] : undefined;
            const number = det?.number || (c.last4 ? `•••• •••• •••• ${c.last4}` : "•••• •••• •••• ••••");
            const isActive = c.status === "active";
            const isTerminated = c.status === "terminated";
            return (
              <div key={c.id} className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
                <div className="mx-auto w-full max-w-lg">
                <VirtualCard
                  variant={variant}
                  number={number}
                  brand={(c.brand || "visa").toUpperCase()}
                  balance={`$ ${Number(c.balance).toFixed(2)}`}
                  holder={(det?.holder || "TITULAIRE").toUpperCase()}
                  expiry={det?.expiry || "••/••"}
                  cvv={det?.cvv}
                  onFlip={(flipped) => { if (flipped && c.provider_card_id) loadDetails(c.provider_card_id); }}
                />
                </div>
                <CardDetailsCopy det={det} />
                <BillingAddress />
                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{(c.brand || "Carte").toUpperCase()} {c.last4 ? `••${c.last4}` : ""}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${isActive ? "bg-success/15 text-success" : isTerminated ? "bg-destructive/15 text-destructive" : c.status === "processing" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {statusLabel(c.status)}
                    </span>
                  </div>
                  {!isActive && !isTerminated && c.provider_card_id && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Si l'émetteur confirme le dégel, le numéro, la date et le CVV réapparaîtront automatiquement.
                    </p>
                  )}
                  {c.status === "processing" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      L'émetteur finalise votre carte. Cliquez sur « Rafraîchir » dans quelques instants pour récupérer le numéro et le statut.
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      disabled={!c.provider_card_id || isTerminated}
                      onClick={() => c.provider_card_id && setFundOpen(c.provider_card_id)}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      <Wallet className="h-3.5 w-3.5" /> Recharger
                    </button>
                    <button
                      disabled={!c.provider_card_id || isTerminated || Number(c.balance) <= 0.5}
                      onClick={() => c.provider_card_id && setWithdrawOpen({ card_id: c.provider_card_id, balance: Number(c.balance) })}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5" /> Retirer
                    </button>
                    <button
                      disabled={!c.provider_card_id}
                      onClick={() => c.provider_card_id && setTxOpen(c.provider_card_id)}
                      className="col-span-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      <History className="h-3.5 w-3.5" /> Historique
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={!c.provider_card_id || refreshMut.isPending}
                      onClick={() => c.provider_card_id && refreshMut.mutate(c.provider_card_id)}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      title="Rafraîchir depuis Strowallet"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshMut.isPending ? "animate-spin" : ""}`} />
                    </button>
                    {isActive ? (
                      <button
                        disabled={!c.provider_card_id || actionMut.isPending}
                        onClick={() => c.provider_card_id && actionMut.mutate({ card_id: c.provider_card_id, action: "freeze" })}
                        className="flex-1 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        <Snowflake className="h-3.5 w-3.5" /> Geler
                      </button>
                    ) : (
                      <button
                        disabled={!c.provider_card_id || isTerminated || actionMut.isPending}
                        onClick={() => c.provider_card_id && actionMut.mutate({ card_id: c.provider_card_id, action: "unfreeze" })}
                        className="flex-1 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        <Sun className="h-3.5 w-3.5" /> Dégeler
                      </button>
                    )}
                    <button
                      disabled={!c.provider_card_id || isTerminated || actionMut.isPending}
                      onClick={() => { if (c.provider_card_id && confirm("Résilier définitivement cette carte ?")) actionMut.mutate({ card_id: c.provider_card_id, action: "terminate" }); }}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-surface-2 px-3 py-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>)}

        <IssueCardSheet open={open} onClose={() => setOpen(false)} />
        {fundOpen && <FundDialog cardId={fundOpen} onClose={() => setFundOpen(null)} onDone={() => qc.invalidateQueries({ queryKey: ["my-cards"] })} />}
        {withdrawOpen && <WithdrawDialog cardId={withdrawOpen.card_id} balance={withdrawOpen.balance} onClose={() => setWithdrawOpen(null)} onDone={() => qc.invalidateQueries({ queryKey: ["my-cards"] })} />}
        {txOpen && <TransactionsDialog cardId={txOpen} onClose={() => setTxOpen(null)} />}
      </div>
    </div>
  );
}

function FundDialog({ cardId, onClose, onDone }: { cardId: string; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("10");
  const fn = useServerFn(fundCard);
  const mut = useMutation({
    mutationFn: () => fn({ data: { card_id: cardId, amountUsd: Number(amount) } }),
    onSuccess: (r: any) => {
      if (r?.ok === false) toast.error(r.error || "Recharge échouée");
      else { toast.success("Carte rechargée"); onDone(); onClose(); }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Recharger la carte</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Montant (USD)</label>
          <Input type="number" min={1} max={1000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="text-xs text-muted-foreground">Frais émetteur (1,9 USD + 1 %) débités de votre solde XOF.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !Number(amount)}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recharger"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransactionsDialog({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  // placeholder
  const fn = useServerFn(listCardTransactions);
  const q = useQuery({ queryKey: ["card-tx", cardId], queryFn: () => fn({ data: { card_id: cardId } }) });
  const res = q.data as any;
  const raw = res?.data ?? res;
  const list: any[] = Array.isArray(raw?.response) ? raw.response : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Historique de la carte</DialogTitle></DialogHeader>
        {q.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Chargement…</div>
        ) : res?.ok === false ? (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{res.error}</div>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune transaction pour cette carte.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="text-left py-2">Date</th><th className="text-left">Description</th><th className="text-right">Montant</th><th className="text-right">Statut</th></tr>
              </thead>
              <tbody>
                {list.map((t, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="py-2 text-muted-foreground">{t.date || t.created_at || t.transaction_date || "—"}</td>
                    <td>{t.description || t.narration || t.type || "—"}</td>
                    <td className="text-right tabular-nums">{t.amount ? `${t.amount} ${t.currency || "USD"}` : "—"}</td>
                    <td className="text-right">{t.status || t.transaction_status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fermer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CardsPage;

function BillingAddress() {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface-2/60 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> Adresse de facturation
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div><span className="text-muted-foreground">Adresse</span><p className="font-medium">3401 N. Miami Ave, Ste 230</p></div>
        <div><span className="text-muted-foreground">Ville</span><p className="font-medium">Miami</p></div>
        <div><span className="text-muted-foreground">État</span><p className="font-medium">Floride (FL)</p></div>
        <div><span className="text-muted-foreground">Code postal</span><p className="font-medium">33127</p></div>
        <div className="col-span-2"><span className="text-muted-foreground">Pays</span><p className="font-medium">États-Unis (USA)</p></div>
      </div>
    </div>
  );
}

function CardDetailsCopy({ det }: { det?: { number?: string; cvv?: string; expiry?: string; holder?: string } }) {
  if (!det || (!det.number && !det.cvv && !det.expiry && !det.holder)) return null;
  const copy = async (val?: string, label?: string) => {
    if (!val) return;
    try { await navigator.clipboard.writeText(val); toast.success(`${label} copié`); }
    catch { toast.error("Copie impossible"); }
  };
  const Row = ({ label, value }: { label: string; value?: string }) => (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2/60 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm">{value || "—"}</p>
      </div>
      <button
        onClick={() => copy(value, label)}
        disabled={!value}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        title={`Copier ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
  return (
    <div className="mt-4 grid gap-2">
      <Row label="Numéro" value={det.number} />
      <div className="grid grid-cols-2 gap-2">
        <Row label="Expiration" value={det.expiry} />
        <Row label="CVV" value={det.cvv} />
      </div>
      <Row label="Titulaire" value={det.holder} />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Plus, Snowflake, Trash2, Sun, Wallet, History, Loader2 } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { VirtualCard } from "@/components/virtual-card";
import { IssueCardSheet } from "@/components/issue-card-sheet";
import { listMyCards, cardAction, fundCard, listCardTransactions } from "@/lib/strowallet.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "Mes cartes — Volty" },
      { name: "description", content: "Gérez l'ensemble de vos cartes virtuelles." },
    ],
  }),
  component: CardsPage,
});

const variantByIndex = ["primary", "teal", "sunset"] as const;

function statusLabel(s: string) {
  switch (s) {
    case "active": return "Active";
    case "frozen": return "Gelée";
    case "frozen_auto": return "Gelée (auto)";
    case "terminated": return "Résiliée";
    default: return s;
  }
}

function CardsPage() {
  const [open, setOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState<string | null>(null);
  const [txOpen, setTxOpen] = useState<string | null>(null);

  const fetchCards = useServerFn(listMyCards);
  const cardsQ = useQuery({ queryKey: ["my-cards"], queryFn: () => fetchCards() });

  const qc = useQueryClient();
  const doAction = useServerFn(cardAction);
  const actionMut = useMutation({
    mutationFn: (v: { card_id: string; action: "freeze" | "unfreeze" | "terminate" }) => doAction({ data: v }),
    onSuccess: (r) => {
      if ((r as any)?.ok === false) toast.error((r as any).error || "Action échouée");
      else toast.success("Action exécutée");
      qc.invalidateQueries({ queryKey: ["my-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = (cardsQ.data ?? []) as Array<{
    id: string; brand: string | null; last4: string | null; currency: string;
    balance: number; status: string; provider_card_id: string | null;
  }>;

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
        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => {
            const variant = variantByIndex[i % variantByIndex.length];
            const number = c.last4 ? `••••  ••••  ••••  ${c.last4}` : "••••  ••••  ••••  ••••";
            const isActive = c.status === "active";
            const isTerminated = c.status === "terminated";
            return (
              <div key={c.id} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <VirtualCard variant={variant} number={number} brand={(c.brand || "visa").toUpperCase()} balance={`$ ${Number(c.balance).toFixed(2)}`} />
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{(c.brand || "Carte").toUpperCase()} {c.last4 ? `••${c.last4}` : ""}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${isActive ? "bg-success/15 text-success" : isTerminated ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {statusLabel(c.status)}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      disabled={!c.provider_card_id || isTerminated}
                      onClick={() => c.provider_card_id && setFundOpen(c.provider_card_id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      <Wallet className="h-3.5 w-3.5" /> Recharger
                    </button>
                    <button
                      disabled={!c.provider_card_id}
                      onClick={() => c.provider_card_id && setTxOpen(c.provider_card_id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      <History className="h-3.5 w-3.5" /> Historique
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {isActive ? (
                      <button
                        disabled={!c.provider_card_id || actionMut.isPending}
                        onClick={() => c.provider_card_id && actionMut.mutate({ card_id: c.provider_card_id, action: "freeze" })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        <Snowflake className="h-3.5 w-3.5" /> Geler
                      </button>
                    ) : (
                      <button
                        disabled={!c.provider_card_id || isTerminated || actionMut.isPending}
                        onClick={() => c.provider_card_id && actionMut.mutate({ card_id: c.provider_card_id, action: "unfreeze" })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        <Sun className="h-3.5 w-3.5" /> Dégeler
                      </button>
                    )}
                    <button
                      disabled={!c.provider_card_id || isTerminated || actionMut.isPending}
                      onClick={() => { if (c.provider_card_id && confirm("Résilier définitivement cette carte ?")) actionMut.mutate({ card_id: c.provider_card_id, action: "terminate" }); }}
                      className="inline-flex items-center justify-center rounded-full border border-border bg-surface-2 px-3 py-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
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
          <p className="text-xs text-muted-foreground">Frais Strowallet (1,9 USD + 1 %) débités de votre solde XOF.</p>
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
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getOrder, verifyPayment } from "@/lib/pay.functions";
import { Loader2, Package, Check, X, Truck, Clock, CreditCard, ShieldCheck, UserPlus, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "En attente de paiement",
  paid: "Payée",
  preparing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};
const STATUS_STEPS = ["pending_payment", "paid", "preparing", "shipped", "delivered"];

export default function OrderTracking() {
  const { token = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try { const r: any = await getOrder(token); setData(r); setLoading(false); }
    catch (e: any) { setError(e.message); setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  // Auto verify si paiement pending et pay_ref en URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("pay_ref");
    if (!ref || !data || data.order?.status !== "pending_payment") return;
    let n = 0;
    const tick = async () => {
      n++;
      try { const r: any = await verifyPayment(ref); if (r.status === "success" || r.status === "failed") { await load(); return; } } catch { /**/ }
      if (n < 20) setTimeout(tick, 3000);
    };
    tick();
  }, [data?.order?.id]);

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div><X className="mx-auto h-12 w-12 text-destructive" /><h1 className="mt-4 text-2xl font-bold">Commande introuvable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></div>
    </div>
  );

  const { order, items, business } = data;
  const stepIdx = STATUS_STEPS.indexOf(order.status);
  const cancelled = order.status === "cancelled" || order.status === "refunded";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface-1/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          {business?.logo_url && <img src={business.logo_url} className="h-10 w-10 rounded-xl object-cover" alt="" />}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Commande</p>
            <h1 className="font-[Space_Grotesk] text-lg font-bold">{business?.name}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card-premium">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">N°</p>
              <p className="font-mono text-lg font-bold">{order.order_number}</p>
              <p className="mt-1 text-xs text-muted-foreground">Passée le {new Date(order.created_at).toLocaleString("fr-FR")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="font-[Space_Grotesk] text-2xl font-bold tabular-nums">{Number(order.total_amount).toLocaleString("fr-FR")} <span className="text-sm text-muted-foreground">{order.currency}</span></p>
            </div>
          </div>

          {/* Progression */}
          <div className="mt-8">
            {cancelled ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-center text-destructive">
                <X className="mx-auto h-6 w-6" />
                <p className="mt-2 font-semibold">{STATUS_LABEL[order.status]}</p>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {STATUS_STEPS.map((s, i) => {
                  const done = i <= stepIdx;
                  const Icon = i === 0 ? Clock : i === 1 ? CreditCard : i === 2 ? Package : i === 3 ? Truck : Check;
                  return (
                    <div key={s} className="flex flex-col items-center gap-1 text-center">
                      <div className={`grid h-9 w-9 place-items-center rounded-full ${done ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`text-[10px] ${done ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{STATUS_LABEL[s]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {order.merchant_note && (
            <div className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-primary">Message du marchand</p>
              <p className="mt-1">{order.merchant_note}</p>
            </div>
          )}

          {/* Items */}
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Articles</h2>
            <div className="space-y-2">
              {items.map((it: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between rounded-xl border border-border bg-surface-2 p-3 text-sm">
                  <div><span className="font-semibold">{it.name}</span><span className="ml-2 text-xs text-muted-foreground">× {it.quantity}</span></div>
                  <span className="tabular-nums">{(Number(it.unit_price) * it.quantity).toLocaleString("fr-FR")} {order.currency}</span>
                </div>
              ))}
            </div>
          </div>

          {order.shipping_address && (
            <div className="mt-6 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Livraison</p>
              <p className="mt-1">{order.shipping_address}</p>
            </div>
          )}

          <div className="mt-8 space-y-4">
            <div className="rounded-2xl bg-primary/10 border border-primary/20 p-6 text-center">
              <UserPlus className="mx-auto h-8 w-8 text-primary mb-3" />
              <h3 className="text-lg font-bold mb-2">Suivez tous vos achats</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Créez un compte pour retrouver l'historique complet de vos commandes, gérer vos cartes virtuelles et vos paiements.
              </p>
              <Link 
                to="/auth" 
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90"
              >
                Créer mon compte
              </Link>
            </div>

            <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Suivi propulsé par FASO INVEST PAY
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
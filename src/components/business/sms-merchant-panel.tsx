import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  createSenderIdRequest, 
  listMySenderIdRequests, 
  listSmsCredits, 
  purchaseSmsCredits,
  getGatewayFeeConfig 
} from "@/lib/business.functions";
import { 
  MessageSquare, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Wallet, 
  Send,
  AlertCircle
} from "lucide-react";

export function SmsMerchantPanel({ businessId }: { businessId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [smsPrice, setSmsPrice] = useState(20);
  
  const [form, setForm] = useState({ company_name: "", sender_id: "", usage_note: "" });
  const [buyQty, setBuyQty] = useState(100);
  const [buySender, setBuySender] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const [r, c, cfg] = await Promise.all([
        listMySenderIdRequests(businessId),
        listSmsCredits(businessId),
        getGatewayFeeConfig()
      ]);
      setRequests(r);
      setCredits(c);
      // In a real scenario, we might have a specific SMS price in cfg
      // but the backend purchaseSmsCredits currently uses a hardcoded 20.
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [businessId]);

  async function onSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sender_id || !form.company_name) return;
    setRequesting(true);
    try {
      await createSenderIdRequest({ 
        business_id: businessId, 
        company_name: form.company_name, 
        sender_id: form.sender_id,
        usage_note: form.usage_note
      });
      toast.success("Demande de Nom d'envoi soumise ✅");
      setForm({ company_name: "", sender_id: "", usage_note: "" });
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRequesting(false);
    }
  }

  async function onPurchase() {
    if (!buySender || buyQty <= 0) return;
    setPurchasing(true);
    try {
      const res = await purchaseSmsCredits({ 
        business_id: businessId, 
        sender_id: buySender, 
        quantity: buyQty 
      });
      toast.success(`${buyQty} SMS ajoutés à votre compte ✅`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPurchasing(false);
    }
  }

  const approvedSenders = requests.filter(r => r.status === 'approved');

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {/* Demande de Sender ID */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="font-bold flex items-center gap-2 mb-4 italic uppercase text-xs tracking-widest text-primary">
            <Plus className="h-4 w-4" /> Demander un Nom d'envoi (Sender ID)
          </h4>
          <form onSubmit={onSubmitRequest} className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Nom de l'entreprise</label>
              <input 
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="Ex: Ma Boutique SARL"
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Sender ID (max 11 car.)</label>
              <input 
                value={form.sender_id}
                onChange={e => setForm(f => ({ ...f, sender_id: e.target.value }))}
                placeholder="Ex: BOUTIQUE"
                maxLength={11}
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Usage prévu</label>
              <textarea 
                value={form.usage_note}
                onChange={e => setForm(f => ({ ...f, usage_note: e.target.value }))}
                placeholder="Ex: Notifications de commande et promotions"
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm outline-none focus:border-primary"
                rows={2}
              />
            </div>
            <button 
              type="submit" 
              disabled={requesting}
              className="w-full rounded-full bg-gradient-primary py-2.5 text-xs font-black text-primary-foreground shadow-glow disabled:opacity-50 transition-all active:scale-95"
            >
              {requesting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Soumettre la demande"}
            </button>
            <p className="text-[10px] text-muted-foreground italic text-center mt-2">La validation peut prendre 24 à 48h. Une notification SMS vous sera envoyée.</p>
          </form>
        </section>

        {/* Historique des demandes */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="font-bold flex items-center gap-2 mb-4 italic uppercase text-xs tracking-widest text-primary">
            <Clock className="h-4 w-4" /> Statut de vos demandes
          </h4>
          <div className="space-y-2">
            {requests.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">Aucune demande soumise.</p>}
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-2">
                <div>
                  <p className="text-sm font-bold tracking-tight uppercase">{r.sender_id}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === 'pending' && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full"><Clock className="h-3 w-3" /> En attente</span>}
                  {r.status === 'approved' && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> Approuvé</span>}
                  {r.status === 'rejected' && <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full"><XCircle className="h-3 w-3" /> Refusé</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        {/* Achat de crédits */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="font-bold flex items-center gap-2 mb-4 italic uppercase text-xs tracking-widest text-primary">
            <Wallet className="h-4 w-4" /> Acheter des crédits SMS
          </h4>
          {approvedSenders.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-xs font-medium leading-relaxed">
                Vous devez avoir au moins un Nom d'envoi (Sender ID) **approuvé** avant de pouvoir acheter des crédits et envoyer des SMS.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Choisir le Sender ID</label>
                <select 
                  value={buySender}
                  onChange={e => setBuySender(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Sélectionnez un nom...</option>
                  {approvedSenders.map(r => (
                    <option key={r.id} value={r.sender_id}>{r.sender_id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Quantité de SMS</label>
                <input 
                  type="number"
                  min={100}
                  step={100}
                  value={buyQty}
                  onChange={e => setBuyQty(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex justify-between text-xs mb-1">
                  <span>Prix unitaire</span>
                  <span className="font-bold">{smsPrice} XOF</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-primary/20 pt-2">
                  <span>TOTAL À PAYER</span>
                  <span>{(buyQty * smsPrice).toLocaleString()} XOF</span>
                </div>
              </div>
              <button 
                onClick={onPurchase}
                disabled={purchasing || !buySender || buyQty < 100}
                className="w-full rounded-full bg-gradient-primary py-2.5 text-xs font-black text-primary-foreground shadow-glow disabled:opacity-50 transition-all active:scale-95"
              >
                {purchasing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Acheter maintenant"}
              </button>
              <p className="text-[10px] text-muted-foreground italic text-center">Le montant sera débité de votre solde business FASO-INVEST PAY.</p>
            </div>
          )}
        </section>

        {/* Crédits actuels */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="font-bold flex items-center gap-2 mb-4 italic uppercase text-xs tracking-widest text-primary">
            <Send className="h-4 w-4" /> Vos crédits par nom d'envoi
          </h4>
          <div className="space-y-2">
            {credits.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">Aucun crédit acheté.</p>}
            {credits.map(c => (
              <div key={c.id} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-surface-2 to-surface-1 border border-border">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Sender: <span className="text-foreground">{c.sender_id}</span></p>
                  <p className="text-2xl font-black tracking-tight italic tabular-nums">{c.balance.toLocaleString()} <span className="text-[10px] font-medium not-italic">SMS RESTANTS</span></p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

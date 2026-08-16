import { useState } from "react";
import { X, ShoppingBag, Store, ShieldCheck, Loader2 } from "lucide-react";
import { MomoPayment } from "./momo-payment";
import { initShopCheckout } from "@/lib/pay.functions";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Product = { 
  id: string; 
  name: string; 
  slug: string; 
  description: string | null; 
  price: number; 
  currency: string; 
  project_id?: string | null; 
  media?: Array<{ url: string; type: string }>;
  type?: string;
};

type Biz = {
  id: string; name: string; slug: string; description: string | null; tagline?: string | null;
  logo_url: string | null; cover_url?: string | null; contact_email: string | null; contact_phone: string | null;
  theme?: { bg?: string; surface?: string; text?: string; muted?: string; primary?: string; primary_text?: string };
};

export function ProductDetailModal({ 
  product, 
  biz, 
  onClose 
}: { 
  product: Product; 
  biz: Biz; 
  onClose: () => void 
}) {
  const navigate = useNavigate();
  const th = biz.theme || { bg: "#0b0b0f", surface: "#15151c", text: "#f5f5f7", muted: "#a1a1aa", primary: "#f97316", primary_text: "#ffffff" };
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", address: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<{ reference: string; amount: number; currency: string; order_token: string; checkoutUrl?: string } | null>(null);

  const mainMedia = product.media?.[0]?.url;
  const otherMedia = (product.media || []).slice(1);

  async function checkout() {
    if (!customer.email) { setError("Email requis pour recevoir le reçu"); return; }
    setSubmitting(true); setError(null);
    try {
      const items = [{ product_id: product.id, quantity: 1 }];
      const r: any = await initShopCheckout({
        business_slug: biz.slug, items,
        customer_email: customer.email,
        customer_name: customer.name || undefined,
        customer_phone: customer.phone || undefined,
        shipping_address: customer.address || undefined,
        customer_note: customer.note || undefined,
      });
      if (!r?.reference) throw new Error("Paiement indisponible pour le moment");
      
      if (r.checkoutUrl) {
        console.log("Redirecting to:", r.checkoutUrl);
        window.location.href = r.checkoutUrl;
        return;
      }
      
      setPay({ reference: r.reference, amount: Number(r.amount), currency: r.currency, order_token: r.order_token });
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2rem] shadow-2xl flex flex-col md:flex-row" 
           style={{ background: th.bg, color: th.text, border: `1px solid ${th.primary}33` }}>
        
        <button onClick={onClose} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70">
          <X className="h-5 w-5" />
        </button>

        {/* Media Gallery */}
        <div className="w-full md:w-1/2 overflow-y-auto bg-black/20">
          {mainMedia ? (
            <div className="space-y-2 p-2">
              <img src={mainMedia} alt={product.name} className="w-full rounded-2xl object-cover aspect-square" />
              <div className="grid grid-cols-2 gap-2">
                {otherMedia.map((m, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden">
                    {m.type?.includes('video') ? (
                      <video src={m.url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={m.url} className="w-full h-full object-cover" alt="" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="aspect-square grid place-items-center" style={{ background: `${th.primary}12` }}>
              <Store className="h-20 w-20 opacity-20" style={{ color: th.primary }} />
            </div>
          )}
        </div>

        {/* Details & Checkout */}
        <div className="w-full md:w-1/2 flex flex-col p-6 sm:p-8 overflow-y-auto border-l" style={{ borderColor: `${th.primary}22` }}>
          {pay ? (
            <div className="flex flex-col h-full">
              <h2 className="text-2xl font-bold mb-6">Paiement</h2>
              {pay.checkoutUrl ? (
                <div className="text-center py-12 flex-1">
                  <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                  <p className="mt-6 font-bold text-lg">Redirection vers YengaPay...</p>
                  <p className="mt-2 text-sm" style={{ color: th.muted }}>Veuillez patienter...</p>
                  <a href={pay.checkoutUrl} className="mt-8 inline-block text-sm underline" style={{ color: th.primary }}>Cliquer ici si la redirection ne fonctionne pas</a>
                </div>
              ) : (
                <div className="flex-1">
                  <MomoPayment
                    reference={pay.reference} amount={pay.amount} currency={pay.currency} defaultPhone={customer.phone}
                    onSuccess={() => {
                      toast.success("Paiement réussi !");
                      setTimeout(() => navigate(`/order/${pay.order_token}`), 1500);
                    }}
                    onCancel={() => setPay(null)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <h2 className="text-3xl font-bold font-[Space_Grotesk] leading-tight">{product.name}</h2>
                <div className="mt-2 inline-flex items-center gap-2">
                  <span className="text-2xl font-bold tabular-nums">{Number(product.price).toLocaleString("fr-FR")}</span>
                  <span className="text-sm font-medium" style={{ color: th.muted }}>{product.currency}</span>
                </div>
                
                <div className="mt-6 space-y-4">
                  <div className="p-4 rounded-2xl" style={{ background: th.surface }}>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: th.primary }}>Description</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: th.muted }}>
                      {product.description || "Aucune description détaillée disponible."}
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: th.primary }}>Vos informations</h4>
                  <input value={customer.email} onChange={(e) => setCustomer(c => ({ ...c, email: e.target.value }))} 
                         type="email" placeholder="Email * (pour le reçu)" 
                         className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                         style={{ background: th.surface, borderColor: `${th.primary}44`, '--tw-ring-color': th.primary } as any} />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <input value={customer.name} onChange={(e) => setCustomer(c => ({ ...c, name: e.target.value }))} 
                           placeholder="Nom complet" 
                           className="rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                           style={{ background: th.surface, borderColor: `${th.primary}44`, '--tw-ring-color': th.primary } as any} />
                    
                    <input value={customer.phone} onChange={(e) => setCustomer(c => ({ ...c, phone: e.target.value }))} 
                           placeholder="Téléphone" 
                           className="rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                           style={{ background: th.surface, borderColor: `${th.primary}44`, '--tw-ring-color': th.primary } as any} />
                  </div>
                  
                  <input value={customer.address} onChange={(e) => setCustomer(c => ({ ...c, address: e.target.value }))} 
                         placeholder="Adresse de livraison (si produit physique)" 
                         className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                         style={{ background: th.surface, borderColor: `${th.primary}44`, '--tw-ring-color': th.primary } as any} />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t" style={{ borderColor: `${th.primary}22` }}>
                {error && <p className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">{error}</p>}
                
                <button onClick={checkout} disabled={submitting || !customer.email}
                        className="w-full flex items-center justify-center gap-2 rounded-full py-4 text-base font-bold shadow-lg transition transform active:scale-95 disabled:opacity-50"
                        style={{ background: th.primary, color: th.primary_text }}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      <ShoppingBag className="h-5 w-5" />
                      Commander maintenant
                    </>
                  )}
                </button>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px]" style={{ color: th.muted }}>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Transaction 100% sécurisée
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

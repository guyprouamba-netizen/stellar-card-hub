import React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
}

interface InvoiceData {
  number: string;
  created_at: string;
  due_date?: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone?: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string;
}

interface BusinessData {
  name: string;
  logo_url?: string;
  description?: string;
  theme?: any;
}

interface SettingsData {
  legal_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  ifu?: string;
  rccm?: string;
}

interface TemplateProps {
  invoice: InvoiceData;
  business: BusinessData;
  settings: SettingsData;
}

// 1. STRIPE MODERN
export const StripeModern = ({ invoice, business, settings }: TemplateProps) => {
  const primaryColor = business.theme?.primary || "#6366f1";
  
  return (
    <div className="bg-white p-8 sm:p-12 text-slate-900 font-sans max-w-4xl mx-auto shadow-sm border border-slate-100 rounded-xl">
      <div className="flex justify-between items-start">
        <div>
          {business.logo_url ? (
            <img src={business.logo_url} alt="Logo" className="h-12 w-auto mb-6" />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xl mb-6">
              {business.name[0]}
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">Facture {invoice.number}</h1>
          <p className="text-slate-500 mt-1">Émis le {format(new Date(invoice.created_at), 'dd MMMM yyyy', { locale: fr })}</p>
        </div>
        <div className="text-right">
          <div className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider mb-4">
            {invoice.total.toLocaleString('fr-FR')} {invoice.currency}
          </div>
          <p className="font-bold text-slate-900">{settings.legal_name || business.name}</p>
          <p className="text-slate-500 text-sm">{settings.address || "Ouagadougou, Burkina Faso"}</p>
          {settings.ifu && <p className="text-slate-400 text-xs mt-1">IFU: {settings.ifu}</p>}
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-8 border-t border-slate-100 pt-8">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Facturé à</h3>
          <p className="font-bold">{invoice.customer_name || "Client"}</p>
          <p className="text-slate-500 text-sm">{invoice.customer_email}</p>
          <p className="text-slate-500 text-sm">{invoice.customer_phone}</p>
        </div>
        <div className="text-right">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Détails de paiement</h3>
          <p className="text-slate-500 text-sm">Mode : Mobile Money / Virement</p>
          <p className="text-slate-500 text-sm">Échéance : {invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yyyy') : "Immédiat"}</p>
        </div>
      </div>

      <table className="w-full mt-12 text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-400">
            <th className="text-left py-3 font-medium">Description</th>
            <th className="text-right py-3 font-medium">Qté</th>
            <th className="text-right py-3 font-medium">Prix</th>
            <th className="text-right py-3 font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoice.items.map((item, i) => (
            <tr key={i}>
              <td className="py-4 font-medium text-slate-900">{item.name}</td>
              <td className="py-4 text-right text-slate-500">{item.qty}</td>
              <td className="py-4 text-right text-slate-500">{item.price.toLocaleString('fr-FR')}</td>
              <td className="py-4 text-right font-medium">{(item.qty * item.price).toLocaleString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 flex justify-end">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-slate-500">
            <span>Sous-total</span>
            <span>{invoice.subtotal.toLocaleString('fr-FR')} {invoice.currency}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>TVA ({invoice.tax > 0 ? '18%' : '0%'})</span>
            <span>{invoice.tax.toLocaleString('fr-FR')} {invoice.currency}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold text-slate-900">
            <span>Total</span>
            <span style={{ color: primaryColor }}>{invoice.total.toLocaleString('fr-FR')} {invoice.currency}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-12 p-4 bg-slate-50 rounded-lg text-xs text-slate-500 leading-relaxed">
          <p className="font-bold text-slate-700 mb-1">Notes</p>
          {invoice.notes}
        </div>
      )}

      <footer className="mt-16 pt-8 border-t border-slate-100 text-center text-[10px] text-slate-400 uppercase tracking-widest">
        {settings.legal_name || business.name} — {settings.rccm ? `RCCM ${settings.rccm}` : "FASO INVEST PAY MERCHANT"}
      </footer>
    </div>
  );
};

// 2. APPLE MINIMAL
export const AppleMinimal = ({ invoice, business, settings }: TemplateProps) => {
  return (
    <div className="bg-white p-12 text-black font-sans max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-20">
        <h1 className="text-4xl font-black tracking-tighter">Reçu</h1>
        <div className="text-right">
          <p className="text-3xl font-light">{business.name}</p>
          <p className="text-slate-400 text-sm mt-1">{format(new Date(invoice.created_at), 'd MMM yyyy', { locale: fr })}</p>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-sm font-bold border-b border-black pb-2 mb-4">DÉTAILS DE LA COMMANDE</h2>
          <div className="flex justify-between items-center text-sm">
            <span>Numéro de facture</span>
            <span className="font-mono">{invoice.number}</span>
          </div>
        </div>

        <div className="space-y-4">
          {invoice.items.map((item, i) => (
            <div key={i} className="flex justify-between items-end py-2">
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="text-xs text-slate-500">Quantité : {item.qty}</p>
              </div>
              <p className="font-medium">{(item.qty * item.price).toLocaleString('fr-FR')} {invoice.currency}</p>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-slate-100 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Sous-total</span>
            <span>{invoice.subtotal.toLocaleString('fr-FR')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Taxes</span>
            <span>{invoice.tax.toLocaleString('fr-FR')}</span>
          </div>
          <div className="flex justify-between text-xl font-black pt-4">
            <span>TOTAL</span>
            <span>{invoice.total.toLocaleString('fr-FR')} {invoice.currency}</span>
          </div>
        </div>
      </div>

      <div className="mt-20 text-[10px] text-slate-400 leading-relaxed">
        <p>Ce document confirme votre achat auprès de {settings.legal_name || business.name}.</p>
        {settings.ifu && <p className="mt-1">Identifiant Fiscal : {settings.ifu}</p>}
        <p className="mt-4">Besoin d'aide ? Contactez notre support merchant via FASO INVEST PAY.</p>
      </div>
    </div>
  );
};

// 3. POS THERMAL (Ticket de caisse)
export const BistroThermal = ({ invoice, business }: TemplateProps) => {
  return (
    <div className="bg-white p-6 text-black font-mono max-w-[320px] mx-auto text-xs border border-dashed border-slate-300">
      <div className="text-center mb-6">
        <h2 className="text-sm font-bold uppercase">{business.name}</h2>
        <p>{business.description || "Merci de votre visite"}</p>
        <p className="mt-2">----------------------------</p>
        <p>TICKET #{invoice.number.slice(-6)}</p>
        <p>{format(new Date(invoice.created_at), 'dd/MM/yyyy HH:mm')}</p>
        <p>----------------------------</p>
      </div>

      <div className="space-y-2">
        {invoice.items.map((item, i) => (
          <div key={i} className="flex justify-between">
            <span className="truncate flex-1">{item.name} x{item.qty}</span>
            <span className="ml-2">{(item.qty * item.price).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-dashed border-black pt-4 space-y-1">
        <div className="flex justify-between">
          <span>SOUS-TOTAL:</span>
          <span>{invoice.subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL:</span>
          <span>{invoice.total.toLocaleString()} {invoice.currency}</span>
        </div>
      </div>

      <div className="text-center mt-8">
        <p>MERCI ET A BIENTOT !</p>
        <div className="mt-4 flex justify-center">
          {/* Simulation d'un QR Code */}
          <div className="h-16 w-16 bg-black"></div>
        </div>
        <p className="mt-2 text-[8px] text-slate-500">Propulsé par FASO INVEST PAY</p>
      </div>
    </div>
  );
};

// 4. AMAZON RETAIL
export const AmazonRetail = ({ invoice, business, settings }: TemplateProps) => {
  return (
    <div className="bg-white p-8 text-slate-900 font-sans max-w-4xl mx-auto border border-slate-200">
      <div className="flex justify-between border-b-2 border-slate-900 pb-4 mb-8">
        <h1 className="text-3xl font-bold italic">amazon.pay</h1>
        <div className="text-right text-sm">
          <p className="font-bold">Détails de la commande</p>
          <p>Commande n° {invoice.number}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-8 mb-8 text-sm">
        <div>
          <p className="font-bold mb-1 border-b border-slate-200 pb-1">Adresse de facturation</p>
          <p>{invoice.customer_name}</p>
          <p className="text-slate-500">{invoice.customer_email}</p>
        </div>
        <div>
          <p className="font-bold mb-1 border-b border-slate-200 pb-1">Mode de paiement</p>
          <p>YengaPay (Mobile Money)</p>
        </div>
        <div>
          <p className="font-bold mb-1 border-b border-slate-200 pb-1">Récapitulatif</p>
          <div className="flex justify-between">
            <span>Articles :</span>
            <span>{invoice.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold mt-2 pt-2 border-t border-slate-200">
            <span>Total :</span>
            <span>{invoice.total.toLocaleString()} {invoice.currency}</span>
          </div>
        </div>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Article</th>
            <th className="p-2 text-right">Prix</th>
            <th className="p-2 text-right">Qté</th>
            <th className="p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoice.items.map((item, i) => (
            <tr key={i}>
              <td className="p-2">{item.name}</td>
              <td className="p-2 text-right">{item.price.toLocaleString()}</td>
              <td className="p-2 text-right">{item.qty}</td>
              <td className="p-2 text-right">{(item.qty * item.price).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// 5. GOUVERNEMENTAL (Standard officiel)
export const GovStandard = ({ invoice, business, settings }: TemplateProps) => {
  return (
    <div className="bg-white p-12 text-black font-serif max-w-4xl mx-auto border-4 border-double border-black">
      <div className="text-center mb-12">
        <h2 className="text-xl font-bold uppercase underline decoration-double underline-offset-4">Burkina Faso</h2>
        <p className="text-sm italic">Unité - Progrès - Justice</p>
        <div className="mt-8 flex justify-between items-start text-left text-xs uppercase font-bold">
          <div>
            <p>{settings.legal_name || business.name}</p>
            <p>IFU: {settings.ifu || "00000000X"}</p>
            <p>RCCM: {settings.rccm || "BF OUA 2024 B 000"}</p>
          </div>
          <div className="text-right">
            <p>Facture n° {invoice.number}</p>
            <p>Date: {format(new Date(invoice.created_at), 'dd/MM/yyyy')}</p>
          </div>
        </div>
      </div>
      <div className="mb-8 p-4 border border-black bg-slate-50">
        <p className="text-sm font-bold">DOIT: {invoice.customer_name}</p>
      </div>
      <table className="w-full border-collapse border border-black text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-black p-2 text-left">Désignation</th>
            <th className="border border-black p-2 text-right w-24">Quantité</th>
            <th className="border border-black p-2 text-right w-32">Prix Unitaire</th>
            <th className="border border-black p-2 text-right w-32">Montant</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i}>
              <td className="border border-black p-2">{item.name}</td>
              <td className="border border-black p-2 text-right">{item.qty}</td>
              <td className="border border-black p-2 text-right">{item.price.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{(item.qty * item.price).toLocaleString()}</td>
            </tr>
          ))}
          {[...Array(Math.max(0, 5 - invoice.items.length))].map((_, i) => (
            <tr key={`blank-${i}`} className="h-8">
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="border border-black p-2 text-right font-bold uppercase">Net à Payer</td>
            <td className="border border-black p-2 text-right font-bold">{invoice.total.toLocaleString()} {invoice.currency}</td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-12 text-xs italic">
        <p>Arrêtée la présente facture à la somme de : {invoice.total.toLocaleString()} {invoice.currency}</p>
      </div>
    </div>
  );
};

// 6. STRIPE VINTAGE
export const StripeVintage = ({ invoice, business }: TemplateProps) => (
  <div className="bg-[#fcfcfc] p-10 font-serif max-w-2xl mx-auto border border-slate-200 shadow-xl">
    <div className="flex justify-between border-b pb-6">
      <h2 className="text-2xl font-bold uppercase tracking-widest">{business.name}</h2>
      <div className="text-right text-xs text-slate-500">
        <p>INVOICE #{invoice.number}</p>
        <p>{format(new Date(invoice.created_at), 'MMMM d, yyyy')}</p>
      </div>
    </div>
    <div className="mt-8">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b uppercase text-[10px] text-slate-400">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoice.items.map((it, i) => (
            <tr key={i} className="text-sm">
              <td className="py-3">{it.name} x{it.qty}</td>
              <td className="py-3 text-right">{(it.qty * it.price).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// 7. PAYPAL STATEMENT
export const PaypalStatement = ({ invoice, business }: TemplateProps) => (
  <div className="bg-white p-8 max-w-3xl mx-auto border border-blue-100">
    <div className="bg-blue-600 p-6 -m-8 mb-8 text-white">
      <h2 className="text-xl font-bold">PayPal</h2>
      <p className="text-sm opacity-90">Merchant Transaction Statement</p>
    </div>
    <div className="flex justify-between items-center mb-8">
      <div className="text-sm">
        <p className="font-bold text-slate-600">INVOICE TO</p>
        <p className="font-bold text-lg">{invoice.customer_name}</p>
      </div>
      <div className="text-right">
        <p className="text-3xl font-bold text-blue-600">{invoice.total.toLocaleString()} {invoice.currency}</p>
      </div>
    </div>
    <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-full hover:bg-blue-700">
      Pay Now
    </button>
  </div>
);

// Add more templates...

// 8. QONTO MODERN
export const QontoModern = ({ invoice, business, settings }: TemplateProps) => (
  <div className="bg-white p-12 max-w-4xl mx-auto text-slate-900 border border-slate-100 rounded-3xl">
    <div className="flex justify-between items-start mb-16">
      <div className="bg-indigo-600 text-white p-4 rounded-2xl font-black text-2xl w-16 h-16 flex items-center justify-center">Q</div>
      <div className="text-right">
        <h2 className="text-4xl font-black tracking-tight">{invoice.total.toLocaleString()} {invoice.currency}</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Facture #{invoice.number}</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-12 mb-16">
      <div>
        <p className="text-slate-400 text-xs font-bold uppercase mb-4">Émetteur</p>
        <p className="font-bold">{settings.legal_name || business.name}</p>
        <p className="text-slate-500 text-sm">{settings.address}</p>
      </div>
      <div>
        <p className="text-slate-400 text-xs font-bold uppercase mb-4">Client</p>
        <p className="font-bold">{invoice.customer_name}</p>
        <p className="text-slate-500 text-sm">{invoice.customer_email}</p>
      </div>
    </div>
    <div className="space-y-4">
      {invoice.items.map((it, i) => (
        <div key={i} className="flex justify-between py-4 border-b border-slate-100">
          <span className="font-medium">{it.name} <span className="text-slate-400 ml-2">x{it.qty}</span></span>
          <span className="font-bold">{(it.qty * it.price).toLocaleString()}</span>
        </div>
      ))}
    </div>
  </div>
);

// 9. UBER RECEIPT
export const UberReceipt = ({ invoice, business }: TemplateProps) => (
  <div className="bg-white p-6 max-w-md mx-auto font-sans shadow-lg border-t-8 border-black">
    <div className="flex justify-between items-center mb-10">
      <h1 className="text-3xl font-bold tracking-tighter">Uber</h1>
      <p className="text-slate-400 text-sm">{format(new Date(invoice.created_at), 'dd/MM/yyyy')}</p>
    </div>
    <h2 className="text-4xl font-bold mb-6">{invoice.total.toLocaleString()} {invoice.currency}</h2>
    <div className="space-y-4 text-sm border-t border-b py-6 border-slate-100">
      {invoice.items.map((it, i) => (
        <div key={i} className="flex justify-between">
          <span className="text-slate-600">{it.name}</span>
          <span className="font-bold">{(it.qty * it.price).toLocaleString()}</span>
        </div>
      ))}
    </div>
    <div className="mt-6 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-200" />
      <div>
        <p className="font-bold">YengaPay Personal</p>
        <p className="text-xs text-slate-400">•••• 1234</p>
      </div>
    </div>
  </div>
);

// 10. LUXE MAISON (Style Chanel/Vuitton)
export const LuxeMaison = ({ invoice, business }: TemplateProps) => (
  <div className="bg-[#1a1a1a] p-16 text-white font-serif max-w-4xl mx-auto tracking-widest uppercase text-center">
    <h1 className="text-5xl font-light mb-16 tracking-[0.3em]">{business.name}</h1>
    <div className="border-t border-white/20 pt-12 mb-12 flex justify-between text-[10px] opacity-60">
      <span>Facture N°{invoice.number}</span>
      <span>{format(new Date(invoice.created_at), 'dd . MM . yyyy')}</span>
    </div>
    <div className="space-y-8 my-20">
      {invoice.items.map((it, i) => (
        <div key={i} className="flex justify-between items-center group">
          <span className="text-xl font-light">{it.name}</span>
          <span className="text-xl">{(it.qty * it.price).toLocaleString()} {invoice.currency}</span>
        </div>
      ))}
    </div>
    <div className="border-t border-white/20 pt-12">
      <p className="text-3xl font-light">{invoice.total.toLocaleString()} {invoice.currency}</p>
      <p className="text-[8px] mt-20 opacity-40 italic underline underline-offset-8">Merci de votre confiance</p>
    </div>
  </div>
);

// 11. GOOGLE CLOUD
export const GoogleCloud = ({ invoice, business, settings }: TemplateProps) => (
  <div className="bg-white p-10 max-w-4xl mx-auto border border-slate-200 font-sans text-slate-800">
    <div className="flex justify-between items-start mb-10">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">G</div>
        <span className="text-xl font-bold text-slate-500">Google Cloud</span>
      </div>
      <div className="text-right">
        <h2 className="text-2xl font-light">Facture de taxes</h2>
        <p className="text-sm text-slate-400">Date de la facture : {format(new Date(invoice.created_at), 'd MMM yyyy')}</p>
      </div>
    </div>
    <div className="bg-slate-50 p-6 rounded-lg mb-10 flex justify-between">
      <div>
        <p className="text-xs font-bold text-slate-400 mb-2">Compte de facturation</p>
        <p className="font-bold">{invoice.customer_name}</p>
        <p className="text-sm text-slate-500">{invoice.customer_email}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold text-slate-400 mb-2">Total dû</p>
        <p className="text-3xl font-bold">{invoice.total.toLocaleString()} {invoice.currency}</p>
      </div>
    </div>
    <table className="w-full text-sm">
      <thead className="border-b-2 border-slate-800">
        <tr className="text-left font-bold">
          <th className="py-2">Description</th>
          <th className="py-2 text-right">Montant ({invoice.currency})</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {invoice.items.map((it, i) => (
          <tr key={i}>
            <td className="py-4">
              <p className="font-bold">{it.name}</p>
              <p className="text-xs text-slate-400 italic">Usage du {format(new Date(invoice.created_at), 'MM/yyyy')}</p>
            </td>
            <td className="py-4 text-right">{(it.qty * it.price).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// 12. AIRBNB HOST
export const AirbnbHost = ({ invoice, business }: TemplateProps) => (
  <div className="bg-white p-12 max-w-3xl mx-auto font-sans text-slate-900 border border-slate-100 rounded-lg shadow-2xl">
    <div className="flex justify-between items-center mb-16">
      <div className="text-rose-500">
        <svg viewBox="0 0 32 32" className="w-10 h-10 fill-current"><path d="M16 1c2.008 0 3.463.963 4.751 3.269l.533 1.025c1.954 3.83 6.114 12.54 7.1 14.836l.145.353c.667 1.591.91 2.472.96 3.396l.01.415.001.228c0 4.062-2.877 6.478-6.357 6.478-2.224 0-4.556-1.258-6.709-3.386l-.257-.26-.172-.179h-.011l-.176.185c-2.044 2.1-4.392 3.42-6.72 3.42-3.481 0-6.358-2.416-6.358-6.478l.002-.232c.036-1.12.336-2.186.883-3.665l.182-.47c1.116-2.73 5.342-11.75 7.152-15.356l.519-1.026C12.537 1.963 13.992 1 16 1zm0 2c-1.239 0-2.253.539-3.235 2.292l-.503 1c-1.745 3.472-5.908 12.355-7.008 15.044l-.155.404c-.53 1.433-.767 2.333-.797 3.232l-.002.228c0 2.924 1.977 4.478 4.358 4.478 1.706 0 3.659-1.076 5.617-3.03l.317-.323.315-.327-.315-.327-.317-.323c-1.958-1.954-3.911-3.03-5.617-3.03-2.381 0-4.358 1.554-4.358 4.478l.002.228c.03.899.267 1.799.797 3.232l.155.404c1.1 2.689 5.263 11.572 7.008 15.044l.503 1c.982 1.753 1.996 2.292 3.235 2.292z"/></svg>
      </div>
      <div className="text-right">
        <p className="text-slate-400 uppercase font-bold text-xs">Reçu d'hôte</p>
        <p className="font-bold">Facture #{invoice.number}</p>
      </div>
    </div>
    <div className="mb-12">
      <h2 className="text-4xl font-bold tracking-tight mb-2">Félicitations, {invoice.customer_name}!</h2>
      <p className="text-slate-500">Votre paiement a été traité avec succès via {business.name}.</p>
    </div>
    <div className="bg-slate-50 p-8 rounded-2xl space-y-4">
      {invoice.items.map((it, i) => (
        <div key={i} className="flex justify-between items-center border-b border-slate-200 pb-4 last:border-0 last:pb-0">
          <div>
            <p className="font-bold text-lg">{it.name}</p>
            <p className="text-slate-500 text-sm">{it.qty} nuit(s)</p>
          </div>
          <p className="font-bold text-lg">{(it.qty * it.price).toLocaleString()} {invoice.currency}</p>
        </div>
      ))}
    </div>
    <div className="mt-12 text-center text-xs text-slate-400">
      <p>Besoin d'aide ? Consultez le centre d'aide Airbnb ou contactez l'hôte.</p>
    </div>
  </div>
);

// 13. WISE BORDERLESS
export const WiseBorderless = ({ invoice, business, settings }: TemplateProps) => (
  <div className="bg-[#252c32] p-10 max-w-4xl mx-auto text-white font-sans border border-slate-700">
    <div className="flex justify-between items-start mb-16">
      <div className="bg-[#00b9ff] text-white px-4 py-2 font-black text-xl italic">Wise</div>
      <div className="text-right">
        <p className="text-[#00b9ff] font-bold">Transaction confirmée</p>
        <p className="text-sm opacity-50">{format(new Date(invoice.created_at), 'd MMM yyyy, HH:mm')}</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-10 mb-16">
      <div>
        <p className="text-xs opacity-50 uppercase mb-2">Émetteur</p>
        <p className="font-bold text-xl">{settings.legal_name || business.name}</p>
      </div>
      <div>
        <p className="text-xs opacity-50 uppercase mb-2">Bénéficiaire</p>
        <p className="font-bold text-xl">{invoice.customer_name}</p>
      </div>
    </div>
    <div className="bg-white/5 p-8 border border-white/10 space-y-6">
      <div className="flex justify-between text-2xl font-bold">
        <span className="opacity-50 font-normal">Montant envoyé</span>
        <span>{invoice.subtotal.toLocaleString()} {invoice.currency}</span>
      </div>
      <div className="flex justify-between text-sm opacity-50 italic">
        <span>Frais Wise (0.4%)</span>
        <span>- {(invoice.subtotal * 0.004).toLocaleString()} {invoice.currency}</span>
      </div>
      <div className="flex justify-between text-3xl font-black text-[#00b9ff] pt-6 border-t border-white/10">
        <span>Le bénéficiaire reçoit</span>
        <span>{(invoice.total - (invoice.subtotal * 0.004)).toLocaleString()} {invoice.currency}</span>
      </div>
    </div>
  </div>
);

// Map of all templates
export const INVOICE_TEMPLATES: Record<string, React.FC<TemplateProps>> = {
  "stripe-modern": StripeModern,
  "apple-minimal": AppleMinimal,
  "bistro-thermal": BistroThermal,
  "amazon-retail": AmazonRetail,
  "gov-standard": GovStandard,
  "stripe-vintage": StripeVintage,
  "paypal-statement": PaypalStatement,
  "qonto-modern": QontoModern,
  "uber-receipt": UberReceipt,
  "luxe-maison": LuxeMaison,
  "google-cloud": GoogleCloud,
  "airbnb-host": AirbnbHost,
  "wise-borderless": WiseBorderless,
};

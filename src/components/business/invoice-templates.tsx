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

// Map of all templates
export const INVOICE_TEMPLATES: Record<string, React.FC<TemplateProps>> = {
  "stripe-modern": StripeModern,
  "apple-minimal": AppleMinimal,
  "bistro-thermal": BistroThermal,
  "amazon-retail": AmazonRetail,
  "gov-standard": GovStandard,
};

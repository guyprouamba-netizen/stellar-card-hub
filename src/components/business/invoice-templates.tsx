import React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";

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
  kind?: "invoice" | "receipt" | "contract";
}

const VerificationFooter = ({ business, invoice }: { business: BusinessData, invoice: InvoiceData }) => {
  const verificationUrl = `https://pay.faso-invest.com/verify/${invoice.number}`;
  return (
    <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center justify-center text-center gap-4">
      <div className="flex flex-col items-center gap-2">
        <QRCodeSVG value={verificationUrl} size={64} level="L" includeMargin={false} />
        <p className="text-[8px] text-slate-400 font-mono uppercase tracking-widest">Scanner pour vérifier</p>
      </div>
      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.2em]">
        Généré par <span className="text-primary font-bold">FASO-INVEST PAY</span>
      </p>
      <div className="text-[8px] text-slate-300 italic">
        Authenticité garantie pour le marchand : {business.name}
      </div>
    </div>
  );
};

// 1. STRIPE MODERN
export const StripeModern = ({ invoice, business, settings, kind = "invoice" }: TemplateProps) => {
  const primaryColor = business.theme?.primary || "#6366f1";
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  
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
          <h1 className="text-2xl font-bold text-slate-900">{title} {invoice.number}</h1>
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

      <footer className="mt-8 pt-6 border-t border-slate-100 text-center text-[10px] text-slate-400 uppercase tracking-widest">
        {settings.legal_name || business.name} — {settings.rccm ? `RCCM ${settings.rccm}` : "MERCHANT SERVICE"}
      </footer>

      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 2. APPLE MINIMAL
export const AppleMinimal = ({ invoice, business, settings, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-white p-12 text-black font-sans max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-20">
        <h1 className="text-4xl font-black tracking-tighter">{title}</h1>
        <div className="text-right flex flex-col items-end">
          {business.logo_url ? (
            <img src={business.logo_url} alt="Logo" className="h-8 w-auto mb-2 grayscale" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs mb-2">
              {business.name[0]}
            </div>
          )}
          <p className="text-2xl font-light">{business.name}</p>
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
        <p className="mt-4">Besoin d'aide ? Contactez notre support via le marchand.</p>
      </div>

      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 3. POS THERMAL (Ticket de caisse)
export const BistroThermal = ({ invoice, business, kind = "receipt" }: TemplateProps) => {
  return (
    <div className="bg-white p-6 text-black font-mono max-w-[320px] mx-auto text-xs border border-dashed border-slate-300">
      <div className="text-center mb-6 flex flex-col items-center">
        {business.logo_url ? (
          <img src={business.logo_url} alt="Logo" className="h-10 w-auto mb-2 grayscale contrast-200" />
        ) : null}
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
          <QRCodeSVG value={`https://pay.faso-invest.com/verify/${invoice.number}`} size={64} />
        </div>
        <p className="mt-2 text-[8px] text-slate-500 font-bold">Généré par FASO-INVEST PAY</p>
      </div>
    </div>
  );
};

// 4. AMAZON RETAIL
export const AmazonRetail = ({ invoice, business, settings, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-white p-8 text-slate-900 font-sans max-w-4xl mx-auto border border-slate-200">
      <div className="flex justify-between border-b-2 border-slate-900 pb-4 mb-8">
        <h1 className="text-3xl font-bold italic">amazon.pay</h1>
        <div className="text-right text-sm">
          <p className="font-bold">Détails de la commande</p>
          <p>{title} n° {invoice.number}</p>
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
      
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 5. GOUVERNEMENTAL (Standard officiel)
export const GovStandard = ({ invoice, business, settings, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
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
            <p>{title} n° {invoice.number}</p>
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
      
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 6. STRIPE VINTAGE
export const StripeVintage = ({ invoice, business, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
  <div className="bg-[#fcfcfc] p-10 font-serif max-w-2xl mx-auto border border-slate-200 shadow-xl">
    <div className="flex justify-between border-b pb-6">
      <h2 className="text-2xl font-bold uppercase tracking-widest">{business.name}</h2>
      <div className="text-right text-xs text-slate-500">
        <p>{title.toUpperCase()} #{invoice.number}</p>
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
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  </div>
);

// 7. PAYPAL STATEMENT
export const PaypalStatement = ({ invoice, business, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-white p-8 max-w-3xl mx-auto border border-blue-100">
      <div className="bg-blue-600 p-6 -m-8 mb-8 text-white">
        <h2 className="text-xl font-bold">PayPal</h2>
        <p className="text-sm opacity-90">{title} Transaction Statement</p>
      </div>
      <div className="flex justify-between items-center mb-8">
        <div className="text-sm">
          <p className="font-bold text-slate-600">{kind === "receipt" ? "CLIENT" : "INVOICE TO"}</p>
          <p className="font-bold text-lg">{invoice.customer_name}</p>
          <p className="text-slate-500 text-xs mt-1">{invoice.customer_email}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-blue-600">{invoice.total.toLocaleString()} {invoice.currency}</p>
          <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">{invoice.number}</p>
        </div>
      </div>
      
      <div className="space-y-4 mb-8">
        {invoice.items.map((it, i) => (
          <div key={i} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
            <span>{it.name} <span className="text-slate-400">x{it.qty}</span></span>
            <span className="font-bold">{(it.qty * it.price).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-8 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400 italic">Merchant: {business.name}</p>
      </div>

      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// Add more templates...

// 8. QONTO MODERN
export const QontoModern = ({ invoice, business, settings, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-white p-12 max-w-4xl mx-auto text-slate-900 border border-slate-100 rounded-3xl">
      <div className="flex justify-between items-start mb-16">
        <div className="bg-indigo-600 text-white p-4 rounded-2xl font-black text-2xl w-16 h-16 flex items-center justify-center">Q</div>
        <div className="text-right">
          <h2 className="text-4xl font-black tracking-tight">{invoice.total.toLocaleString()} {invoice.currency}</h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">{title} #{invoice.number}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-12 mb-16">
        <div>
          <p className="text-slate-400 text-xs font-bold uppercase mb-4">Émetteur</p>
          <p className="font-bold">{settings.legal_name || business.name}</p>
          <p className="text-slate-500 text-sm">{settings.address}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs font-bold uppercase mb-4">Client</p>
          <p className="font-bold">{invoice.customer_name}</p>
          <p className="text-slate-500 text-sm">{invoice.customer_email}</p>
        </div>
      </div>
      <div className="space-y-4 mb-16">
        {invoice.items.map((it, i) => (
          <div key={i} className="flex justify-between items-center py-4 border-b border-slate-50">
            <span className="font-medium">{it.name} <span className="text-slate-400 ml-2">x{it.qty}</span></span>
            <span className="font-bold">{(it.qty * it.price).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 9. UBER RECEIPT
export const UberReceipt = ({ invoice, business, kind = "receipt" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-white p-6 max-w-md mx-auto font-sans shadow-lg border-t-8 border-black">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold tracking-tighter">Uber</h1>
        <p className="text-slate-400 text-sm">{format(new Date(invoice.created_at), 'dd/MM/yyyy')}</p>
      </div>
      <div className="mb-4">
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{title}</p>
        <h2 className="text-4xl font-bold">{invoice.total.toLocaleString()} {invoice.currency}</h2>
      </div>
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
          <p className="font-bold">Payé via YengaPay</p>
          <p className="text-xs text-slate-400">Réf: {invoice.number}</p>
        </div>
      </div>
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 10. LUXE MAISON (Style Chanel/Vuitton)
export const LuxeMaison = ({ invoice, business, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-[#1a1a1a] p-16 text-white font-serif max-w-4xl mx-auto tracking-widest uppercase text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full border-[20px] border-white/5 pointer-events-none" />
      <h1 className="text-5xl font-light mb-16 tracking-[0.3em]">{business.name}</h1>
      <div className="border-t border-white/20 pt-12 mb-12 flex justify-between text-[10px] opacity-60">
        <span>{title} N°{invoice.number}</span>
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
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 11. GOOGLE CLOUD
export const GoogleCloud = ({ invoice, business, settings, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu de taxes" : kind === "contract" ? "Contrat" : "Facture de taxes";
  return (
    <div className="bg-white p-10 max-w-4xl mx-auto border border-slate-200 font-sans text-slate-800">
      <div className="flex justify-between items-start mb-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">G</div>
          <span className="text-xl font-bold text-slate-500">Google Cloud</span>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-light">{title}</h2>
          <p className="text-sm text-slate-400">Date : {format(new Date(invoice.created_at), 'd MMM yyyy')}</p>
        </div>
      </div>
      <div className="bg-slate-50 p-6 rounded-lg mb-10 flex justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 mb-2">Informations Client</p>
          <p className="font-bold">{invoice.customer_name}</p>
          <p className="text-sm text-slate-500">{invoice.customer_email}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 mb-2">Total dû</p>
          <p className="text-3xl font-bold">{invoice.total.toLocaleString()} {invoice.currency}</p>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Ref: {invoice.number}</p>
        </div>
      </div>
      <table className="w-full text-sm mb-10">
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
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

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

// 14. MICROSOFT AZURE
export const MicrosoftAzure = ({ invoice, business, settings }: TemplateProps) => (
  <div className="bg-white p-12 max-w-4xl mx-auto border border-slate-200 font-sans text-slate-900">
    <div className="flex justify-between items-start mb-12">
      <div className="flex items-center gap-3">
        <div className="grid grid-cols-2 w-8 h-8 gap-0.5">
          <div className="bg-[#f25022]"></div>
          <div className="bg-[#7fba00]"></div>
          <div className="bg-[#00a4ef]"></div>
          <div className="bg-[#ffb900]"></div>
        </div>
        <span className="text-xl font-bold text-slate-600">Microsoft Azure</span>
      </div>
      <div className="text-right">
        <h1 className="text-3xl font-light">Facture</h1>
        <p className="text-slate-500">ID de facture : {invoice.number}</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-20 mb-12">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Vendu à</p>
        <p className="font-bold">{invoice.customer_name}</p>
        <p className="text-sm text-slate-500">{invoice.customer_email}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Total de la facture</p>
        <p className="text-4xl font-light text-blue-600">{invoice.total.toLocaleString()} {invoice.currency}</p>
      </div>
    </div>
    <table className="w-full text-sm border-t border-b border-slate-200">
      <thead>
        <tr className="text-left bg-slate-50">
          <th className="py-3 px-4">Service</th>
          <th className="py-3 px-4 text-right">Quantité</th>
          <th className="py-3 px-4 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {invoice.items.map((it, i) => (
          <tr key={i} className="border-b border-slate-100 last:border-0">
            <td className="py-4 px-4 font-medium">{it.name}</td>
            <td className="py-4 px-4 text-right">{it.qty} unit(s)</td>
            <td className="py-4 px-4 text-right font-bold">{(it.qty * it.price).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="mt-12 text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed">
      Microsoft Azure - {settings.legal_name || business.name} - Tous droits réservés.
    </div>
  </div>
);

// 15. REVOLUT BUSINESS
export const RevolutBusiness = ({ invoice, business, settings }: TemplateProps) => (
  <div className="bg-[#0e0e10] p-12 max-w-4xl mx-auto text-white font-sans border border-white/5 rounded-[2rem]">
    <div className="flex justify-between items-center mb-20">
      <div className="text-2xl font-black italic tracking-tighter">Revolut <span className="text-white/40 font-normal">Business</span></div>
      <div className="bg-white/10 px-4 py-2 rounded-full text-xs font-bold uppercase">Transaction réussie</div>
    </div>
    <div className="mb-20">
      <h2 className="text-6xl font-black tracking-tight mb-4">{invoice.total.toLocaleString()} {invoice.currency}</h2>
      <p className="text-white/40 font-bold uppercase tracking-widest text-sm">Destinataire : {invoice.customer_name}</p>
    </div>
    <div className="grid grid-cols-2 gap-10 border-t border-white/10 pt-10">
      <div>
        <p className="text-white/40 text-xs font-bold uppercase mb-2">Expéditeur</p>
        <p className="font-bold text-lg">{settings.legal_name || business.name}</p>
        <p className="text-white/60 text-sm mt-1">IFU: {settings.ifu}</p>
      </div>
      <div className="text-right">
        <p className="text-white/40 text-xs font-bold uppercase mb-2">Référence</p>
        <p className="font-bold text-lg">{invoice.number}</p>
        <p className="text-white/60 text-sm mt-1">{format(new Date(invoice.created_at), 'dd MMM yyyy')}</p>
      </div>
    </div>
    <div className="mt-20 pt-10 border-t border-white/10 flex justify-center">
      <div className="h-20 w-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center font-bold text-4xl shadow-2xl">R</div>
    </div>
  </div>
);

// 16. NOTAIRE OFFICIEL (Minimalisme strict)
export const NotaireOfficiel = ({ invoice, business, settings }: TemplateProps) => (
  <div className="bg-[#fdfcf9] p-20 max-w-5xl mx-auto text-[#1a1a1a] font-serif border-x border-slate-200">
    <div className="text-center mb-20">
      <h1 className="text-3xl font-light uppercase tracking-[0.5em] border-b border-black pb-8 inline-block">Office Notarial</h1>
      <p className="mt-8 text-sm italic">{settings.legal_name || business.name}</p>
      <p className="text-xs uppercase tracking-widest mt-2">{settings.address}</p>
    </div>
    <div className="flex justify-between items-end mb-20 text-sm italic">
      <div>
        <p>A l'attention de M/Mme</p>
        <p className="font-bold text-lg not-italic">{invoice.customer_name}</p>
      </div>
      <div className="text-right">
        <p>Ouagadougou, le {format(new Date(invoice.created_at), 'dd MMMM yyyy', { locale: fr })}</p>
        <p className="mt-1 font-bold not-italic">Facture de Frais N°{invoice.number}</p>
      </div>
    </div>
    <div className="space-y-6 text-sm leading-loose mb-20">
      {invoice.items.map((it, i) => (
        <div key={i} className="flex justify-between border-b border-slate-100 pb-2">
          <span>{it.name} (Qte: {it.qty})</span>
          <span className="font-bold">{(it.qty * it.price).toLocaleString()} {invoice.currency}</span>
        </div>
      ))}
    </div>
    <div className="flex justify-end pt-10 border-t-2 border-black">
      <div className="text-right">
        <p className="text-xs uppercase tracking-widest opacity-50">Total Honoraires TTC</p>
        <p className="text-3xl font-bold">{invoice.total.toLocaleString()} {invoice.currency}</p>
      </div>
    </div>
    <div className="mt-32 text-center text-[10px] uppercase tracking-widest opacity-40">
      Document certifié par l'Office Notarial {business.name} - YengaPay Ecosystem.
    </div>
  </div>
);

// 17. DIGITAL NOMAD (Style Indie Hackers)
export const DigitalNomad = ({ invoice, business }: TemplateProps) => (
  <div className="bg-[#f4f7f6] p-12 max-w-3xl mx-auto font-mono text-slate-800 border-2 border-slate-800 shadow-[8px_8px_0px_0px_rgba(30,41,59,1)]">
    <div className="flex justify-between items-start mb-12 border-b-2 border-slate-800 pb-8">
      <div>
        <h1 className="text-2xl font-black bg-yellow-300 px-2 inline-block mb-2">INVOICE</h1>
        <p className="font-bold">#{invoice.number}</p>
      </div>
      <div className="text-right font-bold uppercase text-xs">
        <p>{business.name}</p>
        <p className="bg-slate-800 text-white px-2 mt-1">Paid via YengaPay</p>
      </div>
    </div>
    <div className="space-y-8 mb-12">
      <div>
        <p className="text-xs uppercase opacity-50 mb-2">Client // Destination</p>
        <p className="text-xl font-black">{invoice.customer_name}</p>
      </div>
      <div className="bg-white border-2 border-slate-800 p-6 space-y-4">
        {invoice.items.map((it, i) => (
          <div key={i} className="flex justify-between items-center border-b border-slate-100 last:border-0 pb-2">
            <span>{it.name} <span className="text-xs opacity-50">x{it.qty}</span></span>
            <span className="font-black">{(it.qty * it.price).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="flex justify-between items-center font-black text-2xl bg-yellow-300 p-4 border-2 border-slate-800">
      <span>TOTAL</span>
      <span>{invoice.total.toLocaleString()} {invoice.currency}</span>
    </div>
  </div>
);

// 18. RETRO TICKET (80s Style)
export const RetroTicket = ({ invoice, business }: TemplateProps) => (
  <div className="bg-[#121212] p-8 max-w-2xl mx-auto font-mono text-[#39ff14] border-4 border-[#39ff14] shadow-[0_0_20px_rgba(57,255,20,0.3)]">
    <div className="text-center mb-10">
      <h1 className="text-3xl font-black uppercase tracking-tighter mb-2 italic">** TRANSACTION COMPLETE **</h1>
      <p className="text-xs opacity-70">TERMINAL: {business.name.toUpperCase()}</p>
    </div>
    <div className="space-y-4 border-y-2 border-[#39ff14] border-dashed py-8 mb-8">
      {invoice.items.map((it, i) => (
        <div key={i} className="flex justify-between items-center text-xl">
          <span>{it.name.toUpperCase()}</span>
          <span>{(it.qty * it.price).toLocaleString()}</span>
        </div>
      ))}
    </div>
    <div className="flex justify-between items-center text-4xl font-black border-2 border-[#39ff14] p-4">
      <span>TOTAL</span>
      <span>{invoice.total.toLocaleString()} {invoice.currency}</span>
    </div>
    <div className="mt-10 text-center animate-pulse text-xs">
      <p>REF: {invoice.number}</p>
      <p>THANK YOU FOR YOUR BUSINESS</p>
    </div>
  </div>
);

// 19. CLEAN PHARMACY
export const CleanPharmacy = ({ invoice, business, settings }: TemplateProps) => (
  <div className="bg-white p-10 max-w-4xl mx-auto border-t-8 border-emerald-500 font-sans shadow-lg">
    <div className="flex justify-between items-start mb-12">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl">+</div>
        <div>
          <h1 className="text-xl font-black text-slate-900">{settings.legal_name || business.name}</h1>
          <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">Pharmacie & Soins</p>
        </div>
      </div>
      <div className="text-right text-sm">
        <p className="font-bold">Facture N° {invoice.number}</p>
        <p className="text-slate-400">{format(new Date(invoice.created_at), 'dd/MM/yyyy')}</p>
      </div>
    </div>
    <div className="mb-10 bg-emerald-50 p-6 rounded-2xl">
      <p className="text-xs font-bold text-emerald-800 uppercase mb-2">Patient / Client</p>
      <p className="text-xl font-bold text-slate-900">{invoice.customer_name}</p>
    </div>
    <table className="w-full text-sm mb-12">
      <thead className="text-emerald-800 font-bold border-b-2 border-emerald-100">
        <tr className="text-left">
          <th className="py-2">Médicament / Produit</th>
          <th className="py-2 text-right">Qte</th>
          <th className="py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {invoice.items.map((it, i) => (
          <tr key={i}>
            <td className="py-4 font-medium text-slate-700">{it.name}</td>
            <td className="py-4 text-right text-slate-500">{it.qty}</td>
            <td className="py-4 text-right font-bold text-slate-900">{(it.qty * it.price).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="flex justify-end pt-8 border-t border-slate-100">
      <div className="text-right">
        <p className="text-xs font-bold text-slate-400 uppercase">Net à payer</p>
        <p className="text-4xl font-black text-emerald-600">{invoice.total.toLocaleString()} {invoice.currency}</p>
      </div>
    </div>
  </div>
);

// 20. TECH STARTUP (Style Linear/Vercel)
export const TechStartup = ({ invoice, business }: TemplateProps) => (
  <div className="bg-[#000000] p-12 max-w-4xl mx-auto text-white font-sans border border-white/10 rounded-xl overflow-hidden relative">
    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px]" />
    <div className="flex justify-between items-center mb-24 relative z-10">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-white rounded-full" />
        <span className="font-bold text-lg tracking-tight">{business.name}</span>
      </div>
      <div className="text-xs font-medium text-white/40 uppercase tracking-[0.2em]">{invoice.number}</div>
    </div>
    <div className="mb-24 relative z-10">
      <h2 className="text-5xl font-medium tracking-tighter leading-tight mb-4 italic">Confirming your purchase,<br /><span className="text-white/40">{invoice.customer_name}.</span></h2>
    </div>
    <div className="space-y-4 mb-24 relative z-10">
      {invoice.items.map((it, i) => (
        <div key={i} className="flex justify-between items-center py-4 border-b border-white/5">
          <span className="text-white/60 font-medium">{it.name} <span className="text-white/20 ml-2">× {it.qty}</span></span>
          <span className="font-bold tracking-tight text-xl">{(it.qty * it.price).toLocaleString()}</span>
        </div>
      ))}
    </div>
    <div className="flex justify-between items-end relative z-10">
      <div>
        <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Total Paid</p>
        <p className="text-4xl font-bold tracking-tighter">{invoice.total.toLocaleString()} <span className="text-white/40 text-2xl">{invoice.currency}</span></p>
      </div>
      <div className="text-right text-[10px] text-white/20 uppercase font-bold tracking-[0.3em]">
        Secured by YengaPay Engine
      </div>
    </div>
  </div>
);

// 21. COFFEE SHOP
export const CoffeeShop = ({ invoice, business }: TemplateProps) => (
  <div className="bg-[#fff9f0] p-8 max-w-[380px] mx-auto font-mono text-[#5d4037] border-2 border-[#d7ccc8] shadow-sm rounded-lg relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-1 bg-[#5d4037]" />
    <div className="text-center mb-10">
      <h1 className="text-2xl font-black uppercase italic tracking-tighter mb-1">{business.name}</h1>
      <p className="text-[10px] uppercase opacity-60 italic">Handcrafted Experiences</p>
    </div>
    <div className="space-y-4 mb-10 text-sm">
      <div className="flex justify-between border-b border-[#d7ccc8] border-dashed pb-2">
        <span>#{invoice.number.slice(-5)}</span>
        <span>{format(new Date(invoice.created_at), 'HH:mm')}</span>
      </div>
      {invoice.items.map((it, i) => (
        <div key={i} className="flex justify-between items-center group">
          <span className="font-bold">{it.name.toUpperCase()} <span className="text-[10px] font-normal opacity-60">× {it.qty}</span></span>
          <span className="font-bold">{(it.qty * it.price).toLocaleString()}</span>
        </div>
      ))}
    </div>
    <div className="border-t-2 border-[#5d4037] pt-4 mb-6">
      <div className="flex justify-between items-center text-xl font-black">
        <span>TOTAL DUE</span>
        <span>{invoice.total.toLocaleString()} {invoice.currency}</span>
      </div>
    </div>
    <div className="text-center text-[10px] opacity-60 italic leading-relaxed">
      <p>Enjoy your break!</p>
      <p className="mt-2 text-[8px] uppercase not-italic font-bold">Processed by YengaPay</p>
    </div>
  </div>
);

// 22. HOTEL LUXE (Conciergerie)
export const HotelLuxe = ({ invoice, business, settings }: TemplateProps) => (
  <div className="bg-white p-16 max-w-5xl mx-auto text-[#2c3e50] font-serif border border-slate-100 shadow-2xl relative">
    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#d4af37] via-[#f1e5ac] to-[#d4af37]" />
    <div className="flex justify-between items-start mb-24">
      <div>
        <h1 className="text-4xl font-light tracking-[0.2em] uppercase mb-2">{business.name}</h1>
        <p className="text-xs uppercase tracking-widest text-[#d4af37] font-bold">Luxury Collection</p>
      </div>
      <div className="text-right text-xs uppercase tracking-widest leading-loose">
        <p>Folio N° {invoice.number}</p>
        <p>{format(new Date(invoice.created_at), 'MMMM d, yyyy')}</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-20 mb-20 text-sm border-b border-slate-100 pb-20">
      <div>
        <p className="text-[#d4af37] font-bold uppercase mb-4 tracking-widest">Guest Information</p>
        <p className="text-2xl font-light">{invoice.customer_name}</p>
        <p className="text-slate-400 mt-2 italic">{invoice.customer_email}</p>
      </div>
      <div className="text-right">
        <p className="text-[#d4af37] font-bold uppercase mb-4 tracking-widest">Establishment</p>
        <p className="font-bold text-lg">{settings.legal_name || business.name}</p>
        <p className="text-slate-500 mt-1">{settings.address}</p>
      </div>
    </div>
    <table className="w-full text-sm mb-20">
      <thead>
        <tr className="text-left text-[#d4af37] font-bold uppercase tracking-widest text-[10px] border-b border-slate-100">
          <th className="py-4">Service Description</th>
          <th className="py-4 text-right">Charges</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {invoice.items.map((it, i) => (
          <tr key={i}>
            <td className="py-6 italic">{it.name} <span className="text-[10px] not-italic opacity-40 ml-2">(× {it.qty})</span></td>
            <td className="py-6 text-right font-bold tracking-widest">{(it.qty * it.price).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="flex justify-between items-end">
      <div className="text-[10px] uppercase tracking-[0.3em] opacity-30 italic">Thank you for staying with us</div>
      <div className="text-right">
        <p className="text-[#d4af37] text-xs font-bold uppercase mb-2 tracking-widest">Total Folio</p>
        <p className="text-5xl font-light tracking-tighter">{invoice.total.toLocaleString()} <span className="text-2xl font-normal opacity-40">{invoice.currency}</span></p>
      </div>
    </div>
  </div>
);

// 23. MINIMALIST BENTO
export const MinimalistBento = ({ invoice, business, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-[#f8fafc] p-6 max-w-4xl mx-auto font-sans grid grid-cols-6 grid-rows-3 gap-4 h-[600px]">
      <div className="col-span-4 row-span-1 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center">
        <h1 className="text-4xl font-black tracking-tighter text-slate-900 leading-tight">Paid to <span className="text-indigo-600">{business.name}</span>.</h1>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">{title}</p>
      </div>
      <div className="col-span-2 row-span-1 bg-indigo-600 p-8 rounded-[2rem] shadow-glow text-white flex flex-col justify-between relative overflow-hidden">
        <div className="text-xs font-bold uppercase tracking-widest opacity-60">Total Amount</div>
        <div className="text-3xl font-black">{invoice.total.toLocaleString()} {invoice.currency}</div>
        <div className="absolute -bottom-4 -right-4 opacity-20 transform rotate-12">
          <QRCodeSVG value={`https://pay.faso-invest.com/verify/${invoice.number}`} size={80} />
        </div>
      </div>
      <div className="col-span-2 row-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Client</div>
        <p className="text-xl font-bold text-slate-900 mb-2">{invoice.customer_name}</p>
        <p className="text-sm text-slate-500 truncate">{invoice.customer_email}</p>
      </div>
      <div className="col-span-4 row-span-2 bg-slate-900 p-8 rounded-[2rem] text-white flex flex-col">
        <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-6">Items</div>
        <div className="flex-1 space-y-4 overflow-y-auto pr-4 scrollbar-hide">
          {invoice.items.map((it, i) => (
            <div key={i} className="flex justify-between items-center group">
              <span className="text-white/80 font-medium">{it.name} <span className="text-white/20 ml-2">× {it.qty}</span></span>
              <span className="font-bold">{(it.qty * it.price).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 text-[10px] font-bold uppercase tracking-widest text-white/20">{invoice.number} — {format(new Date(invoice.created_at), 'dd/MM/yyyy')}</div>
      </div>
    </div>
  );
};

// 24. CLASSIC RED (Corporate Standard)
export const ClassicRed = ({ invoice, business, settings, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-white p-12 max-w-4xl mx-auto font-sans border-l-[12px] border-rose-600 shadow-xl">
      <div className="flex justify-between items-start mb-16">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2">{business.name}</h1>
          <p className="text-rose-600 font-bold tracking-widest uppercase text-xs">Official Business Record</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</h2>
          <div className="space-y-1 text-sm font-medium">
            <p>Number: <span className="text-slate-900">{invoice.number}</span></p>
            <p>Date: <span className="text-slate-900">{format(new Date(invoice.created_at), 'dd/MM/yyyy')}</span></p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-12 mb-16 border-y border-slate-100 py-12">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase mb-4">Merchant</p>
          <p className="font-bold text-lg">{settings.legal_name || business.name}</p>
          <p className="text-slate-500 text-sm mt-1">{settings.address}</p>
          <p className="text-slate-500 text-sm italic mt-2">IFU: {settings.ifu}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase mb-4">Customer</p>
          <p className="font-bold text-lg">{invoice.customer_name}</p>
          <p className="text-slate-500 text-sm mt-1">{invoice.customer_email}</p>
        </div>
      </div>
      <table className="w-full text-sm mb-16">
        <thead>
          <tr className="bg-slate-50 text-slate-900 font-bold border-b-2 border-slate-900">
            <th className="py-4 px-2 text-left">Description</th>
            <th className="py-4 px-2 text-right">Qty</th>
            <th className="py-4 px-2 text-right">Unit Price</th>
            <th className="py-4 px-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-4 px-2">{it.name}</td>
              <td className="py-4 px-2 text-right">{it.qty}</td>
              <td className="py-4 px-2 text-right">{it.price.toLocaleString()}</td>
              <td className="py-4 px-2 text-right font-bold">{(it.qty * it.price).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end pt-8 border-t-2 border-slate-900">
        <div className="text-right w-64 space-y-3">
          <div className="flex justify-between text-slate-500 text-sm">
            <span>Subtotal</span>
            <span>{invoice.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-2xl font-black text-rose-600 pt-2">
            <span>TOTAL DUE</span>
            <span>{invoice.total.toLocaleString()} {invoice.currency}</span>
          </div>
        </div>
      </div>
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 25. NEON CYBER (Futuristic)
export const NeonCyber = ({ invoice, business, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-[#050505] p-12 max-w-4xl mx-auto text-cyan-400 font-mono border-[4px] border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.5)] rounded-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_70%)]" />
      <div className="flex justify-between items-start mb-20 relative z-10">
        <div>
          <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-2 text-white bg-cyan-500 px-4">{title.toUpperCase()}_SUCCESS</h1>
          <p className="text-xs font-bold uppercase tracking-[0.5em] opacity-60">Terminal // {business.name.toUpperCase()}</p>
        </div>
        <div className="text-right">
          <div className="h-16 w-16 border-2 border-cyan-500 rounded-full flex items-center justify-center animate-pulse">
            <div className="h-10 w-10 border border-cyan-500 rounded-full flex items-center justify-center">
              <div className="h-4 w-4 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-10 mb-20 relative z-10">
        <div className="border-l-2 border-cyan-500 pl-6">
          <p className="text-[10px] uppercase font-bold opacity-40 mb-2">Subject</p>
          <p className="text-2xl font-black text-white">{invoice.customer_name}</p>
          <p className="text-xs mt-2 opacity-60">ID: {invoice.customer_email}</p>
        </div>
        <div className="text-right border-r-2 border-cyan-500 pr-6">
          <p className="text-[10px] uppercase font-bold opacity-40 mb-2">Amount_Auth</p>
          <p className="text-5xl font-black text-white tracking-tighter">{invoice.total.toLocaleString()} <span className="text-xl text-cyan-500">{invoice.currency}</span></p>
        </div>
      </div>
      <div className="space-y-4 mb-20 relative z-10">
        {invoice.items.map((it, i) => (
          <div key={i} className="flex justify-between items-center group py-2 border-b border-cyan-500/20">
            <span className="text-white/60 font-bold tracking-widest">{it.name.toUpperCase()}</span>
            <span className="font-black text-white">{(it.qty * it.price).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="text-[8px] font-bold uppercase tracking-[0.8em] opacity-20 text-center relative z-10">
        INVOICE_{invoice.number}_SYSTEM_HASH_CONFIRMED
      </div>
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 26. SOFT MINT (Ecological/Sustainable)
export const SoftMint = ({ invoice, business, settings, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-[#f0f9f4] p-12 max-w-4xl mx-auto font-sans text-[#2d5a43] border border-[#d1e7dd] rounded-[3rem] shadow-sm">
      <div className="flex justify-between items-start mb-24">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#2d5a43] rounded-[1.5rem] flex items-center justify-center shadow-lg">
            <div className="w-8 h-8 border-4 border-white/20 rounded-full" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{business.name}</h1>
            <p className="text-xs font-bold uppercase tracking-widest opacity-60 italic">{title}</p>
          </div>
        </div>
        <div className="text-right bg-white p-6 rounded-[2rem] shadow-sm border border-[#d1e7dd]">
          <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2">Order Total</p>
          <p className="text-3xl font-black tracking-tighter">{invoice.total.toLocaleString()} {invoice.currency}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-20 mb-24">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">Sent to</h3>
          <p className="text-2xl font-bold tracking-tight leading-tight">{invoice.customer_name}</p>
          <p className="text-sm opacity-60 underline decoration-2 underline-offset-4">{invoice.customer_email}</p>
        </div>
        <div className="space-y-2 text-right">
          <p className="text-xs font-bold uppercase tracking-widest opacity-40">Merchant Record</p>
          <p className="font-bold text-lg">{settings.legal_name || business.name}</p>
          <p className="text-sm opacity-60 italic">{settings.address}</p>
        </div>
      </div>
      <div className="space-y-6">
        {invoice.items.map((it, i) => (
          <div key={i} className="flex justify-between items-center group bg-white/50 p-6 rounded-[2rem] border border-[#d1e7dd]/50 hover:bg-white transition-colors duration-500">
            <span className="font-bold text-lg">{it.name} <span className="text-xs font-normal opacity-40 ml-2">× {it.qty}</span></span>
            <span className="font-black text-xl">{(it.qty * it.price).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="mt-24 text-center">
        <div className="inline-block px-8 py-2 bg-[#2d5a43] text-white rounded-full text-[10px] font-bold uppercase tracking-widest">
          Digital Receipt — Saving Trees
        </div>
        <p className="mt-8 text-[10px] opacity-30 italic uppercase tracking-[0.2em]">{invoice.number}</p>
      </div>
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 27. DARK VANGUARD (High-End Tech)
export const DarkVanguard = ({ invoice, business, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-[#0c0c0c] p-16 max-w-5xl mx-auto text-white font-sans border-t-[20px] border-indigo-600 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,rgba(79,70,229,0.05)_0%,transparent_100%)] pointer-events-none" />
      <div className="flex justify-between items-end mb-32 relative z-10">
        <h1 className="text-7xl font-black italic tracking-tighter leading-none">{business.name}</h1>
        <div className="text-right text-indigo-600 font-black text-xs uppercase tracking-[0.5em]">{title} {invoice.number}</div>
      </div>
      <div className="grid grid-cols-12 gap-10 mb-32 relative z-10">
        <div className="col-span-8">
          <p className="text-white/20 font-bold uppercase tracking-widest text-[10px] mb-8">Statement for</p>
          <h2 className="text-5xl font-black tracking-tighter leading-tight mb-4">{invoice.customer_name}</h2>
          <p className="text-white/40 text-lg font-medium">{invoice.customer_email}</p>
        </div>
        <div className="col-span-4 flex flex-col justify-end items-end">
          <p className="text-white/20 font-bold uppercase tracking-widest text-[10px] mb-8">Settled Amount</p>
          <div className="text-6xl font-black tracking-tighter flex items-start gap-2">
            {invoice.total.toLocaleString()}
            <span className="text-2xl text-indigo-600 mt-2">{invoice.currency}</span>
          </div>
        </div>
      </div>
      <div className="space-y-2 mb-32 relative z-10">
        {invoice.items.map((it, i) => (
          <div key={i} className="flex justify-between items-center py-8 border-b border-white/5 group hover:border-indigo-600 transition-colors duration-700">
            <span className="text-2xl font-black tracking-tighter group-hover:pl-4 transition-all duration-700">{it.name} <span className="text-white/20 font-normal italic ml-4">× {it.qty}</span></span>
            <span className="text-2xl font-black italic opacity-40 group-hover:opacity-100 group-hover:text-indigo-600 transition-all duration-700">{(it.qty * it.price).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center relative z-10">
        <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center">
          <div className="w-4 h-4 bg-indigo-600 rounded-full animate-ping" />
        </div>
        <div className="text-[8px] font-black uppercase tracking-[1em] text-white/10">Engineered by YengaPay</div>
      </div>
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 28. ORGANIC KRAFT (Eco-friendly Retail)
export const OrganicKraft = ({ invoice, business, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-[#e7d9c1] p-12 max-w-3xl mx-auto font-mono text-[#544a3d] border-[12px] border-[#cbbca1] shadow-inner relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')] opacity-40 pointer-events-none" />
      <div className="text-center mb-16 relative z-10">
        <div className="w-20 h-20 border-4 border-[#544a3d] rounded-full mx-auto flex items-center justify-center mb-6">
          <div className="text-4xl font-black">O</div>
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tighter italic">{business.name}</h1>
        <p className="text-xs font-bold uppercase mt-2 italic opacity-60">{title}</p>
      </div>
      <div className="space-y-6 mb-16 border-y-4 border-[#544a3d] border-dotted py-12 relative z-10">
        {invoice.items.map((it, i) => (
          <div key={i} className="flex justify-between items-start group">
            <div className="flex-1">
              <p className="text-xl font-black italic">{it.name.toUpperCase()}</p>
              <p className="text-xs font-bold opacity-40 mt-1">QTY: {it.qty} × {it.price.toLocaleString()}</p>
            </div>
            <p className="text-2xl font-black">{(it.qty * it.price).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center text-4xl font-black italic border-4 border-[#544a3d] p-8 relative z-10">
        <span>TOTAL</span>
        <span>{invoice.total.toLocaleString()} {invoice.currency}</span>
      </div>
      <div className="mt-16 text-center text-xs font-bold uppercase tracking-widest relative z-10">
        <p>Recipient: {invoice.customer_name}</p>
        <p className="mt-2 italic opacity-40">Doc Ref: {invoice.number}</p>
        <div className="mt-12 h-20 w-full bg-[#544a3d]/10 flex items-center justify-center border-2 border-[#544a3d]/20 border-dashed">
          <span className="text-[10px] opacity-40 italic">Signature / Stamp</span>
        </div>
      </div>
      
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 29. BOLD IMPACT (Aggressive Marketing)
export const BoldImpact = ({ invoice, business, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-[#ffdd00] p-12 max-w-4xl mx-auto text-black font-black font-sans border-[16px] border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex justify-between items-start mb-32">
        <h1 className="text-8xl font-black italic tracking-tighter leading-none -ml-4 uppercase">{business.name}</h1>
        <div className="bg-black text-[#ffdd00] p-4 text-xs font-black uppercase tracking-widest mt-4 italic shadow-glow">{title}</div>
      </div>
      <div className="mb-32">
        <p className="text-xl uppercase tracking-widest mb-4">Sold to</p>
        <h2 className="text-6xl uppercase tracking-tighter italic mb-2">{invoice.customer_name}</h2>
        <p className="text-2xl opacity-60 italic">{invoice.customer_email}</p>
      </div>
      <div className="space-y-8 mb-32">
        {invoice.items.map((it, i) => (
          <div key={i} className="flex justify-between items-center border-b-[8px] border-black pb-4 group hover:bg-black hover:text-[#ffdd00] transition-all duration-300 px-4">
            <span className="text-4xl italic">{it.name.toUpperCase()} <span className="text-lg opacity-40">×{it.qty}</span></span>
            <span className="text-4xl italic">{(it.qty * it.price).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-end">
        <div className="text-sm uppercase tracking-[0.4em] italic max-w-xs">Confirmed Transaction Powered by YengaPay Engine</div>
        <div className="text-right">
          <p className="text-xl uppercase mb-2">Total Amount</p>
          <p className="text-9xl tracking-tighter italic leading-none">{invoice.total.toLocaleString()} <span className="text-4xl">{invoice.currency}</span></p>
        </div>
      </div>
      
      <VerificationFooter business={business} invoice={invoice} />
    </div>
  );
};

// 30. ZEN MINIMAL (Calm & Serene)
export const ZenMinimal = ({ invoice, business, kind = "invoice" }: TemplateProps) => {
  const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
  return (
    <div className="bg-white p-20 max-w-5xl mx-auto text-slate-400 font-light font-serif tracking-[0.2em] uppercase text-center border-x border-slate-50 shadow-sm">
      <h1 className="text-xl mb-32 tracking-[0.8em] font-light text-slate-900">{business.name}</h1>
      <div className="mb-32">
        <p className="text-[10px] mb-8 opacity-40">{title}</p>
        <h2 className="text-3xl text-slate-800 font-light lowercase italic tracking-normal">{invoice.customer_name}</h2>
      </div>
      <div className="space-y-12 mb-32">
        {invoice.items.map((it, i) => (
          <div key={i} className="flex justify-between items-center text-[10px] border-b border-slate-50 pb-8">
            <span>{it.name}</span>
            <span className="text-slate-800 font-medium">{(it.qty * it.price).toLocaleString()} {invoice.currency}</span>
          </div>
        ))}
      </div>
      <div className="pt-20 border-t border-slate-100 flex flex-col items-center">
        <p className="text-xs mb-4">Total Amount</p>
        <p className="text-4xl text-slate-900 font-light tracking-widest">{invoice.total.toLocaleString()} {invoice.currency}</p>
        <div className="mt-32 w-8 h-[1px] bg-slate-200" />
        <p className="mt-8 text-[8px] opacity-30 italic">Document ID: {invoice.number}</p>
      </div>
      
      <VerificationFooter business={business} invoice={invoice} />
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
  "stripe-vintage": StripeVintage,
  "paypal-statement": PaypalStatement,
  "qonto-modern": QontoModern,
  "uber-receipt": UberReceipt,
  "luxe-maison": LuxeMaison,
  "google-cloud": GoogleCloud,
  "airbnb-host": AirbnbHost,
  "wise-borderless": WiseBorderless,
  "microsoft-azure": MicrosoftAzure,
  "revolut-business": RevolutBusiness,
  "notaire-officiel": NotaireOfficiel,
  "digital-nomad": DigitalNomad,
  "retro-ticket": RetroTicket,
  "clean-pharmacy": CleanPharmacy,
  "tech-startup": TechStartup,
  "coffee-shop": CoffeeShop,
  "hotel-luxe": HotelLuxe,
  "minimalist-bento": MinimalistBento,
  "classic-red": ClassicRed,
  "neon-cyber": NeonCyber,
  "soft-mint": SoftMint,
  "dark-vanguard": DarkVanguard,
  "organic-kraft": OrganicKraft,
  "bold-impact": BoldImpact,
  "zen-minimal": ZenMinimal,
};

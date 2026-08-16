import { useState } from "react";
import { X, Save, Download, Printer, Eye, Settings2, Trash2, Plus, User, FileText } from "lucide-react";
import { toast } from "sonner";
import { INVOICE_TEMPLATES } from "./invoice-templates";
import { createInvoice, updateInvoice } from "@/lib/business.functions";

interface InvoiceEditorProps {
  business: any;
  settings: any;
  invoice?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function InvoiceEditor({ business, settings, invoice: initialInvoice, onClose, onSaved }: InvoiceEditorProps) {
  const [template, setTemplate] = useState(initialInvoice?.template_slug || "stripe-modern");
  const [data, setData] = useState(initialInvoice || {
    number: `INV-${Date.now().toString().slice(-6)}`,
    created_at: new Date().toISOString(),
    customer_name: "",
    customer_email: "",
    items: [{ name: "Nouvel article", qty: 1, price: 0 }],
    subtotal: 0,
    tax: 0,
    total: 0,
    currency: "XOF",
    notes: "",
    kind: "invoice",
    status: "issued"
  });

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...data.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    const subtotal = newItems.reduce((acc: number, it: any) => acc + (it.qty * it.price), 0);
    const total = subtotal + data.tax;
    
    setData({ ...data, items: newItems, subtotal, total });
  };

  const addItem = () => {
    setData({ ...data, items: [...data.items, { name: "", qty: 1, price: 0 }] });
  };

  const removeItem = (index: number) => {
    const newItems = data.items.filter((_: any, i: number) => i !== index);
    const subtotal = newItems.reduce((acc: number, it: any) => acc + (it.qty * it.price), 0);
    setData({ ...data, items: newItems, subtotal, total: subtotal + data.tax });
  };

  const TemplateComponent = INVOICE_TEMPLATES[template] || INVOICE_TEMPLATES["stripe-modern"];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-background/80 backdrop-blur" onClick={onClose} />
      
      <div className="relative flex h-full w-full bg-card shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Left Panel: Form */}
        <div className="flex w-full md:w-[450px] flex-col border-r border-border p-6 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Éditeur de facture
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="h-4 w-4" /></button>
          </div>

          <div className="space-y-6">
            <section>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Choix du template</label>
              <select 
                value={template} 
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              >
                {Object.keys(INVOICE_TEMPLATES).map(k => (
                  <option key={k} value={k}>{k.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}</option>
                ))}
              </select>
            </section>

            <section className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Client</label>
              <input 
                placeholder="Nom du client" 
                value={data.customer_name} 
                onChange={(e) => setData({...data, customer_name: e.target.value})}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input 
                placeholder="Email du client" 
                value={data.customer_email} 
                onChange={(e) => setData({...data, customer_email: e.target.value})}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Articles</label>
                <button onClick={addItem} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                  <Plus className="h-3 w-3" /> Ajouter
                </button>
              </div>
              <div className="space-y-3">
                {data.items.map((item: any, i: number) => (
                  <div key={i} className="flex gap-2 items-start bg-muted/30 p-3 rounded-xl">
                    <div className="flex-1 space-y-2">
                      <input 
                        placeholder="Désignation" 
                        value={item.name} 
                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
                      />
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="Qté" 
                          value={item.qty} 
                          onChange={(e) => updateItem(i, 'qty', Number(e.target.value))}
                          className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
                        />
                        <input 
                          type="number" 
                          placeholder="Prix" 
                          value={item.price} 
                          onChange={(e) => updateItem(i, 'price', Number(e.target.value))}
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                    <button onClick={() => removeItem(i)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Notes publiques</label>
              <textarea 
                rows={3} 
                value={data.notes} 
                onChange={(e) => setData({...data, notes: e.target.value})}
                placeholder="Ex: Merci pour votre confiance. Paiement sous 30 jours."
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary resize-none"
              />
            </section>
          </div>

          <div className="mt-auto pt-6 border-t border-border flex gap-3">
            <button 
              onClick={() => {
                const toastId = toast.loading("Enregistrement...");
                const action = data.id ? updateInvoice : createInvoice;
                const payload = data.id ? data : { ...data, business_id: business.id };
                
                action({ ...payload, template_slug: template })
                  .then(() => {
                    toast.success("Facture enregistrée", { id: toastId });
                    onSaved();
                  })
                  .catch((err) => {
                    toast.error("Erreur: " + err.message, { id: toastId });
                  });
              }}
              className="flex-1 rounded-full bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {data.id ? 'Mettre à jour' : 'Générer'}
            </button>
          </div>
        </div>

        {/* Right Panel: Preview */}
        <div className="hidden md:flex flex-1 flex-col bg-slate-500/5 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-background border-b border-border">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> Prévisualisation Live
              </span>
              <div className="h-4 w-px bg-border" />
              <div className="flex gap-2">
                <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors" title="Zoom +"><Plus className="h-4 w-4" /></button>
                <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors" title="Zoom -"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold hover:bg-muted transition-colors">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
              <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold hover:bg-muted transition-colors">
                <Printer className="h-3.5 w-3.5" /> Imprimer
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-12">
            <div className="transform origin-top scale-[0.85] sm:scale-100">
               <TemplateComponent 
                 invoice={{...data, items: data.items.length > 0 ? data.items : [{name: "Aperçu", qty: 1, price: 0}]}} 
                 business={business} 
                 settings={settings || {}} 
               />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

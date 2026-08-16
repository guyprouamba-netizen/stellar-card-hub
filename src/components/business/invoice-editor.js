import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { X, Download, Printer, Eye, Trash2, Plus, User, FileText, Receipt, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { INVOICE_TEMPLATES, RECEIPT_TEMPLATES, CONTRACT_TEMPLATES } from "./invoice-templates";
import { createInvoice, updateInvoice } from "@/lib/business.functions";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
export default function InvoiceEditor({ business, settings, invoice: initialInvoice, onClose, onSaved }) {
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
        kind: initialInvoice?.kind || "invoice",
        status: initialInvoice?.status || "issued"
    });
    const [template, setTemplate] = useState(initialInvoice?.template_slug || "");
    const [loading, setLoading] = useState(false);
    const previewRef = useRef(null);
    // Choose correct template list based on kind
    const currentTemplates = data.kind === 'receipt'
        ? RECEIPT_TEMPLATES
        : data.kind === 'contract'
            ? CONTRACT_TEMPLATES
            : INVOICE_TEMPLATES;
    // Set default template if none selected or if kind changed
    const availableKeys = Object.keys(currentTemplates);
    const activeTemplate = template && currentTemplates[template]
        ? template
        : availableKeys[0];
    const updateItem = (index, field, value) => {
        const newItems = [...data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        const subtotal = newItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
        const total = subtotal + data.tax;
        setData({ ...data, items: newItems, subtotal, total });
    };
    const addItem = () => {
        setData({ ...data, items: [...data.items, { name: "", qty: 1, price: 0 }] });
    };
    const removeItem = (index) => {
        const newItems = data.items.filter((_, i) => i !== index);
        const subtotal = newItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
        setData({ ...data, items: newItems, subtotal, total: subtotal + data.tax });
    };
    const TemplateComponent = currentTemplates[activeTemplate] || INVOICE_TEMPLATES["stripe-modern"];
    const handleDownloadPDF = async () => {
        if (!previewRef.current)
            return;
        setLoading(true);
        const toastId = toast.loading("Génération du PDF...");
        try {
            const element = previewRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff"
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "px",
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
            pdf.save(`${data.kind}-${data.number}.pdf`);
            toast.success("Téléchargement réussi", { id: toastId });
        }
        catch (error) {
            console.error("PDF Error:", error);
            toast.error("'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n                                        \n                                            \n                                            Erreur lors de la génération du PDF", { id: toastId });
        }
        finally {
            setLoading(false);
        }
    };
    const handlePrint = () => {
        if (!previewRef.current)
            return;
        const printContent = previewRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head>
            <title>${data.kind} ${data.number}</title>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            <style>
              body { padding: 0; margin: 0; }
              @media print {
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="p-8">${printContent}</div>
            <script>
              window.onload = () => {
                window.print();
                window.onafterprint = () => window.close();
              };
            </script>
          </body>
        </html>
      `);
            printWindow.document.close();
        }
    };
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex", children: [
            _jsx("div", { className: "absolute inset-0 bg-background/80 backdrop-blur", onClick: onClose }), _jsxs("div", { className: "relative flex h-full w-full bg-card shadow-2xl animate-in slide-in-from-right duration-300", children: [
                    _jsxs("div", { className: "flex w-full md:w-[450px] flex-col border-r border-border p-6 overflow-y-auto shrink-0", children: [
                            _jsxs("div", { className: "flex items-center justify-between mb-8", children: [
                                    _jsxs("h2", { className: "text-xl font-bold flex items-center gap-2", children: [
                                            _jsx(FileText, { className: "h-5 w-5 text-primary" }),
                                            "\u00C9diteur de document"] }), _jsx("button", { onClick: onClose, className: "p-2 hover:bg-muted rounded-full transition-colors", children: _jsx(X, { className: "h-4 w-4" }) })
                                ] }), _jsxs("div", { className: "space-y-6", children: [
                                    _jsxs("section", { children: [
                                            _jsx("label", { className: "text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block", children: "Choisir un style professionnel" }), _jsx("div", { className: "grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto p-1 border border-border rounded-xl scrollbar-hide", children: availableKeys.map(k => (_jsxs("button", { onClick: () => setTemplate(k), className: `group relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${activeTemplate === k
                                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                                        : "border-border hover:border-primary/50 bg-card"}`, children: [
                                                        _jsx("div", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors", children: k.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') }), activeTemplate === k && (_jsx("div", { className: "absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" }))] }, k))) })
                                        ] }), _jsxs("section", { className: "space-y-3", children: [
                                            _jsx("label", { className: "text-xs font-bold uppercase tracking-wider text-muted-foreground block", children: "Client" }), _jsx("input", { placeholder: "Nom du client", value: data.customer_name, onChange: (e) => setData({ ...data, customer_name: e.target.value }), className: "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" }), _jsx("input", { placeholder: "Email du client", value: data.customer_email, onChange: (e) => setData({ ...data, customer_email: e.target.value }), className: "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" })
                                        ] }), _jsxs("section", { children: [
                                            _jsxs("div", { className: "flex items-center justify-between mb-2", children: [
                                                    _jsx("label", { className: "text-xs font-bold uppercase tracking-wider text-muted-foreground", children: "Articles" }), _jsxs("button", { onClick: addItem, className: "text-xs font-bold text-primary flex items-center gap-1 hover:underline", children: [
                                                            _jsx(Plus, { className: "h-3 w-3" }),
                                                            " Ajouter"] })
                                                ] }), _jsx("div", { className: "space-y-3", children: data.items.map((item, i) => (_jsxs("div", { className: "flex gap-2 items-start bg-muted/30 p-3 rounded-xl", children: [
                                                        _jsxs("div", { className: "flex-1 space-y-2", children: [
                                                                _jsx("input", { placeholder: "D\u00E9signation", value: item.name, onChange: (e) => updateItem(i, 'name', e.target.value), className: "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary" }), _jsxs("div", { className: "flex gap-2", children: [
                                                                        _jsx("input", { type: "number", placeholder: "Qt\u00E9", value: item.qty, onChange: (e) => updateItem(i, 'qty', Number(e.target.value)), className: "w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary" }), _jsx("input", { type: "number", placeholder: "Prix", value: item.price, onChange: (e) => updateItem(i, 'price', Number(e.target.value)), className: "flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary" })
                                                                    ] })
                                                            ] }), _jsx("button", { onClick: () => removeItem(i), className: "p-1.5 text-muted-foreground hover:text-destructive", children: _jsx(Trash2, { className: "h-4 w-4" }) })
                                                    ] }, i))) })
                                        ] }), _jsxs("section", { children: [
                                            _jsx("label", { className: "text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block", children: "Type de document" }), _jsx("div", { className: "flex gap-2 p-1 bg-muted rounded-xl", children: [
                                                    { id: 'invoice', label: 'Facture', icon: FileText },
                                                    { id: 'receipt', label: 'Reçu / Ticket', icon: Receipt },
                                                    { id: 'contract', label: 'Contrat', icon: User }
                                                ].map(k => (_jsxs("button", { onClick: () => setData({ ...data, kind: k.id }), className: `flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${data.kind === k.id ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`, children: [
                                                        _jsx(k.icon, { className: "h-3.5 w-3.5" }), k.label] }, k.id))) })
                                        ] }), _jsxs("section", { children: [
                                            _jsx("label", { className: "text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block", children: "Notes publiques" }), _jsx("textarea", { rows: 3, value: data.notes, onChange: (e) => setData({ ...data, notes: e.target.value }), placeholder: "Ex: Merci pour votre confiance. Paiement sous 30 jours.", className: "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary resize-none" })
                                        ] })
                                ] }), _jsx("div", { className: "mt-auto pt-6 border-t border-border flex gap-3", children: _jsx("button", { onClick: () => {
                                        const toastId = toast.loading("Enregistrement...");
                                        const action = data.id ? updateInvoice : createInvoice;
                                        const payload = data.id ? data : { ...data, business_id: business.id };
                                        action({ ...payload, template_slug: activeTemplate })
                                            .then(() => {
                                            toast.success("Facture enregistrée", { id: toastId });
                                            onSaved();
                                        })
                                            .catch((err) => {
                                            toast.error("Erreur: " + err.message, { id: toastId });
                                        });
                                    }, className: "flex-1 rounded-full bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all", children: data.id ? 'Mettre à jour' : 'Générer' }) })
                        ] }), _jsxs("div", { className: "hidden md:flex flex-1 flex-col bg-slate-500/5 overflow-hidden", children: [
                            _jsxs("div", { className: "flex items-center justify-between p-4 bg-background border-b border-border", children: [
                                    _jsxs("div", { className: "flex items-center gap-4", children: [
                                            _jsxs("span", { className: "text-xs font-bold flex items-center gap-2", children: [
                                                    _jsx(Eye, { className: "h-4 w-4 text-primary" }),
                                                    " Pr\u00E9visualisation Live"] }), _jsx("div", { className: "h-4 w-px bg-border" }), _jsxs("div", { className: "flex gap-2", children: [
                                                    _jsx("button", { className: "p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors", title: "Zoom +", children: _jsx(Plus, { className: "h-4 w-4" }) }), _jsx("button", { className: "p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors", title: "Zoom -", children: _jsx(X, { className: "h-4 w-4" }) })
                                                ] })
                                        ] }), _jsxs("div", { className: "flex gap-2", children: [
                                            _jsxs("button", { onClick: handleDownloadPDF, disabled: loading, className: "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold hover:bg-muted transition-colors disabled:opacity-50", children: [loading ? _jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" }) : _jsx(Download, { className: "h-3.5 w-3.5" }), " PDF"] }), _jsxs("button", { onClick: handlePrint, className: "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold hover:bg-muted transition-colors", children: [
                                                    _jsx(Printer, { className: "h-3.5 w-3.5" }),
                                                    " Imprimer"] })
                                        ] })
                                ] }), _jsx("div", { className: "flex-1 overflow-y-auto p-12", children: _jsx("div", { ref: previewRef, className: "transform origin-top scale-[0.85] sm:scale-100 bg-white", children: _jsx(TemplateComponent, { invoice: { ...data, items: data.items.length > 0 ? data.items : [{ name: "Aperçu", qty: 1, price: 0 }] }, business: business, settings: settings || {}, kind: data.kind }) }) })
                        ] })
                ] })
        ] }));
}

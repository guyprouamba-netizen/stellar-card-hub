import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
const VerificationFooter = ({ business, invoice }) => {
    const verificationUrl = `https://pay.faso-invest.com/verify/${invoice.number}`;
    return (_jsxs("div", { className: "mt-12 pt-8 border-t border-slate-100 flex flex-col items-center justify-center text-center gap-4", children: [
            _jsxs("div", { className: "flex flex-col items-center gap-2", children: [
                    _jsx(QRCodeSVG, { value: verificationUrl, size: 64, level: "L", includeMargin: false }), _jsx("p", { className: "text-[8px] text-slate-400 font-mono uppercase tracking-widest", children: "Scanner pour v\u00E9rifier" })
                ] }), _jsxs("p", { className: "text-[9px] text-slate-400 font-medium uppercase tracking-[0.2em]", children: ["G\u00E9n\u00E9r\u00E9 par ",
                    _jsx("span", { className: "text-primary font-bold", children: "FASO-INVEST PAY" })
                ] }), _jsxs("div", { className: "text-[8px] text-slate-300 italic", children: ["Authenticit\u00E9 garantie pour le marchand : ", business.name] })
        ] }));
};
// 1. STRIPE MODERN
export const StripeModern = ({ invoice, business, settings, kind = "invoice" }) => {
    const primaryColor = business.theme?.primary || "#6366f1";
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-8 sm:p-12 text-slate-900 font-sans max-w-4xl mx-auto shadow-sm border border-slate-100 rounded-xl", children: [
            _jsxs("div", { className: "flex justify-between items-start", children: [
                    _jsxs("div", { children: [business.logo_url ? (_jsx("img", { src: business.logo_url, alt: "Logo", className: "h-12 w-auto mb-6" })) : (_jsx("div", { className: "h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xl mb-6", children: business.name[0] })), _jsxs("h1", { className: "text-2xl font-bold text-slate-900", children: [title, " ", invoice.number] }), _jsxs("p", { className: "text-slate-500 mt-1", children: ["\u00C9mis le ", format(new Date(invoice.created_at), 'dd MMMM yyyy', { locale: fr })] })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsxs("div", { className: "inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider mb-4", children: [invoice.total.toLocaleString('fr-FR'), " ", invoice.currency] }), _jsx("p", { className: "font-bold text-slate-900", children: settings.legal_name || business.name }), _jsx("p", { className: "text-slate-500 text-sm", children: settings.address || "Ouagadougou, Burkina Faso" }), settings.ifu && _jsxs("p", { className: "text-slate-400 text-xs mt-1", children: ["IFU: ", settings.ifu] })] })
                ] }), _jsxs("div", { className: "mt-12 grid grid-cols-2 gap-8 border-t border-slate-100 pt-8", children: [
                    _jsxs("div", { children: [
                            _jsx("h3", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Factur\u00E9 \u00E0" }), _jsx("p", { className: "font-bold", children: invoice.customer_name || "Client" }), _jsx("p", { className: "text-slate-500 text-sm", children: invoice.customer_email }), _jsx("p", { className: "text-slate-500 text-sm", children: invoice.customer_phone })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsx("h3", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "D\u00E9tails de paiement" }), _jsx("p", { className: "text-slate-500 text-sm", children: "Mode : Mobile Money / Virement" }), _jsxs("p", { className: "text-slate-500 text-sm", children: ["\u00C9ch\u00E9ance : ", invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yyyy') : "Immédiat"] })
                        ] })
                ] }), _jsxs("table", { className: "w-full mt-12 text-sm", children: [
                    _jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-slate-400", children: [
                                _jsx("th", { className: "text-left py-3 font-medium", children: "Description" }), _jsx("th", { className: "text-right py-3 font-medium", children: "Qt\u00E9" }), _jsx("th", { className: "text-right py-3 font-medium", children: "Prix" }), _jsx("th", { className: "text-right py-3 font-medium", children: "Total" })
                            ] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: invoice.items.map((item, i) => (_jsxs("tr", { children: [
                                _jsx("td", { className: "py-4 font-medium text-slate-900", children: item.name }), _jsx("td", { className: "py-4 text-right text-slate-500", children: item.qty }), _jsx("td", { className: "py-4 text-right text-slate-500", children: item.price.toLocaleString('fr-FR') }), _jsx("td", { className: "py-4 text-right font-medium", children: (item.qty * item.price).toLocaleString('fr-FR') })
                            ] }, i))) })
                ] }), _jsx("div", { className: "mt-8 flex justify-end", children: _jsxs("div", { className: "w-64 space-y-3", children: [
                        _jsxs("div", { className: "flex justify-between text-slate-500", children: [
                                _jsx("span", { children: "Sous-total" }), _jsxs("span", { children: [invoice.subtotal.toLocaleString('fr-FR'), " ", invoice.currency] })
                            ] }), _jsxs("div", { className: "flex justify-between text-slate-500", children: [
                                _jsxs("span", { children: ["TVA (", invoice.tax > 0 ? '18%' : '0%', ")"] }), _jsxs("span", { children: [invoice.tax.toLocaleString('fr-FR'), " ", invoice.currency] })
                            ] }), _jsxs("div", { className: "flex justify-between border-t border-slate-200 pt-3 text-lg font-bold text-slate-900", children: [
                                _jsx("span", { children: "Total" }), _jsxs("span", { style: { color: primaryColor }, children: [invoice.total.toLocaleString('fr-FR'), " ", invoice.currency] })
                            ] })
                    ] }) }), invoice.notes && (_jsxs("div", { className: "mt-12 p-4 bg-slate-50 rounded-lg text-xs text-slate-500 leading-relaxed", children: [
                    _jsx("p", { className: "font-bold text-slate-700 mb-1", children: "Notes" }), invoice.notes] })), _jsxs("footer", { className: "mt-8 pt-6 border-t border-slate-100 text-center text-[10px] text-slate-400 uppercase tracking-widest", children: [settings.legal_name || business.name, " \u2014 ", settings.rccm ? `RCCM ${settings.rccm}` : "MERCHANT SERVICE"] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 2. APPLE MINIMAL
export const AppleMinimal = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-12 text-black font-sans max-w-4xl mx-auto", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-20", children: [
                    _jsx("h1", { className: "text-4xl font-black tracking-tighter", children: title }), _jsxs("div", { className: "text-right flex flex-col items-end", children: [business.logo_url ? (_jsx("img", { src: business.logo_url, alt: "Logo", className: "h-8 w-auto mb-2 grayscale" })) : (_jsx("div", { className: "h-8 w-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs mb-2", children: business.name[0] })), _jsx("p", { className: "text-2xl font-light", children: business.name }), _jsx("p", { className: "text-slate-400 text-sm mt-1", children: format(new Date(invoice.created_at), 'd MMM yyyy', { locale: fr }) })
                        ] })
                ] }), _jsxs("div", { className: "space-y-8", children: [
                    _jsxs("div", { children: [
                            _jsx("h2", { className: "text-sm font-bold border-b border-black pb-2 mb-4", children: "D\u00C9TAILS DE LA COMMANDE" }), _jsxs("div", { className: "flex justify-between items-center text-sm", children: [
                                    _jsx("span", { children: "Num\u00E9ro de facture" }), _jsx("span", { className: "font-mono", children: invoice.number })
                                ] })
                        ] }), _jsx("div", { className: "space-y-4", children: invoice.items.map((item, i) => (_jsxs("div", { className: "flex justify-between items-end py-2", children: [
                                _jsxs("div", { children: [
                                        _jsx("p", { className: "font-bold", children: item.name }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Quantit\u00E9 : ", item.qty] })
                                    ] }), _jsxs("p", { className: "font-medium", children: [(item.qty * item.price).toLocaleString('fr-FR'), " ", invoice.currency] })
                            ] }, i))) }), _jsxs("div", { className: "pt-8 border-t border-slate-100 space-y-2 text-sm", children: [
                            _jsxs("div", { className: "flex justify-between", children: [
                                    _jsx("span", { className: "text-slate-500", children: "Sous-total" }), _jsx("span", { children: invoice.subtotal.toLocaleString('fr-FR') })
                                ] }), _jsxs("div", { className: "flex justify-between", children: [
                                    _jsx("span", { className: "text-slate-500", children: "Taxes" }), _jsx("span", { children: invoice.tax.toLocaleString('fr-FR') })
                                ] }), _jsxs("div", { className: "flex justify-between text-xl font-black pt-4", children: [
                                    _jsx("span", { children: "TOTAL" }), _jsxs("span", { children: [invoice.total.toLocaleString('fr-FR'), " ", invoice.currency] })
                                ] })
                        ] })
                ] }), _jsxs("div", { className: "mt-20 text-[10px] text-slate-400 leading-relaxed", children: [
                    _jsxs("p", { children: ["Ce document confirme votre achat aupr\u00E8s de ", settings.legal_name || business.name, "."] }), settings.ifu && _jsxs("p", { className: "mt-1", children: ["Identifiant Fiscal : ", settings.ifu] }), _jsx("p", { className: "mt-4", children: "Besoin d'aide ? Contactez notre support via le marchand." })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 3. POS THERMAL (Ticket de caisse)
export const BistroThermal = ({ invoice, business, kind = "receipt" }) => {
    return (_jsxs("div", { className: "bg-white p-6 text-black font-mono max-w-[320px] mx-auto text-xs border border-dashed border-slate-300", children: [
            _jsxs("div", { className: "text-center mb-6 flex flex-col items-center", children: [business.logo_url ? (_jsx("img", { src: business.logo_url, alt: "Logo", className: "h-10 w-auto mb-2 grayscale contrast-200" })) : null, _jsx("h2", { className: "text-sm font-bold uppercase", children: business.name }), _jsx("p", { children: business.description || "Merci de votre visite" }), _jsx("p", { className: "mt-2", children: "----------------------------" }), _jsxs("p", { children: ["TICKET #", invoice.number.slice(-6)] }), _jsx("p", { children: format(new Date(invoice.created_at), 'dd/MM/yyyy HH:mm') }), _jsx("p", { children: "----------------------------" })
                ] }), _jsx("div", { className: "space-y-2", children: invoice.items.map((item, i) => (_jsxs("div", { className: "flex justify-between", children: [
                        _jsxs("span", { className: "truncate flex-1", children: [item.name, " x", item.qty] }), _jsx("span", { className: "ml-2", children: (item.qty * item.price).toLocaleString() })
                    ] }, i))) }), _jsxs("div", { className: "mt-4 border-t border-dashed border-black pt-4 space-y-1", children: [
                    _jsxs("div", { className: "flex justify-between", children: [
                            _jsx("span", { children: "SOUS-TOTAL:" }), _jsx("span", { children: invoice.subtotal.toLocaleString() })
                        ] }), _jsxs("div", { className: "flex justify-between font-bold text-sm", children: [
                            _jsx("span", { children: "TOTAL:" }), _jsxs("span", { children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                        ] })
                ] }), _jsxs("div", { className: "text-center mt-8", children: [
                    _jsx("p", { children: "MERCI ET A BIENTOT !" }), _jsx("div", { className: "mt-4 flex justify-center", children: _jsx(QRCodeSVG, { value: `https://pay.faso-invest.com/verify/${invoice.number}`, size: 64 }) }), _jsx("p", { className: "mt-2 text-[8px] text-slate-500 font-bold", children: "G\u00E9n\u00E9r\u00E9 par FASO-INVEST PAY" })
                ] })
        ] }));
};
// 4. AMAZON RETAIL
export const AmazonRetail = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-8 text-slate-900 font-sans max-w-4xl mx-auto border border-slate-200", children: [
            _jsxs("div", { className: "flex justify-between border-b-2 border-slate-900 pb-4 mb-8", children: [
                    _jsx("h1", { className: "text-3xl font-bold italic", children: "amazon.pay" }), _jsxs("div", { className: "text-right text-sm", children: [
                            _jsx("p", { className: "font-bold", children: "D\u00E9tails de la commande" }), _jsxs("p", { children: [title, " n\u00B0 ", invoice.number] })
                        ] })
                ] }), _jsxs("div", { className: "grid grid-cols-3 gap-8 mb-8 text-sm", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "font-bold mb-1 border-b border-slate-200 pb-1", children: "Adresse de facturation" }), _jsx("p", { children: invoice.customer_name }), _jsx("p", { className: "text-slate-500", children: invoice.customer_email })
                        ] }), _jsxs("div", { children: [
                            _jsx("p", { className: "font-bold mb-1 border-b border-slate-200 pb-1", children: "Mode de paiement" }), _jsx("p", { children: "YengaPay (Mobile Money)" })
                        ] }), _jsxs("div", { children: [
                            _jsx("p", { className: "font-bold mb-1 border-b border-slate-200 pb-1", children: "R\u00E9capitulatif" }), _jsxs("div", { className: "flex justify-between", children: [
                                    _jsx("span", { children: "Articles :" }), _jsx("span", { children: invoice.subtotal.toLocaleString() })
                                ] }), _jsxs("div", { className: "flex justify-between font-bold mt-2 pt-2 border-t border-slate-200", children: [
                                    _jsx("span", { children: "Total :" }), _jsxs("span", { children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                                ] })
                        ] })
                ] }), _jsxs("table", { className: "w-full text-xs", children: [
                    _jsx("thead", { className: "bg-slate-100", children: _jsxs("tr", { children: [
                                _jsx("th", { className: "p-2 text-left", children: "Article" }), _jsx("th", { className: "p-2 text-right", children: "Prix" }), _jsx("th", { className: "p-2 text-right", children: "Qt\u00E9" }), _jsx("th", { className: "p-2 text-right", children: "Total" })
                            ] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: invoice.items.map((item, i) => (_jsxs("tr", { children: [
                                _jsx("td", { className: "p-2", children: item.name }), _jsx("td", { className: "p-2 text-right", children: item.price.toLocaleString() }), _jsx("td", { className: "p-2 text-right", children: item.qty }), _jsx("td", { className: "p-2 text-right", children: (item.qty * item.price).toLocaleString() })
                            ] }, i))) })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 5. GOUVERNEMENTAL (Standard officiel)
export const GovStandard = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-12 text-black font-serif max-w-4xl mx-auto border-4 border-double border-black", children: [
            _jsxs("div", { className: "text-center mb-12", children: [
                    _jsx("h2", { className: "text-xl font-bold uppercase underline decoration-double underline-offset-4", children: "Burkina Faso" }), _jsx("p", { className: "text-sm italic", children: "Unit\u00E9 - Progr\u00E8s - Justice" }), _jsxs("div", { className: "mt-8 flex justify-between items-start text-left text-xs uppercase font-bold", children: [
                            _jsxs("div", { children: [
                                    _jsx("p", { children: settings.legal_name || business.name }), _jsxs("p", { children: ["IFU: ", settings.ifu || "00000000X"] }), _jsxs("p", { children: ["RCCM: ", settings.rccm || "BF OUA 2024 B 000"] })
                                ] }), _jsxs("div", { className: "text-right", children: [
                                    _jsxs("p", { children: [title, " n\u00B0 ", invoice.number] }), _jsxs("p", { children: ["Date: ", format(new Date(invoice.created_at), 'dd/MM/yyyy')] })
                                ] })
                        ] })
                ] }), _jsx("div", { className: "mb-8 p-4 border border-black bg-slate-50", children: _jsxs("p", { className: "text-sm font-bold", children: ["DOIT: ", invoice.customer_name] }) }), _jsxs("table", { className: "w-full border-collapse border border-black text-sm", children: [
                    _jsx("thead", { children: _jsxs("tr", { className: "bg-slate-100", children: [
                                _jsx("th", { className: "border border-black p-2 text-left", children: "D\u00E9signation" }), _jsx("th", { className: "border border-black p-2 text-right w-24", children: "Quantit\u00E9" }), _jsx("th", { className: "border border-black p-2 text-right w-32", children: "Prix Unitaire" }), _jsx("th", { className: "border border-black p-2 text-right w-32", children: "Montant" })
                            ] }) }), _jsxs("tbody", { children: [invoice.items.map((item, i) => (_jsxs("tr", { children: [
                                    _jsx("td", { className: "border border-black p-2", children: item.name }), _jsx("td", { className: "border border-black p-2 text-right", children: item.qty }), _jsx("td", { className: "border border-black p-2 text-right", children: item.price.toLocaleString() }), _jsx("td", { className: "border border-black p-2 text-right", children: (item.qty * item.price).toLocaleString() })
                                ] }, i))), [...Array(Math.max(0, 5 - invoice.items.length))].map((_, i) => (_jsxs("tr", { className: "h-8", children: [
                                    _jsx("td", { className: "border border-black p-2" }), _jsx("td", { className: "border border-black p-2" }), _jsx("td", { className: "border border-black p-2" }), _jsx("td", { className: "border border-black p-2" })
                                ] }, `blank-${i}`)))] }), _jsx("tfoot", { children: _jsxs("tr", { children: [
                                _jsx("td", { colSpan: 3, className: "border border-black p-2 text-right font-bold uppercase", children: "Net \u00E0 Payer" }), _jsxs("td", { className: "border border-black p-2 text-right font-bold", children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                            ] }) })
                ] }), _jsx("div", { className: "mt-12 text-xs italic", children: _jsxs("p", { children: ["Arr\u00EAt\u00E9e la pr\u00E9sente facture \u00E0 la somme de : ", invoice.total.toLocaleString(), " ", invoice.currency] }) }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 6. STRIPE VINTAGE
export const StripeVintage = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-[#fcfcfc] p-10 font-serif max-w-2xl mx-auto border border-slate-200 shadow-xl", children: [
            _jsxs("div", { className: "flex justify-between border-b pb-6", children: [
                    _jsx("h2", { className: "text-2xl font-bold uppercase tracking-widest", children: business.name }), _jsxs("div", { className: "text-right text-xs text-slate-500", children: [
                            _jsxs("p", { children: [title.toUpperCase(), " #", invoice.number] }), _jsx("p", { children: format(new Date(invoice.created_at), 'MMMM d, yyyy') })
                        ] })
                ] }), _jsxs("div", { className: "mt-8", children: [
                    _jsxs("table", { className: "w-full text-left", children: [
                            _jsx("thead", { children: _jsxs("tr", { className: "border-b uppercase text-[10px] text-slate-400", children: [
                                        _jsx("th", { className: "py-2", children: "Item" }), _jsx("th", { className: "py-2 text-right", children: "Total" })
                                    ] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: invoice.items.map((it, i) => (_jsxs("tr", { className: "text-sm", children: [
                                        _jsxs("td", { className: "py-3", children: [it.name, " x", it.qty] }), _jsx("td", { className: "py-3 text-right", children: (it.qty * it.price).toLocaleString() })
                                    ] }, i))) })
                        ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
                ] })
        ] }));
};
// 7. PAYPAL STATEMENT
export const PaypalStatement = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-8 max-w-3xl mx-auto border border-blue-100", children: [
            _jsxs("div", { className: "bg-blue-600 p-6 -m-8 mb-8 text-white", children: [
                    _jsx("h2", { className: "text-xl font-bold", children: "PayPal" }), _jsxs("p", { className: "text-sm opacity-90", children: [title, " Transaction Statement"] })
                ] }), _jsxs("div", { className: "flex justify-between items-center mb-8", children: [
                    _jsxs("div", { className: "text-sm", children: [
                            _jsx("p", { className: "font-bold text-slate-600", children: kind === "receipt" ? "CLIENT" : "INVOICE TO" }), _jsx("p", { className: "font-bold text-lg", children: invoice.customer_name }), _jsx("p", { className: "text-slate-500 text-xs mt-1", children: invoice.customer_email })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsxs("p", { className: "text-3xl font-bold text-blue-600", children: [invoice.total.toLocaleString(), " ", invoice.currency] }), _jsx("p", { className: "text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest", children: invoice.number })
                        ] })
                ] }), _jsx("div", { className: "space-y-4 mb-8", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center text-sm border-b border-slate-50 pb-2", children: [
                        _jsxs("span", { children: [it.name, " ",
                                _jsxs("span", { className: "text-slate-400", children: ["x", it.qty] })
                            ] }), _jsx("span", { className: "font-bold", children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsx("div", { className: "mt-8 pt-8 border-t border-slate-100 text-center", children: _jsxs("p", { className: "text-xs text-slate-400 italic", children: ["Merchant: ", business.name] }) }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// Add more templates...
// 8. QONTO MODERN
export const QontoModern = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-12 max-w-4xl mx-auto text-slate-900 border border-slate-100 rounded-3xl", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-16", children: [
                    _jsx("div", { className: "bg-indigo-600 text-white p-4 rounded-2xl font-black text-2xl w-16 h-16 flex items-center justify-center", children: "Q" }), _jsxs("div", { className: "text-right", children: [
                            _jsxs("h2", { className: "text-4xl font-black tracking-tight", children: [invoice.total.toLocaleString(), " ", invoice.currency] }), _jsxs("p", { className: "text-slate-400 font-bold uppercase tracking-widest text-xs mt-2", children: [title, " #", invoice.number] })
                        ] })
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-12 mb-16", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "text-slate-400 text-xs font-bold uppercase mb-4", children: "\u00C9metteur" }), _jsx("p", { className: "font-bold", children: settings.legal_name || business.name }), _jsx("p", { className: "text-slate-500 text-sm", children: settings.address })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-slate-400 text-xs font-bold uppercase mb-4", children: "Client" }), _jsx("p", { className: "font-bold", children: invoice.customer_name }), _jsx("p", { className: "text-slate-500 text-sm", children: invoice.customer_email })
                        ] })
                ] }), _jsx("div", { className: "space-y-4 mb-16", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center py-4 border-b border-slate-50", children: [
                        _jsxs("span", { className: "font-medium", children: [it.name, " ",
                                _jsxs("span", { className: "text-slate-400 ml-2", children: ["x", it.qty] })
                            ] }), _jsx("span", { className: "font-bold", children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 9. UBER RECEIPT
export const UberReceipt = ({ invoice, business, kind = "receipt" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-6 max-w-md mx-auto font-sans shadow-lg border-t-8 border-black", children: [
            _jsxs("div", { className: "flex justify-between items-center mb-10", children: [
                    _jsx("h1", { className: "text-3xl font-bold tracking-tighter", children: "Uber" }), _jsx("p", { className: "text-slate-400 text-sm", children: format(new Date(invoice.created_at), 'dd/MM/yyyy') })
                ] }), _jsxs("div", { className: "mb-4", children: [
                    _jsx("p", { className: "text-[10px] text-slate-400 uppercase font-bold tracking-widest", children: title }), _jsxs("h2", { className: "text-4xl font-bold", children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                ] }), _jsx("div", { className: "space-y-4 text-sm border-t border-b py-6 border-slate-100", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between", children: [
                        _jsx("span", { className: "text-slate-600", children: it.name }), _jsx("span", { className: "font-bold", children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsxs("div", { className: "mt-6 flex items-center gap-3", children: [
                    _jsx("div", { className: "w-8 h-8 rounded-full bg-slate-200" }), _jsxs("div", { children: [
                            _jsx("p", { className: "font-bold", children: "Pay\u00E9 via YengaPay" }), _jsxs("p", { className: "text-xs text-slate-400", children: ["R\u00E9f: ", invoice.number] })
                        ] })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 10. LUXE MAISON (Style Chanel/Vuitton)
export const LuxeMaison = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-[#1a1a1a] p-16 text-white font-serif max-w-4xl mx-auto tracking-widest uppercase text-center relative overflow-hidden", children: [
            _jsx("div", { className: "absolute top-0 left-0 w-full h-full border-[20px] border-white/5 pointer-events-none" }), _jsx("h1", { className: "text-5xl font-light mb-16 tracking-[0.3em]", children: business.name }), _jsxs("div", { className: "border-t border-white/20 pt-12 mb-12 flex justify-between text-[10px] opacity-60", children: [
                    _jsxs("span", { children: [title, " N\u00B0", invoice.number] }), _jsx("span", { children: format(new Date(invoice.created_at), 'dd . MM . yyyy') })
                ] }), _jsx("div", { className: "space-y-8 my-20", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center group", children: [
                        _jsx("span", { className: "text-xl font-light", children: it.name }), _jsxs("span", { className: "text-xl", children: [(it.qty * it.price).toLocaleString(), " ", invoice.currency] })
                    ] }, i))) }), _jsxs("div", { className: "border-t border-white/20 pt-12", children: [
                    _jsxs("p", { className: "text-3xl font-light", children: [invoice.total.toLocaleString(), " ", invoice.currency] }), _jsx("p", { className: "text-[8px] mt-20 opacity-40 italic underline underline-offset-8", children: "Merci de votre confiance" })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 11. GOOGLE CLOUD
export const GoogleCloud = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu de taxes" : kind === "contract" ? "Contrat" : "Facture de taxes";
    return (_jsxs("div", { className: "bg-white p-10 max-w-4xl mx-auto border border-slate-200 font-sans text-slate-800", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-10", children: [
                    _jsxs("div", { className: "flex items-center gap-2", children: [
                            _jsx("div", { className: "w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400", children: "G" }), _jsx("span", { className: "text-xl font-bold text-slate-500", children: "Google Cloud" })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsx("h2", { className: "text-2xl font-light", children: title }), _jsxs("p", { className: "text-sm text-slate-400", children: ["Date : ", format(new Date(invoice.created_at), 'd MMM yyyy')] })
                        ] })
                ] }), _jsxs("div", { className: "bg-slate-50 p-6 rounded-lg mb-10 flex justify-between", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "text-xs font-bold text-slate-400 mb-2", children: "Informations Client" }), _jsx("p", { className: "font-bold", children: invoice.customer_name }), _jsx("p", { className: "text-sm text-slate-500", children: invoice.customer_email })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-xs font-bold text-slate-400 mb-2", children: "Total d\u00FB" }), _jsxs("p", { className: "text-3xl font-bold", children: [invoice.total.toLocaleString(), " ", invoice.currency] }), _jsxs("p", { className: "text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1", children: ["Ref: ", invoice.number] })
                        ] })
                ] }), _jsxs("table", { className: "w-full text-sm mb-10", children: [
                    _jsx("thead", { className: "border-b-2 border-slate-800", children: _jsxs("tr", { className: "text-left font-bold", children: [
                                _jsx("th", { className: "py-2", children: "Description" }), _jsxs("th", { className: "py-2 text-right", children: ["Montant (", invoice.currency, ")"] })
                            ] }) }), _jsx("tbody", { className: "divide-y divide-slate-200", children: invoice.items.map((it, i) => (_jsxs("tr", { children: [
                                _jsxs("td", { className: "py-4", children: [
                                        _jsx("p", { className: "font-bold", children: it.name }), _jsxs("p", { className: "text-xs text-slate-400 italic", children: ["Usage du ", format(new Date(invoice.created_at), 'MM/yyyy')] })
                                    ] }), _jsx("td", { className: "py-4 text-right", children: (it.qty * it.price).toLocaleString() })
                            ] }, i))) })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 12. AIRBNB HOST
export const AirbnbHost = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu d'hôte" : kind === "contract" ? "Contrat" : "Facture d'hôte";
    return (_jsxs("div", { className: "bg-white p-12 max-w-3xl mx-auto font-sans text-slate-900 border border-slate-100 rounded-lg shadow-2xl", children: [
            _jsxs("div", { className: "flex justify-between items-center mb-16", children: [
                    _jsx("div", { className: "text-rose-500", children: _jsx("svg", { viewBox: "0 0 32 32", className: "w-10 h-10 fill-current", children: _jsx("path", { d: "M16 1c2.008 0 3.463.963 4.751 3.269l.533 1.025c1.954 3.83 6.114 12.54 7.1 14.836l.145.353c.667 1.591.91 2.472.96 3.396l.01.415.001.228c0 4.062-2.877 6.478-6.357 6.478-2.224 0-4.556-1.258-6.709-3.386l-.257-.26-.172-.179h-.011l-.176.185c-2.044 2.1-4.392 3.42-6.72 3.42-3.481 0-6.358-2.416-6.358-6.478l.002-.232c.036-1.12.336-2.186.883-3.665l.182-.47c1.116-2.73 5.342-11.75 7.152-15.356l.519-1.026C12.537 1.963 13.992 1 16 1zm0 2c-1.239 0-2.253.539-3.235 2.292l-.503 1c-1.745 3.472-5.908 12.355-7.008 15.044l-.155.404c-.53 1.433-.767 2.333-.797 3.232l-.002.228c0 2.924 1.977 4.478 4.358 4.478 1.706 0 3.659-1.076 5.617-3.03l.317-.323.315-.327-.315-.327-.317-.323c-1.958-1.954-3.911-3.03-5.617-3.03-2.381 0-4.358 1.554-4.358 4.478l.002.228c.03.899.267 1.799.797 3.232l.155.404c1.1 2.689 5.263 11.572 7.008 15.044l.503 1c.982 1.753 1.996 2.292 3.235 2.292z" }) }) }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-slate-400 uppercase font-bold text-xs", children: title }), _jsxs("p", { className: "font-bold", children: ["N\u00B0", invoice.number] })
                        ] })
                ] }), _jsxs("div", { className: "mb-12", children: [
                    _jsxs("h2", { className: "text-4xl font-bold tracking-tight mb-2", children: ["F\u00E9licitations, ", invoice.customer_name, "!"] }), _jsxs("p", { className: "text-slate-500", children: ["Votre paiement a \u00E9t\u00E9 trait\u00E9 avec succ\u00E8s via ", business.name, "."] })
                ] }), _jsx("div", { className: "bg-slate-50 p-8 rounded-2xl space-y-4 mb-10", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center border-b border-slate-200 pb-4 last:border-0 last:pb-0", children: [
                        _jsxs("div", { children: [
                                _jsx("p", { className: "font-bold text-lg", children: it.name }), _jsxs("p", { className: "text-slate-500 text-sm", children: [it.qty, " unit\u00E9(s)"] })
                            ] }), _jsxs("p", { className: "font-bold text-lg", children: [(it.qty * it.price).toLocaleString(), " ", invoice.currency] })
                    ] }, i))) }), _jsx(VerificationFooter, { business: business, invoice: invoice }), _jsx("div", { className: "mt-12 text-center text-xs text-slate-400", children: _jsx("p", { children: "G\u00E9n\u00E9r\u00E9 par Faso-Invest Pay. Document authentifi\u00E9 par QR Code." }) })
        ] }));
};
// 13. WISE BORDERLESS
export const WiseBorderless = ({ invoice, business, settings, kind = "invoice" }) => {
    const statusLabel = kind === "receipt" ? "Reçu confirmé" : kind === "contract" ? "Contrat signé" : "Transaction confirmée";
    return (_jsxs("div", { className: "bg-[#252c32] p-10 max-w-4xl mx-auto text-white font-sans border border-slate-700", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-16", children: [
                    _jsx("div", { className: "bg-[#00b9ff] text-white px-4 py-2 font-black text-xl italic", children: "Wise" }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-[#00b9ff] font-bold", children: statusLabel }), _jsx("p", { className: "text-sm opacity-50", children: format(new Date(invoice.created_at), 'd MMM yyyy, HH:mm') })
                        ] })
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-10 mb-16", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "text-xs opacity-50 uppercase mb-2", children: "\u00C9metteur" }), _jsx("p", { className: "font-bold text-xl", children: settings.legal_name || business.name })
                        ] }), _jsxs("div", { children: [
                            _jsx("p", { className: "text-xs opacity-50 uppercase mb-2", children: "B\u00E9n\u00E9ficiaire" }), _jsx("p", { className: "font-bold text-xl", children: invoice.customer_name })
                        ] })
                ] }), _jsxs("div", { className: "bg-white/5 p-8 border border-white/10 space-y-6 mb-10", children: [
                    _jsxs("div", { className: "flex justify-between text-2xl font-bold", children: [
                            _jsx("span", { className: "opacity-50 font-normal", children: "Montant total" }), _jsxs("span", { children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                        ] }), _jsxs("div", { className: "flex justify-between text-[10px] opacity-30 uppercase font-bold tracking-tighter pt-6 border-t border-white/10", children: [
                            _jsx("span", { children: "R\u00E9f Transaction" }), _jsx("span", { children: invoice.number })
                        ] })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 14. MICROSOFT AZURE
export const MicrosoftAzure = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-12 max-w-4xl mx-auto border border-slate-200 font-sans text-slate-900", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-12", children: [
                    _jsxs("div", { className: "flex items-center gap-3", children: [
                            _jsxs("div", { className: "grid grid-cols-2 w-8 h-8 gap-0.5", children: [
                                    _jsx("div", { className: "bg-[#f25022]" }), _jsx("div", { className: "bg-[#7fba00]" }), _jsx("div", { className: "bg-[#00a4ef]" }), _jsx("div", { className: "bg-[#ffb900]" })
                                ] }), _jsx("span", { className: "text-xl font-bold text-slate-600", children: "Microsoft Azure" })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsx("h1", { className: "text-3xl font-light", children: title }), _jsxs("p", { className: "text-slate-500", children: ["ID : ", invoice.number] })
                        ] })
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-20 mb-12", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "text-xs font-bold text-slate-400 uppercase mb-2", children: "Vendu \u00E0" }), _jsx("p", { className: "font-bold", children: invoice.customer_name }), _jsx("p", { className: "text-sm text-slate-500", children: invoice.customer_email })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-xs font-bold text-slate-400 uppercase mb-2", children: "Total" }), _jsxs("p", { className: "text-4xl font-light text-blue-600", children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                        ] })
                ] }), _jsxs("table", { className: "w-full text-sm border-t border-b border-slate-200 mb-10", children: [
                    _jsx("thead", { children: _jsxs("tr", { className: "text-left bg-slate-50", children: [
                                _jsx("th", { className: "py-3 px-4", children: "Description" }), _jsx("th", { className: "py-3 px-4 text-right", children: "Quantit\u00E9" }), _jsx("th", { className: "py-3 px-4 text-right", children: "Total" })
                            ] }) }), _jsx("tbody", { children: invoice.items.map((it, i) => (_jsxs("tr", { className: "border-b border-slate-100 last:border-0", children: [
                                _jsx("td", { className: "py-4 px-4 font-medium", children: it.name }), _jsx("td", { className: "py-4 px-4 text-right", children: it.qty }), _jsx("td", { className: "py-4 px-4 text-right font-bold", children: (it.qty * it.price).toLocaleString() })
                            ] }, i))) })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice }), _jsxs("div", { className: "mt-12 text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed", children: [business.name, " - Document authentifi\u00E9 via Faso-Invest Pay."] })
        ] }));
};
// 15. REVOLUT BUSINESS
export const RevolutBusiness = ({ invoice, business, settings, kind = "invoice" }) => {
    const statusLabel = kind === "receipt" ? "Reçu" : kind === "contract" ? "Signé" : "Réussi";
    return (_jsxs("div", { className: "bg-[#0e0e10] p-12 max-w-4xl mx-auto text-white font-sans border border-white/5 rounded-[2rem]", children: [
            _jsxs("div", { className: "flex justify-between items-center mb-20", children: [
                    _jsxs("div", { className: "text-2xl font-black italic tracking-tighter", children: ["Revolut ",
                            _jsx("span", { className: "text-white/40 font-normal", children: "Business" })
                        ] }), _jsx("div", { className: "bg-white/10 px-4 py-2 rounded-full text-xs font-bold uppercase", children: statusLabel })
                ] }), _jsxs("div", { className: "mb-20", children: [
                    _jsxs("h2", { className: "text-6xl font-black tracking-tight mb-4", children: [invoice.total.toLocaleString(), " ", invoice.currency] }), _jsxs("p", { className: "text-white/40 font-bold uppercase tracking-widest text-sm", children: ["Client : ", invoice.customer_name] })
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-10 border-t border-white/10 pt-10 mb-10", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "text-white/40 text-xs font-bold uppercase mb-2", children: "Exp\u00E9diteur" }), _jsx("p", { className: "font-bold text-lg", children: settings.legal_name || business.name }), _jsx("p", { className: "text-white/60 text-sm mt-1", children: settings.address })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-white/40 text-xs font-bold uppercase mb-2", children: "R\u00E9f\u00E9rence" }), _jsx("p", { className: "font-bold text-lg", children: invoice.number }), _jsx("p", { className: "text-white/60 text-sm mt-1", children: format(new Date(invoice.created_at), 'dd MMM yyyy') })
                        ] })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice }), _jsx("div", { className: "mt-10 pt-10 border-t border-white/10 flex justify-center", children: _jsx("div", { className: "h-20 w-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center font-bold text-4xl shadow-2xl", children: "R" }) })
        ] }));
};
// 16. NOTAIRE OFFICIEL (Minimalisme strict)
export const NotaireOfficiel = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Note de Frais" : kind === "contract" ? "Acte Notarié" : "Facture de Frais";
    return (_jsxs("div", { className: "bg-[#fdfcf9] p-20 max-w-5xl mx-auto text-[#1a1a1a] font-serif border-x border-slate-200", children: [
            _jsxs("div", { className: "text-center mb-20", children: [
                    _jsx("h1", { className: "text-3xl font-light uppercase tracking-[0.5em] border-b border-black pb-8 inline-block", children: "Office Notarial" }), _jsx("p", { className: "mt-8 text-sm italic", children: settings.legal_name || business.name }), _jsx("p", { className: "text-xs uppercase tracking-widest mt-2", children: settings.address })
                ] }), _jsxs("div", { className: "flex justify-between items-end mb-20 text-sm italic", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { children: "A l'attention de M/Mme" }), _jsx("p", { className: "font-bold text-lg not-italic", children: invoice.customer_name })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsxs("p", { children: ["Ouagadougou, le ", format(new Date(invoice.created_at), 'dd MMMM yyyy', { locale: fr })] }), _jsxs("p", { className: "mt-1 font-bold not-italic", children: [title, " N\u00B0", invoice.number] })
                        ] })
                ] }), _jsx("div", { className: "space-y-6 text-sm leading-loose mb-20", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between border-b border-slate-100 pb-2", children: [
                        _jsxs("span", { children: [it.name, " (Qte: ", it.qty, ")"] }), _jsxs("span", { className: "font-bold", children: [(it.qty * it.price).toLocaleString(), " ", invoice.currency] })
                    ] }, i))) }), _jsx("div", { className: "flex justify-end pt-10 border-t-2 border-black mb-10", children: _jsxs("div", { className: "text-right", children: [
                        _jsx("p", { className: "text-xs uppercase tracking-widest opacity-50", children: "Total Honoraires TTC" }), _jsxs("p", { className: "text-3xl font-bold", children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                    ] }) }), _jsx(VerificationFooter, { business: business, invoice: invoice }), _jsxs("div", { className: "mt-20 text-center text-[10px] uppercase tracking-widest opacity-40", children: ["Document certifi\u00E9 par l'Office Notarial ", business.name, " - YengaPay Ecosystem."] })
        ] }));
};
// 17. DIGITAL NOMAD (Style Indie Hackers)
export const DigitalNomad = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "RECEIPT" : kind === "contract" ? "CONTRACT" : "INVOICE";
    return (_jsxs("div", { className: "bg-[#f4f7f6] p-12 max-w-3xl mx-auto font-mono text-slate-800 border-2 border-slate-800 shadow-[8px_8px_0px_0px_rgba(30,41,59,1)]", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-12 border-b-2 border-slate-800 pb-8", children: [
                    _jsxs("div", { children: [
                            _jsx("h1", { className: "text-2xl font-black bg-yellow-300 px-2 inline-block mb-2", children: title }), _jsxs("p", { className: "font-bold", children: ["#", invoice.number] })
                        ] }), _jsxs("div", { className: "text-right font-bold uppercase text-xs", children: [
                            _jsx("p", { children: business.name }), _jsx("p", { className: "bg-slate-800 text-white px-2 mt-1", children: "Paid via YengaPay" })
                        ] })
                ] }), _jsxs("div", { className: "space-y-8 mb-12", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "text-xs uppercase opacity-50 mb-2", children: "Client // Destination" }), _jsx("p", { className: "text-xl font-black", children: invoice.customer_name })
                        ] }), _jsx("div", { className: "bg-white border-2 border-slate-800 p-6 space-y-4", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center border-b border-slate-100 last:border-0 pb-2", children: [
                                _jsxs("span", { children: [it.name, " ",
                                        _jsxs("span", { className: "text-xs opacity-50", children: ["x", it.qty] })
                                    ] }), _jsx("span", { className: "font-black", children: (it.qty * it.price).toLocaleString() })
                            ] }, i))) })
                ] }), _jsxs("div", { className: "flex justify-between items-center font-black text-2xl bg-yellow-300 p-4 border-2 border-slate-800 mb-8", children: [
                    _jsx("span", { children: "TOTAL" }), _jsxs("span", { children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 18. RETRO TICKET (80s Style)
export const RetroTicket = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "RECEIPT" : kind === "contract" ? "CONTRACT" : "INVOICE";
    return (_jsxs("div", { className: "bg-[#121212] p-8 max-w-2xl mx-auto font-mono text-[#39ff14] border-4 border-[#39ff14] shadow-[0_0_20px_rgba(57,255,20,0.3)]", children: [
            _jsxs("div", { className: "text-center mb-10", children: [
                    _jsxs("h1", { className: "text-3xl font-black uppercase tracking-tighter mb-2 italic", children: ["** ", title, " COMPLETE **"] }), _jsxs("p", { className: "text-xs opacity-70", children: ["TERMINAL: ", business.name.toUpperCase()] })
                ] }), _jsx("div", { className: "space-y-4 border-y-2 border-[#39ff14] border-dashed py-8 mb-8", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center text-xl", children: [
                        _jsx("span", { children: it.name.toUpperCase() }), _jsx("span", { children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsxs("div", { className: "flex justify-between items-center text-4xl font-black border-2 border-[#39ff14] p-4 mb-8", children: [
                    _jsx("span", { children: "TOTAL" }), _jsxs("span", { children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice }), _jsxs("div", { className: "mt-10 text-center animate-pulse text-xs", children: [
                    _jsxs("p", { children: ["REF: ", invoice.number] }), _jsx("p", { children: "AUTHENTICATED DOCUMENT // YENGAPAY" })
                ] })
        ] }));
};
// 19. CLEAN PHARMACY
export const CleanPharmacy = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-10 max-w-4xl mx-auto border-t-8 border-emerald-500 font-sans shadow-lg", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-12", children: [
                    _jsxs("div", { className: "flex items-center gap-3", children: [
                            _jsx("div", { className: "w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl", children: "+" }), _jsxs("div", { children: [
                                    _jsx("h1", { className: "text-xl font-black text-slate-900", children: settings.legal_name || business.name }), _jsx("p", { className: "text-xs text-emerald-600 font-bold uppercase tracking-widest", children: "Sant\u00E9 & Bien-\u00EAtre" })
                                ] })
                        ] }), _jsxs("div", { className: "text-right text-sm", children: [
                            _jsxs("p", { className: "font-bold", children: [title, " N\u00B0 ", invoice.number] }), _jsx("p", { className: "text-slate-400", children: format(new Date(invoice.created_at), 'dd/MM/yyyy') })
                        ] })
                ] }), _jsxs("div", { className: "mb-10 bg-emerald-50 p-6 rounded-2xl", children: [
                    _jsx("p", { className: "text-xs font-bold text-emerald-800 uppercase mb-2", children: "Informations Client" }), _jsx("p", { className: "text-xl font-bold text-slate-900", children: invoice.customer_name }), _jsx("p", { className: "text-sm text-slate-500", children: invoice.customer_email })
                ] }), _jsxs("table", { className: "w-full text-sm mb-12", children: [
                    _jsx("thead", { className: "text-emerald-800 font-bold border-b-2 border-emerald-100", children: _jsxs("tr", { className: "text-left", children: [
                                _jsx("th", { className: "py-2", children: "Description" }), _jsx("th", { className: "py-2 text-right", children: "Qte" }), _jsx("th", { className: "py-2 text-right", children: "Total" })
                            ] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: invoice.items.map((it, i) => (_jsxs("tr", { children: [
                                _jsx("td", { className: "py-4 font-medium text-slate-700", children: it.name }), _jsx("td", { className: "py-4 text-right text-slate-500", children: it.qty }), _jsx("td", { className: "py-4 text-right font-bold text-slate-900", children: (it.qty * it.price).toLocaleString() })
                            ] }, i))) })
                ] }), _jsxs("div", { className: "flex justify-between items-end pt-8 border-t border-slate-100", children: [
                    _jsx(VerificationFooter, { business: business, invoice: invoice }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-xs font-bold text-slate-400 uppercase", children: "Net \u00E0 payer" }), _jsxs("p", { className: "text-4xl font-black text-emerald-600", children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                        ] })
                ] })
        ] }));
};
// 20. TECH STARTUP (Style Linear/Vercel)
export const TechStartup = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "RECEIPT" : kind === "contract" ? "CONTRACT" : "INVOICE";
    return (_jsxs("div", { className: "bg-[#000000] p-12 max-w-4xl mx-auto text-white font-sans border border-white/10 rounded-xl overflow-hidden relative", children: [
            _jsx("div", { className: "absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px]" }), _jsxs("div", { className: "flex justify-between items-center mb-24 relative z-10", children: [
                    _jsxs("div", { className: "flex items-center gap-2", children: [
                            _jsx("div", { className: "w-6 h-6 bg-white rounded-full" }), _jsx("span", { className: "font-bold text-lg tracking-tight", children: business.name })
                        ] }), _jsxs("div", { className: "text-xs font-medium text-white/40 uppercase tracking-[0.2em]", children: [title, " ", invoice.number] })
                ] }), _jsx("div", { className: "mb-24 relative z-10", children: _jsxs("h2", { className: "text-5xl font-medium tracking-tighter leading-tight mb-4 italic", children: ["Confirming your order,",
                        _jsx("br", {}), _jsxs("span", { className: "text-white/40", children: [invoice.customer_name, "."] })
                    ] }) }), _jsx("div", { className: "space-y-4 mb-24 relative z-10", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center py-4 border-b border-white/5", children: [
                        _jsxs("span", { className: "text-white/60 font-medium", children: [it.name, " ",
                                _jsxs("span", { className: "text-white/20 ml-2", children: ["\u00D7 ", it.qty] })
                            ] }), _jsx("span", { className: "font-bold tracking-tight text-xl", children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsx("div", { className: "mb-10 relative z-10", children: _jsx(VerificationFooter, { business: business, invoice: invoice }) }), _jsxs("div", { className: "flex justify-between items-end relative z-10", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "text-xs text-white/40 font-bold uppercase tracking-widest mb-1", children: "Total Paid" }), _jsxs("p", { className: "text-4xl font-bold tracking-tighter", children: [invoice.total.toLocaleString(), " ",
                                    _jsx("span", { className: "text-white/40 text-2xl", children: invoice.currency })
                                ] })
                        ] }), _jsx("div", { className: "text-right text-[10px] text-white/20 uppercase font-bold tracking-[0.3em]", children: "AUTHENTICATED VIA YENGAPAY" })
                ] })
        ] }));
};
// 21. COFFEE SHOP
export const CoffeeShop = ({ invoice, business, kind = "receipt" }) => {
    const title = kind === "receipt" ? "RECEIPT" : kind === "contract" ? "CONTRACT" : "INVOICE";
    return (_jsxs("div", { className: "bg-[#fff9f0] p-8 max-w-[380px] mx-auto font-mono text-[#5d4037] border-2 border-[#d7ccc8] shadow-sm rounded-lg relative overflow-hidden", children: [
            _jsx("div", { className: "absolute top-0 left-0 w-full h-1 bg-[#5d4037]" }), _jsxs("div", { className: "text-center mb-10", children: [
                    _jsx("h1", { className: "text-2xl font-black uppercase italic tracking-tighter mb-1", children: business.name }), _jsx("p", { className: "text-[10px] uppercase opacity-60 italic", children: title })
                ] }), _jsxs("div", { className: "space-y-4 mb-8 text-sm", children: [
                    _jsxs("div", { className: "flex justify-between border-b border-[#d7ccc8] border-dashed pb-2", children: [
                            _jsxs("span", { children: ["#", invoice.number.slice(-5)] }), _jsx("span", { children: format(new Date(invoice.created_at), 'HH:mm') })
                        ] }), invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center group", children: [
                            _jsxs("span", { className: "font-bold", children: [it.name.toUpperCase(), " ",
                                    _jsxs("span", { className: "text-[10px] font-normal opacity-60", children: ["\u00D7 ", it.qty] })
                                ] }), _jsx("span", { className: "font-bold", children: (it.qty * it.price).toLocaleString() })
                        ] }, i)))] }), _jsx("div", { className: "border-t-2 border-[#5d4037] pt-4 mb-6", children: _jsxs("div", { className: "flex justify-between items-center text-xl font-black", children: [
                        _jsx("span", { children: "TOTAL DUE" }), _jsxs("span", { children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                    ] }) }), _jsx("div", { className: "mb-6 flex justify-center scale-75", children: _jsx(VerificationFooter, { business: business, invoice: invoice }) }), _jsxs("div", { className: "text-center text-[10px] opacity-60 italic leading-relaxed", children: [
                    _jsx("p", { children: "Merci de votre visite !" }), _jsx("p", { className: "mt-2 text-[8px] uppercase not-italic font-bold", children: "Processed via Faso-Invest Pay" })
                ] })
        ] }));
};
// 22. HOTEL LUXE (Conciergerie)
export const HotelLuxe = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Folio Reçu" : kind === "contract" ? "Contrat de Séjour" : "Folio de Facturation";
    return (_jsxs("div", { className: "bg-white p-16 max-w-5xl mx-auto text-[#2c3e50] font-serif border border-slate-100 shadow-2xl relative", children: [
            _jsx("div", { className: "absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#d4af37] via-[#f1e5ac] to-[#d4af37]" }), _jsxs("div", { className: "flex justify-between items-start mb-24", children: [
                    _jsxs("div", { children: [
                            _jsx("h1", { className: "text-4xl font-light tracking-[0.2em] uppercase mb-2", children: business.name }), _jsx("p", { className: "text-xs uppercase tracking-widest text-[#d4af37] font-bold", children: "Luxury Collection" })
                        ] }), _jsxs("div", { className: "text-right text-xs uppercase tracking-widest leading-loose", children: [
                            _jsxs("p", { children: [title, " N\u00B0 ", invoice.number] }), _jsx("p", { children: format(new Date(invoice.created_at), 'MMMM d, yyyy') })
                        ] })
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-20 mb-20 text-sm border-b border-slate-100 pb-20", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "text-[#d4af37] font-bold uppercase mb-4 tracking-widest", children: "Informations Client" }), _jsx("p", { className: "text-2xl font-light", children: invoice.customer_name }), _jsx("p", { className: "text-slate-400 mt-2 italic", children: invoice.customer_email })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-[#d4af37] font-bold uppercase mb-4 tracking-widest", children: "\u00C9tablissement" }), _jsx("p", { className: "font-bold text-lg", children: settings.legal_name || business.name }), _jsx("p", { className: "text-slate-500 mt-1", children: settings.address })
                        ] })
                ] }), _jsxs("table", { className: "w-full text-sm mb-20", children: [
                    _jsx("thead", { children: _jsxs("tr", { className: "text-left text-[#d4af37] font-bold uppercase tracking-widest text-[10px] border-b border-slate-100", children: [
                                _jsx("th", { className: "py-4", children: "Description des Services" }), _jsx("th", { className: "py-4 text-right", children: "Montant" })
                            ] }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: invoice.items.map((it, i) => (_jsxs("tr", { children: [
                                _jsxs("td", { className: "py-6 italic", children: [it.name, " ",
                                        _jsxs("span", { className: "text-[10px] not-italic opacity-40 ml-2", children: ["(\u00D7 ", it.qty, ")"] })
                                    ] }), _jsx("td", { className: "py-6 text-right font-bold tracking-widest", children: (it.qty * it.price).toLocaleString() })
                            ] }, i))) })
                ] }), _jsxs("div", { className: "flex justify-between items-end mb-10", children: [
                    _jsx(VerificationFooter, { business: business, invoice: invoice }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-[#d4af37] text-xs font-bold uppercase mb-2 tracking-widest", children: "Total Folio" }), _jsxs("p", { className: "text-5xl font-light tracking-tighter", children: [invoice.total.toLocaleString(), " ",
                                    _jsx("span", { className: "text-2xl font-normal opacity-40", children: invoice.currency })
                                ] })
                        ] })
                ] }), _jsx("div", { className: "text-center text-[10px] uppercase tracking-[0.3em] opacity-30 italic border-t border-slate-100 pt-10", children: "Document authentifi\u00E9 par QR Code - FASO-INVEST PAY" })
        ] }));
};
// 23. MINIMALIST BENTO
export const MinimalistBento = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-[#f8fafc] p-6 max-w-4xl mx-auto font-sans grid grid-cols-6 grid-rows-3 gap-4 h-[600px]", children: [
            _jsxs("div", { className: "col-span-4 row-span-1 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center", children: [
                    _jsxs("h1", { className: "text-4xl font-black tracking-tighter text-slate-900 leading-tight", children: ["Paid to ",
                            _jsx("span", { className: "text-indigo-600", children: business.name }),
                            "."] }), _jsx("p", { className: "text-xs font-bold uppercase tracking-widest text-slate-400 mt-2", children: title })
                ] }), _jsxs("div", { className: "col-span-2 row-span-1 bg-indigo-600 p-8 rounded-[2rem] shadow-glow text-white flex flex-col justify-between relative overflow-hidden", children: [
                    _jsx("div", { className: "text-xs font-bold uppercase tracking-widest opacity-60", children: "Total Amount" }), _jsxs("div", { className: "text-3xl font-black", children: [invoice.total.toLocaleString(), " ", invoice.currency] }), _jsx("div", { className: "absolute -bottom-4 -right-4 opacity-20 transform rotate-12", children: _jsx(QRCodeSVG, { value: `https://pay.faso-invest.com/verify/${invoice.number}`, size: 80 }) })
                ] }), _jsxs("div", { className: "col-span-2 row-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100", children: [
                    _jsx("div", { className: "text-xs font-bold uppercase tracking-widest text-slate-400 mb-6", children: "Client" }), _jsx("p", { className: "text-xl font-bold text-slate-900 mb-2", children: invoice.customer_name }), _jsx("p", { className: "text-sm text-slate-500 truncate", children: invoice.customer_email })
                ] }), _jsxs("div", { className: "col-span-4 row-span-2 bg-slate-900 p-8 rounded-[2rem] text-white flex flex-col", children: [
                    _jsx("div", { className: "text-xs font-bold uppercase tracking-widest text-white/40 mb-6", children: "Items" }), _jsx("div", { className: "flex-1 space-y-4 overflow-y-auto pr-4 scrollbar-hide", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center group", children: [
                                _jsxs("span", { className: "text-white/80 font-medium", children: [it.name, " ",
                                        _jsxs("span", { className: "text-white/20 ml-2", children: ["\u00D7 ", it.qty] })
                                    ] }), _jsx("span", { className: "font-bold", children: (it.qty * it.price).toLocaleString() })
                            ] }, i))) }), _jsxs("div", { className: "mt-8 text-[10px] font-bold uppercase tracking-widest text-white/20", children: [invoice.number, " \u2014 ", format(new Date(invoice.created_at), 'dd/MM/yyyy')] })
                ] })
        ] }));
};
// 24. CLASSIC RED (Corporate Standard)
export const ClassicRed = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-12 max-w-4xl mx-auto font-sans border-l-[12px] border-rose-600 shadow-xl", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-16", children: [
                    _jsxs("div", { children: [
                            _jsx("h1", { className: "text-4xl font-black text-slate-900 mb-2", children: business.name }), _jsx("p", { className: "text-rose-600 font-bold tracking-widest uppercase text-xs", children: "Official Business Record" })
                        ] }), _jsxs("div", { className: "text-right", children: [
                            _jsx("h2", { className: "text-2xl font-bold text-slate-400 uppercase tracking-widest mb-2", children: title }), _jsxs("div", { className: "space-y-1 text-sm font-medium", children: [
                                    _jsxs("p", { children: ["Number: ",
                                            _jsx("span", { className: "text-slate-900", children: invoice.number })
                                        ] }), _jsxs("p", { children: ["Date: ",
                                            _jsx("span", { className: "text-slate-900", children: format(new Date(invoice.created_at), 'dd/MM/yyyy') })
                                        ] })
                                ] })
                        ] })
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-12 mb-16 border-y border-slate-100 py-12", children: [
                    _jsxs("div", { children: [
                            _jsx("p", { className: "text-xs font-bold text-slate-400 uppercase mb-4", children: "Merchant" }), _jsx("p", { className: "font-bold text-lg", children: settings.legal_name || business.name }), _jsx("p", { className: "text-slate-500 text-sm mt-1", children: settings.address }), _jsxs("p", { className: "text-slate-500 text-sm italic mt-2", children: ["IFU: ", settings.ifu] })
                        ] }), _jsxs("div", { children: [
                            _jsx("p", { className: "text-xs font-bold text-slate-400 uppercase mb-4", children: "Customer" }), _jsx("p", { className: "font-bold text-lg", children: invoice.customer_name }), _jsx("p", { className: "text-slate-500 text-sm mt-1", children: invoice.customer_email })
                        ] })
                ] }), _jsxs("table", { className: "w-full text-sm mb-16", children: [
                    _jsx("thead", { children: _jsxs("tr", { className: "bg-slate-50 text-slate-900 font-bold border-b-2 border-slate-900", children: [
                                _jsx("th", { className: "py-4 px-2 text-left", children: "Description" }), _jsx("th", { className: "py-4 px-2 text-right", children: "Qty" }), _jsx("th", { className: "py-4 px-2 text-right", children: "Unit Price" }), _jsx("th", { className: "py-4 px-2 text-right", children: "Total" })
                            ] }) }), _jsx("tbody", { children: invoice.items.map((it, i) => (_jsxs("tr", { className: "border-b border-slate-100", children: [
                                _jsx("td", { className: "py-4 px-2", children: it.name }), _jsx("td", { className: "py-4 px-2 text-right", children: it.qty }), _jsx("td", { className: "py-4 px-2 text-right", children: it.price.toLocaleString() }), _jsx("td", { className: "py-4 px-2 text-right font-bold", children: (it.qty * it.price).toLocaleString() })
                            ] }, i))) })
                ] }), _jsx("div", { className: "flex justify-end pt-8 border-t-2 border-slate-900", children: _jsxs("div", { className: "text-right w-64 space-y-3", children: [
                        _jsxs("div", { className: "flex justify-between text-slate-500 text-sm", children: [
                                _jsx("span", { children: "Subtotal" }), _jsx("span", { children: invoice.subtotal.toLocaleString() })
                            ] }), _jsxs("div", { className: "flex justify-between text-2xl font-black text-rose-600 pt-2", children: [
                                _jsx("span", { children: "TOTAL DUE" }), _jsxs("span", { children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                            ] })
                    ] }) }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 25. NEON CYBER (Futuristic)
export const NeonCyber = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-[#050505] p-12 max-w-4xl mx-auto text-cyan-400 font-mono border-[4px] border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.5)] rounded-lg relative overflow-hidden", children: [
            _jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_70%)]" }), _jsxs("div", { className: "flex justify-between items-start mb-20 relative z-10", children: [
                    _jsxs("div", { children: [
                            _jsxs("h1", { className: "text-5xl font-black italic tracking-tighter uppercase mb-2 text-white bg-cyan-500 px-4", children: [title.toUpperCase(), "_SUCCESS"] }), _jsxs("p", { className: "text-xs font-bold uppercase tracking-[0.5em] opacity-60", children: ["Terminal // ", business.name.toUpperCase()] })
                        ] }), _jsx("div", { className: "text-right", children: _jsx("div", { className: "h-16 w-16 border-2 border-cyan-500 rounded-full flex items-center justify-center animate-pulse", children: _jsx("div", { className: "h-10 w-10 border border-cyan-500 rounded-full flex items-center justify-center", children: _jsx("div", { className: "h-4 w-4 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]" }) }) }) })
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-10 mb-20 relative z-10", children: [
                    _jsxs("div", { className: "border-l-2 border-cyan-500 pl-6", children: [
                            _jsx("p", { className: "text-[10px] uppercase font-bold opacity-40 mb-2", children: "Subject" }), _jsx("p", { className: "text-2xl font-black text-white", children: invoice.customer_name }), _jsxs("p", { className: "text-xs mt-2 opacity-60", children: ["ID: ", invoice.customer_email] })
                        ] }), _jsxs("div", { className: "text-right border-r-2 border-cyan-500 pr-6", children: [
                            _jsx("p", { className: "text-[10px] uppercase font-bold opacity-40 mb-2", children: "Amount_Auth" }), _jsxs("p", { className: "text-5xl font-black text-white tracking-tighter", children: [invoice.total.toLocaleString(), " ",
                                    _jsx("span", { className: "text-xl text-cyan-500", children: invoice.currency })
                                ] })
                        ] })
                ] }), _jsx("div", { className: "space-y-4 mb-20 relative z-10", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center group py-2 border-b border-cyan-500/20", children: [
                        _jsx("span", { className: "text-white/60 font-bold tracking-widest", children: it.name.toUpperCase() }), _jsx("span", { className: "font-black text-white", children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsxs("div", { className: "text-[8px] font-bold uppercase tracking-[0.8em] opacity-20 text-center relative z-10", children: ["INVOICE_", invoice.number, "_SYSTEM_HASH_CONFIRMED"] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 26. SOFT MINT (Ecological/Sustainable)
export const SoftMint = ({ invoice, business, settings, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-[#f0f9f4] p-12 max-w-4xl mx-auto font-sans text-[#2d5a43] border border-[#d1e7dd] rounded-[3rem] shadow-sm", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-24", children: [
                    _jsxs("div", { className: "flex items-center gap-4", children: [
                            _jsx("div", { className: "w-16 h-16 bg-[#2d5a43] rounded-[1.5rem] flex items-center justify-center shadow-lg", children: _jsx("div", { className: "w-8 h-8 border-4 border-white/20 rounded-full" }) }), _jsxs("div", { children: [
                                    _jsx("h1", { className: "text-2xl font-black tracking-tight", children: business.name }), _jsx("p", { className: "text-xs font-bold uppercase tracking-widest opacity-60 italic", children: title })
                                ] })
                        ] }), _jsxs("div", { className: "text-right bg-white p-6 rounded-[2rem] shadow-sm border border-[#d1e7dd]", children: [
                            _jsx("p", { className: "text-xs font-bold uppercase tracking-widest opacity-40 mb-2", children: "Order Total" }), _jsxs("p", { className: "text-3xl font-black tracking-tighter", children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                        ] })
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-20 mb-24", children: [
                    _jsxs("div", { className: "space-y-4", children: [
                            _jsx("h3", { className: "text-xs font-bold uppercase tracking-widest opacity-40", children: "Sent to" }), _jsx("p", { className: "text-2xl font-bold tracking-tight leading-tight", children: invoice.customer_name }), _jsx("p", { className: "text-sm opacity-60 underline decoration-2 underline-offset-4", children: invoice.customer_email })
                        ] }), _jsxs("div", { className: "space-y-2 text-right", children: [
                            _jsx("p", { className: "text-xs font-bold uppercase tracking-widest opacity-40", children: "Merchant Record" }), _jsx("p", { className: "font-bold text-lg", children: settings.legal_name || business.name }), _jsx("p", { className: "text-sm opacity-60 italic", children: settings.address })
                        ] })
                ] }), _jsx("div", { className: "space-y-6", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center group bg-white/50 p-6 rounded-[2rem] border border-[#d1e7dd]/50 hover:bg-white transition-colors duration-500", children: [
                        _jsxs("span", { className: "font-bold text-lg", children: [it.name, " ",
                                _jsxs("span", { className: "text-xs font-normal opacity-40 ml-2", children: ["\u00D7 ", it.qty] })
                            ] }), _jsx("span", { className: "font-black text-xl", children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsxs("div", { className: "mt-24 text-center", children: [
                    _jsx("div", { className: "inline-block px-8 py-2 bg-[#2d5a43] text-white rounded-full text-[10px] font-bold uppercase tracking-widest", children: "Digital Receipt \u2014 Saving Trees" }), _jsx("p", { className: "mt-8 text-[10px] opacity-30 italic uppercase tracking-[0.2em]", children: invoice.number })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 27. DARK VANGUARD (High-End Tech)
export const DarkVanguard = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-[#0c0c0c] p-16 max-w-5xl mx-auto text-white font-sans border-t-[20px] border-indigo-600 shadow-2xl relative overflow-hidden", children: [
            _jsx("div", { className: "absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,rgba(79,70,229,0.05)_0%,transparent_100%)] pointer-events-none" }), _jsxs("div", { className: "flex justify-between items-end mb-32 relative z-10", children: [
                    _jsx("h1", { className: "text-7xl font-black italic tracking-tighter leading-none", children: business.name }), _jsxs("div", { className: "text-right text-indigo-600 font-black text-xs uppercase tracking-[0.5em]", children: [title, " ", invoice.number] })
                ] }), _jsxs("div", { className: "grid grid-cols-12 gap-10 mb-32 relative z-10", children: [
                    _jsxs("div", { className: "col-span-8", children: [
                            _jsx("p", { className: "text-white/20 font-bold uppercase tracking-widest text-[10px] mb-8", children: "Statement for" }), _jsx("h2", { className: "text-5xl font-black tracking-tighter leading-tight mb-4", children: invoice.customer_name }), _jsx("p", { className: "text-white/40 text-lg font-medium", children: invoice.customer_email })
                        ] }), _jsxs("div", { className: "col-span-4 flex flex-col justify-end items-end", children: [
                            _jsx("p", { className: "text-white/20 font-bold uppercase tracking-widest text-[10px] mb-8", children: "Settled Amount" }), _jsxs("div", { className: "text-6xl font-black tracking-tighter flex items-start gap-2", children: [invoice.total.toLocaleString(), _jsx("span", { className: "text-2xl text-indigo-600 mt-2", children: invoice.currency })
                                ] })
                        ] })
                ] }), _jsx("div", { className: "space-y-2 mb-32 relative z-10", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center py-8 border-b border-white/5 group hover:border-indigo-600 transition-colors duration-700", children: [
                        _jsxs("span", { className: "text-2xl font-black tracking-tighter group-hover:pl-4 transition-all duration-700", children: [it.name, " ",
                                _jsxs("span", { className: "text-white/20 font-normal italic ml-4", children: ["\u00D7 ", it.qty] })
                            ] }), _jsx("span", { className: "text-2xl font-black italic opacity-40 group-hover:opacity-100 group-hover:text-indigo-600 transition-all duration-700", children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsxs("div", { className: "flex justify-between items-center relative z-10", children: [
                    _jsx("div", { className: "w-12 h-12 rounded-full border border-white/10 flex items-center justify-center", children: _jsx("div", { className: "w-4 h-4 bg-indigo-600 rounded-full animate-ping" }) }), _jsx("div", { className: "text-[8px] font-black uppercase tracking-[1em] text-white/10", children: "Engineered by YengaPay" })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 28. ORGANIC KRAFT (Eco-friendly Retail)
export const OrganicKraft = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-[#e7d9c1] p-12 max-w-3xl mx-auto font-mono text-[#544a3d] border-[12px] border-[#cbbca1] shadow-inner relative", children: [
            _jsx("div", { className: "absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')] opacity-40 pointer-events-none" }), _jsxs("div", { className: "text-center mb-16 relative z-10", children: [
                    _jsx("div", { className: "w-20 h-20 border-4 border-[#544a3d] rounded-full mx-auto flex items-center justify-center mb-6", children: _jsx("div", { className: "text-4xl font-black", children: "O" }) }), _jsx("h1", { className: "text-4xl font-black uppercase tracking-tighter italic", children: business.name }), _jsx("p", { className: "text-xs font-bold uppercase mt-2 italic opacity-60", children: title })
                ] }), _jsx("div", { className: "space-y-6 mb-16 border-y-4 border-[#544a3d] border-dotted py-12 relative z-10", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-start group", children: [
                        _jsxs("div", { className: "flex-1", children: [
                                _jsx("p", { className: "text-xl font-black italic", children: it.name.toUpperCase() }), _jsxs("p", { className: "text-xs font-bold opacity-40 mt-1", children: ["QTY: ", it.qty, " \u00D7 ", it.price.toLocaleString()] })
                            ] }), _jsx("p", { className: "text-2xl font-black", children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsxs("div", { className: "flex justify-between items-center text-4xl font-black italic border-4 border-[#544a3d] p-8 relative z-10", children: [
                    _jsx("span", { children: "TOTAL" }), _jsxs("span", { children: [invoice.total.toLocaleString(), " ", invoice.currency] })
                ] }), _jsxs("div", { className: "mt-16 text-center text-xs font-bold uppercase tracking-widest relative z-10", children: [
                    _jsxs("p", { children: ["Recipient: ", invoice.customer_name] }), _jsxs("p", { className: "mt-2 italic opacity-40", children: ["Doc Ref: ", invoice.number] }), _jsx("div", { className: "mt-12 h-20 w-full bg-[#544a3d]/10 flex items-center justify-center border-2 border-[#544a3d]/20 border-dashed", children: _jsx("span", { className: "text-[10px] opacity-40 italic", children: "Signature / Stamp" }) })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 29. BOLD IMPACT (Aggressive Marketing)
export const BoldImpact = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-[#ffdd00] p-12 max-w-4xl mx-auto text-black font-black font-sans border-[16px] border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]", children: [
            _jsxs("div", { className: "flex justify-between items-start mb-32", children: [
                    _jsx("h1", { className: "text-8xl font-black italic tracking-tighter leading-none -ml-4 uppercase", children: business.name }), _jsx("div", { className: "bg-black text-[#ffdd00] p-4 text-xs font-black uppercase tracking-widest mt-4 italic shadow-glow", children: title })
                ] }), _jsxs("div", { className: "mb-32", children: [
                    _jsx("p", { className: "text-xl uppercase tracking-widest mb-4", children: "Sold to" }), _jsx("h2", { className: "text-6xl uppercase tracking-tighter italic mb-2", children: invoice.customer_name }), _jsx("p", { className: "text-2xl opacity-60 italic", children: invoice.customer_email })
                ] }), _jsx("div", { className: "space-y-8 mb-32", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center border-b-[8px] border-black pb-4 group hover:bg-black hover:text-[#ffdd00] transition-all duration-300 px-4", children: [
                        _jsxs("span", { className: "text-4xl italic", children: [it.name.toUpperCase(), " ",
                                _jsxs("span", { className: "text-lg opacity-40", children: ["\u00D7", it.qty] })
                            ] }), _jsx("span", { className: "text-4xl italic", children: (it.qty * it.price).toLocaleString() })
                    ] }, i))) }), _jsxs("div", { className: "flex justify-between items-end", children: [
                    _jsx("div", { className: "text-sm uppercase tracking-[0.4em] italic max-w-xs", children: "Confirmed Transaction Powered by YengaPay Engine" }), _jsxs("div", { className: "text-right", children: [
                            _jsx("p", { className: "text-xl uppercase mb-2", children: "Total Amount" }), _jsxs("p", { className: "text-9xl tracking-tighter italic leading-none", children: [invoice.total.toLocaleString(), " ",
                                    _jsx("span", { className: "text-4xl", children: invoice.currency })
                                ] })
                        ] })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// 30. ZEN MINIMAL (Calm & Serene)
export const ZenMinimal = ({ invoice, business, kind = "invoice" }) => {
    const title = kind === "receipt" ? "Reçu" : kind === "contract" ? "Contrat" : "Facture";
    return (_jsxs("div", { className: "bg-white p-20 max-w-5xl mx-auto text-slate-400 font-light font-serif tracking-[0.2em] uppercase text-center border-x border-slate-50 shadow-sm", children: [
            _jsx("h1", { className: "text-xl mb-32 tracking-[0.8em] font-light text-slate-900", children: business.name }), _jsxs("div", { className: "mb-32", children: [
                    _jsx("p", { className: "text-[10px] mb-8 opacity-40", children: title }), _jsx("h2", { className: "text-3xl text-slate-800 font-light lowercase italic tracking-normal", children: invoice.customer_name })
                ] }), _jsx("div", { className: "space-y-12 mb-32", children: invoice.items.map((it, i) => (_jsxs("div", { className: "flex justify-between items-center text-[10px] border-b border-slate-50 pb-8", children: [
                        _jsx("span", { children: it.name }), _jsxs("span", { className: "text-slate-800 font-medium", children: [(it.qty * it.price).toLocaleString(), " ", invoice.currency] })
                    ] }, i))) }), _jsxs("div", { className: "pt-20 border-t border-slate-100 flex flex-col items-center", children: [
                    _jsx("p", { className: "text-xs mb-4", children: "Total Amount" }), _jsxs("p", { className: "text-4xl text-slate-900 font-light tracking-widest", children: [invoice.total.toLocaleString(), " ", invoice.currency] }), _jsx("div", { className: "mt-32 w-8 h-[1px] bg-slate-200" }), _jsxs("p", { className: "mt-8 text-[8px] opacity-30 italic", children: ["Document ID: ", invoice.number] })
                ] }), _jsx(VerificationFooter, { business: business, invoice: invoice })
        ] }));
};
// Map of all templates
export const INVOICE_TEMPLATES = {
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

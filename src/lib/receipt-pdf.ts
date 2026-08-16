import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReceiptData = {
  business: { name: string; logo_url?: string | null; contact_email?: string | null; contact_phone?: string | null };
  invoice: { number: string; kind: "receipt" | "invoice"; created_at: string; currency: string; status: string };
  customer: { name?: string | null; email?: string | null; phone?: string | null };
  items: Array<{ label: string; qty: number; price: number }>;
  totals: { subtotal: number; tax: number; total: number };
};

export function generateReceiptPdf(d: ReceiptData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(22);
  doc.text(d.business.name, 14, 18);
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text(d.invoice.kind === "invoice" ? "FACTURE" : "REÇU", W - 14, 18, { align: "right" });

  // Meta
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text(`N° ${d.invoice.number}`, 14, 42);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100);
  doc.text(new Date(d.invoice.created_at).toLocaleString("fr-FR"), 14, 47);

  // Customer block
  doc.setTextColor(15, 23, 42).setFontSize(9);
  let y = 58;
  doc.setFont("helvetica", "bold").text("Client", 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  if (d.customer.name) { doc.text(d.customer.name, 14, y); y += 4; }
  if (d.customer.email) { doc.text(d.customer.email, 14, y); y += 4; }
  if (d.customer.phone) { doc.text(d.customer.phone, 14, y); y += 4; }

  // Items table
  autoTable(doc, {
    startY: 80,
    head: [["Désignation", "Qté", `P.U. (${d.invoice.currency})`, `Total (${d.invoice.currency})`]],
    body: d.items.map((it) => [
      it.label, String(it.qty),
      Number(it.price).toLocaleString("fr-FR"),
      (Number(it.qty) * Number(it.price)).toLocaleString("fr-FR"),
    ]),
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 110;
  const tx = W - 14;
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text("Sous-total", tx - 50, finalY + 8);
  doc.text(`${d.totals.subtotal.toLocaleString("fr-FR")} ${d.invoice.currency}`, tx, finalY + 8, { align: "right" });
  if (d.totals.tax) {
    doc.text("TVA", tx - 50, finalY + 14);
    doc.text(`${d.totals.tax.toLocaleString("fr-FR")} ${d.invoice.currency}`, tx, finalY + 14, { align: "right" });
  }
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text("TOTAL", tx - 50, finalY + 22);
  doc.text(`${d.totals.total.toLocaleString("fr-FR")} ${d.invoice.currency}`, tx, finalY + 22, { align: "right" });

  // Status badge
  if (d.invoice.status === "paid") {
    doc.setFillColor(16, 185, 129); doc.roundedRect(14, finalY + 14, 30, 10, 2, 2, "F");
    doc.setTextColor(255).setFontSize(10).setFont("helvetica", "bold");
    doc.text("PAYÉ", 29, finalY + 21, { align: "center" });
  }

  // Footer
  doc.setTextColor(150).setFontSize(8).setFont("helvetica", "normal");
  doc.text("Émis via FASO INVEST PAY · Paiement sécurisé Mobile Money", W / 2, 287, { align: "center" });

  return doc.output("blob");
}

export function downloadReceipt(d: ReceiptData) {
  const blob = generateReceiptPdf(d);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${d.invoice.number}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
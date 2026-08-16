import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { 
  ArrowLeft, Plus, Receipt, Download, FileText, Send, Building2, User, 
  Search, Printer, Share2, Mail, ExternalLink, MoreVertical, CreditCard
} from "lucide-react";
import { listInvoices, getAccountingSettings } from "@/lib/business.functions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Invoice = {
  id: string;
  number: string;
  kind: "invoice" | "receipt" | "proforma";
  customer_name: string | null;
  customer_email: string | null;
  total: number;
  currency: string;
  status: "issued" | "paid" | "cancelled";
  created_at: string;
  items: any[];
};

export default function ContractsAndInvoices() {
  const { businessId = "" } = useParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [invs, sett] = await Promise.all([
          listInvoices(businessId),
          getAccountingSettings(businessId)
        ]);
        setInvoices(invs);
        setSettings(sett);
      } catch (e: any) {
        toast.error("Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    if (businessId) load();
  }, [businessId]);

  const filteredInvoices = invoices.filter(inv => 
    inv.number.toLowerCase().includes(filter.toLowerCase()) ||
    (inv.customer_name || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/business" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Retour au business
            </Link>
            <h1 className="mt-3 font-[Space_Grotesk] text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Contrats & Facturation
            </h1>
            <p className="text-sm text-muted-foreground">Gérez vos factures pro forma, reçus et contrats marchands.</p>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Nouvelle facture
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-4">
          {/* Stats Summary */}
          <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total émis", value: invoices.length, icon: FileText },
              { label: "En attente", value: invoices.filter(i => i.status === 'issued').length, icon: CreditCard },
              { label: "Payées", value: invoices.filter(i => i.status === 'paid').length, icon: Receipt },
              { label: "Brouillons", value: 0, icon: FileText },
            ].map((stat, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4">
                <stat.icon className="h-5 w-5 text-primary opacity-70" />
                <p className="mt-2 text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* List Section */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Rechercher par numéro ou client..." 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <select className="rounded-xl border border-border bg-background px-4 py-2 text-sm">
                <option>Tous les types</option>
                <option>Factures</option>
                <option>Reçus</option>
                <option>Pro-forma</option>
              </select>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Document</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Montant</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Chargement...</td></tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Aucun document trouvé.</td></tr>
                  ) : filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold">{inv.number}</p>
                            <p className="text-[10px] uppercase text-muted-foreground">{inv.kind}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {inv.customer_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(inv.created_at), 'dd MMM yyyy', { locale: fr })}
                      </td>
                      <td className="px-6 py-4 font-bold">
                        {inv.total.toLocaleString('fr-FR')} {inv.currency}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                          inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 
                          inv.status === 'issued' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {inv.status === 'paid' ? 'Payé' : inv.status === 'issued' ? 'Émis' : 'Annulé'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors" title="Télécharger PDF">
                            <Download className="h-4 w-4" />
                          </button>
                          <button className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors" title="Envoyer par email">
                            <Mail className="h-4 w-4" />
                          </button>
                          <button className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

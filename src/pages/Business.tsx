import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyBusinesses, createBusiness, listPaymentLinks, createPaymentLink,
  updatePaymentLink, listLinkPayments, listApiKeys, createApiKey, revokeApiKey,
  cashoutBusinessBalance,
} from "@/lib/business.functions";
import { ArrowLeft, Building2, Copy, Key, Link2, Plus, Trash2, Wallet } from "lucide-react";

type Biz = { id: string; name: string; slug: string; status: string; balance: number; fee_bps: number };
type PLink = { id: string; slug: string; title: string; amount: number | null; currency: string; status: string };
type Payment = { id: string; reference: string; amount: number; status: string; net_amount: number; created_at: string };
type ApiKey = { id: string; label: string; key_prefix: string; mode: string; revoked_at: string | null; last_used_at: string | null };

export default function BusinessPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(undefined);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [current, setCurrent] = useState<Biz | null>(null);
  const [links, setLinks] = useState<PLink[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/auth"); return; }
      setSession(data.session);
    });
  }, [navigate]);

  async function refreshAll() {
    const list = await listMyBusinesses();
    setBusinesses(list);
    if (list.length && !current) setCurrent(list[0]);
    setLoading(false);
  }
  async function refreshCurrent(bizId: string) {
    const [l, p, k] = await Promise.all([
      listPaymentLinks(bizId), listLinkPayments(bizId), listApiKeys(bizId),
    ]);
    setLinks(l); setPayments(p); setKeys(k);
  }
  useEffect(() => { if (session) refreshAll(); /* eslint-disable-next-line */ }, [session]);
  useEffect(() => { if (current) refreshCurrent(current.id); }, [current?.id]);

  async function onCreateBusiness() {
    const name = prompt("Nom de votre business / boutique");
    if (!name) return;
    try {
      const b = await createBusiness({ name });
      toast.success("Business créé ✅");
      setBusinesses((prev) => [b, ...prev]);
      setCurrent(b);
    } catch (e: any) { toast.error(e.message); }
  }

  async function onCreateLink() {
    if (!current) return;
    const title = prompt("Titre du lien de paiement");
    if (!title) return;
    const amountStr = prompt("Montant fixe en XOF (laisser vide pour montant libre)");
    const amount = amountStr ? Number(amountStr) : null;
    try {
      const link = await createPaymentLink({ business_id: current.id, title, amount });
      toast.success("Lien créé ✅");
      setLinks((prev) => [link, ...prev]);
    } catch (e: any) { toast.error(e.message); }
  }

  async function onToggleLink(l: PLink) {
    const next = l.status === "active" ? "paused" : "active";
    try {
      const u = await updatePaymentLink({ id: l.id, status: next });
      setLinks((prev) => prev.map((x) => (x.id === l.id ? u : x)));
    } catch (e: any) { toast.error(e.message); }
  }

  async function onCreateKey() {
    if (!current) return;
    try {
      const k: any = await createApiKey({ business_id: current.id, label: "default", mode: "live" });
      setNewKey(k.api_key);
      setKeys((prev) => [{ id: k.id, label: k.label, key_prefix: k.key_prefix, mode: k.mode, revoked_at: null, last_used_at: null }, ...prev]);
    } catch (e: any) { toast.error(e.message); }
  }

  async function onRevokeKey(id: string) {
    if (!confirm("Révoquer cette clé API ?")) return;
    try { await revokeApiKey(id); setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k))); }
    catch (e: any) { toast.error(e.message); }
  }

  async function onCashout() {
    if (!current) return;
    try {
      const r: any = await cashoutBusinessBalance(current.id);
      if (r.ok) { toast.success(`${r.transferred.toLocaleString("fr-FR")} XOF transférés vers votre wallet ✅`); refreshAll(); }
      else toast.error(r.error);
    } catch (e: any) { toast.error(e.message); }
  }

  function copy(text: string) { navigator.clipboard.writeText(text); toast.success("Copié"); }

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface-1/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="font-[Space_Grotesk] text-xl font-bold tracking-tight">Espace Business</h1>
          <button onClick={onCreateBusiness} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
            <Plus className="h-3.5 w-3.5" /> Nouveau business
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {businesses.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-[Space_Grotesk] text-2xl font-bold">Créez votre premier business</h2>
            <p className="mt-2 text-sm text-muted-foreground">Encaissez vos clients via des liens de paiement Mobile Money et une API.</p>
            <button onClick={onCreateBusiness} className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Créer un business
            </button>
          </div>
        ) : (
          <>
            {/* Selector */}
            <div className="mb-6 flex flex-wrap gap-2">
              {businesses.map((b) => (
                <button key={b.id} onClick={() => setCurrent(b)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${current?.id === b.id ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:bg-muted"}`}>
                  {b.name}
                </button>
              ))}
            </div>

            {current && (
              <>
                {/* Header card */}
                <div className="rounded-3xl border border-border bg-card p-6 shadow-card-premium">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Business</p>
                      <h2 className="mt-1 font-[Space_Grotesk] text-3xl font-bold">{current.name}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">slug: <code className="rounded bg-muted px-1.5 py-0.5">{current.slug}</code> · commission {(current.fee_bps / 100).toFixed(2)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Solde encaissé</p>
                      <p className="mt-1 font-[Space_Grotesk] text-3xl font-bold tabular-nums">{Number(current.balance).toLocaleString("fr-FR")} <span className="text-sm text-muted-foreground">XOF</span></p>
                      <button onClick={onCashout} disabled={Number(current.balance) <= 0}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-40">
                        <Wallet className="h-3.5 w-3.5" /> Transférer vers mon wallet
                      </button>
                    </div>
                  </div>
                </div>

                {/* Payment links */}
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-[Space_Grotesk] text-xl font-bold">Liens de paiement</h3>
                    <button onClick={onCreateLink} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                      <Plus className="h-3.5 w-3.5" /> Nouveau lien
                    </button>
                  </div>
                  <div className="space-y-2">
                    {links.length === 0 && <p className="text-sm text-muted-foreground">Aucun lien pour l'instant.</p>}
                    {links.map((l) => {
                      const url = `${window.location.origin}/pay/${l.slug}`;
                      return (
                        <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 p-4">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{l.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {l.amount ? `${Number(l.amount).toLocaleString("fr-FR")} ${l.currency}` : "Montant libre"} ·
                              <span className={l.status === "active" ? " text-emerald-500" : " text-amber-500"}> {l.status}</span>
                            </p>
                            <p className="mt-1 truncate text-xs text-primary">{url}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => copy(url)} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>
                            <a href={url} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-muted"><Link2 className="h-3.5 w-3.5" /></a>
                            <button onClick={() => onToggleLink(l)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">{l.status === "active" ? "Pauser" : "Activer"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Payments */}
                <section className="mt-8">
                  <h3 className="mb-3 font-[Space_Grotesk] text-xl font-bold">Paiements reçus</h3>
                  <div className="overflow-hidden rounded-2xl border border-border bg-surface-2">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr><th className="px-4 py-3 text-left">Référence</th><th className="px-4 py-3 text-right">Montant</th><th className="px-4 py-3 text-right">Net</th><th className="px-4 py-3 text-left">Statut</th><th className="px-4 py-3 text-left">Date</th></tr>
                      </thead>
                      <tbody>
                        {payments.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun paiement</td></tr>}
                        {payments.map((p) => (
                          <tr key={p.id} className="border-t border-border">
                            <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{Number(p.amount).toLocaleString("fr-FR")}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{Number(p.net_amount).toLocaleString("fr-FR")}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "success" ? "bg-emerald-500/15 text-emerald-500" : p.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-500"}`}>{p.status}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("fr-FR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* API keys */}
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-[Space_Grotesk] text-xl font-bold">Clés API</h3>
                    <button onClick={onCreateKey} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                      <Plus className="h-3.5 w-3.5" /> Générer une clé
                    </button>
                  </div>
                  {newKey && (
                    <div className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Copiez votre clé maintenant — elle ne sera plus jamais affichée</p>
                      <div className="mt-2 flex items-center gap-2 rounded-xl bg-background p-3">
                        <code className="flex-1 truncate font-mono text-xs">{newKey}</code>
                        <button onClick={() => { copy(newKey); setNewKey(null); }} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background"><Copy className="h-3 w-3" /></button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {keys.length === 0 && <p className="text-sm text-muted-foreground">Aucune clé.</p>}
                    {keys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 p-4">
                        <div className="flex items-center gap-3">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-mono text-sm">{k.key_prefix}…</p>
                            <p className="text-xs text-muted-foreground">{k.label} · {k.mode} {k.revoked_at ? "· révoquée" : ""}</p>
                          </div>
                        </div>
                        {!k.revoked_at && (
                          <button onClick={() => onRevokeKey(k.id)} className="grid h-8 w-8 place-items-center rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>

                  <details className="mt-6 rounded-2xl border border-border bg-surface-2 p-4 text-sm">
                    <summary className="cursor-pointer font-semibold">Documentation API REST</summary>
                    <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                      <p>Base URL : <code className="rounded bg-muted px-1.5 py-0.5">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/pay/v1</code></p>
                      <p>Authentification : header <code className="rounded bg-muted px-1.5 py-0.5">Authorization: Bearer fip_live_xxx</code></p>
                      <div>
                        <p className="font-semibold text-foreground">Créer un lien :</p>
                        <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-[10px]">{`POST /v1/payment-links
{ "title": "Commande #123", "amount": 5000, "currency": "XOF" }`}</pre>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Récupérer un paiement :</p>
                        <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-[10px]">{`GET /v1/payments/{reference}`}</pre>
                      </div>
                    </div>
                  </details>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
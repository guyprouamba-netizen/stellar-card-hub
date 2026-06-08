import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useServerFn } from "@/lib/server-fn";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  LayoutDashboard, ArrowDownLeft, ArrowUpRight, CreditCard, History,
  UserCircle, LogOut, Plus, Snowflake, Loader2,
  AlertTriangle, Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import logo from "@/assets/logo.png";
import { getDashboardData } from "@/lib/dashboard.functions";
import { cardAction } from "@/lib/strowallet.functions";
import { cardDetails } from "@/lib/strowallet.functions";
import { requestWithdrawal } from "@/lib/withdrawal.functions";
import { initRecharge } from "@/lib/yengapay.functions";
import { IssueCardSheet } from "@/components/issue-card-sheet";
import { VirtualCard } from "@/components/virtual-card";
import { toast } from "sonner";

type Tab = "home" | "deposit" | "withdraw" | "cards" | "tx" | "profile";

function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("home");
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth");
      else setSession(data.session);
      setCheckingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate("/auth");
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const fetchDash = useServerFn(getDashboardData);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDash(),
    enabled: !!session,
  });

  if (checkingAuth) return <FullPageLoader />;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <Sidebar tab={tab} setTab={setTab} />
        <main className="flex-1 px-4 py-8 sm:px-8">
          {isLoading || !data ? <FullPageLoader /> : (
            <>
              {tab === "home" && <HomeTab data={data} onAction={() => refetch()} />}
              {tab === "deposit" && <DepositTab onDone={() => refetch()} />}
              {tab === "withdraw" && <WithdrawTab balance={Number(data.wallets.find((w: any) => w.currency === "XOF")?.balance ?? 0)} onDone={() => refetch()} />}
              {tab === "cards" && <CardsTab cards={data.cards} onAction={() => refetch()} />}
              {tab === "tx" && <TxTab transactions={data.transactions} />}
              {tab === "profile" && <ProfileTab profile={data.profile} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function FullPageLoader() {
  return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

function Sidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const navigate = useNavigate();
  const items: Array<{ id: Tab; label: string; Icon: any }> = [
    { id: "home", label: "Tableau de bord", Icon: LayoutDashboard },
    { id: "deposit", label: "Dépôt d'argent", Icon: ArrowDownLeft },
    { id: "withdraw", label: "Retrait d'argent", Icon: ArrowUpRight },
    { id: "cards", label: "Mes cartes", Icon: CreditCard },
    { id: "tx", label: "Mes transactions", Icon: History },
    { id: "profile", label: "Mon profil", Icon: UserCircle },
  ];
  async function logout() {
    await supabase.auth.signOut();
    navigate("/");
  }
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-card/30 p-4 md:flex md:flex-col">
      <Link to="/" className="mb-2 flex items-center gap-2 px-2">
        <img src={logo} alt="FASO-INVEST PAY" className="h-9 w-9 rounded-xl" />
        <span className="text-sm font-bold tracking-tight">FASO-INVEST <span className="text-primary">PAY</span></span>
      </Link>
      <BackButton to="/" className="mb-4 px-2" />
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((it) => (
          <button key={it.id} onClick={() => setTab(it.id)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${tab === it.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <it.Icon className="h-4 w-4" /> {it.label}
          </button>
        ))}
      </nav>
      <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
        <LogOut className="h-4 w-4" /> Déconnexion
      </button>
    </aside>
  );
}

function HomeTab({ data }: { data: any; onAction: () => void }) {
  const xof = data.wallets.find((w: any) => w.currency === "XOF");
  const usd = data.wallets.find((w: any) => w.currency === "USD");
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Bonjour {data.profile?.full_name?.split(" ")[0] ?? ""} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">Voici un aperçu de votre compte FASO-INVEST PAY.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <WalletCard label="Solde XOF" amount={xof?.balance ?? 0} currency="XOF" highlight />
        <WalletCard label="Solde USD (carte)" amount={usd?.balance ?? 0} currency="USD" />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Dernières transactions</h2>
        </div>
        <TxList items={data.transactions.slice(0, 6)} />
      </section>
    </div>
  );
}

function WalletCard({ label, amount, currency, highlight }: { label: string; amount: number; currency: string; highlight?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-6 ${highlight ? "border-primary/40 bg-gradient-to-br from-primary/10 to-card" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-3 font-[Space_Grotesk] text-3xl font-bold tabular-nums">
        {Number(amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} <span className="text-base font-medium text-muted-foreground">{currency}</span>
      </div>
    </motion.div>
  );
}

function TxList({ items }: { items: any[] }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">Aucune transaction pour le moment.</p>;
  return (
    <div className="divide-y divide-border">
      {items.map((t) => (
        <div key={t.id} className="flex items-center justify-between py-3">
          <div>
            <div className="text-sm font-medium">{t.description || t.type}</div>
            <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")} · {t.status}</div>
          </div>
          <div className={`text-sm font-semibold tabular-nums ${["deposit","withdrawal_refund"].includes(t.type) ? "text-success" : "text-foreground"}`}>
            {["deposit","withdrawal_refund"].includes(t.type) ? "+" : "-"}{Number(t.amount).toLocaleString("fr-FR")} {t.currency}
          </div>
        </div>
      ))}
    </div>
  );
}

function DepositTab({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState(5000);
  const [loading, setLoading] = useState(false);
  const init = useServerFn(initRecharge);
  async function pay() {
    setLoading(true);
    try {
      const res: any = await init({ data: { amount, currency: "XOF" } });
      if (res?.checkout_url) window.location.href = res.checkout_url;
      else toast.error(res?.error ?? "Erreur Mobile Money");
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); onDone(); }
  }
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Dépôt d'argent</h1>
      <p className="text-sm text-muted-foreground">Rechargez votre compte XOF via Mobile Money (Orange, Moov, Wave).</p>
      <div className="rounded-2xl border border-border bg-card p-6">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant à recharger</label>
        <div className="mt-2 flex items-baseline gap-2">
          <input type="number" min={500} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-full bg-transparent font-[Space_Grotesk] text-4xl font-bold tabular-nums outline-none" />
          <span className="text-sm text-muted-foreground">XOF</span>
        </div>
        <div className="mt-3 flex gap-2">
          {[2000, 5000, 10000, 25000, 50000].map((q) => (
            <button key={q} onClick={() => setAmount(q)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs">{q.toLocaleString("fr-FR")}</button>
          ))}
        </div>
      </div>
      <button onClick={pay} disabled={loading || amount < 500}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Payer en Mobile Money"}
      </button>
    </div>
  );
}

function WithdrawTab({ balance, onDone }: { balance: number; onDone: () => void }) {
  const [form, setForm] = useState({ amount: 1000, method: "mobile_money" as "mobile_money" | "bank", operator: "Orange Money", phone: "", account: "", holder: "" });
  const [loading, setLoading] = useState(false);
  const req = useServerFn(requestWithdrawal);
  async function submit() {
    setLoading(true);
    try {
      const res: any = await req({ data: form });
      if (res?.ok) { toast.success("Demande de retrait soumise — en attente de validation admin"); onDone(); }
      else toast.error(res?.error ?? "Erreur");
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Retrait d'argent</h1>
      <p className="text-sm text-muted-foreground">Solde XOF disponible : <span className="font-semibold text-foreground tabular-nums">{balance.toLocaleString("fr-FR")} XOF</span></p>
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <Field label="Montant (XOF)"><input type="number" min={500} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" /></Field>
        <Field label="Méthode">
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as any })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none">
            <option value="mobile_money">Mobile Money</option>
            <option value="bank">Virement bancaire</option>
          </select>
        </Field>
        <Field label="Opérateur / Banque"><input value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" /></Field>
        {form.method === "mobile_money" ? (
          <Field label="Numéro de téléphone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" /></Field>
        ) : (
          <Field label="Numéro de compte / IBAN"><input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" /></Field>
        )}
        <Field label="Nom du bénéficiaire"><input value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" /></Field>
      </div>
      <button onClick={submit} disabled={loading || form.amount > balance || form.amount < 500 || !form.holder}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Demander un retrait"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>;
}

function CardsTab({ cards, onAction }: { cards: any[]; onAction: () => void }) {
  const [issueOpen, setIssueOpen] = useState(false);
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Mes cartes</h1>
        <button onClick={() => setIssueOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> Émettre une carte
        </button>
      </header>
      {cards.length === 0 ? <p className="text-sm text-muted-foreground">Aucune carte. Cliquez sur « Émettre une carte » pour créer votre première carte NFC.</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => <CardRow key={c.id} card={c} onAction={onAction} />)}
        </div>
      )}
      <IssueCardSheet open={issueOpen} onClose={() => setIssueOpen(false)} onIssued={() => { setIssueOpen(false); onAction(); }} />
    </div>
  );
}

function CardRow({ card, onAction }: { card: any; onAction: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = useServerFn(cardAction);
  const fetchDetails = useServerFn(cardDetails);
  const [det, setDet] = useState<{ number?: string; cvv?: string; expiry?: string; holder?: string }>({});
  useEffect(() => {
    if (!card.provider_card_id) return;
    let cancelled = false;
    (async () => {
      try {
        const r: any = await fetchDetails({ data: { card_id: card.provider_card_id } });
        const raw = r?.response?.card_detail ?? r?.data?.card_detail ?? r?.card_detail ?? r?.response ?? r?.data ?? r ?? {};
        const number = raw.card_number || raw.cardNumber || raw.pan || undefined;
        const cvv = raw.cvv || raw.cvv2 || raw.card_cvv || undefined;
        const exp = raw.expiry || raw.expiry_date || raw.expiration || (raw.expiry_month && raw.expiry_year ? `${String(raw.expiry_month).padStart(2, "0")}/${String(raw.expiry_year).slice(-2)}` : undefined);
        const holder = raw.name_on_card || raw.card_holder_name || raw.holder || raw.card_holder || raw.card_name || raw.name || undefined;
        if (!cancelled) setDet({ number, cvv, expiry: exp, holder });
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [card.provider_card_id]);
  async function doAct(action: "freeze" | "unfreeze") {
    setBusy(true);
    try { await act({ data: { card_id: card.provider_card_id, action } }); toast.success("OK"); onAction(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const isFrozen = card.status?.startsWith("frozen");
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <VirtualCard
        variant="primary"
        brand={(card.brand || "visa").toUpperCase()}
        balance={`$ ${Number(card.balance).toFixed(2)}`}
        number={det.number || (card.last4 ? `•••• •••• •••• ${card.last4}` : undefined)}
        holder={(det.holder || "TITULAIRE").toUpperCase()}
        expiry={det.expiry || "••/••"}
        cvv={det.cvv}
      />
      <div className="mt-4 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${isFrozen ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>{card.status}</span>
        <Link to="/cards" className="text-xs font-semibold text-primary hover:underline">Gérer →</Link>
      </div>
      {card.auto_frozen_at && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-xs text-warning"><AlertTriangle className="h-4 w-4" /> Gelée automatiquement le {new Date(card.auto_frozen_at).toLocaleString("fr-FR")} après 2 tentatives de paiement échouées.</p>
      )}
      <div className="mt-4 flex gap-2">
        {isFrozen ? (
          <button onClick={() => doAct("unfreeze")} disabled={busy} className="flex-1 rounded-full border border-border bg-surface-2 py-2 text-xs font-semibold hover:bg-muted">
            {busy ? "..." : "Dégeler"}
          </button>
        ) : (
          <button onClick={() => doAct("freeze")} disabled={busy} className="flex-1 rounded-full border border-border bg-surface-2 py-2 text-xs font-semibold hover:bg-muted">
            <Snowflake className="mr-1 inline h-3.5 w-3.5" /> Geler
          </button>
        )}
      </div>
    </div>
  );
}

function TxTab({ transactions }: { transactions: any[] }) {
  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Mes transactions</h1>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Montant</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Aucune transaction</td></tr>}
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3">{t.type}</td>
                <td className="px-4 py-3">{t.description}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t.status}</span></td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{Number(t.amount).toLocaleString("fr-FR")} {t.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfileTab({ profile }: { profile: any }) {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Mon profil</h1>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
        <Info k="Nom complet" v={profile?.full_name} />
        <Info k="Email" v={profile?.email} />
        <Info k="Téléphone" v={profile?.phone} />
        <Info k="Pays" v={profile?.country} />
        <Info k="Compte actif" v={profile?.is_active ? "Oui" : "Non (désactivé)"} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Les informations d'identité sont saisies directement lors de l'émission d'une carte NFC, et transmises à l'émetteur uniquement à ce moment-là.
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: any }) {
  return <div className="flex items-baseline justify-between gap-2"><span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span><span className="text-sm font-medium">{v ?? "—"}</span></div>;
}


export default Dashboard;

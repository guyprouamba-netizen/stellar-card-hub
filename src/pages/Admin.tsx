import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useServerFn } from "@/lib/server-fn";
import { useQuery } from "@tanstack/react-query";
import {
  Users, TrendingUp, CreditCard, ShieldCheck, ArrowDownUp, LogOut, RefreshCw,
  Loader2, CheckCircle2, XCircle, Wallet, Server, Eye, SlidersHorizontal, Share2,
  AlertTriangle, BarChart3, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import logo from "@/assets/logo.png";
import { adminOverview, adminStrowalletBalance, adminToggleUser, adminReviewKyc, adminReviewWithdrawal, adminDeleteUser, adminAdjustWallet, adminGetConfig, adminUpdateConfig, adminUpdateUser, adminReferralsOverview, adminYengapayInspect, adminYengapayVerifyBatch, adminCreditYengapayExternal, adminCreditPendingDeposit } from "@/lib/admin.functions";
import { getPaypalWithdrawConfig, adminUpdatePaypalWithdrawConfig } from "@/lib/paypal.functions";
import { toast } from "sonner";
import { AnalyticsSection } from "@/components/admin/analytics-section";
import { DashboardAiAssistant } from "@/components/admin/ai-assistant";

type Tab = "users" | "flow" | "analytics" | "assistant" | "strowallet" | "payments" | "kyc" | "withdrawals" | "referrals" | "businesses" | "settings";

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("flow");
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/auth"); return; }
        const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
        if (error) throw error;
        const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
        setAuthState(isAdmin ? "ok" : "denied");
      } catch (e) {
        toast.error((e as Error).message || "Vérification admin impossible");
        setAuthState("denied");
      }
    })();
  }, [navigate]);

  const fetchOverview = useServerFn(adminOverview);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["adminOverview"], queryFn: () => fetchOverview(), enabled: authState === "ok",
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  if (authState === "loading") return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (authState === "denied") return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold">Accès refusé</h1>
        <p className="mt-2 text-muted-foreground">Vous n'êtes pas administrateur.</p>
        <Link to="/dashboard" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Retour au tableau de bord</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <AdminSidebar tab={tab} setTab={setTab} />
        <main className="flex-1 px-4 py-8 sm:px-8">
          {tab === "analytics" ? <AnalyticsSection />
            : tab === "assistant" ? <DashboardAiAssistant days={30} />
            : isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : isError || !data ? <AdminLoadError error={error} onRetry={() => refetch()} busy={isFetching} /> : (
            <>
              {tab === "flow" && <FlowTab data={data} />}
              {tab === "users" && <UsersTab users={data.users} onAction={refetch} />}
              {tab === "strowallet" && <StrowalletTab cards={data.cards} />}
              {tab === "payments" && <PaymentsTab tx={data.transactions} />}
              {tab === "kyc" && <KycTab kyc={data.kyc} onAction={refetch} />}
              {tab === "withdrawals" && <WithdrawalsTab withdrawals={data.withdrawals} onAction={refetch} />}
              {tab === "referrals" && <ReferralsAdminTab adjust={undefined} refetchOverview={refetch} />}
              {tab === "businesses" && <BusinessesTab businesses={data.businesses ?? []} />}
              {tab === "settings" && <SettingsTab />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function AdminLoadError({ error, onRetry, busy }: { error: unknown; onRetry: () => void; busy?: boolean }) {
  const message = error instanceof Error ? error.message : "Chargement admin impossible pour le moment.";
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-destructive" />
        <h1 className="mt-3 text-lg font-semibold">Données admin indisponibles</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <button onClick={onRetry} disabled={busy} className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Réessayer
        </button>
      </div>
    </div>
  );
}

function AdminSidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const navigate = useNavigate();
  const items: Array<{ id: Tab; label: string; Icon: any }> = [
    { id: "flow", label: "Flux financier", Icon: TrendingUp },
    { id: "analytics", label: "Analytique", Icon: BarChart3 },
    { id: "assistant", label: "Assistant IA", Icon: Sparkles },
    { id: "users", label: "Utilisateurs", Icon: Users },
    { id: "strowallet", label: "Cartes émises", Icon: CreditCard },
    { id: "payments", label: "Paiements entrants", Icon: Wallet },
    { id: "kyc", label: "KYC à valider", Icon: ShieldCheck },
    { id: "withdrawals", label: "Retraits à valider", Icon: ArrowDownUp },
    { id: "referrals", label: "Parrainages", Icon: Share2 },
    { id: "businesses", label: "Entreprises", Icon: Server },
    { id: "settings", label: "Paramètres", Icon: SlidersHorizontal },
  ];
  async function logout() { await supabase.auth.signOut(); navigate("/"); }
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-card/30 p-4 md:flex md:flex-col">
      <Link to="/" className="mb-2 flex items-center gap-2 px-2">
        <img src={logo} className="h-9 w-9 rounded-xl" alt="" />
        <div><div className="text-sm font-bold">FASO-INVEST PAY</div><div className="text-[10px] uppercase tracking-widest text-primary">Super-admin</div></div>
      </Link>
      <BackButton to="/dashboard" className="mb-4 px-2" />
      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {items.map((it) => (
          <button key={it.id} onClick={() => setTab(it.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${tab === it.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <it.Icon className="h-4 w-4" /> {it.label}
          </button>
        ))}
        <Link to="/admin/sms" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <SlidersHorizontal className="h-4 w-4" /> Notifications SMS
        </Link>
      </nav>
      <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
        <LogOut className="h-4 w-4" /> Déconnexion
      </button>
    </aside>
  );
}

function FlowTab({ data }: { data: any }) {
  const balanceFn = useServerFn(adminStrowalletBalance);
  const [bal, setBal] = useState<any>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  async function refreshBal() {
    setLoadingBal(true);
    try { setBal(await balanceFn()); } finally { setLoadingBal(false); }
  }
  useEffect(() => { refreshBal(); }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Flux financier</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi
          label="Dépôts enregistrés (mois)"
          value={`${Number(data.flows.recharges_all_xof ?? data.flows.recharges_xof ?? 0).toLocaleString("fr-FR")} XOF`}
          tone="success"
          hint={`${Number(data.flows.recharges_xof || 0).toLocaleString("fr-FR")} XOF crédités · ${Number(data.flows.recharges_pending_xof || 0).toLocaleString("fr-FR")} XOF en attente`}
        />
        <Kpi
          label="Retraits enregistrés (mois)"
          value={`${Number(data.flows.withdrawals_all_xof ?? data.flows.withdrawals_xof ?? 0).toLocaleString("fr-FR")} XOF`}
          tone="warning"
          hint={`${Number(data.flows.withdrawals_xof || 0).toLocaleString("fr-FR")} XOF payés · ${Number(data.flows.withdrawals_pending_xof || 0).toLocaleString("fr-FR")} XOF en attente`}
        />
        <Kpi
          label="Émissions cartes (mois)"
          value={`${Number(data.flows.card_issue_all_xof ?? data.flows.card_issue_xof ?? 0).toLocaleString("fr-FR")} XOF`}
          tone="primary"
          hint={`${Number(data.flows.card_issue_xof || 0).toLocaleString("fr-FR")} XOF réussis · ${Number(data.flows.card_issue_pending_xof || 0).toLocaleString("fr-FR")} XOF en attente`}
        />
        <Kpi
          label="Solde total cartes"
          value={`${Number(data.flows.card_balance_usd || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} USD`}
          tone="primary"
          hint={`${Number(data.flows.cards_count || 0).toLocaleString("fr-FR")} cartes créées · ${Number(data.flows.cards_active_count || 0).toLocaleString("fr-FR")} actives`}
        />
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Solde émetteur (compte maître)</h2>
          </div>
          <button onClick={refreshBal} className="rounded-full border border-border bg-surface-2 p-2 hover:bg-muted">
            <RefreshCw className={`h-4 w-4 ${loadingBal ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="mt-4">
          {!bal ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : bal.ok ? (
            <pre className="overflow-auto rounded-xl bg-card p-3 text-xs">{JSON.stringify(bal.data, null, 2)}</pre>
          ) : (
            <p className="text-sm text-destructive">Erreur API : {bal.error}</p>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 font-semibold">Dernières transactions (toutes)</h2>
        <SimpleTxTable items={data.transactions.slice(0, 15)} />
      </section>
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone: "success" | "warning" | "primary"; hint?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${tone === "success" ? "border-success/30 bg-success/5" : tone === "warning" ? "border-warning/30 bg-warning/5" : "border-primary/30 bg-primary/5"}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-[Space_Grotesk] text-2xl font-bold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function SimpleTxTable({ items }: { items: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Date</th><th>Utilisateur</th><th>Type</th><th>Description</th><th>Référence</th><th>Statut</th><th className="text-right">Montant</th></tr></thead>
      <tbody className="divide-y divide-border">
        {items.map((t) => (
          <tr key={t.id}><td className="py-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</td><td className="text-xs">{t.owner?.full_name || t.owner?.email || t.user_id?.slice(0, 8) || "—"}</td><td>{t.type}</td><td className="truncate">{t.description}</td><td className="font-mono text-xs text-muted-foreground">{t.provider_ref || "—"}</td><td>{t.status}</td><td className="text-right font-semibold tabular-nums">{Number(t.amount).toLocaleString("fr-FR")} {t.currency}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function UsersTab({ users, onAction }: { users: any[]; onAction: () => void }) {
  const toggle = useServerFn(adminToggleUser);
  const del = useServerFn(adminDeleteUser);
  const adjust = useServerFn(adminAdjustWallet);
  const edit = useServerFn(adminUpdateUser);
  const [adjustFor, setAdjustFor] = useState<any | null>(null);
  const [editFor, setEditFor] = useState<any | null>(null);
  async function flip(u: any) {
    try { await toggle({ data: { user_id: u.id, is_active: !u.is_active } }); toast.success("Utilisateur mis à jour"); onAction(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function remove(u: any) {
    const ok = window.confirm(`Supprimer définitivement le compte de ${u.full_name || u.email} ? Cette action est irréversible et supprimera ses portefeuilles, cartes et transactions.`);
    if (!ok) return;
    try { await del({ data: { user_id: u.id } }); toast.success("Compte supprimé"); onAction(); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Utilisateurs ({users.length})</h1>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Nom</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">ID émetteur</th><th className="px-4 py-3">Actif</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.phone ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{u.strowallet_customer_id ? <span className="text-success">ID {u.strowallet_customer_id}</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">{u.is_active ? <span className="text-success">●</span> : <span className="text-destructive">●</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button onClick={() => setEditFor(u)} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20">
                      Modifier
                    </button>
                    <button onClick={() => setAdjustFor(u)} className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success hover:bg-success/20">
                      Ajuster solde
                    </button>
                    <button onClick={() => flip(u)} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs hover:bg-muted">
                      {u.is_active ? "Suspendre" : "Réactiver"}
                    </button>
                    <button onClick={() => remove(u)} className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20">
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adjustFor && (
        <AdjustWalletModal
          user={adjustFor}
          onClose={() => setAdjustFor(null)}
          onDone={() => { setAdjustFor(null); onAction(); }}
          adjust={adjust}
        />
      )}
      {editFor && (
        <EditUserModal
          user={editFor}
          onClose={() => setEditFor(null)}
          onDone={() => { setEditFor(null); onAction(); }}
          edit={edit}
        />
      )}
    </div>
  );
}

function EditUserModal({ user, onClose, onDone, edit }: { user: any; onClose: () => void; onDone: () => void; edit: any }) {
  const [fullName, setFullName] = useState<string>(user.full_name || "");
  const [email, setEmail] = useState<string>(user.email || "");
  const [password, setPassword] = useState<string>("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const patch: any = { user_id: user.id, full_name: fullName, email };
      if (password && password.length >= 6) patch.password = password;
      await edit({ data: patch });
      toast.success("Utilisateur mis à jour");
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold">Modifier — {user.full_name || user.email}</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Nom complet
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Nouveau mot de passe (optionnel, 6 min)
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">Annuler</button>
          <button onClick={submit} disabled={busy} className="rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustWalletModal({ user, onClose, onDone, adjust }: { user: any; onClose: () => void; onDone: () => void; adjust: any }) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [currency, setCurrency] = useState<"XOF" | "USD">("XOF");
  const [amount, setAmount] = useState<number>(1000);
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!amount || amount <= 0) { toast.error("Montant invalide"); return; }
    setBusy(true);
    try {
      const signed = direction === "credit" ? amount : -amount;
      await adjust({ data: { user_id: user.id, currency, amount: signed, note } });
      toast.success(direction === "credit" ? "Solde crédité" : "Solde débité");
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold">Ajuster le solde — {user.full_name || user.email}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Cette opération est tracée dans les transactions de l'utilisateur.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setDirection("credit")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${direction === "credit" ? "bg-success text-success-foreground" : "border border-border bg-surface-2"}`}>+ Créditer</button>
          <button onClick={() => setDirection("debit")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${direction === "debit" ? "bg-destructive text-destructive-foreground" : "border border-border bg-surface-2"}`}>− Débiter</button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Devise
            <select value={currency} onChange={(e) => setCurrency(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none">
              <option value="XOF">XOF</option><option value="USD">USD</option>
            </select>
          </label>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Motif (optionnel)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: Remboursement, correction…" className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">Annuler</button>
          <button onClick={submit} disabled={busy} className="rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StrowalletTab({ cards }: { cards: any[] }) {
  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Cartes émises — Historique</h1>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Titulaire</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Marque</th><th className="px-4 py-3">PAN</th><th className="px-4 py-3">Solde carte</th><th className="px-4 py-3">Dépôts cumulés</th><th className="px-4 py-3">Statut</th></tr></thead>
          <tbody className="divide-y divide-border">
            {cards.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-xs font-medium">{c.owner?.full_name || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{c.owner?.email || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">{c.brand}</td>
                <td className="px-4 py-3 tabular-nums">•••• {c.last4 ?? "????"}</td>
                <td className="px-4 py-3 tabular-nums">{Number(c.balance).toFixed(2)} {c.currency}</td>
                <td className="px-4 py-3 tabular-nums">${Number(c.total_funded_usd || 0).toFixed(2)}</td>
                <td className="px-4 py-3">{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsTab({ tx }: { tx: any[] }) {
  const [filter, setFilter] = useState<string>("all");
  const types = Array.from(new Set(tx.map((t) => t.type))).sort();
  const items = filter === "all" ? tx : tx.filter((t) => t.type === filter);
  const creditFn = useServerFn(adminCreditPendingDeposit);
  const creditExternalFn = useServerFn(adminCreditYengapayExternal);
  const inspectFn = useServerFn(adminYengapayInspect);
  const verifyBatchFn = useServerFn(adminYengapayVerifyBatch);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string>("");
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [inspecting, setInspecting] = useState(false);
  const [verifyList, setVerifyList] = useState<string>("");
  const [verifyResults, setVerifyResults] = useState<any[] | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function credit(txId: string) {
    if (!confirm("Confirmer le crédit manuel de cette recharge ?")) return;
    setBusyId(txId);
    try {
      const r: any = await creditFn({ data: { txId } });
      if (r?.alreadyCredited) toast.info("Déjà crédité");
      else toast.success(`Crédité (${r?.amount} XOF)`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }
  async function inspect() {
    if (!inspectId.trim()) return;
    setInspecting(true); setInspectResult(null);
    try { setInspectResult(await inspectFn({ data: { id: inspectId.trim() } })); }
    catch (e) { toast.error((e as Error).message); }
    finally { setInspecting(false); }
  }
  async function verifyBatch() {
    const ids = verifyList.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) { toast.error("Collez au moins un ID YengaPay"); return; }
    setVerifying(true); setVerifyResults(null);
    try {
      const r: any = await verifyBatchFn({ data: { ids } });
      setVerifyResults(r?.results || []);
    } catch (e) { toast.error((e as Error).message); }
    finally { setVerifying(false); }
  }
  async function creditFromVerify(txId: string) {
    if (!confirm("Créditer cette recharge maintenant ?")) return;
    try {
      const r: any = await creditFn({ data: { txId } });
      if (r?.alreadyCredited) toast.info("Déjà crédité");
      else toast.success(`Crédité (${r?.amount} XOF)`);
      // refresh verify view: mark this tx as credited locally
      setVerifyResults((prev) => prev?.map((it) => it.transaction?.id === txId ? { ...it, transaction: { ...it.transaction, status: "success", credited: true } } : it) || null);
    } catch (e) { toast.error((e as Error).message); }
  }
  async function creditExternal(r: any) {
    if (!r?.id) return;
    if (!confirm(`Créditer automatiquement le paiement ${r.id} au portefeuille identifié ?`)) return;
    try {
      const res: any = await creditExternalFn({ data: { yengaId: r.id, userId: r.matchedOwner?.id, note: "Crédit depuis vérification YengaPay" } });
      if (res?.alreadyCredited) toast.info("Déjà crédité");
      else toast.success(`Crédité (${Number(res?.amount || 0).toLocaleString("fr-FR")} XOF)`);
      setVerifyResults((prev) => prev?.map((it) => it.id === r.id ? { ...it, transaction: { ...(it.transaction || {}), id: res?.tx_id, status: "success", credited: true }, owner: it.owner || it.matchedOwner } : it) || null);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Historique des transactions ({items.length})</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs">
          <option value="all">Tous les types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="mb-2 font-semibold">Rapprochement YengaPay</h2>
        <p className="mb-3 text-xs text-muted-foreground">Collez un ID de dépôt reçu côté YengaPay (ex. YP2026078.1056.79314766) pour voir ce que renvoie leur API et retrouver la recharge en attente correspondante.</p>
        <div className="flex flex-wrap gap-2">
          <input value={inspectId} onChange={(e) => setInspectId(e.target.value)} placeholder="YP2026…" className="flex-1 min-w-[240px] rounded-full border border-border bg-surface-2 px-4 py-2 text-sm" />
          <button onClick={inspect} disabled={inspecting} className="rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{inspecting ? "Recherche…" : "Rechercher"}</button>
        </div>
        {inspectResult && (
          <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-card p-3 text-[11px]">{JSON.stringify(inspectResult, null, 2)}</pre>
        )}

        <div className="mt-5 border-t border-primary/20 pt-4">
          <h3 className="mb-1 text-sm font-semibold">Vérification en lot</h3>
          <p className="mb-2 text-xs text-muted-foreground">Collez plusieurs IDs YengaPay (un par ligne ou séparés par des virgules). L'outil interroge chaque ID et indique s'il a déjà été crédité dans un portefeuille.</p>
          <textarea
            value={verifyList}
            onChange={(e) => setVerifyList(e.target.value)}
            rows={4}
            placeholder={"YP2026078.1056.79314766\nYP2026077.021.10794473"}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-mono"
          />
          <div className="mt-2 flex justify-end">
            <button onClick={verifyBatch} disabled={verifying} className="rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {verifying ? "Vérification…" : "Vérifier"}
            </button>
          </div>
          {verifyResults && verifyResults.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-xs">
                <thead className="bg-surface-2 text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">ID YengaPay</th>
                    <th className="px-2 py-2">Statut opérateur</th>
                    <th className="px-2 py-2">Montant</th>
                    <th className="px-2 py-2">Utilisateur</th>
                    <th className="px-2 py-2">Portefeuille</th>
                    <th className="px-2 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {verifyResults.map((r) => {
                    const credited = r.transaction?.credited;
                    return (
                      <tr key={r.id}>
                        <td className="px-2 py-2 font-mono">{r.id}</td>
                        <td className="px-2 py-2">
                          {!r.found ? <span className="text-muted-foreground">Introuvable</span> :
                            r.yengaState === "success" ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">Payé</span> :
                            r.yengaState === "failed" ? <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">Échoué</span> :
                            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">{r.rawStatus || "En attente"}</span>}
                        </td>
                        <td className="px-2 py-2 tabular-nums">{r.amount ? `${Number(r.amount).toLocaleString("fr-FR")} XOF` : "—"}</td>
                        <td className="px-2 py-2">
                          {r.owner || r.matchedOwner ? (
                            <div>
                              <div className="font-semibold">{(r.owner || r.matchedOwner).full_name || (r.owner || r.matchedOwner).email}</div>
                              <div className="text-[10px] text-muted-foreground">{(r.owner || r.matchedOwner).phone || (r.owner || r.matchedOwner).email}{!r.owner && r.matchedOwner ? " · détecté par numéro" : ""}</div>
                            </div>
                          ) : r.transaction ? <span className="text-muted-foreground">User {String(r.transaction.user_id).slice(0, 8)}</span>
                            : <span className="text-muted-foreground">Aucune recharge locale</span>}
                        </td>
                        <td className="px-2 py-2">
                          {credited ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">✅ Crédité</span> :
                            r.transaction || r.canCreateCredit ? <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">Non crédité</span> :
                            <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {r.transaction && !credited && r.yengaState !== "failed" ? (
                            <button onClick={() => creditFromVerify(r.transaction.id)} className="rounded-full bg-success/15 px-3 py-1 font-semibold text-success hover:bg-success/25">Créditer</button>
                          ) : r.canCreateCredit ? (
                            <button onClick={() => creditExternal(r)} className="rounded-full bg-success/15 px-3 py-1 font-semibold text-success hover:bg-success/25">Créer + créditer</button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {verifyResults && verifyResults.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Aucun résultat.</p>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Utilisateur</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Référence</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2 text-xs">{t.owner?.full_name || t.owner?.email || t.user_id?.slice(0, 8)}</td>
                <td className="px-3 py-2 text-xs">{t.type}</td>
                <td className="px-3 py-2 text-xs">{t.description}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{t.provider_ref || "—"}</td>
                <td className="px-3 py-2 text-xs">{t.status}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{Number(t.amount).toLocaleString("fr-FR")} {t.currency}</td>
                <td className="px-3 py-2 text-right">
                  {t.type === "deposit" && t.status === "pending" ? (
                    <button onClick={() => credit(t.id)} disabled={busyId === t.id} className="rounded-full bg-success/15 px-3 py-1 text-[11px] font-semibold text-success hover:bg-success/25 disabled:opacity-60">{busyId === t.id ? "…" : "Créditer"}</button>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune transaction</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BusinessesTab({ businesses }: { businesses: any[] }) {
  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Entreprises ({businesses.length})</h1>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Nom</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Actif</th><th className="px-4 py-3">Créée le</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {businesses.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{b.slug || "—"}</td>
                <td className="px-4 py-3 text-xs">{b.contact_email || b.contact_phone || "—"}</td>
                <td className="px-4 py-3">{b.is_active ? <span className="text-success">●</span> : <span className="text-muted-foreground">●</span>}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
            {businesses.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune entreprise</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KycTab({ kyc, onAction }: { kyc: any[]; onAction: () => void }) {
  const review = useServerFn(adminReviewKyc);
  async function decide(user_id: string, decision: "approved" | "rejected") {
    try { await review({ data: { user_id, decision } }); toast.success("KYC mis à jour"); onAction(); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">KYC à valider ({kyc.length})</h1>
      <div className="space-y-3">
        {kyc.map((k) => (
          <div key={k.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{k.first_name} {k.last_name}</div>
                <div className="text-xs text-muted-foreground">{k.id_type} · {k.id_number} · {k.country}</div>
                <div className="mt-1 text-xs">Local: <b>{k.status}</b> · Émetteur: <b>{k.provider_status ?? "—"}</b>{!k.provider_response?.response?.bitvcard_customer_id && !k.strowallet_customer_id ? <span> · <b className="text-warning">client non créé</b></span> : null}</div>
              </div>
              <div className="flex gap-2">
                {k.id_image_url && <a href={k.id_image_url} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1 text-xs"><Eye className="mr-1 inline h-3 w-3" /> Pièce</a>}
                {k.selfie_url && <a href={k.selfie_url} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1 text-xs"><Eye className="mr-1 inline h-3 w-3" /> Selfie</a>}
                <button onClick={() => decide(k.user_id, "approved")} className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground"><CheckCircle2 className="mr-1 inline h-3 w-3" /> Approuver</button>
                <button onClick={() => decide(k.user_id, "rejected")} className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground"><XCircle className="mr-1 inline h-3 w-3" /> Rejeter</button>
              </div>
            </div>
          </div>
        ))}
        {kyc.length === 0 && <p className="text-sm text-muted-foreground">Aucun KYC en attente.</p>}
      </div>
    </div>
  );
}

function WithdrawalsTab({ withdrawals, onAction }: { withdrawals: any[]; onAction: () => void }) {
  const review = useServerFn(adminReviewWithdrawal);
  async function decide(id: string, decision: "approved" | "rejected" | "paid") {
    try { await review({ data: { id, decision } }); toast.success("Retrait mis à jour"); onAction(); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Retraits à valider ({withdrawals.length})</h1>
      <div className="space-y-3">
        {withdrawals.map((w) => (
          <div key={w.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold tabular-nums">{Number(w.amount).toLocaleString("fr-FR")} {w.currency}</div>
                <div className="text-xs text-muted-foreground">{w.method} · {(w.destination as any)?.operator} · {(w.destination as any)?.phone ?? (w.destination as any)?.account} · {(w.destination as any)?.holder}</div>
                <div className="mt-1 text-xs">Statut : <b>{w.status}</b></div>
              </div>
              {w.status === "pending" && (
                <div className="flex gap-2">
                  <button onClick={() => decide(w.id, "paid")} className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">Marquer payé</button>
                  <button onClick={() => decide(w.id, "rejected")} className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground">Rejeter (rembourser)</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {withdrawals.length === 0 && <p className="text-sm text-muted-foreground">Aucun retrait.</p>}
      </div>
    </div>
  );
}


export default AdminPage;

function ReferralsAdminTab(_props: { adjust?: any; refetchOverview: () => void }) {
  const fetchList = useServerFn(adminReferralsOverview);
  const adjust = useServerFn(adminAdjustWallet);
  const toggle = useServerFn(adminToggleUser);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-referrals"], queryFn: () => fetchList() });
  const [bonusFor, setBonusFor] = useState<any | null>(null);
  const groups = (data as any)?.groups ?? [];
  async function suspend(userId: string) {
    if (!confirm("Suspendre ce parrain ? Il ne pourra plus se connecter.")) return;
    try { await toggle({ data: { user_id: userId, is_active: false } }); toast.success("Utilisateur suspendu"); refetch(); }
    catch (e) { toast.error((e as Error).message); }
  }
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Parrainages ({groups.length})</h1>
        <p className="mt-1 text-sm text-muted-foreground">Suivi des parrains, filleuls, cartes récompensées et gains cumulés.</p>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun parrainage pour l'instant.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g: any) => (
            <div key={g.referrer_id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{g.referrer?.full_name || g.referrer?.email || g.referrer_id}</div>
                  <div className="text-xs text-muted-foreground">{g.referrer?.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">{g.total_referred} filleul{g.total_referred > 1 ? "s" : ""}</span>
                  <span className="rounded-full bg-success/10 px-3 py-1 text-success">{g.total_cards_rewarded} carte{g.total_cards_rewarded > 1 ? "s" : ""}</span>
                  <span className="rounded-full bg-success/15 px-3 py-1 font-semibold text-success tabular-nums">+{Number(g.total_earned_xof).toLocaleString("fr-FR")} XOF</span>
                  <button onClick={() => setBonusFor(g.referrer)} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20">Bonus</button>
                  <button onClick={() => suspend(g.referrer_id)} className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-destructive hover:bg-destructive/20">Suspendre</button>
                </div>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                    <tr><th className="px-3 py-2">Filleul</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Inscrit le</th><th className="px-3 py-2 text-right">Cartes</th><th className="px-3 py-2 text-right">Récompense</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.filleuls.map((f: any) => (
                      <tr key={f.referral_id}>
                        <td className="px-3 py-2">{f.referred?.full_name || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{f.referred?.email || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(f.created_at).toLocaleDateString("fr-FR")}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.cards_rewarded}</td>
                        <td className="px-3 py-2 text-right font-semibold text-success tabular-nums">+{Number(f.total_reward_xof).toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      {bonusFor && (
        <AdjustWalletModal user={bonusFor} onClose={() => setBonusFor(null)} onDone={() => { setBonusFor(null); refetch(); }} adjust={adjust} />
      )}
    </div>
  );
}

function SettingsTab() {
  const getCfg = useServerFn(adminGetConfig);
  const updCfg = useServerFn(adminUpdateConfig);
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<any>({});

  useEffect(() => { (async () => {
    try { const r: any = await getCfg(); setCfg(r.config); setDraft(r.config); }
    catch (e) { toast.error((e as Error).message); }
  })(); }, []);

  function field(k: string, label: string, hint: string, step = "any") {
    return (
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <input
          type="number"
          step={step}
          value={draft[k] ?? ""}
          onChange={(e) => setDraft((d: any) => ({ ...d, [k]: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
      </label>
    );
  }

  async function save() {
    setBusy(true);
    try {
      const r: any = await updCfg({ data: draft });
      if (r?.ok === false) throw new Error(r.error);
      setCfg(r.config); setDraft(r.config);
      toast.success("Paramètres mis à jour");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (!cfg) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Paramètres plateforme</h1>
        <p className="mt-1 text-sm text-muted-foreground">Taux de change et frais appliqués à toutes les nouvelles opérations.</p>
      </div>
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-2">
        {field("usd_rate_xof", "Taux USD → XOF", "Combien de francs CFA pour 1 USD (ex: 869)", "0.01")}
        {field("card_issue_fee_xof", "Frais d'émission (XOF)", "Marge plateforme par carte émise (ex: 4500)", "1")}
        {field("strowallet_fixed_fee_usd", "Frais fixe émetteur (USD)", "Frais émetteur par opération (ex: 1.90)", "0.01")}
        {field("strowallet_pct_fee", "Frais % émetteur", "Pourcentage émetteur en décimal (ex: 0.01 = 1%)", "0.001")}
        {field("referral_reward_xof", "Récompense parrainage (XOF)", "Montant crédité au parrain par carte achetée par un filleul (ex: 1000)", "1")}
        <label className="block md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lien groupe WhatsApp</span>
          <input
            type="url"
            value={draft.whatsapp_group_url ?? ""}
            onChange={(e) => setDraft((d: any) => ({ ...d, whatsapp_group_url: e.target.value }))}
            placeholder="https://chat.whatsapp.com/..."
            className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">Affiché sur le tableau de bord de tous les utilisateurs et sur la page parrainage.</span>
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setDraft(cfg)} className="rounded-full border border-border bg-surface-2 px-4 py-2 text-sm">Réinitialiser</button>
        <button onClick={save} disabled={busy} className="rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
        </button>
      </div>
      <PaypalWithdrawSettings />
    </div>
  );
}

function PaypalWithdrawSettings() {
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPaypalWithdrawConfig()
      .then((c: any) => setCfg({ fee_bps: c.fee_bps, fee_flat_xof: c.fee_flat_xof, min_xof: c.min, max_xof: c.max, enabled: c.enabled }))
      .catch((e: any) => toast.error(e?.message || "Erreur"));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const c: any = await adminUpdatePaypalWithdrawConfig({
        fee_bps: Number(cfg.fee_bps), fee_flat_xof: Number(cfg.fee_flat_xof),
        min_xof: Number(cfg.min_xof), max_xof: Number(cfg.max_xof), enabled: !!cfg.enabled,
      });
      setCfg({ fee_bps: c.fee_bps, fee_flat_xof: c.fee_flat_xof, min_xof: c.min, max_xof: c.max, enabled: c.enabled });
      toast.success("Frais de retrait PayPal mis à jour");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (!cfg) return null;
  const num = (k: string, label: string, hint: string) => (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input type="number" value={cfg[k] ?? ""} onChange={(e) => setCfg((d: any) => ({ ...d, [k]: e.target.value }))}
        className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none" />
      <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
    </label>
  );
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div>
        <h2 className="font-[Space_Grotesk] text-xl font-bold">Retrait PayPal</h2>
        <p className="mt-1 text-sm text-muted-foreground">Frais et limites appliqués aux retraits PayPal vers Orange Money / Moov Money.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {num("fee_bps", "Commission (points de base)", "500 = 5% du montant retiré")}
        {num("fee_flat_xof", "Frais fixe (XOF)", "Ajouté à chaque retrait (ex: 250)")}
        {num("min_xof", "Montant minimum (XOF)", "Ex: 1000")}
        {num("max_xof", "Montant maximum (XOF)", "Ex: 500000")}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => setCfg((d: any) => ({ ...d, enabled: e.target.checked }))} />
        Activer les retraits PayPal
      </label>
      <div className="flex justify-end">
        <button onClick={save} disabled={busy} className="rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useServerFn } from "@/lib/server-fn";
import { useQuery } from "@tanstack/react-query";
import {
  Users, TrendingUp, CreditCard, ShieldCheck, ArrowDownUp, LogOut, RefreshCw,
  Loader2, CheckCircle2, XCircle, Wallet, Server, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import logo from "@/assets/logo.png";
import { adminOverview, adminStrowalletBalance, adminToggleUser, adminReviewKyc, adminReviewWithdrawal } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Super-Admin — FASO-INVEST PAY" }] }),
  component: AdminPage,
});

type Tab = "users" | "flow" | "strowallet" | "yengapay" | "kyc" | "withdrawals";

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("flow");
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      setAuthState(isAdmin ? "ok" : "denied");
    })();
  }, [navigate]);

  const fetchOverview = useServerFn(adminOverview);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["adminOverview"], queryFn: () => fetchOverview(), enabled: authState === "ok",
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
          {isLoading || !data ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              {tab === "flow" && <FlowTab data={data} />}
              {tab === "users" && <UsersTab users={data.users} onAction={refetch} />}
              {tab === "strowallet" && <StrowalletTab cards={data.cards} />}
              {tab === "yengapay" && <YengaTab tx={data.transactions} />}
              {tab === "kyc" && <KycTab kyc={data.kyc} onAction={refetch} />}
              {tab === "withdrawals" && <WithdrawalsTab withdrawals={data.withdrawals} onAction={refetch} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function AdminSidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const navigate = useNavigate();
  const items: Array<{ id: Tab; label: string; Icon: any }> = [
    { id: "flow", label: "Flux financier", Icon: TrendingUp },
    { id: "users", label: "Utilisateurs", Icon: Users },
    { id: "strowallet", label: "API Strowallet", Icon: CreditCard },
    { id: "yengapay", label: "API YengaPay", Icon: Wallet },
    { id: "kyc", label: "KYC à valider", Icon: ShieldCheck },
    { id: "withdrawals", label: "Retraits à valider", Icon: ArrowDownUp },
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

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Dépôts (mois)" value={`${data.flows.recharges_xof.toLocaleString("fr-FR")} XOF`} tone="success" />
        <Kpi label="Retraits (mois)" value={`${data.flows.withdrawals_xof.toLocaleString("fr-FR")} XOF`} tone="warning" />
        <Kpi label="Émissions cartes (mois)" value={`${data.flows.card_issue_xof.toLocaleString("fr-FR")} XOF`} tone="primary" />
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Solde Strowallet (compte maître)</h2>
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

function Kpi({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "primary" }) {
  return (
    <div className={`rounded-2xl border p-5 ${tone === "success" ? "border-success/30 bg-success/5" : tone === "warning" ? "border-warning/30 bg-warning/5" : "border-primary/30 bg-primary/5"}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-[Space_Grotesk] text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SimpleTxTable({ items }: { items: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Date</th><th>Type</th><th>Description</th><th>Statut</th><th className="text-right">Montant</th></tr></thead>
      <tbody className="divide-y divide-border">
        {items.map((t) => (
          <tr key={t.id}><td className="py-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</td><td>{t.type}</td><td className="truncate">{t.description}</td><td>{t.status}</td><td className="text-right font-semibold tabular-nums">{Number(t.amount).toLocaleString("fr-FR")} {t.currency}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function UsersTab({ users, onAction }: { users: any[]; onAction: () => void }) {
  const toggle = useServerFn(adminToggleUser);
  async function flip(u: any) {
    try { await toggle({ data: { user_id: u.id, is_active: !u.is_active } }); toast.success("Utilisateur mis à jour"); onAction(); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Utilisateurs ({users.length})</h1>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Nom</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">Strowallet</th><th className="px-4 py-3">Actif</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.phone ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{u.strowallet_customer_id ? <span className="text-success">ID {u.strowallet_customer_id}</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">{u.is_active ? <span className="text-success">●</span> : <span className="text-destructive">●</span>}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => flip(u)} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs hover:bg-muted">
                    {u.is_active ? "Désactiver" : "Réactiver"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StrowalletTab({ cards }: { cards: any[] }) {
  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">API Strowallet — Dernières cartes</h1>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Marque</th><th className="px-4 py-3">PAN</th><th className="px-4 py-3">Solde</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Échecs</th></tr></thead>
          <tbody className="divide-y divide-border">
            {cards.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-xs">{c.user_id.slice(0, 8)}…</td>
                <td className="px-4 py-3">{c.brand}</td>
                <td className="px-4 py-3 tabular-nums">•••• {c.last4 ?? "????"}</td>
                <td className="px-4 py-3 tabular-nums">{Number(c.balance).toFixed(2)} {c.currency}</td>
                <td className="px-4 py-3">{c.status}</td>
                <td className="px-4 py-3 tabular-nums">{c.failed_attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function YengaTab({ tx }: { tx: any[] }) {
  const ypTx = tx.filter((t) => t.type === "deposit");
  return (
    <div className="space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">API YengaPay — Derniers paiements</h1>
      <SimpleTxTable items={ypTx} />
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
                <div className="mt-1 text-xs">Local: <b>{k.status}</b> · Strowallet: <b>{k.provider_status ?? "—"}</b>{!k.provider_response?.response?.bitvcard_customer_id && !k.strowallet_customer_id ? <span> · <b className="text-warning">client non créé</b></span> : null}</div>
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

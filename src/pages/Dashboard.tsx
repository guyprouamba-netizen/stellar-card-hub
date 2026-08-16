import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useServerFn } from "@/lib/server-fn";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  LayoutDashboard, ArrowDownLeft, ArrowUpRight, CreditCard, History,
  UserCircle, LogOut, Plus, Snowflake, Loader2,
  AlertTriangle, Wallet, Building2, Users, Share2, MessageCircle, Copy, Check, Repeat, ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import logo from "@/assets/logo.png";
import { getDashboardData } from "@/lib/dashboard.functions";
import { cardAction } from "@/lib/strowallet.functions";
import { cardDetails } from "@/lib/strowallet.functions";
import { STATUS_LABEL } from "@/lib/pay.functions";
import { requestWithdrawal } from "@/lib/withdrawal.functions";
import { initRecharge, verifyRecharge, reconcileMyDeposits } from "@/lib/yengapay.functions";
import { FALLBACK_OPERATORS, type DepositOperator, depositStatus, initDeposit, listDepositOperators, payDeposit, sendDepositOtp } from "@/lib/deposit.functions";
import { updateMyProfile, updateMyPassword, createAvatarUploadUrl, getAvatarSignedUrl } from "@/lib/profile.functions";
import { getMyReferralStats, getPublicConfig } from "@/lib/profile.functions";
import { IssueCardSheet } from "@/components/issue-card-sheet";
import { VirtualCard } from "@/components/virtual-card";
import { toast } from "sonner";

type Tab = "home" | "deposit" | "withdraw" | "cards" | "tx" | "referrals" | "profile" | "purchases";

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialUserId = (location.state as { userId?: string } | null)?.userId;
  const [tab, setTab] = useState<Tab>("home");
  // On n'affiche le dashboard qu'après que Supabase ait confirmé une session côté client
  // (sinon les requêtes RLS partent sans JWT et renvoient des tableaux vides —
  // ce qui obligeait l'utilisateur à rafraîchir après inscription/connexion).
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const offline = !navigator.onLine;

  useEffect(() => {
    let active = true;
    // 1) Listener d'abord : on capte SIGNED_IN / TOKEN_REFRESHED sans race
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!active) return;
      if (!s && !navigator.onLine) {
        setSession((current: any) => current || { user: { id: localStorage.getItem("fasopay:last-user") }, access_token: "offline" });
      } else if (!s) {
        setSession(null);
        navigate("/auth", { replace: true });
      } else {
        setSession(s);
        localStorage.setItem("fasopay:last-user", s.user.id);
      }
      setCheckingAuth(false);
    });
    // 2) Puis récupération initiale
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setSession(data.session);
        setCheckingAuth(false);
      } else if (initialUserId) {
        // Fallback court : session pas encore hydratée mais on vient d'un login → on attend le listener
        setTimeout(() => {
          if (!active) return;
          setCheckingAuth((prev) => {
            if (prev) {
              // toujours pas de session après 1.2s → on renvoie vers /auth
              supabase.auth.getSession().then(({ data: d2 }) => {
                if (!active) return;
                if (d2.session) { setSession(d2.session); setCheckingAuth(false); }
                else navigate("/auth", { replace: true });
              });
            }
            return prev;
          });
        }, 1200);
       } else if (!navigator.onLine && localStorage.getItem("fasopay:last-user")) {
         setSession({ user: { id: localStorage.getItem("fasopay:last-user") }, access_token: "offline" });
         setCheckingAuth(false);
       } else {
        navigate("/auth", { replace: true });
        setCheckingAuth(false);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [navigate, initialUserId]);

  const fetchDash = useServerFn(getDashboardData);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", session?.user?.id],
    queryFn: () => fetchDash({ userId: session?.user?.id }),
    // On n'active la query qu'une fois la session Supabase réellement présente
    // (access_token attaché au client) — sinon RLS renvoie vide et l'écran paraît "en attente d'actualisation".
    enabled: !!session?.user?.id && !!session?.access_token,
    refetchInterval: offline ? false : 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  // Vérification automatique du retour passerelle de paiement (?recharge=REF)
  const verifyFn = useServerFn(verifyRecharge);
  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("recharge");
    if (!ref) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const r: any = await verifyFn({ data: { reference: ref } });
        if (r?.status === "success") {
          toast.success(r.credited ? "Recharge créditée sur votre compte ✅" : "Recharge déjà créditée");
          const url = new URL(window.location.href);
          url.searchParams.delete("recharge");
          window.history.replaceState({}, "", url.toString());
          refetch();
          return;
        }
        if (r?.status === "failed") {
          toast.error("Recharge échouée ou annulée");
          const url = new URL(window.location.href);
          url.searchParams.delete("recharge");
          window.history.replaceState({}, "", url.toString());
          return;
        }
      } catch { /* ignore, retry */ }
      if (attempts < 20) setTimeout(tick, 3000);
      else toast.message("Recharge en attente, elle sera créditée dès confirmation du paiement.");
    };
    tick();
    return () => { cancelled = true; };
  }, [session]);

  // Auto-réconciliation: à chaque chargement du dashboard, balayer toutes les recharges
  // "en attente" de l'utilisateur et créditer celles qui ont été payées chez YengaPay
  // (filet de sécurité si le webhook n'est pas arrivé).
  useEffect(() => {
    if (!session?.user?.id || offline) return;
    let cancelled = false;
    const run = async () => {
      try {
        const r: any = await reconcileMyDeposits();
        if (cancelled) return;
        if (r?.credited > 0) {
          toast.success(`${r.credited} recharge(s) en attente créditée(s) ✅`);
          refetch();
        }
      } catch { /* silent */ }
    };
    run();
    const id = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [session?.user?.id, offline]);

  if (!session && checkingAuth) return <FullPageLoader />;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <Sidebar tab={tab} setTab={setTab} />
        <main className="flex-1 px-4 pb-24 pt-20 sm:px-8 md:py-8 md:pt-8">
          {offline && <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">Mode hors ligne — consultation uniquement. Recharge, retrait et actions financières sont désactivés.</div>}
          {isLoading ? <FullPageLoader /> : isError || !data ? <LoadError error={error} onRetry={() => refetch()} busy={isFetching} /> : (
            <>
              {tab === "home" && <HomeTab data={data} onAction={() => refetch()} onOpenTx={() => setTab("tx")} />}
               {tab === "deposit" && (offline ? <OfflineAction /> : <DepositTab onDone={() => refetch()} />)}
               {tab === "withdraw" && (offline ? <OfflineAction /> : <WithdrawTab balance={Number(data.wallets.find((w: any) => w.currency === "XOF")?.balance ?? 0)} profile={data.profile} onDone={() => refetch()} />)}
              {tab === "cards" && <CardsTab cards={data.cards} onAction={() => refetch()} />}
              {tab === "tx" && <TxTab transactions={data.transactions} />}
              {tab === "purchases" && <PurchasesTab userId={session.user.id} />}
              {tab === "referrals" && <ReferralsTab />}
              {tab === "profile" && <ProfileTab profile={data.profile} onDone={() => refetch()} setTab={setTab} />}
            </>
          )}
        </main>
      </div>
      <MobileNav tab={tab} setTab={setTab} />
    </div>
  );
}

function FullPageLoader() {
  return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

function LoadError({ error, onRetry, busy }: { error: unknown; onRetry: () => void; busy?: boolean }) {
  const message = error instanceof Error ? error.message : "Chargement impossible pour le moment.";
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-destructive" />
        <h1 className="mt-3 text-lg font-semibold">Données momentanément indisponibles</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <button onClick={onRetry} disabled={busy} className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Réessayer
        </button>
      </div>
    </div>
  );
}

function OfflineAction() {
  return (
    <div className="grid min-h-[50vh] place-items-center px-4 text-center">
      <div className="max-w-sm rounded-2xl border border-warning/40 bg-warning/10 p-6">
        <AlertTriangle className="mx-auto h-7 w-7 text-warning" />
        <h1 className="mt-3 text-lg font-semibold">Connexion requise</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cette opération modifie votre argent et reste désactivée hors ligne. Vos soldes, cartes et historiques synchronisés restent consultables.</p>
      </div>
    </div>
  );
}

function MobileNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const navigate = useNavigate();
  const items: Array<{ id: Tab; label: string; Icon: any }> = [
    { id: "home", label: "Accueil", Icon: LayoutDashboard },
    { id: "deposit", label: "Dépôt", Icon: ArrowDownLeft },
    { id: "withdraw", label: "Retrait", Icon: ArrowUpRight },
    { id: "cards", label: "Cartes", Icon: CreditCard },
    { id: "purchases", label: "Achats", Icon: ShoppingBag },
    { id: "profile", label: "Profil", Icon: UserCircle },
  ];
  async function logout() {
    await supabase.auth.signOut();
    navigate("/");
  }
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="FASO-INVEST PAY" className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-bold tracking-tight">FASO-INVEST <span className="text-primary">PAY</span></span>
        </Link>
        <button onClick={logout} aria-label="Déconnexion" className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" />
        </button>
      </header>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors ${tab === it.id ? "text-primary" : "text-muted-foreground"}`}
          >
            <it.Icon className="h-5 w-5" />
            {it.label}
          </button>
        ))}
        <Link
          to="/transfer"
          className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium text-muted-foreground"
        >
          <Repeat className="h-5 w-5" />
          Transfert
        </Link>
      </nav>
    </>
  );
}

function Sidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const navigate = useNavigate();
  const items: Array<{ id: Tab; label: string; Icon: any }> = [
    { id: "home", label: "Tableau de bord", Icon: LayoutDashboard },
    { id: "deposit", label: "Dépôt d'argent", Icon: ArrowDownLeft },
    { id: "withdraw", label: "Retrait d'argent", Icon: ArrowUpRight },
    { id: "cards", label: "Mes cartes", Icon: CreditCard },
    { id: "tx", label: "Mes transactions", Icon: History },
    { id: "purchases", label: "Mes achats", Icon: ShoppingBag },
    { id: "referrals", label: "Parrainage", Icon: Users },
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
        <Link to="/business" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <Building2 className="h-4 w-4" /> Espace Business
        </Link>
        <Link to="/transfer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <Repeat className="h-4 w-4" /> Transfert
        </Link>
        <Link to="/paypal-withdraw" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowUpRight className="h-4 w-4" /> Retrait PayPal
        </Link>
      </nav>
      <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
        <LogOut className="h-4 w-4" /> Déconnexion
      </button>
    </aside>
  );
}

function HomeTab({ data, onOpenTx }: { data: any; onAction: () => void; onOpenTx: () => void }) {
  const xof = data.wallets.find((w: any) => w.currency === "XOF");
  const usd = data.wallets.find((w: any) => w.currency === "USD");
  const fetchCfg = useServerFn(getPublicConfig);
  const cfg = useQuery({ queryKey: ["public-config"], queryFn: () => fetchCfg() });
  const whatsappUrl = (cfg.data as any)?.whatsapp_group_url as string | undefined;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Bonjour {data.profile?.full_name?.split(" ")[0] ?? ""} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">Voici un aperçu de votre compte FASO-INVEST PAY.</p>
      </header>

      {whatsappUrl && (
        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm hover:bg-success/15">
          <span className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-success/20 text-success"><MessageCircle className="h-4 w-4" /></span>
            <span><b className="text-success">Rejoignez le groupe WhatsApp</b><br /><span className="text-xs text-muted-foreground">Actualités, tutos et support communautaire</span></span>
          </span>
          <span className="text-success">→</span>
        </a>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <WalletCard label="Solde XOF" amount={xof?.balance ?? 0} currency="XOF" highlight />
        <WalletCard label="Solde USD (carte)" amount={usd?.balance ?? 0} currency="USD" />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Dernières transactions</h2>
          <button onClick={onOpenTx} className="text-xs font-semibold text-primary hover:underline">Tout voir</button>
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
            <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")} · {t.status}{t.provider_ref ? ` · Réf. ${t.provider_ref}` : ""}</div>
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
  const [operators, setOperators] = useState<DepositOperator[]>(FALLBACK_OPERATORS);
  const [operator, setOperator] = useState(FALLBACK_OPERATORS[0].code);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [stage, setStage] = useState<"form" | "otp" | "waiting">("form");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listDepositOperators().then((r) => { if (r?.operators?.length) setOperators(r.operators); }).catch(() => { /* défaut */ });
  }, []);

  const finish = (status: string) => {
    if (status === "success") { toast.success("Dépôt confirmé — solde crédité"); setStage("form"); setOtp(""); setReference(null); onDone(); }
    else { setStage("waiting"); poll(); }
  };

  function poll() {
    const ref = reference;
    if (!ref) return;
    let ticks = 0;
    const id = window.setInterval(async () => {
      ticks += 1;
      try {
        const r = await depositStatus({ reference: ref });
        if (r.status === "success") { window.clearInterval(id); toast.success("Dépôt confirmé — solde crédité"); setStage("form"); onDone(); }
        else if (r.status === "failed") { window.clearInterval(id); toast.error("Paiement refusé ou annulé"); setStage("form"); }
      } catch { /* retry */ }
      if (ticks > 40) window.clearInterval(id);
    }, 4000);
  }

  async function start() {
    setLoading(true);
    try {
      const res = await initDeposit({ amount, operator, phone: phone.replace(/\s+/g, "") });
      if (!res?.ok) throw new Error(res?.error || "Dépôt impossible pour le moment");
      setReference(res.reference);
      if (res.requiresOtp) {
        try { await sendDepositOtp({ reference: res.reference }); } catch { /* déjà envoyé */ }
        setStage("otp");
        toast.info("Saisissez le code reçu par SMS de votre opérateur");
      } else {
        const pay = await payDeposit({ reference: res.reference });
        if (pay.status === "failed") throw new Error(pay.message || "Paiement refusé");
        if (pay.status === "success") { toast.success("Dépôt confirmé — solde crédité"); onDone(); }
        else { setStage("waiting"); setTimeout(poll, 100); }
      }
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }

  async function confirm() {
    if (!reference) return;
    setLoading(true);
    try {
      const pay = await payDeposit({ reference, otp: otp.trim() });
      if (pay.status === "failed") throw new Error(pay.message || "Code incorrect");
      finish(pay.status);
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }

  const phoneOk = /^[0-9]{8,15}$/.test(phone.replace(/\s+/g, ""));

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Dépôt d'argent</h1>
      <p className="text-sm text-muted-foreground">Rechargez votre compte XOF par Mobile Money, directement dans l'application.</p>

      {stage === "form" && (
        <>
          <div className="rounded-2xl border border-border bg-card p-6">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant à recharger</label>
            <div className="mt-2 flex items-baseline gap-2">
              <input type="number" min={500} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-full bg-transparent font-[Space_Grotesk] text-4xl font-bold tabular-nums outline-none" />
              <span className="text-sm text-muted-foreground">XOF</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[2000, 5000, 10000, 25000, 50000].map((q) => (
                <button key={q} onClick={() => setAmount(q)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs">{q.toLocaleString("fr-FR")}</button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Opérateur</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {operators.map((o) => (
                <button key={o.code} onClick={() => setOperator(o.code)}
                  className={`rounded-xl border p-3 text-left text-sm font-semibold transition-colors ${operator === o.code ? "border-primary bg-primary/5" : "border-border bg-surface-2 hover:bg-muted"}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Numéro Mobile Money</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="70 00 00 00"
                className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" />
            </div>
          </div>

          <button onClick={start} disabled={loading || amount < 500 || !phoneOk}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider le dépôt"}
          </button>
        </>
      )}

      {stage === "otp" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Code de confirmation</label>
          <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={8}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-center font-[Space_Grotesk] text-2xl font-bold tracking-[0.4em] outline-none" />
          <button onClick={confirm} disabled={loading || otp.length < 4}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer le dépôt"}
          </button>
          <button onClick={() => reference && sendDepositOtp({ reference }).then(() => toast.success("Nouveau code envoyé")).catch(() => toast.error("Envoi impossible"))}
            className="w-full text-xs text-primary hover:underline">Renvoyer le code</button>
        </div>
      )}

      {stage === "waiting" && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold">Validez la demande sur votre téléphone</p>
          <p className="mt-1 text-xs text-muted-foreground">Le crédit de votre portefeuille est automatique dès confirmation.</p>
        </div>
      )}
    </div>
  );
}

function WithdrawTab({ balance, profile, onDone }: { balance: number; profile?: any; onDone: () => void }) {
  const [form, setForm] = useState({ amount: 1000, method: "mobile_money" as const, operator: "", phone: profile?.phone ?? "", account: "", holder: profile?.full_name ?? "" });
  const [loading, setLoading] = useState(false);
  const req = useServerFn(requestWithdrawal);
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      phone: prev.phone || profile?.phone || "",
      holder: prev.holder || profile?.full_name || "",
    }));
  }, [profile?.phone, profile?.full_name]);
  async function submit() {
    setLoading(true);
    try {
      const res: any = await req({ data: form });
      if (res?.ok) {
        const st = res?.status;
        if (st === "paid") toast.success("Retrait effectué et envoyé sur votre Mobile Money");
        else if (st === "processing") toast.success("Retrait en cours de traitement");
        else toast.success("Retrait en cours de traitement — vous recevrez une notification dès l'envoi");
        onDone();
      } else toast.error(res?.error ?? "Erreur");
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Retrait d'argent</h1>
      <p className="text-sm text-muted-foreground">Solde XOF disponible : <span className="font-semibold text-foreground tabular-nums">{balance.toLocaleString("fr-FR")} XOF</span></p>
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <Field label="Montant (XOF)"><input type="number" min={500} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" /></Field>
        <div className="rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-sm text-muted-foreground">
          L'opérateur Mobile Money est détecté automatiquement à partir du numéro saisi.
        </div>
        <Field label="Numéro de téléphone Mobile Money"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" /></Field>
        <Field label="Nom du bénéficiaire"><input value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" /></Field>
      </div>
      <button onClick={submit} disabled={loading || form.amount > balance || form.amount < 500 || !form.holder || !form.phone}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retrait automatique"}
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
            <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Référence</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Montant</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucune transaction</td></tr>}
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3">{t.type}</td>
                <td className="px-4 py-3">{t.description}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.provider_ref || "—"}</td>
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

function ProfileTab({ profile, onDone, setTab }: { profile: any; onDone: () => void; setTab: (t: Tab) => void }) {
  const [fullName, setFullName] = useState<string>(profile?.full_name || "");
  const [phone, setPhone] = useState<string>(profile?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const upd = useServerFn(updateMyProfile);
  const updPwd = useServerFn(updateMyPassword);
  const createUrl = useServerFn(createAvatarUploadUrl);
  const getUrl = useServerFn(getAvatarSignedUrl);

  useEffect(() => {
    if (!profile?.avatar_url) return;
    getUrl({ data: { path: profile.avatar_url } })
      .then((r: any) => { if (r?.ok) setAvatarPreview(r.url); })
      .catch(() => { /* silent */ });
  }, [profile?.avatar_url]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Photo trop lourde (max 3 Mo)"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const sig: any = await createUrl({ data: { ext } });
      const up = await fetch(sig.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });
      if (!up.ok) throw new Error("Échec upload");
      setAvatarUrl(sig.path);
      const preview: any = await getUrl({ data: { path: sig.path } });
      if (preview?.ok) setAvatarPreview(preview.url);
      toast.success("Photo prête — cliquez sur Enregistrer");
    } catch (err) { toast.error((err as Error).message); } finally { setUploading(false); }
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await upd({ data: { full_name: fullName, phone, avatar_url: avatarUrl } });
      toast.success("Profil mis à jour");
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setSavingProfile(false); }
  }

  async function savePwd() {
    if (newPwd.length < 6) { toast.error("Mot de passe trop court"); return; }
    setSavingPwd(true);
    try {
      const r: any = await updPwd({ data: { current_password: currentPwd, new_password: newPwd } });
      if (r?.ok === false) throw new Error(r.error || "Échec");
      toast.success("Mot de passe mis à jour");
      setCurrentPwd(""); setNewPwd("");
    } catch (e) { toast.error((e as Error).message); } finally { setSavingPwd(false); }
  }

  const initial = (fullName || profile?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Mon profil</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <button onClick={() => setTab("referrals")} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 transition">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
          <div>
            <div className="text-sm font-semibold">Parrainage</div>
            <div className="text-xs text-muted-foreground">Invitez et gagnez</div>
          </div>
        </button>
        <Link to="/business" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
          <div>
            <div className="text-sm font-semibold">Espace Business</div>
            <div className="text-xs text-muted-foreground">Ma boutique en ligne</div>
          </div>
        </Link>
        <button onClick={() => setTab("tx")} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 transition">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><History className="h-5 w-5" /></span>
          <div>
            <div className="text-sm font-semibold">Historique complet</div>
            <div className="text-xs text-muted-foreground">Toutes mes transactions</div>
          </div>
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-2xl font-bold text-muted-foreground">
            {avatarPreview ? <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" /> : initial}
          </div>
          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-xs font-semibold hover:bg-muted">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCircle className="h-3.5 w-3.5" />}
              Changer la photo
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            <p className="text-[11px] text-muted-foreground">JPG/PNG · 3 Mo max</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <Field label="Nom complet">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" />
          </Field>
          <Field label="Téléphone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" />
          </Field>
          <Info k="Email" v={profile?.email} />
          <Info k="Pays" v={profile?.country} />
        </div>

        <button onClick={saveProfile} disabled={savingProfile}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Changer mon mot de passe</h2>
        <div className="mt-4 grid gap-3">
          <Field label="Mot de passe actuel">
            <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" />
          </Field>
          <Field label="Nouveau mot de passe (6 caractères min)">
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none" />
          </Field>
        </div>
        <button onClick={savePwd} disabled={savingPwd || !currentPwd || newPwd.length < 6}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-5 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
          {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mettre à jour"}
        </button>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: any }) {
  return <div className="flex items-baseline justify-between gap-2"><span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span><span className="text-sm font-medium">{v ?? "—"}</span></div>;
}

function ReferralsTab() {
  const fetchStats = useServerFn(getMyReferralStats);
  const fetchCfg = useServerFn(getPublicConfig);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["referrals-me"], queryFn: () => fetchStats() });
  const cfg = useQuery({ queryKey: ["public-config"], queryFn: () => fetchCfg() });
  const [copied, setCopied] = useState(false);
  const stats: any = data || {};
  const code = stats.code || "";
  const rewardXof = Number((cfg.data as any)?.referral_reward_xof ?? 1000);
  const link = code ? `${window.location.origin}/auth?ref=${encodeURIComponent(code)}` : "";
  const whatsappUrl = (cfg.data as any)?.whatsapp_group_url as string | undefined;
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true); toast.success("Lien copié"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Impossible de copier"); }
  }
  function share() {
    const text = `Rejoins-moi sur FASO-INVEST PAY et obtiens ta carte virtuelle Visa/Mastercard en USD ! Inscris-toi avec mon lien : ${link}`;
    if ((navigator as any).share) (navigator as any).share({ title: "FASO-INVEST PAY", text, url: link }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
  if (isLoading || !data) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Programme de parrainage</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gagnez <b className="text-foreground">{rewardXof.toLocaleString("fr-FR")} XOF</b> chaque fois qu'une personne parrainée achète sa carte.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Filleuls inscrits" value={String(stats.total_referred ?? 0)} />
        <Kpi label="Cartes récompensées" value={String(stats.total_cards_rewarded ?? 0)} />
        <Kpi label="Total gagné" value={`${Number(stats.total_earned_xof ?? 0).toLocaleString("fr-FR")} XOF`} highlight />
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
          <Share2 className="h-3.5 w-3.5" /> Votre lien personnel
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input readOnly value={link || "Génération…"} className="flex-1 truncate rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none" />
          <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-2 text-xs font-semibold hover:bg-muted">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copier
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
            <Share2 className="h-3.5 w-3.5" /> Partager
          </button>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-4 py-2 text-xs font-semibold text-success hover:bg-success/20">
              <MessageCircle className="h-3.5 w-3.5" /> Rejoindre le groupe WhatsApp
            </a>
          )}
          <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-4 py-2 text-xs">
            <Loader2 className="h-3.5 w-3.5" /> Rafraîchir
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Code : <b>{code || "—"}</b></p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Filleul</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Inscrit le</th><th className="px-4 py-3 text-right">Cartes</th><th className="px-4 py-3 text-right">Gains</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(stats.referrals || []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Aucun filleul pour l'instant. Partagez votre lien !</td></tr>
            )}
            {(stats.referrals || []).map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.referred?.full_name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.referred?.email || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.cards_rewarded}</td>
                <td className="px-4 py-3 text-right font-semibold text-success tabular-nums">+{Number(r.total_reward_xof).toLocaleString("fr-FR")} XOF</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? "border-primary/40 bg-gradient-to-br from-primary/10 to-card" : "border-border bg-card"}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-[Space_Grotesk] text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}



function PurchasesTab({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) {
        setLoading(false);
        return;
      }

      const { data } = await supabase.from("shop_orders" as any)
        .select("*, business:businesses(name, logo_url)")
        .eq("customer_email", email)
        .order("created_at", { ascending: false });

      if (data) setOrders(data as any[]);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const labels: Record<string, string> = {
    pending_payment: "En attente",
    paid: "Payée",
    preparing: "Préparation",
    shipped: "Expédiée",
    delivered: "Livrée",
    cancelled: "Annulée",
    refunded: "Remboursée",
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-[Space_Grotesk] text-2xl font-bold">Mes achats</h2>
        <p className="text-sm text-muted-foreground">Historique de vos commandes sur les boutiques du réseau.</p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/20" />
          <p className="mt-4 text-muted-foreground">Vous n'avez pas encore effectué d'achats.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {orders.map((order) => (
            <Link 
              key={order.id} 
              to={`/order/${order.order_token}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                {order.business?.logo_url ? (
                  <img src={order.business.logo_url} className="h-full w-full object-cover" alt="" />
                ) : (
                  <div className="grid h-full w-full place-items-center"><ShoppingBag className="h-5 w-5 text-muted-foreground" /></div>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="truncate font-bold text-sm">{order.business?.name || "Boutique"}</h3>
                <p className="text-xs text-muted-foreground">N° {order.order_number}</p>
                <p className="mt-1 text-xs font-medium text-primary uppercase">{labels[order.status] || order.status}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums">{Number(order.total_amount).toLocaleString("fr-FR")} {order.currency}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;

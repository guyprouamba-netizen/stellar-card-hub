import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Megaphone, Plus, Unplug } from "lucide-react";
import {
  getFacebookIntegration, disconnectFacebook,
  listFacebookCampaigns, createFacebookCampaign,
  startFacebookOAuth, completeFacebookOAuth,
} from "@/lib/marketing.functions";

export default function Marketing() {
  const { businessId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const [integ, setInteg] = useState<any>(null);
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>({ name: "", objective: "OUTCOME_TRAFFIC", daily_budget: "" });

  const load = async () => {
    const [i, c] = await Promise.all([getFacebookIntegration(businessId), listFacebookCampaigns(businessId).catch(() => [])]);
    setInteg(i); setCamps(c); setLoading(false);
  };
  useEffect(() => { load(); }, [businessId]);

  // Callback OAuth
  useEffect(() => {
    const code = params.get("code"); const state = params.get("state"); const fb = params.get("fb");
    if (fb === "callback" && code && state) {
      completeFacebookOAuth(code, state, businessId)
        .then(() => { toast.success("Facebook connecté"); setParams({}); load(); })
        .catch((e) => toast.error(e.message));
    }
  }, [params]);

  const create = async () => {
    if (!form.name) return;
    try {
      await createFacebookCampaign(businessId, { ...form, daily_budget: Number(form.daily_budget) || undefined });
      setForm({ ...form, name: "" }); toast.success("Campagne créée (PAUSED)"); load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link to="/business" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Business
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-glow"><Megaphone className="h-5 w-5" /></div>
          <div>
            <h1 className="font-[Space_Grotesk] text-2xl font-bold">Publicité Facebook</h1>
            <p className="text-xs text-muted-foreground">Connecte ton compte Meta et lance des campagnes directement depuis la plateforme.</p>
          </div>
        </div>

        {loading && <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>}

        {!loading && !integ && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-blue-600" />
            <p className="mt-3 text-sm">Connecte ton compte Meta pour créer et suivre tes campagnes sans quitter la plateforme.</p>
            <button onClick={() => startFacebookOAuth(businessId).catch((e) => toast.error(e.message))}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-glow">
              <Megaphone className="h-4 w-4" /> Se connecter avec Facebook
            </button>
            <p className="mt-4 text-[11px] text-muted-foreground">
              Prérequis : <b>META_APP_ID</b> et <b>META_APP_SECRET</b> configurés dans les secrets ·
              L'app Meta doit être en mode Live avec les permissions <code>ads_management</code>, <code>ads_read</code>, <code>business_management</code>.
            </p>
          </div>
        )}

        {!loading && integ && (
          <>
            <div className="mt-6 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Connecté</p>
                  <p className="mt-1 text-sm">Compte pub : <code className="rounded bg-muted px-1 text-xs">{integ.ad_account_id || "—"}</code></p>
                  <p className="text-sm">Page : {integ.page_name || "—"}</p>
                  {integ.expires_at && <p className="text-[11px] text-muted-foreground">Token expire le {new Date(integ.expires_at).toLocaleDateString("fr-FR")}</p>}
                </div>
                <button onClick={async () => { await disconnectFacebook(businessId); setInteg(null); toast.success("Déconnecté"); }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
                  <Unplug className="h-3 w-3" /> Déconnecter
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Nouvelle campagne</p>
              <div className="grid gap-2 md:grid-cols-3">
                <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <select value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="OUTCOME_TRAFFIC">Trafic</option>
                  <option value="OUTCOME_SALES">Ventes</option>
                  <option value="OUTCOME_LEADS">Leads</option>
                  <option value="OUTCOME_ENGAGEMENT">Engagement</option>
                  <option value="OUTCOME_AWARENESS">Notoriété</option>
                </select>
                <input type="number" placeholder="Budget quotidien (USD)" value={form.daily_budget} onChange={(e) => setForm({ ...form, daily_budget: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <button onClick={create} className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
                <Plus className="h-3.5 w-3.5" /> Créer (en pause)
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground">La campagne est créée en <b>PAUSED</b>. Active-la et complète l'audience/créatifs dans Meta Ads Manager.</p>
            </div>

            <div className="mt-6">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Campagnes</h2>
              <div className="space-y-2">
                {camps.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.objective} · Meta ID {c.meta_campaign_id || "—"}</p>
                    </div>
                    <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase text-primary">{c.status || "—"}</span>
                  </div>
                ))}
                {!camps.length && <p className="text-sm text-muted-foreground">Aucune campagne pour l'instant.</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
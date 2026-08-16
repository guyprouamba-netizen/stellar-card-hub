import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  X, KeyRound, Loader2, Copy, RefreshCw, Webhook, PlayCircle, Image as ImageIcon, Settings2, ShieldCheck, CheckCircle2, XCircle,
  Activity, Clock, TrendingUp, ArrowDownToLine,
} from "lucide-react";
import {
  updateProject, getProjectIntegration, createProjectApiKeys, updateProjectWebhook,
  simulateProjectWebhook, getProjectTransactions,
} from "@/lib/business.functions";
import { uploadBusinessMedia } from "@/lib/upload";

type Project = { id: string; name: string; description?: string | null; logo_url: string | null; cover_url: string | null; currency: string };
type KeyRow = {
  id: string; mode: string; public_key: string; secret_prefix: string;
  webhook_url: string | null; webhook_secret: string; created_at: string;
};
type Delivery = { id: string; event: string; status_code: number | null; success: boolean; simulated: boolean; error: string | null; created_at: string; response_body: string | null };
type Txn = {
  id: string; reference: string; amount: number; net_amount: number | null; fee_amount: number | null;
  currency: string; status: string; customer_name: string | null; customer_email: string | null;
  paid_at: string | null; created_at: string;
};
type Stats = {
  balance: number; currency: string; collected: number; fees: number; withdrawn: number;
  success_amount: number; pending_amount: number; failed_amount: number;
  success_count: number; pending_count: number; failed_count: number;
};

export default function ProjectConfigSheet({ project, onClose, onSaved }: {
  project: Project; onClose: () => void; onSaved: () => void;
}) {
  const [tab, setTab] = useState<"settings" | "api" | "txns">("settings");
  const [form, setForm] = useState({
    name: project.name, description: project.description || "",
    logo_url: project.logo_url || "", cover_url: project.cover_url || "", currency: project.currency || "XOF",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);

  const [loadingApi, setLoadingApi] = useState(true);
  const [keyRow, setKeyRow] = useState<KeyRow | null>(null);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [endpoint, setEndpoint] = useState("");
  const [fee, setFee] = useState<{ fee_bps: number; fee_flat_xof: number; min_xof: number; enabled: boolean } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingTx, setLoadingTx] = useState(false);

  async function loadApi() {
    try {
      const r: any = await getProjectIntegration(project.id);
      setKeyRow(r.key); setDeliveries(r.deliveries || []); setEndpoint(r.endpoint); setFee(r.fee);
      setWebhookUrl(r.key?.webhook_url || "");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingApi(false); }
  }
  useEffect(() => { loadApi(); /* eslint-disable-next-line */ }, [project.id]);

  async function loadTxns() {
    setLoadingTx(true);
    try {
      const r: any = await getProjectTransactions(project.id);
      setTxns(r.transactions || []); setStats(r.stats || null);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingTx(false); }
  }
  useEffect(() => {
    if (tab !== "txns") return;
    loadTxns();
    const t = setInterval(loadTxns, 15000); // lecture temps réel des transactions
    return () => clearInterval(t);
    /* eslint-disable-next-line */
  }, [tab, project.id]);

  function copy(v: string) { navigator.clipboard.writeText(v); toast.success("Copié ✅"); }

  async function onUpload(kind: "logo" | "cover", file: File) {
    setUploading(kind);
    try {
      const url = await uploadBusinessMedia(file, `projects/${kind}`);
      setForm((f) => ({ ...f, [`${kind}_url`]: url }));
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(null); }
  }

  async function onSaveSettings() {
    setSaving(true);
    try {
      await updateProject({
        id: project.id, name: form.name.trim(), description: form.description || null,
        logo_url: form.logo_url || null, cover_url: form.cover_url || null, currency: form.currency,
      });
      toast.success("Projet mis à jour ✅");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function onGenerate() {
    if (keyRow && !confirm("Régénérer les clés ? Les anciennes seront immédiatement révoquées.")) return;
    setBusy("gen");
    try {
      const r: any = await createProjectApiKeys({ project_id: project.id, webhook_url: webhookUrl || undefined });
      setKeyRow(r); setSecretOnce(r.secret_key);
      toast.success("Clés générées ✅ Copiez la clé secrète, elle ne sera plus affichée.");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function onSaveWebhook() {
    if (!keyRow) { toast.error("Générez d'abord les clés API"); return; }
    setBusy("hook");
    try {
      const r: any = await updateProjectWebhook({ id: keyRow.id, webhook_url: webhookUrl || null });
      setKeyRow((k) => k ? { ...k, webhook_url: r.webhook_url } : k);
      toast.success("Webhook enregistré ✅");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function onSimulate(event: string) {
    setBusy("sim");
    try {
      const r: any = await simulateProjectWebhook({ project_id: project.id, event, amount: 1000 });
      if (r.ok) toast.success(`Webhook reçu par votre serveur (HTTP ${r.status_code}) ✅`);
      else toast.error(`Échec : ${r.error || "HTTP " + r.status_code}`);
      loadApi();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  const field = "w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/70 backdrop-blur" onClick={onClose} />
      <div className="relative flex h-full w-full flex-col overflow-y-auto bg-card p-6 shadow-card-premium sm:w-[560px]">
        <div className="flex items-center justify-between">
          <h2 className="font-[Space_Grotesk] text-xl font-bold">Configurer « {project.name} »</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 flex gap-2">
          {([["settings", "Réglages", Settings2], ["api", "Clés API & Webhook", KeyRound], ["txns", "Transactions", Activity]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${tab === id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === "settings" && (
          <div className="mt-5 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border">
              {form.cover_url
                ? <img src={form.cover_url} alt="" className="h-32 w-full object-cover" />
                : <div className="h-32 w-full bg-gradient-primary opacity-30" />}
              <div className="flex items-center gap-3 p-3">
                {form.logo_url
                  ? <img src={form.logo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  : <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-lg font-bold">{form.name[0] || "P"}</div>}
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted">
                    {uploading === "logo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />} Logo
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload("logo", f); e.target.value = ""; }} />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted">
                    {uploading === "cover" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />} Couverture
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload("cover", f); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            </div>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nom du projet" className={field} />
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Description" className={field} />
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={field}>
              <option value="XOF">XOF</option>
              <option value="USD">USD</option>
            </select>
            <button onClick={onSaveSettings} disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
            </button>
          </div>
        )}

        {tab === "api" && (
          loadingApi ? <div className="grid flex-1 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
          <div className="mt-5 space-y-5">
            {fee && (
              <div className="rounded-2xl border border-border bg-surface-2 p-4 text-xs">
                <p className="inline-flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-3.5 w-3.5" /> Frais passerelle</p>
                <p className="mt-1 text-muted-foreground">
                  {(fee.fee_bps / 100).toFixed(2)} % {fee.fee_flat_xof > 0 && `+ ${fee.fee_flat_xof} XOF`} par transaction · minimum {fee.min_xof} XOF
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold"><KeyRound className="h-4 w-4" /> Clés du projet</p>
                <button onClick={onGenerate} disabled={busy === "gen"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">
                  {busy === "gen" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} {keyRow ? "Régénérer" : "Générer"}
                </button>
              </div>
              {!keyRow ? (
                <p className="mt-3 text-xs text-muted-foreground">Générez une paire de clés pour connecter votre site à la passerelle de paiement.</p>
              ) : (
                <div className="mt-3 space-y-2 text-xs">
                  <Row label="Clé publique" value={keyRow.public_key} onCopy={copy} />
                  <Row label="Clé secrète" value={secretOnce || `${keyRow.secret_prefix}••••••••••••`} onCopy={secretOnce ? copy : undefined} />
                  {secretOnce && <p className="text-[11px] text-amber-500">⚠️ Copiez la clé secrète maintenant : elle ne sera plus jamais affichée.</p>}
                  <Row label="Secret de signature" value={keyRow.webhook_secret} onCopy={copy} />
                  <Row label="Endpoint API" value={endpoint} onCopy={copy} />
                  <div className="rounded-xl border border-border bg-surface-2 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Créer une session de paiement</p>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed">{`POST ${endpoint}/checkout/sessions
Authorization: Bearer VOTRE_CLE_SECRETE
Content-Type: application/json
{"amount":1000,"currency":"XOF","description":"Commande #123","customer_email":"client@mail.com","return_url":"https://votre-site.com/merci"}`}</pre>
                    <p className="mt-2 text-[10px] text-muted-foreground">Test de la clé : <code>GET {endpoint}/ping</code> · Statut : <code>GET {endpoint}/payments/&#123;reference&#125;</code></p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold"><Webhook className="h-4 w-4" /> URL de notification (webhook)</p>
              
              <div className="mt-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">URL à insérer dans YengaPay (Projet 31062)</p>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-xs">
                  <span className="flex-1 truncate font-mono">{`${window.location.origin.replace("lovable.app", "supabase.co")}/functions/v1/yengapay-webhook`}</span>
                  <button onClick={() => copy(`${window.location.origin.replace("lovable.app", "supabase.co")}/functions/v1/yengapay-webhook`)} className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Votre URL de retour (Marchand)</p>
                <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://votre-site.com/webhooks/paiement" className={`${field} mt-1`} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Chaque notification est signée : en-tête <code>X-FIP-Signature: t=…,v1=HMAC_SHA256(t + "." + corps, secret)</code>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={onSaveWebhook} disabled={busy === "hook"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
                  {busy === "hook" && <Loader2 className="h-3 w-3 animate-spin" />} Enregistrer
                </button>
                <button onClick={() => onSimulate("payment.succeeded")} disabled={busy === "sim" || !keyRow}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">
                  {busy === "sim" ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />} Simuler un paiement réussi
                </button>
                <button onClick={() => onSimulate("payment.failed")} disabled={busy === "sim" || !keyRow}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">
                  <PlayCircle className="h-3 w-3" /> Simuler un échec
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold">Journal des notifications</p>
              {deliveries.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Aucun envoi pour l'instant. Lancez une simulation pour tester la communication.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {deliveries.map((d) => (
                    <li key={d.id} className="rounded-xl border border-border bg-surface-2 p-3 text-[11px]">
                      <div className="flex items-center gap-2">
                        {d.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                        <span className="font-semibold">{d.event}</span>
                        {d.simulated && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">test</span>}
                        <span className="ml-auto text-muted-foreground">{new Date(d.created_at).toLocaleString("fr-FR")}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {d.status_code ? `HTTP ${d.status_code}` : ""} {d.error || ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          )
        )}

        {tab === "txns" && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Solde du projet", value: stats?.balance ?? 0, icon: TrendingUp },
                { label: "Encaissé (net)", value: stats?.collected ?? 0, icon: CheckCircle2 },
                { label: "Retiré", value: stats?.withdrawn ?? 0, icon: ArrowDownToLine },
                { label: "En attente", value: stats?.pending_amount ?? 0, icon: Clock },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
                  <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <s.icon className="h-3 w-3" /> {s.label}
                  </p>
                  <p className="mt-1 font-[Space_Grotesk] text-base font-bold tabular-nums">
                    {Number(s.value).toLocaleString("fr-FR")} <span className="text-[10px] text-muted-foreground">{stats?.currency || "XOF"}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-emerald-500">
                <p className="font-bold">{stats?.success_count ?? 0}</p><p>Réussis</p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-amber-500">
                <p className="font-bold">{stats?.pending_count ?? 0}</p><p>En attente</p>
              </div>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 py-2 text-destructive">
                <p className="font-bold">{stats?.failed_count ?? 0}</p><p>Échoués</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Transactions</p>
                <button onClick={loadTxns} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-semibold hover:bg-muted">
                  {loadingTx ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Actualiser
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Chaque transaction apparaît dès l'ouverture de la page de paiement, puis se met à jour automatiquement.</p>
              {txns.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">Aucune transaction pour ce projet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {txns.map((t) => (
                    <li key={t.id} className="rounded-xl border border-border bg-surface-2 p-3 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${
                          t.status === "success" ? "bg-emerald-500/15 text-emerald-500"
                          : t.status === "failed" ? "bg-destructive/15 text-destructive"
                          : "bg-amber-500/15 text-amber-500"}`}>
                          {t.status === "success" ? "Réussi" : t.status === "failed" ? "Échoué" : "En attente"}
                        </span>
                        <span className="font-mono">{t.reference}</span>
                        <span className="ml-auto font-bold tabular-nums">{Number(t.amount).toLocaleString("fr-FR")} {t.currency}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {t.customer_name || t.customer_email || "Client"} · {new Date(t.created_at).toLocaleString("fr-FR")}
                        {t.status === "success" && t.net_amount != null && ` · net ${Number(t.net_amount).toLocaleString("fr-FR")} ${t.currency}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-[11px]">{value}</p>
      </div>
      {onCopy && (
        <button onClick={() => onCopy(value)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border hover:bg-muted">
          <Copy className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, Send, Trash2, Plus, MessageSquare, ShieldAlert, Users, ScrollText, Wallet, RefreshCw } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import {
  smsGetConfig, smsUpdateConfig, smsUpdateTemplate,
  smsListContacts, smsAddContact, smsDeleteContact,
  smsSendCustom, smsSendTest, smsListLogs, smsGetBalance,
} from "@/lib/sms.functions";

export default function SmsAdmin() {
  const qc = useQueryClient();
  const cfgQ = useQuery({ queryKey: ["sms-config"], queryFn: smsGetConfig });
  const contactsQ = useQuery({ queryKey: ["sms-contacts"], queryFn: smsListContacts });
  const logsQ = useQuery({ queryKey: ["sms-logs"], queryFn: () => smsListLogs(50), refetchInterval: 15000 });
  const balanceQ = useQuery({ queryKey: ["sms-balance"], queryFn: smsGetBalance, refetchOnWindowFocus: false });

  const [cfg, setCfg] = useState<any>(null);
  const [adminPhonesText, setAdminPhonesText] = useState("");
  useEffect(() => {
    if (cfgQ.data?.config) {
      setCfg(cfgQ.data.config);
      setAdminPhonesText((cfgQ.data.config.admin_phones || []).join(", "));
    }
  }, [cfgQ.data]);

  const saveCfg = useMutation({
    mutationFn: async () => {
      const phones = adminPhonesText.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
      return smsUpdateConfig({ ...cfg, admin_phones: phones });
    },
    onSuccess: () => { toast.success("Configuration enregistrée"); qc.invalidateQueries({ queryKey: ["sms-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTpl = useMutation({
    mutationFn: (t: any) => smsUpdateTemplate({ id: t.id, body: t.body, enabled: t.enabled, label: t.label }),
    onSuccess: () => { toast.success("Modèle mis à jour"); qc.invalidateQueries({ queryKey: ["sms-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const sendTest = useMutation({
    mutationFn: () => smsSendTest({ phone: testPhone, message: testMsg || undefined }),
    onSuccess: (r: any) => { r?.ok ? toast.success("Test envoyé") : toast.error("Échec envoi"); qc.invalidateQueries({ queryKey: ["sms-logs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [customRecipients, setCustomRecipients] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const sendCustom = useMutation({
    mutationFn: () => smsSendCustom({ recipients: customRecipients, message: customMsg }),
    onSuccess: (r: any) => { r?.ok ? toast.success("Message envoyé") : toast.error("Échec envoi"); qc.invalidateQueries({ queryKey: ["sms-logs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newContactLabel, setNewContactLabel] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const addContact = useMutation({
    mutationFn: () => smsAddContact({ label: newContactLabel, phone: newContactPhone }),
    onSuccess: () => { setNewContactLabel(""); setNewContactPhone(""); qc.invalidateQueries({ queryKey: ["sms-contacts"] }); toast.success("Contact ajouté"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delContact = useMutation({
    mutationFn: (id: string) => smsDeleteContact(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sms-contacts"] }),
  });

  if (cfgQ.error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteNav />
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <BackButton to="/admin" className="mb-4" />
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
            <ShieldAlert className="mb-2 h-5 w-5" />
            <p className="font-semibold">Impossible de charger la configuration SMS</p>
            <p className="mt-1 text-xs opacity-80">{(cfgQ.error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (cfgQ.isLoading || !cfg) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteNav />
        <div className="container mx-auto grid min-h-[60vh] place-items-center px-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <BackButton to="/admin" className="mb-4" />
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground"><MessageSquare className="h-5 w-5" /></span>
          <div>
            <h1 className="font-[Space_Grotesk] text-2xl font-bold sm:text-3xl">Notifications SMS</h1>
            <p className="text-sm text-muted-foreground">BBG SMS — modèles, admins, envois manuels et historique</p>
          </div>
        </div>

        {/* SOLDE SMS */}
        <section className="mb-6 rounded-3xl border border-border bg-gradient-card p-5 text-white shadow-card-premium">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Wallet className="h-4 w-4" /></span>
              <div>
                <p className="text-xs uppercase tracking-widest opacity-70">Solde BBG SMS</p>
                {balanceQ.isLoading ? (
                  <p className="mt-1 text-sm opacity-70">Interrogation…</p>
                ) : balanceQ.data?.ok ? (
                  <p className="mt-0.5 font-[Space_Grotesk] text-2xl font-bold tabular-nums">
                    {formatBalance(balanceQ.data.response)}
                  </p>
                ) : (
                  <p className="mt-1 max-w-md text-xs opacity-80">
                    Endpoint solde non exposé publiquement par BBG. Consultez votre tableau de bord BBG SMS pour le solde exact.
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => balanceQ.refetch()} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">
              <RefreshCw className={`h-3 w-3 ${balanceQ.isFetching ? "animate-spin" : ""}`} /> Rafraîchir
            </button>
          </div>
          {balanceQ.data?.ok && balanceQ.data.response && (
            <details className="mt-3 text-xs opacity-80">
              <summary className="cursor-pointer">Détails bruts</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/30 p-2 text-[10px]">{JSON.stringify(balanceQ.data.response, null, 2)}</pre>
            </details>
          )}
        </section>

        {/* CONFIG GLOBALE */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="mb-4 text-lg font-semibold">Configuration globale</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 p-4">
              <div>
                <p className="text-sm font-medium">SMS activés</p>
                <p className="text-xs text-muted-foreground">Coupez ici pour désactiver tous les envois</p>
              </div>
              <input type="checkbox" className="h-5 w-9 accent-primary" checked={!!cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 p-4">
              <div>
                <p className="text-sm font-medium">Notifier les admins</p>
                <p className="text-xs text-muted-foreground">Copie SMS vers les numéros admin</p>
              </div>
              <input type="checkbox" className="h-5 w-9 accent-primary" checked={!!cfg.notify_admin} onChange={(e) => setCfg({ ...cfg, notify_admin: e.target.checked })} />
            </label>
            <label className="col-span-full">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sender ID (max 11 car.)</p>
              <input maxLength={11} value={cfg.sender_id || ""} onChange={(e) => setCfg({ ...cfg, sender_id: e.target.value })} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <label className="col-span-full">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Numéros des admins (séparés par virgule)</p>
              <textarea rows={2} value={adminPhonesText} onChange={(e) => setAdminPhonesText(e.target.value)} placeholder="22670000000, 22660000000" className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary" />
              <p className="mt-1 text-xs text-muted-foreground">Format international sans "+". Ex: 22670XXXXXX</p>
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { k: "event_wallet_recharge", label: "Recharge du portefeuille" },
              { k: "event_card_recharge", label: "Recharge de carte USD" },
              { k: "event_withdrawal", label: "Demande de retrait" },
              { k: "event_withdrawal_paid", label: "Retrait payé" },
              { k: "event_sender_request", label: "Demande de Sender ID (Admin)" },
            ].map((ev) => (
              <label key={ev.k} className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 p-3">
                <span className="text-sm">{ev.label}</span>
                <input type="checkbox" className="h-4 w-8 accent-primary" checked={!!cfg[ev.k]} onChange={(e) => setCfg({ ...cfg, [ev.k]: e.target.checked })} />
              </label>
            ))}
          </div>

          <button onClick={() => saveCfg.mutate()} disabled={saveCfg.isPending} className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {saveCfg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </section>

        {/* TEMPLATES */}
        <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="mb-1 text-lg font-semibold">Modèles de messages</h2>
          <p className="mb-4 text-xs text-muted-foreground">Variables disponibles : <code>{"{name}"}</code>, <code>{"{amount}"}</code>, <code>{"{currency}"}</code>, <code>{"{balance}"}</code></p>
          <div className="space-y-3">
            {(cfgQ.data?.templates || []).map((t: any) => (
              <TemplateRow key={t.id} tpl={t} onSave={(patch) => saveTpl.mutate({ ...t, ...patch })} saving={saveTpl.isPending} />
            ))}
          </div>
        </section>

        {/* TEST + ENVOI CUSTOM */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h2 className="mb-3 text-lg font-semibold">Envoi de test</h2>
            <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="22670000000" className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm" />
            <textarea rows={2} value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="Message de test (optionnel)" className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm" />
            <button onClick={() => sendTest.mutate()} disabled={sendTest.isPending || !testPhone} className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">
              {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer test
            </button>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h2 className="mb-3 text-lg font-semibold">Message personnalisé</h2>
            <textarea rows={2} value={customRecipients} onChange={(e) => setCustomRecipients(e.target.value)} placeholder="Destinataires (virgule) ou coller depuis contacts" className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm" />
            {(contactsQ.data?.contacts || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {contactsQ.data!.contacts.map((c: any) => (
                  <button key={c.id} onClick={() => setCustomRecipients((prev) => prev ? `${prev}, ${c.phone}` : c.phone)} className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs hover:bg-muted">
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            <textarea rows={3} value={customMsg} onChange={(e) => setCustomMsg(e.target.value)} placeholder="Votre message..." className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm" />
            <button onClick={() => sendCustom.mutate()} disabled={sendCustom.isPending || !customRecipients || !customMsg} className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
              {sendCustom.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
            </button>
          </div>
        </section>

        {/* CONTACTS */}
        <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4" /><h2 className="text-lg font-semibold">Carnet de contacts</h2></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={newContactLabel} onChange={(e) => setNewContactLabel(e.target.value)} placeholder="Nom" className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm" />
            <input value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} placeholder="Numéro (226…)" className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm" />
            <button onClick={() => addContact.mutate()} disabled={!newContactPhone || addContact.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {(contactsQ.data?.contacts || []).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div><span className="font-medium">{c.label}</span> <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span></div>
                <button onClick={() => delContact.mutate(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {!contactsQ.data?.contacts?.length && <li className="py-3 text-xs text-muted-foreground">Aucun contact enregistré</li>}
          </ul>
        </section>

        {/* LOGS */}
        <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-3 flex items-center gap-2"><ScrollText className="h-4 w-4" /><h2 className="text-lg font-semibold">Historique</h2></div>
          <ul className="divide-y divide-border">
            {(logsQ.data?.logs || []).map((l: any) => (
              <li key={l.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${l.status === "success" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{l.status}</span>
                    <span className="ml-2 font-medium">{l.event_key || "custom"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">→ {l.recipient}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("fr-FR")}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{l.message}</p>
                {l.error && <p className="text-xs text-destructive">{l.error}</p>}
              </li>
            ))}
            {!logsQ.data?.logs?.length && <li className="py-3 text-xs text-muted-foreground">Aucun envoi pour le moment</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function formatBalance(resp: any): string {
  if (!resp || typeof resp !== "object") return String(resp ?? "—");
  // Essaie plusieurs champs courants
  const cand = resp.balance ?? resp.credit ?? resp.credits ?? resp.data?.balance ?? resp.data?.credit ?? resp.wallet?.balance;
  if (cand !== undefined && cand !== null) return `${Number(cand).toLocaleString("fr-FR")} SMS`;
  return "—";
}

function TemplateRow({ tpl, onSave, saving }: { tpl: any; onSave: (patch: any) => void; saving: boolean }) {
  const [body, setBody] = useState(tpl.body);
  const [enabled, setEnabled] = useState(!!tpl.enabled);
  useEffect(() => { setBody(tpl.body); setEnabled(!!tpl.enabled); }, [tpl.id]);
  const dirty = body !== tpl.body || enabled !== tpl.enabled;
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-3">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{tpl.label}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{tpl.event_key}</p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="h-4 w-8 accent-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Actif
        </label>
      </div>
      <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{body.length} car.</span>
        <button disabled={!dirty || saving} onClick={() => onSave({ body, enabled })} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary disabled:opacity-40">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Enregistrer
        </button>
      </div>
    </div>
  );
}
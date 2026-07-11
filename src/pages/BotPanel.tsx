import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Bot, Settings2, Users, ShieldAlert, MessageSquare,
  ListChecks, ScrollText, Save, Send, HandMetal, Trash2, Plus,
} from "lucide-react";
import {
  getBotConfig, updateBotConfig,
  listBotGroups, updateBotGroup,
  listBotWarnings, listBotLogs,
  listBotFaq, upsertBotFaq, deleteBotFaq,
  listBotConversations, getBotConversation, toggleBotHandoff, sendBotHumanReply,
} from "@/lib/bot.functions";

type Tab = "config" | "groups" | "warnings" | "faq" | "conv" | "logs";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "config", label: "Config", icon: Settings2 },
  { id: "groups", label: "Groupes", icon: Users },
  { id: "warnings", label: "Avertissements", icon: ShieldAlert },
  { id: "faq", label: "FAQ IA", icon: ListChecks },
  { id: "conv", label: "Conversations", icon: MessageSquare },
  { id: "logs", label: "Logs", icon: ScrollText },
];

export default function BotPanel() {
  const { businessId = "" } = useParams();
  const [tab, setTab] = useState<Tab>("config");
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBotConfig(businessId).then(setCfg).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [businessId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link to="/business" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Business
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-[Space_Grotesk] text-2xl font-bold">Bot WhatsApp intelligent</h1>
            <p className="text-xs text-muted-foreground">Modération, IA conversationnelle et menus 100 % automatisés.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-t-xl border-b-2 px-4 py-2 text-xs font-semibold ${tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!loading && !cfg && (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucune session WhatsApp. Génère un worker Chat PAY d'abord depuis <Link to="/business" className="text-primary underline">Business</Link>.
            </div>
          )}
          {!loading && cfg && tab === "config" && <ConfigTab cfg={cfg} setCfg={setCfg} businessId={businessId} />}
          {!loading && cfg && tab === "groups" && <GroupsTab businessId={businessId} />}
          {!loading && cfg && tab === "warnings" && <WarningsTab businessId={businessId} />}
          {!loading && cfg && tab === "faq" && <FaqTab businessId={businessId} />}
          {!loading && cfg && tab === "conv" && <ConvTab businessId={businessId} />}
          {!loading && cfg && tab === "logs" && <LogsTab businessId={businessId} />}
        </div>
      </div>
    </div>
  );
}

/* ------------ CONFIG ------------ */
function Row({ label, hint, children }: any) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`h-6 w-11 rounded-full transition-colors ${value ? "bg-emerald-500" : "bg-muted"}`}>
      <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}
function NumInput({ value, onChange, min = 0, max = 999 }: any) {
  return <input type="number" value={value ?? 0} min={min} max={max}
    onChange={(e) => onChange(Number(e.target.value))}
    className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-right" />;
}
function TextArea(props: any) {
  return <textarea rows={3} {...props} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />;
}
function TextInput(props: any) {
  return <input {...props} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />;
}

function ConfigTab({ cfg, setCfg, businessId }: any) {
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setCfg((c: any) => ({ ...c, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const patch: any = { ...cfg };
      if (Array.isArray(patch.link_whitelist)) patch.link_whitelist = patch.link_whitelist.join(",");
      const r = await updateBotConfig(businessId, patch);
      setCfg(r); toast.success("Configuration enregistrée");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Modération</h3>
        <Row label="Suppression des liens" hint="Supprime URLs, wa.me, chat.whatsapp.com…"><Toggle value={cfg.link_removal} onChange={(v) => set("link_removal", v)} /></Row>
        <Row label="Whitelist" hint="Domaines autorisés (séparés par virgule)">
          <TextInput value={Array.isArray(cfg.link_whitelist) ? cfg.link_whitelist.join(", ") : cfg.link_whitelist}
            onChange={(e: any) => set("link_whitelist", e.target.value.split(/[,\s]+/).map((s: string) => s.trim()).filter(Boolean))} />
        </Row>
        <Row label="Avertissements"><Toggle value={cfg.warnings_enabled} onChange={(v) => set("warnings_enabled", v)} /></Row>
        <Row label="Seuil de ban" hint="Bannissement après N avertissements"><NumInput value={cfg.warnings_threshold} onChange={(v: number) => set("warnings_threshold", v)} min={1} max={20} /></Row>
        <Row label="Expiration (jours)"><NumInput value={cfg.warning_expire_days} onChange={(v: number) => set("warning_expire_days", v)} min={1} max={90} /></Row>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Appels</h3>
        <Row label="Rejeter les appels"><Toggle value={cfg.reject_calls} onChange={(v) => set("reject_calls", v)} /></Row>
        <Row label="Seuil spam" hint="Nb d'appels dans la fenêtre"><NumInput value={cfg.call_spam_threshold} onChange={(v: number) => set("call_spam_threshold", v)} /></Row>
        <Row label="Fenêtre (minutes)"><NumInput value={cfg.call_spam_window_min} onChange={(v: number) => set("call_spam_window_min", v)} /></Row>
        <Row label="Durée blocage (heures)"><NumInput value={cfg.call_block_hours} onChange={(v: number) => set("call_block_hours", v)} /></Row>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Comportement humain</h3>
        <Row label="Mode humain" hint="Délais aléatoires + frappe simulée"><Toggle value={cfg.human_mode} onChange={(v) => set("human_mode", v)} /></Row>
        <Row label="Délai min (ms)"><NumInput value={cfg.human_min_ms} onChange={(v: number) => set("human_min_ms", v)} max={30000} /></Row>
        <Row label="Délai max (ms)"><NumInput value={cfg.human_max_ms} onChange={(v: number) => set("human_max_ms", v)} max={60000} /></Row>
        <Row label="Mode nuit" hint="Ralentit hors horaires"><Toggle value={cfg.night_mode} onChange={(v) => set("night_mode", v)} /></Row>
        <Row label="Nuit — début (h)"><NumInput value={cfg.night_start_hour} onChange={(v: number) => set("night_start_hour", v)} max={23} /></Row>
        <Row label="Nuit — fin (h)"><NumInput value={cfg.night_end_hour} onChange={(v: number) => set("night_end_hour", v)} max={23} /></Row>
        <Row label="Actions/min"><NumInput value={cfg.rate_per_minute} onChange={(v: number) => set("rate_per_minute", v)} /></Row>
        <Row label="Actions/heure"><NumInput value={cfg.rate_per_hour} onChange={(v: number) => set("rate_per_hour", v)} max={5000} /></Row>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Bienvenue & IA</h3>
        <Row label="Message de bienvenue"><Toggle value={cfg.welcome_enabled} onChange={(v) => set("welcome_enabled", v)} /></Row>
        <div className="py-2"><TextArea value={cfg.welcome_message} onChange={(e: any) => set("welcome_message", e.target.value)} /></div>
        <Row label="Agent IA (DM)" hint="Répond auto aux messages privés"><Toggle value={cfg.ai_enabled} onChange={(v) => set("ai_enabled", v)} /></Row>
        <Row label="DM uniquement"><Toggle value={cfg.ai_dm_only} onChange={(v) => set("ai_dm_only", v)} /></Row>
        <div className="py-2">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Persona / ton</p>
          <TextArea value={cfg.ai_persona} onChange={(e: any) => set("ai_persona", e.target.value)} />
        </div>
        <Row label="Langue">
          <TextInput value={cfg.ai_language} onChange={(e: any) => set("ai_language", e.target.value)} />
        </Row>
      </section>
      <div className="md:col-span-2">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

/* ------------ GROUPS ------------ */
function GroupsTab({ businessId }: any) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listBotGroups(businessId).then(setRows); }, [businessId]);
  const upd = async (g: any, patch: any) => {
    const r = await updateBotGroup(businessId, g.id, patch);
    setRows((rs) => rs.map((x) => x.id === g.id ? r : x));
  };
  if (!rows.length) return <p className="text-sm text-muted-foreground">Aucun groupe détecté. Ajoute le bot dans un groupe puis envoie un message.</p>;
  return (
    <div className="space-y-3">
      {rows.map((g) => (
        <div key={g.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{g.name || g.group_jid}</p>
              <p className="text-[11px] font-mono text-muted-foreground">{g.group_jid}{g.member_count ? ` · ${g.member_count} membres` : ""}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs">
              Actif <Toggle value={g.active} onChange={(v) => upd(g, { active: v })} />
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs">Liens: {g.link_removal_override === false ? "OFF" : g.link_removal_override === true ? "ON" : "défaut"}
              <select className="rounded bg-background px-2 py-1" value={String(g.link_removal_override)} onChange={(e) => upd(g, { link_removal_override: e.target.value === "null" ? null : e.target.value === "true" })}>
                <option value="null">défaut</option><option value="true">ON</option><option value="false">OFF</option>
              </select>
            </label>
            <label className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs">Bienvenue: {g.welcome_enabled_override === false ? "OFF" : g.welcome_enabled_override === true ? "ON" : "défaut"}
              <select className="rounded bg-background px-2 py-1" value={String(g.welcome_enabled_override)} onChange={(e) => upd(g, { welcome_enabled_override: e.target.value === "null" ? null : e.target.value === "true" })}>
                <option value="null">défaut</option><option value="true">ON</option><option value="false">OFF</option>
              </select>
            </label>
          </div>
          <TextArea placeholder="Message de bienvenue custom (utilise {{name}})" value={g.welcome_message || ""}
            onChange={(e: any) => upd(g, { welcome_message: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

/* ------------ WARNINGS ------------ */
function WarningsTab({ businessId }: any) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listBotWarnings(businessId).then(setRows); }, [businessId]);
  if (!rows.length) return <p className="text-sm text-muted-foreground">Aucun avertissement.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs uppercase text-muted-foreground"><tr>
          <th className="p-3 text-left">Utilisateur</th><th className="p-3 text-left">Groupe</th>
          <th className="p-3">Count</th><th className="p-3">Raison</th><th className="p-3">Statut</th><th className="p-3">Dernier</th>
        </tr></thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id} className="border-t border-border">
              <td className="p-3 font-mono text-xs">{w.user_jid}</td>
              <td className="p-3 font-mono text-[11px]">{w.group_jid}</td>
              <td className="p-3 text-center font-bold">{w.count}</td>
              <td className="p-3 text-xs text-muted-foreground">{w.reason || "—"}</td>
              <td className="p-3">{w.banned_at ? <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-500">BANNI</span> : <span className="text-xs">actif</span>}</td>
              <td className="p-3 text-[11px] text-muted-foreground">{new Date(w.last_at).toLocaleString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------ FAQ ------------ */
function FaqTab({ businessId }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState(""); const [a, setA] = useState("");
  const load = () => listBotFaq(businessId).then(setRows);
  useEffect(() => { load(); }, [businessId]);
  const add = async () => {
    if (!q.trim() || !a.trim()) return;
    await upsertBotFaq(businessId, { question: q, answer: a });
    setQ(""); setA(""); load(); toast.success("Ajouté");
  };
  const del = async (id: string) => { await deleteBotFaq(id); load(); };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Nouvelle Q/R</p>
        <TextInput placeholder="Question client (ex: Vos horaires ?)" value={q} onChange={(e: any) => setQ(e.target.value)} />
        <div className="mt-2"><TextArea placeholder="Réponse à donner par l'IA" value={a} onChange={(e: any) => setA(e.target.value)} /></div>
        <button onClick={add} className="mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((f) => (
          <div key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div>
              <p className="text-sm font-semibold">{f.question}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.answer}</p>
            </div>
            <button onClick={() => del(f.id)} className="rounded-full p-2 text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">Aucune Q/R personnalisée. L'IA utilisera les infos du business (produits, contact).</p>}
      </div>
    </div>
  );
}

/* ------------ CONV ------------ */
function ConvTab({ businessId }: any) {
  const [convs, setConvs] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => { listBotConversations(businessId).then(setConvs); }, [businessId]);
  const open = async (c: any) => {
    setSel(c);
    const d = await getBotConversation(businessId, c.id); setDetail(d);
  };
  const doHandoff = async () => {
    const r = await toggleBotHandoff(businessId, sel.id); setSel(r);
    setConvs((cs) => cs.map((x) => x.id === r.id ? r : x));
  };
  const doSend = async () => {
    if (!draft.trim()) return;
    await sendBotHumanReply(businessId, sel.id, draft);
    setDraft(""); await open(sel); toast.success("Envoyé");
  };
  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div className="max-h-[600px] space-y-1 overflow-y-auto rounded-2xl border border-border bg-card p-2">
        {convs.map((c) => (
          <button key={c.id} onClick={() => open(c)}
            className={`w-full rounded-xl px-3 py-2 text-left text-xs ${sel?.id === c.id ? "bg-primary/10" : "hover:bg-muted"}`}>
            <p className="font-semibold">{c.contact_name || c.contact_jid.split("@")[0]}</p>
            <p className="text-[10px] text-muted-foreground">{new Date(c.last_message_at).toLocaleString("fr-FR")}</p>
            {c.handoff && <span className="mt-1 inline-block rounded bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-500">HANDOFF</span>}
          </button>
        ))}
        {!convs.length && <p className="p-3 text-xs text-muted-foreground">Aucune conversation.</p>}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        {!sel && <p className="text-sm text-muted-foreground">Sélectionne une conversation.</p>}
        {sel && detail && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">{sel.contact_name || sel.contact_jid.split("@")[0]}</p>
              <button onClick={doHandoff} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${sel.handoff ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>
                <HandMetal className="h-3 w-3" /> {sel.handoff ? "Rendre à l'IA" : "Reprendre en main"}
              </button>
            </div>
            <div className="mb-3 max-h-[440px] space-y-2 overflow-y-auto rounded-xl bg-background p-3">
              {detail.messages.map((m: any) => (
                <div key={m.id} className={`max-w-[80%] rounded-2xl p-2 text-sm ${m.role === "user" ? "bg-surface-2" : m.role === "human" ? "ml-auto bg-emerald-500/15" : "ml-auto bg-primary/15"}`}>
                  <p className="text-[9px] uppercase tracking-wider opacity-60">{m.role}</p>
                  <p>{m.content}</p>
                </div>
              ))}
              {!detail.messages.length && <p className="text-xs text-muted-foreground">Vide.</p>}
            </div>
            <div className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Répondre en tant qu'humain…"
                className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
              <button onClick={doSend} className="rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------ LOGS ------------ */
function LogsTab({ businessId }: any) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listBotLogs(businessId).then(setRows); }, [businessId]);
  return (
    <div className="space-y-2">
      {rows.map((l) => (
        <div key={l.id} className="rounded-xl border border-border bg-card p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="rounded bg-primary/15 px-2 py-0.5 font-semibold uppercase tracking-wider text-primary">{l.kind}</span>
            <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("fr-FR")}</span>
          </div>
          {l.group_jid && <p className="mt-1 font-mono text-[10px] text-muted-foreground">groupe: {l.group_jid}</p>}
          {l.user_jid && <p className="font-mono text-[10px] text-muted-foreground">user: {l.user_jid}</p>}
          {l.payload && Object.keys(l.payload).length > 0 && (
            <pre className="mt-1 overflow-x-auto text-[10px] text-muted-foreground">{JSON.stringify(l.payload, null, 0)}</pre>
          )}
        </div>
      ))}
      {!rows.length && <p className="text-sm text-muted-foreground">Aucun événement.</p>}
    </div>
  );
}
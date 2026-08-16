import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useServerFn } from '@/lib/server-fn';
import { adminGetConfig, adminUpdateConfig } from '@/lib/admin.functions';
import { supabase } from '@/integrations/supabase/client';

export function SettingsTab() {
  const getCfg = useServerFn(adminGetConfig);
  const updCfg = useServerFn(adminUpdateConfig);
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const r: any = await getCfg();
        setCfg(r.config);
        setDraft(r.config);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    try {
      const r: any = await updCfg({ data: draft });
      if (r?.ok === false) throw new Error(r.error);
      
      // Update global SMS settings to ensure persistence
      await supabase.from("sms_config").upsert({
        id: 'global',
        notify_admin_sender_request: !!draft.notify_admin_sender_request,
        event_wallet_recharge: !!draft.event_wallet_recharge,
        event_card_recharge: !!draft.event_card_recharge,
        event_withdrawal: !!draft.event_withdrawal,
        event_withdrawal_paid: !!draft.event_withdrawal_paid,
        event_sender_request: !!draft.event_sender_request,
        admin_phones: draft.admin_notification_phone ? [draft.admin_notification_phone.replace(/\D/g, '')] : []
      } as any);

      setCfg(r.config);
      setDraft(r.config);
      toast.success("Paramètres enregistrés avec succès");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) return <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  const InputField = ({ k, label, hint, type = "number", placeholder }: any) => (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={draft[k] ?? ""}
        onChange={(e) => setDraft((d: any) => ({ ...d, [k]: e.target.value }))}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none"
      />
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight">Paramètres Globaux</h1>
        <button onClick={save} disabled={busy} className="rounded-full bg-gradient-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer tout"}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-[Space_Grotesk] text-xl font-bold">Devises & Frais</h2>
          <InputField k="usd_rate_xof" label="Taux USD → XOF" hint="Valeur du Dollar en CFA (ex: 869)" />
          <InputField k="card_issue_fee_xof" label="Frais émission carte (XOF)" hint="Frais fixe par carte (ex: 4500)" />
          <InputField k="referral_reward_xof" label="Bonus parrainage (XOF)" hint="Bonus par carte achetée" />
          <InputField k="strowallet_fixed_fee_usd" label="Frais fixe émetteur (USD)" hint="Ex: 1.90" />
          <InputField k="strowallet_pct_fee" label="Frais % émetteur" hint="Ex: 0.01 = 1%" />
        </div>


        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-[Space_Grotesk] text-xl font-bold">Notifications Admin</h2>
          <InputField k="admin_notification_phone" label="Téléphone Admin (SMS)" hint="Numéro recevant les alertes" type="text" placeholder="+226..." />
          <InputField k="whatsapp_group_url" label="Lien WhatsApp" hint="URL du groupe" type="url" />
          
          <div className="pt-2">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 cursor-pointer hover:bg-surface-3 transition">
              <input type="checkbox" checked={!!draft.notify_admin_sender_request} onChange={(e) => setDraft((d: any) => ({ ...d, notify_admin_sender_request: e.target.checked }))} className="h-4 w-4 rounded accent-primary" />
              <span className="text-sm font-semibold">Alertes Sender ID (Admin)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-[Space_Grotesk] text-xl font-bold">Événements SMS</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { k: "event_wallet_recharge", label: "Recharge portefeuille" },
            { k: "event_card_recharge", label: "Recharge carte USD" },
            { k: "event_withdrawal", label: "Demande de retrait" },
            { k: "event_withdrawal_paid", label: "Retrait payé" },
            { k: "event_sender_request", label: "Demande Sender ID (Marchand)" },
          ].map((ev) => (
            <label key={ev.k} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 cursor-pointer hover:bg-surface-3">
              <input type="checkbox" checked={!!draft[ev.k]} onChange={(e) => setDraft((d: any) => ({ ...d, [ev.k]: e.target.checked }))} className="h-4 w-4 rounded accent-primary" />
              <span className="text-sm">{ev.label}</span>
            </label>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 pt-4">
          <InputField k="sender_request_admin_template" label="Template SMS Admin" hint="Vars: {name}, {sender_id}, {company}" type="text" />
          <InputField k="sender_request_user_template" label="Template SMS Marchand" hint="Vars: {name}, {sender_id}" type="text" />
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-[Space_Grotesk] text-xl font-bold">Passerelle API & PayPal</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-bold opacity-70 uppercase tracking-widest">Passerelle API (Marchands)</h3>
            <div className="grid gap-3">
              <InputField k="gateway_fee_bps" label="Commission API (BPS)" hint="200 = 2%" />
              <InputField k="gateway_fee_flat_xof" label="Frais fixe API (XOF)" />
              <InputField k="gateway_min_xof" label="Montant min API (XOF)" />
              <InputField k="sms_price" label="Prix SMS Marchand (XOF)" />
              <label className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 cursor-pointer">
                <input type="checkbox" checked={!!draft.gateway_enabled} onChange={(e) => setDraft((d: any) => ({ ...d, gateway_enabled: e.target.checked }))} className="h-4 w-4 rounded accent-primary" />
                <span className="text-sm">Activer la passerelle API</span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold opacity-70 uppercase tracking-widest">Retrait PayPal</h3>
            <div className="grid gap-3">
              <InputField k="paypal_wd_fee_bps" label="Commission PayPal (BPS)" hint="500 = 5%" />
              <InputField k="paypal_wd_fee_flat_xof" label="Frais fixe PayPal (XOF)" />
              <InputField k="paypal_wd_min_xof" label="Min retrait PayPal (XOF)" />
              <InputField k="paypal_wd_max_xof" label="Max retrait PayPal (XOF)" />
              <label className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 cursor-pointer">
                <input type="checkbox" checked={!!draft.paypal_wd_enabled} onChange={(e) => setDraft((d: any) => ({ ...d, paypal_wd_enabled: e.target.checked }))} className="h-4 w-4 rounded accent-primary" />
                <span className="text-sm">Activer retraits PayPal</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-bold opacity-70 uppercase tracking-widest mb-4">Retrait Marchand (Cashout)</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <InputField k="business_cashout_fee_bps" label="Commission Cashout (BPS)" hint="100 = 1%" />
            <InputField k="business_cashout_fee_flat_xof" label="Frais fixe Cashout (XOF)" />
            <InputField k="business_cashout_min_xof" label="Min Cashout (XOF)" />
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}

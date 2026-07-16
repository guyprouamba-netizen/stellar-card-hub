// BBG SMS integration — shared helper.
// Fire-and-forget: never throw to the caller so business flows are never blocked.

const BBG_ENDPOINT = "https://bbgsmsapp.betterbegoing.com/api/http/sms/send";

export function normalizeBfPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("226") && digits.length >= 11) return digits.slice(0, 11);
  if (digits.length === 8) return "226" + digits;
  if (digits.length >= 10 && digits.length <= 15) return digits; // international as-is
  return null;
}

function renderTemplate(body: string, vars: Record<string, string | number | undefined | null>): string {
  return body.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

export async function sendSmsRaw(opts: {
  recipient: string; // may contain commas
  message: string;
  sender_id: string;
}): Promise<{ ok: boolean; body: any; status: number }> {
  const token = Deno.env.get("BBG_SMS_API_TOKEN");
  if (!token) return { ok: false, body: { error: "BBG_SMS_API_TOKEN missing" }, status: 500 };
  try {
    const res = await fetch(BBG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        api_token: token,
        recipient: opts.recipient,
        sender_id: opts.sender_id,
        type: "plain",
        message: opts.message,
      }),
    });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch { /* keep text */ }
    return { ok: res.ok, body, status: res.status };
  } catch (e) {
    return { ok: false, body: { error: (e as Error).message }, status: 0 };
  }
}

async function logSms(admin: any, row: {
  recipient: string; message: string; event_key?: string; user_id?: string;
  status: "success" | "failed"; provider_response?: any; error?: string;
}) {
  try {
    await admin.from("sms_logs").insert({
      recipient: row.recipient,
      message: row.message,
      event_key: row.event_key ?? null,
      user_id: row.user_id ?? null,
      status: row.status,
      provider_response: row.provider_response ?? null,
      error: row.error ?? null,
    });
  } catch { /* swallow */ }
}

async function loadConfig(admin: any) {
  const { data } = await admin.from("sms_config").select("*").limit(1).maybeSingle();
  return data as any;
}

async function loadTemplate(admin: any, key: string) {
  const { data } = await admin.from("sms_templates").select("body,enabled").eq("event_key", key).maybeSingle();
  return data as { body: string; enabled: boolean } | null;
}

export type NotifyEvent =
  | "wallet_recharge"
  | "card_recharge"
  | "withdrawal_request"
  | "withdrawal_paid";

/**
 * Send both user + admin notifications for a business event.
 * Non-blocking: any error is caught and logged internally.
 */
export async function notifyEvent(admin: any, event: NotifyEvent, ctx: {
  userId: string;
  amount: number | string;
  currency?: string;
  balance?: number | string;
  extra?: Record<string, string | number>;
}): Promise<void> {
  try {
    const cfg = await loadConfig(admin);
    if (!cfg || !cfg.enabled) return;
    const enabledMap: Record<NotifyEvent, boolean> = {
      wallet_recharge: cfg.event_wallet_recharge,
      card_recharge: cfg.event_card_recharge,
      withdrawal_request: cfg.event_withdrawal,
      withdrawal_paid: cfg.event_withdrawal_paid,
    };
    if (!enabledMap[event]) return;

    const { data: profile } = await admin.from("profiles").select("full_name,phone").eq("id", ctx.userId).maybeSingle();
    const name = (profile?.full_name as string | null) || "Client";
    const userPhone = normalizeBfPhone(profile?.phone);

    const vars = {
      name,
      amount: typeof ctx.amount === "number" ? ctx.amount.toLocaleString("fr-FR") : ctx.amount,
      currency: ctx.currency || "XOF",
      balance: ctx.balance !== undefined ? (typeof ctx.balance === "number" ? ctx.balance.toLocaleString("fr-FR") : ctx.balance) : "",
      ...(ctx.extra || {}),
    };

    const userKey = `${event === "wallet_recharge" ? "wallet_recharge_user"
      : event === "card_recharge" ? "card_recharge_user"
      : event === "withdrawal_request" ? "withdrawal_request_user"
      : "withdrawal_paid_user"}`;
    const adminKey = event === "withdrawal_paid" ? null
      : (event === "wallet_recharge" ? "wallet_recharge_admin"
        : event === "card_recharge" ? "card_recharge_admin"
        : "withdrawal_request_admin");

    // User SMS
    if (userPhone) {
      const tpl = await loadTemplate(admin, userKey);
      if (tpl?.enabled && tpl.body) {
        const message = renderTemplate(tpl.body, vars);
        const r = await sendSmsRaw({ recipient: userPhone, message, sender_id: cfg.sender_id });
        await logSms(admin, {
          recipient: userPhone, message, event_key: userKey, user_id: ctx.userId,
          status: r.ok ? "success" : "failed", provider_response: r.body,
          error: r.ok ? undefined : String(r.body?.message || r.body?.error || `HTTP ${r.status}`),
        });
      }
    }

    // Admin SMS
    if (cfg.notify_admin && adminKey && Array.isArray(cfg.admin_phones) && cfg.admin_phones.length > 0) {
      const tpl = await loadTemplate(admin, adminKey);
      if (tpl?.enabled && tpl.body) {
        const message = renderTemplate(tpl.body, vars);
        const normalized = cfg.admin_phones.map((p: string) => normalizeBfPhone(p)).filter(Boolean) as string[];
        if (normalized.length) {
          const recipient = normalized.join(",");
          const r = await sendSmsRaw({ recipient, message, sender_id: cfg.sender_id });
          await logSms(admin, {
            recipient, message, event_key: adminKey, user_id: ctx.userId,
            status: r.ok ? "success" : "failed", provider_response: r.body,
            error: r.ok ? undefined : String(r.body?.message || r.body?.error || `HTTP ${r.status}`),
          });
        }
      }
    }
  } catch (e) {
    console.error("[sms.notifyEvent] error:", (e as Error).message);
  }
}
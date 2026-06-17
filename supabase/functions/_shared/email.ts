// Shared SMTP helper for sending transactional emails.
import { SMTPClient } from "npm:emailjs@4.0.3";

const SMTP_HOST = Deno.env.get("SMTP_HOST")!;
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD")!;
const SMTP_FROM_RAW = Deno.env.get("SMTP_FROM");
const SMTP_FROM = SMTP_FROM_RAW && SMTP_FROM_RAW.includes("@") ? SMTP_FROM_RAW : SMTP_USER;

export async function sendEmail(opts: { to: string; subject: string; html: string; text: string; fromName?: string }) {
  const client = new SMTPClient({
    user: SMTP_USER, password: SMTP_PASSWORD,
    host: SMTP_HOST, port: SMTP_PORT,
    ssl: SMTP_PORT === 465, tls: SMTP_PORT !== 465,
  });
  await client.sendAsync({
    from: `${opts.fromName || "FASO-INVEST PAY"} <${SMTP_FROM}>`,
    to: opts.to, subject: opts.subject, text: opts.text,
    attachment: [{ data: opts.html, alternative: true }],
  });
}

export function receiptHtml(opts: {
  business: string; reference: string; amount: number; currency: string;
  title: string; date: string; receiptUrl?: string;
}) {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:40px;max-width:560px">
          <tr><td>
            <div style="text-align:center;margin-bottom:16px">
              <div style="display:inline-grid;place-items:center;width:64px;height:64px;border-radius:50%;background:#10b981;color:#fff;font-size:32px;line-height:64px">✓</div>
            </div>
            <h1 style="margin:0 0 8px;font-size:22px;text-align:center;color:#0f172a">Paiement confirmé</h1>
            <p style="margin:0 0 24px;font-size:14px;text-align:center;color:#64748b">Merci pour votre paiement à <b>${opts.business}</b></p>
            <table width="100%" style="border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#64748b">Produit</td><td style="padding:8px 0;text-align:right"><b>${opts.title}</b></td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Montant</td><td style="padding:8px 0;text-align:right"><b>${opts.amount.toLocaleString("fr-FR")} ${opts.currency}</b></td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Référence</td><td style="padding:8px 0;text-align:right;font-family:monospace;font-size:12px">${opts.reference}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Date</td><td style="padding:8px 0;text-align:right">${opts.date}</td></tr>
            </table>
            ${opts.receiptUrl ? `<p style="text-align:center;margin:28px 0"><a href="${opts.receiptUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600">Télécharger le reçu</a></p>` : ""}
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Paiement sécurisé via FASO-INVEST PAY</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}
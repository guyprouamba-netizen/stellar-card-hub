import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'npm:emailjs@4.0.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SMTP_HOST = Deno.env.get('SMTP_HOST')!;
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465');
const SMTP_USER = Deno.env.get('SMTP_USER')!;
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD')!;
const SMTP_FROM = Deno.env.get('SMTP_FROM') ?? SMTP_USER;

function html(linkUrl: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:40px;max-width:560px">
        <tr><td>
          <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a">Réinitialisation de votre mot de passe</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155">
            Bonjour,<br><br>
            Vous avez demandé à réinitialiser le mot de passe de votre compte <b>FASO-INVEST PAY</b>.
            Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <b>1 heure</b>.
          </p>
          <p style="text-align:center;margin:28px 0">
            <a href="${linkUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#64748b">
            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
          </p>
          <p style="margin:0 0 24px;font-size:12px;color:#2563eb;word-break:break-all">${linkUrl}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5">
            Vous n'êtes pas à l'origine de cette demande ? Ignorez simplement cet email, votre mot de passe ne sera pas modifié.<br><br>
            — L'équipe FASO-INVEST PAY
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function text(linkUrl: string) {
  return `Réinitialisation de votre mot de passe FASO-INVEST PAY

Bonjour,

Vous avez demandé à réinitialiser le mot de passe de votre compte FASO-INVEST PAY.
Ouvrez le lien ci-dessous (valable 1 heure) pour choisir un nouveau mot de passe :

${linkUrl}

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

— L'équipe FASO-INVEST PAY`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { email, redirectTo } = await req.json();
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Génère un lien de récupération côté serveur
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    // On ne révèle pas si l'email existe (anti-énumération).
    if (error || !data?.properties?.action_link) {
      console.log('generateLink result:', error?.message ?? 'no link');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const linkUrl = data.properties.action_link;

    const client = new SMTPClient({
      user: SMTP_USER,
      password: SMTP_PASSWORD,
      host: SMTP_HOST,
      port: SMTP_PORT,
      ssl: SMTP_PORT === 465,
      tls: SMTP_PORT !== 465,
    });

    await client.sendAsync({
      from: `FASO-INVEST PAY <${SMTP_FROM}>`,
      to: email,
      subject: 'Réinitialisation de votre mot de passe — FASO-INVEST PAY',
      text: text(linkUrl),
      attachment: [{ data: html(linkUrl), alternative: true }],
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-password-reset error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Copy, Terminal, Webhook, KeyRound, ShieldCheck, ListChecks } from "lucide-react";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pay/v1`;

function Code({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-2">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <button
          onClick={() => { navigator.clipboard.writeText(code); toast.success("Code copié ✅"); }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold hover:bg-muted">
          <Copy className="h-3 w-3" /> Copier
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed">{code}</pre>
    </div>
  );
}

const SECTIONS = [
  { id: "start", label: "Démarrage", icon: ListChecks },
  { id: "keys", label: "Clés API", icon: KeyRound },
  { id: "api", label: "Référence API", icon: Terminal },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "wordpress", label: "WordPress", icon: BookOpen },
  { id: "security", label: "Sécurité & tests", icon: ShieldCheck },
] as const;

export default function DocsPanel() {
  const [sec, setSec] = useState<typeof SECTIONS[number]["id"]>("start");

  return (
    <section className="space-y-5">
      <div>
        <h3 className="inline-flex items-center gap-2 font-[Space_Grotesk] text-xl font-bold">
          <BookOpen className="h-5 w-5" /> Documentation de la passerelle de paiement
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Intégrez les paiements Mobile Money sur n'importe quel site — en code pur (PHP, Node, Python) ou sur WordPress / WooCommerce.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setSec(s.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${sec === s.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
              <Icon className="h-3.5 w-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {sec === "start" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-sm">
          <h4 className="font-bold">Du début à la fin, en 6 étapes</h4>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li><b className="text-foreground">Créez un projet</b> dans l'onglet « Projets ». Un projet = un site ou une application à encaisser.</li>
            <li><b className="text-foreground">Configurez-le</b> (logo, couverture, description, devise) via le bouton « Configurer ».</li>
            <li><b className="text-foreground">Générez les clés API</b> (onglet « Clés API & Webhook »). Vous obtenez une clé publique <code>pk_live_…</code> et une clé secrète <code>sk_live_…</code> affichée une seule fois.</li>
            <li><b className="text-foreground">Enregistrez votre URL de webhook</b> : c'est l'adresse de votre serveur qui recevra la confirmation de paiement.</li>
            <li><b className="text-foreground">Créez une session de paiement</b> depuis votre serveur, puis redirigez le client vers la <code>checkout_url</code>.</li>
            <li><b className="text-foreground">Validez</b> le paiement à la réception du webhook signé (ou via <code>GET /payments/&#123;reference&#125;</code>) et livrez la commande.</li>
          </ol>
          <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs">
            <p className="font-semibold">URL de base de l'API</p>
            <p className="mt-1 break-all font-mono text-[11px]">{ENDPOINT}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Toutes les requêtes sont en HTTPS, le corps est en JSON, les montants sont des <b>entiers</b> dans la plus petite unité de la devise (XOF sans décimales).
          </p>
        </div>
      )}

      {sec === "keys" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h4 className="font-bold">Les trois secrets d'un projet</h4>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li><b className="text-foreground">Clé publique <code>pk_…</code></b> — identifiant non sensible, utilisable côté client pour identifier votre projet.</li>
              <li><b className="text-foreground">Clé secrète <code>sk_…</code></b> — s'utilise <b>uniquement côté serveur</b>. Elle authentifie vos appels API. Elle n'est affichée qu'une fois : conservez-la dans une variable d'environnement.</li>
              <li><b className="text-foreground">Secret de signature <code>whsec_…</code></b> — sert à vérifier que les webhooks reçus proviennent bien de nous.</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Régénérer les clés révoque immédiatement les anciennes. Le mode <code>test</code> (<code>sk_test_…</code>) permet d'intégrer sans encaisser réellement.</p>
          </div>
          <Code title="Tester votre clé (cURL)" code={`curl -X GET "${ENDPOINT}/ping" \\
  -H "Authorization: Bearer sk_live_VOTRE_CLE_SECRETE"

# Réponse
# {"ok":true,"data":{"business_id":"…","project_id":"…","mode":"live"}}`} />
          <Code title="Variables d'environnement recommandées" code={`FIP_API_URL=${ENDPOINT}
FIP_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
FIP_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx`} />
        </div>
      )}

      {sec === "api" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h4 className="font-bold">Points d'entrée</h4>
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr><th className="py-1">Méthode</th><th>Chemin</th><th>Rôle</th></tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-t border-border"><td className="py-1.5">GET</td><td>/ping</td><td className="font-sans">Valider la clé</td></tr>
                <tr className="border-t border-border"><td className="py-1.5">POST</td><td>/checkout/sessions</td><td className="font-sans">Créer un paiement</td></tr>
                <tr className="border-t border-border"><td className="py-1.5">GET</td><td>/payments/&#123;reference&#125;</td><td className="font-sans">Statut d'une transaction</td></tr>
                <tr className="border-t border-border"><td className="py-1.5">POST</td><td>/payment-links</td><td className="font-sans">Créer un lien de paiement</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              En-têtes acceptés pour la clé secrète : <code>Authorization: Bearer …</code>, <code>x-api-key</code>, <code>x-secret-key</code> ou <code>apikey</code>.
            </p>
          </div>

          <Code title="1. Créer une session de paiement — cURL" code={`curl -X POST "${ENDPOINT}/checkout/sessions" \\
  -H "Authorization: Bearer $FIP_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "currency": "XOF",
    "description": "Commande #1042",
    "reference": "CMD-1042",
    "customer_email": "client@mail.com",
    "customer_name": "Awa Traoré",
    "customer_phone": "22670000000",
    "return_url": "https://votre-site.com/merci",
    "metadata": {"order_id": 1042}
  }'

# Réponse
# {"ok":true,"data":{"reference":"CMD-1042","amount":5000,"currency":"XOF",
#   "status":"pending","checkout_url":"https://…"}}`} />

          <Code title="2. PHP pur (sans framework)" code={`<?php
function fip_create_session(array $payload) {
  $ch = curl_init(getenv('FIP_API_URL') . '/checkout/sessions');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
      'Authorization: Bearer ' . getenv('FIP_SECRET_KEY'),
      'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
  ]);
  $res = json_decode(curl_exec($ch), true);
  curl_close($ch);
  if (empty($res['ok'])) throw new Exception($res['error'] ?? 'Erreur passerelle');
  return $res['data'];
}

$session = fip_create_session([
  'amount' => 5000,
  'currency' => 'XOF',
  'description' => 'Commande #1042',
  'reference' => 'CMD-1042',
  'customer_email' => $_POST['email'],
  'return_url' => 'https://votre-site.com/merci',
]);

// Redirection du client vers la page de paiement
header('Location: ' . $session['checkout_url']);
exit;`} />

          <Code title="3. Node.js / Express" code={`import express from "express";
const app = express();
app.use(express.json());

app.post("/checkout", async (req, res) => {
  const r = await fetch(process.env.FIP_API_URL + "/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.FIP_SECRET_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: req.body.amount,
      currency: "XOF",
      description: "Commande " + req.body.orderId,
      reference: "CMD-" + req.body.orderId,
      customer_email: req.body.email,
      return_url: "https://votre-site.com/merci",
    }),
  });
  const j = await r.json();
  if (!j.ok) return res.status(400).json({ error: j.error });
  res.json({ checkout_url: j.data.checkout_url });
});`} />

          <Code title="4. Python (requests)" code={`import os, requests

def create_session(amount, reference, email):
    r = requests.post(
        os.environ["FIP_API_URL"] + "/checkout/sessions",
        headers={"Authorization": "Bearer " + os.environ["FIP_SECRET_KEY"]},
        json={
            "amount": amount, "currency": "XOF",
            "reference": reference, "customer_email": email,
            "return_url": "https://votre-site.com/merci",
        }, timeout=30,
    )
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(data.get("error"))
    return data["data"]["checkout_url"]`} />

          <Code title="5. Vérifier le statut d'une transaction" code={`curl -X GET "${ENDPOINT}/payments/CMD-1042" \\
  -H "Authorization: Bearer $FIP_SECRET_KEY"

# status : pending | success | failed
# La transaction existe et est lisible dès l'ouverture de la page de paiement.`} />
        </div>
      )}

      {sec === "webhooks" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h4 className="font-bold">Notifications serveur à serveur</h4>
            <p className="mt-2 text-muted-foreground">
              Dès qu'un paiement change d'état, nous appelons votre URL en <code>POST</code> avec un corps JSON signé.
              Événements : <code>payment.pending</code> (page de paiement ouverte), <code>payment.succeeded</code>, <code>payment.failed</code>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              En-tête de signature : <code>X-FIP-Signature: t=&lt;timestamp&gt;,v1=&lt;HMAC_SHA256(t + "." + corps, whsec)&gt;</code>. Répondez <code>200</code> rapidement.
            </p>
          </div>
          <Code title="Corps du webhook" code={`{
  "event": "payment.succeeded",
  "data": {
    "reference": "CMD-1042",
    "amount": 5000,
    "fee": 100,
    "net": 4900,
    "currency": "XOF",
    "status": "success",
    "customer_email": "client@mail.com",
    "customer_name": "Awa Traoré"
  },
  "created_at": "2026-01-01T10:00:00.000Z"
}`} />
          <Code title="Vérification de la signature — PHP" code={`<?php
$body   = file_get_contents('php://input');
$header = $_SERVER['HTTP_X_FIP_SIGNATURE'] ?? '';
parse_str(str_replace(',', '&', $header), $parts); // t=…&v1=…

$expected = hash_hmac('sha256', $parts['t'] . '.' . $body, getenv('FIP_WEBHOOK_SECRET'));
if (!hash_equals($expected, $parts['v1'] ?? '')) {
  http_response_code(401); exit('invalid signature');
}
if (abs(time() - (int) $parts['t']) > 300) { http_response_code(401); exit('stale'); }

$payload = json_decode($body, true);
if ($payload['event'] === 'payment.succeeded') {
  // marquer la commande payée avec $payload['data']['reference']
}
http_response_code(200); echo 'ok';`} />
          <Code title="Vérification de la signature — Node.js" code={`import crypto from "crypto";

app.post("/webhooks/paiement", express.raw({ type: "*/*" }), (req, res) => {
  const raw = req.body.toString("utf8");
  const [tPart, vPart] = (req.header("X-FIP-Signature") || "").split(",");
  const t = tPart?.split("=")[1], v1 = vPart?.split("=")[1];
  const expected = crypto
    .createHmac("sha256", process.env.FIP_WEBHOOK_SECRET)
    .update(\`\${t}.\${raw}\`)
    .digest("hex");
  if (expected !== v1) return res.status(401).end();

  const { event, data } = JSON.parse(raw);
  if (event === "payment.succeeded") { /* livrer la commande */ }
  res.json({ received: true });
});`} />
          <p className="text-xs text-muted-foreground">
            Testez sans écrire une ligne de code : bouton « Simuler un paiement réussi » dans la configuration du projet. Le journal des envois affiche le code HTTP renvoyé par votre serveur.
          </p>
        </div>
      )}

      {sec === "wordpress" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h4 className="font-bold flex items-center justify-between">
              Extension WooCommerce Officielle (F.I.P)
              <a 
                href="/downloads/fip-woocommerce-plugin.php" 
                download="fip-woocommerce.php"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                Télécharger le Plugin (.php)
              </a>
            </h4>
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-[13px]">
              <p className="font-semibold text-primary">Instructions d'installation :</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>Téléchargez le fichier ci-dessus.</li>
                <li>Allez dans votre administration WordPress : <b>Extensions &gt; Ajouter &gt; Téléverser une extension</b>.</li>
                <li>Sélectionnez le fichier et cliquez sur <b>Installer maintenant</b>, puis <b>Activer</b>.</li>
                <li>Allez dans <b>WooCommerce &gt; Réglages &gt; Paiements</b> et activez « Faso Invest Paiement ».</li>
                <li>Cliquez sur <b>Gérer</b> et copiez-collez votre <b>Clé Secrète API</b> et votre <b>Secret Webhook</b> depuis l'onglet « Intégration API ».</li>
              </ol>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h4 className="font-bold">Développement sur-mesure</h4>
            <p className="mt-2 text-muted-foreground">
              Si vous n'utilisez pas WooCommerce, vous pouvez utiliser le code ci-dessous pour créer un plugin personnalisé :
            </p>
          </div>
          <Code title="Plugin WordPress simple (shortcode + webhook)" code={`<?php
/**
 * Plugin Name: FIP Paiement
 * Description: Paiement Mobile Money via la passerelle FIP.
 * Version: 1.0
 */
if (!defined('ABSPATH')) exit;

define('FIP_API_URL', '${ENDPOINT}');
define('FIP_SECRET_KEY', 'sk_live_VOTRE_CLE');
define('FIP_WEBHOOK_SECRET', 'whsec_VOTRE_SECRET');

function fip_shortcode($atts) {
  $a = shortcode_atts(['montant' => 1000, 'libelle' => 'Payer'], $atts);
  $url = admin_url('admin-post.php?action=fip_pay&montant=' . intval($a['montant']));
  return '<a class="button" href="' . esc_url($url) . '">' . esc_html($a['libelle']) . '</a>';
}
add_shortcode('fip_bouton', 'fip_shortcode');

function fip_pay() {
  $montant = intval($_GET['montant'] ?? 0);
  $res = wp_remote_post(FIP_API_URL . '/checkout/sessions', [
    'headers' => [
      'Authorization' => 'Bearer ' . FIP_SECRET_KEY,
      'Content-Type'  => 'application/json',
    ],
    'body' => wp_json_encode([
      'amount'      => $montant,
      'currency'    => 'XOF',
      'reference'   => 'WP-' . time(),
      'description' => get_bloginfo('name'),
      'return_url'  => home_url('/merci'),
    ]),
    'timeout' => 30,
  ]);
  $body = json_decode(wp_remote_retrieve_body($res), true);
  if (empty($body['ok'])) wp_die('Paiement indisponible : ' . esc_html($body['error'] ?? ''));
  wp_redirect($body['data']['checkout_url']); exit;
}
add_action('admin_post_nopriv_fip_pay', 'fip_pay');
add_action('admin_post_fip_pay', 'fip_pay');

// Webhook : https://votre-site.com/wp-json/fip/v1/webhook
add_action('rest_api_init', function () {
  register_rest_route('fip/v1', '/webhook', [
    'methods'  => 'POST',
    'permission_callback' => '__return_true',
    'callback' => function (WP_REST_Request $req) {
      $raw = $req->get_body();
      parse_str(str_replace(',', '&', $req->get_header('x-fip-signature')), $p);
      $expected = hash_hmac('sha256', $p['t'] . '.' . $raw, FIP_WEBHOOK_SECRET);
      if (!hash_equals($expected, $p['v1'] ?? '')) return new WP_REST_Response('bad signature', 401);
      $data = json_decode($raw, true);
      do_action('fip_paiement_recu', $data['event'], $data['data']);
      return new WP_REST_Response(['received' => true], 200);
    },
  ]);
});`} />
          <Code title="Passerelle WooCommerce" code={`<?php
add_filter('woocommerce_payment_gateways', function ($g) { $g[] = 'WC_Gateway_FIP'; return $g; });

add_action('plugins_loaded', function () {
  class WC_Gateway_FIP extends WC_Payment_Gateway {
    public function __construct() {
      $this->id = 'fip';
      $this->method_title = 'Mobile Money (FIP)';
      $this->title = 'Mobile Money — Orange, Moov, Wave';
      $this->has_fields = false;
      $this->init_form_fields(); $this->init_settings();
      add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
    }
    public function init_form_fields() {
      $this->form_fields = [
        'enabled'    => ['title' => 'Activer', 'type' => 'checkbox', 'default' => 'yes'],
        'secret_key' => ['title' => 'Clé secrète (sk_…)', 'type' => 'password'],
      ];
    }
    public function process_payment($order_id) {
      $order = wc_get_order($order_id);
      $res = wp_remote_post('${ENDPOINT}/checkout/sessions', [
        'headers' => [
          'Authorization' => 'Bearer ' . $this->get_option('secret_key'),
          'Content-Type'  => 'application/json',
        ],
        'body' => wp_json_encode([
          'amount'         => (int) $order->get_total(),
          'currency'       => $order->get_currency(),
          'reference'      => 'WC-' . $order_id . '-' . time(),
          'description'    => 'Commande #' . $order_id,
          'customer_email' => $order->get_billing_email(),
          'customer_name'  => $order->get_formatted_billing_full_name(),
          'customer_phone' => $order->get_billing_phone(),
          'return_url'     => $this->get_return_url($order),
        ]),
        'timeout' => 30,
      ]);
      $body = json_decode(wp_remote_retrieve_body($res), true);
      if (empty($body['ok'])) { wc_add_notice('Paiement indisponible', 'error'); return; }
      $order->update_meta_data('_fip_reference', $body['data']['reference']);
      $order->save();
      return ['result' => 'success', 'redirect' => $body['data']['checkout_url']];
    }
  }
});

// Confirmation via webhook : marque la commande payée
add_action('fip_paiement_recu', function ($event, $data) {
  if ($event !== 'payment.succeeded') return;
  $orders = wc_get_orders(['meta_key' => '_fip_reference', 'meta_value' => $data['reference'], 'limit' => 1]);
  if ($orders) { $orders[0]->payment_complete($data['reference']); }
}, 10, 2);`} />
        </div>
      )}

      {sec === "security" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-sm">
          <h4 className="font-bold">Bonnes pratiques</h4>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>La clé secrète ne doit <b>jamais</b> apparaître dans le navigateur, un dépôt Git ou un fichier JavaScript public.</li>
            <li>Ne considérez une commande payée qu'après réception du webhook signé <b>ou</b> un appel <code>GET /payments/&#123;reference&#125;</code> renvoyant <code>success</code>.</li>
            <li>Rejetez toute signature invalide et tout horodatage vieux de plus de 5 minutes (protection contre le rejeu).</li>
            <li>Utilisez une <code>reference</code> unique par commande : elle rend l'appel idempotent et facilite le rapprochement comptable.</li>
            <li>Traitez les webhooks de façon idempotente : un même événement peut être renvoyé.</li>
          </ul>
          <h4 className="pt-2 font-bold">Codes d'erreur</h4>
          <table className="w-full text-left text-xs">
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border"><td className="py-1.5 font-mono">401</td><td>Clé absente, invalide ou révoquée</td></tr>
              <tr className="border-t border-border"><td className="py-1.5 font-mono">400</td><td>Paramètre manquant ou référence déjà utilisée</td></tr>
              <tr className="border-t border-border"><td className="py-1.5 font-mono">404</td><td>Transaction ou point d'entrée inconnu</td></tr>
              <tr className="border-t border-border"><td className="py-1.5 font-mono">429</td><td>Trop de requêtes</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

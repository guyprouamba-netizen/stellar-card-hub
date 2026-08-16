<?php
/**
 * Plugin Name: FASO INVEST PAY for WooCommerce
 * Plugin URI: https://faso-invest.com
 * Description: Acceptez les paiements Mobile Money (Orange, Moov, Wave) en Afrique de l'Ouest via la passerelle FASO INVEST PAY.
 * Version: 1.0.1
 * Author: FASO INVEST PAY - Guy ROUAMBA
 * Author URI: https://faso-invest.com
 * License: GPL2
 * Text Domain: fip-paiement
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Initialize the gateway
 */
add_action('plugins_loaded', 'fip_paiement_init_gateway');

function fip_paiement_init_gateway() {
    if (!class_exists('WC_Payment_Gateway')) return;

    class WC_Gateway_FIP extends WC_Payment_Gateway {
        public function __construct() {
            $this->id = 'fip_gateway';
            $this->icon = apply_filters('woocommerce_fip_icon', '');
            $this->has_fields = false;
            $this->method_title = 'FASO INVEST PAY';
            $this->method_description = 'Permet d\'accepter Orange Money, Moov Money et Wave de manière sécurisée.';

            $this->init_form_fields();
            $this->init_settings();

            $this->title = $this->get_option('title');
            $this->description = $this->get_option('description');
            $this->enabled = $this->get_option('enabled');
            $this->secret_key = $this->get_option('secret_key');
            $this->webhook_secret = $this->get_option('webhook_secret');
            $this->api_url = 'https://bbepprxkkwdfzmiycqqi.supabase.co/functions/v1/pay/v1';

            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
            add_action('woocommerce_api_wc_gateway_fip', array($this, 'check_fip_webhook'));
        }

        public function init_form_fields() {
            $this->form_fields = array(
                'enabled' => array(
                    'title' => 'Activer/Désactiver',
                    'type' => 'checkbox',
                    'label' => 'Activer FASO INVEST PAY',
                    'default' => 'yes'
                ),
                'title' => array(
                    'title' => 'Titre',
                    'type' => 'text',
                    'description' => 'Titre affiché au client lors du paiement.',
                    'default' => 'Mobile Money (Orange, Moov, Wave)',
                    'desc_tip' => true,
                ),
                'description' => array(
                    'title' => 'Description',
                    'type' => 'textarea',
                    'description' => 'Description affichée au client.',
                    'default' => 'Payez en toute sécurité via Orange Money, Moov Money ou Wave.',
                ),
                'secret_key' => array(
                    'title' => 'Clé Secrète API (sk_live_...)',
                    'type' => 'password',
                    'description' => 'Récupérez votre clé dans votre Espace Business.',
                ),
                'webhook_secret' => array(
                    'title' => 'Secret Webhook (whsec_...)',
                    'type' => 'password',
                    'description' => 'Utilisé pour sécuriser les notifications de paiement.',
                )
            );
        }

        public function process_payment($order_id) {
            $order = wc_get_order($order_id);

            $response = wp_remote_post($this->api_url . '/checkout/sessions', array(
                'method'    => 'POST',
                'headers'   => array(
                    'Authorization' => 'Bearer ' . $this->secret_key,
                    'Content-Type'  => 'application/json',
                ),
                'body'      => wp_json_encode(array(
                    'amount'         => round($order->get_total()),
                    'currency'       => $order->get_currency(),
                    'description'    => 'Commande #' . $order->get_order_number(),
                    'reference'      => $order->get_order_number() . '_' . time(),
                    'customer_email' => $order->get_billing_email(),
                    'customer_name'  => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                    'return_url'     => $this->get_return_url($order),
                    'metadata'       => array(
                        'order_id' => $order_id
                    )
                )),
                'timeout'   => 45,
            ));

            if (is_wp_error($response)) {
                wc_add_notice('Erreur de connexion à la passerelle.', 'error');
                return;
            }

            $body = json_decode(wp_remote_retrieve_body($response), true);

            if (empty($body['ok'])) {
                wc_add_notice('Erreur FIP: ' . ($body['error'] ?? 'Inconnue'), 'error');
                return;
            }

            return array(
                'result'   => 'success',
                'redirect' => $body['data']['checkout_url']
            );
        }

        public function check_fip_webhook() {
            $raw_body = file_get_contents('php://input');
            $signature_header = $_SERVER['HTTP_X_FIP_SIGNATURE'] ?? '';

            if (empty($signature_header) || empty($raw_body)) {
                status_header(400);
                exit;
            }

            parse_str(str_replace(',', '&', $signature_header), $parts);
            $t = $parts['t'] ?? '';
            $v1 = $parts['v1'] ?? '';

            $expected_v1 = hash_hmac('sha256', $t . '.' . $raw_body, $this->webhook_secret);

            if (!hash_equals($expected_v1, $v1)) {
                status_header(401);
                exit;
            }

            $payload = json_decode($raw_body, true);
            if ($payload['event'] === 'payment.succeeded') {
                $order_id = $payload['data']['metadata']['order_id'] ?? null;
                if ($order_id) {
                    $order = wc_get_order($order_id);
                    $order->payment_complete($payload['data']['reference']);
                    $order->add_order_note('Paiement confirmé via F.I.P. Réf: ' . $payload['data']['reference']);
                }
            }

            status_header(200);
            exit;
        }
    }
}

/**
 * Add the gateway to WooCommerce
 */
add_filter('woocommerce_payment_gateways', 'fip_paiement_add_gateway');
function fip_paiement_add_gateway($gateways) {
    $gateways[] = 'WC_Gateway_FIP';
    return $gateways;
}

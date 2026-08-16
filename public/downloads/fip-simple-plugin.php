<?php
/**
 * Plugin Name: FASO INVEST PAY Simple Payment
 * Description: Intégration simple et sécurisée de paiement pour votre site. Configurez vos clés API et commencez à accepter des paiements.
 * Version: 1.0.1
 * Author: FASO INVEST PAY - Guy ROUAMBA
 * License: GPL-2.0+
 */

if (!defined('ABSPATH')) exit;

class FIP_Simple_Payment {
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'settings_init'));
        add_shortcode('fip_payment_button', array($this, 'payment_button_shortcode'));
    }

    public function add_admin_menu() {
        add_menu_page(
            'FASO INVEST PAY',
            'FASO INVEST PAY',
            'manage_options',
            'fip_payment',
            array($this, 'settings_page'),
            'dashicons-money-alt'
        );
    }

    public function settings_init() {
        register_setting('fip_settings', 'fip_api_key');
        register_setting('fip_settings', 'fip_webhook_secret');
        
        add_settings_section('fip_main_section', 'Configuration API', null, 'fip_settings');
        
        add_settings_field('fip_api_key', 'Clé API Secrète', array($this, 'api_key_render'), 'fip_settings', 'fip_main_section');
        add_settings_field('fip_webhook_secret', 'Secret Webhook', array($this, 'webhook_secret_render'), 'fip_settings', 'fip_main_section');
    }

    public function api_key_render() {
        $value = get_option('fip_api_key');
        echo '<input type="password" name="fip_api_key" value="' . esc_attr($value) . '" class="regular-text">';
    }

    public function webhook_secret_render() {
        $value = get_option('fip_webhook_secret');
        echo '<input type="password" name="fip_webhook_secret" value="' . esc_attr($value) . '" class="regular-text">';
    }

    public function settings_page() {
        ?>
        <div class="wrap">
            <h1>Réglages FASO INVEST PAY</h1>
            <form action="options.php" method="post">
                <?php
                settings_fields('fip_settings');
                do_settings_sections('fip_settings');
                submit_button();
                ?>
            </form>
            <div class="card" style="margin-top:20px; padding:15px; background:#fff; border:1px solid #ccd0d4; border-radius:8px;">
                <h2>Utilisation</h2>
                <p>Utilisez le shortcode suivant pour afficher un bouton de paiement sécurisé :</p>
                <code>[fip_payment_button amount="1000" currency="XOF" description="Achat Produit"]</code>
                <p style="font-size:12px; color:#666; margin-top:10px;">Les paiements sont traités via la plateforme sécurisée FASO INVEST PAY.</p>
            </div>
        </div>
        <?php
    }

    public function payment_button_shortcode($atts) {
        $a = shortcode_atts(array(
            'amount' => '100',
            'currency' => 'XOF',
            'description' => 'Paiement',
        ), $atts);

        $api_key = get_option('fip_api_key');
        if (!$api_key) return '<p style="color:red;">Erreur: Clé API FASO INVEST PAY non configurée.</p>';

        // Création sécurisée de la session via l'API (côté serveur pour éviter l'exposition des secrets)
        $api_url = 'https://bbepprxkkwdfzmiycqqi.supabase.co/functions/v1/pay/v1/checkout/sessions';
        
        $response = wp_remote_post($api_url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json',
            ),
            'body' => wp_json_encode(array(
                'amount'      => intval($a['amount']),
                'currency'    => sanitize_text_field($a['currency']),
                'description' => sanitize_text_field($a['description']),
                'reference'   => 'SIMPLE-' . time() . '-' . wp_generate_password(4, false),
                'return_url'  => home_url('/'),
            )),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            return '<p style="color:red;">Erreur de connexion à FASO INVEST PAY.</p>';
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if (empty($body['ok'])) {
            return '<p style="color:red;">Erreur FIP: ' . esc_html($body['error'] ?? 'Service indisponible') . '</p>';
        }

        return '<a href="' . esc_url($body['data']['checkout_url']) . '" class="button button-primary" style="background:#3B82F6; color:white; padding:10px 20px; border-radius:5px; text-decoration:none; display:inline-block; font-weight:bold;">Payer avec FASO INVEST PAY</a>';
    }
}

new FIP_Simple_Payment();

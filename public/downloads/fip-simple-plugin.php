<?php
/**
 * Plugin Name: F.I.P Simple Payment
 * Description: Intégration simple de paiement pour votre site. Configurez vos clés API et commencez à accepter des paiements.
 * Version: 1.0.0
 * Author: F.I.P Fintech
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
            'F.I.P Payment',
            'F.I.P Payment',
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
            <h1>Réglages F.I.P Payment</h1>
            <form action="options.php" method="post">
                <?php
                settings_fields('fip_settings');
                do_settings_sections('fip_settings');
                submit_button();
                ?>
            </form>
            <div class="card">
                <h2>Utilisation</h2>
                <p>Utilisez le shortcode suivant pour afficher un bouton de paiement :</p>
                <code>[fip_payment_button amount="1000" currency="XOF" description="Achat Produit"]</code>
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

        // Logique de génération de lien sécurisé vers la passerelle
        $api_key = get_option('fip_api_key');
        if (!$api_key) return '<p style="color:red;">Erreur: Clé API F.I.P non configurée.</p>';

        $checkout_url = "https://pay.faso-invest.com/pay?amount=" . $a['amount'] . "&currency=" . $a['currency'] . "&desc=" . urlencode($a['description']);
        
        return '<a href="' . esc_url($checkout_url) . '" class="button button-primary" style="background:#3B82F6; color:white; padding:10px 20px; border-radius:5px; text-decoration:none;">Payer avec F.I.P</a>';
    }
}

new FIP_Simple_Payment();

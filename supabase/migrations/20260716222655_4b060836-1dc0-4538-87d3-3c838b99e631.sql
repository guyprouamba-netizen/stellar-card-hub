
-- SMS CONFIG (singleton)
CREATE TABLE public.sms_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  sender_id text NOT NULL DEFAULT 'FASOINVEST',
  admin_phones text[] NOT NULL DEFAULT '{}',
  notify_admin boolean NOT NULL DEFAULT true,
  event_wallet_recharge boolean NOT NULL DEFAULT true,
  event_card_recharge boolean NOT NULL DEFAULT true,
  event_withdrawal boolean NOT NULL DEFAULT true,
  event_withdrawal_paid boolean NOT NULL DEFAULT true,
  daily_limit int NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_config TO authenticated;
GRANT ALL ON public.sms_config TO service_role;
ALTER TABLE public.sms_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages sms_config" ON public.sms_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_sms_config_updated BEFORE UPDATE ON public.sms_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sms_config (id) VALUES (gen_random_uuid());

-- SMS TEMPLATES
CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE, -- wallet_recharge_user, wallet_recharge_admin, card_recharge_user, card_recharge_admin, withdrawal_request_user, withdrawal_request_admin, withdrawal_paid_user, custom
  label text NOT NULL,
  body text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages sms_templates" ON public.sms_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_sms_templates_updated BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sms_templates (event_key, label, body) VALUES
  ('wallet_recharge_user', 'Client - Recharge portefeuille', 'Bonjour {name}, votre portefeuille a été rechargé de {amount} {currency}. Nouveau solde: {balance} {currency}. Merci de votre confiance - FASO-INVEST PAY.'),
  ('wallet_recharge_admin', 'Admin - Recharge portefeuille', '[ADMIN] {name} vient de recharger son portefeuille de {amount} {currency}. Solde: {balance} {currency}.'),
  ('card_recharge_user', 'Client - Recharge carte', 'Bonjour {name}, votre carte a été rechargée de {amount} USD. Merci - FASO-INVEST PAY.'),
  ('card_recharge_admin', 'Admin - Recharge carte', '[ADMIN] {name} a rechargé sa carte de {amount} USD.'),
  ('withdrawal_request_user', 'Client - Demande de retrait', 'Bonjour {name}, votre demande de retrait de {amount} {currency} a été reçue. Traitement en cours.'),
  ('withdrawal_request_admin', 'Admin - Demande de retrait', '[ADMIN] {name} demande un retrait de {amount} {currency}. Merci de vérifier.'),
  ('withdrawal_paid_user', 'Client - Retrait payé', 'Bonjour {name}, votre retrait de {amount} {currency} a été effectué. Merci de votre confiance.');

-- SMS LOGS
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  message text NOT NULL,
  event_key text,
  user_id uuid,
  status text NOT NULL DEFAULT 'pending', -- pending, success, failed
  provider_response jsonb,
  provider_uid text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads sms_logs" ON public.sms_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- SMS CONTACTS (carnet perso)
CREATE TABLE public.sms_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  phone text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_contacts TO authenticated;
GRANT ALL ON public.sms_contacts TO service_role;
ALTER TABLE public.sms_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages sms_contacts" ON public.sms_contacts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_sms_contacts_updated BEFORE UPDATE ON public.sms_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

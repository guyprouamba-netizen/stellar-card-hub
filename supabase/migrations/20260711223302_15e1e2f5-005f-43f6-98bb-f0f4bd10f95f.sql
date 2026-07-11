
-- bot_config: one row per whatsapp_session
CREATE TABLE public.bot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  link_removal boolean NOT NULL DEFAULT true,
  link_whitelist text[] NOT NULL DEFAULT '{}',
  warnings_enabled boolean NOT NULL DEFAULT true,
  warnings_threshold int NOT NULL DEFAULT 3,
  warning_expire_days int NOT NULL DEFAULT 7,
  reject_calls boolean NOT NULL DEFAULT true,
  call_spam_threshold int NOT NULL DEFAULT 3,
  call_spam_window_min int NOT NULL DEFAULT 10,
  call_block_hours int NOT NULL DEFAULT 24,
  human_mode boolean NOT NULL DEFAULT true,
  human_min_ms int NOT NULL DEFAULT 2000,
  human_max_ms int NOT NULL DEFAULT 8000,
  night_mode boolean NOT NULL DEFAULT true,
  night_start_hour int NOT NULL DEFAULT 22,
  night_end_hour int NOT NULL DEFAULT 7,
  welcome_enabled boolean NOT NULL DEFAULT true,
  welcome_message text NOT NULL DEFAULT 'Bienvenue {{name}} 👋 Merci de respecter les règles du groupe.',
  ai_enabled boolean NOT NULL DEFAULT true,
  ai_dm_only boolean NOT NULL DEFAULT true,
  ai_persona text NOT NULL DEFAULT 'Tu es l''assistant du marchand. Sois chaleureux, bref, professionnel.',
  ai_language text NOT NULL DEFAULT 'fr',
  rate_per_minute int NOT NULL DEFAULT 8,
  rate_per_hour int NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_config TO authenticated;
GRANT ALL ON public.bot_config TO service_role;
ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage bot_config" ON public.bot_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_config.session_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_config.session_id AND b.owner_id=auth.uid()));
CREATE TRIGGER bot_config_updated_at BEFORE UPDATE ON public.bot_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- bot_groups: per-group overrides
CREATE TABLE public.bot_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  name text,
  active boolean NOT NULL DEFAULT true,
  link_removal_override boolean,
  warnings_enabled_override boolean,
  welcome_enabled_override boolean,
  welcome_message text,
  rules text,
  member_count int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, group_jid)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_groups TO authenticated;
GRANT ALL ON public.bot_groups TO service_role;
ALTER TABLE public.bot_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage bot_groups" ON public.bot_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_groups.session_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_groups.session_id AND b.owner_id=auth.uid()));
CREATE TRIGGER bot_groups_updated_at BEFORE UPDATE ON public.bot_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- bot_warnings
CREATE TABLE public.bot_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  user_jid text NOT NULL,
  count int NOT NULL DEFAULT 0,
  reason text,
  last_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  banned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, group_jid, user_jid)
);
CREATE INDEX bot_warnings_lookup ON public.bot_warnings(session_id, group_jid, user_jid);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_warnings TO authenticated;
GRANT ALL ON public.bot_warnings TO service_role;
ALTER TABLE public.bot_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read bot_warnings" ON public.bot_warnings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_warnings.session_id AND b.owner_id=auth.uid()));

-- bot_call_events
CREATE TABLE public.bot_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  from_jid text NOT NULL,
  event text NOT NULL,
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_call_events_lookup ON public.bot_call_events(session_id, from_jid, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_call_events TO authenticated;
GRANT ALL ON public.bot_call_events TO service_role;
ALTER TABLE public.bot_call_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read bot_call_events" ON public.bot_call_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_call_events.session_id AND b.owner_id=auth.uid()));

-- bot_ai_faq (per business)
CREATE TABLE public.bot_ai_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_ai_faq_business ON public.bot_ai_faq(business_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_ai_faq TO authenticated;
GRANT ALL ON public.bot_ai_faq TO service_role;
ALTER TABLE public.bot_ai_faq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage bot_ai_faq" ON public.bot_ai_faq FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=bot_ai_faq.business_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=bot_ai_faq.business_id AND b.owner_id=auth.uid()));
CREATE TRIGGER bot_ai_faq_updated_at BEFORE UPDATE ON public.bot_ai_faq FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- bot_ai_conversations
CREATE TABLE public.bot_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  contact_jid text NOT NULL,
  contact_name text,
  handoff boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, contact_jid)
);
CREATE INDEX bot_ai_conv_session ON public.bot_ai_conversations(session_id, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_ai_conversations TO authenticated;
GRANT ALL ON public.bot_ai_conversations TO service_role;
ALTER TABLE public.bot_ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage bot_ai_conversations" ON public.bot_ai_conversations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_ai_conversations.session_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_ai_conversations.session_id AND b.owner_id=auth.uid()));
CREATE TRIGGER bot_ai_conv_updated_at BEFORE UPDATE ON public.bot_ai_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- bot_ai_messages
CREATE TABLE public.bot_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.bot_ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','human')),
  content text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_ai_msg_conv ON public.bot_ai_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_ai_messages TO authenticated;
GRANT ALL ON public.bot_ai_messages TO service_role;
ALTER TABLE public.bot_ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read bot_ai_messages" ON public.bot_ai_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bot_ai_conversations c JOIN public.whatsapp_sessions s ON s.id=c.session_id JOIN public.businesses b ON b.id=s.business_id WHERE c.id=bot_ai_messages.conversation_id AND b.owner_id=auth.uid()));
CREATE POLICY "Owner insert bot_ai_messages" ON public.bot_ai_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_ai_conversations c JOIN public.whatsapp_sessions s ON s.id=c.session_id JOIN public.businesses b ON b.id=s.business_id WHERE c.id=bot_ai_messages.conversation_id AND b.owner_id=auth.uid()));

-- bot_logs
CREATE TABLE public.bot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  group_jid text,
  user_jid text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_logs_session ON public.bot_logs(session_id, created_at DESC);
GRANT SELECT, INSERT ON public.bot_logs TO authenticated;
GRANT ALL ON public.bot_logs TO service_role;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read bot_logs" ON public.bot_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_logs.session_id AND b.owner_id=auth.uid()));

-- bot_menus
CREATE TABLE public.bot_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  group_jid text,
  name text NOT NULL,
  trigger text NOT NULL,
  kind text NOT NULL DEFAULT 'buttons' CHECK (kind IN ('buttons','list','text')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_menus TO authenticated;
GRANT ALL ON public.bot_menus TO service_role;
ALTER TABLE public.bot_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage bot_menus" ON public.bot_menus FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_menus.session_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.whatsapp_sessions s JOIN public.businesses b ON b.id=s.business_id WHERE s.id=bot_menus.session_id AND b.owner_id=auth.uid()));
CREATE TRIGGER bot_menus_updated_at BEFORE UPDATE ON public.bot_menus FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default bot_config for existing sessions
INSERT INTO public.bot_config (session_id, business_id)
SELECT s.id, s.business_id FROM public.whatsapp_sessions s
ON CONFLICT (session_id) DO NOTHING;

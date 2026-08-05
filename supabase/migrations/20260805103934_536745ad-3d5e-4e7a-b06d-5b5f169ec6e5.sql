-- 1. Sessions de visite
CREATE TABLE public.analytics_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_key text,
  is_returning boolean NOT NULL DEFAULT false,
  country text,
  country_code text,
  city text,
  device_type text,
  browser text,
  os text,
  referrer text,
  source text NOT NULL DEFAULT 'direct',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_path text,
  page_views integer NOT NULL DEFAULT 0,
  duration_ms bigint NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.analytics_sessions TO authenticated;
GRANT INSERT, UPDATE ON public.analytics_sessions TO anon;
GRANT ALL ON public.analytics_sessions TO service_role;
ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can record a session" ON public.analytics_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone can refresh a session" ON public.analytics_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admins read sessions" ON public.analytics_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_analytics_sessions_started ON public.analytics_sessions (started_at DESC);
CREATE INDEX idx_analytics_sessions_last_seen ON public.analytics_sessions (last_seen_at DESC);
CREATE INDEX idx_analytics_sessions_user ON public.analytics_sessions (user_id);
CREATE TRIGGER trg_analytics_sessions_updated BEFORE UPDATE ON public.analytics_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Evenements (pages vues + actions cles)
CREATE TABLE public.analytics_events (
  id bigserial PRIMARY KEY,
  session_key text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'pageview',
  path text,
  title text,
  action text,
  funnel_step text,
  duration_ms integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT INSERT ON public.analytics_events TO anon;
GRANT USAGE ON SEQUENCE public.analytics_events_id_seq TO anon, authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can record an event" ON public.analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read events" ON public.analytics_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_analytics_events_created ON public.analytics_events (created_at DESC);
CREATE INDEX idx_analytics_events_session ON public.analytics_events (session_key);
CREATE INDEX idx_analytics_events_kind ON public.analytics_events (kind, created_at DESC);
CREATE INDEX idx_analytics_events_path ON public.analytics_events (path);
CREATE INDEX idx_analytics_events_user ON public.analytics_events (user_id);

-- 3. Assistant IA du dashboard
CREATE TABLE public.dashboard_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_ai_conversations TO authenticated;
GRANT ALL ON public.dashboard_ai_conversations TO service_role;
ALTER TABLE public.dashboard_ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai conversations" ON public.dashboard_ai_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_dash_ai_conv_updated BEFORE UPDATE ON public.dashboard_ai_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.dashboard_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.dashboard_ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  chart jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dashboard_ai_messages TO authenticated;
GRANT ALL ON public.dashboard_ai_messages TO service_role;
ALTER TABLE public.dashboard_ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai messages" ON public.dashboard_ai_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dashboard_ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "insert own ai messages" ON public.dashboard_ai_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.dashboard_ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE INDEX idx_dash_ai_messages_conv ON public.dashboard_ai_messages (conversation_id, created_at);

-- 4. Journal d'audit des consultations de donnees personnelles
CREATE TABLE public.admin_audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit log" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_admin_audit_created ON public.admin_audit_log (created_at DESC);
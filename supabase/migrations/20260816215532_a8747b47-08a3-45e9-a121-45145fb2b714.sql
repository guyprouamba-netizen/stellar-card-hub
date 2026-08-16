
ALTER TABLE public.sms_config 
ADD COLUMN IF NOT EXISTS notify_admin_sender_request boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS event_sender_request boolean DEFAULT false;

GRANT ALL ON public.sms_config TO authenticated;
GRANT ALL ON public.sms_config TO service_role;

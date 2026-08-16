INSERT INTO public.platform_config (key, value) 
VALUES ('admin_notification_phone', '"07933364"') 
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
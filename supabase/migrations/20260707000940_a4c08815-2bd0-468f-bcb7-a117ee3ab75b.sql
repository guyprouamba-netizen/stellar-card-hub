CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('faso-reconcile-deposits','faso-reconcile-withdrawals')
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'faso-reconcile-deposits',
  '*/2 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://bbepprxkkwdfzmiycqqi.supabase.co/functions/v1/reconcile-deposits',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZXBwcnhra3dkZnptaXljcXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDE1NjEsImV4cCI6MjA5NjE3NzU2MX0.iulWyy9tZnPVfF4rNqdipNICUpMLOmGfvPJbl3oofxo'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'faso-reconcile-withdrawals',
  '*/3 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://bbepprxkkwdfzmiycqqi.supabase.co/functions/v1/reconcile-withdrawals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZXBwcnhra3dkZnptaXljcXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDE1NjEsImV4cCI6MjA5NjE3NzU2MX0.iulWyy9tZnPVfF4rNqdipNICUpMLOmGfvPJbl3oofxo'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule reconcile-withdrawals every minute via pg_cron + pg_net
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  -- Unschedule any previous job with the same name
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'reconcile-withdrawals-every-minute';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'reconcile-withdrawals-every-minute',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://bbepprxkkwdfzmiycqqi.supabase.co/functions/v1/reconcile-withdrawals',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $cron$
);

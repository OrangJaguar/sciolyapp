-- Plan 03 — schedule generate-dispatcher (optional helper)
-- Prerequisites: enable extensions pg_cron + pg_net in the Supabase dashboard.
-- Replace PROJECT_REF and SERVICE_ROLE_KEY before running.

-- select cron.unschedule('generation-dispatcher-drain');

select cron.schedule(
  'generation-dispatcher-drain',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/generate-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object('burstCap', 50)
  );
  $$
);

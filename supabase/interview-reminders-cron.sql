-- Run once in Supabase SQL Editor AFTER deploying the endpoint and migration.
-- Enable Cron (pg_cron) and pg_net in Supabase first.
-- In Supabase Vault create:
--   prept_app_url: your production HTTPS origin (without a trailing slash)
--   prept_cron_secret: exactly the CRON_SECRET configured in Vercel
-- Never commit actual secret values to this file.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'prept_app_url')
    OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'prept_cron_secret') THEN
    RAISE EXCEPTION 'Create prept_app_url and prept_cron_secret in Supabase Vault first';
  END IF;
END $$;

SELECT cron.schedule(
  'prept-interview-reminders',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'prept_app_url'), '/')
        || '/api/cron/interview-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'prept_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);

-- To disable reminders:
-- SELECT cron.unschedule('prept-interview-reminders');
-- HTTP delivery results (a cron success alone only means the request was queued):
-- SELECT id, status_code, timed_out, error_msg, created FROM net._http_response ORDER BY id DESC LIMIT 20;

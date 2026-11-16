# Meeting feedback recovery

Completed interviews now generate feedback when the interviewer ends the interview. Signed Stream completion/recording/transcript events and explicitly opening a meeting's feedback also recover missing reports. Loading the appointments page does not request reports or show feedback error toasts. The feedback dialog provides an explicit retry and displays failures.

The report uses readable original transcripts first. Without usable transcript speech, it uses saved delivered questions, submitted answers (including MCQ selections), approved grades, and paginated chat messages from the two assigned participants. Internal reference answers and interviewer notes are excluded. Missing evidence and provider failures are reported explicitly; the system does not invent a performance report when no evidence exists. Cancelled and active interviews do not receive final feedback. Existing reports and earnings remain idempotent.

For unattended recovery of older meetings, deploy the endpoint and run [the scheduler SQL](../supabase/meeting-feedback-cron.sql) in Supabase after configuring `pg_cron`, `pg_net`, and Vault secrets `prept_app_url` and `prept_cron_secret`. The latter must match the deployed `CRON_SECRET` (at least 32 characters). This schedules authenticated POST requests to `/api/cron/meeting-feedback` every five minutes. Each request attempts three missing reports; failures return HTTP 503 with meeting IDs and safe diagnostic messages. Successful cron submission is not proof of successful HTTP processing: inspect `net._http_response` as shown in the SQL file.

This source change does not deploy the application or activate the scheduler. No schema migration is required. No tests, build, or lint were run, as requested.

Task 3 fixture cleanup removed 10 explicitly identified synthetic accounts and 5 associated meetings. The cleanup reported zero remaining Task 3 fixture accounts and zero Stream cleanup errors; remote user deletion requests were submitted successfully.

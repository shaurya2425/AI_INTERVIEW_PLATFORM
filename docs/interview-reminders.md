# Interview email reminders

Both participants receive separate emails 6 hours and 30 minutes before the interview. The email includes the date, time, role, other participant's name, duration, and join link. All times and the same-day rule use **Asia/Kolkata (IST)**.

A reminder that falls on the previous calendar day is skipped. For example, a 5 AM interview gets the 4:30 AM reminder, but no 11 PM reminder. A 12:15 AM interview gets neither reminder. Bookings made after a reminder's target time do not get that reminder retroactively. Cancelled, completed, or already-started bookings are skipped.

## Activate on Vercel Hobby + Supabase

Vercel Hobby's daily cron frequency is insufficient. Supabase Cron invokes the protected Vercel endpoint every minute; no Vercel paid cron plan is required.

1. Verify a sending domain in Resend. Its `onboarding@resend.dev` test sender cannot send to arbitrary participants.
2. Configure these **server environment variables in Vercel**, then redeploy:

   ```dotenv
   RESEND_API_KEY=your_resend_api_key
   REMINDER_EMAIL_FROM="Prept <reminders@your-verified-domain.com>"
   CRON_SECRET=a_random_secret_at_least_32_characters_long
   NEXT_PUBLIC_APP_URL=https://your-production-domain.com
   ```

   Generate a secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Store it privately; do not commit it. Use your production domain, not a preview deployment protected by a Vercel login.
3. Apply the additive database migration using your target database connection:

   ```sh
   npx prisma migrate deploy
   npx prisma generate
   ```

4. Enable **Cron (`pg_cron`)** and **`pg_net`** in Supabase. In Supabase Vault, create `prept_app_url` (the production origin) and `prept_cron_secret` (the same value as Vercel's `CRON_SECRET`).
5. Run [`supabase/interview-reminders-cron.sql`](../supabase/interview-reminders-cron.sql) in the Supabase SQL Editor. Running it again updates the named schedule.
6. Check Supabase's `net._http_response` and Vercel function logs. Successful HTTP responses include counts of sent, skipped, and failed reminders. A Cron success only confirms that the HTTP request was queued. `401` means the secret differs; `503` can indicate missing configuration or a rejected email; `500` indicates a processing/database failure.

No email is sent merely by running tests or building the app. The scheduler is not activated by this repository change. `npm run dev` does not run the scheduler.

## Delivery and retries

The scheduler sends at the first minute tick after the target time, subject to provider delivery delay. A ten-minute grace window allows retry after a brief outage; it does not send old reminders hours late. Each recipient, interview start time, and reminder type has a durable record in `InterviewReminder`. A failed recipient retries independently, without resending to the successful recipient. Resend idempotency keys also protect retries after an accepted email whose database acknowledgment failed. The stored email payload remains identical across retries.

Delivery windows are shorter than Resend's 24-hour idempotency-key lifetime. The sender stops after roughly 45 seconds, and subsequent ticks pick up unsent reminders. Watch job counts and provider quotas as volume grows. A long scheduler outage or exhausted email quota can cause reminders to be missed; this feature cannot guarantee inbox delivery.

Existing upcoming bookings are included automatically. Recipient addresses come from the users' stored Supabase email fields. Name/image sync does not currently change email addresses. Changing a booking start time creates a separate reminder identity; the worker checks cancellation and start time again immediately before sending. A cancellation racing an already-in-flight provider request cannot recall that email.

Sources: [Supabase scheduling with Vault](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

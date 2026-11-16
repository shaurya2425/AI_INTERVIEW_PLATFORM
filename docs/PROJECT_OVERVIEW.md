# Prept: T00 project baseline

Audit date: 2026-11-14 (Asia/Calcutta). Scope: repository inspection and documentation only.

Prept currently combines Clerk identity, interviewer discovery and booking, credits, Stream video/chat, interviewer-only AI Buddy, and transcript-based meeting feedback. The roadmap extends this into persisted question delivery, candidate submissions, assisted evaluation, adaptive memory, and evidence-grounded reports. Existing source is implementation evidence, not proof of working production behavior.

## Git and validation baseline

| Item | Observed value |
| --- | --- |
| Current branch / HEAD | `development`, `496a205` — `feat: expand AI Buddy and resolve lint errors` |
| Local remote-tracking development | `origin/development` = `496a205`; ahead/behind = 0/0 |
| Local main and origin/main | `6203bda` — `Merge pull request #1 from shaurya2425/development` |
| Pre-existing tracked modification | `components/header.jsx` uses the client-only account widget |
| Pre-existing untracked file | `components/AccountUserButton.jsx`, dynamic Clerk UserButton with `ssr: false` |
| Remote freshness | No fetch performed for T00; tracking refs do not prove current GitHub state |
| T00 mutations | Only the three new audit documents in `docs/` |

The roadmap's earlier “5 modified / 6 untracked” AI Buddy snapshot is obsolete. Those eleven files and five lint-related files were committed in `496a205`. The current hydration fix is additional uncommitted work, preserved by this audit. No checkout, commit, push, reset, migration, dependency installation, or deployment was performed.

Tests, lint, builds and browser workflows were **not run in T00**, per the user's instruction to skip testing for now. Earlier conversation tool results recorded passing lint/build for `496a205` and for the local hydration change; those are historical checks, not T00 runtime verification. The reported recurring page reloads and signed-in hydration issue have not been verified resolved in a browser.

Read-only validation: Git status/history/reference comparison, source and installed SDK inspection, migration/config/test inventory, `git diff --check`, documentation path checks, and hashes of the pre-existing local changes. No live database or provider settings were queried; environment variable names were inventoried from source without copying secret values.

## Feature inventory

“Present” below means code exists and was inspected. No feature is certified end-to-end by this audit.

| Area | Source status and location | Remaining work |
| --- | --- | --- |
| Authentication / profile | Present: `proxy.js`, `components/theme-provider.jsx`, `components/header.jsx`, `lib/checkUser.js`, `actions/onboarding.js`, `actions/user.js`, `components/ClerkProfileSync.jsx` | Verify signed-in hydration and role boundaries; profile sync refresh is not proof of the reload-loop cause |
| Booking / availability / credits | Present: `actions/bookings.js`, `actions/dashboard.js`, `actions/appointments.js`, `app/(main)/interviewers/[id]/components/SlotPicker.jsx` | Atomic booking guards, complete server availability validation, external-call cleanup |
| Video / ordinary chat | Present: `actions/call.js`, `app/(main)/call/[callId]/page.jsx`, `CallRoom.jsx` and `CallUI.jsx` in that route's `components/` | Token refresh and real two-user lifecycle checks; Stream dashboard permissions unverified |
| Conversational AI Buddy | Partial roadmap implementation: `actions/aiQuestions.js`, `lib/interviewCatalog.js`, `lib/questionBank.js`; route components `AIQuestions.jsx`, `AIBuddyFilters.jsx`, `AIResponse.jsx` | Exact counts/types and query/filter precedence need verification; centralized provider error policy missing |
| Question cards / Grill / grading | Local-only: route components `AIQuestionCard.jsx`, `AIGrillComposer.jsx`, `AIQuestions.jsx` | Select/Asked/Skip and manual grades are client state, not delivered questions or persisted assessments; Focus remains |
| Candidate question delivery / answers | Missing | No question/submission Prisma models, confirmed send action, Stream question card protocol, candidate answer forms or microphone dictation |
| Automatic evaluation / shared memory | Missing | No persisted MCQ keys, submission evaluation, approval/version history or cross-client status synchronization |
| Recording / transcript | Partial: `actions/bookings.js`, `actions/call.js`, `app/api/webhooks/stream/route.js`, `lib/meeting-feedback.js` | Original transcript fetched from Stream, but not stored as timestamped evidence; mixed-language quality unverified |
| Final feedback | **Already present**: `lib/meeting-feedback.js`, `lib/meeting-outcome.js`, `actions/feedback.js`, `components/AppointmentCard.jsx`, `components/FeedbackModal.jsx` | Transcript-only, no chat/submission/grade evidence, report versions, private projections or durable processing lifecycle |
| Background processing | Reminder system exists: `app/api/cron/interview-reminders/route.js`, `lib/reminder-delivery.mjs`, `lib/reminder-policy.mjs`, `supabase/interview-reminders-cron.sql` | Scheduler activation unverified; no equivalent durable feedback job system found |
| Tests / docs | Five Node test files; `README.md`, `docs/interview-reminders.md` existed before T00 | No existing task tracker/completed T00 documentation; integration coverage and release validation deferred |

## Findings and risk register

Severity is an audit priority based on source, not a claim that an exploit or failure was reproduced. Planned missing features are distinguished from defects.

| ID / priority | Finding and evidence | Follow-up |
| --- | --- | --- |
| R01 / High | `app/(main)/payout/[id]/page.jsx` reads and sends payout/payment details and recipient email without an authorization check. Parent `app/(main)/layout.jsx` only adds spacing; `proxy.js` does not call `auth.protect`. `actions/payout.js` uses a shared password, with no authenticated admin role or action-level attempt limiter. | Escalate access-control fix as an explicitly scoped security ticket before release (T20); do not silently bundle into UI work. |
| R02 / High | `actions/bookings.js` checks balance/overlap before the transaction; schema has no overlap exclusion or atomic sufficient-balance guard. Concurrent requests can overspend or double book. A Stream call created before a failed transaction is not compensated. | Harden booking transaction/compensation under T20/T21; preserve existing records. |
| R03 / High | `lib/meeting-feedback.js` executes downloads and AI inline in webhook/recovery requests, with no durable job or AI timeout. It passes the full transcript to one model call. Slow/large interviews can exceed runtime/context limits. | T13–T19: persisted lifecycle, bounded evidence/chunks and retryable jobs. |
| R04 / High | `call.transcription_ready` webhook does not use `getMeetingOutcome` to verify the whole interview ended. First feedback prevents subsequent regeneration. Later sessions/transcripts can be omitted, and feedback persistence marks booking completed. | T13/T19: explicit finalization/readiness, versioning and delayed-evidence policy. |
| R05 / Medium | `getCallData` issues a one-hour token; `CallRoom` and chat receive a static string, with no renewal callback. Earlier session logs contained `AuthErrorTokenExpired`. Membership is checked, but no join-window/cancelled-status denial is enforced. | T01 review token lifecycle; T13/T20 define join/end policy. |
| R06 / Medium | Prior user reports show repeated compile/reload and a Clerk UserButton hydration mismatch. Local client-only wrapper exists but browser outcome remains unverified. | T01 reproduce and isolate; do not attribute reloads to a specific cause without evidence. |
| R07 / Medium | AI messages, answer references and grades are kept in `localStorage` under booking/call key, without user identity or logout cleanup. Shared browser accounts can retain another user's private interview material. History supplied to AI is client-controlled. | T05/T11 authoritative persistence and privacy-aware drafts; never use current state as verified candidate evidence. |
| R08 / Medium | AI Buddy has bounded history/messages/depth and two immediate structured-generation attempts, but no action-level rate limit, explicit AI deadline, classified quota/key/model errors or backoff. Web grounding errors are logged and silently dropped. | T04; video/chat must remain independent of AI failures. |
| R09 / Medium | Reference answers are returned to the authorized interviewer today. New delivery/report endpoints must use separate server projections; hiding answers in candidate JSX would be insufficient. Free-text instructions are sent to grounding when enabled, without a redaction layer. | T05–T10/T18/T20; minimize private input in research calls. |
| R10 / Medium | Feedback only retains prose and a rating, discarding transcript timestamps/evidence IDs. All current feedback fields are returned to both participants. No private assessment projection exists. | T14–T18; do not add confidential fields to existing shared payloads. |
| R11 / Medium | Webhook verifies raw-body signature and returns 500 on processing failure, but has no event ledger/job lease. Concurrent deliveries can duplicate AI calls before transaction serialization. Empty speech can return null and still be acknowledged 200. | T19/T21; retries and evidence insufficiency need persisted states. |
| R12 / Medium | Booking validates future time/range but does not enforce stored availability membership or expected slot duration server-side. | Booking hardening scope, not T00 implementation. |
| R13 / Low | `README.md` still describes old AI behavior, no test suite, unsigned webhooks, 200-on-failure and transcript preview logging. These conflict with current source. | Use this dated baseline and architecture doc for current facts; reconcile README during relevant documentation tasks. |

No broad security clearance is implied. Provider permissions, production secrets, consent/retention policy, deployment limits and real database migration status remain unverified.

## Prerequisites and configuration

Declared stack: Next `16.4.3`, React `19.3.0`, Prisma `7.4.2` with PostgreSQL adapter, Tailwind 4; Clerk, Stream Video/Chat and both Gemini SDK packages. Exact dependency resolutions are recorded in `package-lock.json`. No Node engine/version pin or CI workflow was found in the inspected inventory.

Required source configuration names (no values audited):

- Database: `DATABASE_URL`; Prisma generation targets `lib/generated/prisma`.
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, configured sign-in/up URLs and plan IDs/slugs. SDK configuration also relies on deployment settings.
- Stream: `NEXT_PUBLIC_STREAM_API_KEY`, `STREAM_SECRET_KEY`; default video calls, messaging channels, transcription/recording configuration and signed webhook URL.
- Gemini: `GEMINI_API_KEY`; optional `PREPT_GEMINI_MODEL` (AI Buddy default `gemini-2.5-flash`), `GEMINI_FEEDBACK_MODEL` (feedback default `gemini-3.5-flash-lite`). Model entitlement/availability not verified.
- Protection: `ARCJET_KEY`; optional `ARCJET_LOG_LEVEL`.
- Email/jobs: `RESEND_API_KEY`, `REMINDER_EMAIL_FROM`, `CRON_SECRET` (at least 32 characters), `NEXT_PUBLIC_APP_URL` (public HTTPS for reminders).
- Existing payout approval: `ADMIN_PAYOUT_PASSWORD`; do not treat it as a sufficient admin authorization design.

Committed migrations: `prisma/migrations/20261106125712_create_models/migration.sql` and `prisma/migrations/20261114120000_interview_reminders/migration.sql`. No migrations were applied or checked against a live database. The deployment documentation targets Vercel plus Supabase Cron, but actual hosting and scheduler activation were not inspected.

## Verification handoff (not executed)

When testing is re-enabled:

1. Run the five `tests/*.test.mjs` files with Node's test runner on a compatible Node installation; there is no `npm test` script. Run `npm.cmd run lint` and `npm.cmd run build` separately.
2. Open a signed-in call page, hard-refresh in light/dark modes, and inspect hydration errors and Network initiators with no source edits occurring. Compare signed-out navigation. Record actual results before closing R06.
3. Join one booking with separate interviewer/interviewee browser sessions; switch Chat/AI Buddy, exchange chat, generate questions, leave once, verify devices release and the remaining participant is not incorrectly finalized. Exercise token renewal beyond one hour after it is implemented.
4. Verify unrelated accounts cannot load the call or request its feedback. Audit payout access on a safe test deployment before testing with real payment data.
5. Exercise no-show, active call, ended call awaiting transcript, empty transcript and ready transcript. Confirm feedback ownership and duplicate webhook behavior using provider-supported test tooling; do not forge production events.
6. Verify reminder scheduling separately using `docs/interview-reminders.md`. Scheduler configuration, schema migration and email delivery are not implied by a successful build.

See [ARCHITECTURE.md](ARCHITECTURE.md) for data flow and [TASK_TRACKER.md](TASK_TRACKER.md) for dependencies and the T01 proposal.

# Prept architecture: inspected T00 baseline

Date: 2026-11-14. Source baseline and limitations: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md). This maps current code, not a replacement architecture.

## Application and trust boundaries

| Layer | Existing files | Responsibility |
| --- | --- | --- |
| Request middleware | `proxy.js` | Clerk middleware plus Arcjet shield/bot protection; webhook and reminder endpoints bypass bot checks and authenticate themselves |
| Root UI | `app/layout.js`, `components/theme-provider.jsx`, `components/header.jsx` | Themes, Clerk, header/profile synchronization and navigation |
| Identity / roles | `lib/checkUser.js`, `actions/onboarding.js`, `actions/user.js`, `components/RoleRedirect.jsx` | Local profile, plan credits, role onboarding and client navigation; client redirects are not authorization |
| Discovery / scheduling | `actions/explore.js`, `actions/bookings.js`, `actions/dashboard.js`, `lib/helpers.js`, `lib/time-validation.js` | Profiles, availability, slots, booking/credit writes and interviewer dashboard |
| Call authorization | `actions/call.js`, `app/(main)/call/[callId]/page.jsx` | Booking membership lookup, transcription settings and Stream token |
| Video session | `app/(main)/call/[callId]/components/CallRoom.jsx` | Stream client creation/join, connection errors, cleanup and post-leave navigation |
| Meeting layout/chat | `app/(main)/call/[callId]/components/CallUI.jsx` | Stream controls, messaging channel, interviewer-only AI tab; both panels remain mounted |
| AI workflow | `actions/aiQuestions.js`, `lib/interviewCatalog.js`, `lib/questionBank.js` | Request validation, subject detection, bank selection, dedupe, structured Gemini output, optional research |
| Feedback | `app/api/webhooks/stream/route.js`, `actions/feedback.js`, `lib/meeting-feedback.js`, `lib/meeting-outcome.js` | Transcript-ready handling, authorized recovery, generation/persistence and meeting-state interpretation |
| Feedback UI | `components/AppointmentCard.jsx`, `components/FeedbackModal.jsx`, `actions/appointments.js`, `actions/dashboard.js` | Participant appointments, feedback requests, shared report and retry UI |
| Operational jobs | `app/api/cron/interview-reminders/route.js`, `lib/reminder-policy.mjs`, `lib/reminder-delivery.mjs`, `supabase/interview-reminders-cron.sql` | Protected scheduler endpoint, due windows, persisted idempotent email attempts |
| Persistence/errors | `lib/prisma.js`, `prisma/schema.prisma`, `lib/action-result.js`, `hooks/use-fetch.js` | PostgreSQL pool/client, data model, safe action errors and UI loading/toasts |

## Current data flow

1. Clerk identity is read server-side. Header `checkUser` creates/synchronizes the local User and allocates plan credits when due. Onboarding writes the chosen role/profile. `ClerkProfileSync` can request a server update and router refresh after profile changes.
2. `bookSlot` validates candidate role, date range/future start, balance and booking conflicts. It creates a Stream call with both users as hosts, recording available and transcription `auto-on`/`auto`. It then creates Booking and deduction transaction and updates balances in a database transaction. Stream and PostgreSQL are not one atomic operation.
3. The call page requests `getCallData`, which authorizes either persisted participant, may update legacy scheduled-call transcription settings, and issues a one-hour user token. `CallRoom` creates and joins a Stream client; `CallUI` watches a `messaging` channel keyed by call ID with the two Clerk user IDs.
4. AI Buddy is interviewer-only in the UI and server action. `generateInterviewQuestions` calls `getCallData` for authorization; this also repeats Stream lookup/configuration/token work. Inputs include client history and active question, not verified database submissions. The server combines bank and generated questions and optionally obtains search context. Response includes interviewer reference answers and source links.
5. `AIQuestions.jsx` stores conversation, selected question, preferences, answer notes and grades in browser localStorage keyed by session/call. Select/Asked/Skip/Evaluated states are UI changes; there is no Stream send confirmation or candidate submission backend. Scroll effect reacts to message count and loading.
6. Stream recording-ready webhook stores the recording URL. Transcription-ready webhook lists original (non-translated) transcripts from Stream and invokes feedback generation inline. A participant can independently request recovery through `getMeetingFeedback`.
7. `generateMeetingFeedback` downloads each original JSONL transcript with a 15-second per-download timeout, keeps speech entries, labels speakers from Clerk IDs and joins text. The prompt allows Hindi/English switching and asks for limitations on ambiguous evidence. The older Gemini SDK produces JSON, which is field/type/rating validated. Transcript timestamps are not retained in the final data model.
8. Feedback persistence locks/updates the booking within a transaction, checks for existing feedback, creates one feedback record and conditionally an earning transaction. The booking becomes COMPLETED. The existing booking flow already increments interviewer balance when booked; feedback adds an earning ledger record rather than another balance increment.
9. Participants obtain the same stored feedback projection through appointments or `getMeetingFeedback`, shown in `FeedbackModal`. Existing reports short-circuit generation. Missing/active/no-show state is calculated at read time; it is not a durable report job state machine.

## Leave semantics

Installed SDK source `node_modules/@stream-io/video-react-sdk/src/components/CallControls/CancelCallButton.tsx` calls `call.leave()` before its `onLeave` callback. Current `CallUI.handleLeave` reports errors and delegates navigation; it does **not** call leave again. `CallRoom` cleanup awaits the pending connection and only leaves if state is not LEFT, then disconnects the client. This corrects the earlier unconditional duplicate call; race behavior still needs runtime verification. Neither client leave callback generates feedback directly. No explicit authoritative application-level interview-finalization action exists.

## Database map

| Model | Current role |
| --- | --- |
| User | Clerk identity, profile, role, plan credits and interviewer balance/rate |
| Availability | Interviewer window and status |
| Booking | Participant relations, scheduled times/status, unique Stream call ID, recording URL |
| Feedback | One row per booking; prose sections, strengths/improvements, four-level overall rating, optional session rating/comment |
| InterviewReminder | Deterministic ID, booking/recipient/time, immutable retry payload, attempts, sent marker/provider ID/error |
| CreditTransaction | Credit ledger with optional booking relation; no unique booking/type constraint |
| Payout | Withdrawal details/status and administrative processing fields |

There are no question, candidate submission, AI evaluation, approved grade, transcript segment, evidence snapshot, feedback version, webhook event ledger or feedback job models. AI catalog subjects are broader than Prisma's eight `InterviewCategory` values; T05 must choose how to represent question subjects without blindly changing booking enums.

## Security and reliability already present

- Call data checks persisted participant identities. AI generation further checks interviewer membership. Feedback recovery queries the booking through either participant relation.
- Stream webhook reads raw request text, checks `x-signature` through the installed SDK, validates JSON and ignores unrelated events. It resolves transcripts from Stream rather than trusting a caller-provided transcript URL. Processing exceptions return HTTP 500 for provider retry; invalid signatures return 401.
- Feedback write transaction rechecks existing feedback. This guards duplicate persistence, not duplicate model calls or late-evidence regeneration.
- Reminder endpoint checks a timing-safe bearer secret. Durable reminder IDs and provider idempotency keys protect delivery retries; no generalized feedback worker is present.
- `runAction` returns safe fallback messages for unexpected exceptions. AI Buddy currently lacks provider-specific error codes/deadlines. Manual grades and reference answers remain interviewer-local, not secure shared records.

## Configuration and existing verification assets

`next.config.mjs` enables Cache Components and partial prefetching, disables React Strict Mode, configures Tailwind's Turbopack CSS loader and a fixed allowed development origin. Google fonts are fetched through `next/font`. `eslint.config.mjs` extends Next core-web-vitals and excludes build output and generated Prisma files.

`package.json` defines dev/build/start/lint and postinstall Prisma generation, but no test script. Existing Node suites are `tests/action-errors.test.mjs`, `tests/clerk-profile.test.mjs`, `tests/interview-reminders.test.mjs`, `tests/meeting-outcome.test.mjs`, and `tests/user-name.test.mjs`. They cover utility/mocked-action behavior; no full two-browser interview or AI workflow suite was found. None was executed in T00.

Existing deployment notes: `README.md`, `docs/interview-reminders.md`, and `supabase/interview-reminders-cron.sql`. Supabase Cron is documented for reminders only; it is not proof that any scheduler is deployed. No repository CI workflow or dedicated feedback queue configuration was found. Live Stream permission policies, service quotas, database state, retention/deletion and consent configuration remain external prerequisites.

## Roadmap integration boundaries

Preserve CallRoom/video ownership, CallUI/layout and chat, and AIQuestions/conversation ownership. Extend the existing feedback module, recovery action and modal rather than creating a parallel reporting system. T05 must precede delivery/submission work; T11 must consume persisted answers and approved grades. T13–T19 must replace transcript-only inline generation with evidence/readiness-aware processing while maintaining existing reports. Candidate projections must exclude reference keys, private notes and provisional AI assessments on the server. Existing reminder retry patterns may inform feedback jobs, but hosting/runtime suitability needs a separate decision.

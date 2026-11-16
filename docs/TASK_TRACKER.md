# Prept task tracker

Updated: 2026-11-15. Authoritative task progress for the incremental AI Buddy roadmap.

**T00 is complete. The user subsequently assigned “Task 1 — Finish AI Buddy,” combining AI UX, generation and failure handling rather than the original stabilization-only T01.** Its implementation and automated/provider checks are complete; full browser acceptance is pending. Task 2 implementation is now complete; database deployment is verified after migration recovery; two-account runtime acceptance is pending user verification. Task 3 implementation and automated/live synthetic checks are complete; two-account browser acceptance remains pending. The original roadmap below is retained as historical scope, not a claim that all overlapping tickets are finished.

## Previous assignment: Task 1 — Finish AI Buddy

- Implemented unrestricted Free Flow defaults, optional curation/filter precedence, hybrid generation, validated MCQ keys, context/deduplication, progressive Grill, Focus removal, typography/code themes, scroll-follow behavior and safe classified errors with request retry.
- Updated existing action/catalog and five AI components. Added focused tests and corrected stale mocks in two existing suites. No runtime dependencies, schema changes or Stream lifecycle changes.
- Checks: 54 automated tests pass; lint and diff checks pass; production build checked. Live synthetic Gemini checks passed for MCQ, guided SQL, code explanation and parent-linked Hard Grill.
- Browser: signed-in call/chat controls were observed in the authorized booking; final AI UI acceptance could not finish because native automation twice detected concurrent user input. Provider smoke checks used an authorization stub and are not a substitute for the browser workflow.
- Details, exact verification steps and limitations: [AI_BUDDY.md](AI_BUDDY.md).
- Existing local hydration fix and T00 docs preserved. No commit/push/deployment. Task 1 scope ends here; Task 2 was subsequently explicitly assigned.

## Previous assignment: Task 2 — Live question delivery and candidate submissions

- Implemented Select confirmation with candidate/metadata preview, immutable persisted questions, same-channel Stream delivery, deterministic message IDs and retry-safe submissions.
- Added candidate Chat cards for MCQ, editable theory/scenario, code/SQL with language selection and paste, browser dictation with permission/unsupported states, per-user local drafts, read-only submitted answers and real-time interviewer updates.
- Server actions enforce authenticated booking membership and participant role. Explicit public projections exclude reference answers, correct-option keys, notes and evaluations. Ordinary messages retain the Stream renderer; video lifecycle is unchanged.
- Added additive Prisma migration and regenerated the tracked Prisma client. Migration recovery verified both new tables, foreign keys, indexes, RLS and checksum; repaired the interrupted completion record with migrate resolve --applied. Migration status is up to date and client generation succeeded. DATABASE_URL now uses session port 5432; restart the app.
- Verification performed: source/API inspection and successful `npx.cmd prisma generate` only. Per user instruction, no tests, lint, build, browser, microphone or two-account runs were performed. Runtime completion is unverified, not claimed.
- Setup, changed files and exact manual acceptance steps: [AI_BUDDY.md](AI_BUDDY.md#task-2-live-question-delivery-and-submissions).
- No new dependencies, commit, push or Task 3 work. Follow-up recovery changed only the DATABASE_URL connection port/settings in local .env; credentials were not displayed.

## Current assignment: Expanded Task 3 ? Fair scoring and early completion

- Expanded brief implemented: fixed scores/difficulty weights, bonus-only Grill, private post-completion review, uncertainty/Hindi-English rubric, separate casual leave and authorized early permanent completion, retry-safe Stream termination and Task 4 feedback-pending handoff. Migration 20261115150000_fair_scoring_completion applied.
- Verification: 105 automated tests, lint and production build pass; eight live synthetic Gemini cases and live database/Stream integration pass. Browser/media acceptance remains unverified because Computer Use could not identify the browser URL reliably.
- Exact changed files, Stream role-grant configuration, migration, tests and limitations: [TASK3_HANDOVER.md](TASK3_HANDOVER.md).
- Earlier Task 3 implementation: post-response evaluation with durable pending/running/complete/failed states, deterministic MCQ scoring, validated rubric-based AI static review, interviewer-only review and manual approval/override/notes.
- Persisted parent links and depth for Grill, independent child submissions/evaluations, restored review cards and database-backed performance context/deduplication. Only approved grades represent actual performance.
- Applied migration 20261115120000_answer_evaluation; regenerated Prisma client. Restart the dev server before testing.
- Validation: 74 automated tests passed; lint and production build passed. Live synthetic Gemini checks passed for poor, excellent, partial theory, coding bug and alternative SQL. Deterministic tests cover incorrect MCQ, Grill, privacy, retries, quota failures, concurrent evaluation and manual grading.
- Limit: two-account browser acceptance remains pending; code/SQL is reviewed statically, never executed. Interrupted background work recovers on an authorized question refresh after a two-minute lease; this is not a standalone queue daemon.
- No Task 4 work, commit or push. See [AI_BUDDY.md](AI_BUDDY.md#task-3-automatic-evaluation-and-approved-memory).

## Original roadmap reference

| Task | Scope | Status |
| --- | --- | --- |
| T00 | Repository audit and baseline | Complete; checks limited to read-only/static documentation validation |
| T01 | Stabilize existing app | Not started |
| T02 | Chat-first AI Buddy UX | Not started; partial implementation exists |
| T03 | Question generation intelligence | Not started; partial implementation exists |
| T04 | AI quota/error handling | Not started |
| T05 | Prisma question persistence | Not started |
| T06 | Send confirmation/action | Not started |
| T07 | Stream Chat delivery | Not started |
| T08 | Candidate answer forms | Not started |
| T09 | Speech-to-text | Not started |
| T10 | Automatic evaluation | Not started |
| T11 | Status and memory sync | Not started |
| T12 | Adaptive Grill | Not started; local Grill exists |
| T13 | Call finalization | Not started |
| T14 | Multilingual transcription | Not started; Stream transcript retrieval exists |
| T15 | Chat history collection | Not started |
| T16 | Evidence aggregation | Not started |
| T17 | Feedback engine | Not started; transcript-only engine exists |
| T18 | Report views and access | Not started; shared modal exists |
| T19 | Feedback lifecycle/retries | Not started; webhook retry and participant recovery exist |
| T20 | Security audit | Not started; T00 identified risks, not a full security audit |
| T21 | Operational reliability | Not started |
| T22 | End-to-end tests | Deferred; not started |
| T23 | Deployment | Not started |
| T24 | Production verification | Not started |
| T25 | Documentation/handover | Not started; T00 documents are the baseline |

## T00 delivery record

- Inspected Git refs/diffs, application routes, auth/profile/booking actions, Prisma schema and migrations, Stream video/chat and installed leave-button code, AI Buddy, feedback/transcript/webhook processing, reminders, payout access, tests and configuration.
- Created [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md), [ARCHITECTURE.md](ARCHITECTURE.md), and this tracker. Existing `README.md` and `docs/interview-reminders.md` were reviewed; README discrepancies are recorded in the overview.
- Application code changed: none. Existing `components/header.jsx` and untracked `components/AccountUserButton.jsx` preserved.
- Database migrations, dependencies, environment changes: none. No secrets displayed or saved. No provider requests or live database checks performed.
- Validation performed: Git status/history and local ref comparison (0/0 vs origin/development), source-path inspection, `git diff --check`, document/reference checks and local-change hash preservation check.
- Tests/build/lint commands executed for T00: none. User requested testing be skipped. Historical passes are recorded separately in the overview. No browser/release success inferred.
- Known limitations: live environment/permissions, schema deployment, signed-in hydration/reload behavior, token expiration recovery and actual Hindi-English transcript quality remain unverified.
- Exact deferred manual verification steps and risk priorities: see the overview. No T01 implementation authorized by completing this ticket.

## Dependency refinements

1. Keep T01 focused on baseline stabilization, especially reported hydration/reload and token lifecycle issues. Do not reintroduce duplicate leave calls or claim the dynamic account wrapper solved all reload causes.
2. T04 remains early: both AI Buddy and existing feedback have failure paths. Preserve the two existing SDKs unless a concrete requirement justifies consolidation.
3. Plan a separate authorized early remediation for high-risk payout access and booking concurrency (R01/R02), rather than waiting until final deployment or silently expanding T01.
4. T05 must design private answer keys, public question projections and durable identity/idempotency before T06/T07. Separate expanded question subjects from existing booking categories.
5. T10 depends on persisted submissions; T11/T12 depend on persisted evaluations and approved grades. Existing client-supplied history is not authoritative evidence.
6. T13/T14 extend existing transcription/feedback code. T15 adds chat evidence; T16 combines it with questions, answers and grades before T17 produces a consolidated report. Do not build a second independent feedback system.
7. Durable processing/readiness/idempotency design from T19/T21 must be considered when implementing T13/T17, even though full acceptance remains in later tickets. Waiting for a transcript-ready event is not sufficient proof the entire interview is over.
8. T22/T24 and runtime verification remain required for final release, although currently deferred. A build alone does not meet the roadmap's acceptance criteria.

## Safe T01 proposal (not implemented)

1. Re-read Git status and preserve the local hydration patch and T00 docs. No automatic commit/push or migration.
2. Inspect/reproduce signed-in header hydration and repeated requests, distinguishing full reload/HMR, router refresh, and SDK reconnection. Obtain Network initiator/runtime evidence when testing is re-enabled.
3. Review the existing client-only UserButton fix and Stream token expiry with the smallest changes needed; keep ordinary chat/video independent of AI state.
4. Retain SDK-owned leave behavior and guarded CallRoom cleanup. Check failed/pending joins and navigation without stopping a participant's shared session prematurely.
5. Avoid feature delivery, schema work, SDK upgrades, report redesign or general refactoring. Record security findings as explicit follow-up scope.
6. Update relevant docs with actual changed files/results. If testing remains disabled, label outcomes unverified and retain a manual verification checklist; do not close runtime defects solely because source looks correct.
7. Stop after T01 when separately assigned. Do not proceed to T02 automatically.

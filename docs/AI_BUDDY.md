# AI Buddy — Task 1

Updated 2026-11-15. Scope: the user's “Finish AI Buddy” implementation task, not the older roadmap's stabilization-only T01. The Task 1 section is historical; Task 2 and Task 3 updates follow below.

## Behavior and files

- `lib/interviewCatalog.js`: new sessions default to Free Flow, All Subjects, All Topics, Any Type, Any Difficulty, Web Research Auto. Existing saved preferences remain restorable; Reset filters restores the new defaults. All-subject topic choices combine catalog topics. All question types are selectable.
- `actions/aiQuestions.js`: selected subject/topic/type/difficulty filters win over conflicting text. Unrestricted fields follow natural-language intent and conversation; an explicit 1–5 question count overrides the default count. Filters do not force explanatory/code requests into question cards. Guided Suggest Questions includes the composer's text. All Subjects allows topic switching and mixed subjects without a fixed DSA fallback.
- `AIQuestions.jsx` and `AIBuddyFilters.jsx` under `app/(main)/call/[callId]/components/`: optional collapsed curation, reset/help text, constrained filter-panel height, Enter to send and Shift+Enter for a newline, explicit retry using the original request without another user bubble. New sends scroll to the latest response; scrolling up during generation stops automatic following until the user returns to the bottom or clicks the latest-message button.
- `AIQuestionCard.jsx`: removes Focus, retains local Select/Asked/Grade and Grill controls. Select does not send anything. MCQ answer index is visible inside the interviewer-only reference answer.
- `AIResponse.jsx`: preserves Markdown, tables, math and fenced syntax-highlighted code; light/dark code themes, readable line spacing, copy success/failure feedback.
- `tests/ai-buddy.test.mjs`: deterministic action/provider boundary tests. Existing `tests/action-errors.test.mjs` and `tests/user-name.test.mjs` mocks were updated to supply current imported dependencies and Prisma-like nullable fields; application profile behavior was not changed.

Subjects remain organized under the existing catalog: Core CS contains DBMS, SQL, OS, networks and OOP; Frontend contains HTML/CSS/JS/React/Next.js; Full Stack includes MERN. DSA, Backend, System Design, Machine Coding, AI/ML (including RAG/MCP/agents), DevOps, Mobile and Behavioral remain available. No taxonomy/database migration or SDK replacement was introduced.

## Validation and failure policy

Curated questions retain their original type and difficulty. Only relevant model-selected bank IDs are used; original generation fills the remainder. Generated questions must match explicit subject/topic/type/difficulty, have reference answers and supported metadata, and avoid exact/near duplicates in the bounded supplied history. Incomplete sets fail validation instead of silently returning fewer cards. MCQs require exactly four distinct options and an integer `correctOptionIndex` from 0 to 3; option comparison preserves mathematical symbols. Reference answer output includes the indexed choice. This validates structure, not a guarantee of factual correctness; the interviewer still reviews answers.

Grill preserves the parent subject and relationship, returns one original question, includes the interviewer hint, and overrides unrelated curation filters. Clarify steps down one difficulty level, Deeper steps up one, and Challenge requests Hard; levels are clamped to Easy/Medium/Hard. Follow-up depth remains capped at eight. Model context contains recent conversation, question history, the active question and locally recorded evaluations; it is not verified candidate-submission evidence.

| Error code | Operator/user guidance |
| --- | --- |
| `AI_QUOTA_EXCEEDED` | Wait before retry; operator reviews Gemini quota/billing |
| `AI_INVALID_KEY` | Operator checks server-side `GEMINI_API_KEY` and permissions |
| `AI_MODEL_UNAVAILABLE` | Operator checks server-side `PREPT_GEMINI_MODEL` and model access |
| `AI_NETWORK_ERROR` | Retry a network/server failure; call and chat remain available |
| `INVALID_AI_RESPONSE` | Retry an empty, malformed, duplicate or incomplete response |

No raw provider error or API key is returned. Each SDK request has a 30-second timeout and one SDK attempt. Structured-output validation allows at most two generation calls; provider/quota/key failures are not automatically repeated. Optional grounding failure produces a visible warning and can fall back to model knowledge. The default model remains `gemini-2.5-flash`; no credentials or environment values were changed. AI failures stay inside the AI panel and do not call Stream leave/disconnect or modify ordinary chat.

## Checks actually performed

- `node --test tests/*.test.mjs`: 54 passed, zero failures. Node emits existing module-type inference warnings; no module-system migration was made just to silence them.
- `npm.cmd run lint`: passed. `git diff --check`: passed.
- `npm.cmd run build`: production compilation/type checking/static generation verified (see task tracker for latest run).
- Live Gemini provider smoke checks with generic synthetic input and existing server configuration: valid MCQ with correct index; guided Core CS / SQL / SQL_QUERY / Medium; context-based SQL solution with fenced code; Challenge Grill returning one Hard question linked to its parent. These exercised the actual action logic and provider, with an authorized-call stub instead of a database booking lookup. They do not prove browser authentication or full end-to-end behavior.
- Browser inspection on 2026-11-14: signed-in interviewer dashboard, authorized test call connection, Stream controls and ordinary Chat composer were visible. On resumption, browser automation was twice stopped by concurrent user input. No completed browser AI generation, clipboard, keyboard, two-user chat exchange or visual theme acceptance is claimed.

## Exact remaining manual acceptance steps

1. Join an authorized test booking as interviewer; open AI Buddy. Open Question Curation and click Reset filters. Confirm all unrestricted defaults and Auto research, then collapse it.
2. Send `Give one MCQ on binary search complexity` with Enter. Expect one four-option card; open Reference answer to inspect the indexed choice. Verify there is no Focus button.
3. Set Core CS / SQL / SQL Query Writing / Medium. Type `Give one question about grouping sales by customer` and click Suggest Questions. Expect the selected metadata. Try a conflicting request and confirm selected filters take priority.
4. Select that card and ask `Explain this question and give its complete SQL solution`. Expect explanatory Markdown with fenced, highlighted code and a working Copy button. Task 2 now opens a send-confirmation dialog: confirm only when you want to deliver it to the candidate.
5. Open Grill, enter `Probe null values and duplicate rows`, choose Challenge and submit. Expect one new Hard follow-up. Repeat with Clarify/Deeper and verify parent-linked context and no repeats.
6. Use Shift+Enter to insert a newline without sending. While a response is pending, scroll up; it should not force the conversation back down. Use Scroll to latest to resume following. Test both themes and a narrow window; composer should remain usable with curation expanded.
7. In an isolated development configuration, exercise invalid key, unavailable model and provider/network failure. Confirm safe actionable error plus Retry request. Restore configuration and retry: one user bubble, one resulting response. Never paste credentials into the UI. Quota/server cases are already simulated by automated tests; do not intentionally exhaust a real quota.
8. Switch to ordinary Chat during an AI failure and verify messaging with the other test participant and uninterrupted video. Leave the test call through normal controls.

No migrations, new runtime dependencies, deployment, commit or push are part of this task. Database-backed memory, send confirmation, candidate answers and automatic grading remain later tasks. Full running-app acceptance remains pending the browser steps above.

## Task 2: Live question delivery and submissions

Implemented 2026-11-15. This supersedes the Task 1 deferral of sending and candidate answers above. Automated grading/evaluations remain out of scope.

### Changed files

- `prisma/schema.prisma`, `prisma/migrations/20261115090000_interview_questions/migration.sql`, generated `lib/generated/prisma/`: InterviewQuestion and InterviewSubmission, participant/booking relations, immutable unique submission and booking/source identities. RLS follows the existing server-only Prisma access pattern; no public client policies are added.
- `actions/interviewQuestions.js`: authenticated reads/send/submit, validation, public projections, durable records and deterministic Stream messages.
- `app/(main)/call/[callId]/components/InterviewQuestionMessage.jsx`: shared authoritative question state, custom cards, drafts, dictation and real-time updates; ordinary messages delegate to MessageSimple.
- Existing `CallUI.jsx`, `AIQuestions.jsx`, `AIQuestionCard.jsx`: existing channel integration, confirmation/cancel, pending delivery recovery and sent/answered state.
- This document and `docs/TASK_TRACKER.md` record implementation and deferred verification. Earlier Task 1/T00 and hydration changes are preserved.

### Database setup

Run from the repository root against the intended database:

```powershell
npx.cmd prisma migrate deploy
npx.cmd prisma generate
npm.cmd run dev
```

Client generation has already succeeded locally. Migration deployment was confirmed after recovery on 2026-11-15: the interrupted Task 2 migration had created its tables, indexes, foreign keys and RLS, but lacked its completion marker. After checking schema metadata and the migration checksum, it was marked applied. Prisma migrate status reports the database is up to date; client generation succeeded. No data was deleted. Restart any already-running dev server after migrating/generating so its cached Prisma instance uses the new models. Prisma CLI and runtime both use DATABASE_URL, as requested; no separate DIRECT_URL is used. On Supabase, set DATABASE_URL to the dashboard's Session pooler connection (port 5432) or direct connection; the transaction pooler (port 6543) can cause prepared-statement errors. Existing Stream server credentials are reused and no new dependencies are needed. Stream must allow the existing messaging channel and participants to exchange messages/custom events. A failed optional event does not undo a saved answer.

### Persistence, privacy and retries

The first confirmation freezes the question snapshot. Booking plus original AI/bank question ID uniquely identifies delivery; subsequent retries never replace that content. The server derives booking and both participants from Clerk identity rather than trusting client user IDs. Only the assigned interviewer sends, only the assigned candidate submits, and both can read their booking's public records. New questions/answers require SCHEDULED; retries of already-persisted records remain recoverable after closure.

Reference answers and MCQ correct indices are stored privately, never included in public projections or Stream payloads. Stream carries a deterministic question/answer ID and generic notification only. The custom Chat card fetches authorized database state. MCQ submissions store the chosen index and corresponding option text; code is stored as text and never executed.

A database write precedes Stream delivery. If chat fails, the dialog offers Retry send and the AI panel lists saved pending deliveries (including after reload). Delivery acknowledgment marks the question sent. One submission per question is enforced by a database unique constraint; the first successful write wins even with simultaneous requests. An ambiguous response can be retried without overwriting it. If answer notification fails, the saved answer stays read-only and Retry notification resends the same deterministic message ID. Real-time updates, reconnect/visibility refresh, and an explicit Chat Refresh button reload authoritative state; there is no interval polling.

Drafts are per browser/user/call/question in localStorage and are cleared after a confirmed saved submission. Browser storage must be enabled for reload persistence; drafts do not sync across devices. Dictation supports English/Hindi through the browser's SpeechRecognition implementation, uses the browser speech service, and requires permission. Unsupported/denied states preserve typed input. Final recognized speech appends to editable text; interim speech is shown separately. Stop dictation, review the text, then explicitly submit. Speech never submits automatically. Submitted responses remain read-only for both accounts.

### Verification status and manual steps

Per user instruction, no tests, lint, build, browser or microphone runs were performed for Task 2. Successful Prisma client generation confirms schema/code generation only. Migration status was subsequently verified during recovery; all running-app scenarios below remain unverified.

1. Apply the migration/generate commands and restart. Join the same existing booking with its interviewer and candidate accounts in separate browser profiles. Confirm ordinary Chat and video work.
2. As interviewer, generate a theory/scenario question. Select must show question, topic, difficulty, type and candidate name. Cancel must deliver nothing. Select again and Confirm: one Chat card appears and AI Buddy shows Sent / Awaiting answer. Repeat clicks/reload must not send another copy.
3. As candidate, type a multiline answer, refresh, and confirm the draft survives. Submit once: it becomes read-only, the interviewer receives a notification and can read the answer in Chat. Reload both accounts and confirm saved state.
4. Send an MCQ: candidate sees four options with no reference answer/correct key. Pick one and submit. Inspect the candidate action responses/Stream payloads to confirm private fields are absent.
5. Send coding and SQL questions. Choose language, paste a multiline solution from an IDE, refresh to check the draft, then submit. Confirm formatting and saved language in the read-only response.
6. In a speech-capable browser, send theory/scenario and allow the microphone. Start/stop dictation, edit recognized text and explicitly submit. Also try permission denial and a browser without speech recognition: typing must still work and no automatic submission should occur.
7. Temporarily interrupt the candidate network, submit/reconnect and retry. Confirm one immutable submission and no lost acknowledged answer. On a controlled Stream outage, confirm saved pending question delivery and saved-answer notification can be retried without duplicates. Restore configuration afterward.
8. With an unrelated account, attempt to load/send/submit the booking and verify rejection. Candidate cannot use the send action; interviewer cannot use the candidate submit action. Inspect payloads for private metadata leakage.
9. Trigger an AI failure while exchanging normal chat messages; video/chat and saved question answering must remain independent. Check narrow layout and both themes.

Stop after Task 2. No Task 3 implementation or runtime verification is claimed.

## Task 3: Automatic evaluation and approved memory

Implemented 2026-11-15. Database migration applied and Prisma client generated. Restart the dev server to load the new client.

After an immutable submission is saved, Next.js after() schedules evaluation outside the response. A database lease prevents duplicate concurrent evaluations. Interrupted jobs become recoverable after two minutes on the next authorized question refresh; failed jobs require an interviewer retry. Answers and approved grades survive evaluation failures. No background daemon or external queue was introduced.

MCQs compare the saved option index with the private server answer key without Gemini. Written answers use a reference-aware rubric that accepts valid alternatives. Coding/SQL reviews examine approach, apparent correctness, edge cases, complexity, bugs and completeness, with an explicit not-executed label. Structured responses are validated for result, one of the four grades, strengths, mistakes, missing concepts, reasoning and follow-up. Common unsupported execution claims are rejected. Model review is advisory and is not evidence of actual program execution.

The interviewer opens **AI Buddy ? Saved questions & private reviews** (also available on the original generated card). They can review the immutable response, accept the suggestion or choose Poor/Average/Good/Excellent, add private notes and save. Manual grading works during failed or pending AI evaluation. Approved grade, reviewer ID and timestamp are saved independently, so late AI results cannot overwrite approval. The obsolete local-only grading editor was removed. Candidate responses and Stream payloads never contain assessments, approved grades, notes or reference answers.

Grill works from restored original or follow-up cards with optional hints. Send the parent before sending its child; the server validates parent membership and computes depth (maximum eight). Each delivered child gets its own submission and evaluation. AI Buddy loads saved questions and approved grades/notes plus assessment gaps from the database; local clearing cannot erase saved performance. Unapproved model grades do not become approved performance. Recent history is bounded to 100 records for prompt context.

Interviewer review status refreshes every four seconds while evaluation is pending/running, pauses when hidden, and refreshes on visibility/reconnect. Candidate views have no evaluation polling or private status. Retry immediately resumes private status refresh. Ordinary chat and video remain available.

Validation: 74 automated tests passed, lint passed and production build passed. Applied additive migration 20261115120000_answer_evaluation. Live synthetic provider checks: poor ? POOR/INCORRECT; excellent ? EXCELLENT/CORRECT; partial theory ? AVERAGE/PARTIAL; coding bug ? POOR/INCORRECT; alternative SQL ? EXCELLENT/CORRECT. The opt-in script is scripts/evaluation-smoke.mjs; it sends synthetic data only. Automated tests cover incorrect MCQ/no provider call, structured validation, quota/failure handling, private projections, authorization, manual overrides, concurrent job claims, persistence before scheduling, Grill relationships and authoritative performance context.

Two-account browser acceptance remains unverified. To verify: submit an incorrect MCQ and partial written answer, review privately, override the grade and save notes, reload, then Grill with a hint and send/answer the child. Ask for the next question and check adaptation. Repeat with an excellent answer and a code sample. Under an AI outage, confirm that the saved submission remains available, manual approval works and Retry eventually updates only the AI assessment. Inspect candidate responses to confirm private fields remain absent.

Stop after Task 3. No Task 4 implementation, commit or push.

### Follow-up: generic AI connection error

Removed question generation's dependency on getCallData, which also contacts Stream and updates video settings. Authorization now checks the signed-in interviewer against the booking directly. Authentication/history failures receive distinct safe messages and server diagnostic codes instead of being mislabeled as Gemini network failures. The development Prisma cache now replaces instances when the generated client constructor changes, avoiding stale schema metadata after regeneration.

Verified the Task 3 columns with a read-only zero-row database query and successfully generated a synthetic question through the real Gemini generation path (authentication/history stubbed). Regression checks cover Stream independence, context/auth failures and Prisma cache replacement. The original user's failing request could not be conclusively attributed because the previous catch handler recorded no diagnostic cause. Restart the dev server and retry in the signed-in call to confirm browser recovery.

### Follow-up: Harder with Core CS / DBMS / Easy

Harder/Easier now override difficulty for that individual request, stepping from the active question (or selected difficulty when none is active) and preserving subject/topic/type. This resolves the contradiction between an Easy filter and a request for a harder question. Both shortcuts request one question. Generated response schemas now constrain requested metadata; unused bank candidates are excluded when no bank selection is allowed. Validation retries include safe corrective reasons instead of repeating an identical prompt, and final server diagnostics retain those reasons without question/answer content. Regression tests cover the reported Core CS / DBMS / Easy case and the live synthetic MCQ check is available with scripts/ai-buddy-smoke.mjs --harder --mcq --easy.


## Expanded Task 3 handover

The subsequent fair-scoring and early-completion brief is implemented. See [TASK3_HANDOVER.md](TASK3_HANDOVER.md) for current behavior, changed files, applied migration, Stream configuration, validation and browser/media limitations. Earlier Task 3 sections above describe the initial delivery.

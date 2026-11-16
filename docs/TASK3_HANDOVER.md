# Task 3 — Evaluation, fair scoring and early completion

Updated 2026-11-15. Implements the expanded Task 3 brief. Task 4/5 report generation and redesign are not implemented.

## Delivered behavior

- Automatic nonblocking evaluation persists before external AI work. MCQs use the private server key; written/code answers use validated Gemini responses. Assessments now include weaknesses, confidence, uncertainty and a deterministic suggested score. Hindi-English answers and difficulty-sensitive expectations are explicit in the rubric. Code/SQL is never executed.
- Approved grades are authoritative: Poor 0, Average 40, Good 75, Excellent 100. Easy/Medium/Hard weights are 1.25/1/0.70; Grill adds a 0.50 multiplier. Main and Grill averages are separate. Overall is main alone or `max(main, .85 * main + .15 * grill)`. No main evidence means unavailable; one approved main answer or outstanding delivered questions makes the score provisional. This evidence threshold is an explicit conservative application policy.
- Question calculations and `prept-fair-v1` policy version persist with approved scores. Booking aggregates are updated transactionally on approval/override and completion. Unsent/cancelled questions are excluded; unanswered and awaiting-approval questions have explicit statuses and never silently become zero.
- Existing cards show private scores/review, Accept Grade, Adjust Grade, notes and Grill Further. Past Interviews has a private review dialog so pending evaluations can still be reviewed after completion. Candidate actions and appointment projections exclude private scoring/evaluation fields.
- AI Buddy uses saved answers, approved grades and notes; pending delivery is distinguished from asked questions, and hard/Grill failures are diagnostic rather than blanket evidence of poor fundamentals.
- Leave Meeting uses the SDK's ordinary leave operation and does not complete the booking or trigger feedback. End Interview & Generate Feedback is interviewer-only, confirmed, and allowed before scheduled expiry. It atomically commits completion time, scorer snapshot and feedback-pending intent, then ends the shared Stream call after the response. Existing scheduled expiry classification is preserved.
- End-call retries use a persisted two-minute lease and token. A failed external end leaves the booking completed with a visible retry. Pending/interrupted work recovers from lifecycle checks or the interviewer retry control. No external queue service was added. Call access denies completed/cancelled bookings, and Stream role grants prevent client-side end/rejoin bypasses.
- Transcript-ready events after a casual leave before scheduled expiry no longer generate final feedback. Explicitly completed Task 3 bookings remain Preparing Feedback for Task 4, even when transcripts are ready. Stream artifact references, chat channel ID, question/submission/review records and completion intent are retained. The legacy scheduled-expiry report path remains in place for older interviews.

## Files changed for this extension

| Area | Files |
| --- | --- |
| Scoring and evaluation | `lib/interviewScoring.js`, `lib/answerEvaluation.js`, `lib/evaluationWorker.js`, `actions/interviewQuestions.js`, `actions/aiQuestions.js` |
| Completion and authorization | `lib/interviewCompletion.js`, `actions/interviewCompletion.js`, `actions/call.js`, `actions/bookings.js`, `app/(main)/call/[callId]/page.jsx` |
| Call/review UI | `CallUI.jsx`, `CallRoom.jsx`, `AIQuestions.jsx`, `AIQuestionCard.jsx`, `AnswerReview.jsx`, `InterviewQuestionMessage.jsx` under the call components directory; `components/EndInterviewButton.jsx`, `components/InterviewReviewDialog.jsx`, `components/AppointmentCard.jsx` |
| Feedback/evidence gates | `actions/feedback.js`, `actions/appointments.js`, `lib/meeting-outcome.js`, `lib/meeting-feedback.js`, `app/api/webhooks/stream/route.js` |
| Persistence | `prisma/schema.prisma`, migration below, regenerated tracked Prisma client |
| Verification | `tests/interview-scoring.test.mjs`, `tests/interview-completion.test.mjs`, expanded `tests/answer-evaluation.test.mjs` and `tests/meeting-outcome.test.mjs`, `scripts/evaluation-smoke.mjs`, `scripts/task3-integration-smoke.mjs` |

Previous Task 1/2 changes, hydration fixes and Harder fixes were preserved. No dependency changes, commit or push.

## Migration and Stream configuration

Applied `20261115150000_fair_scoring_completion` successfully to the configured database; Prisma client generation succeeded. Adds completion/feedback intent, artifact references and scoring summary to Booking, explicit response status to questions, and scores/weights/evaluation timestamp to submissions. Existing approved results are backfilled deterministically; missing historical evaluation timestamps are not invented.

Restart the dev server to use the regenerated client.

Stream's per-user permission update supports only media revocations, so end/join-ended restrictions use the existing **default call type's non-admin role grants**. Existing unrelated grants are preserved; admin grants are unchanged. Participant roles are set to `call_member`. This applies across the configured Stream application's default call type and was verified against Stream using a synthetic candidate: direct end returned HTTP 403 and own capabilities excluded end-call/join-ended-call. No new call type or parallel meeting system was introduced.

The implementation uses Stream's [server end-call API](https://getstream.io/video/docs/api/calls/) and [call-role permissions](https://getstream.io/video/docs/api/call-types/permissions/). Ending the session preserves the call; artifact-ready webhooks collect recording/transcription exports asynchronously.

## Verification results

- 105 automated tests passed. Includes fixed scoring, exact weighted average, bonus-only Grill, absent evidence, overrides, privacy, difficulty/uncertainty schemas, AI failures/manual grading, early completion, unauthorized completion, repeated/concurrent completion and external-end failure recovery.
- Lint and production build passed.
- Eight live synthetic Gemini cases passed: poor, excellent, partial theory, coding bug, valid alternative SQL, Hindi-English fundamentals, partially correct hard reasoning and Grill diagnostic.
- Live database/Stream integration passed using synthetic users and a test-only booking: actual question delivery and submissions; deterministic correct/incorrect MCQ evaluation; persisted grade overrides/scores; independent Grill evaluation; unchanged main score after failed Grill; candidate action and direct Stream end denial; early completion and repeat safety; Stream ended state; application rejoin denial; saved questions/answers retained; feedback still pending. Identity was stubbed at the action boundary; database and Stream calls were real. This is not a claim of full Clerk/browser end-to-end coverage.
- The successful integration fixture is booking `85e36d78-4ec7-4f4b-b087-2016ad289d0a`, call `prept-task3-smoke-ceb547e8-12b1-4d90-9af8-d3012689b95d`. Earlier unfinished synthetic fixtures were completed, not deleted. No real interview was completed by testing.

## Remaining acceptance limits

Computer Use stopped because it could not reliably determine the browser URL. No further browser input was attempted. Two signed-in browser profiles still need to verify casual leave/rejoin, the confirmation dialog, immediate Past Interviews rendering, actual simultaneous participant disconnect, themes/layout, and microphone/recording/transcript export behavior. Synthetic server tests had no live media session and cannot prove both browsers disconnected or a recorded transcript exported.

The final report intentionally remains Preparing Feedback until Task 4 implements the comprehensive pipeline. Code execution remains out of scope. Background recovery depends on a subsequent authorized lifecycle/retry request if the server stops before its post-response callback runs. Stream outage retries do not reopen the booking or discard evidence.

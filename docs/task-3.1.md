# Task 3.1 — Interview workspace refactor

Implemented source changes only. Tests, lint, production build, browser checks, database migration execution, and deployment were not run, per the user's instruction. Task 4 was not started. Earlier Task 3 feedback changes already in the working tree were retained.

## UI changes

- Meeting workspace defaults to a 520px sidebar on desktop, with pointer and keyboard resizing, bounded widths, and a saved width preference. Video keeps at least approximately 400px at desktop breakpoints.
- Small screens use stacked video and workspace regions. “Focus workspace” hides the video stage without disconnecting devices; call controls and permanent completion remain accessible.
- AI Buddy opens on Questions. Questions, Evaluations, and Ask AI share one question collection, overlaid with persisted submissions and approved grades. Views stay mounted so filters, grading drafts, scroll positions, and conversation survive tab switches.
- Question cards expose Select & Send, delivery status, Grill, and View Evaluation. Reference answers remain collapsed. Generated and curated cards share the same view.
- Evaluations list unapproved submissions first, with a compact score, asked/answered/graded counters, expandable scoring details, AI suggestions, manual grading, notes, and existing approval actions. The scoring algorithm and weights were not changed.
- Ask AI keeps the full conversation, Markdown/code rendering, sources, quick prompts, and a fixed composer. Generated cards link back to Questions.
- Candidate answers use clearer MCQ choices and a larger editor. Coding answers have language selection, indentation, an expandable question-and-solution workspace, character counts, retained drafts, and formatted read-only submissions.
- The persistent saved-interview banner was replaced by a compact sync control. Refreshes update interview data without resetting drafts. Concurrent refresh events are coalesced; existing evaluation polling remains conditional on pending work.
- Existing fonts and theme tokens are reused. No font package, editor package, resize dependency, or new design system was added.

## Conversation storage

`AIBuddyMessage` stores the booking ID, stable message ID, author, role, content, event type, related question IDs, payload, message timestamp, and server creation timestamp. Payloads preserve generated cards, sources, and relevant request context. New prompts are written before generation; generated responses are written before returning to the client.

All history reads and imports authorize the assigned interviewer against the booking. The candidate and unrelated users cannot access these actions. Imported payloads are historical context, not approved scoring records; existing question/submission APIs remain authoritative.

The `(bookingId, messageId)` unique key makes imports and request retries idempotent. Committed records are not overwritten. A restricted booking foreign key prevents accidental cascading deletion. No delete/reset action is exposed.

On session load, the client merges legacy browser history, the user-scoped browser backup, and server history. Missing local records are imported individually, retaining the original legacy key. Missing legacy timestamps use import time; original timestamps cannot be reconstructed. A failed import leaves local evidence intact and shows retry guidance. A malformed browser backup is not overwritten. A generated response that cannot be saved is returned for local backup with an explicit sync error.

## Migration and generation

Added `prisma/migrations/20261116150000_ai_buddy_history/migration.sql` and the corresponding model in `prisma/schema.prisma`.

Ran **only `npx.cmd prisma generate`** to regenerate the local Prisma client source. The migration was **not applied**. Before using the new server-backed conversation workflow, the migration must be applied to the intended database. Until then, the UI deliberately shows a migration/sync error and blocks new AI generation rather than pretending history is durably saved. Video, chat, saved question retrieval, and grading retain their existing storage contracts.

## Files

Modified:

- `actions/aiQuestions.js`
- `app/(main)/call/[callId]/components/CallUI.jsx`
- `app/(main)/call/[callId]/components/AIQuestions.jsx`
- `app/(main)/call/[callId]/components/AIQuestionCard.jsx`
- `app/(main)/call/[callId]/components/AIBuddyFilters.jsx`
- `app/(main)/call/[callId]/components/AnswerReview.jsx`
- `app/(main)/call/[callId]/components/AIResponse.jsx`
- `app/(main)/call/[callId]/components/InterviewQuestionMessage.jsx`
- `app/globals.css`
- `prisma/schema.prisma`
- Generated Prisma client sources in `lib/generated/prisma/`

Created:

- `actions/aiBuddyHistory.js`
- `lib/ai-buddy-history.js`
- `app/(main)/call/[callId]/components/useBuddyHistory.js`
- `app/(main)/call/[callId]/components/CandidateAnswerEditor.jsx`
- `prisma/migrations/20261116150000_ai_buddy_history/migration.sql`
- This handoff document.

Runtime behavior and responsive rendering remain unverified because testing was explicitly deferred to the user.

<div align="center">

# Prept — AI-Powered Mock Interview Platform

**Prepare with purpose. Practice with confidence.**

A full-stack interview practice platform that connects candidates with human interviewers and brings **AI-assisted question curation, structured answer evaluation, and evidence-grounded feedback** into the same live session.

[**Live Application**](https://ai-interview-platform-ten-silk.vercel.app/) · [**Source Code**](https://github.com/shaurya2425/AI_INTERVIEW_PLATFORM) · [**Report an Issue**](https://github.com/shaurya2425/AI_INTERVIEW_PLATFORM/issues)

![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?logo=nextdotjs) ![React](https://img.shields.io/badge/React-19.3.0-149ECA?logo=react&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-7.4.2-2D3748?logo=prisma) ![Deployment](https://img.shields.io/badge/Deployment-Vercel-000000?logo=vercel)

**B.Tech capstone project · Full-stack SaaS prototype · Human-led interviews with an AI copilot**

</div>

---

## Overview

Traditional mock interviews often involve disconnected tools for scheduling, video meetings, interview questions, grading, and post-session review. **Prept** brings those workflows into a single application.

Candidates can discover interviewers, book a time slot using credits, attend a live interview, answer questions, and review their performance afterward. Interviewers can conduct sessions with video and chat, use **Prept AI Buddy** to find relevant questions and adaptive follow-ups, review submitted answers, and approve grades. After completion, Prept assembles available evidence into a structured feedback report.

**The current product is human-led:** Gemini assists an actual interviewer; it does **not** independently conduct a complete AI-led interview. Autonomous/self-interview functionality is future scope.

### Why Prept?

- **One end-to-end workflow:** discovery → booking → live interview → questions and answers → approved evaluation → feedback.
- **Human judgment retained:** interviewer-approved grades, not AI-generated numeric ratings, determine the official score.
- **Context-aware assistance:** a curated question bank plus Gemini helps interviewers choose questions, explore topics, and ask harder follow-ups.
- **Evidence-first reports:** a missing transcript does not automatically prevent feedback; reports disclose what could and could not be assessed.
- **Role-specific experience:** distinct candidate and interviewer workflows, supported by persistent application data.

## Contents

- [Live demo and screenshots](#live-demo-and-screenshots)
- [Features](#features)
- [How an interview works](#how-an-interview-works)
- [AI Buddy](#ai-buddy)
- [Answer evaluation and scoring](#answer-evaluation-and-scoring)
- [AI feedback and transcript-optional workflow](#ai-feedback-and-transcript-optional-workflow)
- [System architecture](#system-architecture)
- [Technology stack](#technology-stack)
- [Data model](#data-model)
- [Credits and payouts](#credits-and-payouts)
- [Getting started](#getting-started)
- [Configuration and integrations](#configuration-and-integrations)
- [Key routes and project structure](#key-routes-and-project-structure)
- [Verification](#verification)
- [Future roadmap](#future-roadmap)
- [Team](#team)

## Live demo and screenshots

**Live application:** https://ai-interview-platform-ten-silk.vercel.app/

The live experience requires appropriate sign-in, role onboarding, and access to configured third-party services. For a full interview walkthrough, use separate interviewer and candidate accounts.

> **Screenshots coming soon.** Updated screenshots will be added for the candidate dashboard, interviewer discovery, AI Buddy, live meeting room, question/answer review, and final feedback report. The README intentionally does not link to nonexistent image files.

<!-- Screenshot integration guide (after adding actual assets to public or docs/screenshots):

### Candidate dashboard
![Candidate dashboard](docs/screenshots/candidate-dashboard.png)

### Find an interviewer
![Interviewer discovery](docs/screenshots/interviewer-discovery.png)

### AI Buddy and live session
![AI Buddy](docs/screenshots/ai-buddy.png)
![Live interview room](docs/screenshots/meeting-room.png)

### Evaluation and feedback
![Question review](docs/screenshots/answer-review.png)
![Final feedback report](docs/screenshots/feedback-report.png)

-->

## Features

### For candidates (interviewees)

- **Secure authentication and onboarding** through Clerk.
- **Interviewer discovery** with profiles, experience, expertise, and category-based search/filtering.
- **Availability-based bookings:** choose from available 45-minute interview slots in a rolling seven-day window.
- **Credit-based booking** with database-backed transactions and appointment tracking.
- **Real-time interview room** with Stream-powered video, audio, and persistent chat; screen sharing is supported by the video integration.
- **Question delivery and candidate submissions:** answer interview questions using supported question and response types.
- **Feedback review:** read the performance summary, technical assessment, communication, problem-solving, strengths, weaknesses, improvement suggestions, approved score, and advisory next steps, subject to plan/UI access.
- **Recording playback links** where a recording exists and the applicable plan permits access.

### For interviewers

- **Professional profile** with work details, experience, categories, and availability.
- **Interview dashboard** for upcoming/past sessions, earnings, and withdrawals.
- **AI Buddy**, an interviewer-side copilot for generating or selecting questions without replacing the human interviewer.
- **Question delivery** into the interview and candidate answer review.
- **Interviewer-approved grades**, with AI-assisted evaluation supporting the review workflow.
- **Follow-up and Grill flows** for progressively deeper questioning.
- **Controlled completion** of a session with feedback preparation after interview completion.
- **Credit earnings and payout requests** with administrative review.

### Interview subjects and question types

The **interviewer marketplace** uses categories such as Frontend, Backend, Full Stack, DSA, System Design, Behavioral, DevOps, and Mobile.

The **AI Buddy catalog** extends beyond those discovery categories to include Core CS, Machine Coding, and AI & ML. Topics include DBMS, operating systems, networking, React, APIs, system design, DSA, cloud infrastructure, LLMs, and more. Supported question formats include conceptual, coding, scenario, MCQ, debugging, complexity analysis, design, SQL, practical, and behavioral questions.

## How an interview works

```mermaid
flowchart TD
    A[Candidate signs in and completes onboarding] --> B[Explore interviewers and available slots]
    B --> C[Book with credits]
    C --> D[Both participants join Stream call and chat]
    D --> E[Interviewer selects or generates questions with AI Buddy]
    E --> F[Question delivered to candidate]
    F --> G[Candidate submits an answer]
    G --> H[AI-assisted review and interviewer-approved grade]
    H --> I{Continue interview?}
    I -->|Yes| E
    I -->|No| J[Interviewer completes session]
    J --> K[Collect saved answers, chat and available transcript]
    K --> L[Compute approved score and prepare report]
    L --> M[Candidate and interviewer view feedback]
```

1. **Discover and book.** The candidate chooses a real interviewer and an available session. Booking records the appointment and the related credit movement.
2. **Join the meeting.** Both users join the Stream call and its associated persistent chat channel.
3. **Ask and answer.** The interviewer uses their own questions or AI Buddy suggestions, then delivers selected questions to the candidate.
4. **Review performance.** Candidate submissions are saved, reviewed, and assigned an approved grade by the interviewer.
5. **Complete and evaluate.** The interviewer ends the interview through the application workflow. Feedback preparation begins without requiring a finished speech transcript.
6. **Review the report.** The report presents demonstrated strengths and weaknesses along with explicit limitations if evidence is incomplete.

## AI Buddy

**Prept AI Buddy is an interviewer-facing assistant, not an autonomous interviewer.** It combines a curated question bank with Google Gemini and saved interview context.

### Question generation and controls

- Select an interview **subject**, **topic**, **question type**, and **difficulty** (Easy, Medium, Hard, Mixed).
- Generate a configurable batch of **1–5 questions**, rather than a fixed six-question batch.
- Use natural-language prompts and quick actions such as **Next Question**, **Harder**, and **Easier**.
- Use **Guided** or **Free Flow** modes.
- Request optional web research for current/time-sensitive subjects (subject to model/tool availability).
- View AI suggestions and choose which question to deliver; generation does not automatically make every suggestion a candidate question.
- Avoid previously suggested or delivered questions using stored history and code-side deduplication.
- Use **Grill** for a more demanding follow-up chain; the server enforces a maximum follow-up depth.

### Hybrid approach

```mermaid
flowchart LR
    A[Interviewer preferences and instructions] --> D[Candidate selection and question generation]
    B[Curated question bank] --> D
    C[Saved questions, grades and history] --> D
    G[Gemini] <--> D
    D --> E[Suggestions to interviewer]
    E --> F[Selected question delivered and persisted]
    F --> C
```

The curated bank currently lives in `lib/questionBank.js`; subject and question-type definitions live in `lib/interviewCatalog.js`. AI Buddy's persistent messages and question associations are stored separately from the participant-facing Stream chat. The AI uses relevant context to support subsequent suggestions while the interviewer controls delivery and grading.

**Implementation files:** `actions/aiQuestions.js`, `lib/questionBank.js`, `lib/interviewCatalog.js`, `lib/ai-buddy-history.js`, and the call-room components in `app/(main)/call/[callId]/components/`.

## Answer evaluation and scoring

Prept keeps **AI assistance**, **interviewer approval**, and **official numeric scoring** separate.

1. A delivered `InterviewQuestion` is associated with a booking and candidate.
2. An `InterviewSubmission` stores the candidate's response and revision/evaluation state.
3. AI-assisted evaluation can inform the review process.
4. The **interviewer-approved grade** is the authoritative grade used in final scoring.
5. The score is computed by `lib/interviewScoring.js`, not invented by Gemini's feedback narrative.

### Current scoring policy (`prept-fair-v1`)

| Approved grade | Base score |
|---|---:|
| Poor | 0 |
| Average | 40 |
| Good | 75 |
| Excellent | 100 |

| Question difficulty | Weight |
|---|---:|
| Easy | 1.25 |
| Medium | 1.00 |
| Hard | 0.70 |

Grill/follow-up questions receive a **0.5 weight multiplier**. For eligible non-MCQ submissions, an interviewer-confirmed assisted correction can subtract **5 points** from the grade's base score (minimum 0).

The score for each eligible question is its adjusted approved score multiplied by its weight. The **main score** and **Grill score** are separate weighted averages. When both exist, the overall score follows the implemented policy:

```text
overallScore = max(mainScore, 0.85 × mainScore + 0.15 × grillScore)
```

If no Grill score exists, the overall score equals the main score; if no graded main question exists, no overall score is available. The report distinguishes `AVAILABLE`, `PROVISIONAL`, and `UNAVAILABLE` scoring states. Unanswered or unapproved questions are **not silently treated as zero-grade answers**.

The overall rating maps the numeric result to the nearest grade anchor (0 / 40 / 75 / 100; ties favor the lower anchor). **A rating is not an automatic hiring decision.**

## AI feedback and transcript-optional workflow

**A speech transcript is optional, not a prerequisite for generating a report.** This is a core behavior of the current implementation.

The feedback pipeline collects evidence from three sources:

| Evidence source | What it can establish |
|---|---|
| **Delivered questions + saved candidate answers + approved grades** | Technical performance, topic coverage, problem-solving evidence, deterministic scoring |
| **Attributable Stream chat** | Candidate statements and written interaction; technical communication only when the content is substantive |
| **Attributable speech transcript (if available)** | Spoken responses and speech-related communication evidence |

Questions that were merely suggested by AI Buddy but **never delivered** are not treated as candidate performance evidence. Interviewer messages are not attributed to the candidate. Private reference answers and interviewer notes are not exposed in the candidate-visible report.

### What happens when evidence is missing?

| Situation | Report behavior |
|---|---|
| Approved answers available, no transcript | Generate technical feedback and score where supported; mark spoken communication as not assessed |
| Substantive candidate chat, no speech | Use relevant written evidence within its limits; do not claim to have assessed spoken communication |
| Only brief greetings/courtesy chat | Produce a limited/incomplete-evidence report; do not infer technical proficiency |
| Candidate participation but no approved technical answers | Do not invent technical grades or coding performance; state that technical performance is not adequately assessed |
| No attributable candidate evidence | Record an insufficient-evidence report without fabricated strengths or scores |
| Transcript arrives after initial report | A later preparation attempt can refresh the report if the collected evidence has changed |

### Completion, webhook, retry, and recovery

```mermaid
flowchart TD
    A[Interviewer completion action] --> P[Shared feedback preparation]
    B[Stream webhook: call ended, recording ready, transcript ready] --> P
    C[Participant feedback check / retry] --> P
    D[Meeting-feedback recovery cron] --> P
    P --> E[Load completed booking and eligible evidence]
    E --> F[Approved-grade scoring]
    F --> G[Gemini narrative generation and evidence validation]
    G --> H[Persist feedback and report metadata]
    H --> I{Evidence sufficient?}
    I -->|Yes| J[Ready report]
    I -->|No| K[Incomplete report with stated limitations]
    L[Late transcript or new evidence] --> B
```

- **Completion action:** `actions/interviewCompletion.js` records completion intent and schedules finalization. Feedback generation does not hold the UI response open while the external work finishes.
- **Stream webhook:** `POST /api/webhooks/stream` verifies the Stream signature and handles call-end, recording-ready, and transcription-ready notifications. A later transcript may improve a previously saved report.
- **Participant-triggered check:** `actions/feedback.js` checks whether a completed booking has feedback and can invoke shared preparation with a rate limit.
- **Recovery endpoint:** `POST /api/cron/meeting-feedback` can revisit completed bookings with pending, failed, incomplete, or stale processing state when an external scheduler calls it using `CRON_SECRET`.
- **Shared implementation:** `lib/meeting-feedback.js` uses recoverable leases, evidence/version checks, validation, and database persistence so retried work can reuse an unchanged report.

The final report contains a summary, technical assessment, communication assessment, problem-solving assessment, strengths, weaknesses, targeted improvements, approved rating/score, and an **advisory recommendation**. It explicitly identifies unassessed dimensions and does **not** claim unexecuted code passed tests. Opaque question/chat/evidence IDs are kept for internal evidence mapping rather than shown in the final feedback modal.

> **Important:** A report can be **available but incomplete**. Missing speech does not imply the interview did not happen. Likewise, a completed session and an available score do not imply that the evidence supports a definitive hiring recommendation.

## System architecture

Prept is a **single Next.js application** with server-side actions and API route handlers. Its external services supply identity, database hosting, real-time communication, AI inference, and email delivery.

```mermaid
flowchart TB
    UI[Next.js / React UI]
    Auth[Clerk authentication and billing]
    App[Next.js Server Actions and API routes]
    DB[(PostgreSQL + Prisma)]
    Stream[Stream Video and Stream Chat]
    Gemini[Google Gemini]
    Resend[Resend email]
    Cron[External scheduler / cron]
    UI --> Auth
    UI <--> App
    UI <--> Stream
    App <--> DB
    App <--> Auth
    App <--> Stream
    App <--> Gemini
    App --> Resend
    Stream -->|Signed webhook events| App
    Cron -->|Authorized cron requests| App
```

**Responsibility boundaries**

- **Next.js server:** authentication checks, role authorization, booking rules, question submission, approved evaluation, feedback orchestration, and payout requests.
- **Clerk:** user identity and plan/entitlement integration.
- **PostgreSQL + Prisma:** users, interviews, question history, submissions, grades, credits, feedback, and operational state.
- **Stream Video / Chat:** video/audio, session chat, recording, and transcription artifacts when produced.
- **Gemini:** interviewer question assistance and evidence-grounded feedback narratives.
- **Arcjet:** request protection and selected rate limits.
- **Resend:** administrative payout email and interview-reminder delivery.

## Technology stack

| Layer | Technology |
|---|---|
| Framework | Next.js **16.4.3**, React **19.3.0**, App Router, Server Actions |
| Language | JavaScript, JSX; generated Prisma client includes TypeScript |
| UI & styling | Tailwind CSS 4, Radix UI, shadcn-style components, Lucide, Motion, Animate UI |
| Authentication / billing | Clerk |
| Database | PostgreSQL, Prisma **7.4.2**, `pg`, Prisma PostgreSQL adapter |
| Video and chat | Stream Video React SDK, Stream Node SDK, Stream Chat |
| AI Buddy | Google Gemini using `@google/genai` |
| Feedback narrative | Google Gemini using `@google/generative-ai` |
| Security / rate limiting | Arcjet, Clerk role authorization, signed Stream webhooks |
| Email | Resend, React Email |
| Dates / reminders | `date-fns`, reminder policy and delivery utilities |
| Deployment | Vercel-hosted application |

The repository uses both Gemini SDKs in different workflows. Model selection is controlled through server-side environment configuration and must be compatible with the account's available Gemini models.

## Data model

The current Prisma schema includes **10 application models**:

| Model | Purpose |
|---|---|
| `User` | Clerk-linked identity, role, profiles, candidate credits, interviewer balances |
| `Availability` | Interviewer availability windows |
| `Booking` | Session scheduling, Stream call, completion and feedback lifecycle |
| `InterviewQuestion` | Delivered questions, topics, difficulty, references, follow-up relationships |
| `InterviewSubmission` | Candidate answers, revisions, evaluation and approved grades |
| `AIBuddyMessage` | Persistent interviewer-side AI Buddy history |
| `Feedback` | Structured narrative, overall rating, report JSON and session review fields |
| `CreditTransaction` | Booking deductions, earnings and other credit ledger events |
| `Payout` | Withdrawal requests and administrative processing |
| `InterviewReminder` | Email reminder attempts, delivery state and idempotency |

```mermaid
 erDiagram
    User ||--o{ Availability : publishes
    User ||--o{ Booking : participates
    Booking ||--o{ InterviewQuestion : contains
    InterviewQuestion ||--o| InterviewSubmission : receives
    InterviewQuestion ||--o{ InterviewQuestion : followups
    Booking ||--o{ AIBuddyMessage : stores
    Booking ||--o| Feedback : generates
    Booking ||--o{ InterviewReminder : schedules
    Booking ||--o{ CreditTransaction : records
    User ||--o{ CreditTransaction : owns
    User ||--o{ Payout : requests
```

For exact columns, relationships, indexes, and enum definitions, see [`prisma/schema.prisma`](prisma/schema.prisma). The persisted `Feedback.report` JSON includes score breakdowns, limitations, evidence mapping, and report metadata; the UI does not display raw internal evidence IDs.

## Credits and payouts

The application has a subscription-credit model. The current UI defines:

| Plan | Displayed monthly credits | Feedback UI | Recording UI |
|---|---:|---|---|
| Free | 1 | Not included | Not included |
| Starter | 5 | Included | Not included |
| Pro | 15 | Included | Included when a recording exists |

Current plan prices and entitlements are configured in `lib/data.js` and Clerk; they may change. New plan allocations are handled by the user/credit integration. Bookings create credit transaction records, and interviewer earnings are tracked alongside completed interviews.

Interviewers can request withdrawal using a supported payment-detail method, including PayPal, bank transfer, or UPI. The application emails an administrator with the request; **marking a payout processed is an administrative record, not an automatic transfer of funds**.

## Getting started

### Prerequisites

- A Node.js version compatible with the project's Next.js/Prisma dependencies.
- PostgreSQL database and a valid connection URL.
- Clerk project with suitable authentication configuration (and subscription plans if testing billing).
- Stream project configured for video and chat; recording/transcription if those flows are to be tested.
- Gemini API key with access to the configured model(s).
- Arcjet and Resend configuration for the features that use them.

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/shaurya2425/AI_INTERVIEW_PLATFORM.git
cd AI_INTERVIEW_PLATFORM

# 2. Install dependencies
npm ci

# 3. Set environment variables
# Create .env in the repository root using the reference below.

# 4. Apply existing Prisma migrations
npx prisma migrate deploy

# 5. Generate the Prisma client (also configured as postinstall)
npx prisma generate

# 6. Start development mode
npm run dev
```

Then visit **http://localhost:3000**. Use separate browser sessions for the interviewer and candidate if testing a complete interview. For development webhook delivery from Stream, the local service needs a reachable HTTPS endpoint or forwarding tunnel.

> **Repository layout note:** `package.json`, `app/`, `actions/`, and `prisma/` are at the repository root. Run commands from the directory created by `git clone`.

## Configuration and integrations

Create a **server-local `.env` file** at the repository root. Do not commit it.

```dotenv
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Stream Video / Chat
NEXT_PUBLIC_STREAM_API_KEY="..."
STREAM_SECRET_KEY="..."

# Gemini
GEMINI_API_KEY="..."
PREPT_GEMINI_MODEL="..."       # AI Buddy model override
GEMINI_FEEDBACK_MODEL="..."    # Optional dedicated feedback model

# Security / rate limits
ARCJET_KEY="..."

# Email and reminder delivery
RESEND_API_KEY="..."
REMINDER_EMAIL_FROM="Prept <reminders@your-verified-domain.com>"

# Scheduled jobs (use at least 32 characters)
CRON_SECRET="replace-with-a-long-random-secret"

# Application origin
NEXT_PUBLIC_APP_URL="https://your-domain.example"

# Payout administration
ADMIN_PAYOUT_PASSWORD="use-a-strong-private-password"
```

Prisma CLI and runtime both use `DATABASE_URL`. For Supabase migrations, use the direct connection or session pooler on port 5432, not the transaction pooler on port 6543. No separate `DIRECT_URL` is used.

Some integrations require configuration in external dashboards: Clerk redirect URLs and plan IDs, Stream webhook URL and call settings, Resend verified sender, Arcjet policy, and the database connection. Use only service-compatible Gemini model identifiers; do not treat the example value of a model variable as a guarantee of provider access.

### Cron and webhook endpoints

| Endpoint | Method | Responsibility |
|---|---|---|
| `/api/webhooks/stream` | `POST` | Signed Stream call, recording, and transcription events |
| `/api/cron/interview-reminders` | `POST` | Authenticated reminder dispatch |
| `/api/cron/meeting-feedback` | `POST` | Authenticated recovery/refresh for pending and incomplete feedback |

Both cron endpoints use `Authorization: Bearer <CRON_SECRET>`. Scheduling is **external** to these handlers; configure the appropriate scheduler rather than assuming a deployed route runs on its own. The repository includes `supabase/interview-reminders-cron.sql` and reminder setup documentation.

## Key routes and project structure

### Application routes

| Path | Function |
|---|---|
| `/` | Landing page |
| `/sign-in`, `/sign-up` | Clerk authentication |
| `/onboarding` | Role and profile onboarding |
| `/explore` | Interviewer discovery |
| `/interviewers/[id]` | Interviewer profile and slot booking |
| `/appointments` | Candidate appointments and feedback access |
| `/dashboard` | Interviewer workspace |
| `/call/[callId]` | Live meeting, chat, questions, and answer workflow |
| `/payout/[id]` | Administrative payout review |

### Main source directories

```text
AI_INTERVIEW_PLATFORM/
├── app/
│   ├── (main)/call/[callId]/components/  # Live call, AI Buddy, answer review
│   └── api/
│       ├── webhooks/stream/              # Stream event handler
│       └── cron/                         # Reminder + feedback recovery handlers
├── actions/                              # Authenticated server actions
├── components/                           # Shared components; FeedbackModal.jsx
├── lib/
│   ├── ai-buddy-history.js               # Persisted AI Buddy history
│   ├── interviewCatalog.js               # Subject/type configuration
│   ├── interviewScoring.js               # Deterministic grade-based scoring
│   ├── meeting-feedback.js               # Evidence collection and report generation
│   ├── questionBank.js                   # Curated question data
│   └── generated/prisma/                 # Generated Prisma client
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── emails/                               # Reminder and payout email templates
├── docs/                                 # Additional documentation
├── supabase/                             # Scheduler setup SQL
├── tests/                                # Automated tests
├── proxy.js                              # Clerk / request protection
└── package.json
```

## Verification

The repository defines development, build, start, and lint scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

Tests use Node.js's built-in test runner:

```bash
node --test tests/
```

A production build confirms compilation and framework checks; it **does not guarantee** that all third-party integrations or interview scenarios work. For changes to the interview workflow, manually check role-based access, meeting completion, answer approval, transcript-optional feedback, and feedback refresh behavior before release.

## Future roadmap

These are **planned directions**, not features advertised as available today:

- **Autonomous AI-led self-interviews:** candidates select a target role/domain and interview with an AI interviewer without booking a human.
- **Role-specific interview plans:** automatically assembled interview sheets and adaptive progression across rounds.
- **Expanded question coverage:** broader curated and verified questions, practical tasks, and company-relevant interview themes.
- **Deeper evaluation research:** improved quality measurement, calibrated feedback, and comparisons with interview-assessment baselines.

## Team

Developed by:

- **Shaurya Rajput**
- **Aditya Rautela**
- **Vansh Chaudhary**

Built as a **B.Tech capstone project** and explored as a **full-stack SaaS prototype**.

---

<div align="center">

**Prept — Prepare with purpose. Practice with confidence.**

[Try Prept](https://ai-interview-platform-ten-silk.vercel.app/) · [Explore the repository](https://github.com/shaurya2425/AI_INTERVIEW_PLATFORM)

</div>

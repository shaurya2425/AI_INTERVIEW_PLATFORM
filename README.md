# Prept — AI Interview Platform

**Prepare with purpose. Practice with confidence.**

Prept connects candidates with interviewers for live mock interviews. Candidates discover interviewers, book sessions using subscription credits, and join video calls with integrated chat. Interviewers manage availability, receive AI-generated question suggestions, and earn credits. After a session, transcript analysis produces structured feedback, while recording events attach playback links to the booking.

The application is a full-stack Next.js project backed by PostgreSQL. Clerk handles identity and subscriptions; Stream provides video and chat; Gemini generates questions and feedback; Arcjet protects requests; and Resend delivers withdrawal notifications.

## Contents

- [Features and roles](#features-and-roles)
- [Technology stack](#technology-stack)
- [System architecture](#system-architecture)
- [Application workflows](#application-workflows)
- [Credits and payouts](#credits-and-payouts)
- [Database design](#database-design)
- [Routes and access](#routes-and-access)
- [Repository structure](#repository-structure)
- [Local setup](#local-setup)
- [Development and verification](#development-and-verification)
- [Deployment considerations](#deployment-considerations)
- [Current implementation boundaries](#current-implementation-boundaries)

## Features and roles

### Interviewees

- Sign up and sign in through Clerk, then complete role-based onboarding.
- Browse interviewers, filter by category, and search by name, title, or company.
- Review profiles, experience, expertise, availability, and credit cost.
- Select a 45-minute slot from a seven-day booking window.
- Book sessions using the available credit balance.
- View upcoming and past appointments.
- Join interviews with video, audio, screen-sharing support, and chat.
- Read generated feedback summaries and access full reports through the Starter or Pro UI.
- Open available recording links through the Pro UI.

### Interviewers

- Complete a profile with title, company, experience, biography, and categories.
- Set a daily availability window and view appointments from the dashboard.
- Conduct live interviews with integrated chat.
- Generate six category-specific questions with reference answers.
- Inspect credit balance, completed-session earnings, and withdrawal history.
- Request withdrawals with PayPal, bank transfer, or UPI payment details.

### Payout review

An administrator receives a withdrawal email, opens the review page, and marks the request processed using the configured payout password. Processing records an administrative decision; the application does not transfer money through a payment-provider API.

### Interview categories

Frontend · Backend · Full Stack · Data Structures and Algorithms · System Design · Behavioral · DevOps · Mobile

## Technology stack

Versions reflect declarations in the repository, rather than a claim about the latest available releases.

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Framework | Next.js 16.4.3 | App Router, server rendering, Server Actions, route handlers, request proxy |
| Interface | React 19.3.0 | Components, hooks, interactive screens |
| Language | JavaScript / JSX | Most application code; generated Prisma code uses TypeScript |
| Styling | Tailwind CSS 4, `tw-animate-css` | Utility styling and animation utilities |
| UI primitives | Radix UI, shadcn-style components | Dialogs, tabs, inputs, cards, buttons |
| Motion and icons | Motion, Animate UI, Lucide React | Animations, effects, and icons |
| Themes and notifications | `next-themes`, Sonner | Theme context and toast notifications |
| Typography | DM Sans and Lora through `next/font` | Sans-serif and serif typography |
| Identity and billing | Clerk Next.js SDK 7.9.x | Sessions, account UI, plan checks, subscription checkout |
| Database | PostgreSQL | Persistent application data |
| Data access | Prisma 7.4.2, `PrismaPg`, `pg` | Generated client, queries, transactions, connection pooling |
| Video | Stream Video React SDK and Node SDK | Calls, membership, tokens, recording, transcription |
| Messaging | Stream Chat and Stream Chat React | Persistent chat channel for each interview |
| Generative AI | `@google/generative-ai` | Questions and transcript analysis |
| Protection | Arcjet | Shield, bot detection, per-user token buckets |
| Email | Resend and React Email | Withdrawal notification rendering and delivery |
| Dates | `date-fns` | Slot generation and date/time formatting |
| Code presentation | Shiki | Syntax highlighting for code-display components |
| Code quality | ESLint 9 and Next.js ESLint configuration | Static lint checks |

## System architecture

Prept runs as one Next.js application. Server-rendered pages load data, client components handle interaction, and Server Actions perform most mutations. A Stream webhook handles post-call events. There is no separate backend service or background worker in the repository.

```mermaid
flowchart TB
    Browser[Browser: candidate or interviewer]
    Proxy[Next.js proxy: Clerk and Arcjet]
    subgraph App[Next.js application]
        Pages[App Router pages and layouts]
        UI[Interactive React components]
        Actions[Server Actions and server-only readers]
        Webhook[Stream webhook route]
        Prisma[Prisma and PostgreSQL adapter]
    end
    Clerk[Clerk: identity and subscriptions]
    Arcjet[Arcjet: request protection]
    Stream[Stream: video and chat]
    Gemini[Gemini: questions and feedback]
    Resend[Resend: withdrawal email]
    DB[(PostgreSQL)]
    Browser --> Proxy --> Pages
    Proxy <--> Clerk
    Proxy --> Arcjet
    Pages --> UI
    Pages --> Actions
    UI --> Actions
    Actions --> Clerk
    Actions --> Arcjet
    Actions --> Prisma
    Prisma --> DB
    Actions --> Stream
    UI <-->|Video and messaging SDKs| Stream
    Actions --> Gemini
    Actions --> Resend
    Stream -->|Recording and transcription events| Webhook
    Webhook --> Gemini
    Webhook --> Prisma
```

### Responsibilities and data ownership

| Boundary | What it owns |
| --- | --- |
| Clerk | Authentication, session identity, subscription entitlements |
| PostgreSQL | Profiles, roles, availability, bookings, balances, feedback, credit records, payouts |
| Stream | Live media, messaging channels, recordings, transcript artifacts |
| Gemini | Generated question/answer pairs and feedback responses |
| Next.js server | Authorization checks, business rules, service credentials, database writes |
| Browser | Forms, filtering, slot selection, call controls, chat, report presentation |

`clerkUserId` links Clerk identities to local users and identifies participants in Stream. A booking's `streamCallId` connects database records to calls, chat channels, and webhook events.

Prisma uses a `pg` pool and PostgreSQL adapter. Development reuses the client through `globalThis` during hot reloads. Selected mutations use `revalidatePath` to refresh affected pages. A shared client hook exposes action loading/data/error state and displays error toasts.

## Application workflows

### 1. Authentication and onboarding

1. Clerk authenticates the user.
2. The shared header calls the user synchronization helper.
3. A missing local user is created with identity details, the `UNASSIGNED` role, and the current plan's credits.
4. Existing non-interviewers are checked for a plan change or new calendar month to determine whether to add credits.
5. Client role navigation sends unassigned users to onboarding.
6. Onboarding stores `INTERVIEWEE` or `INTERVIEWER`. Interviewers also provide their professional profile and categories.

Interviewees proceed to discovery; interviewers proceed to the dashboard. User synchronization happens during application rendering, not through a Clerk webhook implemented in this project.

### 2. Availability and booking

The interviewer saves one active availability window. The picker uses its hours and minutes as a daily window for each of the next seven dates, including today. It generates 45-minute slots, removes past starts and incomplete trailing slots, and disables overlaps with scheduled bookings.

```mermaid
sequenceDiagram
    actor Candidate
    participant UI as Slot picker
    participant Server as Booking action
    participant Guard as Clerk and Arcjet
    participant DB as PostgreSQL
    participant Stream as Stream Video
    Candidate->>UI: Select date and slot
    UI->>Server: Interviewer ID and start/end timestamps
    Server->>Guard: Authenticate and apply rate limit
    Server->>DB: Read users, balance, and overlapping bookings
    alt Invalid role, insufficient credits, or conflict
        Server-->>UI: Error
    else Checks pass
        Server->>Stream: Upsert participants and create call
        Stream-->>Server: Call ready
        Server->>DB: Transaction: booking, deduction, balance updates
        Note over Server,DB: Deduct candidate credits and increase interviewer balance
        Server-->>UI: Booking ID and Stream call ID
        UI-->>Candidate: Navigate to appointments
    end
```

Both call members receive the Stream `host` role. Call settings enable screen sharing, make 1080p recording available, and configure transcription as `auto-on`. Database writes are transactional, but Stream call creation happens first and is a separate operation.

### 3. Live interview and AI questions

The server looks up the booking by Stream call ID, verifies that the signed-in user is a participant, and generates a Stream token valid for one hour. The client joins the existing `default` call, renders a speaker layout and controls, and watches a `messaging` channel with the same call ID and both participants as members.

The interviewer sees an AI Questions tab:

1. Select one of the interviewer's categories.
2. Request questions through a Server Action.
3. Send Gemini a category-specific prompt requesting six questions and concise reference answers.
4. Remove optional Markdown fences, parse the returned JSON, and display the result.

Both AI workflows select the model string `gemini-3.5-flash-lite`. Question sets are not stored in PostgreSQL. The action checks authentication and category validity; interviewer-only visibility is implemented in the call UI.

Leaving attempts to stop an active recording before disconnecting, then returns the user to the dashboard or appointments page.

### 4. Recording and feedback

```mermaid
sequenceDiagram
    participant Stream
    participant Hook as Stream webhook
    participant CDN as Transcript storage
    participant AI as Gemini
    participant DB as PostgreSQL
    Stream->>Hook: call.recording_ready
    Hook->>DB: Save recording URL
    Stream->>Hook: call.transcription_ready
    Hook->>DB: Find booking and check existing feedback
    Hook->>CDN: Download JSONL transcript
    CDN-->>Hook: Transcript entries
    Note over Hook: Keep speech entries and map speaker IDs to names
    Hook->>AI: Transcript and evaluation prompt
    AI-->>Hook: Structured feedback JSON
    Hook->>DB: Transaction: upsert feedback and mark booking COMPLETED
    Hook->>DB: Check and create BOOKING_EARNING record
    Hook-->>Stream: Acknowledge event
```

| Feedback field | Meaning |
| --- | --- |
| Summary | Overall session assessment |
| Technical | Knowledge and answer accuracy |
| Communication | Clarity, structure, and communication style |
| Problem solving | Reasoning and approach |
| Recommendation | Hiring recommendation and supporting reason |
| Strengths | Demonstrated capabilities |
| Improvements | Areas to practice |
| Overall rating | `POOR`, `AVERAGE`, `GOOD`, or `EXCELLENT` |

Recording and transcription events are independent. A recording URL alone does not complete a booking. Completion occurs when transcript analysis and feedback persistence succeed. Empty transcripts are skipped; there is no separate completion job when a call ends. Appointment readers load the saved report for later display.

## Credits and payouts

### Subscription credits

| Plan | Monthly price displayed | Credits per allocation | Full feedback button | Recording button |
| --- | --- | --- | --- | --- |
| Free | $0 | 1 | No | No |
| Starter | $29 | 5 | Yes | No |
| Pro | $69 | 15 | Yes | Yes |

Prices are static presentation values. Checkout uses configured Clerk plan IDs; entitlement checks use the `starter` and `pro` slugs. Session cost depends on the interviewer's `creditRate`, so one credit is not universally equivalent to one session.

Allocation runs when user synchronization executes. A new account, detected plan change, or new calendar month triggers an allocation. Remaining credits carry forward because new credits are added to the balance. Interviewers skip subsequent subscription allocations. This is not a scheduled billing-anniversary job and does not calculate separate allocations for every missed month.

### Credit accounting

| Event | Candidate balance | Interviewer balance | Stored record |
| --- | --- | --- | --- |
| Plan allocation | Increased by allowance | Unchanged | User balance and allocation timestamp; no credit transaction |
| Booking succeeds | Reduced by `creditRate` | Increased immediately by the same amount | Booking and negative `BOOKING_DEDUCTION` |
| Feedback completes | Unchanged | Unchanged | Feedback, completed status, positive `BOOKING_EARNING` |
| Withdrawal requested | Unchanged | Reduced by requested credits | `PROCESSING` payout |
| Payout approved | Unchanged | Unchanged | Payout marked `PROCESSED` |

Available interviewer balance grows at booking time. Dashboard total-earned statistics use completed bookings, so the two figures can differ.

### Withdrawals

```text
Gross value  = requested credits × $5
Platform fee = gross value × 20%
Net payout   = gross value × 80%

10 credits → $50 gross → $10 fee → $40 net
```

The dashboard submits the full available balance. The server accepts a positive requested amount up to the balance and requires payment details.

```mermaid
flowchart LR
    Request[Request withdrawal] --> Validate[Check role, balance, details, rate limit]
    Validate --> Transaction[Create payout and deduct balance atomically]
    Transaction --> Pending[PROCESSING]
    Pending --> Email[Send admin review email]
    Email --> Review[Review and provide payout password]
    Review --> Processed[PROCESSED with timestamp]
```

Email failure is logged without reversing the withdrawal. Approval records `processedAt` and `processedBy`; actual payment happens outside the application.

## Database design

The schema contains six models. IDs are UUID strings, and the user table combines shared identity fields with role-specific profile and balance fields.

```mermaid
erDiagram
    User ||--o{ Availability : publishes
    User ||--o{ Booking : "books as interviewee"
    User ||--o{ Booking : "hosts as interviewer"
    User ||--o{ CreditTransaction : owns
    User ||--o{ Payout : requests
    Booking ||--o| Feedback : receives
    Booking o|--o{ CreditTransaction : references
    User {
        string id PK
        string clerkUserId UK
        string email UK
        UserRole role
        int credits
        string currentPlan
        datetime creditsLastAllocatedAt
        int creditRate
        int creditBalance
    }
    Availability {
        string id PK
        string interviewerId FK
        datetime startTime
        datetime endTime
        AvailabilityStatus status
    }
    Booking {
        string id PK
        string intervieweeId FK
        string interviewerId FK
        datetime startTime
        datetime endTime
        BookingStatus status
        int creditsCharged
        string streamCallId UK
        string recordingUrl
    }
    Feedback {
        string id PK
        string bookingId FK,UK
        string summary
        string technical
        string communication
        string problemSolving
        string recommendation
        FeedbackRating overallRating
    }
    CreditTransaction {
        string id PK
        string userId FK
        string bookingId FK
        int amount
        TransactionType type
    }
    Payout {
        string id PK
        string interviewerId FK
        int credits
        float platformFee
        float netAmount
        string paymentMethod
        string paymentDetail
        PayoutStatus status
    }
```

The diagram shows core fields. Profiles also store names, images, biographies, titles, companies, experience, and category arrays. Feedback includes strengths and improvements arrays plus optional session rating/comment fields. Payouts carry administrative and processing metadata.

| Enum | Values |
| --- | --- |
| `UserRole` | `UNASSIGNED`, `INTERVIEWEE`, `INTERVIEWER` |
| `BookingStatus` | `SCHEDULED`, `COMPLETED`, `CANCELLED` |
| `AvailabilityStatus` | `AVAILABLE`, `BOOKED`, `BLOCKED` |
| `PayoutStatus` | `PROCESSING`, `PROCESSED` |
| `FeedbackRating` | `POOR`, `AVERAGE`, `GOOD`, `EXCELLENT` |
| `TransactionType` | `CREDIT_PURCHASE`, `BOOKING_DEDUCTION`, `BOOKING_EARNING`, `ADMIN_ADJUSTMENT` |

Unique constraints enforce one local user per Clerk ID/email, one booking per non-null Stream call ID, and one feedback record per booking. Indexes support interviewer availability queries, booking queries by participant/status, and payout queries by status or interviewer. There is no direct foreign key from bookings to availability: bookings store concrete timestamps.

## Routes and access

Route groups such as `(auth)` and `(main)` organize files without becoming part of the URL.

| Route | Purpose | Current access behavior |
| --- | --- | --- |
| `/` | Landing page and pricing | Public |
| `/sign-in/[[...sign-in]]` | Clerk sign-in | Public catch-all auth route |
| `/sign-up/[[...sign-up]]` | Clerk sign-up | Public catch-all auth route |
| `/onboarding` | Role/profile setup | Clerk-protected by proxy |
| `/explore` | Interviewer directory | Clerk-protected by proxy |
| `/interviewers/[id]` | Profile and booking | Page checks authentication and onboarding; booking action requires an interviewee |
| `/appointments` | Interviewee sessions | Clerk-protected by proxy; role navigation directs interviewers to dashboard |
| `/dashboard` | Interviewer workspace | Clerk-protected by proxy; role navigation directs interviewees to appointments |
| `/call/[callId]` | Video, chat, AI assistance | Server verifies authentication and booking participation |
| `/payout/[id]` | Withdrawal review | No explicit page authentication check; approval requires payout password |
| `POST /api/webhooks/stream` | Recording/transcript handling | Excluded from Arcjet; currently no signature verification |

Arcjet applies shield and bot-detection rules to matched non-webhook requests, allowing search-engine and preview bot categories. Booking uses a per-user token bucket with capacity 5 and a refill of 2 tokens per hour. Withdrawals use capacity 3 and a refill of 1 token per hour. These are burst-and-refill policies, not fixed hourly counts.

## Repository structure

```text
prept/
├── app/
│   ├── (auth)/
│   │   ├── layout.js
│   │   ├── sign-in/[[...sign-in]]/page.jsx
│   │   └── sign-up/[[...sign-up]]/page.jsx
│   ├── (main)/
│   │   ├── layout.jsx
│   │   ├── onboarding/page.jsx
│   │   ├── explore/
│   │   │   ├── page.jsx
│   │   │   └── components/          # Filters and interviewer cards
│   │   ├── interviewers/[id]/
│   │   │   ├── page.jsx
│   │   │   └── components/SlotPicker.jsx
│   │   ├── appointments/page.jsx
│   │   ├── dashboard/
│   │   │   ├── page.jsx
│   │   │   └── components/          # Availability, appointments, earnings
│   │   ├── call/[callId]/
│   │   │   ├── page.jsx
│   │   │   └── components/          # CallRoom, CallUI, AIQuestions
│   │   └── payout/[id]/
│   │       ├── page.jsx
│   │       └── components/PayoutReviewClient.jsx
│   ├── api/webhooks/stream/route.js
│   ├── layout.js                   # Providers, header, footer, fonts
│   ├── page.jsx                    # Landing page
│   └── globals.css
├── actions/                        # Server mutations and data readers
├── components/
│   ├── ui/                         # Shared UI primitives
│   ├── animate-ui/                 # Animation and code-display components
│   ├── AppointmentCard.jsx
│   ├── FeedbackModal.jsx
│   ├── PricingSection.jsx
│   ├── UpgradeModal.jsx
│   ├── CreditButton.jsx
│   ├── RoleRedirect.jsx
│   ├── header.jsx
│   ├── reusables.jsx
│   └── theme-provider.jsx
├── emails/WithdrawalRequestEmail.jsx
├── hooks/                          # Action state, visibility, UI helpers
├── lib/
│   ├── generated/prisma/           # Generated client; do not hand-edit
│   ├── prisma.js
│   ├── checkUser.js
│   ├── arcjet.js
│   ├── helpers.js
│   ├── data.js
│   └── ...                         # Styling, highlighting, context utilities
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
├── public/                         # Logo, hero images, other static assets
├── proxy.js                        # Clerk middleware and Arcjet protection
├── prisma.config.js                # Schema, migrations, database URL
├── next.config.mjs
├── eslint.config.mjs
├── components.json                 # UI component tooling configuration
├── jsconfig.json
├── tsconfig.json
├── package.json
└── package-lock.json
```

### Core module guide

| Module | Responsibility |
| --- | --- |
| `actions/onboarding.js` | Validate role/profile input and persist onboarding |
| `actions/explore.js` | Read interviewer profiles for discovery, excluding the signed-in user |
| `actions/bookings.js` | Read profiles, validate bookings, create Stream calls, move credits |
| `actions/appointments.js` | Read interviewee bookings with interviewer details and feedback |
| `actions/dashboard.js` | Availability, appointments, statistics, withdrawals, payout history |
| `actions/call.js` | Server-only participant authorization and Stream token generation |
| `actions/aiQuestions.js` | Generate category-specific question/answer JSON |
| `actions/payout.js` | Validate payout password and mark a request processed |
| `actions/user.js` | Read current role and selected profile fields |
| `lib/checkUser.js` | Create local users and allocate subscription credits |
| `lib/prisma.js` | Initialize and reuse database access |
| `lib/arcjet.js` | Construct token buckets and translate denied decisions into errors |
| `lib/helpers.js` | Format dates/durations and generate date tabs and slots |
| `lib/data.js` | Categories, plan presentation and IDs, labels, styles, landing-page data |
| `hooks/use-fetch.js` | Async action loading/data/error state and toast errors |
| `components/AppointmentCard.jsx` | Session details, joining, summaries, plan-gated buttons |
| `components/FeedbackModal.jsx` | Structured feedback report presentation |
| `app/api/webhooks/stream/route.js` | Recording URLs, transcript analysis, feedback, completion |

## Local setup

### Prerequisites

- Node.js and npm compatible with the dependencies in `package.json`. The repository does not pin a Node version with an `engines` field or version-manager file.
- A reachable PostgreSQL database.
- Clerk credentials and configured billing plans for paid-plan flows.
- A Stream application configured for video and chat.
- Gemini and Arcjet credentials.
- Resend credentials for withdrawal emails.
- A publicly reachable application URL for Stream webhook delivery.

### 1. Configure environment variables

Create a `.env` file at the repository root. Use your own values; the following are placeholders.

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your_clerk_publishable_key"
CLERK_SECRET_KEY="your_clerk_secret_key"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

NEXT_PUBLIC_STREAM_API_KEY="your_stream_api_key"
STREAM_SECRET_KEY="your_stream_secret_key"

GEMINI_API_KEY="your_gemini_api_key"
ARCJET_KEY="your_arcjet_key"
RESEND_API_KEY="your_resend_api_key"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_PAYOUT_PASSWORD="your_private_payout_approval_password"
```

| Variable group | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime database pool and Prisma CLI connection |
| Clerk keys and route URLs | Identity provider and authentication routes |
| Stream public key and server secret | Browser SDK, call creation, user token generation |
| `GEMINI_API_KEY` | Both AI workflows |
| `ARCJET_KEY` | Proxy protection and action rate limits |
| `RESEND_API_KEY` | Withdrawal emails |
| `NEXT_PUBLIC_APP_URL` | Base URL for payout review links |
| `ADMIN_PAYOUT_PASSWORD` | Payout approval password |

`NEXT_PUBLIC_*` values are public configuration. Keep other credentials server-side. Environment files are ignored by Git. Prisma reads `DATABASE_URL`; it does not currently use a separate `DIRECT_URL` variable.

### 2. Install dependencies

```bash
npm ci
```

The `postinstall` script runs `prisma generate`, writing the client into `lib/generated/prisma`. To regenerate explicitly:

```bash
npx prisma generate
```

### 3. Apply database migrations

For an initial database using the committed migration history:

```bash
npx prisma migrate deploy
```

When intentionally changing the schema during development:

```bash
npx prisma migrate dev --name describe_your_change
npx prisma generate
```

`prisma/seed.js` is a targeted sample-feedback utility for a hard-coded existing booking. It does not populate an empty application with users or interviewers, and no seed command is registered in the Prisma configuration. Create users through sign-up and onboarding for normal local testing.

### 4. Configure integrations

| Service | Configuration required by this implementation |
| --- | --- |
| Clerk | Match authentication URLs, configure `starter` and `pro` plan slugs, and replace paid plan IDs in `lib/data.js` with IDs from your instance |
| Stream | Support `default` video calls and `messaging` chat channels with permissions needed by the SDK flows; enable recording/transcription capabilities being exercised |
| Stream webhooks | Deliver `call.transcription_ready` and `call.recording_ready` to `<public-app-url>/api/webhooks/stream` |
| Gemini | Ensure the account can use the exact model selected in both AI call sites |
| Resend | Configure a usable sender and destination; the action currently uses a fixed administrator email and the Resend onboarding sender |
| Payout review | Set the approval password and ensure the app base URL produces reachable email links |

For local webhook testing, expose the running application through a public HTTPS development URL and register it with Stream. `localhost` itself is not reachable by the external webhook sender.

### 5. Start the application

```bash
npm run dev
```

Open `http://localhost:3000`. Use separate accounts or browser sessions for the interviewer and interviewee flows.

## Development and verification

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npx prisma generate` | Regenerate the Prisma client |
| `npx prisma migrate deploy` | Apply committed migrations |
| `npx prisma migrate dev --name <name>` | Create/apply a development migration |

There is no automated test script or project test suite included. Linting and building are separate checks; interactive workflows require configured services and a database.

### Manual integration walkthrough

1. Register an interviewer, complete the profile, and save availability.
2. Register an interviewee and confirm initial credit allocation.
3. Find the interviewer using search and category filters.
4. Book a future slot and verify the appointment for both accounts.
5. Verify the candidate deduction and interviewer balance increase.
6. Join with both accounts; exercise audio/video, chat, and screen sharing.
7. Generate questions from the interviewer's AI tab.
8. End the session and inspect webhook logs; confirm feedback and `COMPLETED` status after successful transcript analysis.
9. If a recording was made, verify that its event stores a recording URL.
10. Exercise Starter/Pro UI access with corresponding Clerk entitlements.
11. Submit a withdrawal, verify the payout and email, then mark it processed through the review page.

### Troubleshooting

| Symptom | What to inspect |
| --- | --- |
| Database or generated-client errors | Database URL/reachability, migrations, Prisma generation |
| No slots appear | Availability, browser-local time, future starts, conflicts, and whether a full 45-minute slot fits |
| Booking fails | Candidate role, credits, overlaps, Arcjet decisions, Stream credentials |
| Call stays on connecting screen | Browser console, Stream configuration, booking membership, token validity |
| AI questions fail | Model access, Gemini credentials, valid JSON output |
| Feedback never appears | Webhook reachability, event type, call ID matching, speech entries, Gemini response, server logs |
| Recording button absent | Recording URL and Pro entitlement; recording is available, not automatically started by app code |
| Wrong checkout plan | Clerk plan IDs, slugs, static pricing configuration |
| Withdrawal saves without email | Resend sender/destination and email error logs |
| Review link opens wrong host | `NEXT_PUBLIC_APP_URL` |

## Deployment considerations

Deploy to an environment that runs the Next.js server, Server Actions, and webhook route. A static-only export cannot run these workflows.

- Supply environment configuration during build/runtime as appropriate; public variables are used by browser code.
- Generate Prisma and apply committed migrations to the target database.
- Configure production Clerk plans, Stream, and the webhook URL.
- Set the application base URL and email sender/recipient.
- Allow enough execution time for transcript download, Gemini generation, and database writes inside the webhook request.
- Account for PostgreSQL connection pools across multiple server instances.
- Review the Next.js configuration: it enables component caching and partial prefetching, configures a Tailwind Turbopack loader, disables React Strict Mode, and includes a fixed development-origin entry.
- Review the access and processing boundaries below before exposing sensitive workflows.

## Current implementation boundaries

These details define the behavior and guarantees of the current code:

| Area | Current behavior |
| --- | --- |
| Webhook trust | Incoming JSON is parsed without a Stream signature check. The handler fetches the supplied transcript URL. |
| Webhook reliability | Processing runs inline without a queue. Caught processing errors return HTTP 200, so those errors do not request provider retries. |
| Duplicate events | Existing feedback is skipped and writes use an upsert. Earning-record creation uses a separate check/write without a unique booking/type constraint; it is not an exactly-once guarantee. |
| Booking concurrency | Balance and overlap checks precede the write transaction. No database constraint prevents concurrent overlaps, and there is no atomic balance guard against simultaneous requests. |
| Booking validation | The UI constrains dates and duration. The action does not fully revalidate availability membership, future timestamps, or expected duration. |
| External call cleanup | A Stream call created before a failed database transaction is not automatically removed. |
| Availability and time zones | One active window recurs daily using local JavaScript hours/minutes. There are no stored IANA time zones, weekday rules, or date-specific exceptions. Booking does not change availability status. |
| Session lifecycle | Feedback persistence completes the booking. Call access checks participation but does not enforce a scheduled join window or booking status. |
| Appointment grouping | Interviewee upcoming items require a future start; past items require an ended session or non-scheduled status. An ongoing scheduled session can fall between those groups. |
| Subscription enforcement | Full-report and recording buttons are gated in the client. Appointment readers return feedback and recording data; these are not server-side data-access restrictions. |
| Role enforcement | Navigation includes client redirects. Sensitive actions have their own checks, but redirects alone do not establish server authorization for every read. |
| Payout administration | Review details load without an explicit page auth check. Approval uses a shared password rather than an authenticated administrator role. There is no automated transfer or rejection/refund workflow. |
| AI output | Responses are parsed as JSON without a dedicated runtime schema validator. Feedback depends on transcript quality and successful model output. |
| Logging | Webhook logs include transcript and model-response previews, so logs can contain interview content. |
| Unimplemented schema paths | Cancellation, blocked/booked availability management, credit purchases, admin credit adjustments, and user-entered session ratings have no complete workflows despite corresponding schema values/fields. |
| Interviewer rates | `creditRate` is read for pricing and defaults to 1 in the schema; onboarding/dashboard has no rate-editing workflow. |
| Chat and recording | Chat appears inside the call room with no separate inbox. Recording is available in call settings, but app code does not explicitly start it automatically. |

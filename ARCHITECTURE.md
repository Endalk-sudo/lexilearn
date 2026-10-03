# LexiLearn Architecture

LexiLearn uses a **feature-based structure**: code is organized by domain feature, with shared building blocks kept in dedicated layers.

## Directory Layout

```
src/
├── app/                  # Next.js App Router — thin entry layer only
│   ├── layout.tsx        #   root layout (theme, toaster, onboarding, PWA)
│   ├── page.tsx          #   SPA shell; swaps feature views via the store
│   └── api/lexilearn/    #   single catch-all API route (?action=...)
├── components/           # SHARED components only (used by 2+ features)
│   ├── ui/               #   shadcn/ui design-system primitives
│   ├── feedback/         #   session feedback (xp-pop, session-complete, confetti…)
│   ├── layout/           #   page-header, next-step, segmented-control
│   ├── app-shell.tsx     #   sidebar / mobile tabs / top bar
│   └── word-card.tsx     #   shared word card (learn, library, search palette)
├── features/             # ONE folder per vertical feature
│   ├── today/            #   home dashboard (daily challenge, streaks)
│   ├── learn/            #   new-word learning (word cards, spelling input)
│   ├── review/           #   SM-2 spaced-repetition review sessions
│   ├── quiz/             #   quiz modes (incl. match game)
│   ├── dictation/        #   hear-it-type-it drills
│   ├── library/          #   decks, dictionary, CSV import, word forms
│   ├── progress/         #   stats, contribution calendar, settings
│   ├── coach/            #   AI mentor (also owns server-side agent code)
│   ├── onboarding/       #   first-run onboarding flow
│   └── study/            #   cross-page study UI (text scale, focus mode, fit tiers)
├── db/                   # drizzle schema, env, id helpers
├── server/               # server-only helpers (stats aggregation for the API)
├── hooks/                # shared React hooks
└── lib/                  # SHARED logic (store, router, api client, srs,
                          #   tts, feel, motion, utils, resume, db)
```

## Feature folder convention

Each feature folder may contain:

- `components/` — UI used only by this feature
- `lib/` — client-side logic used only by this feature (e.g. `dictation/lib/dictation.ts`)
- `server/` — server-only code imported by the API route (e.g. `coach/server/mentor-agent.ts`, `coach/server/ollama.ts`)

## Placement rules

1. Used by **one feature only** → belongs in that feature folder.
2. Used by **two or more features** → belongs in `src/lib/` or `src/components/`.
3. `src/app/` is transport only — no business logic. View routing happens through the zustand store (`lib/store.ts`) + hash router (`lib/router.ts`), so views are plain components under `features/*/components`.
4. Client code never imports another feature's *internals* (its `lib/`, `server/`, or non-exported pieces). A self-contained view component such as `LearnView` and `SpellingInput` may be reused cross-feature only when it's exported and prop-driven (as `deck`/`library` embed `LearnView`); any other shared UI belongs in `src/components/` or `src/lib/`.

## Data flow

```
feature component → lib/api.ts → /api/lexilearn?action=… → route.ts
                                                            ├─ db (drizzle)
                                                            ├─ server/stats.ts (dashboard / analytics)
                                                            └─ features/coach/server/* (AI mentor, ollama)
```

## Dates and day keys

Day keys are **local calendar days** (`YYYY-MM-DD`), produced by
`src/lib/date.ts` (`dayKey`, `parseDayKey`, `startOfDay`, `addDays`).

Never use `new Date().toISOString().slice(0, 10)` for a day key: `toISOString`
converts to UTC first, so the key is off by one day for anyone east of
Greenwich in the evening and west of it in the morning. Streaks, "learned
today", daily goals and the contribution calendar all compare day keys as
strings, so a single UTC key breaks them.

## Activity heatmap payload

`dashboard` and `analytics` return a **sparse** heatmap — only the days that
have activity, inside the current 53-week window. `ContributionCalendar`
rebuilds the full Sunday-aligned grid from those dates, so the payload stays
small (typically well under 1 KB) instead of shipping 371 mostly-empty rows.
Streak maths inside the calendar walks the calendar by date, so a quiet day
breaks a run even though the payload skips it.

## Database path and the standalone bundle

`src/db/env.ts` resolves the SQLite file from `LEXILEARN_DB_URL`, then
`.env`'s `DATABASE_URL`, then the `file:./db/custom.db` default, always
relative to `process.cwd()`. Absolute paths outside the project root are
legitimate — that is how `scripts/e2e-isolated.sh` points the server at a
throwaway clone in `$TMPDIR`.

Paths **inside `.next/` are refused**. `output: 'standalone'` traces the
project into `.next/standalone`, and because the db path is resolved from the
cwd, a server started from inside that directory would silently open the
bundled *snapshot* of the database and write progress there instead of to the
real one. `next.config.ts` keeps `db/` and the rest of the project out
of the trace; the refusal in `env.ts` is the backstop for when it cannot.

Always start the standalone server from the project root (`pnpm start`).

`.env` is the one file that still ships in the bundle — Next copies it there
itself so the server can read config at runtime, and every variable in it has a
code-level fallback (`features/coach/server/ollama.ts`, `db/env.ts`). Keep real
secrets out of `.env` and pass those through the environment instead.

## Testing

```bash
pnpm test              # unit tests (vitest)
pnpm test:watch        # unit tests in watch mode
pnpm test:coverage     # unit tests with coverage report
pnpm e2e:isolated     # all e2e suites, against a throwaway copy of the db
pnpm e2e              # phased suite against a server you started yourself
pnpm e2e:deep         # deep integration suite (A–Z phases)
pnpm e2e:router       # hash-router regression (E668)
```

Unit tests cover pure functions: SM-2 algorithm (`srs.ts`), date helpers
(`date.ts`), and the rate limiter (`server/rate-limit.ts`).

`scripts/e2e-isolated.sh` clones `db/custom.db` to a temp file and boots the
standalone server with `LEXILEARN_DB_URL` pointed at the clone, so grading real
cards and adding real words during a run can never touch your study database.
The deep suite also deletes the words it creates (phase Z). Suites accept
`LEXILEARN_E2E_BASE` to target another host/port.

CI runs lint, typecheck, and the e2e script (`.github/workflows/ci.yml`).

## Security

- **CSRF protection**: `src/server/csrf.ts` rejects cross-site POST requests
  via `Sec-Fetch-Site` and `Origin` vs `Host` header checks.
- **Rate limiting**: `src/server/rate-limit.ts` provides a per-IP sliding
  window (100 req/min) to prevent a buggy client from flooding the server.
- **Input validation**: All POST bodies are validated with Zod schemas before
  reaching the database. The `mentor` action was the last unvalidated endpoint
  and now has a proper `MentorBody` schema.
- **Error handling**: API error responses don't leak internal details in
  production (`NODE_ENV=production`).

## Performance

- **Database**: Composite indexes on `ReviewLog(deckId, reviewedAt)`,
  `MentorAttempt(branchId, createdAt)`, and `MentorSession(mode, createdAt)`
  for common query patterns — plus `QuizSession(completedAt)`,
  `NaturalnessAttempt(createdAt)`, `MentorNode(branchId, createdAt)`,
  `MentorBranch(projectId, createdAt)`, `MentorAttempt(nodeId, createdAt)`,
  `MentorTurn(branchId, createdAt)`, and `ReviewLog(grade)`. Redundant
  prefix/duplicate indexes were dropped (`Word(deckId)`, `Word(word)`,
  `Word(category)`, `MentorAttempt(branchId)`, `MentorSession(mode)`, the two
  `MentorTurn` singles) — every index taxes every write. Note:
  `drizzle-kit push` is currently broken (fails with "index already exists"
  even on an untouched tree), so schema index changes must also be applied
  to `db/custom.db` by hand (`CREATE/DROP INDEX IF EXISTS`) until that is
  fixed. Three declared indexes (`ReviewLog(deckId, reviewedAt)` among them)
  had in fact never reached the live DB for this reason.
- **Queries**: The `decks` endpoint uses a single `GROUP BY` instead of
  fetching every word row into JS. Dashboard and analytics queries are
  range-bounded or aggregated in SQL.
- **Deck detail pagination**: The `deck` endpoint serves words a page at a
  time (30 by default, 100 max) behind a keyset cursor (`createdAt:id` —
  `createdAt` alone is not unique after a bulk CSV import, so `id` breaks
  ties). Offset pagination would duplicate/skip rows when words are added
  mid-scroll; the cursor anchors on the last row actually sent. A composite
  `Word(deckId, createdAt, id)` index turns each page into a range scan, and
  `total` / `filteredTotal` / `masteredCount` come from `COUNT(*)` aggregates
  so the client never needs the full list to render counts. Only the first
  page animates — later pages are plain rows, because a 500-row stagger
  cascade delayed the last row by 10 seconds.
- **SQLite pragmas** (`src/lib/db.ts`): `synchronous = NORMAL` (FULL costs 2
  fsyncs per commit), `busy_timeout = 5000` (a second writer waits instead of
  `SQLITE_BUSY`), `cache_size = -64000`, `temp_store = MEMORY` (GROUP
  BY/ORDER BY spill files are pure overhead locally), and a 64 MB
  `journal_size_limit` so long-lived servers never replay a giant WAL.
- **Hot queries**: quiz generation samples in SQL (`ORDER BY RANDOM() LIMIT`,
  capped at 20 questions, bounded 200/100 distractor pools) instead of
  loading whole decks plus the dictionary and JSON-parsing every row.
  `claimChallenge` counts in SQL instead of shipping the day's full log rows.
  The 8 serial `AppStat` reads per dashboard call (6 per analytics, 5 per
  settings) are one `WHERE key IN (...)` now. Bulk/category writes resolve
  all categories once per import instead of a `lower()` SELECT per category
  per word inside the write lock, `submitReview` fires its two reads in
  parallel, review's fallback fetch joins the initial `Promise.all`, and deck
  deletes run in a single transaction.
- **Caching, three layers**: per-action `Cache-Control` (`dashboard` 15s,
  `analytics`/`categories`/`settings`/deck pages 15–60s; quiz/review/search
  never cached); a client request cache in `lib/api.ts` (in-flight dedupe
  for all GETs, 10s TTL for dashboard/decks/categories/settings, busted by
  every mutation so writes are never followed by stale reads); and the
  service worker (allowlist + 5-minute TTL + 60-entry cap — quiz draws, due
  queues and search results must never be served stale offline).
- **Bundle**: non-Today views (Quiz, Dictation, Library, Progress, Coach)
  and the recharts charts split off via `next/dynamic`, canvas-confetti
  loads on first celebration, and `optimizePackageImports` covers
  recharts/lucide-react/framer-motion. First-paint JS went 1715 KB → 1024 KB
  raw (491 KB → 308 KB gzip). `AnimatePresence mode="wait"` on the view
  switch became `mode="sync"` so the old view's exit no longer holds the
  new one hostage.
- **Render**: deck grid and appended deck pages are plain rows (only the
  first page staggers); the contribution calendar memoizes cells and
  precomputes future-flags so hover re-renders 2 cells, not 371; the
  progress activity feed mounts in 25-row steps; Learn owns TTS alone
  (WordCard no longer double-speaks); the mentor keydown listener
  subscribes once via ref.
- **Caching**: The `decks` endpoint returns `Cache-Control: private, max-age=15`.
- **Service worker**: Cache version bumped to `lexilearn-v3` with proper
  cleanup of stale caches on activate.
- **DB singleton**: Fixed HMR caching issue — the DB connection is now cached
  in all environments, preventing connection leaks across hot reloads.

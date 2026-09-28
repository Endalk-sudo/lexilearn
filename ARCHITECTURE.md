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
│   └── word-card-v2.tsx  #   shared word card (learn, library, search palette)
├── features/             # ONE folder per vertical feature
│   ├── today/            #   home dashboard (daily challenge, streaks)
│   ├── learn/            #   new-word learning (word cards, spelling input)
│   ├── review/           #   SM-2 spaced-repetition review sessions
│   ├── quiz/             #   quiz modes (incl. match game)
│   ├── dictation/        #   hear-it-type-it drills
│   ├── library/          #   decks, dictionary, CSV import, word forms
│   ├── progress/         #   stats, contribution calendar, settings
│   ├── coach/            #   AI mentor (also owns server-side agent code)
│   └── onboarding/       #   first-run onboarding flow
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
4. Client code never imports another feature's internals; if a component is needed cross-feature, promote it to `src/components/` or `src/lib/`.

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
  for common query patterns.
- **Queries**: The `decks` endpoint uses a single `GROUP BY` instead of
  fetching every word row into JS. Dashboard and analytics queries are
  range-bounded or aggregated in SQL.
- **Caching**: The `decks` endpoint returns `Cache-Control: private, max-age=30`.
- **Service worker**: Cache version bumped to `lexilearn-v2` with proper
  cleanup of stale caches on activate.
- **DB singleton**: Fixed HMR caching issue — the DB connection is now cached
  in all environments, preventing connection leaks across hot reloads.

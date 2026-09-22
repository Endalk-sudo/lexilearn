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

## Testing

```bash
npm run e2e:isolated     # all suites, against a throwaway copy of the db
npm run e2e              # phased suite against a server you started yourself
npm run e2e:deep         # deep integration suite (A–Z phases)
npm run e2e:router       # hash-router regression (E668)
```

`scripts/e2e-isolated.sh` clones `db/custom.db` to a temp file and boots the
standalone server with `LEXILEARN_DB_URL` pointed at the clone, so grading real
cards and adding real words during a run can never touch your study database.
The deep suite also deletes the words it creates (phase Z). Suites accept
`LEXILEARN_E2E_BASE` to target another host/port.

CI runs the same script (`.github/workflows/e2e.yml`).

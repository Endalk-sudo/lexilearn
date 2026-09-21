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

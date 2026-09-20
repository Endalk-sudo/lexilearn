# LexiLearn — AI Mentor (Local Ollama) Setup

> Status note (2026-09-20): the Mentor has been rebuilt as a
> conversation-style tutor. The storage layer migrated from Prisma to
> Drizzle ORM (`src/db/schema.ts`, same SQLite file, same tables), so the
> old Prisma setup commands in this file were removed. See
> "Fresh database setup" for the current flow.

## What the Mentor is now

- **Mentor** — the **AI Coach screen** (`#/coach`) has two tabs: **Mentor**
  and **Lab**. The Mentor tab is a conversation-style adaptive tutor: you
  answer in a chat-like flow — your attempt → self-correction → diagnosis →
  lesson → follow-up retrieval question. Branch, memory (recent mistakes,
  skill strengths) and learning map live in popovers, so the main column
  stays focused. Open it from the AI Coach button (Today, Review, Settings).
- **Lab (Coach Lab)** — mastery map, weekly coach report, browser speech
  practice, naturalness coaching.

Four Mentor modes per branch:
  1. **Drill** — fast reps on one rule
  2. **Scenario** — roleplay real situations
  3. **Exam** — timed, rubric-based
  4. **Review** — repair recurring mistakes (driven by your error cards)

Under the hood: agentic loop (generate → validate → diagnose → schedule)
in `src/lib/mentor-agent.ts`, structured JSON contracts with schema
validation and one repair attempt, persistent branches/nodes/attempts,
skill mastery per focus tag, and error cards scheduled for future repair.

## Requirements

1. [Ollama](https://ollama.com) installed and running on the same machine
2. At least one model pulled, e.g.:

```bash
ollama pull qwen3:8b          # default chat model
ollama pull nomic-embed-text-v2-moe   # embeddings for local retrieval
```

3. In the project `.env` (all optional — these are the defaults):

```
DATABASE_URL=file:./db/custom.db
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_EMBED_MODEL=nomic-embed-text-v2-moe
```

The database lives at `db/custom.db` (override with `LEXILEARN_DB_URL`).
Without Ollama running, the rest of LexiLearn (Learn, Review, Quiz,
Library, Progress) keeps working normally — the Mentor surfaces a clear
empty state instead of breaking.

## Fresh database setup

The schema ships with the repo in `src/db/schema.ts` (Drizzle, 23
tables). The existing `db/custom.db` is already compatible; for a brand
new database file, run the seed script which provisions tables and seed
decks:

```bash
pnpm install
npx tsx scripts/seed.ts
pnpm dev
```

> Housekeeping note: `package.json` still lists legacy Prisma scripts
> (`postinstall`, `db:push`, `db:generate`, `db:migrate`, `db:reset`)
> from before the Drizzle migration. They are inert without a
> `prisma/` directory and are safe to remove in a cleanup pass.

## Design notes

- Visual style follows the "Quiet focus" design system (`REDESIGN.md`).
- The Mentor is deliberately optional so the core spaced-repetition
  experience stays fast and works offline.
- All AI traffic stays on localhost. Nothing is sent to the cloud.

## Still open

- Wire Mentor as the adaptive engine behind Learn / Review / Quiz
- True phoneme-level pronunciation scoring (local Whisper pipeline)
- Weekly coach report e-mailed/exported
- Branch mastery gates
- Offline job queue for slow local inference

The foundation is in place.

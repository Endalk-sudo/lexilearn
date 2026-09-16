# LexiLearn — AI Mentor (Local Ollama) Setup

## What was added

- New **Mentor** section in the navigation (desktop sidebar + mobile bottom nav)
- Full local Ollama integration (optional — the rest of the app works without it)
- Four Mentor modes:
  1. **Practice Generator** — cloze, rewrite, error correction, use-in-paragraph, discussion questions from your target words
  2. **Writing Coach** — paste/write a paragraph → detailed correction + explanations + Amharic glosses when helpful
  3. **Conversation / Role-play** — scenario-based chat with gentle corrections
  4. **Deep Explainer** — ask “what’s the difference…”, “why is this wrong…”, etc.
- New Prisma models: `MentorSession`, `ErrorLog`, `PracticeMaterial` (ready for future adaptive features)
- Environment variables for model selection

## Requirements

1. [Ollama](https://ollama.com) installed and running on the same machine
2. At least one model pulled, e.g.:

```bash
ollama pull qwen3:8b
# or
ollama pull qwen2.5
# or
ollama pull gemma2
```

3. In the project `.env`:

```
DATABASE_URL=file:../db/custom.db
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
```

Change `OLLAMA_MODEL` to whatever you prefer.

## After pulling this code

```bash
# Install deps
pnpm install   # or npm install

# Push new schema (MentorSession etc.)
npx prisma db push

# Generate client
npx prisma generate

# Seed if needed
npx tsx scripts/seed.ts

# Run
pnpm dev
```

Open the app → **Mentor** in the sidebar.  
If Ollama is not running you will see clear instructions. The rest of LexiLearn (Learn, Review, Quiz, Decks, Stats…) continues to work normally.

## Design notes

- Visual style kept as a blend of clean/minimal + energetic (warm primary, smooth Framer Motion transitions, micro-feedback).
- Mentor is deliberately optional so the core spaced-repetition experience stays fast and offline-first.
- All AI traffic stays on localhost. Nothing is sent to the cloud.

## Next recommended improvements (still open)

- Wire ErrorLog automatically from writing corrections
- Save generated practice materials into PracticeMaterial and review them later
- Speaking mode (browser SpeechRecognition → Ollama feedback)
- AI-generated short reading passages that use your current SRS words
- Stronger micro-interactions across Learn/Review cards
- Performance pass (React Query caching, virtualized word lists, etc.)

The foundation is now in place.

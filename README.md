# LexiLearn AI

> **Local-First, Privacy-Focused English Vocabulary Learning Platform with Tactile Neumorphism (Soft UI) and Local AI Mentoring**

[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-16%20(Turbopack)-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Drizzle%20ORM-003B57.svg)](https://orm.drizzle.team/)
[![License](https://img.shields.io/badge/license-Private-lightgrey.svg)](package.json)

---

## Overview

**LexiLearn AI** is a modern, distraction-free vocabulary acquisition platform engineered with a tactile **Neumorphic (Soft UI)** design system, Anki-compatible **SuperMemo SM-2** spaced repetition, and an optional **local AI Mentor** powered by Ollama. 

All user data, learning progress, word definitions, and AI interactions remain **100% on your local machine** inside an embedded SQLite database. There are zero cloud telemetry calls, no third-party trackers, and no external dependencies required for core learning and review workflows.

---

## Key Highlights

### 1. Tactile Neumorphic (Soft UI) Design System
* **Dual-Lighting Shadow Engine**: Modeled on a physical 135° top-left illumination angle with paired highlight and shadow coordinates (`.surface`, `.surface-inset`, `.input-neu`).
* **Convex vs. Concave Mechanics**: Clickable elements and cards rise out of the background as extruded tactile pills (`shadow-neu-sm`, `shadow-neu-md`), while inputs, sliders, and progress wells deboss inwards (`shadow-neu-inset-sm`, `shadow-neu-inset-md`).
* **Spring Physical Feedback**: Buttons feature realistic spring-loaded depression (`active:shadow-neu-pressed`, `active:translate-y-px`) on interaction.
* **Hydration & Dark Reader Hardened**: Immune to SSR hydration mismatches from browser extension attribute injections (`data-darkreader-lock`, `suppressHydrationWarning`, synchronized sound stores).

### 2. Spaced Repetition (SuperMemo SM-2)
* Anki-compatible mathematical scheduling based on user recall ratings (`Again [0]`, `Hard [3]`, `Good [4]`, `Easy [5]`).
* Dynamic Ease Factor (EF) adjustments starting at 2.5 with a 1.3 floor.
* Honest scheduling intervals (1d → 6d → EF × interval) with card mastery graduation (≥ 5 repetitions and interval ≥ 21 days).

### 3. Curated CEFR English Vocabulary
* 2,569 seed headwords across **CEFR A1, A2, B1, and B2** levels.
* Contextual definitions, parts of speech, and real-world example sentences.
* Single-word **Dictation Drills** with audio playback and 3-rung session ladders.

### 4. Local AI Mentor & Coach Lab (Ollama)
* **Local Inference**: Uses local Ollama models (`qwen3:8b` for structured conversation and `nomic-embed-text-v2-moe` for vector knowledge retrieval).
* **Agentic Practice Loops**: Generates focus-locked practice branches (questions, real-world scenarios, challenges, and error recovery).
* **Adaptive Error Handling**: Structured 4-level hint ladders without leaking answers, automatic self-correction, root-cause diagnosis, and error-card scheduling.
* **Coach Lab**: Skill mastery visualization, weekly coach summaries, speech practice, and conversational naturalness scoring.

### 5. Multi-Sensory "Feel" Engine
* Synthesized mechanical typing sounds on text inputs (pitch-randomized, debounced).
* Web Audio session feedback (correct, wrong, level-up celebration sounds).
* Service worker caching providing complete offline usability for the entire app shell and spaced repetition reviews.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack, Standalone Output) |
| **UI Library** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) (OKLCH color space) |
| **Components & Primitives** | [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/), [shadcn/ui](https://ui.shadcn.com/) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) (with `prefers-reduced-motion` compliance) |
| **Database & ORM** | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [Drizzle ORM](https://orm.drizzle.team/) (WAL mode) |
| **Client State** | [Zustand](https://github.com/pmndrs/zustand) (synced to URL hash router) |
| **Local AI** | [Ollama](https://ollama.ai/) (`qwen3:8b`, `nomic-embed-text-v2-moe`) |
| **Testing** | [Vitest](https://vitest.dev/), Python Playwright / E2E test suites |

---

## Getting Started

### Prerequisites
* **Node.js**: `20.x` or higher
* **pnpm**: `9.x` or higher
* **Ollama** *(Optional, for AI Mentor features)*: [Install Ollama](https://ollama.ai/) and run `ollama pull qwen3:8b`.

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd lexilearn-ai
pnpm install
```

### 2. Environment Configuration
Copy the template environment variables:
```bash
cp .env.example .env
```
Default `.env` configuration:
```ini
DATABASE_URL="file:db/custom.db"
PORT=8000
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="qwen3:8b"
OLLAMA_EMBED_MODEL="nomic-embed-text-v2-moe"
```

### 3. Database Initialization & Seeding
Initialize the SQLite schema and populate the 2,569 CEFR words:
```bash
# Push schema to SQLite
pnpm db:push

# Seed CEFR A1-B2 vocabulary decks
pnpm db:seed

# Verify database integrity
pnpm db:verify
```

### 4. Running the Development Server
```bash
pnpm dev
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## Production Build

To build the optimized Next.js standalone server:
```bash
# Build standalone bundle
pnpm build

# Start production server
pnpm start
```

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
|---|---|---|
| `⌘K` or `/` | Anywhere | Open quick search & command palette |
| `1` – `6` | Global Nav | Switch modes (Review, Learn, Dictate, Deck, Library, Coach) |
| `Space` | Learn / Review | Flip card, reveal answer, replay audio |
| `1` / `2` / `3` / `4` | Review (Answer Revealed) | Rate card: `1` (Again), `2` (Hard), `3` (Good), `4` (Easy) |
| `H` | AI Mentor | Open next hint ladder level |
| `R` | AI Mentor | Request new practice challenge / scenario |
| `Esc` | Dialogs / Modals | Close modal or dismiss palette |

---

## Testing & Quality Assurance

Run the comprehensive unit test suite:
```bash
# Run unit tests with Vitest (11 suites, 76 tests)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run linter
pnpm lint
```

For browser integration and end-to-end tests:
```bash
# Run phased E2E tests
pnpm e2e

# Run UI/UX interaction verification
pnpm e2e:interactions
```

---

## Documentation

For in-depth technical specifications and architectural details:
* [**DESIGN.md**](DESIGN.md) — Visual tokens, dual-lighting physics, Neumorphic surface specs, hydration guards, and accessibility guidelines.
* [**ARCHITECTURE.md**](ARCHITECTURE.md) — System topology, Drizzle database schema (24 tables), API contracts, CSRF protections, and rate limiting.
* [**PRD.md**](PRD.md) — Functional specifications, SM-2 formula, CEFR seeds, and release changelog.

---

## License

Private repository. All rights reserved.

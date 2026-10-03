# LexiLearn — Product & Interface Design Specification (`DESIGN.md`)

**Product Version:** 0.4.0  
**Design Philosophy:** "Quiet Focus" · Tactile Neumorphism (Soft UI) · Local-First Ergonomics  
**Last Updated:** October 2026  

---

## 1. Product Design Vision & Identity

### 1.1 Core Value Proposition
LexiLearn is a **local-first, distraction-free English vocabulary mastery application** powered by the **SM-2 spaced-repetition algorithm**, browser-native text-to-speech, and private local AI mentoring. It is engineered for serious, self-directed learners who want long-term word retention without subscriptions, dark patterns, telemetry, or cloud bloat.

### 1.2 Target Personas & Contexts
1. **The Exam Aspirant (TOEFL / IELTS / GRE)**: Needs fast, repeatable daily loops with precision definitions, phonetics (IPA), CEFR leveling, and realistic example sentences.
2. **The Bilingual Learner (English / Amharic)**: Benefits from immediate Amharic translations alongside English definitions for instant cognitive bridging.
3. **The Privacy-Conscious Practitioner**: Demands total data sovereignty — every word, review log, streak, and audio synthesis happens entirely within the user's browser and SQLite on device.

### 1.3 Design Pillars ("Quiet Focus" & Tactile Neumorphism)
- **Calm, Soft-Embossed Surfaces (Neumorphism / Soft UI)**: The entire interface mimics real physical controls extruded from or debossed into a unified matte material. No harsh flat black borders or jarring neon fills.
- **Directional Dual-Lighting Physics**: A single coherent light source from the top-left (135°) illuminates the entire UI, creating gentle diffuse top-left highlights and soft bottom-right drop shadows.
- **Tactile Multisensory Reinforcement**: Every correct recall or keystroke produces immediate visual, auditory, and haptic feedback with physical spring-press physics (`active:shadow-neu-pressed`, `active:scale-[0.97]`).
- **Zero-Friction Daily Loops**: Opening the app immediately presents the highest-value action (due cards, new words, or a focused drill) in one click without decision paralysis.
- **Keyboard-First & Gesture-Friendly**: Full power on desktop keyboards (`Space`, `1-4`, `⌘K`) and fluid swipe-and-tap targets on mobile devices.

---

## 2. Information Architecture & Navigation

The navigation model is flat at the top level: **5 primary destinations**
(`PRIMARY_TABS`, `src/components/app-shell.tsx`), each optionally split by a single
in-page `SegmentedControl` — Library → Decks · Dictionary, Progress → Overview ·
Settings, Coach → Mentor · Insights. No nested tab mazes.

```
                ┌──────────────────────────────────────────────────────┐
                │      LexiLearn App Shell (src/app/page.tsx)          │
                │  Desktop ≥md:  AppSidebar (5 tabs + AI Coach)        │
                │                 + LaptopTopNav (6 quick-modes,      │
                │                   search, `?` shortcuts, streak)     │
                │  Mobile <md:   MobileTopBar (logo + search)          │
                │                 + MobileTabs (5 tabs, bottom)         │
                └────────────────────────┬─────────────────────────────┘
                                         │
      ┌────────────┬─────────────┬───────┴────────┬─────────────┐
      ▼            ▼             ▼                ▼             ▼
  [ Today ]    [ Learn ]     [ Review ]       [ Library ]   [ Progress ]
 Daily Quest  4-stage new   SM-2 spaced       • Decks       • Overview
 & Streaks    word loop      repetition       • Dictionary   • Settings
      │            │             │                │             │
      │            │             │                ▼             │
      │            │             │         [ Deck detail ]         │
      │            │             │         • endless study         │
      ▼            ▼             ▼                ▼             ▼
[ Dictation ]  (same flow)  4-pill dock   [ Deck ]  (top-level view;
 • word-only rungs                              `g v`, Today dock)
      │
      ▼
[ AI Coach & Mentor ] — sidebar dedicated entry, plus Insights
 • 10 focus tracks, native-rewrite comparisons, speech + naturalness lab
```

Top-level views that are **not** primary tabs: Dictation, Deck, Coach, and Deck
detail (`library-deck`). Desktop reaches them from `LaptopTopNav`, the `g`-then-key
chords, or the search palette; mobile reaches Dictation and Coach only from Today's
quick links.

---

## 3. Design Tokens & Color Architecture

LexiLearn utilizes an **OKLCH hue-parameterized design system**. Changing a single CSS token (`--accent-hue`) — or picking one of the five shipped accent presets in `ACCENT_THEMES` (`src/lib/store.ts:30-36`) — restyles the entire application while maintaining perceptual contrast.

### 3.1 Color Palette Tokens

| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--accent-hue` | `259` Iris (alt: `220` Sapphire · `155` Emerald · `50` Amber · `345` Rose) | same 5 presets | Master hue; user-selectable in the sidebar and Settings → Appearance |
| `--background` | `oklch(0.991 0.002 259)` | `oklch(0.168 0.008 259)` | App background canvas |
| `--foreground` | `oklch(0.22 0.02 259)` | `oklch(0.955 0.005 259)` | High-contrast readable typography |
| `--card` | `oklch(1 0 0)` | `oklch(0.21 0.01 259)` | Primary content cards (the `.surface` class composes it) |
| `--border` | `oklch(0.915 0.006 259)` | `oklch(0.3 0.012 259)` | Structural lines & card borders |
| `--primary` | `oklch(0.47 0.13 259)` | `oklch(0.72 0.125 259)` | Accent CTAs, active states, rings |
| `--primary-soft` | `color-mix(9% primary, card)` | `color-mix(16% primary, card)` | Badges, highlighted selections |
| `--success` | `oklch(0.47 0.12 155)` | `oklch(0.72 0.13 155)` | Correct answers, Good review grade |
| `--warning` | `oklch(0.5 0.12 70)` | `oklch(0.78 0.13 75)` | Hard review grade, offline indicator |
| `--destructive` | `oklch(0.52 0.19 25)` | `oklch(0.68 0.17 25)` | Again / Missed reviews, delete actions |
| `--streak` | `oklch(0.57 0.155 45)` | `oklch(0.74 0.15 50)` | Streak flames, XP milestones |
| `--popover` | `oklch(1 0 0)` | `oklch(0.23 0.01 259)` | Dialogs, popovers, sheets |
| `--primary-line` | 26% primary mix | 34% primary mix | Hover borders, active rails |
| `--sidebar` | `oklch(0.985 0.003 h)` | `oklch(0.19 0.009 h)` | Desktop sidebar canvas |
| `--success-soft` / `--warning-soft` / `--destructive-soft` / `--streak-soft` | 9–13% mix into card | 16–18% mix into card | Tinted fills for pills, grade buttons, banners |
| `--chart-1` … `--chart-5` | hue-parametric | hue-parametric | Analytics series (recharts) |

### 3.2 Vocabulary Level (CEFR) Indicators
Vocabulary cards use standard CEFR classification with distinct visual semantics:
- **A1 / A2 (Elementary)**: Emerald (`text-emerald-700 dark:text-emerald-400` on `WordCard`; `text-emerald-600` on the Review header badge)
- **B1 / B2 (Intermediate)**: Cobalt (`text-blue-700 dark:text-blue-400`; Review uses `text-blue-600`)
- **C1 / C2 (Advanced & Mastery)**: Violet (`text-purple-700 dark:text-purple-400`; Review uses `text-purple-600`)

### 3.3 Typography Hierarchy
- **Primary Sans**: Geist Sans (`--font-sans`) — crisp geometry with high x-height for readability.
- **Monospace**: Geist Mono (`--font-mono`, aliased to `--font-geist-mono` with a `ui-monospace` fallback in `src/app/globals.css:61`) — used for IPA phonetic transcription, keyboard shortcuts (`kbd`), grade labels, and code tags.
- **Tabular Figures (`.num`)**: All numbers, countdowns, streaks, and scores use `font-variant-numeric: tabular-nums` to eliminate layout jitter during counters.
- **Micro-Labels (`.label`)**: `0.75rem (12px)`, `letter-spacing: 0.06em`, uppercase bold for category headers and eyebrows.

### 3.4 Tactile Neumorphism & Surface Elevation System

LexiLearn implements a **dual-lighting, soft-embossed Neumorphic design architecture** defined in `src/app/globals.css`. Rather than relying on flat borders or heavy DropBox-style drop shadows, surfaces mimic physical materials sculpted under a consistent virtual light source positioned in the upper-left (135° diagonal).

#### 3.4.1 Lighting Tokens & Shadow Engine

| Elevation Class | CSS Shadow Token | Light Mode Physics | Dark Mode Physics | Typical Usage |
|---|---|---|---|---|
| **`.surface`** | `var(--shadow-neu)` | `-3px -3px 8px #fff, 3px 3px 10px rgba(0,0,0,0.06)` | `-2px -2px 6px rgba(255,255,255,0.06), 3px 3px 12px rgba(0,0,0,0.55)` | Main word cards, study cards, hero cards, bottom bars |
| **`shadow-neu-sm`** | `var(--shadow-neu-sm)` | `-2px -2px 5px #fff, 2px 2px 6px rgba(0,0,0,0.05)` | `-1.5px -1.5px 4px rgba(255,255,255,0.05), 2px 2px 8px rgba(0,0,0,0.45)` | Buttons, badges, chips, tactile switches, kbd keys |
| **`shadow-neu-lg`** | `var(--shadow-neu-lg)` | `-5px -5px 14px #fff, 6px 6px 18px rgba(0,0,0,0.08)` | `-3px -3px 8px rgba(255,255,255,0.07), 6px 6px 20px rgba(0,0,0,0.65)` | Dialogs, sheets, popovers, dropdown menus, toast alerts |
| **`.surface-inset`** | `var(--shadow-neu-inset)` | `inset 3px 3px 7px rgba(0,0,0,0.07), inset -3px -3px 7px #fff` | `inset 3px 3px 8px rgba(0,0,0,0.6), inset -2px -2px 6px rgba(255,255,255,0.04)` | Writing canvas, textarea wells, spelling slots |
| **`shadow-neu-inset-sm`** | `var(--shadow-neu-inset-sm)` | `inset 1.5px 1.5px 4px rgba(0,0,0,0.06), inset -1.5px -1.5px 4px #fff` | `inset 2px 2px 5px rgba(0,0,0,0.5), inset -1px -1px 4px rgba(255,255,255,0.03)` | Progress bar tracks, tabs track, input fields, toggle tracks |
| **`shadow-neu-primary`** | `var(--shadow-neu-primary)` | `0 4px 14px color-mix(in oklch, var(--primary) 35%, transparent)` | `0 4px 16px color-mix(in oklch, var(--primary) 40%, transparent)` | Primary accent buttons, active indicator pills, level progress |

#### 3.4.2 Physical Interaction Mechanics
- **Convex vs. Concave Rules**:
  - Elements that can be pressed or lifted (cards, buttons, chips, `kbd` shortcuts) use **extruded convex surfaces** (`.surface`, `shadow-neu-sm`).
  - Elements that receive input or guide continuous movement (inputs, search bars, tabs track, progress tracks, switch wells) use **sunken concave debossed wells** (`.surface-inset`, `shadow-neu-inset-sm`).
- **Tactile Pressed State (`active:shadow-neu-pressed`)**:
  - Clicking any tactile control momentarily collapses its extrusion into an inset well (`box-shadow: inset 1.5px 1.5px 3px rgba(0,0,0,0.12), inset -1.5px -1.5px 3px rgba(255,255,255,0.7)`), paired with a slight spring scale (`active:scale-[0.97]`).
- **Dual-Light Edge Highlights**:
  - Extruded cards use `border border-white/60 dark:border-white/10` to simulate the micro-reflection of ambient light catching the upper bevel of the component.
- **Curvature Hierarchy**:
  - `rounded-xl` (12px): Interactive controls — buttons, form inputs, segmented pills, select items, and `kbd` keyboard shortcuts.
  - `rounded-2xl` (16px): Content containers — cards, preview tables, feedback summaries, and sticky navigation HUDs.
  - `rounded-3xl` (24px): Floating surfaces — modals, dialogs, onboarding panels, and sheets.
  - `rounded-full`: Pill badges, slider/switch thumbs, and progress tracks.

---

## 4. Multisensory & Feedback System

Learning is fortified when sensory feedback confirms action:
1. **Audio Feedback (`src/lib/feel.ts`)**:
   - Web Audio API synthesizer tones (one shared `AudioContext`, sine/triangle/sawtooth):
     - `tap`: 520Hz soft click (50ms).
     - `correct`: 660Hz $\rightarrow$ 880Hz ascending chime (90ms + 120ms at +80ms, $\approx$200ms total).
     - `wrong`: 220Hz low sawtooth blip (140ms).
     - `levelup`: 523Hz $\rightarrow$ 659Hz $\rightarrow$ 784Hz major triad flourish.
     - `xp`: 980Hz spark chime.
     - `flip`: 440Hz $\rightarrow$ 587Hz card-flip tick.
     - `combo`: 587Hz $\rightarrow$ 740Hz $\rightarrow$ 880Hz streak flourish.
   - Keystroke layer (`playType` / `playSpace` / `playDelete` / `playSend`, dispatched via
     `typeFeelFromKey`): pitch-randomised $\pm$60-cent ticks, debounced to 30ms apart.
   - **Sound is on by default** (`lexilearn-sound-enabled`), toggled globally with `m`.
2. **Haptic Vibration**:
   - Single-mode browser vibration (`navigator.vibrate`): `light` 10ms, `medium` 18ms,
     `success` `[12,40,18]`, `error` `[30,40,30]`. **Off by default** — enabled from
     Settings $\rightarrow$ Feel $\rightarrow$ Haptics, unlike sound.
3. **Floating XP Particles (`xp-pop.tsx`)**:
   - A `+N XP` particle floats upward from the exact click coordinate (`popXpAt`) or the
     centre of the tapped element (`popXpFromElement`), clamped inside the viewport.
     `N` comes from `GRADE_XP` (`src/lib/srs.ts:24-29`): Again 1 · Hard 3 · Good 5 · Easy 8;
     at most 4 pops are on screen at once.
4. **Celebration Confetti (`canvas-confetti`)**:
   - Multi-stage confetti burst for streak milestones, daily challenge claims, and level-ups.

---

## 5. Page-by-Page Product Design Specifications

### 5.1 Dashboard (`Today`)
- **Purpose**: Welcomes the user, identifies current retention momentum, and delivers the **single highest-leverage learning task**.
- **Hero Mission Card**:
  - Left: Interactive SVG `ProgressRing` displaying `% of Daily Goal`, total learned today, and words remaining.
  - Right: High-prominence CTA button dynamically computed based on queue priority:
    1. Due cards pending $\rightarrow$ **"Review [N]"**
    2. Fresh unseen cards available $\rightarrow$ **"Learn new words"**
    3. Queue empty $\rightarrow$ **"Practice dictation"**
  - Bottom strip: 3 interactive stat tiles (`Due`, `New`, `Streak`) acting as jump links.
- **Daily Quest & Challenge**:
  - Progress bar tracking the daily rotating challenge — **10-word Sprint** (target 10, +35 XP), **Recall Run** (target 8, +40 XP) or **Show Up** (target 1, +25 XP), selected by `Date.now()` day index modulo 3.
  - Amber badge highlighting bonus XP reward with instant claim feedback.
- **Resume Strip**: One-click quick-return if a user left a session midway.
- **Quick Links Grid**: Action dock with Dictation, Study deck, Dictionary, Progress, and AI Coach.

### 5.2 Learn Mode (`New Words`)
- **Purpose**: Systematic 4-stage onboarding of new vocabulary into the memory pipeline.
- **Interaction Workflow**:
  ```
  [ Stage 1: Recall ] ──Space/Enter──▶ [ Stage 2: Meaning ] ──Space/Enter──▶ [ Stage 3: Spell ] ──Enter──▶ [ Stage 4: Result ]
  Word + IPA + POS,               Definition, example,          Word is HIDDEN; the card is        Checkmark + XP
  auto-spoken if enabled          አማርኛ and syllables shown;     an audio prompt — no definition    (Good +5 / Again +1),
  "Say the meaning first"         `r` replays, then Start       or example. Type into the          then Schedule into SM-2
                                  spelling                       letter grid.
  ```

  `Alt+H` / `Ctrl+H` = hint, then reveal-and-skip · `f` toggles focus mode ·
  swipe-left advances any stage.
- **Spelling Input Grid**:
  - Distinct segmented character blocks for each letter of the target word.
  - Active character slot highlighted with scaling and border glow.
  - Green pop for correct letters; shake animation on mistake.
- **Word Card Anatomy (`word-card.tsx`)**:
  - Head: Large title, Part of Speech, IPA transcription, and speaker pronunciation button.
  - CEFR Level pill + expandable letter-count hint.
  - Revealed content is **stacked, not tabbed** (see `word-card.tsx:270-274`): numbered
    definition list → `In context` (up to 3 examples) → `አማርኛ` → word relations.
  - Collapsible **structural-hint drawer** (`HelpCircle`): "Starts with ⟨letter⟩" plus a
    letter count — never the answer. Syllables render inline in the meta line; Synonyms,
    Antonyms and Origin render as always-visible inline rows below the Amharic block.


### 5.3 Review Mode (`SM-2 Spaced Repetition`)
- **Purpose**: Scientifically timed review sessions to beat the Ebbinghaus forgetting curve.
- **Interaction Workflow**:
  - Unrevealed card displays target word $\rightarrow$ Learner attempts mental recall $\rightarrow$ Press `Space` or tap "Reveal Answer".
  - Revealed state displays definitions, Amharic translations, and contextual example.
- **Tactile 4-Pill Grading Dock**:
  - `Again (1)`: Red tint · Interval reset (e.g. `1 day`) · "Forgot completely".
  - `Hard (2)`: Amber tint · Shorter interval extension · "Tough recall".
  - `Good (3)`: Emerald tint · Standard SM-2 interval expansion · "Clean recall".
  - `Easy (4)`: Accent tint (`text-primary` on `bg-primary-soft/50`) — violet under the default Iris accent · Accelerated interval boost · "Instant & clear".
  - Each button shows its computed SM-2 outcome in plain words — `1 day` or `N days` (`previewInterval`, `review.tsx:66-74`) — beside the `+N XP` figure, so the choice is informed before it is made.

### 5.4 Dictation ("Hear it. Type it.")
- **Purpose**: Auditory processing and accurate word-level transcription drills.
- **Rungs Progression** — every rung drills **single words only**; the ladder changes
  session *length*, not item type:
  - Foundation — 8 words · Building — 12 words · Fluent — 16 words.
  - `RUNG_LABELS = ['Foundation','Building','Fluent']`, persisted in `localStorage`
    (`lexilearn-dictation-rung`); keys `1`–`4` pick a rung or return to Adaptive.
    `nextRung` climbs at ≥80% average accuracy, holds at ≥55%, drops below that.
  - Below `MIN_SESSION_ITEMS` (5) the start screen asks for more words instead of
    drilling thin air.
- **Audio Control Bar**:
  - Primary Play / Repeat button (`Space`).
  - Speed toggle: `Normal (1.0×)` vs `Slow (0.7×)` (`PRESET_RATES`). Between items
    `Space`/`r` replays and `s` replays slow; while typing `Alt+R`/`Ctrl+Space` replays,
    `Alt+S`/`Ctrl+Shift+Space` replays slow and `Alt+H`/`Ctrl+H` reveals a hint.
  - Replay counter ("Played N times · Space replays") plus an explicit
    "Replays are always free" promise.
- **Visual Diff Inspection**:
  - Tokenized breakdown comparing typed input against the target (`groupDiff`):
    - Plain foreground = correct word match (correctness does not shout).
    - Red, struck through = what you typed instead; the expected word is shown beside
      it in a green (`success/15`) pill.
    - Amber (`warning/20`) pill = skipped word. Skipped words cost a full accuracy mark,
      stray words cost half (`accuracyOf`).


### 5.5 Library & Deck Management
- **Purpose**: Vocabulary cataloging, custom deck creation, and dictionary search.
- **Decks View**:
  - Deck cards with Curated vs. Custom badges.
  - Word count indicators and direct "Open deck" CTAs.
  - Deletion safety dialog for custom decks.
- **Bulk Word Import**:
  - CSV (or tab-separated) parser with header auto-detection and alias mapping. Canonical
    columns: `word, pos, definition, example, ipa, cefr, synonyms, antonyms, amharic,
    categories`, plus aliases (`part of speech`→pos, `meaning`→definition, `tags`→categories).
  - Real-time format validation and error warnings before ingestion.
- **Local Dictionary Search**:
  - Instant live filter as the user types with keyboard shortcut navigation.

### 5.6 AI Coach & Mentor
- **Purpose**: Local, private conversational English practice and naturalness correction via Ollama.
- **Two depths, one destination** (`SegmentedControl`, `coach.tsx:29-38`):
  - **Mentor** — the daily drill. A branch is one `focusTag` track at a chosen difficulty
    ceiling (Lv 1–5). Each answer is self-corrected, then scored on grammar, spelling,
    naturalness, register, pragmatics and task completion; feedback carries a granular
    wrong→right correction diff, a one-lesson explanation, a **Native Polish** block,
    a follow-up retrieval question and a root-cause note.
  - **Insights** (`coach-lab.tsx`) — skill map by grammar group, Learning paths, weekly
    coach report (strengths / weaknesses / next focus / action plan), Pronunciation Gym
    and the Naturalness Engine (score, verdict, native version, 2 alternatives).
- **10 focus tracks**: Past tense · Articles · Prepositions · Collocations · Word choice · Naturalness · Spelling · Pronunciation · Conditionals · Modals.
- **100% On-Device**: all prompts hit a local LLM (`OLLAMA_MODEL`, default `qwen3:8b`) with zero cloud data transmission.

### 5.7 Progress & Analytics
- **Purpose**: Clear visualization of compounding memory growth.
- **Metrics Dashboard** (Overview tab, one `analytics` + `dashboard` fetch):
  - 4 Key Stat Tiles: Current Streak (with best-ever), Accuracy %, Mastered Word Count
    (with % of total), Total XP (with reviews logged).
  - **This Week Bar Chart**: correct answers vs. misses per weekday over a rolling 7 days.
  - **Next 7 Days Forecast**: per-day buckets of cards coming due; overdue count toward today.
  - **Word Status Pie Chart**: Mastered / Reviewing / Learning / New with a text legend.
  - **How You Grade**: Again → Easy distribution across all reviews.
  - **Consistency**: 53-week, Sunday-aligned contribution calendar built from the sparse
    server payload.
  - **Per deck** table: total / mastered / active / accuracy.
  - **Recent activity** feed: last 8 reviews, expandable in 25-row steps up to 100.
- **Settings Panel** (second tab):
  - **Voice**: English-voice selector with a "Test this voice" audition, speech rate
    `0.5×`–`2.0×`, an auto-pronounce toggle and a TTS diagnostics panel.
  - **Reading**: study text size (Comfortable / Large / Largest) and a focus-mode toggle.
  - **Daily rhythm**: daily goal slider, 5 to 50 in steps of 5.
  - **Feel**: sound-effects and haptic toggles (haptics off by default).
  - **Appearance**: Light / Dark / System plus the 5-swatch accent palette.
  - **Danger zone**: typed-`RESET` reset of review history, XP, streaks and statistics
    — decks and words are kept. There is no database backup/export UI; copy
    `db/custom.db` on disk.

---

## 6. Accessibility & Keyboard Ergonomics

LexiLearn treats the keyboard as a first-class citizen alongside mobile touch:

| Context | Shortcut | Action |
|---|---|---|
| **Anywhere** | `⌘K` or `Ctrl+K` | Open Universal Search Palette |
| **Anywhere** | `?` or `Shift+/` | Open the keyboard-shortcuts cheat sheet |
| **Anywhere** | `[` or `⌘\` / `Ctrl+\` | Collapse / expand the sidebar |
| **Anywhere** | `m` | Mute / unmute sound effects |
| **Anywhere** | `g` then `t`/`r`/`l`/`d`/`v`/`b`/`p`/`c` | Go to Today / Review / Learn / Dictation / Deck / Library / Progress / Coach |
| **Study** | `f` | Toggle focus mode (Learn · Review · Progress) |
| **Today** | `Space` or `Enter`, `r` | Start the daily mission · resume the last session |
| **Learn** | `Space` or `Enter` | Advance Recall → Meaning → Spell → Result; `r` (or `p`) replays audio |
| **Learn (typing)** | `Alt+R` / `Ctrl+Space`, `Alt+H` / `Ctrl+H` | Replay audio · hint, then reveal-and-skip |
| **Review** | `Space` or `Enter` | Reveal the card; once revealed, a quick **Good** grade |
| **Review** | `1`, `2`, `3`, `4` | Grade: Again, Hard, Good, Easy |
| **Review** | `r`, `s`, `m`, `⌘Z` / `Ctrl+Z` | Replay audio · replay slow · star word · undo last grade |
| **Dictation** | `Alt+R`/`Ctrl+Space`, `Alt+S`/`Ctrl+Shift+Space`, `Alt+H`/`Ctrl+H` | Replay · replay slow · hint, while typing |
| **Dictation (between items)** | `Space`/`r`, `s`, `Enter` | Replay · replay slow · submit / next item |
| **Dictation (start)** | `1`–`4` | Adaptive · Foundation · Building · Fluent |
| **Mentor** | `h`, `r` | Hint for the current question · next challenge after feedback |
| **Mentor** | `⌘+Enter` or `Ctrl+Enter` | Submit your answer from the coach text box |
| **Library** | `/`, `↑`/`↓`, `Enter`, `Esc` | Focus search · move selection · open word · clear search |
| **Drill-in** | `Escape` | Leave focus mode → Deck detail → Dictation (focus mode wins) |
| **Modal / Dialog** | `Escape` | Close dialog or drawer |

- **Reduced Motion**: honoured in two places — `src/lib/motion.ts` (`useMotionSafe()` returns
  `t()` → `{ duration: 0 }` and `v()` → static opacity-only variants; `gradeEnter`/`gradeExit`
  take an explicit `reduce` flag and drop their directional exit) and a
  `@media (prefers-reduced-motion: reduce)` block in `src/app/globals.css` that zeroes
  animation/transition durations and disables smooth scrolling. Reduced motion *removes*
  movement rather than softening it.
- **Contrast Ratios**: the palette is built in OKLCH with hue-parameterised foreground /
  background pairs so relative luminance holds when the accent hue changes, and the focus
  ring is never removed. Contrast has **not** been machine-verified against WCAG AA/AAA — that is a known gap, not a guarantee.
- **Touch Ergonomics**: mobile bottom tabs are `min-h-14` (56px) and Today's quick links are
  full-width, so the primary touch targets clear 44px. The shared `Button` only guarantees
  that at `size="lg"` / `size="icon-lg"`; `default` (36px), `sm` (32px) and `icon` (36px)
  sizes and the shell's own `h-8`/`h-10` icon buttons sit below 44px and rely on spacing.

### 6.1 Hydration Integrity & Extension Protection
- **Dark Reader & Injected Attribute Immunity**: External browser dark-mode extensions (e.g. Dark Reader) modify inline SVG stroke and style attributes on initial page load, causing React hydration mismatches. The app implements a three-tier shield:
  1. `<meta name="darkreader-lock" />` in `src/app/layout.tsx` to instruct Dark Reader not to tamper with the native dark-mode OKLCH engine.
  2. `suppressHydrationWarning` on SVG elements and dynamic shell containers where client extensions inject attributes.
  3. Strict client-only initialisation for audio and sound toggle states via `useSoundState()` with `useSyncExternalStore` so SSR rendered HTML perfectly matches initial client renders without flickering.

---

## 7. Summary
LexiLearn balances **pedagogical rigor (SM-2, active recall, dictation)** with **delightful micro-interactions (sound, haptics, spring animations, celebratory feedback)** and a tactile **Neumorphic Soft UI**. The result is a calm, distraction-free environment engineered to turn fleeting vocabulary into lifelong memory.


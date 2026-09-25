# LexiLearn — Product & Interface Design Specification (`DESIGN.md`)

**Product Version:** 0.3.0  
**Design Philosophy:** "Quiet Focus" · Tactile Feedback · Local-First Ergonomics  
**Last Updated:** September 2026  

---

## 1. Product Design Vision & Identity

### 1.1 Core Value Proposition
LexiLearn is a **local-first, distraction-free English vocabulary mastery application** powered by the **SM-2 spaced-repetition algorithm**, browser-native text-to-speech, and private local AI mentoring. It is engineered for serious, self-directed learners who want long-term word retention without subscriptions, dark patterns, telemetry, or cloud bloat.

### 1.2 Target Personas & Contexts
1. **The Exam Aspirant (TOEFL / IELTS / GRE)**: Needs fast, repeatable daily loops with precision definitions, phonetics (IPA), CEFR leveling, and realistic example sentences.
2. **The Bilingual Learner (English / Amharic)**: Benefits from immediate Amharic translations alongside English definitions for instant cognitive bridging.
3. **The Privacy-Conscious Practitioner**: Demands total data sovereignty — every word, review log, streak, and audio synthesis happens entirely within the user's browser and SQLite on device.

### 1.3 Design Pillars ("Quiet Focus")
- **Calm, High-Information Density**: Avoid screaming banners or cartoon mascots. The UI is clean and intentional, inspired by world-class productivity tools (Linear, Notion, Apple HIG).
- **Tactile Multisensory Reinforcement**: Every correct recall or keystroke produces immediate visual, auditory, and haptic feedback.
- **Zero-Friction Daily Loops**: Opening the app immediately presents the highest-value action (due cards, new words, or quick quiz) in one click without decision paralysis.
- **Keyboard-First & Gesture-Friendly**: Full power on desktop keyboards (`Space`, `1-4`, `⌘K`) and fluid swipe-and-tap targets on mobile devices.

---

## 2. Information Architecture & Navigation

The navigation model is intentionally flat: **5 primary destinations** with context-driven drill-ins, never nested tab mazes.

```
                  ┌────────────────────────────────────────┐
                  │          LexiLearn App Shell           │
                  │  (Desktop Sidebar / Mobile Bottom Tab) │
                  └───────────────────┬────────────────────┘
                                      │
         ┌──────────────┬─────────────┼──────────────┬──────────────┐
         ▼              ▼             ▼              ▼              ▼
     [ Today ]      [ Learn ]    [ Review ]    [ Library ]    [ Progress ]
    Daily Quest   New Words Loop   SM-2 Spaced   • Decks       • Analytics
    & Streaks     (Recall→Spell)   Repetition    • Dictionary  • Heatmap
         │                                       • Word Form   • Settings
         ├───────────────────────────────────────────┐
         ▼                                           ▼
   [ Drill-ins: Quiz Hub ]                 [ Drill-in: Dictation ]
   • 6 Test Modes (Speed, Match, MC)       • Audio Dictation by Rung
         │
         ▼
   [ AI Coach & Mentor ] (Sidebar dedicated entry)
   • Grammar drills, scenarios, native rewrite comparisons
```


---

## 3. Design Tokens & Color Architecture

LexiLearn utilizes an **OKLCH hue-parameterized design system**. Changing a single CSS token (`--accent-hue`) seamlessly restyles the entire application while maintaining perceptual contrast.

### 3.1 Color Palette Tokens

| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--accent-hue` | `259` | `259` | Iris / Violet master hue |
| `--background` | `oklch(0.991 0.002 259)` | `oklch(0.168 0.008 259)` | App background canvas |
| `--foreground` | `oklch(0.22 0.02 259)` | `oklch(0.955 0.005 259)` | High-contrast readable typography |
| `--card` / `--surface` | `oklch(1 0 0)` | `oklch(0.21 0.01 259)` | Primary content cards |
| `--border` | `oklch(0.915 0.006 259)` | `oklch(0.3 0.012 259)` | Structural lines & card borders |
| `--primary` | `oklch(0.47 0.13 259)` | `oklch(0.72 0.125 259)` | Accent CTAs, active states, rings |
| `--primary-soft` | `color-mix(9% primary, card)` | `color-mix(16% primary, card)` | Badges, highlighted selections |
| `--success` | `oklch(0.47 0.12 155)` | `oklch(0.72 0.13 155)` | Correct answers, Good review grade |
| `--warning` | `oklch(0.5 0.12 70)` | `oklch(0.78 0.13 75)` | Hard review grade, offline indicator |
| `--destructive` | `oklch(0.52 0.19 25)` | `oklch(0.68 0.17 25)` | Again / Missed reviews, delete actions |
| `--streak` | `oklch(0.57 0.155 45)` | `oklch(0.74 0.15 50)` | Streak flames, XP milestones |

### 3.2 Vocabulary Level (CEFR) Indicators
Vocabulary cards use standard CEFR classification with distinct visual semantics:
- **A1 / A2 (Elementary)**: Emerald Green (`border-emerald-500/30 bg-emerald-500/10 text-emerald-600`)
- **B1 / B2 (Intermediate)**: Cobalt Blue (`border-blue-500/30 bg-blue-500/10 text-blue-600`)
- **C1 / C2 (Advanced & Mastery)**: Royal Purple (`border-purple-500/30 bg-purple-500/10 text-purple-600`)

### 3.3 Typography Hierarchy
- **Primary Sans**: Inter / Geist Sans (`--font-sans`) — crisp geometry with high x-height for readability.
- **Monospace**: Geist Mono / JetBrains Mono (`--font-mono`) — used for IPA phonetic transcription, keyboard shortcuts (`kbd`), and code tags.
- **Tabular Figures (`.num`)**: All numbers, countdowns, streaks, and scores use `font-variant-numeric: tabular-nums` to eliminate layout jitter during counters.
- **Micro-Labels (`.label`)**: `0.75rem (12px)`, `letter-spacing: 0.06em`, uppercase bold for category headers and eyebrows.

### 3.4 Elevation & Surface Tactility
- `.surface`: Card baseline with 1px border, subtle inset highlight, and 2-tier shadow.
- `.lift`: Interactive card state featuring a gentle 2px vertical lift on hover and a tactile spring-press (`active:scale-[0.985]`).

---

## 4. Multisensory & Feedback System

Learning is fortified when sensory feedback confirms action:
1. **Audio Feedback (`src/lib/feel.ts`)**:
   - Web Audio API synthesizer tones (sine/triangle waves):
     - `tap`: 520Hz soft click (50ms).
     - `correct`: 660Hz $\rightarrow$ 880Hz ascending chime (170ms).
     - `wrong`: 220Hz low sawtooth blip (140ms).
     - `levelup`: 523Hz $\rightarrow$ 659Hz $\rightarrow$ 784Hz major triad flourish.
     - `xp`: 980Hz spark chime.
2. **Haptic Vibration**:
   - Dual-mode browser vibration (`navigator.vibrate`): subtle tap for key inputs, crisp pattern for completions.
3. **Floating XP Particles (`xp-pop.tsx`)**:
   - Real-time `+15 XP` particle floats upward from the exact click coordinate or button upon grading.
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
    3. Queue empty $\rightarrow$ **"Play a quiz"**
  - Bottom strip: 3 interactive stat tiles (`Due`, `New`, `Streak`) acting as jump links.
- **Daily Quest & Challenge**:
  - Progress bar tracking daily rotating challenges (10-Word Sprint, Recall Run, Show Up).
  - Amber badge highlighting bonus XP reward with instant claim feedback.
- **Resume Strip**: One-click quick-return if a user left a session midway.
- **Quick Links Grid**: Clean 4-card action dock for Quick Quiz, Dictation, Dictionary, and Progress.

### 5.2 Learn Mode (`New Words`)
- **Purpose**: Systematic 3-stage onboarding of new vocabulary into the memory pipeline.
- **Interaction Workflow**:
  ```
  [ Stage 1: Recall ]   ──(Space / Tap)──>   [ Stage 2: Spell ]   ──(Enter)──>   [ Stage 3: Result ]
  Display word + IPA                         Listen to audio TTS                 Grade & Award XP
  Prompt mental meaning                      Type into slot grid                 Schedule into SM-2
  ```
- **Spelling Input Grid**:
  - Distinct segmented character blocks for each letter of the target word.
  - Active character slot highlighted with scaling and border glow.
  - Green pop for correct letters; shake animation on mistake.
- **Word Card Anatomy (`word-card-v2.tsx`)**:
  - Head: Large title, Part of Speech, IPA transcription, and speaker pronunciation button.
  - CEFR Level pill + expandable letter-count hint.
  - Progressive disclosure tabs: `Meaning`, `Example Sentence`, `Amharic (አማርኛ)`.
  - Collapsible details drawer: Syllable breakdown, Synonyms, Antonyms, and Etymology.


### 5.3 Review Mode (`SM-2 Spaced Repetition`)
- **Purpose**: Scientifically timed review sessions to beat the Ebbinghaus forgetting curve.
- **Interaction Workflow**:
  - Unrevealed card displays target word $\rightarrow$ Learner attempts mental recall $\rightarrow$ Press `Space` or tap "Reveal Answer".
  - Revealed state displays definitions, Amharic translations, and contextual example.
- **Tactile 4-Pill Grading Dock**:
  - `Again (1)`: Red tint · Interval reset (e.g. `1 day`) · "Forgot completely".
  - `Hard (2)`: Amber tint · Shorter interval extension · "Tough recall".
  - `Good (3)`: Emerald tint · Standard SM-2 interval expansion · "Clean recall".
  - `Easy (4)`: Violet tint · Accelerated interval boost · "Instant & clear".
  - Each button displays the exact calculated next review date (`1d`, `4d`, `12d`, `28d`) so learners make informed evaluations.

### 5.4 Quiz Hub & Game Modes
- **Purpose**: Low-stakes active retrieval testing and gamified retention reinforcement.
- **6 Supported Modes**:
  1. **Pick the Meaning (MC)**: Word $\rightarrow$ 4 definition options with keycap shortcuts `A`, `B`, `C`, `D`.
  2. **Find the Word (Reverse MC)**: Definition $\rightarrow$ 4 word candidates.
  3. **Match Them Up (Drag/Pair)**: 6 words matched to 6 definitions with connector lines and pair collapse animations.
  4. **Type It Out**: Active recall from definition alone.
  5. **Spelling Bee**: Audio-only prompt with keyboard entry.
  6. **Speed Round**: 60-second arcade countdown with combo multipliers (`2x`, `3x`, `5x`) and visual timer warnings.

### 5.5 Dictation ("Hear it. Type it.")
- **Purpose**: Auditory processing and accurate sentence transcription drills.
- **Rungs Progression**:
  - Rung 0: Single isolated vocabulary words.
  - Rung 1: Short conversational phrases (3–5 words).
  - Rung 2: Complex, full sentences (6–12 words).
- **Audio Control Bar**:
  - Primary Play / Repeat button (`Space`).
  - Speed toggle: Normal `1.0x` vs. Turtle Slow `0.7x` (`Shift+Space`).
  - Replay counter ("Free replays").
- **Visual Diff Inspection**:
  - Color-coded tokenized breakdown comparing user input against true transcript:
    - Green = Correct word match.
    - Strikethrough Red = Misheard or misspelled word.
    - Amber pill = Skipped word.


### 5.6 Library & Deck Management
- **Purpose**: Vocabulary cataloging, custom deck creation, and dictionary search.
- **Decks View**:
  - Deck cards with Curated vs. Custom badges.
  - Word count indicators and direct "Open deck" CTAs.
  - Deletion safety dialog for custom decks.
- **Bulk Word Import**:
  - CSV parser supporting Word, POS, IPA, Definition, Example, CEFR, Synonyms, and Amharic fields.
  - Real-time format validation and error warnings before ingestion.
- **Local Dictionary Search**:
  - Instant live filter as the user types with keyboard shortcut navigation.

### 5.7 AI Coach & Mentor
- **Purpose**: Local, private conversational English practice and naturalness correction via Ollama.
- **Features**:
  - **Branch System**: Focused tracks for *Past Tense*, *Articles*, *Prepositions*, *Collocations*, and *Naturalness*.
  - **Native Version Comparison**: Side-by-side diff between learner's draft and idiomatic phrasing.
  - **Granular Explanations**: Grammatical rule summaries explaining the nuance of corrections.
  - **100% On-Device**: All prompts run against local LLM models (e.g. `llama3` or `qwen2.5`) with zero cloud data transmission.

### 5.8 Progress & Analytics
- **Purpose**: Clear visualization of compounding memory growth.
- **Metrics Dashboard**:
  - 4 Key Stat Tiles: Current Streak, Accuracy %, Mastered Word Count, Total XP.
  - **This Week Bar Chart**: Stacked bar comparison of correct answers vs. misses per weekday.
  - **Next 7 Days Forecast**: Forward-looking bar graph showing upcoming cards due for review.
  - **Word Status Pie Chart**: Vocabulary breakdown (`Mastered`, `Reviewing`, `Learning`, `New`).
  - **GitHub-style Contribution Calendar**: 53-week heatmap recording daily consistency and longest streak records.
- **Settings Panel**:
  - TTS voice selector with instant voice sample audition.
  - Speech rate slider (`0.5x` to `2.0x`).
  - Daily review goal slider (5 to 50 words).
  - Sound effects and tactile haptics toggles.
  - SQLite database backup export and local state reset tools.

---

## 6. Accessibility & Keyboard Ergonomics

LexiLearn treats the keyboard as a first-class citizen alongside mobile touch:

| Context | Shortcut | Action |
|---|---|---|
| **Anywhere** | `⌘K` or `Ctrl+K` | Open Universal Search Palette |
| **Anywhere** | `1` – `5` (outside input) | Direct navigation to primary tabs |
| **Learn / Review** | `Space` or `Enter` | Reveal card answer / Play pronunciation |
| **Review** | `1`, `2`, `3`, `4` | Grade: Again, Hard, Good, Easy |
| **Quiz (MC)** | `A`, `B`, `C`, `D` or `1`–`4` | Select multiple-choice option |
| **Dictation** | `Space` / `Shift+Space` | Replay audio / Replay slow audio |
| **Mentor** | `⌘+Enter` or `Ctrl+Enter` | Submit response to AI Coach |
| **Modal / Dialog** | `Escape` | Close dialog or drawer |

- **Reduced Motion**: Full support for `prefers-reduced-motion` via `src/lib/motion.ts`, converting spring physics into gentle zero-offset opacities.
- **Contrast Ratios**: All text tokens in both Light and Dark themes strictly maintain WCAG AA/AAA compliance against their surrounding surfaces.
- **Touch Ergonomics**: All interactive elements maintain a minimum hit box of **44×44px** to ensure effortless mobile thumb operation.

---

## 7. Summary
LexiLearn balances **pedagogical rigor (SM-2, active recall, dictation)** with **delightful micro-interactions (sound, haptics, spring animations, celebratory feedback)**. The result is a calm, distraction-free environment engineered to turn fleeting vocabulary into lifelong memory.


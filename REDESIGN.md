# LexiLearn — UI/UX Redesign (v0.3, "Quiet focus")

A full design pass over every screen: new visual system, flattened navigation,
and a micro-interaction layer. No backend, schema or API-contract changes.

---

## 1. What was wrong

| Problem | Evidence |
|---|---|
| Geist was loaded but never applied | `layout.tsx` set `--font-geist-sans`, but the theme mapped `--font-sans: var(--font-sans)` (a circular self-reference), so the app fell back to the system stack |
| Primary colour failed contrast as text | gold `oklch(0.82 … 86)` on white ≈ 1.9:1, used as `text-primary` in **102** places |
| No elevation | every `--shadow-*` token had `opacity 0.01` — all shadows were invisible |
| 75 instances of 9–10px text | unreadable labels on any screen |
| Five competing weight styles | `font-black` on almost everything, so nothing read as important |
| Two stacked navigation layers | 5 bottom tabs **plus** a 5-item sub-tab strip inside Learn, colliding with the sticky header on mobile |
| Two products stitched together | duplicate legacy views (`dashboard`, `learn`, `review`, `stats`, `settings`) in an older visual language |
| No URL state | browser back/forward and deep links were impossible |
| Clickable `<div>`s | `Pressable` had no keyboard access at all |
| No 404 or error page | neither `not-found.tsx` nor `error.tsx` existed |
| Favicon 404 | `metadata.icons` pointed at a non-existent `/logo.svg` |
| Reduced motion ignored | `prefers-reduced-motion` was only honoured by confetti and two CSS classes; 0 files used `useReducedMotion` |

---

## 2. Design system

**One accent, hue-parameterised.** Change a single variable — `--accent-hue` — and the
whole app re-skins. Default is a deep indigo (259) at low chroma, with no gradients.

- **Light**: paper background, 6.6:1 primary on white, 4.9:1 body text (both AA).
- **Dark**: off-black `oklch(0.168 …)` surfaces (never `#000`), 7.1:1 primary.
- **State colours are semantic only**: `success` / `warning` / `destructive` / `streak`,
  each with a `-soft` surface variant so views stop hand-rolling `bg-primary/12`.
- **Elevation**: real tinted shadows in three steps, single light source (`-y`).
- **Shape**: one radius scale (`sm 8 / md 10 / lg 12 / xl 16`), replacing the
  `rounded-3xl` / `rounded-[2rem]` / `rounded-[1.75rem]` soup.
- **Type**: Geist wired up properly; one page header, 12px hard floor, three weights,
  `tabular-nums` on every number, `text-wrap: balance` on headings.
- **Surfaces**: a single `.surface` class (border + tinted shadow + 1px inner highlight)
  plus a 2%-opacity grain so flat panels do not feel sterile.

## 3. Navigation (5 flat destinations, zero nested tab bars)

| Tab | Job |
|---|---|
| **Today** | One primary action, three stat tiles, resume, momentum (level + challenge in one card) |
| **Learn** | New words: recall → listen → spell → check |
| **Review** | Due cards with grade buttons that show the resulting interval |
| **Library** | Decks + deck detail + dictionary (one segmented control) |
| **Progress** | Overview + Settings (one segmented control) |

AI Coach is a first-class screen reached from Today, Review and Settings.
Quiz is a **reinforcement action**, not a tab: it is offered on Today and after every
Learn/Review session, and it now has six modes — including **drag-to-match**, built on
`@dnd-kit` (already a dependency, previously unused).

**URL state**: `src/lib/router.ts` syncs the store to `#/today`, `#/review`,
`#/library/<deckId>`, `#/progress/settings` and so on, so browser back/forward and
deep links work without giving up the single-page, local-first architecture.

## 4. Micro-interactions ("the feel")

Every tap responds within 100ms — press feedback is CSS/framer only and never waits on
the network; grading, claiming and settings are optimistic.

- **Press**: 0.97 scale + ripple + haptic on every tappable surface.
- **Cards leave with weight**: Again snaps away, Easy flies out (`gradeExit`).
- **XP pops at the point of interaction**, not in a fixed corner.
- **Counters** animate (`useCountUp`) for streak, XP, accuracy and the progress ring.
- **Correct**: checkmark draws itself, success chime, success haptic.
  **Wrong**: a short shake and a reassurance, never a penalty.
- **Loading** always shows a skeleton that mirrors the final layout (no blank screens).
- **Inline validation** with the original tone: “Try again — check the spelling.”
- **Empty states guide** to the single next action; `NextStep` guarantees no dead ends.
- **Sound is now opt-in** (it was on by default); haptics default on for touch devices.
  Both toggles live in Progress → Settings → Feel.
- **Reduced motion**: `useMotionSafe` gates every framer variant, confetti already
  opted out, and CSS animations collapse under the OS setting.

## 5. Accessibility & UX fixes

Skip-to-content link, `<main id="main">` landmark, single `<h1>` per view, `aria-current`
on navigation, `aria-live` on async results, label + `autocomplete` on inputs,
icon-only buttons labelled, real focus outline app-wide (ring shadows neutralised so
there is exactly one focus indicator), typed-confirm (`RESET`) before destructive reset,
44px primary tap targets, `env(safe-area-inset-bottom)` on the mobile tab bar,
`overscroll-behavior: contain` in dialogs, `content-visibility` on long word lists,
`color-scheme` + `theme-color`, working favicon, and new 404/error screens that
reassure the user that nothing left the device.

## 6. Removed

`views/{dashboard,learn-v2,review-v2,stats,settings,profile,decks,search,learn-hub}.tsx`,
`components/sidebar.tsx`, `onboarding-overlay.tsx`, `quick-start-card.tsx`,
`reward-celebration.tsx`, `word/word-card.tsx`, `offline-badge.tsx` — all superseded
by the single canonical set of views.

## 7. Verified

- `tsc --noEmit` — clean
- `next build` — clean (5 routes, `/_not-found` generated)
- Dev server: `GET /` → 200, `/api/lexilearn?action=dashboard|decks` → 200 with real data
- Compiled CSS contains the new tokens, `.surface`, ripple and tabular figures
- No dangling imports after the legacy deletions

Not fixed (pre-existing, unrelated to this pass): `eslint` reports
`react-hooks/set-state-in-effect` warnings-as-errors from React 19's new lint rule across
both old and new files (e.g. `hooks/use-mobile.ts`, `ui/carousel.tsx`). The build is
unaffected; converting those to `useSyncExternalStore` is a good follow-up.

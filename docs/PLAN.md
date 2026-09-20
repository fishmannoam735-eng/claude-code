# Puzzle Break — build plan

A daily set of logic puzzles. One of each per day, a streak to keep, a result
you can share as emoji squares. Four are quick — a couple of minutes each. The
fifth, a full 9×9 sudoku, is the one you sit down for.

Working name: **Puzzle Break**. See [GAME-RESEARCH.md](./GAME-RESEARCH.md) for
what LinkedIn actually ships and where the rules came from.

---

## 1. Product shape

**v1 is the five logic games** — Nine, Crowns, Eclipse, Thread, Quilt. The two
word games (Common, Rungs) are deliberately out; see §9.

- **Five games**, one fresh puzzle each per day, rolling over at local
  midnight (not Pacific — no reason to inherit their timezone).
- **No sign-up friction, but real accounts.** Supabase anonymous auth issues
  every visitor a user row on first load, so play is instant and progress is
  server-side from move one. Linking an email later upgrades the same row and
  turns on cross-device streaks — nothing is lost, nothing is migrated.
- **Three difficulties** per game per day. Normal is the canonical daily; easy
  and hard are separate puzzles from the same date.
- **Unlimited practice**: random seed instead of a date seed, any difficulty.
- **Challenge a friend**: share a link to an exact seed, compare times on an
  identical board.
- **Share card**: spoiler-free emoji grid + time + streak.
- **Archive** (any past day playable) is nearly free given §3, but it is not a
  v1 commitment — it's a switch we can flip later, including as a paid tier.
- **Mobile-first.** These are thumb games. Drag interactions (Thread, Quilt) must
  feel right on a touchscreen or the whole thing is dead on arrival.

### Naming

"Queens", "Tango", "Zip", "Pinpoint", "Crossclimb", and "Patches" are LinkedIn's
product names. The *mechanics* are public domain — Shikaku, Takuzu, Hamiltonian
paths and N-queens long predate LinkedIn — but the names and the exact visual
identity are theirs. We use our own names and our own look:

| Mechanic | Ours | Theirs | v1 |
|---|---|---|---|
| Region N-queens | **Crowns** | Queens | ✅ |
| Binary grid + edge hints | **Eclipse** | Tango | ✅ |
| Ordered Hamiltonian path | **Thread** | Zip | ✅ |
| 9×9 sudoku | **Nine** | Mini Sudoku (6×6) | ✅ |
| Rectangle tiling | **Quilt** | Patches | ✅ |
| Category from clues | **Common** | Pinpoint | — |
| Trivia word ladder | **Rungs** | Crossclimb | — |

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| App | React 19 + TypeScript + Vite | Fast, boring, good touch story |
| Styling | Tailwind | Consistent tokens across five boards |
| State | Zustand (UI) + pure engine modules | Engines stay framework-free and testable |
| Tests | Vitest | Generators need property tests, not click tests |
| Hosting | Static — Netlify or Cloudflare Pages | The app itself stays a static bundle |
| Backend | **Supabase** — Postgres + anonymous auth + RLS + Edge Functions | Accounts, streaks, leaderboards, challenges from day one |

Monorepo, pnpm workspaces:

```
packages/
  engine/          # pure TS: types, seeded RNG, per-game generator + solver
  ui/              # shared board primitives, timer, share card
  data/            # Supabase client, generated DB types, queries/mutations
apps/
  web/             # the React app, routes per game
supabase/
  migrations/      # schema as SQL, source of truth
  functions/       # Edge Functions (Deno) — imports packages/engine unchanged
tools/
  gen/             # CLI: batch-generate + verify, difficulty histograms
```

`packages/engine` is pure TypeScript with no DOM and no Node APIs. That is a
deliberate constraint, and §5 explains what it buys: the identical solver runs
in the browser and inside a Supabase Edge Function.

---

## 3. The core architectural bet: deterministic daily generation

Every logic puzzle is a pure function of a seed:

```ts
type Difficulty = 'easy' | 'normal' | 'hard';
type Seed = string;   // `${gameId}:${isoDate}:${difficulty}` — or a random
                      // string for practice, or a shared string for a challenge

interface Generator<P, S> {
  generate(seed: Seed): P;              // deterministic, difficulty encoded in seed
  solve(puzzle: P): S[];                // all solutions, enumeration capped at 2
  validate(puzzle: P, attempt: S): Result;
  rate(puzzle: P): DifficultyScore;     // see §7 — drives the accept/reject loop
}
```

Difficulty lives **inside** the seed rather than beside it, so a seed is a
complete, portable description of a board. One string in a URL reproduces a
puzzle exactly — which is precisely what "challenge a friend" needs, and it
means practice, daily, and challenge modes are one code path with three seed
sources.

Same seed → same puzzle, on every device, forever. That buys us:

- **No puzzle content in the database.** Postgres stores *results*, never
  boards. A row is a seed plus a time.
- **Challenge links cost nothing** — the link *is* the puzzle.
- **Infinite practice** — random seed instead of a date seed.
- **The archive whenever we want it** — any past date generates on demand.
- Reproducible bug reports: a seed *is* the repro.

The cost, and it is the real engineering work of this project: a generator is
only acceptable if it can prove its puzzle has **exactly one solution**. So each
game needs a solver good enough to enumerate solutions and stop at two, and the
generate loop is *generate → solve → keep only if unique → otherwise reseed*.

Generation must stay under ~100ms so it can run in the browser on load. If a
game can't hit that (Thread is the risk), we pre-generate a year of puzzles into
a static JSON file at build time and ship it. Same determinism, different
timing — decided per game, not up front.

---

## 4. Data model

Postgres stores results, identities, and social graph — never puzzles.

```sql
profiles      (id → auth.users, handle, is_anonymous, created_at)

plays         (id, user_id, game_id, seed, difficulty, puzzle_date | null,
               mode: 'daily' | 'practice' | 'challenge',
               started_at, completed_at, duration_ms, mistakes,
               status: 'in_progress' | 'solved' | 'abandoned',
               move_log jsonb, validated bool default false)
              unique (user_id, seed)

streaks       (user_id, game_id, current, longest, last_solved_date)
              -- maintained by trigger on plays, not computed client-side

challenges    (id, seed, game_id, difficulty, creator_id, created_at)
challenge_entries (challenge_id, user_id, play_id, duration_ms)
```

Decisions worth naming now:

- **`puzzle_date` is the player's local date**, captured when the puzzle is
  *started* and then frozen. A player who crosses midnight mid-solve keeps the
  day they began. Without this rule, streaks break for travellers and night
  owls — and those are the engaged users.
- **Streaks count the day, not the difficulty.** Solving any one of easy /
  normal / hard extends the streak for that game. Leaderboards are per
  difficulty; streaks are not, or hard mode becomes a punishment.
- **RLS on every table.** A player reads and writes only their own `plays`.
  Leaderboard reads go through a view exposing handle + duration, nothing else.
- **`move_log` is why anti-cheat is possible at all** (§5). It costs a little
  storage and is worth it.
- Anonymous users are real rows, so **nothing is migrated on sign-up** — the
  account links to the row that already exists.

## 5. Trust: server-side validation

The client reports its own time. That is unfalsifiable nonsense the moment a
leaderboard exists, and "challenge a friend" *is* a leaderboard of two.

Because `packages/engine` is pure TypeScript with no DOM dependency, the same
generator and solver run unchanged inside a Supabase Edge Function on Deno. So:

1. Client submits `{ seed, solution, move_log, duration_ms }`.
2. An Edge Function regenerates the puzzle **from the seed**, checks the
   solution against it, and sanity-checks the move log against the claimed
   duration (move count vs. elapsed time, no impossible instant-fills).
3. Only then does it set `validated = true` and write the leaderboard entry.

Unvalidated plays still count for personal stats and streaks — we're not
policing someone's private practice. They just don't rank. This is a modest
amount of code precisely *because* we refused to let the engine touch the DOM,
which is the main reason that constraint exists in §2.

## 6. Per-game engineering notes

Ordered by what I'd build first.

### Nine (9×9 sudoku) — 4 days
Full classic sudoku, not the 6×6 mini.

**Generation is the easy half.** Fill a valid grid by backtracking over shuffled
digits, then dig cells out in symmetric pairs while a constraint-propagation
solver still reports exactly one solution. Verify uniqueness with propagation
first and fall back to DLX/exact-cover for the cases propagation can't close.
This runs in single-digit milliseconds — comfortably inside the §3 budget even
with the accept/reject loop of §7.

**9×9 makes difficulty rating better, not worse.** A 6×6 grid only supports a
couple of solving techniques, so "easy/normal/hard" would have been three
shades of the same thing. Classic sudoku has a genuine technique ladder —
naked and hidden singles, locked candidates, pointing pairs, box-line
reduction, naked and hidden subsets, X-wing, XY-wing, colouring, forcing
chains. Rate a puzzle by the hardest technique its solve requires and how often
that technique is needed, and the three tiers become meaningfully different
puzzles rather than three digit-counts. This is the single strongest argument
for 9×9 and it makes §7 credible in a way the mini never would have been.

**The UI is the expensive half**, and this is what the change really costs:

- **Pencil marks are now mandatory.** A 6×6 fits in working memory; a hard 9×9
  does not, and nobody solves one without candidate notes. That means a notes
  mode, up to nine candidate digits rendered legibly inside a ~40px cell, an
  optional auto-notes fill, and an undo stack that treats a note edit as a
  first-class move.
- **Input needs a number pad.** 81 cells plus a persistent digit pad has to fit
  a phone screen without scrolling. Support both input orders — pick a cell then
  a digit, and pick a digit then paint cells — because players are strongly
  split on which feels right, and the second is much faster for notes.
- **Highlighting carries the deduction.** Peer highlighting (row, column, box),
  same-digit highlighting across the grid, and live conflict flagging are not
  polish here; they're how a player reads a 9×9 board at all.

**Solve time goes from ~2 minutes to 5–20.** Nine stops being a warm-up and
becomes the anchor game — the one people sit down for, while the other four
stay genuinely quick. Two follow-ons: the lineup is no longer "all five in one
coffee break" (§1 framing adjusted), and **resume has to be flawless** — the
`in_progress` play row in §4 must round-trip notes, undo history, and elapsed
time, because a 20-minute puzzle *will* be interrupted.

**Still the right vertical slice**, despite growing from one day to four. The
undo stack, input handling, cell highlighting, and resume plumbing it forces us
to build are shared infrastructure every other game needs. Better to meet that
work in the game whose *logic* is fully solved than to meet it in Thread.

### Eclipse (Takuzu + edge hints) — 2 days
Generate a full valid 6×6, then remove givens and add `=`/`×` edge constraints
while uniqueness holds. Solver is straightforward propagation: row/column
balance, no-three-in-a-row, edge rules. Low risk.

### Crowns (region N-queens) — 3 days
Two-stage: place a valid queen arrangement first, then grow colored regions
around the queens (flood-fill from each queen, one region per queen, regions
must tile the board). Uniqueness check is a small exact-cover search. The
interesting knob is difficulty — measured by how deep the forced-move chain
runs before a guess is needed.

### Quilt (rectangle tiling) — 3 days
Partition the grid into rectangles by recursive splitting, drop one clue into
each, then weaken clues (number → shape icon → `any`) as long as the tiling
stays unique. Solver is exact cover over candidate rectangles — the same
machinery as Crowns, which is why they're adjacent in the schedule.
Drag-to-draw on touch is the UI risk here, not the math.

### Thread (ordered Hamiltonian path) — 5 days, highest risk
Generate the *path* first (random Hamiltonian path via backtracking on the
grid), then place numbered waypoints along it and add walls, removing waypoints
while a path-solver still finds exactly one route. Uniqueness proof means
enumerating Hamiltonian paths, which is expensive — this is the game most likely
to need build-time pre-generation. Budget a spike before committing to runtime
generation.


---

## 7. Difficulty as a first-class parameter

Three tiers per game per day means three puzzles, and it makes difficulty a
thing we have to *measure*, not hope for. Random generation produces random
difficulty; without a metric, "hard" is a coin flip and a brutal Tuesday churns
users.

Every generator implements `rate(puzzle) → DifficultyScore`, derived from how
the solver actually solved it:

- Which deduction techniques were required (naked singles vs. region parity vs.
  contradiction chains).
- How deep the forced-move chain runs before the first guess.
- How many cells are decidable at the opening — the "cold start" width.

The daily loop is then: generate from seed → solve → reject unless unique →
`rate` → reject unless inside the target band for that tier → else reseed and
repeat. Bands get calibrated once per game by running `tools/gen` over ten
thousand seeds and reading the histogram.

Two consequences:

- Generation is now a *loop*, so per-attempt cost matters much more. This is
  what tightens the latency budget in §3 and makes Thread's spike load-bearing.
- Bands are configuration, not code. We will tune them after launch from real
  solve times, and that should be a config change and a redeploy, nothing more.

---

## 8. Milestones

**M0 — Foundations (½ week).** Monorepo, Supabase project, schema migration,
anonymous auth, RLS policies, generated DB types, CI running Vitest.

**M1 — Vertical slice (weeks 1–2).** Engine interface, seeded RNG, Nine end to
end: generate → play → validate → solved → persisted to `plays` → streak trigger
→ share card. Deployed. Nine is four days rather than one (§6), but it forces
the undo stack, notes, number-pad input, cell highlighting and resume — all of
which the other four games inherit.

**M2 — The logic three (weeks 3–4).** Eclipse, Crowns, Quilt on the shared
scaffolding. Home screen with today's five tiles and per-game state. Difficulty
tiers and calibrated bands (§7). Practice mode — nearly free once the seed
source is abstracted.

**M3 — Thread (week 5).** After the generation spike. Falls back to
build-time pre-generated seeds if runtime generation can't hit the budget.

**M4 — Social (week 6).** Challenge links, Edge Function validation (§5),
leaderboards, email linking for cross-device streaks.

**M5 — Polish (week 7).** Per-game onboarding, undo, hints, keyboard support,
dark mode, reduced-motion, a11y pass — every grid must be fully operable
without drag. Stats page.

---

## 9. Deferred: the word games

**Common** (category from clues) and **Rungs** (trivia word ladder) are out of
v1 — not because the engines are hard, but because they are a different kind of
product. Every other game in the lineup is a function we write once; these two
are a deadline we meet every day forever.

- **Common** — engine is about two days. Content is the cost: a category, five
  members ordered obscure→obvious, and a generous accepted-answer list, per day.
  An LLM-assisted drafting tool in `tools/gen` plus human QA on every one; never
  auto-publish.
- **Rungs** — engine about three days. Content is genuinely hard: a 7-rung
  ladder, a trivia clue per rung, and a *thematically related* top/bottom pair.
  Ladder-finding is automatable (BFS over a 4-letter word list) and should be a
  tool. Clue writing is not automatable to a shippable standard.

If we take these on: build a 90-day buffer before launch, and treat Common as
the trial run — its content cost is an order of magnitude below Rungs.

---

## 10. Things that will bite us

- **Uniqueness is the whole product.** A daily puzzle with two solutions is a
  trust-destroying bug, and it reaches everyone at once. Every generator gets a
  property test that runs thousands of seeds through the solver in CI.
- **Generation latency.** The accept/reject loop in §7 multiplies per-attempt
  cost by the rejection rate. Measure attempts-per-accepted-puzzle per game;
  anything with a bad ratio moves to build-time pre-generation.
- **Touch drag.** Thread and Quilt live or die on drag feel — pointer events,
  no scroll hijack, forgiving hit targets.
- **81 cells on a phone.** Nine's grid plus a number pad has to fit a small
  screen with ~40px cells that still render nine legible pencil marks. This is
  the hardest layout problem in the app and it should be prototyped on a real
  device in week one, not designed on a desktop and discovered later.
- **A 20-minute puzzle will be interrupted.** Resume for Nine must restore
  notes, undo history and elapsed time exactly, or players lose real work and
  don't come back.
- **Clock and timezone.** Frozen-at-start `puzzle_date` (§4) is the rule.
  Anything else breaks streaks for travellers and night owls.
- **RLS mistakes are silent.** A missing policy doesn't error, it just returns
  rows it shouldn't or none at all. Policies need their own tests.
- **Anonymous-account sprawl.** Every visitor creates a row. Needs a cleanup
  job for anonymous profiles with zero solves older than N days.
- **Leaderboards invite cheating** the day they ship. §5 is not optional
  polish — it lands with the feature, not after it.

---

## 11. Open questions

1. When does the archive open, and is it free or the thing we charge for?
2. Leaderboard shape — global, friends-only, or daily-reset top N?
3. Do challenge links expire, and can a challenger see the target's time before
   they've solved it themselves? (I'd say no — it anchors and spoils the race.)
4. Handles: required at first solve, or only when a player enters a leaderboard?
5. Hints — do they exist, and do they void a leaderboard entry?

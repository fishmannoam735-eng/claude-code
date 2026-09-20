# Puzzle Break — build plan

A daily set of small logic puzzles. One of each per day, each solvable in a few
minutes, a streak to keep, a result you can share as emoji squares.

Working name: **Puzzle Break**. See [GAME-RESEARCH.md](./GAME-RESEARCH.md) for
what LinkedIn actually ships and where the rules came from.

---

## 1. Product shape

- **Seven games**, one fresh puzzle each per day, rolling over at local
  midnight (not Pacific — no reason to inherit their timezone).
- **No account required.** Progress, streaks, and stats live in `localStorage`.
  Accounts are a later feature, only if we want cross-device streaks.
- **Archive**: any past day is playable. This is free for us (see §3) and it is
  the single biggest retention feature the originals lack.
- **Share card**: spoiler-free emoji grid + time + streak.
- **Mobile-first.** These are thumb games. Drag interactions (Zip, Patches) must
  feel right on a touchscreen or the whole thing is dead on arrival.

### Naming

"Queens", "Tango", "Zip", "Pinpoint", "Crossclimb", and "Patches" are LinkedIn's
product names. The *mechanics* are public domain — Shikaku, Takuzu, Hamiltonian
paths and N-queens long predate LinkedIn — but the names and the exact visual
identity are theirs. We use our own names and our own look:

| Mechanic | Ours | Theirs |
|---|---|---|
| Region N-queens | **Crowns** | Queens |
| Binary grid + edge hints | **Eclipse** | Tango |
| Ordered Hamiltonian path | **Thread** | Zip |
| 6×6 sudoku | **Six** | Mini Sudoku |
| Rectangle tiling | **Quilt** | Patches |
| Category from clues | **Common** | Pinpoint |
| Trivia word ladder | **Rungs** | Crossclimb |

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| App | React 19 + TypeScript + Vite | Fast, boring, good touch story |
| Styling | Tailwind | Consistent tokens across seven boards |
| State | Zustand (UI) + pure engine modules | Engines stay framework-free and testable |
| Tests | Vitest | Generators need property tests, not click tests |
| Hosting | Static — Netlify or Cloudflare Pages | Phase 1 has no server at all |
| Backend | **None initially.** Supabase later if we add accounts/leaderboards | |

Monorepo, pnpm workspaces:

```
packages/
  engine/          # pure TS: types, seeded RNG, per-game generator + solver
  ui/              # shared board primitives, timer, share card, streak store
apps/
  web/             # the React app, routes per game
tools/
  gen/             # CLI: batch-generate + verify puzzles, difficulty histograms
content/
  rungs/           # authored word-ladder puzzles (JSON)
  common/          # authored category puzzles (JSON)
```

---

## 3. The core architectural bet: deterministic daily generation

Every logic puzzle is a pure function of a seed:

```ts
type Seed = string;                        // `${gameId}:${isoDate}`
interface Generator<P, S> {
  generate(seed: Seed, difficulty: Difficulty): P;   // deterministic
  solve(puzzle: P): S[];                             // all solutions, capped at 2
  validate(puzzle: P, attempt: S): Result;
}
```

Same seed → same puzzle, on every device, forever. That buys us:

- **No puzzle server, no content DB, no daily cron** for five of the seven games.
- The **archive is free** — any date generates on demand.
- An **infinite practice mode** — seed with a random string instead of a date.
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

## 4. Per-game engineering notes

Ordered by what I'd build first.

### Six (6×6 sudoku) — 1 day
Trivially generatable: fill a valid grid by backtracking, dig cells out while a
constraint-propagation solver still reports a unique solution. Difficulty = which
solving techniques are required. **Build this first as the vertical slice** — it
proves the engine interface, the board UI, the timer, the streak store, and the
share card against the easiest possible puzzle.

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

### Common (category from clues) — 2 days engine, ongoing content
Engine is a day: reveal clues one at a time, fuzzy-match the guess against
accepted answers, score inversely to clues used. The work is **content**: each
puzzle needs a category, five members ordered obscure→obvious, and a generous
list of accepted phrasings. Plan: an LLM-assisted authoring tool in `tools/gen`
that drafts candidates, plus human QA on every one. Never auto-publish.

### Rungs (word ladder) — 3 days engine, hardest content
Engine: three phases, drag-to-reorder, validation that each neighbour pair
differs by one letter. Content is the bottleneck — we need a 7-rung ladder, a
trivia clue per rung, and a *related* top/bottom pair. Ladders themselves can be
found by BFS over a 4-letter word list (that part is automatable and should be a
tool). Clue writing is not automatable to a shippable standard. **This is the
one I'd cut from v1** unless we're committed to a daily content operation.

---

## 5. Milestones

**M1 — Vertical slice (week 1).** Monorepo, engine interface, seeded RNG, Six
end to end: generate → play → validate → win → streak → share. Deployed.

**M2 — The logic four (weeks 2–3).** Eclipse, Crowns, Quilt on the shared
scaffolding. Home screen with today's seven tiles and per-game completion state.
Archive route.

**M3 — Thread (week 4).** After a generation spike. Falls back to pre-generated
puzzles if runtime generation can't hit the latency budget.

**M4 — Polish (week 5).** Onboarding per game, undo, hints, keyboard support,
dark mode, reduced-motion, a11y pass on the grids (they must be operable without
drag). Stats page.

**M5 — Word games (week 6+, optional).** Common first, since its content cost is
an order of magnitude lower than Rungs. Ship Rungs only with a content pipeline
behind it.

---

## 6. Things that will bite us

- **Uniqueness is the whole product.** A daily puzzle with two solutions is a
  trust-destroying bug, and it reaches everyone at once. Every generator gets a
  property test that runs thousands of seeds through the solver in CI.
- **Difficulty drift.** Random generation gives random difficulty; a brutal
  Tuesday churns users. Each generator needs a difficulty *metric*, and the
  daily seed loop must reject puzzles outside the target band for that weekday.
- **Touch drag.** Thread and Quilt live or die on the drag feel — pointer
  events, no scroll hijack, forgiving hit targets.
- **Clock and timezone.** "Today" must be stable for a user who crosses
  midnight or a timezone mid-solve. Decide once, store the date with the
  in-progress state.
- **Content cadence.** If we ship Common and Rungs, we own a daily deadline
  forever. Build a 90-day buffer before launch or don't launch them.

---

## 7. Open questions

1. Scope for v1 — the five logic games, or all seven?
2. Local-only, or accounts from the start (cross-device streaks, leaderboards)?
3. Is the archive open to everyone, or is it the thing we'd eventually charge for?
4. Do we want multiplayer/social at all (challenge a friend, compare times)?

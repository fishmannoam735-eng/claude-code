# Commit history

This repository was developed in a Claude Code session whose git push was
blocked by an egress policy, so it was published through the GitHub API
instead. That path can only create commits from file contents, not replay
existing ones, so the seven original commits are recorded here and their
full history lives in the session's `puzzle-break.tar.gz` archive.

---

## Add research and build plan for daily puzzle mini-game app

Documents the seven LinkedIn daily puzzles (rules, boards, interactions)
and proposes a build plan for an original equivalent.

Key decisions captured:
- Five of the seven games are generatable from a seed; two require daily
  authored content. Ship the generatable core first.
- Deterministic seed-based generation (seed = gameId:date) removes the
  need for a puzzle server, makes the archive free, and gives a practice
  mode for nothing.
- Every generator must prove single-solution uniqueness via its own
  solver; this is the main engineering cost.
- Original names and visual identity, since the mechanics are public
  domain but the branding is not.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0116fZnHojRnvPkReDQA1kNT

---

## Scope plan to five logic games with Supabase backend

Folds in scoping decisions:
- v1 is the five generatable logic games; the two content-driven word
  games move to a deferred section with their content cost spelled out.
- Supabase from day one: anonymous auth so play stays friction-free,
  Postgres for results only (never puzzles), RLS, streak triggers.
- Difficulty becomes part of the seed rather than a sibling parameter,
  so one seed string fully describes a board. Daily, practice and
  challenge modes collapse into one code path with three seed sources.
- Adds a difficulty-rating contract and the accept/reject generation
  loop, which tightens the latency budget.
- Adds server-side solution validation via Edge Functions, which works
  because the engine is DOM-free and runs unchanged on Deno.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0116fZnHojRnvPkReDQA1kNT

---

## Switch sudoku to 9x9 and add art direction

Nine is now full 9x9 classic sudoku rather than the 6x6 mini.
Generation is unchanged in difficulty, but the change is not free:

- Difficulty rating gets substantially better. A 6x6 supports only a
  couple of solving techniques; classic sudoku has a real technique
  ladder, so the three difficulty tiers become meaningfully different
  puzzles instead of three digit-counts.
- Pencil marks become mandatory, which brings a notes mode, a 3x3
  candidate layout, and an undo stack that treats a note as a move.
- Input needs a number pad supporting both cell-first and digit-first
  order, plus peer, same-digit and conflict highlighting.
- Solve time goes from ~2 minutes to 5-20, so Nine becomes the anchor
  game and resume has to round-trip notes, undo and elapsed time.

Estimate moves from 1 day to 4; milestones shift by a week. Nine stays
the vertical slice because the input and undo work is shared.

Adds ART-DIRECTION.md. The governing rule: boards are drawn in code
(SVG/CSS from puzzle state) because they must be crisp at any size,
themeable, animatable and accessible. Generated raster art is for
tiles, celebration and marketing, never for a surface the player
touches. Includes the token set with contrast corrections, a
colour-blind-safe region palette for Crowns and Quilt, and motion
budgets.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0116fZnHojRnvPkReDQA1kNT

---

## Implement M0 foundations and M1 vertical slice (Nine)

M0 — foundations
- pnpm monorepo: packages/engine (pure TS, no DOM), packages/data,
  apps/web (React 19 + Vite + Tailwind 4), supabase/, CI on typecheck +
  test + build.
- Supabase schema applied: profiles, plays, streaks, challenges,
  challenge_entries. RLS on every table. Profile rows are created by
  trigger for every auth user, anonymous included, so linking an email
  later upgrades the row in place and nothing migrates.
- Streaks are maintained by a trigger, never computed client-side. Solving
  any difficulty extends the day; an archive day never changes `current`;
  practice is ignored. Verified against a rolled-back transaction covering
  consecutive days, same-day repeats, gaps and archive solves.
- `plays.validated` is forced false for non-service writes, so a client
  cannot mark its own solve as server-verified.

M1 — Nine, end to end
- Engine: seeded PRNG (cyrb128 + sfc32), bitmask solver with MRV branching
  that enumerates to a cap of 2 to prove uniqueness, and a human-technique
  rater (naked/hidden singles, locked candidates, naked pairs) whose
  hardest-required technique defines the difficulty band. Generation is
  generate → solve → unique → rate → in band → else reseed.
  Measured: easy avg 0.5ms, normal 18ms, hard 8ms per puzzle.
- Web: 81-cell board at 40px with nine legible pencil marks, number pad
  with remaining counts, both cell-first and digit-first input, peer /
  same-digit / conflict highlighting, undo that covers notes and the peer
  candidates a placement strips, timer with pause on tab-hide, and resume
  that round-trips grid, notes, undo history and elapsed time.
- Persistence: localStorage immediately, Supabase on a debounce and on
  solve and pagehide. If anonymous sign-in fails the app runs local-only
  and says so — play is never blocked on the backend.

Verified: 28 tests pass; typecheck and build clean; a Playwright pass over
the production build confirms placement, notes, undo, keyboard nav, timer,
resume across reload, pause, practice mode, dark mode and no horizontal
scroll at desktop width, with no console errors.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0116fZnHojRnvPkReDQA1kNT

---

## Add Eclipse (M2) and calibrate difficulty bands from measurement

Second game end to end, and the first real test of whether the engine
interface generalises past sudoku. It did: Eclipse implements the same
Generator<P,S> unchanged, with the same generate -> solve -> unique ->
rate -> in band -> else reseed loop.

Engine
- 6x6 Takuzu with =/x edge badges: line model, MRV solver enumerating to
  a cap of 2 for uniqueness, and a technique rater (edge rule, no-three,
  line count, line lookahead).
- `carve` strips givens then prunes edges, with a givens floor. The floor
  is what makes an easy puzzle possible at all: carving as far as
  uniqueness allows always lands on a board needing the harder techniques,
  because the easy deductions are exactly the redundancy being removed.

Calibration (tools/gen histogram)
- New CLI reporting, per game and difficulty, the distribution of hardest
  technique, givens, generation time, and failures.
- It caught an easy band that failed on 100% of Eclipse seeds. On a 6x6
  board the ladder is too short to separate three tiers by itself: line
  count and no-three fire in nearly every puzzle, so almost everything
  rates level 3, and the level 1-2 band was asking for roughly 2 seeds in
  60. Eclipse now separates primarily on how much scaffolding is left
  standing, with technique level as a secondary filter. Nine is the
  opposite: its ladder is long enough to do the separating alone.
- Measured over 100 seeds per tier, zero failures: Nine easy/normal/hard
  medians 0.6/11.8/5.8ms, Eclipse 0.7/1.7/8.6ms, all well inside budget.

Web
- Extracted the shared chrome that M1 had folded into NinePage: game
  header, timer, paused overlay, solved card, action buttons, the
  persistence hook (now keyed by game) and the share builder.
- Eclipse board: tap cycles sun -> moon -> blank, givens locked, edge
  badges drawn on the borders they constrain, live rule violations,
  undo, keyboard (o/x/arrows/backspace/z).
- One /g/:seed route mounts whichever game the seed names; unknown games
  fall back home rather than silently loading sudoku.

Verified: 46 tests pass; typecheck and build clean; a Playwright pass
confirms the cycle, locked givens, badge rendering, undo, resume across
reload, practice mode, dark mode and the unknown-route fallback, with no
page errors. Nine re-checked after the refactor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0116fZnHojRnvPkReDQA1kNT

---

## Add Crowns (M2) and strengthen its technique ladder from diagnostics

Third game end to end: 8x8 region N-queens, one crown per row, column and
colour, none touching even diagonally. First game to use the
colour-blind-safe region palette the art direction calls for.

Generation needed a different shape from the first two games. There is
nothing to carve — a Crowns puzzle is entirely its region shapes — and
measurement showed that growing regions from crown seeds yields a unique
arrangement essentially never: 0 of 240 random growths. So regions are
refined rather than hoped over. Every valid arrangement uses all N regions
exactly once, so moving one crown cell of an unwanted solution into any
neighbouring region gives that solution two crowns in one region and kills
it, while the intended arrangement survives as long as the cell moved is
not one of its own and the donor region stays connected. That takes
uniqueness from 0% to 13%.

The technique ladder then needed two rounds of its own. The supply piled up
in the BEYOND bucket, four puzzles in five, and a diagnostic showed the
solver stalling with two or fewer crowns placed — weak solver, not hard
puzzles. The missing deduction was that adjacency can be used before any
crown is down: if every remaining way of serving some unit would put a
crown next to cell x, then x cannot be a crown. Adding it spread the supply
across the whole ladder.

Measured over 100 seeds per tier, zero failures anywhere:
  crowns easy/normal/hard  medians 8.7 / 4.9 / 3.0ms, max 63.6ms
and Nine and Eclipse unchanged.

Web
- Region fills use Okabe-Ito, each with its own hatch angle and an always
  drawn border, so colour is never the only channel. Verified in the
  browser: 8 regions, 8 distinct hatch angles.
- Tap cycles blank -> mark -> crown; marks are the player's own bookkeeping
  and are never judged or counted as mistakes. Clear-marks wipes the undo
  stack with them rather than leaving entries that no longer match.
- Fixed a layout flaw shared with Eclipse: the board's `mb-auto` pushed the
  caption away from the board it describes. The slack now sits between the
  caption and the controls, which also keeps the controls in thumb reach.
- Today lists all three games from one shared tile definition.

Verified: 59 tests pass; typecheck and build clean; a Playwright pass
confirms the region rendering, tap cycle, adjacency conflict flagging on
both cells, undo, clear-marks preserving crowns, keyboard, resume across
reload and dark mode, with no page errors.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0116fZnHojRnvPkReDQA1kNT

---

## Add Thread (M2) — the generation risk measured, and a drag bug found

Fourth game end to end: draw one line through every cell, meeting the
numbers in order, without crossing a wall.

The plan has carried Thread as the project's main generation risk since
day one, on the grounds that proving a Hamiltonian path unique is
exponential and might force build-time pre-generation. It does not.
Measured over 60 seeds per tier, zero failures, at runtime:
  easy 5x5 0.9ms med / 6.7ms max
  normal 6x6 3.1ms / 9.1ms
  hard 7x7 14.3ms / 74.2ms

Getting there took correcting the same mistake twice made elsewhere. The
first design named a target waypoint count and discarded any puzzle that
could not be reduced to it; on 7x7 nothing ever could, so every hard seed
failed after burning sixty attempts and about a second and a half. A sweep
showed maximal reduction is in fact cheap (12ms median on 7x7) — the cost
was entirely the reject-and-retry loop. Reducing as far as uniqueness
allows and taking the result costs one attempt. The sweep also showed walls
*reduce* the numbers needed rather than adding to them: they remove
branches, so fewer anchors pin the path, leaving longer unguided stretches.

Engine
- Backbite randomisation: reversing the tail of a path past a neighbour of
  its end always yields another Hamiltonian path, so the space is walked
  rather than searched.
- Walls are only ever placed on edges the path does not use, so the
  solution survives by construction.
- Path counting prunes on connectivity, degree and waypoint order. Without
  those a 7x7 board does not finish; with them it is milliseconds.

Web — and a real bug the browser test caught
- Dragging extends the line; dragging back over the previous cell retracts;
  grabbing a cell further back rewinds to it.
- Pressing on a number and moving made Chromium start a *native drag*,
  which fires pointercancel and kills every pointer event after the first.
  The line would extend but never retract, and nothing in the unit tests
  could see it — the store logic was correct throughout. Fixed by
  preventing the default on pointerdown, select-none, a dragstart guard and
  non-draggable children; confirmed by counting raw pointer events.
- Arrow keys walk the line too, so the board is fully playable without
  dragging, and the cells now sit under a real grid role.

Verified: 86 tests pass; typecheck and build clean; a Playwright pass over
all three sizes confirms extend, retract, rewind, walls, keyboard, step
back, clear and dark mode with no page errors.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0116fZnHojRnvPkReDQA1kNT


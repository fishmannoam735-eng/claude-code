# Puzzle Break

A daily set of logic puzzles. Four are quick; the fifth, a full 9×9 sudoku, is
the one you sit down for.

See [docs/PLAN.md](docs/PLAN.md) for the build plan,
[docs/ART-DIRECTION.md](docs/ART-DIRECTION.md) for the visual system, and
[docs/GAME-RESEARCH.md](docs/GAME-RESEARCH.md) for what the originals do.

## Status

**M2 complete.** All five v1 games play end to end — Nine (9×9 sudoku),
Eclipse (6×6 Takuzu), Crowns (region N-queens), Thread (ordered Hamiltonian
path) and Quilt (rectangle tiling) — each generate → play → validate → solved →
persisted → streak → share, in three difficulties, daily and in practice.

Thread was the plan's standing generation risk, on the grounds that proving a
Hamiltonian path unique might force build-time pre-generation. Measured, it
does not: 0.9ms on 5×5, 3.1ms on 6×6, 14.3ms on 7×7, every seed, at runtime.

Difficulty bands for all five are set from `tools/gen histogram` rather than
guessed; see the note in each game's `generate.ts` for what the measurement
changed. Quilt's measurement changed the *ladder* and not just the bands:
switching rungs off over a 501-board corpus showed `only owner` solving 68% of
boards on its own against `shared cells`'s 20%, so the two swapped places.

## Layout

```
packages/engine   pure TS — seeded RNG, generator, solver, difficulty rater.
                  No DOM, no Node APIs: the same code runs in the browser and
                  in a Supabase Edge Function (see PLAN.md §5).
packages/data     Supabase client, generated DB types, queries.
apps/web          React 19 + Vite + Tailwind 4.
supabase/         Schema as SQL. Source of truth for the database.
```

## The core idea

A puzzle is a pure function of its seed, `<game>:<key>:<difficulty>`:

```ts
nine.generate('nine:2026-09-20:normal')   // same board on every device, forever
nine.generate('nine:a7f2k91x:hard')       // practice / challenge
```

So Postgres stores *results*, never boards — a row is a seed plus a time. The
archive is free, practice is free, and a challenge link **is** the puzzle.

The cost is that a generator must prove its puzzle has exactly one solution.
`solve()` enumerates with a cap of 2; the generate loop is *generate → solve →
keep only if unique → rate → keep only if in band → else reseed*.

## Get it on another machine

Needs **Node 22+** and **pnpm 10** (`corepack enable` is enough — the version
is pinned in `packageManager`). Nothing else.

```sh
git clone https://github.com/fishmannoam735-eng/claude-code.git puzzle-break
cd puzzle-break
cp apps/web/.env.example apps/web/.env    # publishable keys, safe to ship
pnpm install
pnpm dev                                  # http://localhost:5173
```

That's the whole setup. The default branch already carries the work, so a plain
clone lands on it — no `--branch` needed. The keys in `.env.example` are the
real ones: Supabase *publishable* keys are designed to ship inside the client
bundle, so they are committed on purpose and the copy step is a formality Vite
requires.

Verified by doing exactly this from a clean clone: install from the lockfile,
89 engine + 38 web tests, contrast gate, build, then all five games generating
and playable in a browser.

## Develop

```sh
pnpm typecheck && pnpm test && pnpm build
pnpm --filter @pb/gen contrast     # colour contrast gate, exits non-zero on AA failure
pnpm --filter @pb/gen histogram    # difficulty supply per game
```

Play without a backend: if anonymous sign-in fails the app runs from
localStorage and says so. Play is never blocked on the network.

## Database

Migrations live in `supabase/migrations` and are applied to the project of the
same name. After a schema change, regenerate `packages/data/src/database.types.ts`.

RLS is on for every table; a player reads and writes only their own rows.
`plays.validated` can only be set by the service role — see PLAN.md §5, the
server revalidates a solve from its seed before it counts on a leaderboard.

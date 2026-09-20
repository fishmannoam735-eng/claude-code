# Puzzle Break

A daily set of logic puzzles. Four are quick; the fifth, a full 9×9 sudoku, is
the one you sit down for.

See [docs/PLAN.md](docs/PLAN.md) for the build plan,
[docs/ART-DIRECTION.md](docs/ART-DIRECTION.md) for the visual system, and
[docs/GAME-RESEARCH.md](docs/GAME-RESEARCH.md) for what the originals do.

## Status

**M1 — vertical slice.** Nine (9×9 sudoku) plays end to end: generate → play →
validate → solved → persisted → streak → share. The other four games are
scaffolded in the UI but not implemented.

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

## Develop

```sh
pnpm install
cp apps/web/.env.example apps/web/.env    # publishable keys, safe to ship
pnpm dev                                   # http://localhost:5173
pnpm typecheck && pnpm test && pnpm build
```

Play without a backend: if anonymous sign-in fails the app runs from
localStorage and says so. Play is never blocked on the network.

## Database

Migrations live in `supabase/migrations` and are applied to the project of the
same name. After a schema change, regenerate `packages/data/src/database.types.ts`.

RLS is on for every table; a player reads and writes only their own rows.
`plays.validated` can only be set by the service role — see PLAN.md §5, the
server revalidates a solve from its seed before it counts on a leaderboard.

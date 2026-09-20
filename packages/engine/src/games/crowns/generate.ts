import { createRng, type Rng } from '../../rng.js';
import type { Difficulty, DifficultyScore } from '../../types.js';
import { CELLS, CROWN, N, ORTHOGONAL, emptyGrid, regionCells, type Grid, type Regions } from './grid.js';
import { findSolutions } from './solver.js';
import { BEYOND, TECHNIQUES, humanSolve } from './techniques.js';

export interface CrownsPuzzle {
  seed: string;
  difficulty: Difficulty;
  regions: Regions;
  solution: Grid;
  rating: DifficultyScore;
}

/**
 * A valid crown arrangement: one per row and column, and — because two crowns
 * can only touch when their rows are consecutive — columns at least two apart
 * in consecutive rows.
 */
export function placeCrowns(rng: Rng): number[] {
  const cols = new Array<number>(N).fill(-1);
  const order = Array.from({ length: N }, (_, i) => i);

  function fill(r: number, used: number): boolean {
    if (r === N) return true;
    for (const c of rng.shuffle(order.slice())) {
      if (used & (1 << c)) continue;
      if (r > 0 && Math.abs(cols[r - 1]! - c) < 2) continue;
      cols[r] = c;
      if (fill(r + 1, used | (1 << c))) return true;
      cols[r] = -1;
    }
    return false;
  }

  fill(0, 0);
  return cols;
}

/**
 * Grow one connected region out from each crown until the board is covered.
 * Each region gets a random appetite so the shapes come out uneven — regions
 * of identical size make the puzzle read as a grid of blocks and give the
 * solver far less to work with.
 */
export function growRegions(rng: Rng, crowns: number[]): Regions {
  const regions = new Array<number>(CELLS).fill(-1);
  const frontier: number[][] = Array.from({ length: N }, () => []);
  const appetite = Array.from({ length: N }, () => 0.5 + rng.next());

  crowns.forEach((c, r) => {
    const i = r * N + c;
    regions[i] = r;
    for (const j of ORTHOGONAL[i]!) frontier[r]!.push(j);
  });

  let remaining = CELLS - N;
  while (remaining > 0) {
    // Weighted pick among regions that can still grow.
    const live = frontier
      .map((f, g) => ({ g, f: f.filter((i) => regions[i] === -1) }))
      .filter((x) => x.f.length > 0);
    live.forEach((x) => { frontier[x.g] = x.f; });
    if (live.length === 0) break;

    const weights = live.map((x) => appetite[x.g]!);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * total;
    let pick = live[live.length - 1]!;
    for (let k = 0; k < live.length; k++) {
      roll -= weights[k]!;
      if (roll <= 0) { pick = live[k]!; break; }
    }

    const cell = pick.f[rng.int(pick.f.length)]!;
    regions[cell] = pick.g;
    remaining--;
    for (const j of ORTHOGONAL[cell]!) {
      if (regions[j] === -1) frontier[pick.g]!.push(j);
    }
  }

  // Any cell the growth could not reach joins a neighbouring region.
  for (let i = 0; i < CELLS; i++) {
    if (regions[i] !== -1) continue;
    const near = ORTHOGONAL[i]!.find((j) => regions[j] !== -1);
    regions[i] = near !== undefined ? regions[near]! : 0;
  }

  return regions;
}

/** Is this set of cells orthogonally connected? */
function connected(cells: readonly number[]): boolean {
  if (cells.length === 0) return true;
  const inSet = new Set(cells);
  const seen = new Set<number>([cells[0]!]);
  const stack = [cells[0]!];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of ORTHOGONAL[i]!) {
      if (inSet.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === cells.length;
}

/**
 * Grown regions almost never pin down a single arrangement — measured over 240
 * random growths, every one admitted more than one solution. So the regions
 * have to be argued with rather than hoped over.
 *
 * Take any solution that isn't the intended one. Every valid solution uses all
 * N regions exactly once, so moving one of that solution's crown cells into
 * *any* neighbouring region gives it two crowns in one region and kills it.
 * The intended solution survives as long as the cell moved is not one of its
 * own crowns, and the donor region stays connected and keeps its crown.
 *
 * Each round kills one alternative; it may expose others, so this runs to a
 * fixed point and gives up rather than looping.
 */
export function refineRegions(
  regions: Regions,
  intended: readonly number[],
  rng: Rng,
  maxRounds = 120,
): Regions | null {
  const out = regions.slice();
  const intendedSet = new Set(intended);

  for (let round = 0; round < maxRounds; round++) {
    const sols = findSolutions(out, 2);
    if (sols.length === 0) return null;          // we broke it
    if (sols.length === 1) return out;           // unique: done

    const alt = sols.find((s) => s.some((i) => !intendedSet.has(i)));
    if (!alt) return null;                       // both solutions are the intended one

    const movable = rng.shuffle(alt.filter((i) => !intendedSet.has(i)));
    let moved = false;

    for (const i of movable) {
      const from = out[i]!;
      const targets = rng.shuffle(
        [...new Set(ORTHOGONAL[i]!.map((j) => out[j]!))].filter((g) => g !== from),
      );
      for (const to of targets) {
        out[i] = to;
        const donor = regionCells(out)[from]!;
        if (donor.length > 0 && connected(donor)) { moved = true; break; }
        out[i] = from;
      }
      if (moved) break;
    }

    if (!moved) return null;                     // nothing legal left to move
  }

  return findSolutions(out, 2).length === 1 ? out : null;
}

interface Band { min: number; max: number }

/**
 * Set from `tools/gen histogram`. Unlike Nine and Eclipse there is nothing to
 * carve — a Crowns puzzle is entirely its region shapes, so difficulty is
 * whatever refinement happens to leave behind and the band is a pure filter
 * over that supply.
 *
 * The measurement mattered twice here. It first showed the supply piled up in
 * the BEYOND bucket, four puzzles in five; a diagnostic then showed the solver
 * stalling with two or fewer crowns placed, which is a weak solver rather than
 * hard puzzles. Adding the crowded-neighbour deduction spread the supply
 * across the whole ladder and every tier now generates without a single
 * failure over 180 seeds.
 */
const BANDS: Record<Difficulty, Band> = {
  easy:   { min: 1, max: 2 },
  normal: { min: 3, max: 3 },
  hard:   { min: 4, max: BEYOND },
};

export function rateRegions(regions: Regions): DifficultyScore {
  const run = humanSolve(regions);
  const sizes = new Array<number>(N).fill(0);
  for (const g of regions) sizes[g]!++;
  return {
    score: run.hardest / BEYOND,
    hardest: run.hardest === BEYOND ? 'beyond subset counting' : TECHNIQUES[run.hardest],
    detail: {
      hardestLevel: run.hardest,
      onlyCellLeft: run.counts[1]!,
      regionLocks: run.counts[2]!,
      subsetCounts: run.counts[3]!,
      smallestRegion: Math.min(...sizes),
      largestRegion: Math.max(...sizes),
    },
  };
}

/**
 * As in Eclipse, `hard` accepts BEYOND: past a ladder that stops at three-way
 * counting, not past what a person can reason out. The solution is still
 * unique either way.
 */
export const MAX_ATTEMPTS = 800;

export function generateCrowns(seed: string, difficulty: Difficulty): CrownsPuzzle {
  const band = BANDS[difficulty];
  const rng = createRng(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const cols = placeCrowns(rng);
    const intended = cols.map((c, r) => r * N + c);
    const grown = growRegions(rng, cols);

    // The arrangement we grew from is only *a* solution; the puzzle is only
    // fair if it is the only one.
    const regions = refineRegions(grown, intended, rng);
    if (!regions) continue;

    const rating = rateRegions(regions);
    const lvl = rating.detail['hardestLevel']!;
    if (lvl < band.min || lvl > band.max) continue;

    const solution = emptyGrid();
    cols.forEach((c, r) => { solution[r * N + c] = CROWN; });
    return { seed, difficulty, regions, solution, rating };
  }
  throw new Error(`could not generate a ${difficulty} crowns for seed ${seed} in ${MAX_ATTEMPTS} attempts`);
}

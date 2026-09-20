import { createRng, type Rng } from '../../rng.js';
import type { Difficulty, DifficultyScore } from '../../types.js';
import {
  ADJACENT, CELLS, HALF, LINES, LINES_OF, MOON, N, SUN, emptyGrid,
  type Edge, type Grid,
} from './grid.js';
import { countSolutions } from './solver.js';
import { BEYOND, TECHNIQUES, humanSolve } from './techniques.js';

export interface EclipsePuzzle {
  seed: string;
  difficulty: Difficulty;
  givens: Grid;
  edges: Edge[];
  solution: Grid;
  rating: DifficultyScore;
}

/** A random grid satisfying every Takuzu rule. */
export function fillGrid(rng: Rng): Grid {
  const g = emptyGrid();

  function ok(i: number, v: number): boolean {
    for (const ln of LINES_OF[i]!) {
      let same = 0;
      for (const j of LINES[ln]!) if (g[j] === v) same++;
      if (same + 1 > HALF) return false;
    }
    const r = Math.floor(i / N), c = i % N;
    const rowAt = (k: number): number => (k < 0 || k >= N ? -1 : (k === c ? v : g[r * N + k]!));
    const colAt = (k: number): number => (k < 0 || k >= N ? -1 : (k === r ? v : g[k * N + c]!));
    for (let d = -2; d <= 0; d++) {
      if (rowAt(c + d) === v && rowAt(c + d + 1) === v && rowAt(c + d + 2) === v) return false;
      if (colAt(r + d) === v && colAt(r + d + 1) === v && colAt(r + d + 2) === v) return false;
    }
    return true;
  }

  function fill(i: number): boolean {
    if (i === CELLS) return true;
    for (const v of rng.shuffle([SUN, MOON])) {
      if (!ok(i, v)) continue;
      g[i] = v;
      if (fill(i + 1)) return true;
      g[i] = 0;
    }
    return false;
  }

  fill(0);
  return g;
}

/** Every edge the solution could carry, as a badge stating same or different. */
function allEdges(solution: Grid): Edge[] {
  return ADJACENT.map(([a, b]) => ({ a, b, same: solution[a] === solution[b] }));
}

/**
 * Bands over the technique ladder plus how much scaffolding to leave. The
 * numbers here are starting points; `tools/gen` measures the real
 * distribution and they get tuned from that, not from intuition.
 */
interface Band { min: number; max: number; edges: number; floorGivens: number; pruneEdges: boolean }

/**
 * Set from `tools/gen histogram`, not from intuition, and the measurement
 * changed the design.
 *
 * On a 6x6 board the technique ladder is too short to separate three tiers on
 * its own: line-count and no-three deductions fire in almost every puzzle, so
 * nearly everything rates level 3 whatever we do. An earlier easy band of
 * levels 1-2 asked for something the sweep produces about twice in sixty
 * tries, and it failed outright on 7% of seeds.
 *
 * So for Eclipse the primary lever is how much scaffolding is left standing,
 * with the technique level as a secondary filter. That is the opposite of
 * Nine, where the ladder is long enough to do the separating by itself.
 */
const BANDS: Record<Difficulty, Band> = {
  easy:   { min: 1, max: 3, edges: 9, floorGivens: 20, pruneEdges: false },
  normal: { min: 3, max: 4, edges: 5, floorGivens: 12, pruneEdges: false },
  hard:   { min: 4, max: BEYOND, edges: 3, floorGivens: 0, pruneEdges: true },
};

export function rateGrid(givens: Grid, edges: readonly Edge[]): DifficultyScore {
  const run = humanSolve(givens, edges);
  return {
    score: run.hardest / BEYOND,
    hardest: run.hardest === BEYOND ? 'beyond lookahead' : TECHNIQUES[run.hardest],
    detail: {
      givens: givens.filter((v) => v !== 0).length,
      edges: edges.length,
      hardestLevel: run.hardest,
      edgeRules: run.counts[1]!,
      noThree: run.counts[2]!,
      lineCounts: run.counts[3]!,
      lookaheads: run.counts[4]!,
    },
  };
}

/**
 * Strip the puzzle back toward the minimum that still pins the solution.
 *
 * `floorGivens` is what makes an easy puzzle possible at all: carving as far
 * as uniqueness allows always lands on a board that needs the harder
 * techniques, because the easy deductions are exactly the redundancy we just
 * removed. Stopping early leaves that scaffolding in place.
 *
 * Edges are pruned after cells, and only when `pruneEdges` is set, because a
 * badge is worth far more to a solver than any single given.
 */
export function carve(
  solution: Grid,
  rng: Rng,
  edgeBudget: number,
  floorGivens = 0,
  pruneEdges = true,
): { givens: Grid; edges: Edge[] } {
  const edges = rng.shuffle(allEdges(solution)).slice(0, edgeBudget);
  const givens = solution.slice();
  let count = CELLS;

  for (const i of rng.shuffle([...Array(CELLS).keys()])) {
    if (count <= floorGivens) break;
    const v = givens[i]!;
    givens[i] = 0;
    if (countSolutions(givens, edges, 2).count !== 1) givens[i] = v;
    else count--;
  }

  if (!pruneEdges) return { givens, edges };

  const kept: Edge[] = edges.slice();
  for (const e of rng.shuffle(edges.slice())) {
    const without = kept.filter((k) => k !== e);
    if (countSolutions(givens, without, 2).count === 1) {
      kept.length = 0;
      kept.push(...without);
    }
  }

  return { givens, edges: kept };
}

/**
 * `hard` accepts BEYOND, meaning our ladder could not finish it. Our lookahead
 * only tests one cell against one line at a time, while a player scans whole
 * lines at once, so BEYOND here means "past what we implemented", not
 * "requires guessing" — the puzzle still has exactly one solution. Lengthening
 * the ladder would let us make that claim properly instead of arguing it.
 */
export const MAX_ATTEMPTS = 600;

export function generateEclipse(seed: string, difficulty: Difficulty): EclipsePuzzle {
  const band = BANDS[difficulty];
  const rng = createRng(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = fillGrid(rng);
    const { givens, edges } = carve(solution, rng, band.edges, band.floorGivens, band.pruneEdges);
    const rating = rateGrid(givens, edges);
    const lvl = rating.detail['hardestLevel']!;
    if (lvl >= band.min && lvl <= band.max) {
      return { seed, difficulty, givens, edges, solution, rating };
    }
  }
  throw new Error(`could not generate a ${difficulty} eclipse for seed ${seed} in ${MAX_ATTEMPTS} attempts`);
}

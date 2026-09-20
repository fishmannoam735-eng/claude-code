import { createRng, type Rng } from '../../rng.js';
import type { Difficulty, DifficultyScore } from '../../types.js';
import { CELLS, PEERS, emptyGrid, type Grid } from './grid.js';
import { countSolutions } from './solver.js';
import { BEYOND, TECHNIQUES, humanSolve } from './techniques.js';

export interface NinePuzzle {
  seed: string;
  difficulty: Difficulty;
  givens: Grid;
  solution: Grid;
  rating: DifficultyScore;
}

/** Fill an empty grid with a random valid solution. */
export function fillGrid(rng: Rng): Grid {
  const g = emptyGrid();
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  function ok(i: number, d: number): boolean {
    for (const j of PEERS[i]!) if (g[j] === d) return false;
    return true;
  }
  function fill(i: number): boolean {
    if (i === CELLS) return true;
    rng.shuffle(digits);
    for (const d of digits) {
      if (ok(i, d)) {
        g[i] = d;
        if (fill(i + 1)) return true;
        g[i] = 0;
      }
    }
    return false;
  }
  fill(0);
  return g;
}

/**
 * Remove givens in rotationally symmetric pairs while the puzzle stays
 * unique, stopping once at or below `targetGivens`.
 */
export function dig(solution: Grid, rng: Rng, targetGivens: number): Grid {
  const g = solution.slice();
  let givens = CELLS;
  const pairs = rng.shuffle(Array.from({ length: 41 }, (_, i) => i)); // 0..40; 40 is the centre
  for (const a of pairs) {
    if (givens <= targetGivens) break;
    const b = 80 - a;
    const va = g[a]!, vb = g[b]!;
    g[a] = 0; g[b] = 0;
    if (countSolutions(g, 2).count === 1) {
      givens -= a === b ? 1 : 2;
    } else {
      g[a] = va; g[b] = vb;
    }
  }
  return g;
}

/**
 * Difficulty bands over the technique ladder. `hardest` is the highest
 * technique level the human solver needed; BEYOND means it got stuck.
 */
const BANDS: Record<Difficulty, { min: number; max: number; targetGivens: number }> = {
  easy:   { min: 1, max: 2,      targetGivens: 36 },
  normal: { min: 3, max: 4,      targetGivens: 29 },
  hard:   { min: BEYOND, max: BEYOND, targetGivens: 23 },
};

export function rateGrid(givens: Grid): DifficultyScore {
  const run = humanSolve(givens);
  const g = givens.filter((v) => v !== 0).length;
  return {
    score: run.hardest / BEYOND,
    hardest: run.hardest === BEYOND ? 'beyond naked pairs' : TECHNIQUES[run.hardest],
    detail: {
      givens: g,
      hardestLevel: run.hardest,
      nakedSingles: run.counts[1]!,
      hiddenSingles: run.counts[2]!,
      lockedCandidates: run.counts[3]!,
      nakedPairs: run.counts[4]!,
    },
  };
}

export const MAX_ATTEMPTS = 400;

export function generateNine(seed: string, difficulty: Difficulty): NinePuzzle {
  const band = BANDS[difficulty];
  const rng = createRng(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = fillGrid(rng);
    const givens = dig(solution, rng, band.targetGivens);
    const rating = rateGrid(givens);
    const lvl = rating.detail['hardestLevel']!;
    if (lvl >= band.min && lvl <= band.max) {
      return { seed, difficulty, givens, solution, rating };
    }
  }
  throw new Error(`could not generate a ${difficulty} puzzle for seed ${seed} in ${MAX_ATTEMPTS} attempts`);
}

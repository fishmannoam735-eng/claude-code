import type { Generator, Result } from '../../types.js';
import { parseSeed } from '../../seed.js';
import { isComplete, isSolved, violations, type Grid } from './grid.js';
import { countSolutions } from './solver.js';
import { generateEclipse, rateGrid, type EclipsePuzzle } from './generate.js';

export const eclipse: Generator<EclipsePuzzle, Grid> = {
  game: 'eclipse',

  generate(seed) {
    const parsed = parseSeed(seed);
    if (!parsed || parsed.game !== 'eclipse') throw new Error(`not an eclipse seed: ${seed}`);
    return generateEclipse(seed, parsed.difficulty);
  },

  solve(puzzle) {
    const { count, solution } = countSolutions(puzzle.givens, puzzle.edges, 2);
    if (count === 0 || !solution) return [];
    return count === 1 ? [solution] : [solution, solution];
  },

  validate(puzzle, attempt): Result {
    if (attempt.length !== 36) return { ok: false, reason: 'invalid' };
    for (let i = 0; i < 36; i++) {
      const g = puzzle.givens[i]!;
      if (g !== 0 && attempt[i] !== g) return { ok: false, reason: 'invalid' };
    }
    if (!isComplete(attempt)) return { ok: false, reason: 'incomplete' };
    return isSolved(attempt, puzzle.edges) ? { ok: true } : { ok: false, reason: 'wrong' };
  },

  rate(puzzle) {
    return rateGrid(puzzle.givens, puzzle.edges);
  },
};

export type { EclipsePuzzle };
export {
  N, CELLS, SUN, MOON, HALF, other, rowOf, colOf, LINES, LINES_OF, ADJACENT,
  emptyGrid, parseGrid, gridToString, violations, isComplete, isSolved, edgeKey,
  type Grid, type Edge,
} from './grid.js';
export { humanSolve, TECHNIQUES, BEYOND } from './techniques.js';
export { countSolutions } from './solver.js';
export { fillGrid, carve, rateGrid, generateEclipse } from './generate.js';

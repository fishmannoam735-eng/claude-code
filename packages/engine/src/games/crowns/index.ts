import type { Generator, Result } from '../../types.js';
import { parseSeed } from '../../seed.js';
import { CELLS, CROWN, N, crownsIn, isSolved, type Grid } from './grid.js';
import { countSolutions } from './solver.js';
import { generateCrowns, rateRegions, type CrownsPuzzle } from './generate.js';

export const crowns: Generator<CrownsPuzzle, Grid> = {
  game: 'crowns',

  generate(seed) {
    const parsed = parseSeed(seed);
    if (!parsed || parsed.game !== 'crowns') throw new Error(`not a crowns seed: ${seed}`);
    return generateCrowns(seed, parsed.difficulty);
  },

  solve(puzzle) {
    const { count, solution } = countSolutions(puzzle.regions, 2);
    if (count === 0 || !solution) return [];
    return count === 1 ? [solution] : [solution, solution];
  },

  /** Only crowns are judged — the player's marks are their own bookkeeping. */
  validate(puzzle, attempt): Result {
    if (attempt.length !== CELLS) return { ok: false, reason: 'invalid' };
    if (crownsIn(attempt).length < N) return { ok: false, reason: 'incomplete' };
    return isSolved(attempt, puzzle.regions) ? { ok: true } : { ok: false, reason: 'wrong' };
  },

  rate(puzzle) {
    return rateRegions(puzzle.regions);
  },
};

export type { CrownsPuzzle };
export {
  N, CELLS, EMPTY, MARK, CROWN, rowOf, colOf, NEIGHBOURS, ORTHOGONAL, ROWS, COLS,
  regionCells, emptyGrid, crownsIn, violations, isSolved, columnsByRow,
  type Grid, type Regions,
} from './grid.js';
export { humanSolve, TECHNIQUES, BEYOND } from './techniques.js';
export { countSolutions, findSolutions } from './solver.js';
export { placeCrowns, growRegions, refineRegions, rateRegions, generateCrowns } from './generate.js';

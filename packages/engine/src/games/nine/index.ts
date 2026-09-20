import type { Generator, Result } from '../../types.js';
import { parseSeed } from '../../seed.js';
import { conflicts, isComplete, type Grid } from './grid.js';
import { countSolutions } from './solver.js';
import { generateNine, rateGrid, type NinePuzzle } from './generate.js';

export const nine: Generator<NinePuzzle, Grid> = {
  game: 'nine',

  generate(seed) {
    const parsed = parseSeed(seed);
    if (!parsed || parsed.game !== 'nine') throw new Error(`not a nine seed: ${seed}`);
    return generateNine(seed, parsed.difficulty);
  },

  solve(puzzle) {
    const { count, solution } = countSolutions(puzzle.givens, 2);
    if (count === 0 || !solution) return [];
    return count === 1 ? [solution] : [solution, solution];
  },

  validate(puzzle, attempt): Result {
    if (attempt.length !== 81) return { ok: false, reason: 'invalid' };
    for (let i = 0; i < 81; i++) {
      const g = puzzle.givens[i]!;
      if (g !== 0 && attempt[i] !== g) return { ok: false, reason: 'invalid' };
    }
    if (!isComplete(attempt)) return { ok: false, reason: 'incomplete' };
    if (conflicts(attempt).some(Boolean)) return { ok: false, reason: 'wrong' };
    for (let i = 0; i < 81; i++) if (attempt[i] !== puzzle.solution[i]) return { ok: false, reason: 'wrong' };
    return { ok: true };
  },

  rate(puzzle) {
    return rateGrid(puzzle.givens);
  },
};

export type { NinePuzzle };
export { conflicts, isComplete, parseGrid, gridToString, PEERS, UNITS, rowOf, colOf, boxOf, type Grid } from './grid.js';
export { humanSolve, TECHNIQUES, BEYOND } from './techniques.js';
export { countSolutions } from './solver.js';
export { fillGrid, dig, rateGrid, generateNine } from './generate.js';

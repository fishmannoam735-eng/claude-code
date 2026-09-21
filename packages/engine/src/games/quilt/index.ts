import type { Generator, Result } from '../../types.js';
import { parseSeed } from '../../seed.js';
import { isSolved, type Owner } from './grid.js';
import { countTilings } from './solver.js';
import { generateQuilt, rateQuilt, type QuiltPuzzle } from './generate.js';

export const quilt: Generator<QuiltPuzzle, Owner> = {
  game: 'quilt',

  generate(seed) {
    const parsed = parseSeed(seed);
    if (!parsed || parsed.game !== 'quilt') throw new Error(`not a quilt seed: ${seed}`);
    return generateQuilt(seed, parsed.difficulty);
  },

  solve(puzzle) {
    const { count, first } = countTilings(puzzle.n, puzzle.clues, 2);
    if (count === 0 || !first) return [];
    return count === 1 ? [first] : [first, first];
  },

  validate(puzzle, attempt): Result {
    if (attempt.length !== puzzle.n * puzzle.n) return { ok: false, reason: 'invalid' };
    if (attempt.some((k) => k < -1 || k >= puzzle.clues.length)) return { ok: false, reason: 'invalid' };
    if (attempt.some((k) => k === -1)) return { ok: false, reason: 'incomplete' };
    return isSolved(attempt, puzzle.clues, puzzle.n) ? { ok: true } : { ok: false, reason: 'wrong' };
  },

  rate(puzzle) {
    return rateQuilt(puzzle.n, puzzle.clues);
  },
};

export type { QuiltPuzzle };
export {
  SIDES, rowOf, colOf, shapeOf, rectArea, rectCells, rectContains, fitsClue,
  candidatesFor, emptyOwner, cellsByClue, boundsOf, brokenClues, isSolved, ownerFromRects,
  type Clue, type Owner, type Rect, type Shape,
} from './grid.js';
export { buildCandidates, countTilings, findTilings, maskOf, type Cand } from './solver.js';
export { humanSolve, TECHNIQUES, BEYOND, REFUTE_MAX, type SolveOpts } from './techniques.js';
export { MAX_SIDE, randomTiling, areaClues, weakenClues, rateQuilt, generateQuilt } from './generate.js';

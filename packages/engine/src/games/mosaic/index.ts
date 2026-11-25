import type { Generator, Result } from '../../types.js';
import { parseSeed } from '../../seed.js';
import { generateMosaic, type MosaicPuzzle } from './generate.js';
import { logicSolve } from './solver.js';

/** A Mosaic board: one number per square, 1 filled and anything else not. */
export type MosaicGrid = number[];

export const mosaic: Generator<MosaicPuzzle, MosaicGrid> = {
  game: 'mosaic',

  generate(seed) {
    const parsed = parseSeed(seed);
    if (!parsed || parsed.game !== 'mosaic') throw new Error(`not a mosaic seed: ${seed}`);
    return generateMosaic(seed, parsed.difficulty);
  },

  solve(puzzle) {
    // Every picture is reached by row-and-column logic alone, which proves
    // there is exactly one answer.
    const r = logicSolve(puzzle);
    return r.solved ? [r.grid.map((v) => (v === 1 ? 1 : 0))] : [puzzle.solution, puzzle.solution];
  },

  validate(puzzle, attempt): Result {
    if (attempt.length !== puzzle.w * puzzle.h) return { ok: false, reason: 'invalid' };
    const filled = attempt.filter((v) => v === 1).length;
    const need = puzzle.solution.filter((v) => v === 1).length;
    if (filled < need) return { ok: false, reason: 'incomplete' };
    return puzzle.solution.every((v, i) => (v === 1) === (attempt[i] === 1)) ? { ok: true } : { ok: false, reason: 'wrong' };
  },

  rate(puzzle) {
    return puzzle.rating;
  },
};

export type { MosaicPuzzle };
export { generateMosaic, build, artOf } from './generate.js';
export { PICTURES, SIDES, pictureById, partOf, type Picture, type Motion, type MotionKind } from './pictures.js';
export { clueOf, solveLine, slide, leftmost, rightmost, type Known } from './line.js';
export { logicSolve, cellsOf, allLines, clueFor, type Clues, type LineRef } from './solver.js';
export { nextMosaicHint, UNKNOWN, FILLED, CROSSED, type MosaicHint, type MosaicHintStep } from './hint.js';

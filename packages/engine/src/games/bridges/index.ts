import type { Generator, Result } from '../../types.js';
import { parseSeed } from '../../seed.js';
import { isSolved, type Bridges } from './grid.js';
import { countSolutions } from './solver.js';
import { generateBridges, rateLayout, type BridgesPuzzle } from './generate.js';

export const bridges: Generator<BridgesPuzzle, Bridges> = {
  game: 'bridges',

  generate(seed) {
    const parsed = parseSeed(seed);
    if (!parsed || parsed.game !== 'bridges') throw new Error(`not a bridges seed: ${seed}`);
    return generateBridges(seed, parsed.difficulty);
  },

  solve(puzzle) {
    const { count, solution } = countSolutions(puzzle.layout, 2);
    if (count === 0 || !solution) return [];
    return count === 1 ? [solution] : [solution, solution];
  },

  validate(puzzle, attempt): Result {
    const L = puzzle.layout;
    if (attempt.length !== L.links.length) return { ok: false, reason: 'invalid' };
    if (attempt.some((v) => v < 0 || v > 2)) return { ok: false, reason: 'invalid' };
    const c = new Array<number>(L.islands.length).fill(0);
    L.links.forEach((l, k) => { c[l.a]! += attempt[k]!; c[l.b]! += attempt[k]!; });
    if (L.islands.some((s, k) => c[k]! < s.need)) return { ok: false, reason: 'incomplete' };
    return isSolved(L, attempt) ? { ok: true } : { ok: false, reason: 'wrong' };
  },

  rate(puzzle) {
    const { level: _l, solved: _s, whatIfs: _w, ...r } = rateLayout(puzzle.layout);
    return r;
  },
};

export type { BridgesPuzzle };
export {
  buildLayout, across, counts, groups, blockedBy, isSolved, rowOf, colOf,
  type Island, type Link, type Layout, type Bridges,
} from './grid.js';
export { countSolutions } from './solver.js';
export { humanSolve, Deducer } from './techniques.js';
export { generateBridges, grow, SIZES } from './generate.js';
export { nextBridgesHint, type BridgesHint, type BridgesHintStep } from './hint.js';

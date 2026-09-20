import type { Generator, Result } from '../../types.js';
import { parseSeed } from '../../seed.js';
import { openNeighbours, type Path } from './grid.js';
import { countPaths, pathIsValid } from './solver.js';
import { generateThread, rateThread, type ThreadPuzzle } from './generate.js';

export const thread: Generator<ThreadPuzzle, Path> = {
  game: 'thread',

  generate(seed) {
    const parsed = parseSeed(seed);
    if (!parsed || parsed.game !== 'thread') throw new Error(`not a thread seed: ${seed}`);
    return generateThread(seed, parsed.difficulty);
  },

  solve(puzzle) {
    const open = openNeighbours(puzzle.n, new Set(puzzle.walls));
    const { count, first } = countPaths(puzzle.n, open, puzzle.waypoints, 2);
    if (count === 0 || !first) return [];
    return count === 1 ? [first] : [first, first];
  },

  validate(puzzle, attempt): Result {
    const cells = puzzle.n * puzzle.n;
    if (attempt.length < cells) return { ok: false, reason: 'incomplete' };
    if (attempt.length > cells) return { ok: false, reason: 'invalid' };
    const open = openNeighbours(puzzle.n, new Set(puzzle.walls));
    return pathIsValid(attempt, puzzle.n, open, puzzle.waypoints)
      ? { ok: true }
      : { ok: false, reason: 'wrong' };
  },

  rate(puzzle) {
    return rateThread(puzzle.n, puzzle.waypoints, new Set(puzzle.walls), puzzle.solution);
  },
};

export type { ThreadPuzzle };
export {
  SIDES, rowOf, colOf, wallKey, neighbours, adjacentPairs, openNeighbours, areAdjacent,
  type Path, type Walls,
} from './grid.js';
export { countPaths, pathIsValid } from './solver.js';
export { randomPath, wallsOffPath, reduceWaypoints, rateThread, generateThread } from './generate.js';

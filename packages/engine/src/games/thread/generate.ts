import { createRng, type Rng } from '../../rng.js';
import type { Difficulty, DifficultyScore } from '../../types.js';
import {
  SIDES, adjacentPairs, openNeighbours, wallKey, type Path, type Walls,
} from './grid.js';
import { countPaths } from './solver.js';

export interface ThreadPuzzle {
  seed: string;
  difficulty: Difficulty;
  n: number;
  /** Cell index of each number, 1..K in order. */
  waypoints: number[];
  /** Wall keys, as produced by `wallKey`. */
  walls: string[];
  solution: Path;
  rating: DifficultyScore;
}

/** A boustrophedon path — a valid Hamiltonian path to start randomising from. */
function snake(n: number): Path {
  const out: Path = [];
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < n; k++) {
      const c = r % 2 === 0 ? k : n - 1 - k;
      out.push(r * n + c);
    }
  }
  return out;
}

/**
 * Backbite: take an end of the path, step to one of its neighbours already on
 * the path, and reverse the tail beyond it. The result is always another
 * Hamiltonian path, so repeating it walks the space of paths without ever
 * having to search for one.
 */
export function randomPath(n: number, rng: Rng, iterations = 0): Path {
  const nbr = openNeighbours(n, new Set());
  const path = snake(n);
  const pos = new Array<number>(n * n).fill(-1);
  path.forEach((cell, k) => { pos[cell] = k; });
  const rounds = iterations || n * n * 12;

  for (let t = 0; t < rounds; t++) {
    const fromTail = rng.next() < 0.5;
    const endCell = fromTail ? path[path.length - 1]! : path[0]!;
    const options = nbr[endCell]!;
    const pick = options[rng.int(options.length)]!;

    if (fromTail) {
      const k = pos[pick]!;
      if (k === path.length - 2) continue;                 // already the neighbour
      // Reverse path[k+1 .. end]
      for (let a = k + 1, b = path.length - 1; a < b; a++, b--) {
        const tmp = path[a]!; path[a] = path[b]!; path[b] = tmp;
      }
      for (let a = k + 1; a < path.length; a++) pos[path[a]!] = a;
    } else {
      const k = pos[pick]!;
      if (k === 1) continue;
      for (let a = 0, b = k - 1; a < b; a++, b--) {
        const tmp = path[a]!; path[a] = path[b]!; path[b] = tmp;
      }
      for (let a = 0; a < k; a++) pos[path[a]!] = a;
    }
  }

  return path;
}

/**
 * Walls may only go where the path does not run, so the path survives by
 * construction rather than by being re-checked.
 */
export function wallsOffPath(n: number, path: Path, rng: Rng, count: number): Set<string> {
  const used = new Set<string>();
  for (let k = 1; k < path.length; k++) used.add(wallKey(path[k - 1]!, path[k]!));
  const free = adjacentPairs(n)
    .map(([a, b]) => wallKey(a, b))
    .filter((key) => !used.has(key));
  return new Set(rng.shuffle(free).slice(0, count));
}

interface Band { walls: number }

/**
 * Thread has no technique ladder — a path is either forced or it is not — so
 * the levers are board size and how much the walls narrow the choices.
 *
 * There is deliberately no acceptance filter here, and that is what the
 * measurement changed. The first design named a target waypoint count and
 * discarded any puzzle that could not be reduced to it; on a 7x7 board nothing
 * ever could, so every hard seed failed after burning sixty attempts and about
 * a second and a half. Reducing as far as uniqueness allows and taking the
 * result costs one attempt: 1ms on 5x5, 3ms on 6x6, 12ms on 7x7.
 *
 * Walls turned out to cut the numbers needed rather than add to them — they
 * remove branches, so fewer anchors are required to pin the path, which leaves
 * longer unguided stretches for the player to work out.
 */
const BANDS: Record<Difficulty, Band> = {
  easy:   { walls: 3 },
  normal: { walls: 4 },
  hard:   { walls: 6 },
};

export function rateThread(
  n: number, waypoints: readonly number[], walls: Walls, solution: Path,
): DifficultyScore {
  const cells = n * n;
  // Longest stretch the player must work out with no number to lean on.
  const marks = waypoints.map((c) => solution.indexOf(c)).sort((a, b) => a - b);
  let longestGap = marks[0]!;
  for (let k = 1; k < marks.length; k++) longestGap = Math.max(longestGap, marks[k]! - marks[k - 1]!);
  longestGap = Math.max(longestGap, cells - 1 - marks[marks.length - 1]!);

  return {
    score: Math.min(1, longestGap / cells),
    hardest: `${longestGap} cells between numbers`,
    detail: {
      side: n,
      cells,
      waypoints: waypoints.length,
      walls: walls.size,
      longestGap,
    },
  };
}

/** Only a guard against a pathological board; one attempt is the normal case. */
export const MAX_ATTEMPTS = 8;

/**
 * Take away every number the puzzle can lose while exactly one path still
 * survives. The two ends always stay — they are what makes the path a path
 * rather than a loop.
 */
export function reduceWaypoints(
  n: number,
  open: readonly (readonly number[])[],
  solution: Path,
  rng: Rng,
): number[] {
  let waypoints = solution.slice();
  const droppable = rng.shuffle(
    waypoints.map((_, k) => k).filter((k) => k !== 0 && k !== waypoints.length - 1),
  );
  for (const k of droppable) {
    const without = waypoints.filter((c) => c !== solution[k]!);
    if (countPaths(n, open, without, 2).count === 1) waypoints = without;
  }
  return waypoints;
}

export function generateThread(seed: string, difficulty: Difficulty): ThreadPuzzle {
  const band = BANDS[difficulty];
  const n = SIDES[difficulty];
  const rng = createRng(seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = randomPath(n, rng);
    const walls = wallsOffPath(n, solution, rng, band.walls);
    const open = openNeighbours(n, walls);

    const waypoints = reduceWaypoints(n, open, solution, rng);
    if (countPaths(n, open, waypoints, 2).count !== 1) continue;

    return {
      seed, difficulty, n,
      waypoints,
      walls: [...walls],
      solution,
      rating: rateThread(n, waypoints, walls, solution),
    };
  }

  throw new Error(`could not generate a ${difficulty} thread for seed ${seed} in ${MAX_ATTEMPTS} attempts`);
}

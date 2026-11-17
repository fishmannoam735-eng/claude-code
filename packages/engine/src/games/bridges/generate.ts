import { createRng, type Rng } from '../../rng.js';
import type { Difficulty, DifficultyScore } from '../../types.js';
import { buildLayout, type Bridges, type Layout } from './grid.js';
import { countSolutions } from './solver.js';
import { humanSolve } from './techniques.js';

export interface BridgesPuzzle {
  seed: string;
  difficulty: Difficulty;
  n: number;
  layout: Layout;
  solution: Bridges;
  rating: DifficultyScore;
}

/** Board side and how many islands to aim for. */
export const SIZES: Record<Difficulty, { n: number; islands: [number, number] }> = {
  easy: { n: 7, islands: [9, 12] },
  normal: { n: 9, islands: [15, 19] },
  hard: { n: 10, islands: [20, 25] },
};

const DIRS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/**
 * Grows a connected set of islands with bridges already in place: start from
 * one island, then repeatedly walk from an existing island in a straight line
 * over open water and drop a new island at the end, laying the bridge as it
 * goes. Islands never touch side by side, and a new island never lands on a
 * bridge. A few extra bridges between islands that already see each other
 * make loops, so the answer isn't just a tree.
 */
export function grow(n: number, target: number, rng: Rng): { cells: number[]; needs: number[] } | null {
  const grid = new Int8Array(n * n); // 0 water, 1 island, 2 bridge
  const islands: number[] = [];
  const bridges: { a: number; b: number; path: number[]; v: number }[] = [];
  const free = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && grid[r * n + c] === 0;
  const touchesIsland = (r: number, c: number) =>
    DIRS.some(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && cc >= 0 && rr < n && cc < n && grid[rr * n + cc] === 1; });

  const start = (1 + rng.int(n - 2)) * n + 1 + rng.int(n - 2);
  grid[start] = 1;
  islands.push(start);

  let tries = 0;
  while (islands.length < target && tries++ < 4000) {
    const from = islands[rng.int(islands.length)]!;
    const [dr, dc] = DIRS[rng.int(4)]!;
    const r0 = Math.floor(from / n), c0 = from % n;
    const maxLen = Math.max(2, Math.min(n - 1, 2 + rng.int(Math.ceil(n / 2))));
    const len = 2 + rng.int(maxLen - 1);
    const path: number[] = [];
    let ok = true;
    for (let s = 1; s < len; s++) {
      const r = r0 + dr * s, c = c0 + dc * s;
      if (!free(r, c)) { ok = false; break; }
      path.push(r * n + c);
    }
    if (!ok) continue;
    const r = r0 + dr * len, c = c0 + dc * len;
    if (!free(r, c) || touchesIsland(r, c)) continue;
    // The first water cell next to `from` touching it is fine; the rest of the
    // path must not run alongside... any island is fine, bridges pass by.
    const cell = r * n + c;
    grid[cell] = 1;
    for (const p of path) grid[p] = 2;
    islands.push(cell);
    bridges.push({ a: from, b: cell, path, v: rng.next() < 0.38 ? 2 : 1 });
  }
  if (islands.length < target) return null;

  // Extra bridges between islands that see each other over open water.
  const layout = buildLayout(n, islands, islands.map(() => 0));
  const have = new Set(bridges.map((x) => `${Math.min(x.a, x.b)}-${Math.max(x.a, x.b)}`));
  for (const l of rng.shuffle(layout.links.slice())) {
    const a = layout.islands[l.a]!.cell, b = layout.islands[l.b]!.cell;
    if (have.has(`${Math.min(a, b)}-${Math.max(a, b)}`)) continue;
    if (l.cells.some((p) => grid[p] !== 0)) continue;
    if (rng.next() < 0.45) {
      for (const p of l.cells) grid[p] = 2;
      bridges.push({ a, b, path: l.cells, v: rng.next() < 0.3 ? 2 : 1 });
      have.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
    }
  }

  const need = new Map<number, number>(islands.map((c) => [c, 0]));
  for (const x of bridges) { need.set(x.a, need.get(x.a)! + x.v); need.set(x.b, need.get(x.b)! + x.v); }
  return { cells: islands, needs: islands.map((c) => need.get(c)!) };
}

const BAND: Record<Difficulty, (level: number, whatIfs: number) => boolean> = {
  easy: (level) => level <= 1,
  normal: (level) => level === 2,
  hard: (level, whatIfs) => level === 3 && whatIfs >= 1,
};

export function rateLayout(layout: Layout): DifficultyScore & { level: number; solved: boolean; whatIfs: number } {
  const r = humanSolve(layout);
  const names = ['counting', 'counting', 'keeping islands joined', 'what-if'];
  return {
    score: Math.min(1, r.level / 3 + r.whatIfs * 0.03),
    hardest: names[r.level] ?? 'counting',
    detail: { islands: layout.islands.length, whatIfs: r.whatIfs, steps: r.steps },
    level: r.level, solved: r.solved, whatIfs: r.whatIfs,
  };
}

export function generateBridges(seed: string, difficulty: Difficulty): BridgesPuzzle {
  const rng = createRng(seed);
  const { n, islands } = SIZES[difficulty];
  let fallback: { layout: Layout; solution: Bridges; rating: DifficultyScore } | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const target = islands[0] + rng.int(islands[1] - islands[0] + 1);
    const grown = grow(n, target, rng);
    if (!grown) continue;
    const layout = buildLayout(n, grown.cells, grown.needs);
    const { count, solution } = countSolutions(layout, 2);
    if (count !== 1 || !solution) continue;
    const rating = rateLayout(layout);
    if (!rating.solved) continue;
    const { level, solved: _s, whatIfs, ...score } = rating;
    if (BAND[difficulty](level, whatIfs)) return { seed, difficulty, n, layout, solution, rating: score };
    // Keep the closest board in case the band is never hit.
    if (!fallback || (difficulty === 'easy' ? level < (fallback.rating.detail.level ?? 9) : level > (fallback.rating.detail.level ?? -1))) {
      fallback = { layout, solution, rating: { ...score, detail: { ...score.detail, level } } };
    }
  }
  if (!fallback) throw new Error(`could not build a bridges board for ${seed}`);
  return { seed, difficulty, n, ...fallback };
}

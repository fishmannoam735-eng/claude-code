import { describe, expect, it } from 'vitest';
import { thread, makeSeed, type Difficulty } from '../src/index.js';
import {
  SIDES, areAdjacent, countPaths, openNeighbours, pathIsValid, randomPath,
  reduceWaypoints, wallKey, wallsOffPath,
} from '../src/games/thread/index.js';
import { createRng } from '../src/rng.js';

/** Independent check that a path really is a Hamiltonian path on the open graph. */
function walkIsLegal(path: number[], n: number, walls: Set<string>): string | null {
  if (path.length !== n * n) return `length ${path.length}, expected ${n * n}`;
  if (new Set(path).size !== path.length) return 'a cell is visited twice';
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1]!, b = path[k]!;
    if (!areAdjacent(a, b, n)) return `step ${k} is not to a neighbour`;
    if (walls.has(wallKey(a, b))) return `step ${k} crosses a wall`;
  }
  return null;
}

describe('randomPath', () => {
  it('covers every cell exactly once, moving only to neighbours', () => {
    for (const n of [5, 6, 7]) {
      for (let i = 0; i < 12; i++) {
        const path = randomPath(n, createRng(`rp:${n}:${i}`));
        expect(walkIsLegal(path, n, new Set())).toBeNull();
      }
    }
  });

  it('actually randomises rather than returning the snake it starts from', () => {
    const seen = new Set(
      Array.from({ length: 20 }, (_, i) => randomPath(6, createRng(`shuffle${i}`)).join(',')),
    );
    expect(seen.size).toBeGreaterThan(15);
  });
});

describe('wallsOffPath', () => {
  it('never walls an edge the path uses', () => {
    for (let i = 0; i < 15; i++) {
      const r = createRng(`w${i}`);
      const path = randomPath(6, r);
      const walls = wallsOffPath(6, path, r, 8);
      expect(walls.size).toBeLessThanOrEqual(8);
      expect(walkIsLegal(path, 6, walls)).toBeNull();
    }
  });
});

describe('countPaths', () => {
  it('finds the single path when every cell is numbered', () => {
    const r = createRng('full');
    const path = randomPath(5, r);
    const open = openNeighbours(5, new Set());
    const { count, first } = countPaths(5, open, path, 2);
    expect(count).toBe(1);
    expect(first).toEqual(path);
  });

  it('finds more than one when only the ends are pinned on an open board', () => {
    const r = createRng('loose');
    const path = randomPath(6, r);
    const open = openNeighbours(6, new Set());
    expect(countPaths(6, open, [path[0]!, path[35]!], 2).count).toBe(2);
  });

  it('finds none when a wall cuts a corner cell off entirely', () => {
    const n = 5;
    const walls = new Set([wallKey(0, 1), wallKey(0, n)]);   // isolate cell 0
    const open = openNeighbours(n, walls);
    expect(countPaths(n, open, [12, 24], 2).count).toBe(0);
  });

  it('respects waypoint order', () => {
    const r = createRng('order');
    const path = randomPath(5, r);
    const open = openNeighbours(5, new Set());

    // With a sparse set, reordering proves nothing: some *other* Hamiltonian
    // path may well meet the numbers in the new order, and the solver is right
    // to find it. Number every cell instead, so the order fixes the path
    // completely, and then swap two steps that are not neighbours.
    expect(countPaths(5, open, path, 2).count).toBe(1);

    const swapped = path.slice();
    [swapped[5], swapped[17]] = [swapped[17]!, swapped[5]!];
    expect(countPaths(5, open, swapped, 2).count).toBe(0);
  });
});

describe('reduceWaypoints', () => {
  it('keeps the path unique and always keeps both ends', () => {
    for (let i = 0; i < 10; i++) {
      const r = createRng(`red${i}`);
      const solution = randomPath(6, r);
      const walls = wallsOffPath(6, solution, r, 4);
      const open = openNeighbours(6, walls);
      const wps = reduceWaypoints(6, open, solution, r);

      expect(wps.length).toBeGreaterThanOrEqual(2);
      expect(wps[0]).toBe(solution[0]);
      expect(wps[wps.length - 1]).toBe(solution[solution.length - 1]);
      expect(countPaths(6, open, wps, 2).count).toBe(1);
      // Waypoints stay in the order the path meets them.
      const marks = wps.map((c) => solution.indexOf(c));
      expect(marks).toEqual([...marks].sort((a, b) => a - b));
    }
  });
});

describe('generate', () => {
  it('is deterministic and varies by date and difficulty', () => {
    const a = thread.generate('thread:2026-09-20:normal');
    const b = thread.generate('thread:2026-09-20:normal');
    expect(a.waypoints).toEqual(b.waypoints);
    expect(a.solution).toEqual(b.solution);
    expect(a.solution.join(',')).not.toBe(thread.generate('thread:2026-09-21:normal').solution.join(','));
    expect(a.n).not.toBe(thread.generate('thread:2026-09-20:hard').n);
  });

  it('rejects a seed for another game', () => {
    expect(() => thread.generate('nine:2026-09-20:easy')).toThrow();
  });

  for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
    it(`every ${d} puzzle over 20 seeds is unique, legal and validates`, () => {
      const times: number[] = [];
      for (let day = 1; day <= 20; day++) {
        const seed = makeSeed('thread', `2027-01-${String(day).padStart(2, '0')}`, d);
        const t0 = performance.now();
        const p = thread.generate(seed);
        times.push(performance.now() - t0);

        expect(p.n).toBe(SIDES[d]);
        expect(walkIsLegal(p.solution, p.n, new Set(p.walls))).toBeNull();
        expect(thread.solve(p)).toHaveLength(1);
        expect(thread.validate(p, p.solution)).toEqual({ ok: true });

        // Numbers sit on the path, in order, ends included.
        const marks = p.waypoints.map((c) => p.solution.indexOf(c));
        expect(marks[0]).toBe(0);
        expect(marks[marks.length - 1]).toBe(p.n * p.n - 1);
        expect(marks).toEqual([...marks].sort((a, b) => a - b));
      }
      console.log(`[thread:${d}] max ${Math.max(...times).toFixed(1)}ms`);
    });
  }

  it('rejects short, long, wall-crossing and out-of-order attempts', () => {
    const p = thread.generate('thread:2026-09-20:normal');
    const cells = p.n * p.n;

    expect(thread.validate(p, p.solution.slice(0, cells - 1))).toEqual({ ok: false, reason: 'incomplete' });
    expect(thread.validate(p, [...p.solution, 0])).toEqual({ ok: false, reason: 'invalid' });

    const reversed = p.solution.slice().reverse();
    expect(thread.validate(p, reversed).ok).toBe(false);   // ends up at number 1, not the last

    const swapped = p.solution.slice();
    [swapped[3], swapped[7]] = [swapped[7]!, swapped[3]!];
    expect(thread.validate(p, swapped).ok).toBe(false);
  });
});

describe('pathIsValid', () => {
  it('rejects a path that skips a waypoint', () => {
    const p = thread.generate('thread:2026-09-20:easy');
    const open = openNeighbours(p.n, new Set(p.walls));
    expect(pathIsValid(p.solution, p.n, open, p.waypoints)).toBe(true);
    expect(pathIsValid(p.solution, p.n, open, [...p.waypoints, -1])).toBe(false);
  });
});

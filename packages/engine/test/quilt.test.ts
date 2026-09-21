import { describe, expect, it } from 'vitest';
import { quilt, makeSeed, type Difficulty } from '../src/index.js';
import {
  BEYOND, SIDES, boundsOf, brokenClues, candidatesFor, countTilings, fitsClue,
  humanSolve, isSolved, ownerFromRects, randomTiling, rectCells, shapeOf, weakenClues,
  type Clue, type Rect,
} from '../src/games/quilt/index.js';
import { createRng } from '../src/rng.js';

/** Independent check that a set of rectangles really tiles an n×n board. */
function tilingFault(rects: readonly Rect[], n: number): string | null {
  const seen = new Array<number>(n * n).fill(0);
  for (const rect of rects) {
    if (rect.w < 1 || rect.h < 1) return 'a rectangle has no area';
    if (rect.r < 0 || rect.c < 0 || rect.r + rect.h > n || rect.c + rect.w > n) return 'a rectangle leaves the board';
    for (const i of rectCells(rect, n)) seen[i]!++;
  }
  const bad = seen.findIndex((v) => v !== 1);
  return bad < 0 ? null : `cell ${bad} is covered ${seen[bad]} times`;
}

describe('grid vocabulary', () => {
  it('names shapes by proportion, not by size', () => {
    expect(shapeOf(3, 3)).toBe('square');
    expect(shapeOf(1, 1)).toBe('square');
    expect(shapeOf(4, 2)).toBe('wide');
    expect(shapeOf(2, 4)).toBe('tall');
  });

  it('reads a clue as exactly what it says and no more', () => {
    const rect: Rect = { r: 0, c: 0, w: 3, h: 1 };
    expect(fitsClue({ cell: 0, kind: 'area', area: 3 }, rect)).toBe(true);
    expect(fitsClue({ cell: 0, kind: 'area', area: 4 }, rect)).toBe(false);
    expect(fitsClue({ cell: 0, kind: 'shape', shape: 'wide' }, rect)).toBe(true);
    expect(fitsClue({ cell: 0, kind: 'shape', shape: 'tall' }, rect)).toBe(false);
    expect(fitsClue({ cell: 0, kind: 'any' }, rect)).toBe(true);
  });

  it('tells a rectangle from a cell set that merely fits inside one', () => {
    expect(boundsOf([0, 1, 4, 5], 4)).toEqual({ rect: { r: 0, c: 0, w: 2, h: 2 }, exact: true });
    expect(boundsOf([0, 1, 4], 4)!.exact).toBe(false);   // an L, not a rectangle
    expect(boundsOf([], 4)).toBeNull();
  });
});

describe('candidatesFor', () => {
  it('offers only rectangles that hold this clue and no other', () => {
    const n = 4;
    const clues: Clue[] = [
      { cell: 0, kind: 'any' },
      { cell: 15, kind: 'any' },
    ];
    const cands = candidatesFor(n, clues, 0);
    expect(cands.length).toBeGreaterThan(0);
    for (const rect of cands) {
      const cells = rectCells(rect, n);
      expect(cells).toContain(0);
      expect(cells).not.toContain(15);
    }
    // The whole board would swallow the other clue, so it must not be offered.
    expect(cands.some((r) => r.w === n && r.h === n)).toBe(false);
  });

  it('honours the clue it belongs to', () => {
    const clues: Clue[] = [{ cell: 0, kind: 'area', area: 3 }];
    expect(candidatesFor(4, clues, 0).every((r) => r.w * r.h === 3)).toBe(true);
  });
});

describe('randomTiling', () => {
  it('covers every cell exactly once and never overruns the board', () => {
    for (const n of [6, 7, 8]) {
      for (let i = 0; i < 15; i++) {
        const rects = randomTiling(n, createRng(`t:${n}:${i}`));
        expect(tilingFault(rects, n)).toBeNull();
        expect(rects.every((r) => r.w <= 4 && r.h <= 4)).toBe(true);
      }
    }
  });

  it('produces different quilts from different seeds', () => {
    const seen = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(randomTiling(7, createRng(`vary${i}`)))),
    );
    expect(seen.size).toBeGreaterThan(15);
  });
});

describe('countTilings', () => {
  /**
   * Two clues in opposite corners of a 2×2 can split it down the middle or
   * across the middle — and saying "area 2" twice does not choose between
   * them. Clue *values* are not what makes a puzzle; clue positions are.
   */
  it('finds both ways to halve a 2×2, even with areas given', () => {
    const anyClues: Clue[] = [{ cell: 0, kind: 'any' }, { cell: 3, kind: 'any' }];
    expect(countTilings(2, anyClues, 3).count).toBe(2);

    const areaClues: Clue[] = [
      { cell: 0, kind: 'area', area: 2 },
      { cell: 3, kind: 'area', area: 2 },
    ];
    expect(countTilings(2, areaClues, 3).count).toBe(2);
  });

  it('narrows to one once the shapes are pinned', () => {
    const clues: Clue[] = [
      { cell: 0, kind: 'shape', shape: 'wide' },
      { cell: 3, kind: 'shape', shape: 'wide' },
    ];
    expect(countTilings(2, clues, 3).count).toBe(1);
  });

  it('finds none when the clues cannot cover the board', () => {
    const clues: Clue[] = [
      { cell: 0, kind: 'area', area: 1 },
      { cell: 3, kind: 'area', area: 1 },
    ];
    expect(countTilings(2, clues, 2).count).toBe(0);
  });
});

describe('weakenClues', () => {
  it('only ever weakens, and never at the cost of uniqueness', () => {
    const rank = { area: 0, shape: 1, any: 2 };
    for (let i = 0; i < 10; i++) {
      const n = 6;
      const rng = createRng(`w${i}`);
      const rects = randomTiling(n, rng);
      const clues: Clue[] = rects.map((rect) => ({
        cell: (rect.r + rng.int(rect.h)) * n + rect.c + rng.int(rect.w),
        kind: 'area', area: rect.w * rect.h,
      }));
      if (countTilings(n, clues, 2).count !== 1) continue;

      const out = weakenClues(n, clues, rects, rng, 99);
      expect(out).toHaveLength(clues.length);
      out.forEach((c, k) => {
        expect(c.cell).toBe(clues[k]!.cell);
        expect(rank[c.kind]).toBeGreaterThanOrEqual(rank[clues[k]!.kind]);
      });
      expect(countTilings(n, out, 2).count).toBe(1);
    }
  });

  it('respects the no-blanks floor', () => {
    const n = 6;
    const rng = createRng('floor');
    const rects = randomTiling(n, rng);
    const clues: Clue[] = rects.map((rect) => ({
      cell: rect.r * n + rect.c, kind: 'area', area: rect.w * rect.h,
    }));
    const out = weakenClues(n, clues, rects, rng, 99, false);
    expect(out.some((c) => c.kind === 'any')).toBe(false);
  });
});

describe('brokenClues', () => {
  const n = 4;
  const clues: Clue[] = [
    { cell: 0, kind: 'area', area: 4 },
    { cell: 15, kind: 'shape', shape: 'wide' },
  ];

  it('flags nothing on an empty board', () => {
    expect(brokenClues(new Array<number>(16).fill(-1), clues, n)).toEqual([false, false]);
  });

  it('leaves a patch that is merely unfinished alone', () => {
    const owner = new Array<number>(16).fill(-1);
    owner[0] = 0; owner[1] = 0;                     // two of the four
    expect(brokenClues(owner, clues, n)[0]).toBe(false);
  });

  it('flags an overshot area, a non-rectangle, and a wrong shape', () => {
    const over = new Array<number>(16).fill(-1);
    for (const i of [0, 1, 2, 3, 4]) over[i] = 0;   // five cells for a 4
    expect(brokenClues(over, clues, n)[0]).toBe(true);

    const ell = new Array<number>(16).fill(-1);
    for (const i of [0, 1, 4]) ell[i] = 0;
    expect(brokenClues(ell, clues, n)[0]).toBe(true);

    const tall = new Array<number>(16).fill(-1);
    for (const i of [7, 11, 15]) tall[i] = 1;       // tall, but the clue says wide
    expect(brokenClues(tall, clues, n)[1]).toBe(true);
  });
});

describe('humanSolve', () => {
  it('solves a board that is nothing but forced rectangles at rung one', () => {
    const clues: Clue[] = [{ cell: 0, kind: 'area', area: 4 }];
    const run = humanSolve(2, clues);
    expect(run.solved).toBe(true);
    expect(run.hardest).toBe(1);
  });

  it('reports BEYOND rather than claiming a solve it did not reach', () => {
    // Two corner clues that say nothing leave two legal tilings; no amount of
    // deduction picks one, and the solver must say so instead of guessing.
    const clues: Clue[] = [{ cell: 0, kind: 'any' }, { cell: 3, kind: 'any' }];
    const run = humanSolve(2, clues);
    expect(run.solved).toBe(false);
    expect(run.hardest).toBe(BEYOND);
  });
});

describe('generate', () => {
  it('is deterministic and varies by date and difficulty', () => {
    const a = quilt.generate('quilt:2026-09-20:normal');
    const b = quilt.generate('quilt:2026-09-20:normal');
    expect(a.clues).toEqual(b.clues);
    expect(a.solution).toEqual(b.solution);
    expect(a.solution).not.toEqual(quilt.generate('quilt:2026-09-21:normal').solution);
    expect(a.n).not.toBe(quilt.generate('quilt:2026-09-20:hard').n);
  });

  it('rejects a seed for another game', () => {
    expect(() => quilt.generate('nine:2026-09-20:easy')).toThrow();
  });

  for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
    it(`every ${d} puzzle over 20 seeds is unique, legal and validates`, () => {
      const times: number[] = [];
      for (let day = 1; day <= 20; day++) {
        const seed = makeSeed('quilt', `2027-02-${String(day).padStart(2, '0')}`, d);
        const t0 = performance.now();
        const p = quilt.generate(seed);
        times.push(performance.now() - t0);

        expect(p.n).toBe(SIDES[d]);
        expect(isSolved(p.solution, p.clues, p.n)).toBe(true);
        expect(quilt.validate(p, p.solution)).toEqual({ ok: true });

        // Exactly one tiling, and it is the one the generator built.
        const sols = quilt.solve(p);
        expect(sols).toHaveLength(1);
        expect(sols[0]).toEqual(p.solution);

        // Every clue sits inside its own patch, one clue per patch.
        p.clues.forEach((clue, k) => expect(p.solution[clue.cell]).toBe(k));

        // The rating is a true ceiling: the rungs above it were never used.
        const lvl = p.rating.detail['hardestLevel']!;
        if (lvl < BEYOND) {
          const rungs = [true, true, true, true, true].map((_, r) => r <= lvl);
          expect(humanSolve(p.n, p.clues, { rungs }).solved).toBe(true);
        }
      }
      console.log(`[quilt:${d}] max ${Math.max(...times).toFixed(1)}ms`);
    });
  }

  it(`easy never strips a clue to nothing, hard does`, () => {
    const easy = Array.from({ length: 12 }, (_, i) => quilt.generate(makeSeed('quilt', `blank${i}`, 'easy')));
    expect(easy.every((p) => p.clues.every((c) => c.kind !== 'any'))).toBe(true);

    const hard = Array.from({ length: 12 }, (_, i) => quilt.generate(makeSeed('quilt', `blank${i}`, 'hard')));
    expect(hard.some((p) => p.clues.some((c) => c.kind === 'any'))).toBe(true);
  });
});

describe('validate', () => {
  it('separates an unfinished board from a wrong one', () => {
    const p = quilt.generate('quilt:2026-09-20:easy');
    const cells = p.n * p.n;

    expect(quilt.validate(p, new Array<number>(cells).fill(-1))).toEqual({ ok: false, reason: 'incomplete' });
    expect(quilt.validate(p, p.solution.slice(0, cells - 1))).toEqual({ ok: false, reason: 'invalid' });
    expect(quilt.validate(p, p.solution.map(() => p.clues.length))).toEqual({ ok: false, reason: 'invalid' });

    // Hand every cell to the first clue: complete, and completely wrong.
    expect(quilt.validate(p, p.solution.map(() => 0))).toEqual({ ok: false, reason: 'wrong' });
  });

  it('rejects a tiling whose patches are the right cells under the wrong clues', () => {
    const p = quilt.generate('quilt:2026-09-20:easy');
    if (p.clues.length < 2) return;
    const swapped = p.solution.map((k) => (k === 0 ? 1 : k === 1 ? 0 : k));
    expect(quilt.validate(p, swapped).ok).toBe(false);
  });
});

describe('ownerFromRects', () => {
  it('round-trips a tiling through ownership and back to solved', () => {
    const n = 6;
    const rng = createRng('round');
    const rects = randomTiling(n, rng);
    const clues: Clue[] = rects.map((rect) => ({
      cell: rect.r * n + rect.c, kind: 'area', area: rect.w * rect.h,
    }));
    expect(isSolved(ownerFromRects(rects, n), clues, n)).toBe(true);
  });
});

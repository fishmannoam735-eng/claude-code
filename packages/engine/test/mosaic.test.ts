import { describe, expect, it } from 'vitest';
import { makeSeed, mosaic, type Difficulty } from '../src/index.js';
import { PICTURES, SIDES, build, logicSolve, nextMosaicHint, solveLine, slide, CROSSED, FILLED } from '../src/games/mosaic/index.js';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

describe('mosaic pictures', () => {
  it('every picture is square, the right size, and reached by row-and-column logic alone', () => {
    for (const d of DIFFS) {
      for (const pic of PICTURES[d]) {
        expect(pic.art.length, pic.id).toBe(SIDES[d]);
        for (const row of pic.art) expect(row.length, pic.id).toBe(SIDES[d]);
        for (const ch of pic.art.join('').replace(/\./g, '')) expect(pic.ink[ch], `${pic.id} ${ch}`).toBeTruthy();
        for (const mirror of [false, true]) {
          const p = build('mosaic:x:easy', d, pic, mirror);
          const r = logicSolve(p);
          expect(r.solved, pic.id).toBe(true);
          expect(r.grid.map((v) => (v === 1 ? 1 : 0))).toEqual(p.solution);
        }
      }
    }
  });

  it('daily boards go through every picture before one repeats', () => {
    for (const d of DIFFS) {
      const n = PICTURES[d].length;
      const seen = new Set<string>();
      for (let k = 0; k < n; k++) {
        const day = new Date(Date.UTC(2026, 0, 1) + k * 86_400_000).toISOString().slice(0, 10);
        seen.add(mosaic.generate(makeSeed('mosaic', day, d)).picture);
      }
      expect(seen.size).toBe(n);
    }
  });

  it('is the same board for the same seed and accepts only the picture', () => {
    const a = mosaic.generate('mosaic:2026-11-17:normal');
    const b = mosaic.generate('mosaic:2026-11-17:normal');
    expect(a).toEqual(b);
    expect(mosaic.validate(a, a.solution).ok).toBe(true);
    expect(mosaic.validate(a, a.solution.map(() => 0)).ok).toBe(false);
    const off = a.solution.slice(); off[off.indexOf(1)] = 0; off[off.indexOf(0)] = 1;
    expect(mosaic.validate(a, off).ok).toBe(false);
    expect(mosaic.solve(a)).toEqual([a.solution]);
  });
});

describe('mosaic line logic', () => {
  it('slides blocks to find the overlap', () => {
    // 6 in 8: the middle four are filled whichever way it slides.
    const s = slide([6], new Array(8).fill(-1))!;
    expect(s.fill).toEqual([2, 3, 4, 5]);
    expect(solveLine([6], new Array(8).fill(-1))).toEqual([-1, -1, 1, 1, 1, 1, -1, -1]);
    // 3 1 2 in 8 fits exactly one way.
    expect(solveLine([3, 1, 2], new Array(8).fill(-1))).toEqual([1, 1, 1, 0, 1, 0, 1, 1]);
    expect(solveLine([2], [1, 1, 1, -1])).toBeNull();
  });
});

describe('mosaic hints', () => {
  it('walks every board to its picture, one correct hint at a time', () => {
    let hints = 0, reveals = 0, deep = 0, longest = 0;
    for (const d of DIFFS) {
      for (let k = 0; k < 20; k++) {
        const p = mosaic.generate(makeSeed('mosaic', `2026-0${1 + (k % 9)}-${String(1 + k).padStart(2, '0')}`, d));
        const board = p.solution.map(() => 0);
        for (let guard = 0; guard < 400; guard++) {
          const h = nextMosaicHint(p, board, p.solution);
          if (!h) break;
          hints++;
          if (h.revealed) reveals++;
          if (h.steps.some((s) => s.text.startsWith('Way') || s.text.startsWith('Suppose'))) deep++;
          longest = Math.max(longest, h.steps.length);
          expect(h.wrong).toBe(false);
          expect(h.action.length).toBeGreaterThan(0);
          for (const a of h.action) {
            expect(a.value === FILLED ? 1 : 0).toBe(p.solution[a.cell]);
            board[a.cell] = a.value;
          }
        }
        expect(mosaic.validate(p, board).ok).toBe(true);
      }
    }
    console.log('mosaic hints', hints, 'reveals', reveals, 'deep', deep, 'longest', longest);
    expect(reveals).toBe(0);
  });

  it('flags a wrong square first', () => {
    const p = mosaic.generate('mosaic:2026-11-17:easy');
    const board = p.solution.map(() => 0);
    const bad = p.solution.indexOf(0);
    board[bad] = FILLED;
    const h = nextMosaicHint(p, board, p.solution)!;
    expect(h.wrong).toBe(true);
    expect(h.action).toEqual([{ cell: bad, value: 0 }]);
    board[bad] = 0;
    const good = p.solution.indexOf(1);
    board[good] = CROSSED;
    expect(nextMosaicHint(p, board, p.solution)!.action).toEqual([{ cell: good, value: 0 }]);
  });
});

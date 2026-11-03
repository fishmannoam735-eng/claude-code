import { describe, expect, it } from 'vitest';
import { makeSeed, nine, type Difficulty } from '../src/index.js';
import { candidates, nextHint } from '../src/games/nine/index.js';

describe('nine hints', () => {
  it('walks every puzzle to its solution, one correct hint at a time', () => {
    for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (let day = 1; day <= 12; day++) {
        const p = nine.generate(makeSeed('nine', `2026-10-${String(day).padStart(2, '0')}`, d));
        const g = p.givens.slice();
        let revealed = 0;
        for (let k = 0; k < 81; k++) {
          const h = nextHint(g, p.solution);
          if (!h) break;
          expect(g[h.cell]).toBe(0);
          expect(h.digit).toBe(p.solution[h.cell]);
          expect(h.focus).toContain(h.cell);
          expect(h.steps.length).toBeGreaterThan(0);
          if (h.revealed) revealed++;
          g[h.cell] = h.digit;
        }
        expect(g).toEqual(p.solution);
        if (d !== 'hard') expect(revealed).toBe(0);
      }
    }
  });

  it('lists only the numbers a cell can still take', () => {
    const p = nine.generate(makeSeed('nine', '2026-10-01', 'easy'));
    const c = candidates(p.givens);
    for (let i = 0; i < 81; i++) {
      if (p.givens[i]) expect(c[i]).toBe(0);
      else expect(c[i]! & (1 << p.solution[i]!)).not.toBe(0);
    }
  });
});

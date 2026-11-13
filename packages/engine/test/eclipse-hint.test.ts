import { describe, expect, it } from 'vitest';
import { eclipse, makeSeed, type Difficulty } from '../src/index.js';
import { nextEclipseHint, SUN, MOON } from '../src/games/eclipse/index.js';

describe('eclipse hints', () => {
  it('walks every puzzle to its solution, one correct hint at a time', () => {
    let hints = 0, reveals = 0;
    for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (let day = 1; day <= 20; day++) {
        const p = eclipse.generate(makeSeed('eclipse', `2026-07-${String(day).padStart(2, '0')}`, d));
        const g = p.givens.slice();
        for (let guard = 0; guard < 50; guard++) {
          const h = nextEclipseHint(p.givens, g, p.edges, p.solution);
          if (!h) break;
          hints++; if (h.revealed) reveals++;
          expect(h.wrong).toBe(false);
          if (h.action.kind !== 'place') throw new Error('unexpected clear');
          expect(g[h.action.cell]).toBe(0);
          expect(h.action.value).toBe(p.solution[h.action.cell]);
          g[h.action.cell] = h.action.value;
        }
        expect(eclipse.validate(p, g).ok).toBe(true);
      }
    }
    console.log('eclipse hints', hints, 'reveals', reveals);
    expect(reveals).toBe(0);
  });

  it('clears a wrong entry first', () => {
    const p = eclipse.generate(makeSeed('eclipse', '2026-07-01', 'normal'));
    const g = p.givens.slice();
    const i = g.findIndex((v) => v === 0);
    g[i] = p.solution[i] === SUN ? MOON : SUN;
    const h = nextEclipseHint(p.givens, g, p.edges, p.solution)!;
    expect(h.wrong).toBe(true);
    expect(h.action).toEqual({ kind: 'clear', cell: i });
  });
});

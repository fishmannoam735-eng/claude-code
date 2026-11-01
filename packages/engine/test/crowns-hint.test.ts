import { describe, expect, it } from 'vitest';
import { crowns, makeSeed, type Difficulty } from '../src/index.js';
import { CROWN, EMPTY, MARK, nextCrownsHint } from '../src/games/crowns/index.js';

describe('crowns hints', () => {
  it('walks every puzzle to its solution, one correct hint at a time', () => {
    let hints = 0, reveals = 0, maxRows = 0;
    for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (let day = 1; day <= 10; day++) {
        const p = crowns.generate(makeSeed('crowns', `2026-03-${String(day).padStart(2, '0')}`, d));
        const g = new Array<number>(64).fill(EMPTY);
        for (let guard = 0; guard < 300; guard++) {
          const h = nextCrownsHint(g, p.regions, p.solution);
          if (!h) break;
          hints++; if (h.revealed) reveals++;
          maxRows = Math.max(maxRows, h.steps.length);
          expect(h.steps.length).toBeGreaterThan(0);
          expect(h.wrong).toBe(false);
          if (h.action.kind === 'crown') { expect(p.solution[h.action.cell]).toBe(CROWN); g[h.action.cell] = CROWN; }
          else if (h.action.kind === 'mark') {
            expect(h.action.cells.length).toBeGreaterThan(0);
            for (const i of h.action.cells) { expect(p.solution[i]).not.toBe(CROWN); expect(g[i]).toBe(EMPTY); g[i] = MARK; }
          } else throw new Error('unexpected clear');
        }
        expect(crowns.validate(p, g).ok).toBe(true);
      }
    }
    console.log('crowns hints', hints, 'reveals', reveals, 'longest', maxRows);
    expect(reveals).toBe(0);
  });

  it('takes a wrong crown off first', () => {
    const p = crowns.generate(makeSeed('crowns', '2026-03-01', 'normal'));
    const g = new Array<number>(64).fill(EMPTY);
    const wrong = p.solution.findIndex((v) => v !== CROWN);
    g[wrong] = CROWN;
    const h = nextCrownsHint(g, p.regions, p.solution)!;
    expect(h.wrong).toBe(true);
    expect(h.action).toEqual({ kind: 'clear', cells: [wrong] });
  });

  it('is not thrown by a wrong ✕ on a crown square', () => {
    const p = crowns.generate(makeSeed('crowns', '2026-03-02', 'hard'));
    const g = new Array<number>(64).fill(EMPTY);
    g[p.solution.indexOf(CROWN)] = MARK;
    for (let guard = 0; guard < 300; guard++) {
      const h = nextCrownsHint(g, p.regions, p.solution);
      if (!h) break;
      if (h.action.kind === 'crown') g[h.action.cell] = CROWN;
      else if (h.action.kind === 'mark') for (const i of h.action.cells) { expect(p.solution[i]).not.toBe(CROWN); g[i] = MARK; }
    }
    expect(crowns.validate(p, g).ok).toBe(true);
  });
});

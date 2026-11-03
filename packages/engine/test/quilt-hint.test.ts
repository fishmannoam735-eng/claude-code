import { describe, expect, it } from 'vitest';
import { makeSeed, quilt, type Difficulty } from '../src/index.js';
import { nextQuiltHint, rectCells } from '../src/games/quilt/index.js';

describe('quilt hints', () => {
  it('walks every puzzle to its solution, one correct patch at a time', () => {
    let hints = 0, reveals = 0, longest = 0;
    for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (let day = 1; day <= 12; day++) {
        const p = quilt.generate(makeSeed('quilt', `2026-06-${String(day).padStart(2, '0')}`, d));
        const owner = new Array<number>(p.n * p.n).fill(-1);
        for (let guard = 0; guard < 200; guard++) {
          const h = nextQuiltHint(p.n, p.clues, owner, p.solution);
          if (!h) break;
          hints++; if (h.revealed) reveals++;
          longest = Math.max(longest, h.steps.length);
          expect(h.wrong).toBe(false);
          expect(h.action.kind).toBe('place');
          if (h.action.kind === 'place') {
            for (const i of rectCells(h.action.rect, p.n)) { expect(p.solution[i]).toBe(h.action.clue); owner[i] = h.action.clue; }
          }
        }
        expect(quilt.validate(p, owner).ok).toBe(true);
      }
    }
    console.log('quilt hints', hints, 'reveals', reveals, 'longest', longest);
    expect(reveals / hints).toBeLessThan(0.02);
  });

  it('takes a wrong patch off first', () => {
    const p = quilt.generate(makeSeed('quilt', '2026-06-01', 'normal'));
    const owner = new Array<number>(p.n * p.n).fill(-1);
    // Give clue 0 a patch that is just its own cell plus a neighbour it doesn't own.
    const c = p.clues[0]!.cell;
    const nb = [c + 1, c - 1, c + p.n, c - p.n].find((x) => x >= 0 && x < p.n * p.n && p.solution[x] !== 0 && !p.clues.some((q) => q.cell === x))!;
    owner[c] = 0; owner[nb] = 0;
    const h = nextQuiltHint(p.n, p.clues, owner, p.solution)!;
    expect(h.wrong).toBe(true);
    expect(h.action).toEqual({ kind: 'clear', clue: 0 });
  });
});

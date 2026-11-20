import { describe, expect, it } from 'vitest';
import { makeSeed, thread, type Difficulty } from '../src/index.js';
import { nextThreadHint } from '../src/games/thread/index.js';

describe('thread hints', () => {
  it('walks every puzzle to its solution, one correct hint at a time', () => {
    let hints = 0, reveals = 0, longest = 0;
    for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (let day = 1; day <= 20; day++) {
        const p = thread.generate(makeSeed('thread', `2026-04-${String(day).padStart(2, '0')}`, d));
        let path = [p.waypoints[0]!];
        for (let guard = 0; guard < 100; guard++) {
          const h = nextThreadHint(path, p.n, p.walls, p.waypoints, p.solution);
          if (!h) break;
          hints++; if (h.revealed) reveals++;
          longest = Math.max(longest, h.steps.length);
          expect(h.wrong).toBe(false);
          expect(h.action.kind).toBe('extend');
          if (h.action.kind === 'extend') path = [...path, ...h.action.cells];
          expect(path).toEqual(p.solution.slice(0, path.length));
        }
        expect(thread.validate(p, path).ok).toBe(true);
      }
    }
    console.log('thread hints', hints, 'reveals', reveals, 'longest', longest);
    expect(reveals / hints).toBeLessThan(0.02);
  });

  it('backs a wrong line up to where it left the answer', () => {
    for (let day = 1; day <= 10; day++) {
      const p = thread.generate(makeSeed('thread', `2026-05-${String(day).padStart(2, '0')}`, 'normal'));
      // Walk the answer a few squares, then take the first wrong turn available.
      const open = thread.solve(p);
      expect(open.length).toBe(1);
      for (let k = 2; k < p.solution.length - 2; k++) {
        const prefix = p.solution.slice(0, k);
        const head = prefix[k - 1]!;
        const n = p.n;
        const nb = [head - n, head + n, head % n ? head - 1 : -1, head % n < n - 1 ? head + 1 : -1]
          .filter((x) => x >= 0 && x < n * n && !prefix.includes(x) && x !== p.solution[k] && !p.walls.includes(head < x ? `${head}-${x}` : `${x}-${head}`));
        if (!nb.length) continue;
        const h = nextThreadHint([...prefix, nb[0]!], n, p.walls, p.waypoints, p.solution)!;
        expect(h.wrong).toBe(true);
        expect(h.action).toEqual({ kind: 'backup', keep: k });
        break;
      }
    }
  });
});

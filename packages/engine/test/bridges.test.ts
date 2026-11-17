import { describe, expect, it } from 'vitest';
import { bridges, makeSeed, type Difficulty } from '../src/index.js';
import { isSolved, countSolutions, humanSolve, nextBridgesHint } from '../src/games/bridges/index.js';

const days = (k: number) => Array.from({ length: k }, (_, i) => `2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}`);

describe('bridges', () => {
  it('builds boards with exactly one answer, solvable by reasoning, in each band', () => {
    const SIDE: Record<Difficulty, number> = { easy: 7, normal: 9, hard: 10 };
    for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
      const levels: Record<number, number> = {};
      for (const day of days(30)) {
        const p = bridges.generate(makeSeed('bridges', day, d));
        expect(p.n).toBe(SIDE[d]);
        expect(isSolved(p.layout, p.solution)).toBe(true);
        expect(countSolutions(p.layout, 2).count).toBe(1);
        expect(bridges.validate(p, p.solution).ok).toBe(true);
        const h = humanSolve(p.layout);
        expect(h.solved).toBe(true);
        levels[h.level] = (levels[h.level] ?? 0) + 1;
        // islands never touch side by side
        const at = new Set(p.layout.islands.map((s) => s.cell));
        for (const s of p.layout.islands) {
          if (s.c + 1 < p.n) expect(at.has(s.cell + 1)).toBe(false);
          expect(at.has(s.cell + p.n)).toBe(false);
        }
      }
      console.log('bridges', d, 'levels', JSON.stringify(levels));
    }
  }, 60000);

  it('is the same board for the same seed', () => {
    const a = bridges.generate('bridges:2026-11-17:normal');
    const b = bridges.generate('bridges:2026-11-17:normal');
    expect(a.layout.islands).toEqual(b.layout.islands);
  });

  it('rejects an incomplete or crossing attempt', () => {
    const p = bridges.generate('bridges:2026-11-17:easy');
    expect(bridges.validate(p, p.solution.map(() => 0)).ok).toBe(false);
  });
});

describe('bridges hints', () => {
  it('walks every board to its answer, one correct hint at a time', () => {
    let hints = 0, reveals = 0, longest = 0;
    const samples: string[] = [];
    for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (const day of days(20)) {
        const p = bridges.generate(makeSeed('bridges', day, d));
        let b = p.solution.map(() => 0);
        for (let guard = 0; guard < 200; guard++) {
          const h = nextBridgesHint(p.layout, b, p.solution);
          if (!h) break;
          hints++; if (h.revealed) reveals++;
          longest = Math.max(longest, h.steps.length);
          expect(h.wrong).toBe(false);
          expect(h.action.length).toBeGreaterThan(0);
          for (const s of h.steps) expect(s.text.length).toBeGreaterThan(8);
          if (samples.length < 14 && h.steps.some((s) => s.text.startsWith('Suppose'))) samples.push(`[${d}] ` + h.steps.map((s) => s.text).join(' | '));
          b = b.slice();
          for (const a of h.action) { expect(a.count).toBeLessThanOrEqual(p.solution[a.link]!); expect(a.count).toBeGreaterThan(b[a.link]!); b[a.link] = a.count; }
        }
        expect(bridges.validate(p, b).ok).toBe(true);
      }
    }
    console.log('bridges hints', hints, 'reveals', reveals, 'longest', longest);
    console.log(samples.join('\n'));
    expect(reveals).toBe(0);
  }, 60000);

  it('points out a bridge that is not in the answer first', () => {
    const p = bridges.generate('bridges:2026-11-17:normal');
    const k = p.solution.findIndex((v, i) => v === 0 && p.layout.crosses[i]!.every((x) => p.solution[x] === 0));
    expect(k).toBeGreaterThanOrEqual(0);
    const b = p.solution.map(() => 0);
    b[k] = 1;
    const h = nextBridgesHint(p.layout, b, p.solution)!;
    expect(h.wrong).toBe(true);
    expect(h.action).toEqual([{ link: k, count: 0 }]);
  });
});

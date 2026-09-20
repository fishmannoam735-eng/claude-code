import { describe, expect, it } from 'vitest';
import { nine, makeSeed, type Difficulty } from '../src/index.js';
import { conflicts, parseGrid, countSolutions, humanSolve, fillGrid, BEYOND } from '../src/games/nine/index.js';
import { createRng } from '../src/rng.js';

const CLASSIC = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';

describe('solver', () => {
  it('finds the classic puzzle unique', () => {
    const { count, solution } = countSolutions(parseGrid(CLASSIC), 2);
    expect(count).toBe(1);
    expect(solution?.join('')).toBe('534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  });
  it('reports multiple solutions for an empty grid', () => {
    expect(countSolutions(new Array(81).fill(0), 2).count).toBe(2);
  });
  it('reports zero solutions for a contradictory grid', () => {
    const g = new Array(81).fill(0); g[0] = 5; g[1] = 5;
    expect(countSolutions(g, 2).count).toBe(0);
  });
});

describe('fill', () => {
  it('produces a valid, conflict-free full grid', () => {
    const g = fillGrid(createRng('fill'));
    expect(g.every((v) => v >= 1 && v <= 9)).toBe(true);
    expect(conflicts(g).some(Boolean)).toBe(false);
  });
});

describe('human solver', () => {
  it('solves the classic puzzle with singles only', () => {
    const run = humanSolve(parseGrid(CLASSIC));
    expect(run.solved).toBe(true);
    expect(run.hardest).toBeLessThanOrEqual(2);
  });
});

describe('generate', () => {
  it('is deterministic', () => {
    const a = nine.generate('nine:2026-09-20:normal');
    const b = nine.generate('nine:2026-09-20:normal');
    expect(a.givens).toEqual(b.givens);
    expect(a.solution).toEqual(b.solution);
  });

  it('differs across dates and difficulties', () => {
    const a = nine.generate('nine:2026-09-20:normal').givens.join('');
    const b = nine.generate('nine:2026-09-21:normal').givens.join('');
    const c = nine.generate('nine:2026-09-20:hard').givens.join('');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
    it(`every ${d} puzzle over 30 seeds is unique, in band, and validates`, () => {
      const times: number[] = [];
      for (let day = 1; day <= 30; day++) {
        const seed = makeSeed('nine', `2026-10-${String(day).padStart(2, '0')}`, d);
        const t0 = performance.now();
        const p = nine.generate(seed);
        times.push(performance.now() - t0);

        expect(nine.solve(p)).toHaveLength(1);
        expect(nine.validate(p, p.solution)).toEqual({ ok: true });

        const lvl = p.rating.detail['hardestLevel']!;
        if (d === 'easy') expect(lvl).toBeLessThanOrEqual(2);
        if (d === 'normal') { expect(lvl).toBeGreaterThanOrEqual(3); expect(lvl).toBeLessThanOrEqual(4); }
        if (d === 'hard') expect(lvl).toBe(BEYOND);

        // a wrong grid must not validate
        const bad = p.solution.slice(); const i = p.givens.findIndex((v) => v === 0);
        bad[i] = (bad[i]! % 9) + 1;
        expect(nine.validate(p, bad).ok).toBe(false);
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      console.log(`[nine:${d}] avg ${avg.toFixed(1)}ms  max ${max.toFixed(1)}ms`);
    });
  }

  it('rejects incomplete and tampered attempts', () => {
    const p = nine.generate('nine:2026-09-20:easy');
    expect(nine.validate(p, p.givens)).toEqual({ ok: false, reason: 'incomplete' });
    const tampered = p.solution.slice();
    const gi = p.givens.findIndex((v) => v !== 0);
    tampered[gi] = (tampered[gi]! % 9) + 1;
    expect(nine.validate(p, tampered)).toEqual({ ok: false, reason: 'invalid' });
  });
});

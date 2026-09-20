import { describe, expect, it } from 'vitest';
import { eclipse, makeSeed, type Difficulty } from '../src/index.js';
import {
  CELLS, HALF, LINES, MOON, SUN, carve, countSolutions, fillGrid, humanSolve,
  gridToString, isSolved, parseGrid, violations,
} from '../src/games/eclipse/index.js';
import { createRng } from '../src/rng.js';

function lineCounts(g: number[]): { ok: boolean; why: string } {
  for (const [k, line] of LINES.entries()) {
    let sun = 0, moon = 0;
    for (const i of line) { if (g[i] === SUN) sun++; else if (g[i] === MOON) moon++; }
    if (sun !== HALF || moon !== HALF) return { ok: false, why: `line ${k} has ${sun}/${moon}` };
    for (let j = 0; j + 2 < line.length; j++) {
      if (g[line[j]!] === g[line[j + 1]!] && g[line[j + 1]!] === g[line[j + 2]!]) {
        return { ok: false, why: `line ${k} has three in a row at ${j}` };
      }
    }
  }
  return { ok: true, why: '' };
}

describe('fill', () => {
  it('produces a grid obeying both line rules', () => {
    for (let i = 0; i < 25; i++) {
      const g = fillGrid(createRng(`fill${i}`));
      expect(g.every((v) => v === SUN || v === MOON)).toBe(true);
      expect(lineCounts(g)).toEqual({ ok: true, why: '' });
    }
  });
});

describe('solver', () => {
  it('finds a full valid grid unique with no edges needed', () => {
    const g = fillGrid(createRng('unique'));
    expect(countSolutions(g, [], 2).count).toBe(1);
  });

  it('reports many solutions for an empty board', () => {
    expect(countSolutions(new Array(CELLS).fill(0), [], 2).count).toBe(2);
  });

  it('reports zero for a board that already breaks a rule', () => {
    const g = new Array(CELLS).fill(0);
    g[0] = SUN; g[1] = SUN; g[2] = SUN;          // three in a row
    expect(countSolutions(g, [], 2).count).toBe(0);
  });

  it('honours edge badges', () => {
    const g = new Array(CELLS).fill(0);
    // A "different" badge between two cells we then force equal is unsatisfiable.
    g[0] = SUN; g[1] = SUN;
    expect(countSolutions(g, [{ a: 0, b: 1, same: false }], 2).count).toBe(0);
    expect(countSolutions(g, [{ a: 0, b: 1, same: true }], 2).count).toBeGreaterThan(0);
  });
});

describe('violations', () => {
  it('flags four of a symbol in one row', () => {
    const g = new Array(CELLS).fill(0);
    g[0] = g[1] = g[3] = g[4] = SUN;   // four suns in row 0, no three adjacent
    const bad = violations(g, []);
    expect(bad[0] && bad[1] && bad[3] && bad[4]).toBe(true);
  });

  it('flags three in a row and leaves an unfinished line alone', () => {
    const g = new Array(CELLS).fill(0);
    g[6] = g[7] = g[8] = MOON;
    const bad = violations(g, []);
    expect(bad[6] && bad[7] && bad[8]).toBe(true);
    expect(violations([SUN, MOON, ...new Array(CELLS - 2).fill(0)], []).some(Boolean)).toBe(false);
  });

  it('flags a broken edge badge on both cells', () => {
    const g = new Array(CELLS).fill(0);
    g[0] = SUN; g[1] = MOON;
    const bad = violations(g, [{ a: 0, b: 1, same: true }]);
    expect(bad[0] && bad[1]).toBe(true);
  });
});

describe('carve', () => {
  it('keeps the solution unique and respects the givens floor', () => {
    const r = createRng('carve');
    const sol = fillGrid(r);
    const { givens, edges } = carve(sol, r, 5, 12, false);
    expect(givens.filter((v) => v !== 0).length).toBeGreaterThanOrEqual(12);
    expect(countSolutions(givens, edges, 2).count).toBe(1);
  });
});

describe('generate', () => {
  it('is deterministic and varies by date and difficulty', () => {
    const a = eclipse.generate('eclipse:2026-09-20:normal');
    const b = eclipse.generate('eclipse:2026-09-20:normal');
    expect(a.givens).toEqual(b.givens);
    expect(a.edges).toEqual(b.edges);
    expect(a.givens.join('')).not.toBe(eclipse.generate('eclipse:2026-09-21:normal').givens.join(''));
    expect(a.givens.join('')).not.toBe(eclipse.generate('eclipse:2026-09-20:hard').givens.join(''));
  });

  it('rejects a seed for another game', () => {
    expect(() => eclipse.generate('nine:2026-09-20:easy')).toThrow();
  });

  for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
    it(`every ${d} puzzle over 30 seeds is unique, in band, and validates`, () => {
      const times: number[] = [];
      for (let day = 1; day <= 30; day++) {
        const seed = makeSeed('eclipse', `2026-11-${String(day).padStart(2, '0')}`, d);
        const t0 = performance.now();
        const p = eclipse.generate(seed);
        times.push(performance.now() - t0);

        expect(eclipse.solve(p)).toHaveLength(1);
        expect(eclipse.validate(p, p.solution)).toEqual({ ok: true });
        expect(isSolved(p.solution, p.edges)).toBe(true);
        expect(lineCounts(p.solution)).toEqual({ ok: true, why: '' });

        // Every given agrees with the solution it was carved from.
        for (let i = 0; i < CELLS; i++) {
          if (p.givens[i] !== 0) expect(p.givens[i]).toBe(p.solution[i]);
        }
        // Every edge badge states the truth about the solution.
        for (const e of p.edges) {
          expect(e.same).toBe(p.solution[e.a] === p.solution[e.b]);
        }

        const lvl = p.rating.detail['hardestLevel']!;
        if (d === 'easy') { expect(lvl).toBeLessThanOrEqual(3); }
        if (d === 'normal') { expect(lvl).toBeGreaterThanOrEqual(3); expect(lvl).toBeLessThanOrEqual(4); }
        if (d === 'hard') { expect(lvl).toBeGreaterThanOrEqual(4); }
      }
      console.log(`[eclipse:${d}] max ${Math.max(...times).toFixed(1)}ms`);
    });
  }

  it('easy leaves more scaffolding than hard', () => {
    const e = eclipse.generate('eclipse:2026-09-20:easy');
    const h = eclipse.generate('eclipse:2026-09-20:hard');
    const count = (g: number[]): number => g.filter((v) => v !== 0).length;
    expect(count(e.givens)).toBeGreaterThan(count(h.givens));
  });

  it('rejects incomplete, tampered and rule-breaking attempts', () => {
    const p = eclipse.generate('eclipse:2026-09-20:easy');
    expect(eclipse.validate(p, p.givens)).toEqual({ ok: false, reason: 'incomplete' });

    const tampered = p.solution.slice();
    const gi = p.givens.findIndex((v) => v !== 0);
    tampered[gi] = tampered[gi] === SUN ? MOON : SUN;
    expect(eclipse.validate(p, tampered)).toEqual({ ok: false, reason: 'invalid' });

    const wrong = p.solution.slice();
    const free = p.givens.findIndex((v) => v === 0);
    wrong[free] = wrong[free] === SUN ? MOON : SUN;
    expect(eclipse.validate(p, wrong)).toEqual({ ok: false, reason: 'wrong' });
  });
});

describe('human solver', () => {
  it('solves every easy and normal puzzle without guessing', () => {
    for (const d of ['easy', 'normal'] as Difficulty[]) {
      for (let i = 0; i < 10; i++) {
        const p = eclipse.generate(makeSeed('eclipse', `probe${i}`, d));
        const run = humanSolve(p.givens, p.edges);
        expect(run.solved).toBe(true);
        expect(run.grid).toEqual(p.solution);
      }
    }
  });
});

describe('parseGrid', () => {
  it('round-trips through the string form', () => {
    const g = fillGrid(createRng('rt'));
    expect(parseGrid(gridToString(g))).toEqual(g);
  });
});

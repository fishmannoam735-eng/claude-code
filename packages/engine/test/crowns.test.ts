import { describe, expect, it } from 'vitest';
import { crowns, makeSeed, type Difficulty } from '../src/index.js';
import {
  CELLS, CROWN, MARK, N, NEIGHBOURS, ORTHOGONAL, columnsByRow, countSolutions,
  crownsIn, findSolutions, growRegions, humanSolve, isSolved, placeCrowns,
  refineRegions, regionCells, violations,
} from '../src/games/crowns/index.js';
import { createRng } from '../src/rng.js';

/** Does this arrangement obey every rule? Checked independently of the engine. */
function rulesHold(cells: number[], regions: number[]): string | null {
  if (cells.length !== N) return `expected ${N} crowns, got ${cells.length}`;
  const rows = new Set(cells.map((i) => Math.floor(i / N)));
  const cols = new Set(cells.map((i) => i % N));
  const regs = new Set(cells.map((i) => regions[i]!));
  if (rows.size !== N) return 'two crowns share a row';
  if (cols.size !== N) return 'two crowns share a column';
  if (regs.size !== N) return 'two crowns share a region';
  for (const i of cells) {
    for (const j of NEIGHBOURS[i]!) if (cells.includes(j)) return `crowns touch at ${i}/${j}`;
  }
  return null;
}

function connected(cells: number[]): boolean {
  const inSet = new Set(cells);
  const seen = new Set([cells[0]!]);
  const stack = [cells[0]!];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of ORTHOGONAL[i]!) if (inSet.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
  }
  return seen.size === cells.length;
}

describe('placeCrowns', () => {
  it('always yields a legal arrangement', () => {
    for (let i = 0; i < 40; i++) {
      const cols = placeCrowns(createRng(`pc${i}`));
      const cells = cols.map((c, r) => r * N + c);
      const regions = cells.map(() => 0);
      // Region rule can't hold with one region, so check the rest directly.
      expect(new Set(cols).size).toBe(N);
      for (let r = 1; r < N; r++) expect(Math.abs(cols[r]! - cols[r - 1]!)).toBeGreaterThanOrEqual(2);
      expect(cells.length).toBe(N);
      void regions;
    }
  });
});

describe('growRegions', () => {
  it('covers the board with N connected regions, one crown each', () => {
    for (let i = 0; i < 20; i++) {
      const r = createRng(`gr${i}`);
      const cols = placeCrowns(r);
      const regions = growRegions(r, cols);
      expect(regions).toHaveLength(CELLS);
      expect(regions.every((g) => g >= 0 && g < N)).toBe(true);

      const cells = regionCells(regions);
      expect(cells).toHaveLength(N);
      for (const group of cells) {
        expect(group.length).toBeGreaterThan(0);
        expect(connected(group)).toBe(true);
      }
      // Each intended crown sits in its own region.
      const owned = cols.map((c, row) => regions[row * N + c]!);
      expect(new Set(owned).size).toBe(N);
    }
  });
});

describe('refineRegions', () => {
  it('turns a multi-solution board into a unique one, keeping regions connected', () => {
    let refined = 0;
    for (let i = 0; i < 40; i++) {
      const r = createRng(`rf${i}`);
      const cols = placeCrowns(r);
      const intended = cols.map((c, row) => row * N + c);
      const grown = growRegions(r, cols);
      const out = refineRegions(grown, intended, r);
      if (!out) continue;
      refined++;
      expect(findSolutions(out, 2)).toHaveLength(1);
      for (const group of regionCells(out)) {
        expect(group.length).toBeGreaterThan(0);
        expect(connected(group)).toBe(true);
      }
      // The arrangement we designed around is still the answer.
      expect(findSolutions(out, 1)[0]!.slice().sort((a, b) => a - b))
        .toEqual(intended.slice().sort((a, b) => a - b));
    }
    expect(refined).toBeGreaterThan(0);
  });
});

describe('violations', () => {
  it('flags crowns sharing a row, column, region or edge', () => {
    const regions = new Array(CELLS).fill(0).map((_, i) => Math.floor(i / N));
    const g = new Array(CELLS).fill(0);
    g[0] = CROWN; g[5] = CROWN;                    // same row and same region
    expect(violations(g, regions)[0]).toBe(true);

    const g2 = new Array(CELLS).fill(0);
    g2[0] = CROWN; g2[N + 1] = CROWN;              // diagonally touching
    const bad = violations(g2, regions);
    expect(bad[0] && bad[N + 1]).toBe(true);
  });

  it('never flags the player’s marks', () => {
    const regions = new Array(CELLS).fill(0).map((_, i) => Math.floor(i / N));
    const g = new Array(CELLS).fill(0);
    g[0] = MARK; g[1] = MARK; g[2] = MARK;
    expect(violations(g, regions).some(Boolean)).toBe(false);
  });
});

describe('generate', () => {
  it('is deterministic and varies by date and difficulty', () => {
    const a = crowns.generate('crowns:2026-09-20:normal');
    const b = crowns.generate('crowns:2026-09-20:normal');
    expect(a.regions).toEqual(b.regions);
    expect(a.solution).toEqual(b.solution);
    expect(a.regions.join('')).not.toBe(crowns.generate('crowns:2026-09-21:normal').regions.join(''));
    expect(a.regions.join('')).not.toBe(crowns.generate('crowns:2026-09-20:hard').regions.join(''));
  });

  it('rejects a seed for another game', () => {
    expect(() => crowns.generate('nine:2026-09-20:easy')).toThrow();
  });

  for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
    it(`every ${d} puzzle over 25 seeds is unique, legal, in band and validates`, () => {
      const times: number[] = [];
      for (let day = 1; day <= 25; day++) {
        const seed = makeSeed('crowns', `2026-12-${String(day).padStart(2, '0')}`, d);
        const t0 = performance.now();
        const p = crowns.generate(seed);
        times.push(performance.now() - t0);

        expect(crowns.solve(p)).toHaveLength(1);
        expect(rulesHold(crownsIn(p.solution), p.regions)).toBeNull();
        expect(isSolved(p.solution, p.regions)).toBe(true);
        expect(crowns.validate(p, p.solution)).toEqual({ ok: true });

        for (const group of regionCells(p.regions)) expect(connected(group)).toBe(true);

        const lvl = p.rating.detail['hardestLevel']!;
        if (d === 'easy') expect(lvl).toBeLessThanOrEqual(2);
        if (d === 'normal') expect(lvl).toBe(3);
        if (d === 'hard') expect(lvl).toBeGreaterThanOrEqual(4);
      }
      console.log(`[crowns:${d}] max ${Math.max(...times).toFixed(1)}ms`);
    });
  }

  it('ignores marks and rejects incomplete or wrong boards', () => {
    const p = crowns.generate('crowns:2026-09-20:easy');

    const withMarks = p.solution.slice();
    for (let i = 0; i < CELLS; i++) if (withMarks[i] === 0) withMarks[i] = MARK;
    expect(crowns.validate(p, withMarks)).toEqual({ ok: true });

    const short = p.solution.slice();
    short[crownsIn(short)[0]!] = 0;
    expect(crowns.validate(p, short)).toEqual({ ok: false, reason: 'incomplete' });

    const wrong = new Array(CELLS).fill(0);
    for (let r = 0; r < N; r++) wrong[r * N + r] = CROWN;   // a diagonal: all touching
    expect(crowns.validate(p, wrong)).toEqual({ ok: false, reason: 'wrong' });
  });
});

describe('human solver', () => {
  it('solves every easy and normal puzzle without guessing, matching the answer', () => {
    for (const d of ['easy', 'normal'] as Difficulty[]) {
      for (let i = 0; i < 8; i++) {
        const p = crowns.generate(makeSeed('crowns', `probe${i}`, d));
        const run = humanSolve(p.regions);
        expect(run.solved).toBe(true);
        expect(columnsByRow(run.grid)).toEqual(columnsByRow(p.solution));
      }
    }
  });
});

describe('solver', () => {
  it('counts zero when no arrangement exists', () => {
    // One region covering the whole board: eight crowns cannot share it.
    expect(countSolutions(new Array(CELLS).fill(0), 2).count).toBe(0);
  });
});

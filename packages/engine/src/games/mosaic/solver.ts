import { slide, solveLine, type Known } from './line.js';

export interface Clues { w: number; h: number; rows: number[][]; cols: number[][] }

/** A line of the board: which squares it runs through, and its clue. */
export interface LineRef { kind: 'row' | 'col'; index: number }

export function cellsOf(c: Clues, l: LineRef): number[] {
  return l.kind === 'row'
    ? Array.from({ length: c.w }, (_, x) => l.index * c.w + x)
    : Array.from({ length: c.h }, (_, y) => y * c.w + l.index);
}

export function allLines(c: Clues): LineRef[] {
  return [
    ...c.rows.map((_, index) => ({ kind: 'row' as const, index })),
    ...c.cols.map((_, index) => ({ kind: 'col' as const, index })),
  ];
}

export const clueFor = (c: Clues, l: LineRef): number[] => (l.kind === 'row' ? c.rows[l.index]! : c.cols[l.index]!);

/**
 * Solves by row-and-column logic only, the way a person does, and counts what
 * it took: `slides` are lines settled by pushing the blocks left and right,
 * `deep` are lines that needed every arrangement weighed. `grid` is the
 * furthest it got (−1 where it couldn't tell).
 */
export function logicSolve(c: Clues, start?: Known[]): { grid: Known[]; solved: boolean; slides: number; deep: number; contradiction: boolean } {
  const grid: Known[] = start ? start.slice() : new Array<Known>(c.w * c.h).fill(-1);
  const lines = allLines(c);
  let slides = 0, deep = 0;
  for (let guard = 0; guard < 10_000; guard++) {
    let progressed = false;
    // Easy reasoning first, across the whole board.
    for (const l of lines) {
      const cells = cellsOf(c, l);
      const line = cells.map((i) => grid[i]!);
      if (!line.includes(-1)) continue;
      const s = slide(clueFor(c, l), line);
      if (!s) return { grid, solved: false, slides, deep, contradiction: true };
      let got = false;
      for (const t of s.fill) if (line[t] === -1) { grid[cells[t]!] = 1; got = true; }
      for (const t of s.empty) if (line[t] === -1) { grid[cells[t]!] = 0; got = true; }
      if (got) { slides++; progressed = true; }
    }
    if (progressed) continue;
    for (const l of lines) {
      const cells = cellsOf(c, l);
      const line = cells.map((i) => grid[i]!);
      if (!line.includes(-1)) continue;
      const r = solveLine(clueFor(c, l), line);
      if (!r) return { grid, solved: false, slides, deep, contradiction: true };
      let got = false;
      r.forEach((v, t) => { if (v !== -1 && line[t] === -1) { grid[cells[t]!] = v; got = true; } });
      if (got) { deep++; progressed = true; break; }
    }
    if (!progressed) break;
  }
  return { grid, solved: !grid.includes(-1), slides, deep, contradiction: false };
}

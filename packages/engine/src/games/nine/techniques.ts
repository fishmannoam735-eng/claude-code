import { PEERS, UNITS, UNITS_OF, type Grid } from './grid.js';

/**
 * A human-technique solver. It never guesses. The hardest technique it
 * needed to finish is the puzzle's difficulty; if it gets stuck the puzzle
 * needs something beyond this ladder and rates as hard.
 */
export const TECHNIQUES = [
  'none',
  'naked single',
  'hidden single',
  'locked candidates',
  'naked pair',
] as const;
export type TechniqueLevel = 0 | 1 | 2 | 3 | 4;
/** Level reported when the ladder runs out before the grid is solved. */
export const BEYOND: 5 = 5;

export interface HumanSolve {
  solved: boolean;
  /** Hardest technique used (1–4), or BEYOND (5) if stuck. 0 if already solved. */
  hardest: TechniqueLevel | typeof BEYOND;
  /** How many times each level fired. */
  counts: number[];
  grid: Grid;
}

const ALL = 0b1111111110;
const bit = (d: number): number => 1 << d;
const popcount = (x: number): number => { let c = 0; while (x) { x &= x - 1; c++; } return c; };

export function humanSolve(input: Grid): HumanSolve {
  const g = input.slice();
  const cand = new Array<number>(81);
  for (let i = 0; i < 81; i++) cand[i] = g[i] === 0 ? ALL : 0;
  for (let i = 0; i < 81; i++) if (g[i] !== 0) for (const j of PEERS[i]!) cand[j]! &= ~bit(g[i]!);

  const counts = [0, 0, 0, 0, 0];
  let hardest: TechniqueLevel | typeof BEYOND = 0;

  function place(i: number, d: number): void {
    g[i] = d; cand[i] = 0;
    for (const j of PEERS[i]!) cand[j]! &= ~bit(d);
  }
  const bump = (lvl: TechniqueLevel): void => { counts[lvl]!++; if (lvl > hardest) hardest = lvl; };

  function nakedSingle(): boolean {
    for (let i = 0; i < 81; i++) {
      if (g[i] === 0 && popcount(cand[i]!) === 1) {
        place(i, 31 - Math.clz32(cand[i]!)); bump(1); return true;
      }
    }
    return false;
  }

  function hiddenSingle(): boolean {
    for (const u of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const b = bit(d);
        let where = -1, n = 0;
        for (const i of u) if (g[i] === 0 && (cand[i]! & b)) { where = i; if (++n > 1) break; }
        if (n === 1) { place(where, d); bump(2); return true; }
      }
    }
    return false;
  }

  /** Pointing (box→line) and claiming (line→box). Returns true if any candidate was removed. */
  function lockedCandidates(): boolean {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      // pointing: within a box, if d is confined to one row/col, remove from rest of that line
      for (let bx = 18; bx < 27; bx++) {
        const cells = UNITS[bx]!.filter((i) => g[i] === 0 && (cand[i]! & b));
        if (cells.length < 2) continue;
        for (const lineIdx of [0, 1] as const) {
          const line = UNITS_OF[cells[0]!]![lineIdx]!;
          if (!cells.every((i) => UNITS_OF[i]![lineIdx] === line)) continue;
          let removed = false;
          for (const j of UNITS[line]!) {
            if (g[j] === 0 && (cand[j]! & b) && !UNITS[bx]!.includes(j)) { cand[j]! &= ~b; removed = true; }
          }
          if (removed) { bump(3); return true; }
        }
      }
      // claiming: within a row/col, if d is confined to one box, remove from rest of that box
      for (let ln = 0; ln < 18; ln++) {
        const cells = UNITS[ln]!.filter((i) => g[i] === 0 && (cand[i]! & b));
        if (cells.length < 2) continue;
        const box = UNITS_OF[cells[0]!]![2]!;
        if (!cells.every((i) => UNITS_OF[i]![2] === box)) continue;
        let removed = false;
        for (const j of UNITS[box]!) {
          if (g[j] === 0 && (cand[j]! & b) && !UNITS[ln]!.includes(j)) { cand[j]! &= ~b; removed = true; }
        }
        if (removed) { bump(3); return true; }
      }
    }
    return false;
  }

  function nakedPair(): boolean {
    for (const u of UNITS) {
      const twos = u.filter((i) => g[i] === 0 && popcount(cand[i]!) === 2);
      for (let a = 0; a < twos.length; a++) {
        for (let bI = a + 1; bI < twos.length; bI++) {
          const m = cand[twos[a]!]!;
          if (cand[twos[bI]!] !== m) continue;
          let removed = false;
          for (const j of u) {
            if (j === twos[a] || j === twos[bI] || g[j] !== 0) continue;
            if (cand[j]! & m) { cand[j]! &= ~m; removed = true; }
          }
          if (removed) { bump(4); return true; }
        }
      }
    }
    return false;
  }

  for (;;) {
    if (g.every((v) => v !== 0)) return { solved: true, hardest, counts, grid: g };
    if (nakedSingle()) continue;
    if (hiddenSingle()) continue;
    if (lockedCandidates()) continue;
    if (nakedPair()) continue;
    return { solved: false, hardest: BEYOND, counts, grid: g };
  }
}

import { PEERS, type Grid } from './grid.js';

const ALL = 0b1111111110; // bits 1..9 set
const bit = (d: number): number => 1 << d;
const popcount = (x: number): number => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
const lowestDigit = (m: number): number => 31 - Math.clz32(m & -m);

/**
 * Count solutions up to `limit` using bitmask candidates, naked-single
 * propagation and MRV branching. Returns the first solution found (if any).
 * Proving uniqueness means proving there is NOT a second solution, so this
 * has to exhaust the search tree for a unique puzzle — the propagation is
 * what keeps that cheap.
 */
export function countSolutions(grid: Grid, limit = 2): { count: number; solution: Grid | null } {
  const cand = new Array<number>(81);
  const g = grid.slice();
  for (let i = 0; i < 81; i++) cand[i] = g[i] === 0 ? ALL : bit(g[i]!);
  for (let i = 0; i < 81; i++) {
    if (g[i] !== 0) {
      const b = bit(g[i]!);
      for (const j of PEERS[i]!) {
        if (g[j] === 0) { cand[j]! &= ~b; if (cand[j] === 0) return { count: 0, solution: null }; }
        else if (g[j] === g[i]) return { count: 0, solution: null };
      }
    }
  }

  let count = 0;
  let solution: Grid | null = null;

  function assign(i: number, d: number, undo: number[]): boolean {
    g[i] = d;
    const b = bit(d);
    for (const j of PEERS[i]!) {
      if (g[j] === 0 && (cand[j]! & b)) {
        cand[j]! &= ~b;
        undo.push(j, b);
        if (cand[j] === 0) return false;
      }
    }
    return true;
  }
  function rollback(undo: number[], i: number): void {
    for (let k = 0; k < undo.length; k += 2) cand[undo[k]!]! |= undo[k + 1]!;
    g[i] = 0;
  }

  function search(): void {
    if (count >= limit) return;
    // Naked singles first, then MRV.
    let best = -1, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const n = popcount(cand[i]!);
      if (n === 0) return;
      if (n < bestN) { best = i; bestN = n; if (n === 1) break; }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = g.slice();
      return;
    }
    let m = cand[best]!;
    while (m) {
      const d = lowestDigit(m);
      m &= ~bit(d);
      const undo: number[] = [];
      if (assign(best, d, undo)) search();
      rollback(undo, best);
      if (count >= limit) return;
    }
  }

  search();
  return { count, solution };
}

export function solveAll(grid: Grid, limit = 2): Grid[] {
  // For limit 2 we only need existence + uniqueness; return what we have.
  const { count, solution } = countSolutions(grid, limit);
  if (count === 0 || !solution) return [];
  return count === 1 ? [solution] : [solution, solution]; // second entry marks non-uniqueness
}

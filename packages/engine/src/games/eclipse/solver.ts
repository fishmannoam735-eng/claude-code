import { CELLS, HALF, LINES, LINES_OF, MOON, N, SUN, edgesByCell, type Edge, type Grid } from './grid.js';

/** Would placing `v` at `i` break a rule, given what is already on the board? */
function legal(g: Grid, i: number, v: number, edgeIdx: number[][], edges: readonly Edge[]): boolean {
  for (const ln of LINES_OF[i]!) {
    const line = LINES[ln]!;
    let same = 0;
    for (const j of line) if (g[j] === v) same++;
    if (same + 1 > HALF) return false;
  }

  // No three identical consecutively, checking the three windows that contain i.
  const r = Math.floor(i / N), c = i % N;
  const rowAt = (k: number): number => (k < 0 || k >= N ? -1 : (k === c ? v : g[r * N + k]!));
  const colAt = (k: number): number => (k < 0 || k >= N ? -1 : (k === r ? v : g[k * N + c]!));
  for (let d = -2; d <= 0; d++) {
    if (rowAt(c + d) === v && rowAt(c + d + 1) === v && rowAt(c + d + 2) === v) return false;
    if (colAt(r + d) === v && colAt(r + d + 1) === v && colAt(r + d + 2) === v) return false;
  }

  for (const k of edgeIdx[i]!) {
    const e = edges[k]!;
    const otherCell = e.a === i ? e.b : e.a;
    const ov = g[otherCell]!;
    if (ov === 0) continue;
    if (e.same ? ov !== v : ov === v) return false;
  }

  return true;
}

/**
 * Count solutions up to `limit`. Branches on the most-constrained empty cell,
 * which for a 6×6 board makes an exhaustive search — and so a uniqueness
 * proof — cheap.
 */
export function countSolutions(
  givens: Grid,
  edges: readonly Edge[],
  limit = 2,
): { count: number; solution: Grid | null } {
  const g = givens.slice();
  const edgeIdx = edgesByCell(edges);
  let count = 0;
  let solution: Grid | null = null;

  // Reject a contradictory starting position.
  for (let i = 0; i < CELLS; i++) {
    if (g[i] === 0) continue;
    const v = g[i]!;
    g[i] = 0;
    const ok = legal(g, i, v, edgeIdx, edges);
    g[i] = v;
    if (!ok) return { count: 0, solution: null };
  }

  function search(): void {
    if (count >= limit) return;

    let best = -1;
    let bestOpts: number[] = [];
    for (let i = 0; i < CELLS; i++) {
      if (g[i] !== 0) continue;
      const opts: number[] = [];
      if (legal(g, i, SUN, edgeIdx, edges)) opts.push(SUN);
      if (legal(g, i, MOON, edgeIdx, edges)) opts.push(MOON);
      if (opts.length === 0) return;                 // dead end
      if (opts.length === 1) { best = i; bestOpts = opts; break; }
      if (best === -1) { best = i; bestOpts = opts; }
    }

    if (best === -1) {
      count++;
      if (!solution) solution = g.slice();
      return;
    }

    for (const v of bestOpts) {
      g[best] = v;
      search();
      g[best] = 0;
      if (count >= limit) return;
    }
  }

  search();
  return { count, solution };
}

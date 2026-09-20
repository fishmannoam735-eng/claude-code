import { CROWN, N, emptyGrid, type Grid, type Regions } from './grid.js';

/**
 * Crown arrangements, up to `limit`, each as the cell index per row.
 *
 * One crown per row makes rows the natural branch order, and it collapses the
 * adjacency rule to a single check: crowns in the same row or column are
 * already forbidden, and the only diagonal touch possible is between crowns in
 * consecutive rows, so consecutive rows just have to keep their columns two
 * apart.
 */
export function findSolutions(regions: Regions, limit = 2): number[][] {
  const cols = new Array<number>(N).fill(-1);
  const out: number[][] = [];
  let usedCols = 0;
  let usedRegions = 0;

  function search(r: number): void {
    if (out.length >= limit) return;
    if (r === N) {
      out.push(cols.map((c, rr) => rr * N + c));
      return;
    }
    for (let c = 0; c < N; c++) {
      if (usedCols & (1 << c)) continue;
      if (r > 0 && Math.abs(cols[r - 1]! - c) < 2) continue;
      const g = regions[r * N + c]!;
      if (usedRegions & (1 << g)) continue;

      cols[r] = c;
      usedCols |= 1 << c;
      usedRegions |= 1 << g;
      search(r + 1);
      usedCols &= ~(1 << c);
      usedRegions &= ~(1 << g);
      cols[r] = -1;
      if (out.length >= limit) return;
    }
  }

  search(0);
  return out;
}

export function countSolutions(regions: Regions, limit = 2): { count: number; solution: Grid | null } {
  const sols = findSolutions(regions, limit);
  if (sols.length === 0) return { count: 0, solution: null };
  const g = emptyGrid();
  for (const i of sols[0]!) g[i] = CROWN;
  return { count: sols.length, solution: g };
}

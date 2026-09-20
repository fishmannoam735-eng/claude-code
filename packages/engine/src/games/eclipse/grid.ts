/** 0 = empty, 1 = sun, 2 = moon. Always length 36, row-major. */
export type Grid = number[];

export const N = 6;
export const CELLS = 36;
export const HALF = 3;          // each line holds exactly three of each symbol
export const SUN = 1;
export const MOON = 2;
export const other = (v: number): number => (v === SUN ? MOON : SUN);

export const rowOf = (i: number): number => Math.floor(i / N);
export const colOf = (i: number): number => i % N;

/** 12 lines: rows 0–5, then columns 6–11. */
export const LINES: readonly (readonly number[])[] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < N; r++) out.push(Array.from({ length: N }, (_, c) => r * N + c));
  for (let c = 0; c < N; c++) out.push(Array.from({ length: N }, (_, r) => r * N + c));
  return out;
})();

/** For each cell, [rowLineIndex, colLineIndex]. */
export const LINES_OF: readonly (readonly [number, number])[] =
  Array.from({ length: CELLS }, (_, i) => [rowOf(i), N + colOf(i)] as const);

/**
 * A constraint printed on the edge between two orthogonally adjacent cells:
 * `same` (=) or different (×). `a` is always the smaller index.
 */
export interface Edge {
  a: number;
  b: number;
  same: boolean;
}

export const edgeKey = (a: number, b: number): string => `${Math.min(a, b)}-${Math.max(a, b)}`;

/** Every adjacent pair on the board, as [a, b] with a < b. */
export const ADJACENT: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      if (c + 1 < N) out.push([i, i + 1]);
      if (r + 1 < N) out.push([i, i + N]);
    }
  }
  return out;
})();

/** Edges touching each cell, as an index into the puzzle's edge list. Built per puzzle. */
export function edgesByCell(edges: readonly Edge[]): number[][] {
  const out: number[][] = Array.from({ length: CELLS }, () => []);
  edges.forEach((e, k) => { out[e.a]!.push(k); out[e.b]!.push(k); });
  return out;
}

export const emptyGrid = (): Grid => new Array<number>(CELLS).fill(0);

export function gridToString(g: Grid): string {
  return g.map((v) => (v === 0 ? '.' : v === SUN ? 'o' : 'x')).join('');
}

export function parseGrid(s: string): Grid {
  const clean = s.replace(/[^.ox]/g, '');
  if (clean.length !== CELLS) throw new Error(`grid must have ${CELLS} cells, got ${clean.length}`);
  return [...clean].map((ch) => (ch === '.' ? 0 : ch === 'o' ? SUN : MOON));
}

/**
 * Cells that break a rule, given a (possibly partial) grid. Only filled cells
 * are flagged; an unfinished line is never a violation on its own.
 */
export function violations(g: Grid, edges: readonly Edge[]): boolean[] {
  const bad = new Array<boolean>(CELLS).fill(false);

  for (const line of LINES) {
    let sun = 0, moon = 0;
    for (const i of line) { if (g[i] === SUN) sun++; else if (g[i] === MOON) moon++; }
    // Too many of one symbol: the whole line is at fault, so flag its filled cells.
    if (sun > HALF || moon > HALF) {
      const over = sun > HALF ? SUN : MOON;
      for (const i of line) if (g[i] === over) bad[i] = true;
    }
    // Three identical in a row.
    for (let k = 0; k + 2 < line.length; k++) {
      const a = line[k]!, b = line[k + 1]!, c = line[k + 2]!;
      if (g[a] !== 0 && g[a] === g[b] && g[b] === g[c]) { bad[a] = bad[b] = bad[c] = true; }
    }
  }

  for (const e of edges) {
    const va = g[e.a]!, vb = g[e.b]!;
    if (va === 0 || vb === 0) continue;
    if (e.same ? va !== vb : va === vb) { bad[e.a] = true; bad[e.b] = true; }
  }

  return bad;
}

export const isComplete = (g: Grid): boolean => g.every((v) => v !== 0);

/** True when the grid is full and satisfies every rule. */
export function isSolved(g: Grid, edges: readonly Edge[]): boolean {
  return isComplete(g) && !violations(g, edges).some(Boolean);
}

/** 0 = empty, 1 = the player's "not here" mark, 2 = crown. */
export type Grid = number[];
/** One region id (0..N-1) per cell. */
export type Regions = number[];

export const N = 8;
export const CELLS = N * N;
export const EMPTY = 0;
export const MARK = 1;
export const CROWN = 2;

export const rowOf = (i: number): number => Math.floor(i / N);
export const colOf = (i: number): number => i % N;

/** The eight cells touching each cell, diagonals included. */
export const NEIGHBOURS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, i) => {
  const r = rowOf(i), c = colOf(i);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
    }
  }
  return out;
});

/** The four orthogonally adjacent cells — region growth must stay connected. */
export const ORTHOGONAL: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, i) => {
  const r = rowOf(i), c = colOf(i);
  const out: number[] = [];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  if (c > 0) out.push(i - 1);
  if (c < N - 1) out.push(i + 1);
  return out;
});

export const ROWS: readonly (readonly number[])[] =
  Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => r * N + c));
export const COLS: readonly (readonly number[])[] =
  Array.from({ length: N }, (_, c) => Array.from({ length: N }, (_, r) => r * N + c));

export function regionCells(regions: Regions): number[][] {
  const out: number[][] = Array.from({ length: N }, () => []);
  regions.forEach((g, i) => out[g]!.push(i));
  return out;
}

export const emptyGrid = (): Grid => new Array<number>(CELLS).fill(EMPTY);

export const crownsIn = (g: Grid): number[] =>
  g.reduce<number[]>((acc, v, i) => (v === CROWN ? (acc.push(i), acc) : acc), []);

/**
 * Crowns that break a rule. Marks are the player's own bookkeeping and are
 * never flagged; a partly filled board is only wrong where it is actually wrong.
 */
export function violations(g: Grid, regions: Regions): boolean[] {
  const bad = new Array<boolean>(CELLS).fill(false);
  const crowns = crownsIn(g);

  const clash = (key: (i: number) => number): void => {
    const seen = new Map<number, number[]>();
    for (const i of crowns) {
      const k = key(i);
      const group = seen.get(k);
      if (group) group.push(i);
      else seen.set(k, [i]);
    }
    for (const group of seen.values()) {
      if (group.length > 1) for (const i of group) bad[i] = true;
    }
  };

  clash(rowOf);
  clash(colOf);
  clash((i) => regions[i]!);

  for (const i of crowns) {
    for (const j of NEIGHBOURS[i]!) {
      if (g[j] === CROWN) { bad[i] = true; bad[j] = true; }
    }
  }

  return bad;
}

export function isSolved(g: Grid, regions: Regions): boolean {
  return crownsIn(g).length === N && !violations(g, regions).some(Boolean);
}

/** Column of the crown in each row, or -1. Handy for tests and for the solver. */
export function columnsByRow(g: Grid): number[] {
  const out = new Array<number>(N).fill(-1);
  for (const i of crownsIn(g)) out[rowOf(i)] = colOf(i);
  return out;
}

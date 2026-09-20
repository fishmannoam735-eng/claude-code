/**
 * Thread boards are square but not all one size — the side length is part of
 * the difficulty, so almost everything here takes `n` rather than assuming it.
 */
export type Path = number[];          // cell indices in visit order
export type Walls = ReadonlySet<string>;

export const SIDES = { easy: 5, normal: 6, hard: 7 } as const;

export const rowOf = (i: number, n: number): number => Math.floor(i / n);
export const colOf = (i: number, n: number): number => i % n;

/** Canonical key for the wall between two orthogonally adjacent cells. */
export const wallKey = (a: number, b: number): string =>
  a < b ? `${a}-${b}` : `${b}-${a}`;

export function neighbours(n: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < n * n; i++) {
    const r = rowOf(i, n), c = colOf(i, n);
    const cell: number[] = [];
    if (r > 0) cell.push(i - n);
    if (r < n - 1) cell.push(i + n);
    if (c > 0) cell.push(i - 1);
    if (c < n - 1) cell.push(i + 1);
    out.push(cell);
  }
  return out;
}

/** Every adjacent pair, as [a, b] with a < b. Candidate wall positions. */
export function adjacentPairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (c + 1 < n) out.push([i, i + 1]);
      if (r + 1 < n) out.push([i, i + n]);
    }
  }
  return out;
}

/** Neighbour lists with walled edges removed — the graph the path actually runs on. */
export function openNeighbours(n: number, walls: Walls): number[][] {
  return neighbours(n).map((cell, i) => cell.filter((j) => !walls.has(wallKey(i, j))));
}

export const areAdjacent = (a: number, b: number, n: number): boolean => {
  const dr = Math.abs(rowOf(a, n) - rowOf(b, n));
  const dc = Math.abs(colOf(a, n) - colOf(b, n));
  return dr + dc === 1;
};

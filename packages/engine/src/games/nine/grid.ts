/** 0 = empty, 1–9 = digit. Always length 81, row-major. */
export type Grid = number[];

export const N = 9;
export const CELLS = 81;

export const rowOf = (i: number): number => Math.floor(i / 9);
export const colOf = (i: number): number => i % 9;
export const boxOf = (i: number): number => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** 27 units: rows 0–8, cols 9–17, boxes 18–26. */
export const UNITS: readonly (readonly number[])[] = (() => {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3;
    const u: number[] = [];
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) u.push((r0 + dr) * 9 + c0 + dc);
    units.push(u);
  }
  return units;
})();

/** For each cell, the indices of its row, column and box in UNITS. */
export const UNITS_OF: readonly (readonly number[])[] = Array.from({ length: 81 }, (_, i) => [
  rowOf(i), 9 + colOf(i), 18 + boxOf(i),
]);

/** For each cell, its 20 peers. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>();
  for (const u of UNITS_OF[i]!) for (const j of UNITS[u]!) if (j !== i) s.add(j);
  return [...s];
});

export function emptyGrid(): Grid {
  return new Array<number>(81).fill(0);
}

export function parseGrid(s: string): Grid {
  const clean = s.replace(/[^0-9.]/g, '');
  if (clean.length !== 81) throw new Error(`grid string must have 81 cells, got ${clean.length}`);
  return [...clean].map((ch) => (ch === '.' ? 0 : Number(ch)));
}

export function gridToString(g: Grid): string {
  return g.map((v) => (v === 0 ? '.' : String(v))).join('');
}

/** True for every cell whose digit clashes with a peer's. Empty cells are never flagged. */
export function conflicts(g: Grid): boolean[] {
  const out = new Array<boolean>(81).fill(false);
  for (let i = 0; i < 81; i++) {
    const v = g[i]!;
    if (v === 0) continue;
    for (const j of PEERS[i]!) {
      if (g[j] === v) { out[i] = true; break; }
    }
  }
  return out;
}

export function isComplete(g: Grid): boolean {
  return g.every((v) => v !== 0);
}

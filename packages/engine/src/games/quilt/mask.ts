/**
 * Sets of board cells as bitmasks, one 32-bit word per 32 cells. The solvers
 * test candidate rectangles against each other tens of thousands of times per
 * puzzle, and a few word ANDs is what keeps that in the milliseconds. Boards
 * go up to 12x12, so a mask is at most five words.
 */
export type Mask = Uint32Array;

export const wordsFor = (n: number): number => Math.ceil((n * n) / 32);

export const emptyMask = (n: number): Mask => new Uint32Array(wordsFor(n));

export function maskOf(cells: readonly number[], n: number): Mask {
  const m = emptyMask(n);
  for (const i of cells) m[i >>> 5]! |= 1 << (i & 31);
  return m;
}

/** Every cell of the board. */
export function fullMask(n: number): Mask {
  const m = emptyMask(n);
  for (let i = 0; i < n * n; i++) m[i >>> 5]! |= 1 << (i & 31);
  return m;
}

export const hasBit = (m: Mask, i: number): boolean => (m[i >>> 5]! & (1 << (i & 31))) !== 0;

export function overlaps(a: Mask, b: Mask): boolean {
  for (let w = 0; w < a.length; w++) if ((a[w]! & b[w]!) !== 0) return true;
  return false;
}

export function isEmpty(m: Mask): boolean {
  for (let w = 0; w < m.length; w++) if (m[w] !== 0) return false;
  return true;
}

export function equals(a: Mask, b: Mask): boolean {
  for (let w = 0; w < a.length; w++) if (a[w] !== b[w]) return false;
  return true;
}

/** a |= b */
export function orInto(a: Mask, b: Mask): void { for (let w = 0; w < a.length; w++) a[w]! |= b[w]!; }
/** a &= b */
export function andInto(a: Mask, b: Mask): void { for (let w = 0; w < a.length; w++) a[w]! &= b[w]!; }
/** a &= ~b */
export function clearInto(a: Mask, b: Mask): void { for (let w = 0; w < a.length; w++) a[w]! &= ~b[w]!; }

/** True when every cell of `need` is in `have`. */
export function covers(have: Mask, need: Mask): boolean {
  for (let w = 0; w < need.length; w++) if ((need[w]! & ~have[w]!) !== 0) return false;
  return true;
}

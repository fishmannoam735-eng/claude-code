/**
 * Quilt boards are square but not all one size — the side length is part of
 * the difficulty, so everything here takes `n` rather than assuming it.
 *
 * The board is partitioned into rectangles. Each rectangle holds exactly one
 * clue, and the clue's *position* is information in its own right even when it
 * says nothing else: "one clue per rectangle" already forbids any tiling that
 * puts two clues in one patch or leaves a patch clueless.
 */
export type Shape = 'square' | 'wide' | 'tall';

export interface Rect {
  /** Top-left corner. */
  r: number;
  c: number;
  w: number;
  h: number;
}

/**
 * What a clue tells you, and nothing more. The three cases are a deliberate
 * ladder of strength — `area` pins the size, `shape` pins only the proportion,
 * `any` pins nothing but its own presence. A clue never carries the answer it
 * was weakened from, so a puzzle object cannot leak the solution through it.
 */
export type Clue =
  | { cell: number; kind: 'area'; area: number }
  | { cell: number; kind: 'shape'; shape: Shape }
  | { cell: number; kind: 'any' };

/** Which clue owns each cell, by index into the clue list. -1 = unclaimed. */
export type Owner = number[];

export const SIDES = { easy: 6, normal: 7, hard: 8 } as const;

export const rowOf = (i: number, n: number): number => Math.floor(i / n);
export const colOf = (i: number, n: number): number => i % n;

export const shapeOf = (w: number, h: number): Shape =>
  w === h ? 'square' : w > h ? 'wide' : 'tall';

export const rectArea = (rect: Rect): number => rect.w * rect.h;

export function rectCells(rect: Rect, n: number): number[] {
  const out: number[] = [];
  for (let r = rect.r; r < rect.r + rect.h; r++) {
    for (let c = rect.c; c < rect.c + rect.w; c++) out.push(r * n + c);
  }
  return out;
}

export const rectContains = (rect: Rect, i: number, n: number): boolean => {
  const r = rowOf(i, n), c = colOf(i, n);
  return r >= rect.r && r < rect.r + rect.h && c >= rect.c && c < rect.c + rect.w;
};

/** Does a rectangle satisfy what its clue actually says? */
export function fitsClue(clue: Clue, rect: Rect): boolean {
  switch (clue.kind) {
    case 'area': return rect.w * rect.h === clue.area;
    case 'shape': return shapeOf(rect.w, rect.h) === clue.shape;
    case 'any': return true;
  }
}

/**
 * Every rectangle that could belong to clue `k`: inside the board, covering
 * that clue's cell, covering no *other* clue's cell, and satisfying whatever
 * the clue says. This is the whole candidate space — the solver never
 * considers a rectangle outside it.
 */
export function candidatesFor(n: number, clues: readonly Clue[], k: number): Rect[] {
  const clue = clues[k]!;
  const cr = rowOf(clue.cell, n), cc = colOf(clue.cell, n);
  const others = clues.filter((_, j) => j !== k).map((o) => o.cell);
  const out: Rect[] = [];

  for (let top = 0; top <= cr; top++) {
    for (let bottom = cr; bottom < n; bottom++) {
      for (let left = 0; left <= cc; left++) {
        for (let right = cc; right < n; right++) {
          const rect: Rect = { r: top, c: left, w: right - left + 1, h: bottom - top + 1 };
          if (!fitsClue(clue, rect)) continue;
          if (others.some((cell) => rectContains(rect, cell, n))) continue;
          out.push(rect);
        }
      }
    }
  }
  return out;
}

export const emptyOwner = (n: number): Owner => new Array<number>(n * n).fill(-1);

/**
 * The cells each clue currently holds. Used for validation and for the board's
 * own idea of what the player has drawn.
 */
export function cellsByClue(owner: Owner, clueCount: number): number[][] {
  const out: number[][] = Array.from({ length: clueCount }, () => []);
  owner.forEach((k, i) => { if (k >= 0 && k < clueCount) out[k]!.push(i); });
  return out;
}

/**
 * The bounding box of a cell set, and whether the set fills it exactly. A
 * patch that is merely *contained* in a rectangle is not a rectangle.
 */
export function boundsOf(cells: readonly number[], n: number): { rect: Rect; exact: boolean } | null {
  if (cells.length === 0) return null;
  let minR = n, maxR = -1, minC = n, maxC = -1;
  for (const i of cells) {
    const r = rowOf(i, n), c = colOf(i, n);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  const rect: Rect = { r: minR, c: minC, w: maxC - minC + 1, h: maxR - minR + 1 };
  return { rect, exact: rect.w * rect.h === cells.length };
}

/**
 * Which clues are broken, given what the player has drawn. A patch is wrong
 * when it is not a rectangle, when it does not hold its clue, or when it
 * contradicts what the clue says. Unfinished patches are not wrong — an empty
 * board flags nothing.
 */
export function brokenClues(owner: Owner, clues: readonly Clue[], n: number): boolean[] {
  const bad = new Array<boolean>(clues.length).fill(false);
  const cells = cellsByClue(owner, clues.length);

  clues.forEach((clue, k) => {
    const mine = cells[k]!;
    if (mine.length === 0) return;
    const b = boundsOf(mine, n);
    if (!b || !b.exact) { bad[k] = true; return; }
    if (!rectContains(b.rect, clue.cell, n)) { bad[k] = true; return; }
    // An area clue is only broken once the patch overshoots; a short patch is
    // simply unfinished. A shape clue has no such halfway state.
    if (clue.kind === 'area' && mine.length > clue.area) bad[k] = true;
    if (clue.kind === 'shape' && shapeOf(b.rect.w, b.rect.h) !== clue.shape) bad[k] = true;
  });

  return bad;
}

/** Is this a complete, legal tiling? */
export function isSolved(owner: Owner, clues: readonly Clue[], n: number): boolean {
  if (owner.length !== n * n) return false;
  if (owner.some((k) => k < 0 || k >= clues.length)) return false;
  const cells = cellsByClue(owner, clues.length);
  return clues.every((clue, k) => {
    const mine = cells[k]!;
    const b = boundsOf(mine, n);
    if (!b || !b.exact) return false;
    if (!rectContains(b.rect, clue.cell, n)) return false;
    return fitsClue(clue, b.rect);
  });
}

/** Turn a list of rectangles, one per clue in order, into an ownership array. */
export function ownerFromRects(rects: readonly Rect[], n: number): Owner {
  const owner = emptyOwner(n);
  rects.forEach((rect, k) => { for (const i of rectCells(rect, n)) owner[i] = k; });
  return owner;
}

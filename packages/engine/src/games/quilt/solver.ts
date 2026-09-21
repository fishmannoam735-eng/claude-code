import { candidatesFor, emptyOwner, rectCells, type Clue, type Owner, type Rect } from './grid.js';

/**
 * A candidate rectangle with its cells precomputed as a bitmask. Boards are at
 * most 8x8, so 64 bits fits in two 32-bit halves and overlap testing collapses
 * to two ANDs. That matters: the search tests candidate viability tens of
 * thousands of times per puzzle, and doing it by walking cell arrays is what
 * separates a solver that runs in a millisecond from one that runs in fifty.
 */
export interface Cand {
  rect: Rect;
  lo: number;
  hi: number;
}

export function maskOf(cells: readonly number[]): { lo: number; hi: number } {
  let lo = 0, hi = 0;
  for (const i of cells) {
    if (i < 32) lo |= 1 << i;
    else hi |= 1 << (i - 32);
  }
  return { lo, hi };
}

export function buildCandidates(n: number, clues: readonly Clue[]): Cand[][] {
  return clues.map((_, k) =>
    candidatesFor(n, clues, k).map((rect) => ({ rect, ...maskOf(rectCells(rect, n)) })),
  );
}

/** The mask of a full board, so "everything covered" is one comparison. */
function fullMask(n: number): { lo: number; hi: number } {
  const cells = n * n;
  return {
    lo: cells >= 32 ? -1 : (1 << cells) - 1,
    hi: cells <= 32 ? 0 : cells >= 64 ? -1 : (1 << (cells - 32)) - 1,
  };
}

/**
 * Tilings of the board, up to `limit`. Two is all uniqueness needs.
 *
 * Exact cover, branching on the clue with the fewest live candidates, with one
 * extra prune that does most of the work: after each placement every still-free
 * cell must be reachable by *some* live candidate of *some* unplaced clue.
 * Without it the search cheerfully fills half a board before discovering it has
 * stranded a corner.
 */
export function findTilings(n: number, clues: readonly Clue[], limit = 2, cands?: Cand[][]): Owner[] {
  const candidates = cands ?? buildCandidates(n, clues);
  const full = fullMask(n);
  const chosen = new Array<Rect | null>(clues.length).fill(null);
  const out: Owner[] = [];
  let usedLo = 0, usedHi = 0;

  function record(): void {
    const owner = emptyOwner(n);
    chosen.forEach((rect, k) => {
      if (rect) for (const i of rectCells(rect, n)) owner[i] = k;
    });
    out.push(owner);
  }

  function search(): void {
    if (out.length >= limit) return;

    let bestClue = -1;
    let bestList: Cand[] | null = null;
    let reachLo = 0, reachHi = 0;

    for (let k = 0; k < clues.length; k++) {
      if (chosen[k]) continue;
      const live: Cand[] = [];
      for (const cand of candidates[k]!) {
        if ((cand.lo & usedLo) === 0 && (cand.hi & usedHi) === 0) live.push(cand);
      }
      if (live.length === 0) return;                 // this clue has nowhere to go
      reachLo |= live.reduce((m, c) => m | c.lo, 0);
      reachHi |= live.reduce((m, c) => m | c.hi, 0);
      if (bestList === null || live.length < bestList.length) { bestClue = k; bestList = live; }
    }

    if (bestList === null) {                          // every clue placed
      if (usedLo === full.lo && usedHi === full.hi) record();
      return;
    }

    // Any free cell no live candidate can reach is a cell nothing will ever
    // cover, so this branch is already dead.
    const freeLo = full.lo & ~usedLo, freeHi = full.hi & ~usedHi;
    if ((freeLo & ~reachLo) !== 0 || (freeHi & ~reachHi) !== 0) return;

    for (const cand of bestList) {
      chosen[bestClue] = cand.rect;
      usedLo |= cand.lo; usedHi |= cand.hi;
      search();
      usedLo &= ~cand.lo; usedHi &= ~cand.hi;
      chosen[bestClue] = null;
      if (out.length >= limit) return;
    }
  }

  if (clues.length === 0) return [];
  search();
  return out;
}

export function countTilings(
  n: number, clues: readonly Clue[], limit = 2, cands?: Cand[][],
): { count: number; first: Owner | null } {
  const sols = findTilings(n, clues, limit, cands);
  return { count: sols.length, first: sols[0] ?? null };
}

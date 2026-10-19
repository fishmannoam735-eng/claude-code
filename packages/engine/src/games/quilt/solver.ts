import { candidatesFor, emptyOwner, rectCells, type Clue, type Owner, type Rect } from './grid.js';
import { covers, emptyMask, equals, fullMask, maskOf, orInto, overlaps, clearInto, type Mask } from './mask.js';

export { maskOf } from './mask.js';

/**
 * A candidate rectangle with its cells precomputed as a bitmask, so testing
 * whether two candidates overlap is a few word ANDs. That matters: the search
 * tests candidate viability tens of thousands of times per puzzle, and doing it
 * by walking cell arrays is what separates a solver that runs in a millisecond
 * from one that runs in fifty.
 */
export interface Cand {
  rect: Rect;
  m: Mask;
}

export function buildCandidates(n: number, clues: readonly Clue[]): Cand[][] {
  return clues.map((_, k) =>
    candidatesFor(n, clues, k).map((rect) => ({ rect, m: maskOf(rectCells(rect, n), n) })),
  );
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
  const used = emptyMask(n);

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
    const reach = emptyMask(n);

    for (let k = 0; k < clues.length; k++) {
      if (chosen[k]) continue;
      const live: Cand[] = [];
      for (const cand of candidates[k]!) {
        if (!overlaps(cand.m, used)) { live.push(cand); orInto(reach, cand.m); }
      }
      if (live.length === 0) return;                 // this clue has nowhere to go
      if (bestList === null || live.length < bestList.length) { bestClue = k; bestList = live; }
    }

    if (bestList === null) {                          // every clue placed
      if (equals(used, full)) record();
      return;
    }

    // Any free cell no live candidate can reach is a cell nothing will ever
    // cover, so this branch is already dead.
    orInto(reach, used);
    if (!covers(reach, full)) return;

    for (const cand of bestList) {
      chosen[bestClue] = cand.rect;
      orInto(used, cand.m);
      search();
      clearInto(used, cand.m);
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

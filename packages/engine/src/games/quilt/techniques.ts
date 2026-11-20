import { emptyOwner, rectCells, type Clue, type Owner, type Rect } from './grid.js';
import { buildCandidates, type Cand } from './solver.js';
import { andInto, covers, emptyMask, equals, fullMask, hasBit, isEmpty, orInto, overlaps } from './mask.js';

/**
 * A human-technique solver. It never guesses, so the hardest technique it
 * needs is the puzzle's difficulty; if the ladder runs out it rates BEYOND.
 *
 * The four rungs are the deductions a person actually makes in a tiling
 * puzzle, ordered by what they cost — and the order was measured, not guessed.
 * Switching rungs off over a 501-board corpus put `only owner` (68% of boards
 * solvable with it alone) two rungs below `shared cells` (20%), the reverse of
 * the first draft. It matches how the game is played: you look at one cell and
 * ask which clue could possibly reach it, long before you start intersecting
 * every placement of a clue in your head.
 */
export const TECHNIQUES = [
  'none',
  'only rectangle',      // a clue with one candidate left
  'only owner',          // a cell just one clue can reach must be that clue's
  'shared cells',        // cells every candidate of a clue covers are its own
  'refutation',          // a placement that strands a cell or starves a clue
] as const;
export type TechniqueLevel = 0 | 1 | 2 | 3 | 4;
export const BEYOND: 5 = 5;

/**
 * How many placements refutation will try per clue. A person tests a handful
 * of positions, not two hundred, and the cap is also what keeps the rung from
 * dominating generation time.
 */
export const REFUTE_MAX = 8;

export interface HumanSolve {
  solved: boolean;
  hardest: TechniqueLevel | typeof BEYOND;
  counts: number[];
  owner: Owner;
}

/** Turning rungs off is how the ladder gets ranked — see docs/PLAN.md §7. */
export interface SolveOpts { cands?: Cand[][]; rungs?: readonly boolean[] }

export function humanSolve(n: number, clues: readonly Clue[], opts: SolveOpts = {}): HumanSolve {
  const candidates = opts.cands ?? buildCandidates(n, clues);
  const on = opts.rungs ?? [true, true, true, true, true];
  const full = fullMask(n);
  const alive: Cand[][] = candidates.map((list) => list.slice());
  const placed = new Array<Rect | null>(clues.length).fill(null);
  const counts = [0, 0, 0, 0, 0];
  let hardest: TechniqueLevel | typeof BEYOND = 0;
  const used = emptyMask(n);
  let stuck = false;

  const bump = (lvl: TechniqueLevel): void => { counts[lvl]!++; if (lvl > hardest) hardest = lvl; };
  const unplaced = (): number[] => clues.map((_, k) => k).filter((k) => !placed[k]);

  function place(k: number, cand: Cand): void {
    placed[k] = cand.rect;
    orInto(used, cand.m);
    alive[k] = [cand];
    for (const j of unplaced()) {
      alive[j] = alive[j]!.filter((c) => !overlaps(c.m, cand.m));
    }
  }

  function onlyRectangle(): boolean {
    for (const k of unplaced()) {
      const live = alive[k]!;
      if (live.length === 0) { stuck = true; return false; }
      if (live.length === 1) { place(k, live[0]!); bump(1); return true; }
    }
    return false;
  }

  /** Cells every one of a clue's candidates covers belong to it, so nobody else may. */
  function sharedCells(): boolean {
    for (const k of unplaced()) {
      const live = alive[k]!;
      if (live.length < 2) continue;
      const must = live[0]!.m.slice();
      for (let i = 1; i < live.length && !isEmpty(must); i++) andInto(must, live[i]!.m);
      if (isEmpty(must)) continue;

      let changed = false;
      for (const j of unplaced()) {
        if (j === k) continue;
        const kept = alive[j]!.filter((c) => !overlaps(c.m, must));
        if (kept.length !== alive[j]!.length) { alive[j] = kept; changed = true; }
      }
      if (changed) { bump(3); return true; }
    }
    return false;
  }

  /** A free cell only one clue can still reach is a cell that clue has to take. */
  function onlyOwner(): boolean {
    const open = unplaced();
    const reach = open.map((k) => {
      const m = emptyMask(n);
      for (const c of alive[k]!) orInto(m, c.m);
      return m;
    });

    for (let x = 0; x < n * n; x++) {
      if (hasBit(used, x)) continue;
      let owner = -1, seen = 0;
      for (let t = 0; t < open.length; t++) {
        if (hasBit(reach[t]!, x)) { owner = t; seen++; if (seen > 1) break; }
      }
      if (seen === 0) { stuck = true; return false; }
      if (seen > 1) continue;

      const k = open[owner]!;
      const kept = alive[k]!.filter((c) => hasBit(c.m, x));
      if (kept.length !== alive[k]!.length) { alive[k] = kept; bump(2); return true; }
    }
    return false;
  }

  /**
   * Try a placement: if it leaves another clue with nowhere to go, or leaves a
   * cell no remaining candidate can cover, it is impossible and can be struck
   * out without guessing. Bounded by REFUTE_MAX — this is the rung a person
   * reaches for, not an exhaustive search.
   */
  function refutation(): boolean {
    const open = unplaced();
    for (const k of open) {
      const live = alive[k]!;
      if (live.length < 2 || live.length > REFUTE_MAX) continue;

      const kept = live.filter((cand) => {
        const reach = emptyMask(n);
        for (const j of open) {
          if (j === k) continue;
          let any = false;
          for (const c of alive[j]!) {
            if (overlaps(c.m, cand.m)) continue;
            orInto(reach, c.m); any = true;
          }
          if (!any) return false;                       // starves clue j
        }
        // Every cell still free once `cand` is down must be reachable.
        orInto(reach, used); orInto(reach, cand.m);
        return covers(reach, full);
      });

      if (kept.length > 0 && kept.length < live.length) {
        alive[k] = kept;
        bump(4);
        return true;
      }
    }
    return false;
  }

  const ladder = [onlyRectangle, onlyOwner, sharedCells, refutation]
    .filter((_, k) => on[k + 1] !== false);
  for (;;) {
    if (unplaced().length === 0) break;
    let progress = false;
    for (const step of ladder) {
      if (stuck) break;
      if (step()) { progress = true; break; }
    }
    if (stuck || !progress) break;
  }

  const solved = !stuck && unplaced().length === 0 && equals(used, full);
  if (!solved) hardest = BEYOND;

  const owner = emptyOwner(n);
  placed.forEach((rect, k) => { if (rect) for (const i of rectCells(rect, n)) owner[i] = k; });

  return { solved, hardest, counts, owner };
}

import { emptyOwner, rectCells, type Clue, type Owner, type Rect } from './grid.js';
import { buildCandidates, type Cand } from './solver.js';

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

function fullMask(n: number): { lo: number; hi: number } {
  const cells = n * n;
  return {
    lo: cells >= 32 ? -1 : (1 << cells) - 1,
    hi: cells <= 32 ? 0 : cells >= 64 ? -1 : (1 << (cells - 32)) - 1,
  };
}

const hasBit = (lo: number, hi: number, i: number): boolean =>
  i < 32 ? (lo & (1 << i)) !== 0 : (hi & (1 << (i - 32))) !== 0;

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
  let usedLo = 0, usedHi = 0;
  let stuck = false;

  const bump = (lvl: TechniqueLevel): void => { counts[lvl]!++; if (lvl > hardest) hardest = lvl; };
  const unplaced = (): number[] => clues.map((_, k) => k).filter((k) => !placed[k]);

  function place(k: number, cand: Cand): void {
    placed[k] = cand.rect;
    usedLo |= cand.lo; usedHi |= cand.hi;
    alive[k] = [cand];
    for (const j of unplaced()) {
      alive[j] = alive[j]!.filter((c) => (c.lo & cand.lo) === 0 && (c.hi & cand.hi) === 0);
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
      let mustLo = live[0]!.lo, mustHi = live[0]!.hi;
      for (let i = 1; i < live.length && (mustLo || mustHi); i++) {
        mustLo &= live[i]!.lo; mustHi &= live[i]!.hi;
      }
      if (mustLo === 0 && mustHi === 0) continue;

      let changed = false;
      for (const j of unplaced()) {
        if (j === k) continue;
        const kept = alive[j]!.filter((c) => (c.lo & mustLo) === 0 && (c.hi & mustHi) === 0);
        if (kept.length !== alive[j]!.length) { alive[j] = kept; changed = true; }
      }
      if (changed) { bump(3); return true; }
    }
    return false;
  }

  /** A free cell only one clue can still reach is a cell that clue has to take. */
  function onlyOwner(): boolean {
    const open = unplaced();
    const reach = open.map((k) => alive[k]!.reduce(
      (m, c) => ({ lo: m.lo | c.lo, hi: m.hi | c.hi }), { lo: 0, hi: 0 },
    ));

    for (let x = 0; x < n * n; x++) {
      if (hasBit(usedLo, usedHi, x)) continue;
      let owner = -1, seen = 0;
      for (let t = 0; t < open.length; t++) {
        if (hasBit(reach[t]!.lo, reach[t]!.hi, x)) { owner = t; seen++; if (seen > 1) break; }
      }
      if (seen === 0) { stuck = true; return false; }
      if (seen > 1) continue;

      const k = open[owner]!;
      const kept = alive[k]!.filter((c) => hasBit(c.lo, c.hi, x));
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
        let reachLo = 0, reachHi = 0;
        for (const j of open) {
          if (j === k) continue;
          let anyLo = 0, anyHi = 0, any = false;
          for (const c of alive[j]!) {
            if ((c.lo & cand.lo) !== 0 || (c.hi & cand.hi) !== 0) continue;
            anyLo |= c.lo; anyHi |= c.hi; any = true;
          }
          if (!any) return false;                       // starves clue j
          reachLo |= anyLo; reachHi |= anyHi;
        }
        const freeLo = full.lo & ~usedLo & ~cand.lo;
        const freeHi = full.hi & ~usedHi & ~cand.hi;
        return (freeLo & ~reachLo) === 0 && (freeHi & ~reachHi) === 0;
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

  const solved = !stuck && unplaced().length === 0 && usedLo === full.lo && usedHi === full.hi;
  if (!solved) hardest = BEYOND;

  const owner = emptyOwner(n);
  placed.forEach((rect, k) => { if (rect) for (const i of rectCells(rect, n)) owner[i] = k; });

  return { solved, hardest, counts, owner };
}

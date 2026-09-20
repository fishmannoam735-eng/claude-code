import {
  CELLS, COLS, CROWN, N, NEIGHBOURS, ROWS, colOf, emptyGrid, regionCells, rowOf,
  type Grid, type Regions,
} from './grid.js';

/**
 * A human-technique solver. It never guesses, so the hardest technique it
 * needs is the puzzle's difficulty; if the ladder runs out it rates BEYOND.
 */
export const TECHNIQUES = [
  'none',
  'only cell left',     // a row, column or region with one candidate
  'region lock',        // a region confined to one line, or a line to one region
  'crowded neighbour',  // every way of serving some unit would touch this cell
  'subset counting',    // k regions confined to k lines, or the reverse
] as const;
export type TechniqueLevel = 0 | 1 | 2 | 3 | 4;
export const BEYOND: 5 = 5;

export interface HumanSolve {
  solved: boolean;
  hardest: TechniqueLevel | typeof BEYOND;
  counts: number[];
  grid: Grid;
}

export function humanSolve(regions: Regions): HumanSolve {
  const regs = regionCells(regions);
  const cand = new Array<boolean>(CELLS).fill(true);
  const grid = emptyGrid();
  const counts = [0, 0, 0, 0, 0];
  let hardest: TechniqueLevel | typeof BEYOND = 0;
  let placedCount = 0;

  const bump = (lvl: TechniqueLevel): void => { counts[lvl]!++; if (lvl > hardest) hardest = lvl; };
  const candsOf = (cells: readonly number[]): number[] => cells.filter((i) => cand[i]);
  const hasCrown = (cells: readonly number[]): boolean => cells.some((i) => grid[i] === CROWN);

  /** Every unit that must hold exactly one crown: 8 rows, 8 columns, 8 regions. */
  const lines = (): readonly (readonly number[])[] => [...ROWS, ...COLS];
  const allUnits = (): readonly (readonly number[])[] => [...ROWS, ...COLS, ...regs];

  function place(i: number): void {
    grid[i] = CROWN;
    placedCount++;
    const r = rowOf(i), c = colOf(i), g = regions[i]!;
    for (let j = 0; j < CELLS; j++) {
      if (j === i) continue;
      if (rowOf(j) === r || colOf(j) === c || regions[j] === g) cand[j] = false;
    }
    for (const j of NEIGHBOURS[i]!) cand[j] = false;
  }

  function onlyCellLeft(): boolean {
    for (const unit of allUnits()) {
      if (hasCrown(unit)) continue;
      const cs = candsOf(unit);
      if (cs.length === 1) { place(cs[0]!); bump(1); return true; }
    }
    return false;
  }

  /**
   * If a region's candidates all sit in one row, that row's crown belongs to
   * that region — so the rest of the row is out. The same holds with rows and
   * regions swapped, and with columns in place of rows.
   */
  function regionLock(): boolean {
    const sameLine = (cs: number[], of: (i: number) => number): number =>
      cs.every((i) => of(i) === of(cs[0]!)) ? of(cs[0]!) : -1;

    for (const reg of regs) {
      if (hasCrown(reg)) continue;
      const cs = candsOf(reg);
      if (cs.length < 2) continue;
      for (const [of, unitsOfKind] of [[rowOf, ROWS], [colOf, COLS]] as const) {
        const line = sameLine(cs, of);
        if (line === -1) continue;
        let changed = false;
        for (const j of unitsOfKind[line]!) {
          if (cand[j] && !reg.includes(j)) { cand[j] = false; changed = true; }
        }
        if (changed) { bump(2); return true; }
      }
    }

    for (const line of lines()) {
      if (hasCrown(line)) continue;
      const cs = candsOf(line);
      if (cs.length < 2) continue;
      const g = regions[cs[0]!]!;
      if (!cs.every((i) => regions[i] === g)) continue;
      let changed = false;
      for (const j of regs[g]!) {
        if (cand[j] && !line.includes(j)) { cand[j] = false; changed = true; }
      }
      if (changed) { bump(2); return true; }
    }

    return false;
  }

  /**
   * Every unit must hold a crown somewhere. If every remaining way of serving
   * some unit would put a crown next to cell x, then x cannot be a crown
   * itself — whatever that unit does, it would touch.
   *
   * Without this, adjacency only ever propagates *after* a crown is placed,
   * which is why the ladder used to stall with two or fewer crowns down on
   * three puzzles in four. It is the deduction that makes an empty board
   * yield anything at all.
   */
  function crowdedNeighbour(): boolean {
    for (const unit of allUnits()) {
      if (hasCrown(unit)) continue;
      const cs = candsOf(unit);
      if (cs.length === 0 || cs.length > 4) continue;

      // Cells adjacent to every candidate of this unit.
      let common: number[] = [...NEIGHBOURS[cs[0]!]!];
      for (let k = 1; k < cs.length && common.length; k++) {
        const near = new Set(NEIGHBOURS[cs[k]!]!);
        common = common.filter((x) => near.has(x));
      }

      let changed = false;
      for (const x of common) {
        if (cand[x] && grid[x] !== CROWN) { cand[x] = false; changed = true; }
      }
      if (changed) { bump(3); return true; }
    }
    return false;
  }

  /**
   * Counting in both directions, for k of 2 and 3.
   *
   * If k regions between them can only reach k lines, those lines are spoken
   * for and no other region may use them. And symmetrically: if k lines can
   * only be served by k regions, those regions are used up there and have
   * nothing left to give anywhere else.
   *
   * The second direction matters more than it looks. Without it four puzzles
   * in five came out "beyond the ladder", which says the solver was weak
   * rather than the puzzles being hard.
   */
  function subsetCounting(): boolean {
    const openRegions = regs
      .map((cells, g) => ({ g, cells, cs: candsOf(cells) }))
      .filter((x) => !hasCrown(x.cells) && x.cs.length > 0);

    for (const [of, unitsOfKind] of [[rowOf, ROWS], [colOf, COLS]] as const) {
      // k regions → k lines
      for (let k = 2; k <= 3; k++) {
        for (const pick of choose(openRegions.length, k)) {
          const chosen = pick.map((idx) => openRegions[idx]!);
          const linesUsed = new Set<number>();
          for (const x of chosen) for (const i of x.cs) linesUsed.add(of(i));
          if (linesUsed.size !== k) continue;

          const ownRegions = new Set(chosen.map((x) => x.g));
          let changed = false;
          for (const line of linesUsed) {
            for (const j of unitsOfKind[line]!) {
              if (cand[j] && !ownRegions.has(regions[j]!)) { cand[j] = false; changed = true; }
            }
          }
          if (changed) { bump(4); return true; }
        }
      }

      // k lines → k regions
      const openLines = unitsOfKind
        .map((cells, idx) => ({ idx, cells, cs: candsOf(cells) }))
        .filter((x) => !hasCrown(x.cells) && x.cs.length > 0);

      for (let k = 2; k <= 3; k++) {
        for (const pick of choose(openLines.length, k)) {
          const chosen = pick.map((idx) => openLines[idx]!);
          const regionsUsed = new Set<number>();
          for (const x of chosen) for (const i of x.cs) regionsUsed.add(regions[i]!);
          if (regionsUsed.size !== k) continue;

          const ownLines = new Set(chosen.map((x) => x.idx));
          let changed = false;
          for (const g of regionsUsed) {
            for (const j of regs[g]!) {
              if (cand[j] && !ownLines.has(of(j))) { cand[j] = false; changed = true; }
            }
          }
          if (changed) { bump(4); return true; }
        }
      }
    }
    return false;
  }

  for (;;) {
    if (placedCount === N) return { solved: true, hardest, counts, grid };
    if (allUnits().some((u) => !hasCrown(u) && candsOf(u).length === 0)) {
      return { solved: false, hardest: BEYOND, counts, grid };
    }
    if (onlyCellLeft()) continue;
    if (regionLock()) continue;
    if (crowdedNeighbour()) continue;
    if (subsetCounting()) continue;
    return { solved: false, hardest: BEYOND, counts, grid };
  }
}

/** Index combinations of size k, memoised per (n, k) since the sizes are tiny. */
const comboCache = new Map<string, number[][]>();
function choose(n: number, k: number): number[][] {
  const key = `${n}:${k}`;
  const hit = comboCache.get(key);
  if (hit) return hit;
  const out: number[][] = [];
  const cur: number[] = [];
  (function walk(start: number): void {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = start; i < n; i++) { cur.push(i); walk(i + 1); cur.pop(); }
  })(0);
  comboCache.set(key, out);
  return out;
}

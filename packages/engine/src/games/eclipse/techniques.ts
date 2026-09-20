import {
  CELLS, HALF, LINES, LINES_OF, MOON, N, SUN, edgesByCell, other,
  type Edge, type Grid,
} from './grid.js';

/**
 * A human-technique solver. It never guesses, so the hardest technique it
 * needs is the puzzle's difficulty; if the ladder runs out it rates BEYOND.
 */
export const TECHNIQUES = [
  'none',
  'edge rule',        // a = or × badge next to a known cell
  'no three',         // a pair forces its neighbours; a gap between twins forces the middle
  'line count',       // a line already holds three of a symbol
  'line lookahead',   // one value makes the rest of the line unsatisfiable
] as const;
export type TechniqueLevel = 0 | 1 | 2 | 3 | 4;
export const BEYOND: 5 = 5;

export interface HumanSolve {
  solved: boolean;
  hardest: TechniqueLevel | typeof BEYOND;
  counts: number[];
  grid: Grid;
}

/** Can the remaining blanks of `line` still be filled legally if we commit `g`? */
function lineSatisfiable(g: Grid, line: readonly number[]): boolean {
  const blanks: number[] = [];
  let sun = 0, moon = 0;
  for (const i of line) {
    if (g[i] === SUN) sun++;
    else if (g[i] === MOON) moon++;
    else blanks.push(i);
  }
  if (sun > HALF || moon > HALF) return false;
  if (blanks.length === 0) return sun === HALF && moon === HALF;

  const needSun = HALF - sun;
  const vals = line.map((i) => g[i]!);

  // Try every assignment of the remaining blanks — at most 2^6, and usually far less.
  const idx = blanks.map((i) => line.indexOf(i));
  const total = 1 << blanks.length;
  for (let mask = 0; mask < total; mask++) {
    let ones = 0;
    for (let b = 0; b < blanks.length; b++) if (mask & (1 << b)) ones++;
    if (ones !== needSun) continue;
    for (let b = 0; b < blanks.length; b++) vals[idx[b]!] = (mask & (1 << b)) ? SUN : MOON;
    let ok = true;
    for (let k = 0; k + 2 < N; k++) {
      if (vals[k] === vals[k + 1] && vals[k + 1] === vals[k + 2]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

export function humanSolve(givens: Grid, edges: readonly Edge[]): HumanSolve {
  const g = givens.slice();
  const edgeIdx = edgesByCell(edges);
  const counts = [0, 0, 0, 0, 0];
  let hardest: TechniqueLevel | typeof BEYOND = 0;
  const bump = (lvl: TechniqueLevel): void => { counts[lvl]!++; if (lvl > hardest) hardest = lvl; };

  const at = (r: number, c: number): number =>
    (r < 0 || r >= N || c < 0 || c >= N ? -1 : g[r * N + c]!);

  function edgeRule(): boolean {
    for (let i = 0; i < CELLS; i++) {
      if (g[i] === 0) continue;
      for (const k of edgeIdx[i]!) {
        const e = edges[k]!;
        const j = e.a === i ? e.b : e.a;
        if (g[j] !== 0) continue;
        g[j] = e.same ? g[i]! : other(g[i]!);
        bump(1);
        return true;
      }
    }
    return false;
  }

  function noThree(): boolean {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        if (g[i] !== 0) continue;
        // A pair on either side forces this cell to the other symbol.
        for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
          const a = at(r - 2 * dr, c - 2 * dc), b = at(r - dr, c - dc);
          if (a > 0 && a === b) { g[i] = other(a); bump(2); return true; }
          const d = at(r + dr, c + dc), e2 = at(r + 2 * dr, c + 2 * dc);
          if (d > 0 && d === e2) { g[i] = other(d); bump(2); return true; }
          // Twins with this cell between them.
          const p = at(r - dr, c - dc), q = at(r + dr, c + dc);
          if (p > 0 && p === q) { g[i] = other(p); bump(2); return true; }
        }
      }
    }
    return false;
  }

  function lineCount(): boolean {
    for (const line of LINES) {
      let sun = 0, moon = 0;
      for (const i of line) { if (g[i] === SUN) sun++; else if (g[i] === MOON) moon++; }
      if (sun !== HALF && moon !== HALF) continue;
      const fill = sun === HALF ? MOON : SUN;
      for (const i of line) {
        if (g[i] === 0) { g[i] = fill; bump(3); return true; }
      }
    }
    return false;
  }

  function lookahead(): boolean {
    for (let i = 0; i < CELLS; i++) {
      if (g[i] !== 0) continue;
      for (const v of [SUN, MOON]) {
        g[i] = v;
        const dead = LINES_OF[i]!.some((ln) => !lineSatisfiable(g, LINES[ln]!));
        g[i] = 0;
        if (dead) { g[i] = other(v); bump(4); return true; }
      }
    }
    return false;
  }

  for (;;) {
    if (g.every((v) => v !== 0)) return { solved: true, hardest, counts, grid: g };
    if (edgeRule()) continue;
    if (noThree()) continue;
    if (lineCount()) continue;
    if (lookahead()) continue;
    return { solved: false, hardest: BEYOND, counts, grid: g };
  }
}

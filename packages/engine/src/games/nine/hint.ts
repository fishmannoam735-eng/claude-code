import { PEERS, UNITS, UNITS_OF, colOf, rowOf, type Grid } from './grid.js';

/**
 * A hint is the next placement a person could find themselves, with the
 * reasoning that gets them there, in the order they would think it.
 *
 * It works only from the digits on the board, never from the player's pencil
 * marks (those may be incomplete or wrong) and never from the solution, except
 * as a last resort when the board needs more than the techniques below.
 */
export interface Hint {
  /** The cell to fill and the digit that goes there. */
  cell: number;
  digit: number;
  /** One sentence per step: any eliminations first, then the placement. */
  steps: string[];
  /** Cells worth looking at, for the board to light up (includes `cell`). */
  focus: number[];
  /** True when no technique applied and the cell is simply revealed. */
  revealed: boolean;
}

const ALL = 0b1111111110;
const bit = (d: number): number => 1 << d;
const popcount = (x: number): number => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
const digitsOf = (m: number): number[] => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & bit(d));

const BOX_NAMES = [
  'top-left box', 'top-middle box', 'top-right box',
  'middle-left box', 'centre box', 'middle-right box',
  'bottom-left box', 'bottom-middle box', 'bottom-right box',
];

export const cellName = (i: number): string => `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;
const unitName = (u: number): string =>
  u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `the ${BOX_NAMES[u - 18]}`;
const cap = (s: string): string => s[0]!.toUpperCase() + s.slice(1);
const a = (d: number): string => (d === 8 ? `an ${d}` : `a ${d}`);
const sees = (x: number, y: number): boolean => x !== y && PEERS[x]!.includes(y);
const sharedUnit = (x: number, y: number): number => UNITS_OF[x]!.find((u) => UNITS_OF[y]!.includes(u))!;

/** Candidates for every empty cell, from the placed digits alone. */
export function candidates(grid: Grid): number[] {
  const cand = grid.map((v) => (v === 0 ? ALL : 0));
  for (let i = 0; i < 81; i++) if (grid[i]) for (const j of PEERS[i]!) cand[j]! &= ~bit(grid[i]!);
  return cand;
}

/** The next step for this board, or null if it is full. `solution` is the fallback. */
export function nextHint(grid: Grid, solution: Grid): Hint | null {
  if (grid.every((v) => v !== 0)) return null;
  const cand = candidates(grid);
  // Each elimination records which (cell, digit) facts it removed and which it
  // relied on, so the hint can keep only the steps the placement really needs.
  interface Step { text: string; hits: string[]; uses: string[]; focus: number[] }
  const log: Step[] = [];
  const key = (i: number, d: number): string => `${i}:${d}`;
  const keysIn = (cells: readonly number[], ds: readonly number[]): string[] =>
    cells.flatMap((i) => ds.map((d) => key(i, d)));
  const NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const done = (cell: number, digit: number, why: (prior: boolean) => string, uses: string[], more: number[] = []): Hint => {
    const needed = new Set(uses);
    const kept: Step[] = [];
    for (let k = log.length - 1; k >= 0; k--) {
      const st = log[k]!;
      if (st.hits.some((h) => needed.has(h))) { kept.unshift(st); st.uses.forEach((u) => needed.add(u)); }
    }
    const focus = new Set([...kept.flatMap((st) => st.focus), ...more, cell]);
    return { cell, digit, steps: [...kept.map((st) => st.text), why(kept.length > 0)], focus: [...focus], revealed: false };
  };

  function single(): Hint | null {
    // A number with only one home in a box, row or column reads most naturally.
    for (const u of [...UNITS.keys()].sort((a, b) => (b >= 18 ? 1 : 0) - (a >= 18 ? 1 : 0))) {
      const cells = UNITS[u]!;
      for (let d = 1; d <= 9; d++) {
        if (cells.some((i) => grid[i] === d)) continue;
        const spots = cells.filter((i) => grid[i] === 0 && cand[i]! & bit(d));
        if (spots.length === 1) {
          const empty = cells.filter((i) => grid[i] === 0);
          return done(spots[0]!, d, (prior) =>
            `In ${unitName(u)}, the ${d} has only one place left: ${cellName(spots[0]!)}. Every other empty cell there already sees ${a(d)} in its row, column or box${prior ? ', or was ruled out above' : ''}.`,
            keysIn(empty, [d]), empty);
        }
      }
    }
    for (let i = 0; i < 81; i++) {
      if (grid[i] === 0 && popcount(cand[i]!) === 1) {
        const d = digitsOf(cand[i]!)[0]!;
        return done(i, d, (prior) =>
          `${cap(cellName(i))} can only be ${d}: ${prior ? 'with the steps above, ' : ''}its row, column and box rule out every other number.`,
          keysIn([i], NINE));
      }
    }
    return null;
  }

  function locked(): boolean {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (let bx = 18; bx < 27; bx++) {
        const cells = UNITS[bx]!.filter((i) => grid[i] === 0 && cand[i]! & b);
        if (cells.length < 2) continue;
        for (const k of [0, 1] as const) {
          const line = UNITS_OF[cells[0]!]![k]!;
          if (!cells.every((i) => UNITS_OF[i]![k] === line)) continue;
          const hit = UNITS[line]!.filter((j) => grid[j] === 0 && cand[j]! & b && !UNITS[bx]!.includes(j));
          if (!hit.length) continue;
          for (const j of hit) cand[j]! &= ~b;
          log.push({
            text: `In ${unitName(bx)}, the ${d} can only go in ${unitName(line)}, so no other cell of ${unitName(line)} can be ${d}.`,
            hits: keysIn(hit, [d]), uses: keysIn(UNITS[bx]!, [d]), focus: cells,
          });
          return true;
        }
      }
      for (let ln = 0; ln < 18; ln++) {
        const cells = UNITS[ln]!.filter((i) => grid[i] === 0 && cand[i]! & b);
        if (cells.length < 2) continue;
        const box = UNITS_OF[cells[0]!]![2]!;
        if (!cells.every((i) => UNITS_OF[i]![2] === box)) continue;
        const hit = UNITS[box]!.filter((j) => grid[j] === 0 && cand[j]! & b && !UNITS[ln]!.includes(j));
        if (!hit.length) continue;
        for (const j of hit) cand[j]! &= ~b;
        log.push({
          text: `In ${unitName(ln)}, the ${d} can only go inside ${unitName(box)}, so the rest of that box can't be ${d}.`,
          hits: keysIn(hit, [d]), uses: keysIn(UNITS[ln]!, [d]), focus: cells,
        });
        return true;
      }
    }
    return false;
  }

  function pair(): boolean {
    for (let u = 0; u < 27; u++) {
      const twos = UNITS[u]!.filter((i) => grid[i] === 0 && popcount(cand[i]!) === 2);
      for (let a = 0; a < twos.length; a++) {
        for (let z = a + 1; z < twos.length; z++) {
          const m = cand[twos[a]!]!;
          if (cand[twos[z]!] !== m) continue;
          const hit = UNITS[u]!.filter((j) => j !== twos[a] && j !== twos[z] && grid[j] === 0 && cand[j]! & m);
          if (!hit.length) continue;
          for (const j of hit) cand[j]! &= ~m;
          const [x, y] = digitsOf(m);
          const both = [twos[a]!, twos[z]!];
          log.push({
            text: `${cap(cellName(both[0]!))} and ${cellName(both[1]!)} can only be ${x} or ${y}, so no other cell in ${unitName(u)} can be ${x} or ${y}.`,
            hits: keysIn(hit, [x!, y!]), uses: keysIn(both, NINE), focus: both,
          });
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Two "this number goes in one of these two cells" facts, joined where one
   * end of each can see the other: those two ends can't both hold the number,
   * so at least one of the far ends does, and any cell seeing both far ends
   * can't. (A skyscraper or turbot fish, explained without the names.)
   */
  function chain(): boolean {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      const links: { u: number; ends: [number, number] }[] = [];
      for (let u = 0; u < 27; u++) {
        const spots = UNITS[u]!.filter((i) => grid[i] === 0 && cand[i]! & b);
        if (spots.length === 2) links.push({ u, ends: [spots[0]!, spots[1]!] });
      }
      for (const l1 of links) for (const l2 of links) {
        if (l1 === l2) continue;
        for (const [far1, near1] of [l1.ends, [l1.ends[1], l1.ends[0]] as [number, number]]) {
          for (const [near2, far2] of [l2.ends, [l2.ends[1], l2.ends[0]] as [number, number]]) {
            const four = new Set([far1, near1, near2, far2]);
            if (four.size < 4 || !sees(near1, near2) || sees(far1, far2)) continue;
            const hit = [];
            for (let j = 0; j < 81; j++) {
              if (grid[j] === 0 && cand[j]! & b && !four.has(j) && sees(j, far1) && sees(j, far2)) hit.push(j);
            }
            if (!hit.length) continue;
            for (const j of hit) cand[j]! &= ~b;
            log.push({
              hits: keysIn(hit, [d]),
              uses: [...keysIn(UNITS[l1.u]!, [d]), ...keysIn(UNITS[l2.u]!, [d])],
              focus: [...four],
              text:
              `Follow the ${d}s. In ${unitName(l1.u)} the ${d} is at ${cellName(far1)} or ${cellName(near1)}, ` +
              `and in ${unitName(l2.u)} it is at ${cellName(near2)} or ${cellName(far2)}. ` +
              `${cap(cellName(near1))} and ${cellName(near2)} share ${unitName(sharedUnit(near1, near2))}, so they can't both be ${d}. ` +
              `That means ${cellName(far1)} or ${cellName(far2)} is ${d}, and ${hit.map(cellName).join(' and ')}, which ${hit.length === 1 ? 'sees' : 'see'} both, can't be ${d}.`,
            });
            return true;
          }
        }
      }
    }
    return false;
  }

  for (let guard = 0; guard < 60; guard++) {
    const h = single();
    if (h) return h;
    if (!locked() && !pair() && !chain()) break;
  }

  // Beyond these techniques: show the most constrained cell from the answer,
  // which is the one a long chain would most likely end on.
  let best = -1;
  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0 && (best < 0 || popcount(cand[i]!) < popcount(cand[best]!))) best = i;
  }
  const d = solution[best]!;
  return {
    cell: best, digit: d, revealed: true, focus: [best],
    steps: [`This spot needs a long chain of reasoning, so here's a nudge instead: ${cellName(best)} is ${d}. It can only be ${digitsOf(cand[best]!).join(' or ')}, and ${d} is the one that works.`],
  };
}

import { PEERS, UNITS, UNITS_OF, colOf, rowOf, type Grid } from './grid.js';

/**
 * A hint is the next placement a person could find themselves, with the
 * reasoning that gets them there, in the order they would think it.
 *
 * It works only from the digits on the board, never from the player's pencil
 * marks (those may be incomplete or wrong) and never from the solution, except
 * as a last resort when the board needs more than the techniques below.
 */
/**
 * One row of a hint: a short sentence and the squares it is about, so the
 * board can light up exactly what that sentence talks about.
 */
export interface HintStep {
  text: string;
  /** Squares the sentence points at (the cells to look at). */
  focus: number[];
  /** Squares where the number is ruled out by this sentence. */
  out?: number[];
}

export interface Hint {
  /** The cell to fill and the digit that goes there. */
  cell: number;
  digit: number;
  /** One row per step, in reading order: eliminations first, then the placement. */
  steps: HintStep[];
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
  interface Step { rows: HintStep[]; hits: string[]; uses: string[]; focus: number[] }
  const log: Step[] = [];
  const key = (i: number, d: number): string => `${i}:${d}`;
  const keysIn = (cells: readonly number[], ds: readonly number[]): string[] =>
    cells.flatMap((i) => ds.map((d) => key(i, d)));
  const NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  /** A placed copy of `d` that each of `cells` can see, one per cell, without repeats. */
  const blockersOf = (cells: readonly number[], d: number): number[] => {
    const out = new Set<number>();
    for (const i of cells) {
      const b = PEERS[i]!.find((j) => grid[j] === d);
      if (b !== undefined) out.add(b);
    }
    return [...out];
  };

  const done = (cell: number, digit: number, why: (prior: boolean) => HintStep[], uses: string[], more: number[] = []): Hint => {
    const needed = new Set(uses);
    const kept: Step[] = [];
    for (let k = log.length - 1; k >= 0; k--) {
      const st = log[k]!;
      if (st.hits.some((h) => needed.has(h))) { kept.unshift(st); st.uses.forEach((u) => needed.add(u)); }
    }
    const focus = new Set([...kept.flatMap((st) => st.focus), ...more, cell]);
    return { cell, digit, steps: [...kept.flatMap((st) => st.rows), ...why(kept.length > 0)], focus: [...focus], revealed: false };
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
          const others = empty.filter((i) => i !== spots[0]);
          const seen = others.filter((i) => blockersOf([i], d).length > 0);
          return done(spots[0]!, d, (prior) => [
            { text: `Look at ${unitName(u)}. It still needs ${a(d)}.`, focus: empty },
            ...(others.length ? [{
              text: seen.length === others.length || !prior
                ? `The marked squares can't be ${d}: each already sees ${a(d)} in its row, column or box.`
                : `The marked squares can't be ${d}: they see ${a(d)}, or were ruled out above.`,
              focus: blockersOf(others, d), out: others,
            }] : []),
            { text: `So the ${d} goes in ${cellName(spots[0]!)}.`, focus: [spots[0]!] },
          ], keysIn(empty, [d]), empty);
        }
      }
    }
    for (let i = 0; i < 81; i++) {
      if (grid[i] === 0 && popcount(cand[i]!) === 1) {
        const d = digitsOf(cand[i]!)[0]!;
        const taken = NINE.filter((x) => x !== d && PEERS[i]!.some((j) => grid[j] === x));
        const blockers = taken.flatMap((x) => blockersOf([i], x));
        return done(i, d, (prior) => [
          { text: `Look at ${cellName(i)}. Its row, column and box already hold ${taken.join(', ')}.`, focus: [i, ...blockers] },
          { text: `${prior ? 'With the steps above, the' : 'The'} only number left for it is ${d}.`, focus: [i] },
        ], keysIn([i], NINE));
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
            rows: [
              { text: `In ${unitName(bx)}, the ${d} can only go in these squares, all in ${unitName(line)}.`, focus: cells },
              { text: `So the rest of ${unitName(line)} can't be ${d}.`, focus: cells, out: hit },
            ],
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
          rows: [
            { text: `In ${unitName(ln)}, the ${d} can only go in these squares, all inside ${unitName(box)}.`, focus: cells },
            { text: `So the rest of that box can't be ${d}.`, focus: cells, out: hit },
          ],
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
            rows: [
              { text: `In ${unitName(u)}, these two squares can only be ${x} or ${y}, so between them they take both.`, focus: both },
              { text: `So no other square in ${unitName(u)} can be ${x} or ${y}.`, focus: both, out: hit },
            ],
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
              rows: [
                { text: `Follow the ${d}s. In ${unitName(l1.u)} the ${d} can only be in one of these two squares.`, focus: [far1, near1] },
                { text: `In ${unitName(l2.u)} it can only be in one of these two.`, focus: [near2, far2] },
                { text: `These two share ${unitName(sharedUnit(near1, near2))}, so they can't both be ${d}.`, focus: [near1, near2] },
                { text: `So at least one of these two is ${d}, and any square that sees both can't be.`, focus: [far1, far2], out: hit },
              ],
            });
            return true;
          }
        }
      }
    }
    return false;
  }

  /** Two numbers that fit only the same two squares of a unit: those squares hold nothing else. */
  function hiddenPair(): boolean {
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u]!;
      const where = (d: number): number[] => cells.filter((i) => grid[i] === 0 && cand[i]! & bit(d));
      for (let x = 1; x <= 9; x++) {
        const wx = where(x);
        if (wx.length !== 2) continue;
        for (let y = x + 1; y <= 9; y++) {
          const wy = where(y);
          if (wy.length !== 2 || wy[0] !== wx[0] || wy[1] !== wx[1]) continue;
          const keep = bit(x) | bit(y);
          const extra = wx.flatMap((i) => digitsOf(cand[i]! & ~keep).map((d) => [i, d] as const));
          if (!extra.length) continue;
          for (const i of wx) cand[i]! &= keep;
          log.push({
            rows: [
              { text: `In ${unitName(u)}, the ${x} and the ${y} both fit only these two squares.`, focus: wx },
              { text: `So these two squares are the ${x} and the ${y}, and can't be anything else (${((o) => `${o.join(', ')} ${o.length === 1 ? 'is' : 'are'}`)([...new Set(extra.map(([, d]) => d))])} out).`, focus: wx },
            ],
            hits: extra.map(([i, d]) => key(i, d)), uses: keysIn(cells, [x, y]), focus: wx,
          });
          return true;
        }
      }
    }
    return false;
  }

  /** Three squares of a unit that between them can only be three numbers. */
  function nakedTriple(): boolean {
    for (let u = 0; u < 27; u++) {
      const open = UNITS[u]!.filter((i) => grid[i] === 0 && popcount(cand[i]!) <= 3);
      for (let p = 0; p < open.length; p++) for (let q = p + 1; q < open.length; q++) for (let r = q + 1; r < open.length; r++) {
        const three = [open[p]!, open[q]!, open[r]!];
        const m = cand[three[0]!]! | cand[three[1]!]! | cand[three[2]!]!;
        if (popcount(m) !== 3) continue;
        const hit = UNITS[u]!.filter((j) => grid[j] === 0 && !three.includes(j) && cand[j]! & m);
        if (!hit.length) continue;
        const ds = digitsOf(m);
        for (const j of hit) cand[j]! &= ~m;
        log.push({
          rows: [
            { text: `In ${unitName(u)}, these three squares can only hold ${ds.join(', ')}, so between them they take all three.`, focus: three },
            { text: `So no other square in ${unitName(u)} can be ${ds.join(', ').replace(/, (\d)$/, ' or $1')}.`, focus: three, out: hit },
          ],
          hits: keysIn(hit, ds), uses: keysIn(three, NINE), focus: three,
        });
        return true;
      }
    }
    return false;
  }

  /**
   * X-wing (size 2) and swordfish (size 3): a number that, in each of `size`
   * rows, fits only within the same `size` columns (or the other way round).
   * Those rows use up that number in those columns, so the rest of each
   * column can't have it.
   */
  function fish(size: 2 | 3): boolean {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (const byRow of [true, false]) {
        const base = byRow ? 0 : 9, cover = byRow ? 9 : 0;
        const lines: { u: number; at: number[] }[] = [];
        for (let k = 0; k < 9; k++) {
          const cells = UNITS[base + k]!.filter((i) => grid[i] === 0 && cand[i]! & b);
          if (cells.length >= 2 && cells.length <= size) {
            lines.push({ u: base + k, at: cells.map((i) => (byRow ? colOf(i) : rowOf(i))) });
          }
        }
        const pick = (from: number, chosen: typeof lines): boolean => {
          if (chosen.length === size) {
            const cols = [...new Set(chosen.flatMap((l) => l.at))];
            if (cols.length !== size) return false;
            const hit: number[] = [];
            for (const c of cols) {
              for (const j of UNITS[cover + c]!) {
                if (grid[j] === 0 && cand[j]! & b && !chosen.some((l) => UNITS[l.u]!.includes(j))) hit.push(j);
              }
            }
            if (!hit.length) return false;
            for (const j of hit) cand[j]! &= ~b;
            const corners = chosen.flatMap((l) => UNITS[l.u]!.filter((i) => grid[i] === 0 && cand[i]! & b));
            const lineWord = byRow ? 'rows' : 'columns', crossWord = byRow ? 'columns' : 'rows';
            const names = chosen.map((l) => unitName(l.u).replace(/^(row|column) /, '')).join(size === 2 ? ' and ' : ', ');
            log.push({
              rows: [
                { text: `Look at the ${d}s in ${lineWord} ${names}. In each, the ${d} fits only in these squares, which sit in just ${size} ${crossWord}.`, focus: corners },
                { text: `Those ${size} ${lineWord} need ${size} ${d}s, and they must use up all ${size} of these ${crossWord}.`, focus: corners },
                { text: `So the rest of those ${crossWord} can't be ${d}.`, focus: corners, out: hit },
              ],
              hits: keysIn(hit, [d]), uses: chosen.flatMap((l) => keysIn(UNITS[l.u]!, [d])), focus: corners,
            });
            return true;
          }
          for (let k = from; k < lines.length; k++) if (pick(k + 1, [...chosen, lines[k]!])) return true;
          return false;
        };
        if (pick(0, [])) return true;
      }
    }
    return false;
  }

  /**
   * XY-wing: a pivot square that is x or y sees a square that is x or z and
   * one that is y or z. Whichever the pivot is, one of the two wings is z,
   * so a square that sees both wings can't be z.
   */
  function xyWing(): boolean {
    const twos = [...Array(81).keys()].filter((i) => grid[i] === 0 && popcount(cand[i]!) === 2);
    for (const pivot of twos) {
      const [x, y] = digitsOf(cand[pivot]!);
      for (const w1 of twos) {
        if (!sees(pivot, w1) || !(cand[w1]! & bit(x!)) || cand[w1] === cand[pivot]) continue;
        const z = digitsOf(cand[w1]! & ~bit(x!))[0]!;
        if (z === y) continue;
        for (const w2 of twos) {
          if (w2 === w1 || !sees(pivot, w2) || cand[w2] !== (bit(y!) | bit(z))) continue;
          const hit = [...Array(81).keys()].filter((j) => grid[j] === 0 && j !== pivot && j !== w1 && j !== w2 && cand[j]! & bit(z) && sees(j, w1) && sees(j, w2));
          if (!hit.length) continue;
          for (const j of hit) cand[j]! &= ~bit(z);
          log.push({
            rows: [
              { text: `This square can only be ${x} or ${y}.`, focus: [pivot] },
              { text: `If it's ${x}, this square it sees must be ${z}.`, focus: [pivot, w1] },
              { text: `If it's ${y}, this other square it sees must be ${z}.`, focus: [pivot, w2] },
              { text: `Either way one of those two is ${z}, so any square that sees both can't be ${z}.`, focus: [w1, w2], out: hit },
            ],
            hits: keysIn(hit, [z]), uses: keysIn([pivot, w1, w2], NINE), focus: [pivot, w1, w2],
          });
          return true;
        }
      }
    }
    return false;
  }

  /**
   * What-if: suppose a square holds a number and follow only the forced
   * moves (a square with one number left, or a number with one place left in
   * a row, column or box). If that runs into a dead end, the supposition was
   * wrong. This is the technique a person reaches for when nothing else
   * works, and it is explained one forced move per row. The shortest such
   * chain on the board is the one shown.
   */
  function whatIf(): boolean {
    const MAX = 14;
    // Try the plain board first: a chain from the placed digits alone needs
    // none of the steps above, so the hint stays short. Only if that finds
    // nothing, use what the steps above have ruled out.
    const plain = candidates(grid);
    for (const base of [plain, cand]) {
      let best: { cell: number; d: number; rows: HintStep[]; len: number } | null = null;
      const order = [...Array(81).keys()].filter((i) => grid[i] === 0).sort((p, q) => popcount(cand[p]!) - popcount(cand[q]!));
      for (const start of order) {
        for (const d of digitsOf(cand[start]!)) {
          const r = suppose(start, d, best ? best.len - 1 : MAX, base);
          if (r && (!best || r.len < best.len)) best = { cell: start, d, ...r };
        }
        if (best && best.len <= 2) break;
      }
      if (!best) continue;
      cand[best.cell]! &= ~bit(best.d);
      log.push({
        rows: [
          { text: `Try a what-if: suppose ${cellName(best.cell)} were ${best.d}.`, focus: [best.cell] },
          ...best.rows,
          { text: `That can't happen, so ${cellName(best.cell)} isn't ${best.d}.`, focus: [best.cell], out: [best.cell] },
        ],
        hits: [key(best.cell, best.d)], uses: base === plain ? [] : keysIn([...Array(81).keys()], NINE), focus: [best.cell],
      });
      return true;
    }
    return false;
  }

  /**
   * A what-if that places a number straight away: a square with only two
   * numbers left (or a number with only two places in a row, column or box),
   * where one choice runs into a dead end, so it must be the other. Worked
   * from the placed digits alone, so it needs no steps before it.
   */
  function directWhatIf(): Hint | null {
    const MAX = 30;
    const plain = candidates(grid);
    type Found = { start: number; d: number; cell: number; digit: number; rows: HintStep[]; len: number; intro: HintStep; outro: HintStep };
    let best = null as Found | null;
    const tryOne = (start: number, d: number, cell: number, digit: number, intro: HintStep, outro: HintStep): void => {
      const r = suppose(start, d, best ? best.len - 1 : MAX, plain);
      if (r && (!best || r.len < best.len)) best = { start, d, cell, digit, ...r, intro, outro };
    };
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0 || popcount(plain[i]!) !== 2) continue;
      const [x, y] = digitsOf(plain[i]!) as [number, number];
      for (const [p, q] of [[x, y], [y, x]] as const) {
        tryOne(i, p, i, q,
          { text: `${cap(cellName(i))} can only be ${x} or ${y}. Try a what-if: suppose it were ${p}.`, focus: [i] },
          { text: `That can't happen, so it isn't ${p}. It must be ${q}.`, focus: [i] });
      }
    }
    for (let u = 0; u < 27; u++) {
      for (let d = 1; d <= 9; d++) {
        if (UNITS[u]!.some((i) => grid[i] === d)) continue;
        const spots = UNITS[u]!.filter((i) => grid[i] === 0 && plain[i]! & bit(d));
        if (spots.length !== 2) continue;
        for (const [p, q] of [[spots[0]!, spots[1]!], [spots[1]!, spots[0]!]] as const) {
          tryOne(p, d, q, d,
            { text: `In ${unitName(u)}, the ${d} can only go in these two squares. Try a what-if: suppose it went in ${cellName(p)}.`, focus: spots },
            { text: `That can't happen, so the ${d} goes in ${cellName(q)}.`, focus: [q] });
        }
      }
    }
    if (!best) return null;
    const b: Found = best;
    return done(b.cell, b.digit, () => [b.intro, ...b.rows, b.outro], [], [b.start]);
  }

  /**
   * Up to five forced moves read fine one per row. A longer run is folded
   * into one row that lights up every square in it, so a what-if never takes
   * more than eight taps to read.
   */
  function fold(rows: HintStep[]): HintStep[] {
    const strip = (r: HintStep): HintStep => ({ text: r.text, focus: r.focus, ...(r.out?.length ? { out: r.out } : {}) });
    const moves = rows.slice(0, -1) as (HintStep & { move: [number, number] })[];
    const end = rows[rows.length - 1]!;
    if (moves.length <= 5) return [...moves.map(strip), end];
    return [
      strip(moves[0]!),
      { text: `Keep following the forced squares, one after another: ${moves.slice(1).map((m) => `${cellName(m.move[0])} is ${m.move[1]}`).join('; ')}.`, focus: moves.slice(1).map((m) => m.move[0]) },
      end,
    ];
  }

  /** Follow forced moves from one supposition; the dead end it hits, if any, within `limit` moves. */
  function suppose(start: number, d0: number, limit: number, base: number[]): { rows: HintStep[]; len: number } | null {
    const g = grid.slice();
    const c = base.slice();
    const rows: HintStep[] = [];
    const put = (i: number, d: number): void => {
      g[i] = d; c[i] = 0;
      for (const j of PEERS[i]!) c[j]! &= ~bit(d);
    };
    put(start, d0);
    for (let n = 0; ; n++) {
      // A dead end: a square with no number left, or a number with no place in a unit.
      for (let i = 0; i < 81; i++) {
        if (g[i] === 0 && c[i] === 0) {
          rows.push({ text: `But then ${cellName(i)} would have no number left.`, focus: [i], out: [i] });
          return { rows: fold(rows), len: n + 1 };
        }
      }
      for (let u = 0; u < 27; u++) {
        for (let d = 1; d <= 9; d++) {
          if (UNITS[u]!.some((i) => g[i] === d)) continue;
          if (!UNITS[u]!.some((i) => g[i] === 0 && c[i]! & bit(d))) {
            rows.push({ text: `But then ${unitName(u)} would have nowhere left for ${a(d)}.`, focus: UNITS[u]!.filter((i) => g[i] === 0), out: UNITS[u]!.filter((i) => g[i] === 0) });
            return { rows: fold(rows), len: n + 1 };
          }
        }
      }
      if (n >= limit) return null;
      // The next forced move: a square with one number left, then a number with one place.
      let move: [number, number, string] | null = null;
      for (let i = 0; i < 81 && !move; i++) {
        if (g[i] === 0 && popcount(c[i]!) === 1) {
          const d = digitsOf(c[i]!)[0]!;
          move = [i, d, `Then ${cellName(i)} would have to be ${d}, the only number left for it.`];
        }
      }
      for (let u = 0; u < 27 && !move; u++) {
        for (let d = 1; d <= 9 && !move; d++) {
          if (UNITS[u]!.some((i) => g[i] === d)) continue;
          const spots = UNITS[u]!.filter((i) => g[i] === 0 && c[i]! & bit(d));
          if (spots.length === 1) move = [spots[0]!, d, `Then the ${d} in ${unitName(u)} would have to go in ${cellName(spots[0]!)}.`];
        }
      }
      if (!move) return null;
      rows.push({ text: move[2], focus: [move[0]], out: [], ...{ move: [move[0], move[1]] } } as HintStep);
      put(move[0], move[1]);
    }
  }

  for (let guard = 0; guard < 200; guard++) {
    const h = single();
    if (h) return h;
    if (locked() || pair() || hiddenPair() || nakedTriple() || fish(2) || chain() || xyWing() || fish(3)) continue;
    const direct = directWhatIf();
    if (direct) return direct;
    if (!whatIf()) break;
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
    steps: [
      { text: `This spot needs a long chain of reasoning, so here's a nudge instead.`, focus: [best] },
      { text: `${cap(cellName(best))} can only be ${digitsOf(cand[best]!).join(' or ')}, and ${d} is the one that works.`, focus: [best] },
    ],
  };
}

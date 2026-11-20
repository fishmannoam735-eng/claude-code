import {
  CELLS, COLS, CROWN, MARK, N, NEIGHBOURS, ROWS, colOf, regionCells, rowOf,
  type Grid, type Regions,
} from './grid.js';

/**
 * A Crowns hint: a few short rows a person can follow on the board, ending
 * in one thing to do (put a crown down, ✕ some squares, or take a wrong
 * crown off).
 *
 * The reasoning works from the crowns on the board and the rules alone. The
 * player's ✕ marks are never trusted as facts, only used to tell which
 * conclusions they already have, so a hint never repeats what they've ✕'d.
 */
export interface CrownsHintStep {
  text: string;
  /** Squares the sentence is about. */
  focus: number[];
  /** Squares this sentence rules out. */
  out?: number[];
}

export type CrownsHintAction =
  | { kind: 'crown'; cell: number }
  | { kind: 'mark'; cells: number[] }
  | { kind: 'clear'; cells: number[] };

export interface CrownsHint {
  steps: CrownsHintStep[];
  action: CrownsHintAction;
  /** True when no technique applied and a crown is simply shown. */
  revealed: boolean;
  /** True when the hint is about a crown that has to come off. */
  wrong: boolean;
}

const rowName = (r: number): string => `row ${r + 1}`;
const colName = (c: number): string => `column ${c + 1}`;

/**
 * The next hint for this board, or null when it is solved. `regionName`
 * names a region the way the board shows it (for example "purple").
 */
export function nextCrownsHint(
  grid: Grid, regions: Regions, solution: Grid,
  regionName: (g: number) => string = (g) => `region ${g + 1}`,
): CrownsHint | null {
  const regs = regionCells(regions);
  const regName = (g: number): string => `the ${regionName(g)} region`;
  const crowns = grid.flatMap((v, i) => (v === CROWN ? [i] : []));
  if (crowns.length === N && crowns.every((i) => solution[i] === CROWN)) return null;

  // 1. A crown that can't be part of the answer comes off first: everything
  // after it would be built on sand.
  for (const i of crowns) {
    if (solution[i] === CROWN) continue;
    const clash = crowns.find((j) => j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || regions[j] === regions[i] || NEIGHBOURS[i]!.includes(j)));
    const why = clash === undefined
      ? 'No full answer has a crown on this square, so it has to come off.'
      : rowOf(clash) === rowOf(i) ? `It shares ${rowName(rowOf(i))} with another crown.`
        : colOf(clash) === colOf(i) ? `It shares ${colName(colOf(i))} with another crown.`
          : regions[clash] === regions[i] ? `It shares ${regName(regions[i]!)} with another crown.`
            : 'It touches another crown, and crowns may not touch, even corner to corner.';
    return {
      wrong: true, revealed: false, action: { kind: 'clear', cells: [i] },
      steps: [
        { text: 'This crown can\'t stay.', focus: [i] },
        { text: why, focus: clash === undefined ? [i] : [i, clash] },
      ],
    };
  }

  // Where a crown could still go, from the crowns alone.
  const cand = new Array<boolean>(CELLS).fill(true);
  const has = (cells: readonly number[]): boolean => cells.some((i) => grid[i] === CROWN);
  const candsOf = (cells: readonly number[]): number[] => cells.filter((i) => cand[i]);
  const attacked = (i: number): number[] => {
    const out = new Set<number>();
    for (let j = 0; j < CELLS; j++) {
      if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || regions[j] === regions[i])) out.add(j);
    }
    for (const j of NEIGHBOURS[i]!) out.add(j);
    return [...out];
  };
  for (const i of crowns) cand[i] = false;

  type Units = { cells: readonly number[]; name: string }[];
  const units: Units = [
    ...ROWS.map((cells, r) => ({ cells, name: rowName(r) })),
    ...COLS.map((cells, c) => ({ cells, name: colName(c) })),
    ...regs.map((cells, g) => ({ cells, name: regName(g) })),
  ];

  /**
   * A finding: rows to read and the squares it rules out. If the player has
   * already ✕'d every one of those squares, it's news to nobody, so it is
   * applied quietly and the search carries on.
   */
  const found = (rows: CrownsHintStep[], hit: number[]): CrownsHint | null => {
    for (const j of hit) cand[j] = false;
    const fresh = hit.filter((j) => grid[j] !== MARK && grid[j] !== CROWN);
    if (!fresh.length) return null;
    return { steps: rows, action: { kind: 'mark', cells: fresh }, revealed: false, wrong: false };
  };

  // 2. Each crown rules out its row, column, colour and the squares touching it.
  function sweep(): CrownsHint | null | false {
    for (const i of crowns) {
      const hit = attacked(i).filter((j) => cand[j]);
      if (!hit.length) continue;
      return found([
        { text: `This crown rules out the rest of its row, its column and its colour, and every square touching it.`, focus: [i], out: hit },
      ], hit);
    }
    return false;
  }

  function onlyCellLeft(): CrownsHint | null {
    for (const u of units) {
      if (has(u.cells)) continue;
      const cs = candsOf(u.cells);
      if (cs.length !== 1) continue;
      const cell = cs[0]!;
      const others = u.cells.filter((j) => j !== cell);
      if (!others.length) {
        return {
          revealed: false, wrong: false, action: { kind: 'crown', cell },
          steps: [{ text: `${cap(u.name)} is a single square, so its crown goes right here.`, focus: [cell] }],
        };
      }
      return {
        revealed: false, wrong: false, action: { kind: 'crown', cell },
        steps: [
          { text: `Look at ${u.name}. It still needs a crown.`, focus: [...u.cells] },
          { text: `Every other square in it is ruled out: each is in line with a crown, touches one, or was crossed off by the steps before.`, focus: [cell], out: others },
          { text: `So the crown goes here.`, focus: [cell] },
        ],
      };
    }
    return null;
  }

  /** A region that fits in one line owns that line's crown, and the other way round. */
  function regionLock(): CrownsHint | null | false {
    for (let g = 0; g < N; g++) {
      const reg = regs[g]!;
      if (has(reg)) continue;
      const cs = candsOf(reg);
      if (cs.length < 2) continue;
      for (const [of, kind, nameOf] of [[rowOf, ROWS, rowName], [colOf, COLS, colName]] as const) {
        const line = of(cs[0]!);
        if (!cs.every((i) => of(i) === line)) continue;
        const hit = kind[line]!.filter((j) => cand[j] && regions[j] !== g);
        if (!hit.length) continue;
        return found([
          { text: `${cap(regName(g))} can only put its crown in ${nameOf(line)}.`, focus: cs },
          { text: `So that crown is ${nameOf(line)}'s crown, and nothing else in ${nameOf(line)} can have one.`, focus: cs, out: hit },
        ], hit);
      }
    }
    for (const [kind, nameOf] of [[ROWS, rowName], [COLS, colName]] as const) {
      for (let k = 0; k < N; k++) {
        const line = kind[k]!;
        if (has(line)) continue;
        const cs = candsOf(line);
        if (cs.length < 2) continue;
        const g = regions[cs[0]!]!;
        if (!cs.every((i) => regions[i] === g)) continue;
        const hit = regs[g]!.filter((j) => cand[j] && !line.includes(j));
        if (!hit.length) continue;
        return found([
          { text: `${cap(nameOf(k))} can only get its crown from ${regName(g)}.`, focus: cs },
          { text: `So that is ${regName(g)}'s crown, and the rest of ${regName(g)} can't have one.`, focus: cs, out: hit },
        ], hit);
      }
    }
    return false;
  }

  /** Every place left for some unit's crown touches the same square, so that square is out. */
  function crowded(): CrownsHint | null | false {
    for (const u of units) {
      if (has(u.cells)) continue;
      const cs = candsOf(u.cells);
      if (cs.length === 0 || cs.length > 4) continue;
      let common: number[] = [...NEIGHBOURS[cs[0]!]!];
      for (let k = 1; k < cs.length && common.length; k++) {
        const near = new Set(NEIGHBOURS[cs[k]!]!);
        common = common.filter((x) => near.has(x));
      }
      const hit = common.filter((x) => cand[x]);
      if (!hit.length) continue;
      return found([
        { text: `${cap(u.name)} must put its crown in one of these squares.`, focus: cs },
        { text: `Wherever it goes, it will touch ${hit.length === 1 ? 'this square' : 'these squares'}, so ${hit.length === 1 ? 'it' : 'they'} can't hold a crown.`, focus: cs, out: hit },
      ], hit);
    }
    return false;
  }

  /** k regions squeezed into k lines use those lines up, and k lines served by only k regions use those regions up. */
  function counting(): CrownsHint | null | false {
    const open = regs.map((cells, g) => ({ g, cs: candsOf(cells), done: has(cells) })).filter((x) => !x.done && x.cs.length > 0);
    for (const [of, kind, nameOf, word] of [[rowOf, ROWS, rowName, 'rows'], [colOf, COLS, colName, 'columns']] as const) {
      for (let k = 2; k <= 3; k++) {
        for (const pick of choose(open.length, k)) {
          const chosen = pick.map((x) => open[x]!);
          const lines = [...new Set(chosen.flatMap((x) => x.cs.map(of)))].sort((p, q) => p - q);
          if (lines.length !== k) continue;
          const own = new Set(chosen.map((x) => x.g));
          const hit = lines.flatMap((l) => kind[l]!.filter((j) => cand[j] && !own.has(regions[j]!)));
          if (!hit.length) continue;
          const names = listOf(chosen.map((x) => regName(x.g)));
          const lineNames = `${word} ${listOf(lines.map((l) => nameOf(l).split(' ')[1]!))}`;
          return found([
            { text: `${cap(names)} can only put their crowns in ${lineNames}.`, focus: chosen.flatMap((x) => x.cs) },
            { text: `That's ${k} crowns for ${k} ${word}, so those ${word} are used up by them.`, focus: chosen.flatMap((x) => x.cs) },
            { text: `So nothing else in ${lineNames} can have a crown.`, focus: chosen.flatMap((x) => x.cs), out: hit },
          ], hit);
        }
      }
      const openLines = kind.map((cells, idx) => ({ idx, cs: candsOf(cells), done: has(cells) })).filter((x) => !x.done && x.cs.length > 0);
      for (let k = 2; k <= 3; k++) {
        for (const pick of choose(openLines.length, k)) {
          const chosen = pick.map((x) => openLines[x]!);
          const gs = [...new Set(chosen.flatMap((x) => x.cs.map((i) => regions[i]!)))];
          if (gs.length !== k) continue;
          const own = new Set(chosen.map((x) => x.idx));
          const hit = gs.flatMap((g) => regs[g]!.filter((j) => cand[j] && !own.has(of(j))));
          if (!hit.length) continue;
          const lineNames = `${word} ${listOf(chosen.map((x) => nameOf(x.idx).split(' ')[1]!))}`;
          const names = listOf(gs.map(regName));
          return found([
            { text: `${cap(lineNames)} can only get their crowns from ${names}.`, focus: chosen.flatMap((x) => x.cs) },
            { text: `That's ${k} crowns from ${k} colours, so those colours spend their crowns there.`, focus: chosen.flatMap((x) => x.cs) },
            { text: `So the rest of ${names} can't have a crown.`, focus: chosen.flatMap((x) => x.cs), out: hit },
          ], hit);
        }
      }
    }
    return false;
  }

  /**
   * What-if: put a crown on a square and follow only the forced crowns (a
   * row, column or colour with one square left). If some row, column or
   * colour ends up with nowhere left, that square can't hold a crown.
   */
  function whatIf(): CrownsHint | null | false {
    let best: { x: number; rows: CrownsHintStep[]; len: number } | null = null;
    for (let x = 0; x < CELLS; x++) {
      if (!cand[x]) continue;
      const r = suppose(x, best ? best.len - 1 : 8);
      if (r && (!best || r.len < best.len)) best = { x, ...r };
      if (best && best.len <= 1) break;
    }
    if (!best) return false;
    return found([
      { text: `Try a what-if: suppose a crown went here.`, focus: [best.x] },
      ...best.rows,
      { text: `That can't happen, so this square can't hold a crown.`, focus: [best.x], out: [best.x] },
    ], [best.x]);
  }

  function suppose(x: number, limit: number): { rows: CrownsHintStep[]; len: number } | null {
    const c = cand.slice();
    const placed = new Set(crowns);
    const put = (i: number): void => {
      placed.add(i); c[i] = false;
      for (const j of attacked(i)) c[j] = false;
    };
    put(x);
    const rows: CrownsHintStep[] = [];
    const moves: number[] = [];
    for (let n = 0; ; n++) {
      for (const u of units) {
        if (u.cells.some((i) => placed.has(i))) continue;
        if (!u.cells.some((i) => c[i])) {
          if (moves.length > 2) {
            rows.push({ text: `Then crowns are forced on these squares, one after another.`, focus: moves });
          } else {
            for (const m of moves) rows.push({ text: `Then a crown is forced here, the only square left in its ${forcedBy(m)}.`, focus: [m] });
          }
          rows.push({ text: `But then ${u.name} has nowhere left for a crown.`, focus: [...u.cells], out: [...u.cells] });
          return { rows, len: n + 1 };
        }
      }
      if (n >= limit) return null;
      let move = -1;
      const why = new Map<number, string>();
      for (const u of units) {
        if (u.cells.some((i) => placed.has(i))) continue;
        const cs = u.cells.filter((i) => c[i]);
        if (cs.length === 1) { move = cs[0]!; why.set(move, u.name.replace(/^the /, '')); break; }
      }
      if (move < 0) return null;
      forcedWhy.set(move, why.get(move)!);
      moves.push(move);
      put(move);
    }
  }
  const forcedWhy = new Map<number, string>();
  const forcedBy = (m: number): string => {
    const w = forcedWhy.get(m) ?? '';
    return w.startsWith('row') || w.startsWith('column') ? w.split(' ')[0]! : 'colour';
  };

  for (let guard = 0; guard < 400; guard++) {
    const placeHint = onlyCellLeft();
    if (placeHint) return placeHint;
    let progressed = false;
    for (const t of [sweep, regionLock, crowded, counting, whatIf]) {
      const r = t();
      if (r === false) continue;
      if (r) return r;
      progressed = true;
      break;
    }
    if (!progressed) break;
  }

  // Beyond these: show a crown, in the row, column or colour with the fewest squares left.
  let bestUnit = units[0]!, bestCount = Infinity;
  for (const u of units) {
    if (has(u.cells)) continue;
    const k = candsOf(u.cells).length;
    if (k > 0 && k < bestCount) { bestUnit = u; bestCount = k; }
  }
  const cell = bestUnit.cells.find((i) => solution[i] === CROWN)!;
  return {
    revealed: true, wrong: false, action: { kind: 'crown', cell },
    steps: [
      { text: `This spot needs a long chain of reasoning, so here's a nudge instead.`, focus: candsOf(bestUnit.cells) },
      { text: `${cap(bestUnit.name)}'s crown goes here.`, focus: [cell] },
    ],
  };
}

const cap = (s: string): string => s[0]!.toUpperCase() + s.slice(1);
const listOf = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

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

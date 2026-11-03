import {
  CELLS, HALF, LINES, LINES_OF, MOON, N, SUN, colOf, edgesByCell, other, rowOf, violations,
  type Edge, type Grid,
} from './grid.js';

/**
 * An Eclipse hint: short rows a person can follow on the board, ending in
 * one thing to do, either put down a sun or a moon, or clear a wrong one.
 * It reasons only from the givens and the player's entries that are right.
 */
export interface EclipseHintStep {
  text: string;
  /** Squares the sentence is about. */
  focus: number[];
  /** Squares the sentence rules out or flags. */
  out?: number[];
}

export type EclipseHintAction =
  | { kind: 'place'; cell: number; value: number }
  | { kind: 'clear'; cell: number };

export interface EclipseHint {
  steps: EclipseHintStep[];
  action: EclipseHintAction;
  /** True when no technique applied and the square is simply shown. */
  revealed: boolean;
  /** True when the hint is about an entry that has to come off. */
  wrong: boolean;
}

const word = (v: number): string => (v === SUN ? 'sun' : 'moon');
const a = (v: number): string => `a ${word(v)}`;
const lineName = (ln: number): string => (ln < N ? `row ${ln + 1}` : `column ${ln - N + 1}`);
const cellName = (i: number): string => `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;

/** Can the line's blanks still be filled with three of each and no three in a row? */
function lineOk(g: Grid, line: readonly number[]): boolean {
  const blanks = line.filter((i) => g[i] === 0);
  const sun = line.filter((i) => g[i] === SUN).length;
  const moon = line.filter((i) => g[i] === MOON).length;
  if (sun > HALF || moon > HALF) return false;
  const vals = line.map((i) => g[i]!);
  const idx = blanks.map((i) => line.indexOf(i));
  for (let mask = 0; mask < 1 << blanks.length; mask++) {
    let ones = 0;
    for (let b = 0; b < blanks.length; b++) if (mask & (1 << b)) ones++;
    if (ones !== HALF - sun) continue;
    for (let b = 0; b < blanks.length; b++) vals[idx[b]!] = mask & (1 << b) ? SUN : MOON;
    let ok = true;
    for (let k = 0; k + 2 < N && ok; k++) if (vals[k] === vals[k + 1] && vals[k + 1] === vals[k + 2]) ok = false;
    if (ok) return true;
  }
  return false;
}

export function nextEclipseHint(givens: Grid, grid: Grid, edges: readonly Edge[], solution: Grid): EclipseHint | null {
  if (grid.every((v, i) => v === solution[i])) return null;

  // 1. An entry that isn't right comes off first, with the rule it breaks if there is one.
  const bad = violations(grid, edges);
  const wrongAt = [...Array(CELLS).keys()].filter((i) => givens[i] === 0 && grid[i] !== 0 && grid[i] !== solution[i]);
  if (wrongAt.length) {
    const i = wrongAt.find((j) => bad[j]) ?? wrongAt[0]!;
    const v = grid[i]!;
    let why = `It doesn't fit with the rest of the board, so it has to come off.`;
    if (bad[i]) {
      for (const ln of LINES_OF[i]!) {
        const line = LINES[ln]!;
        if (line.filter((j) => grid[j] === v).length > HALF) { why = `${lineName(ln)[0]!.toUpperCase()}${lineName(ln).slice(1)} would have more than three ${word(v)}s.`; break; }
        const k = line.indexOf(i);
        for (let s = Math.max(0, k - 2); s <= Math.min(N - 3, k); s++) {
          if (grid[line[s]!] === v && grid[line[s + 1]!] === v && grid[line[s + 2]!] === v) { why = `That makes three ${word(v)}s in a row.`; }
        }
      }
      for (const e of edges) {
        if (e.a !== i && e.b !== i) continue;
        const j = e.a === i ? e.b : e.a;
        if (grid[j] === 0) continue;
        if (e.same ? grid[j] !== v : grid[j] === v) { why = e.same ? `The = sign says it must match its neighbour.` : `The × sign says it must differ from its neighbour.`; }
      }
    }
    return {
      wrong: true, revealed: false, action: { kind: 'clear', cell: i },
      steps: [
        { text: `This ${word(v)} isn't right.`, focus: [i], out: [i] },
        { text: why, focus: [i] },
      ],
    };
  }

  const g = grid.slice();
  const at = (r: number, c: number): number => (r < 0 || r >= N || c < 0 || c >= N ? -1 : g[r * N + c]!);
  const edgeIdx = edgesByCell(edges);
  const place = (cell: number, value: number, steps: EclipseHintStep[]): EclipseHint =>
    ({ wrong: false, revealed: false, action: { kind: 'place', cell, value }, steps });

  // 2. An = or × sign next to a filled square.
  for (let i = 0; i < CELLS; i++) {
    if (g[i] === 0) continue;
    for (const k of edgeIdx[i]!) {
      const e = edges[k]!;
      const j = e.a === i ? e.b : e.a;
      if (g[j] !== 0) continue;
      const v = e.same ? g[i]! : other(g[i]!);
      return place(j, v, [
        { text: e.same ? `The = sign between these two squares says they match.` : `The × sign between these two squares says they're different.`, focus: [i, j] },
        { text: `One is ${a(g[i]!)}, so the other is ${a(v)}.`, focus: [j] },
      ]);
    }
  }

  // 3. No three in a row: a pair beside a square, or twins on either side of it.
  for (let i = 0; i < CELLS; i++) {
    if (g[i] !== 0) continue;
    const r = rowOf(i), c = colOf(i);
    for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
      const sides: [number, number, number, number][] = [
        [r - 2 * dr, c - 2 * dc, r - dr, c - dc],
        [r + dr, c + dc, r + 2 * dr, c + 2 * dc],
      ];
      for (const [r1, c1, r2, c2] of sides) {
        const p = at(r1, c1), q = at(r2, c2);
        if (p > 0 && p === q) {
          return place(i, other(p), [
            { text: `These two ${word(p)}s sit side by side.`, focus: [r1 * N + c1, r2 * N + c2] },
            { text: `Another ${word(p)} here would make three in a row, so this square is ${a(other(p))}.`, focus: [i] },
          ]);
        }
      }
      const p = at(r - dr, c - dc), q = at(r + dr, c + dc);
      if (p > 0 && p === q) {
        return place(i, other(p), [
          { text: `There's ${a(p)} on each side of this square.`, focus: [(r - dr) * N + (c - dc), (r + dr) * N + (c + dc)] },
          { text: `${a(p)[0]!.toUpperCase()}${a(p).slice(1)} in the middle would make three in a row, so it's ${a(other(p))}.`, focus: [i] },
        ]);
      }
    }
  }

  // 4. A line that already has three of one symbol.
  for (let ln = 0; ln < LINES.length; ln++) {
    const line = LINES[ln]!;
    for (const v of [SUN, MOON]) {
      const have = line.filter((i) => g[i] === v);
      if (have.length !== HALF) continue;
      const empty = line.filter((i) => g[i] === 0);
      if (!empty.length) continue;
      return place(empty[0]!, other(v), [
        { text: `${lineName(ln)[0]!.toUpperCase()}${lineName(ln).slice(1)} already has its three ${word(v)}s.`, focus: have },
        { text: `So the rest of it is ${word(other(v))}s, starting with this square.`, focus: [empty[0]!] },
      ]);
    }
  }

  // 5. A what-if: one symbol leaves a line that can't be finished.
  for (let i = 0; i < CELLS; i++) {
    if (g[i] !== 0) continue;
    for (const v of [SUN, MOON]) {
      g[i] = v;
      const dead = LINES_OF[i]!.find((ln) => !lineOk(g, LINES[ln]!));
      g[i] = 0;
      if (dead === undefined) continue;
      const line = LINES[dead]!;
      const left = line.filter((j) => g[j] === 0 && j !== i);
      const need = HALF - line.filter((j) => g[j] === v).length - 1;
      return place(i, other(v), [
        { text: `Try a what-if: suppose ${cellName(i)} were ${a(v)}.`, focus: [i] },
        {
          text: need === 0 || need === left.length
            ? `Then ${lineName(dead)} would have its three ${word(need === 0 ? v : other(v))}s, so these squares would all be ${word(need === 0 ? other(v) : v)}s, and that makes three in a row.`
            : `Then ${lineName(dead)} would still need ${need} more ${word(v)}${need === 1 ? '' : 's'} and ${left.length - need} ${word(other(v))}${left.length - need === 1 ? '' : 's'} in these squares, and there's no way to fit them without three in a row.`,
          focus: left, out: [i],
        },
        { text: `So it's ${a(other(v))}.`, focus: [i] },
      ]);
    }
  }

  // 6. A longer what-if: follow the squares the rules force, until something breaks.
  /** One forced square on board h, by the simple rules, or null. */
  const forced = (h: Grid): [number, number] | null => {
    const hat = (r: number, c: number): number => (r < 0 || r >= N || c < 0 || c >= N ? -1 : h[r * N + c]!);
    for (const e of edges) {
      if (h[e.a] !== 0 && h[e.b] === 0) return [e.b, e.same ? h[e.a]! : other(h[e.a]!)];
      if (h[e.b] !== 0 && h[e.a] === 0) return [e.a, e.same ? h[e.b]! : other(h[e.b]!)];
    }
    for (let i = 0; i < CELLS; i++) {
      if (h[i] !== 0) continue;
      const r = rowOf(i), c = colOf(i);
      for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
        for (const [p1, p2] of [[-2, -1], [1, 2], [-1, 1]] as const) {
          const x = hat(r + p1 * dr, c + p1 * dc), y = hat(r + p2 * dr, c + p2 * dc);
          if (x > 0 && x === y) return [i, other(x)];
        }
      }
    }
    for (const line of LINES) {
      for (const v of [SUN, MOON]) {
        if (line.filter((i) => h[i] === v).length === HALF) {
          const e = line.find((i) => h[i] === 0);
          if (e !== undefined) return [e, other(v)];
        }
      }
    }
    return null;
  };
  /** What has broken on board h, as a sentence, or null. */
  const brokenOn = (h: Grid): { text: string; focus: number[] } | null => {
    const bad = violations(h, edges);
    const first = bad.findIndex(Boolean);
    if (first >= 0) {
      for (const e of edges) {
        if (h[e.a] && h[e.b] && (e.same ? h[e.a] !== h[e.b] : h[e.a] === h[e.b])) {
          return { text: `But then these two squares would break their ${e.same ? '=' : '×'} sign.`, focus: [e.a, e.b] };
        }
      }
      for (let ln = 0; ln < LINES.length; ln++) {
        const line = LINES[ln]!;
        for (const v of [SUN, MOON]) {
          if (line.filter((i) => h[i] === v).length > HALF) return { text: `But then ${lineName(ln)} would have more than three ${word(v)}s.`, focus: line.filter((i) => h[i] === v) };
        }
        for (let k = 0; k + 2 < N; k++) {
          const t = [line[k]!, line[k + 1]!, line[k + 2]!];
          if (h[t[0]!] && h[t[0]!] === h[t[1]!] && h[t[1]!] === h[t[2]!]) return { text: `But then there would be three ${word(h[t[0]!]!)}s in a row.`, focus: t };
        }
      }
    }
    for (let ln = 0; ln < LINES.length; ln++) {
      if (!lineOk(h, LINES[ln]!)) return { text: `But then ${lineName(ln)} couldn't be finished without breaking a rule.`, focus: LINES[ln]!.filter((i) => h[i] === 0) };
    }
    return null;
  };
  let best: { i: number; v: number; chain: number[]; end: { text: string; focus: number[] } } | null = null;
  for (let i = 0; i < CELLS; i++) {
    if (g[i] !== 0) continue;
    for (const v of [SUN, MOON]) {
      const h = g.slice();
      h[i] = v;
      const chain: number[] = [];
      for (let step = 0; step < 30; step++) {
        const end = brokenOn(h);
        if (end) { if (!best || chain.length < best.chain.length) best = { i, v, chain, end }; break; }
        const f = forced(h);
        if (!f) break;
        h[f[0]] = f[1];
        chain.push(f[0]);
      }
    }
  }
  if (best) {
    const { i, v, chain, end } = best;
    return place(i, other(v), [
      { text: `Try a what-if: suppose ${cellName(i)} were ${a(v)}.`, focus: [i] },
      ...(chain.length ? [{ text: `Then the rules force ${chain.length === 1 ? 'this square' : 'these squares'}, one after another.`, focus: chain }] : []),
      { text: end.text, focus: end.focus, out: [i] },
      { text: `So it's ${a(other(v))}.`, focus: [i] },
    ]);
  }

  // Beyond these: show one square.
  const cell = [...Array(CELLS).keys()].find((i) => g[i] === 0)!;
  return {
    wrong: false, revealed: true, action: { kind: 'place', cell, value: solution[cell]! },
    steps: [
      { text: `This spot needs a long chain of reasoning, so here's a nudge instead.`, focus: [cell] },
      { text: `${cellName(cell)[0]!.toUpperCase()}${cellName(cell).slice(1)} is ${a(solution[cell]!)}.`, focus: [cell] },
    ],
  };
}

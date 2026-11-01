import { colOf, openNeighbours, rowOf, type Path } from './grid.js';

/**
 * A Thread hint: short rows a person can follow on the board, ending in one
 * thing to do, either draw the line on by one or more squares, or back it up
 * to where it went wrong.
 */
export interface ThreadHintStep {
  text: string;
  /** Squares the sentence is about. */
  focus: number[];
  /** Squares this sentence rules out as the line's next square. */
  out?: number[];
}

export type ThreadHintAction =
  | { kind: 'extend'; cells: number[] }
  /** Keep this many squares of the line and drop the rest. */
  | { kind: 'backup'; keep: number };

export interface ThreadHint {
  steps: ThreadHintStep[];
  action: ThreadHintAction;
  /** True when no reasoning applied and the next square is simply shown. */
  revealed: boolean;
  /** True when the line has gone wrong and has to back up. */
  wrong: boolean;
}

interface State { visited: Set<number>; head: number; next: number }
type Why = { rows: ThreadHintStep[] } | null;

export function nextThreadHint(
  path: Path, n: number, walls: readonly string[], waypoints: readonly number[], solution: Path,
): ThreadHint | null {
  const open = openNeighbours(n, new Set(walls));
  const total = n * n;
  const last = waypoints[waypoints.length - 1]!;
  const numberAt = new Map(waypoints.map((c, k) => [c, k]));
  const name = (i: number): string => {
    const k = numberAt.get(i);
    return k !== undefined ? `number ${k + 1}` : `row ${rowOf(i, n) + 1}, column ${colOf(i, n) + 1}`;
  };

  if (path.length === total && path.every((c, k) => c === solution[k])) return null;

  const stateOf = (p: readonly number[]): State => {
    let next = 0;
    while (next < waypoints.length && p.includes(waypoints[next]!)) next++;
    return { visited: new Set(p), head: p[p.length - 1]!, next };
  };
  const moveTo = (s: State, x: number): State => ({
    visited: new Set([...s.visited, x]), head: x, next: numberAt.get(x) === s.next ? s.next + 1 : s.next,
  });

  /** Breaks a rule straight away by stepping on x: a number out of order, or the last number too soon. */
  function badNumber(s: State, x: number): string | null {
    const k = numberAt.get(x);
    if (k === undefined) return null;
    if (k > s.next) return `That's number ${k + 1}, but the line has to reach number ${s.next + 1} first.`;
    if (x === last && s.visited.size + 1 < total) return `That's the last number, and squares would still be empty.`;
    return null;
  }

  /** Something on the board that can no longer work out, with rows that say why. */
  function broken(s: State): Why {
    const left = [...Array(total).keys()].filter((i) => !s.visited.has(i));
    if (!left.length) return null;
    // Every empty square needs a way in and a way out (the last number only a way in).
    for (const y of left) {
      const ways = open[y]!.filter((j) => !s.visited.has(j) || j === s.head);
      const need = y === last || left.length === 1 ? 1 : 2;
      if (ways.length < need) {
        return {
          rows: [{
            text: ways.length === 0
              ? `Then ${name(y)} would be cut off: the line could never reach it.`
              : `Then ${name(y)} would be a dead end: the line could get in but never back out.`,
            focus: [y],
          }],
        };
      }
    }
    // All the empty squares have to stay reachable from the end of the line.
    const seen = new Set([s.head]);
    const queue = [s.head];
    while (queue.length) {
      const c = queue.shift()!;
      for (const j of open[c]!) if (!s.visited.has(j) && !seen.has(j)) { seen.add(j); queue.push(j); }
    }
    const cut = left.filter((i) => !seen.has(i));
    if (cut.length) {
      return { rows: [{ text: `Then these squares would be cut off from the line.`, focus: cut }] };
    }
    // The next number has to be reachable without stepping on a later one.
    if (s.next < waypoints.length) {
      const goal = waypoints[s.next]!;
      const later = new Set(waypoints.slice(s.next + 1));
      const reach = new Set([s.head]);
      const q = [s.head];
      while (q.length && !reach.has(goal)) {
        const c = q.shift()!;
        for (const j of open[c]!) {
          if (s.visited.has(j) || reach.has(j) || later.has(j)) continue;
          reach.add(j); q.push(j);
        }
      }
      if (!reach.has(goal)) {
        return { rows: [{ text: `Then the line couldn't reach number ${s.next + 1} without passing a later number first.`, focus: [goal] }] };
      }
    }
    return null;
  }

  /** Moves from s that break nothing straight away. */
  const fine = (s: State): number[] =>
    open[s.head]!.filter((x) => !s.visited.has(x) && !badNumber(s, x) && !broken(moveTo(s, x)));

  /**
   * Why stepping from s to x can't work, without searching: it breaks a
   * number's order, leaves something broken at once, or forces the line
   * along until it jams. `lead` is how the supposition is introduced.
   * Returns the rows, or the fork the forced run ends on if it doesn't jam.
   */
  function shallow(s: State, x: number, lead: string): { rows: ThreadHintStep[] } | { fork: State; run: number[] } {
    const bad = badNumber(s, x);
    if (bad) return { rows: [{ text: bad, focus: [x], out: [x] }] };
    const after = moveTo(s, x);
    const first = { text: lead, focus: [x] };
    const b = broken(after);
    if (b) return { rows: [first, ...b.rows.map((r) => ({ ...r, out: [x] }))] };
    let cur = after;
    const run: number[] = [];
    for (let k = 0; k < 24 && cur.visited.size < total; k++) {
      const opts = fine(cur);
      if (opts.length === 0) {
        const forced = run.length
          ? [{ text: `From there it has only one safe way to go each time, through these squares.`, focus: run }]
          : [];
        return { rows: [first, ...forced, { text: `Then every next step would leave a dead end or cut squares off.`, focus: [cur.head], out: [x] }] };
      }
      if (opts.length > 1) break;
      run.push(opts[0]!);
      cur = moveTo(cur, opts[0]!);
    }
    return { fork: cur, run };
  }

  /** Why the line can't go from s to x, or null if no reason is found. */
  function whyNot(s: State, x: number, brief = false): Why {
    const lead = `Suppose the line went to ${name(x)}.`;
    const sh = shallow(s, x, lead);
    if ('rows' in sh) return sh;

    // It reaches a fork: if every branch jams on its own, say so branch by branch.
    const fork = sh.fork;
    const branches = fine(fork);
    if (!brief && branches.length <= 3) {
      const sub: ThreadHintStep[] = [];
      let ok = true;
      for (const o of branches) {
        const r = shallow(fork, o, `If it then went to ${name(o)}:`);
        if (!('rows' in r) || r.rows.length > 3) { ok = false; break; }
        sub.push(...r.rows.map((row) => ({ text: row.text, focus: row.focus })));
      }
      if (ok && sub.length <= 6) {
        return {
          rows: [
            { text: lead, focus: [x] },
            ...(sh.run.length ? [{ text: `From there it has only one safe way to go each time, through these squares.`, focus: sh.run }] : []),
            { text: `Then it could go to ${branches.map(name).join(' or ')}.`, focus: [fork.head, ...branches] },
            ...sub,
            { text: `Every way jams, so the line can't go to ${name(x)}.`, focus: [x], out: [x] },
          ],
        };
      }
    }

    // Last try: a search showing every way on from there jams.
    const after = moveTo(s, x);
    let budget = 100000;
    const touched = new Set<number>();
    const dies = (st: State, depth: number): boolean => {
      if (st.visited.size === total) return false;
      if (--budget < 0 || depth > 60) return false;
      for (const o of fine(st)) {
        touched.add(o);
        if (!dies(moveTo(st, o), depth + 1)) return false;
      }
      return true;
    };
    if (dies(after, 0)) {
      return {
        rows: [
          { text: lead, focus: [x] },
          { text: `Every way the line could carry on from there ends up leaving a dead end or cutting squares off.`, focus: [...touched].slice(0, 12), out: [x] },
        ],
      };
    }
    return null;
  }

  // 1. A line that has left the only answer backs up to where it went wrong.
  const firstWrong = path.findIndex((c, k) => c !== solution[k]);
  if (firstWrong >= 0) {
    const before = stateOf(path.slice(0, firstWrong));
    const x = path[firstWrong]!;
    const why = whyNot(before, x);
    return {
      wrong: true, revealed: false, action: { kind: 'backup', keep: firstWrong },
      steps: [
        { text: `The line goes wrong here, where it steps from ${name(before.head)} to ${name(x)}.`, focus: [before.head, x] },
        ...(why ? why.rows : [{ text: `From that square there's no way to fill every square in order.`, focus: [x], out: [x] }]),
        { text: `Back the line up to ${name(before.head)} and try another way.`, focus: [before.head] },
      ],
    };
  }

  // 2. The next square: rule out every other square the line could step to.
  const s = stateOf(path);
  const go = solution[path.length]!;
  const choices = open[s.head]!.filter((x) => !s.visited.has(x));
  const others = choices.filter((x) => x !== go);
  const rows: ThreadHintStep[] = [];
  let revealed = false;
  if (others.length === 0) {
    rows.push({ text: `From ${name(s.head)} there's only one empty square the line can step to.`, focus: [s.head, go] });
  } else {
    rows.push({ text: `The line is at ${name(s.head)}. It could step to ${choices.length} squares next.`, focus: [s.head, ...choices] });
    // Branch-by-branch explanations read best, unless together they run long.
    for (const brief of [false, true]) {
      const all: ThreadHintStep[] = [];
      revealed = false;
      for (const x of others) {
        const why = whyNot(s, x, brief);
        if (!why) { revealed = true; break; }
        all.push(...why.rows);
      }
      if (revealed || all.length <= 12 || brief) { rows.push(...all); break; }
    }
  }
  if (revealed) {
    return {
      revealed: true, wrong: false, action: { kind: 'extend', cells: [go] },
      steps: [
        { text: `This spot needs a long chain of reasoning, so here's a nudge instead.`, focus: [s.head, ...choices] },
        { text: `The line goes to ${name(go)} next.`, focus: [go] },
      ],
    };
  }
  rows.push({ text: others.length ? `So the line goes to ${name(go)}.` : `So it goes to ${name(go)}.`, focus: [go] });

  // 3. Then follow any squares that are the only way on, so one hint covers a whole corridor.
  const cells = [go];
  let cur = moveTo(s, go);
  while (cur.visited.size < total) {
    const nexts = open[cur.head]!.filter((x) => !cur.visited.has(x));
    if (nexts.length !== 1 || nexts[0] !== solution[cur.visited.size]) break;
    cells.push(nexts[0]!);
    cur = moveTo(cur, nexts[0]!);
  }
  if (cells.length > 1) {
    rows.push({ text: `From there it has only one way to go for ${cells.length - 1} more square${cells.length === 2 ? '' : 's'}.`, focus: cells.slice(1) });
  }
  return { revealed: false, wrong: false, action: { kind: 'extend', cells }, steps: rows };
}

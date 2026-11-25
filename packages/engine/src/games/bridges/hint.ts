import type { Bridges, Layout } from './grid.js';
import { Deducer, LEVEL, type Contradiction, type Fact } from './techniques.js';

/**
 * A Bridges hint: short rows a person can follow on the board, each lighting
 * up the islands and water it talks about, ending in one thing to do.
 */
export interface BridgesHintStep {
  text: string;
  /** Islands (by index) the sentence is about. */
  focus: number[];
  /** Links the sentence is about (drawn lit). */
  links: number[];
  /** Links this sentence rules out (a red ✕ on the water). */
  out: number[];
}

export interface BridgesHint {
  steps: BridgesHintStep[];
  /** Set these links to these bridge counts. */
  action: { link: number; count: number }[];
  /** True when no reasoning applied and the next bridge is simply shown. */
  revealed: boolean;
  /** True when a placed bridge isn't part of the answer. */
  wrong: boolean;
}

const MAX_STEPS = 6;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const plural = (n: number, one: string, many = `${one}s`): string => `${WORDS[n] ?? n} ${n === 1 ? one : many}`;

export function nextBridgesHint(layout: Layout, bridges: Bridges, solution: Bridges): BridgesHint | null {
  const { islands, links } = layout;
  const name = (i: number): string => `the ${islands[i]!.need}`;
  const pair = (k: number): string => {
    const l = links[k]!;
    const a = islands[l.a]!.need, b = islands[l.b]!.need;
    return a === b ? `the two ${a}s` : `the ${a} and the ${b}`;
  };

  // A bridge that isn't in the answer comes first: everything else builds on it.
  const wrong = links.map((_, k) => k).filter((k) => bridges[k]! > solution[k]!);
  if (wrong.length) {
    const k = wrong[0]!;
    const l = links[k]!;
    const text = solution[k] === 0
      ? `The bridge between ${pair(k)} isn't part of the answer. Take it away and look again.`
      : `There's one bridge too many between ${pair(k)}: it should be a single, not a double.`;
    return {
      steps: [{ text, focus: [l.a, l.b], links: [], out: [k] }],
      action: [{ link: k, count: solution[k]! }],
      revealed: false, wrong: true,
    };
  }
  if (bridges.every((v, k) => v === solution[k])) return null;

  const d = new Deducer(layout, bridges);
  let target: Fact[] = [];
  const found = (): boolean => {
    const last = d.facts[d.facts.length - 1];
    if (!last) return false;
    const app = d.facts.filter((f) => f.app === last.app && f.kind === 'lo' && f.value > bridges[f.link]!);
    if (app.length) { target = app; return true; }
    return false;
  };
  d.run(3, found);

  if (!target.length) {
    // Nothing a person could reason out from here (shouldn't happen on our boards): show one bridge.
    const k = links.map((_, i) => i).find((i) => bridges[i]! < solution[i]!)!;
    const l = links[k]!;
    return {
      steps: [{ text: `Try a bridge between ${pair(k)}.`, focus: [l.a, l.b], links: [k], out: [] }],
      action: [{ link: k, count: bridges[k]! + 1 }],
      revealed: true, wrong: false,
    };
  }

  // Everything the conclusion rests on, oldest first, as one row per application.
  const need = new Set<number>();
  const visit = (id: number): void => {
    if (need.has(id)) return;
    need.add(id);
    for (const x of d.facts[id]!.deps) visit(x);
  };
  const targetIds = target.map((f) => d.facts.indexOf(f));
  for (const id of targetIds) for (const x of d.facts[id]!.deps) visit(x);
  for (const id of targetIds) need.delete(id);
  const apps = new Map<number, Fact[]>();
  for (const id of [...need].sort((x, y) => x - y)) {
    const f = d.facts[id]!;
    if (f.tech === 'cap') continue; // too obvious to spell out unless it is the point
    if (!apps.has(f.app)) apps.set(f.app, []);
    apps.get(f.app)!.push(f);
  }
  let rows = [...apps.values()].map((fs) => describe(fs, d, bridges)).filter((r): r is BridgesHintStep => !!r);
  if (rows.length > MAX_STEPS - 1) rows = rows.slice(rows.length - (MAX_STEPS - 1));
  const end = target[0]!.tech === 'whatif' ? whatIfRows(target[0]!, layout) : [describe(target, d, bridges)!];

  return {
    steps: [...rows, ...end],
    action: target.map((f) => ({ link: f.link, count: f.value })),
    revealed: false, wrong: false,
  };

  function describe(fs: Fact[], dd: Deducer, _given: Bridges | null): BridgesHintStep | null {
    const f = fs[0]!;
    const ls = fs.map((x) => x.link);
    const ends = (k: number) => [links[k]!.a, links[k]!.b];
    const uniq = (xs: number[]) => [...new Set(xs)];
    switch (f.tech) {
      case 'cap': {
        const k = f.link;
        return { text: `A 1 takes only one bridge, so there's no double between ${pair(k)}.`, focus: ends(k), links: [k], out: [] };
      }
      case 'cross': {
        const by = f.by!;
        return {
          text: `The bridge between ${pair(by)} is in the way. Nothing can cross it, so ${ls.length === 1 ? `no bridge can go between ${pair(ls[0]!)}` : 'those crossings are ruled out'}.`,
          focus: uniq([...ends(by), ...ls.flatMap(ends)]), links: [by], out: ls,
        };
      }
      case 'room': {
        const i = f.island;
        const need = islands[i]!.need;
        const have = f.nums![0]!;
        const zero = fs.filter((x) => x.value === 0).map((x) => x.link);
        if (have >= need) {
          return { text: `${cap(name(i))} already has ${need === 1 ? 'its one bridge' : `all ${need} of its bridges`}, so no more can go from it.`, focus: [i], links: f.around!, out: zero };
        }
        const capped = fs.filter((x) => x.value > 0);
        const to = (k: number) => name(links[k]!.a === i ? links[k]!.b : links[k]!.a);
        const effect = zero.length && !capped.length
          ? (zero.length === 1 ? `no bridge can go to ${to(zero[0]!)}` : 'no more can go anywhere else')
          : capped.length === 1 && !zero.length ? `the bridge to ${to(capped[0]!.link)} can't be a double` : `it has no room for a double anywhere`;
        return {
          text: `${cap(name(i))} needs ${need} and already has ${have}, so ${effect}.`,
          focus: uniq([i, ...fs.map((x) => (links[x.link]!.a === i ? links[x.link]!.b : links[x.link]!.a))]), links: f.around!, out: zero,
        };
      }
      case 'must': {
        const i = f.island;
        const need = islands[i]!.need;
        const most = f.nums![0]!;
        const open = f.around!;
        const reach = open.map((k) => (links[k]!.a === i ? links[k]!.b : links[k]!.a));
        const blocked = layout.linksOf[i]!.filter((k) => !open.includes(k));
        const lead = open.length === 1
          ? `${cap(name(i))} can reach only one island`
          : `${cap(name(i))} can reach ${plural(open.length, 'island')}, with room for at most ${most} bridges in all`;
        let tail: string;
        if (most === need) tail = open.length === 1 ? `It needs ${need}, so ${need === 2 ? 'a double' : 'a bridge'} must go there.` : `It needs ${need}, so every one of them has to be built.`;
        else if (fs.length === 1) {
          const k = fs[0]!.link;
          const other = links[k]!.a === i ? links[k]!.b : links[k]!.a;
          tail = `It needs ${need}, so even with the most everywhere else, at least ${plural(fs[0]!.value, 'bridge')} must go to ${name(other)}.`;
        } else tail = `It needs ${need}, so even with the most everywhere else, each of the lit-up neighbours must get at least ${fs.every((x) => x.value === 2) ? 'two bridges' : 'one bridge'}.`;
        return { text: `${lead}. ${tail}`, focus: uniq([i, ...reach]), links: ls, out: blocked };
      }
      case 'isolate': {
        const k = f.link;
        const l = links[k]!;
        const a = islands[l.a]!.need, b = islands[l.b]!.need;
        const g = f.group ?? [l.a, l.b];
        let text: string;
        if (g.length === 2 && a === 1 && b === 1) text = `Two 1s joined to each other would be cut off from everything else, so no bridge goes between them.`;
        else if (g.length === 2 && a === 2 && b === 2) text = `A double between the two 2s would cut them off from the rest, so it can be a single at most.`;
        else {
          const rest = islands.length - g.length;
          text = `Another bridge between ${pair(k)} would finish off ${g.length === 2 ? 'both of them' : g.length <= rest ? `these ${g.length} islands` : 'that whole group'} while ${plural(rest, 'other island')} still ${rest === 1 ? 'needs' : 'need'} joining. Everything has to end up joined, so it can't go.`;
        }
        const rest = islands.map((_, x) => x).filter((x) => !g.includes(x));
        return { text, focus: g.length <= rest.length ? g : [...rest, l.a, l.b], links: [], out: dd.lo[k]! === 0 ? [k] : [] };
      }
      case 'connect': {
        const k = f.link;
        const g = f.group ?? [];
        const who = g.length === 1 ? cap(name(g[0]!)) : `These ${g.length} islands`;
        return {
          text: `${who} can only be reached through the water between ${pair(k)}. Without a bridge there ${g.length === 1 ? 'it' : 'they'} would be cut off, so at least one bridge goes there.`,
          focus: uniq([...g, ...ends(k)]), links: [k], out: [],
        };
      }
      case 'whatif': return whatIfRows(f, layout)[whatIfRows(f, layout).length - 1]!;
    }
  }

  function whatIfRows(f: Fact, L: Layout): BridgesHintStep[] {
    const t = f.trial!;
    const k = f.link;
    const ends = [L.links[k]!.a, L.links[k]!.b];
    const now = bridges[k]!;
    const suppose = t.kind === 'hi'
      ? (now === 0 ? `Suppose there were no bridge between ${pair(k)}.` : `Suppose the bridge between ${pair(k)} stayed a single.`)
      : (now === 0 && t.value === 1 ? `Suppose there were a bridge between ${pair(k)}.` : `Suppose the bridge between ${pair(k)} were a double.`);
    const rows: BridgesHintStep[] = [{ text: suppose, focus: ends, links: t.kind === 'lo' ? [k] : [], out: t.kind === 'hi' && now === 0 ? [k] : [] }];
    // The trial's own reasoning that the break rests on, a few rows at most.
    const need = new Set<number>();
    const visit = (id: number): void => {
      if (id < t.base || need.has(id)) return;
      need.add(id);
      for (const x of t.facts[id]!.deps) visit(x);
    };
    for (const id of t.whyDeps) visit(id);
    const groups = new Map<number, Fact[]>();
    for (const id of [...need].sort((x, y) => x - y)) {
      const g = t.facts[id]!;
      if (g.tech === 'whatif' || g.tech === 'cap') continue;
      if (!groups.has(g.app)) groups.set(g.app, []);
      groups.get(g.app)!.push(g);
    }
    // Replay the trial's bounds so each row reads them as they stood.
    const trial = new Deducer(L, bridges);
    for (let id = 0; id < t.facts.length; id++) {
      const g = t.facts[id]!;
      if (g.kind === 'lo') trial.lo[g.link] = g.value; else trial.hi[g.link] = g.value;
    }
    let inner = [...groups.values()].map((fs) => describe(fs, trial, null)).filter((r): r is BridgesHintStep => !!r).map((r) => ({ ...r, text: `Then ${lower(r.text)}` }));
    if (inner.length > 3) inner = inner.slice(inner.length - 3);
    rows.push(...inner);
    rows.push(breakRow(t.why));
    const conclusion = t.kind === 'hi'
      ? (now === 0 ? `So there has to be a bridge between ${pair(k)}.` : `So the bridge between ${pair(k)} has to be a double.`)
      : (now === 0 ? `So there can't be a bridge between ${pair(k)}.` : `So it stays a single.`);
    rows.push({ text: conclusion, focus: ends, links: f.kind === 'lo' ? [k] : [], out: f.kind === 'hi' && f.value === 0 ? [k] : [] });
    return rows;
  }

  function breakRow(c: Contradiction): BridgesHintStep {
    switch (c.kind) {
      case 'short': return { text: `Then ${name(c.islands[0]!)} couldn't get enough bridges: it can't reach ${islands[c.islands[0]!]!.need} any more.`, focus: c.islands, links: c.links, out: [] };
      case 'over': return { text: `Then ${name(c.islands[0]!)} would end up with too many bridges.`, focus: c.islands, links: c.links, out: [] };
      case 'closed': {
        const rest = islands.map((_, x) => x).filter((x) => !c.islands.includes(x));
        return c.islands.length <= rest.length
          ? { text: `Then ${c.islands.length === 2 ? 'these two islands' : `these ${plural(c.islands.length, 'island')}`} would be finished and cut off from the rest. Everything has to join up.`, focus: c.islands, links: [], out: [] }
          : { text: `Then everything else would be finished, leaving ${rest.length === 1 ? 'this island' : `these ${plural(rest.length, 'island')}`} cut off. Everything has to join up.`, focus: rest, links: [], out: [] };
      }
      case 'cut': return { text: `Then ${c.islands.length === 1 ? name(c.islands[0]!) : `these ${c.islands.length} islands`} could no longer be reached at all.`, focus: c.islands, links: [], out: [] };
      case 'cross': return { text: `Then two bridges would have to cross.`, focus: c.links.flatMap((k) => [links[k]!.a, links[k]!.b]), links: c.links, out: [] };
    }
  }
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string): string => (/^[A-Z][a-z]/.test(s) && !s.startsWith('A ') ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export { LEVEL };

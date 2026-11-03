import { boundsOf, fitsClue, rectCells, rowOf, colOf, type Clue, type Owner, type Rect } from './grid.js';
import { buildCandidates, type Cand } from './solver.js';
import { andInto, emptyMask, hasBit, isEmpty, orInto, overlaps } from './mask.js';

/**
 * A Quilt hint: short rows a person can follow on the board, ending in one
 * thing to do, either lay down one clue's patch or take a wrong one off.
 *
 * The reasoning starts from the patches already drawn that are right. Each
 * row says what it rules out, and only the rows the final patch actually
 * depends on are kept.
 */
export interface QuiltHintStep {
  text: string;
  /** Squares the sentence is about. */
  focus: number[];
  /** Squares the sentence rules out or flags. */
  out?: number[];
}

export type QuiltHintAction =
  | { kind: 'place'; clue: number; rect: Rect }
  | { kind: 'clear'; clue: number };

export interface QuiltHint {
  steps: QuiltHintStep[];
  action: QuiltHintAction;
  /** True when no reasoning applied and a patch is simply shown. */
  revealed: boolean;
  /** True when the hint is about a patch that has to come off. */
  wrong: boolean;
}

/** How a clue reads on the board, for sentences. */
export function clueName(clue: Clue): string {
  switch (clue.kind) {
    case 'area': return `the ${clue.area} clue`;
    case 'shape': return `the ${clue.shape} clue`;
    case 'any': return 'the ? clue';
  }
}

const cap = (s: string): string => s[0]!.toUpperCase() + s.slice(1);
const cellsOfMask = (m: Uint32Array, total: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < total; i++) if (hasBit(m, i)) out.push(i);
  return out;
};

export function nextQuiltHint(
  n: number, clues: readonly Clue[], owner: Owner, solution: Owner,
  /** How to name clue k in sentences, e.g. "the pink square clue". */
  label: (k: number) => string = (k) => clueName(clues[k]!),
): QuiltHint | null {
  const total = n * n;
  if (owner.every((k, i) => k === solution[i])) return null;
  const name = label;
  const cellName = (i: number): string => `row ${rowOf(i, n) + 1}, column ${colOf(i, n) + 1}`;

  const drawn: number[][] = clues.map(() => []);
  owner.forEach((k, i) => { if (k >= 0 && drawn[k]) drawn[k]!.push(i); });
  const right = (k: number): boolean =>
    drawn[k]!.length > 0 && drawn[k]!.every((i) => solution[i] === k) && drawn[k]!.length === solution.filter((v) => v === k).length;

  // Everything from here works from the right patches only.
  const all = buildCandidates(n, clues);
  const used = emptyMask(n);
  const placed = clues.map((_, k) => right(k));
  for (let k = 0; k < clues.length; k++) if (placed[k]) for (const i of drawn[k]!) used[i >>> 5]! |= 1 << (i & 31);
  const alive: Cand[][] = all.map((list, k) => (placed[k] ? [] : list.filter((c) => !overlaps(c.m, used))));
  const open = (): number[] => clues.map((_, k) => k).filter((k) => !placed[k]);

  /** Would this placement (alongside the right patches) leave a clue or a square with nowhere to go? */
  function blocked(k: number, m: Uint32Array, live: Cand[][]): (QuiltHintStep & { dep: number[] }) | null {
    const reach = emptyMask(n);
    orInto(reach, used); orInto(reach, m);
    for (const j of open()) {
      if (j === k) continue;
      let any = false;
      for (const c of live[j]!) {
        if (overlaps(c.m, m)) continue;
        orInto(reach, c.m); any = true;
      }
      if (!any) return { text: `Then ${name(j)} would have no room left for its patch.`, focus: [clues[j]!.cell], out: [clues[j]!.cell], dep: [j] };
    }
    for (let i = 0; i < total; i++) {
      if (!hasBit(reach, i)) return { text: `Then ${cellName(i)} couldn't be covered by any patch.`, focus: [i], out: [i], dep: couldReach(i).filter((j) => j !== k) };
    }
    return null;
  }

  function refuteDrawn(k: number, rect: Rect): QuiltHintStep | null {
    const cells = rectCells(rect, n);
    const m = emptyMask(n);
    for (const i of cells) m[i >>> 5]! |= 1 << (i & 31);
    // Work from the other right patches only.
    const live = all.map((list, j) => list.filter((c) => !overlaps(c.m, used)));
    const b = blocked(k, m, live);
    return b ? { text: `With it there, ${b.text.slice(5)}`, focus: b.focus, ...(b.out ? { out: b.out } : {}) } : null;
  }

  // Each step records which clues it narrowed (hits) and which clues it relied on (uses).
  interface Step { rows: QuiltHintStep[]; hits: number[]; uses: number[] }
  const log: Step[] = [];
  /** Clues whose candidates could have reached cell x before any step narrowed them. */
  const couldReach = (x: number): number[] =>
    open().filter((j) => all[j]!.some((c) => !overlaps(c.m, used) && hasBit(c.m, x)));

  // 1. A patch that doesn't fit its clue, or isn't the answer, comes off first.
  for (let k = 0; k < clues.length; k++) {
    const mine = drawn[k]!;
    if (!mine.length || right(k)) continue;
    const b = boundsOf(mine, n)!;
    let why: QuiltHintStep;
    if (!b.exact) why = { text: `It isn't a rectangle, and every patch has to be one.`, focus: mine, out: mine };
    else if (!fitsClue(clues[k]!, b.rect)) {
      const c = clues[k]!;
      why = {
        text: mine.length < 2 ? `A patch has to cover at least 2 squares.`
          : c.kind === 'area' ? `It covers ${mine.length} squares, but the clue says ${c.area}.`
            : c.kind === 'shape' ? `It isn't ${c.shape === 'square' ? 'a square' : c.shape}, but the clue says ${c.shape}.`
              : `It doesn't fit the clue.`,
        focus: mine, out: mine,
      };
    } else {
      why = refuteDrawn(k, b.rect) ?? { text: `It doesn't fit with the rest of the quilt: no full answer has ${name(k)}'s patch here.`, focus: mine, out: mine };
    }
    return {
      wrong: true, revealed: false, action: { kind: 'clear', clue: k },
      steps: [
        { text: `Look at ${name(k)}'s patch. It can't stay as it is.`, focus: [clues[k]!.cell, ...mine] },
        why,
        { text: `Take it off and try again.`, focus: mine },
      ],
    };
  }

  const done = (k: number, cand: Cand, last: QuiltHintStep[]): QuiltHint => {
    const need = new Set([k]);
    const kept: Step[] = [];
    for (let s = log.length - 1; s >= 0; s--) {
      const st = log[s]!;
      if (st.hits.some((h) => need.has(h))) { kept.unshift(st); st.uses.forEach((u) => need.add(u)); }
    }
    return {
      revealed: false, wrong: false, action: { kind: 'place', clue: k, rect: cand.rect },
      steps: [...kept.flatMap((st) => st.rows), ...last],
    };
  };

  function onlyRect(): QuiltHint | null {
    for (const k of open()) {
      if (alive[k]!.length !== 1) continue;
      const cand = alive[k]![0]!;
      const cells = rectCells(cand.rect, n);
      const narrowed = log.some((st) => st.hits.includes(k));
      return done(k, cand, [
        { text: `Look at ${name(k)}. ${narrowed ? 'After the steps above, there' : 'There'}'s only one patch it can make here.`, focus: [clues[k]!.cell] },
        { text: `So this is ${name(k)}'s patch.`, focus: cells },
      ]);
    }
    return null;
  }

  function onlyOwner(): boolean {
    const reach = open().map((k) => {
      const m = emptyMask(n);
      for (const c of alive[k]!) orInto(m, c.m);
      return m;
    });
    const ks = open();
    for (let x = 0; x < total; x++) {
      if (hasBit(used, x)) continue;
      const who = ks.filter((_, t) => hasBit(reach[t]!, x));
      if (who.length !== 1) continue;
      const k = who[0]!;
      const kept = alive[k]!.filter((c) => hasBit(c.m, x));
      if (kept.length === alive[k]!.length) continue;
      alive[k] = kept;
      log.push({
        rows: [{ text: `Only ${name(k)} can reach ${cellName(x)}, so its patch has to cover it.`, focus: [x, clues[k]!.cell] }],
        hits: [k], uses: couldReach(x),
      });
      return true;
    }
    return false;
  }

  function sharedCells(): boolean {
    for (const k of open()) {
      const live = alive[k]!;
      if (live.length < 2) continue;
      const must = live[0]!.m.slice();
      for (let i = 1; i < live.length && !isEmpty(must); i++) andInto(must, live[i]!.m);
      if (isEmpty(must)) continue;
      const hits: number[] = [];
      for (const j of open()) {
        if (j === k) continue;
        const kept = alive[j]!.filter((c) => !overlaps(c.m, must));
        if (kept.length !== alive[j]!.length) { alive[j] = kept; hits.push(j); }
      }
      if (!hits.length) continue;
      const cells = cellsOfMask(must, total);
      log.push({
        rows: [
          { text: `Whichever patch ${name(k)} makes, it covers ${cells.length === 1 ? 'this square' : 'these squares'}.`, focus: [clues[k]!.cell, ...cells] },
          { text: `So no other patch can use ${cells.length === 1 ? 'it' : 'them'}.`, focus: cells, out: cells },
        ],
        hits, uses: [k],
      });
      return true;
    }
    return false;
  }

  /**
   * Patches a clue can't make because they would leave another clue or a
   * square with nowhere to go. All of one clue's failures are worked out at
   * once and told as one row per reason, so a clue with thirty possible
   * patches doesn't take thirty rows. A clue that this leaves with a single
   * patch is preferred.
   */
  function refutation(): boolean {
    let best: { k: number; bad: Map<string, { why: QuiltHintStep & { dep: number[] }; cands: Cand[] }>; left: Cand[] } | null = null;
    for (const k of open()) {
      const live = alive[k]!;
      if (live.length < 2) continue;
      const bad = new Map<string, { why: QuiltHintStep & { dep: number[] }; cands: Cand[] }>();
      const left: Cand[] = [];
      for (const cand of live) {
        const why = blocked(k, cand.m, alive);
        if (!why) { left.push(cand); continue; }
        const g = bad.get(why.text);
        if (g) g.cands.push(cand); else bad.set(why.text, { why, cands: [cand] });
      }
      if (!bad.size || !left.length) continue;
      const score = (x: { bad: Map<string, unknown>; left: Cand[] }): number => (x.left.length === 1 ? 0 : 100) + x.bad.size;
      if (!best || score({ bad, left }) < score(best)) best = { k, bad, left };
      if (left.length === 1 && bad.size === 1) break;
    }
    if (!best) return false;
    const { k, bad, left } = best;
    alive[k] = left;
    const keep = emptyMask(n);
    for (const c of left) orInto(keep, c.m);
    const rows: QuiltHintStep[] = [];
    const dep = new Set<number>();
    for (const { why, cands } of bad.values()) {
      why.dep.forEach((d) => dep.add(d));
      // Squares every one of these patches covers and no surviving patch does:
      // covering any of them is exactly what fails.
      const m = cands[0]!.m.slice();
      for (const c of cands.slice(1)) andInto(m, c.m);
      const outCells = cellsOfMask(m, total).filter((i) => !hasBit(keep, i));
      const reason = why.text.replace(/^Then /, '').replace(/\.$/, '');
      const r = reason[0]!.toLowerCase() + reason.slice(1);
      rows.push(outCells.length
        ? { text: `${cap(name(k))}'s patch can't cover the marked squares, or ${r}.`, focus: [clues[k]!.cell, ...why.focus], out: outCells }
        : { text: `Some patches ${name(k)} could make would mean ${r}, so they're out.`, focus: [clues[k]!.cell, ...why.focus] });
    }
    log.push({ rows, hits: [k], uses: [...dep] });
    return true;
  }

  for (let guard = 0; guard < 2000; guard++) {
    const h = onlyRect();
    if (h) return h;
    if (onlyOwner() || sharedCells() || refutation()) continue;
    break;
  }

  // Beyond these: show the patch of the clue with the fewest choices left.
  const k = open().reduce((b, j) => (alive[j]!.length > 0 && (b < 0 || alive[j]!.length < alive[b]!.length) ? j : b), -1);
  const pick = k >= 0 ? k : open()[0]!;
  const cells = solution.flatMap((v, i) => (v === pick ? [i] : []));
  const rect = boundsOf(cells, n)!.rect;
  return {
    revealed: true, wrong: false, action: { kind: 'place', clue: pick, rect },
    steps: [
      { text: `This spot needs a long chain of reasoning, so here's a nudge instead.`, focus: [clues[pick]!.cell] },
      { text: `${cap(name(pick))}'s patch goes here.`, focus: cells },
    ],
  };
}

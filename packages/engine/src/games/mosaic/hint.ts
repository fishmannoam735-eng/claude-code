import { slide, solveLine, type Known } from './line.js';
import { allLines, cellsOf, clueFor, type Clues, type LineRef } from './solver.js';

/** A board as the player has it: 0 untouched, 1 filled, 2 crossed out. */
export const UNKNOWN = 0, FILLED = 1, CROSSED = 2;

export interface MosaicHintStep {
  text: string;
  /** The row or column the sentence is about; its squares and clue light up. */
  line: LineRef | null;
  /** Blocks drawn as see-through outlines: one way the clue could sit. */
  ghost: number[][];
  /** Squares this step concludes are filled. */
  fill: number[];
  /** Squares this step concludes are empty (a red ✕). */
  out: number[];
  /** Squares to point at without concluding anything. */
  focus: number[];
}

export interface MosaicHint {
  steps: MosaicHintStep[];
  /** Set these squares: 1 fill, 2 cross out, 0 clear. */
  action: { cell: number; value: 0 | 1 | 2 }[];
  /** True when a filled or crossed square doesn't match the picture. */
  wrong: boolean;
  /** True when no reasoning applied and a square is simply shown. */
  revealed: boolean;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const count = (n: number, one: string, many = `${one}s`): string => `${WORDS[n] ?? n} ${n === 1 ? one : many}`;
const lineName = (l: LineRef): string => `${l.kind === 'row' ? 'row' : 'column'} ${l.index + 1}`;
const Cap = (s: string): string => s[0]!.toUpperCase() + s.slice(1);
const clueText = (clue: readonly number[]): string => (clue.length ? clue.join(' ') : '0');
const step = (text: string, line: LineRef | null, extra: Partial<MosaicHintStep> = {}): MosaicHintStep =>
  ({ text, line, ghost: [], fill: [], out: [], focus: [], ...extra });

const known = (v: number): Known => (v === FILLED ? 1 : v === CROSSED ? 0 : -1);

/** Every way the clue fits the known squares, up to `cap` of them, as block start positions. */
function arrangements(clue: readonly number[], line: readonly Known[], cap: number): number[][] {
  const n = line.length, out: number[][] = [];
  const starts: number[] = [];
  const go = (i: number, j: number): void => {
    if (out.length > cap) return;
    if (j === clue.length) {
      for (let t = i; t < n; t++) if (line[t] === 1) return;
      out.push(starts.slice());
      return;
    }
    const len = clue[j]!;
    for (let s = i; s + len <= n; s++) {
      if (s > i && line[s - 1] === 1) return; // skipped over a filled square
      let ok = true;
      for (let t = s; t < s + len; t++) if (line[t] === 0) { ok = false; break; }
      if (!ok) continue;
      if (s + len < n && line[s + len] === 1) continue;
      starts.push(s);
      go(s + len + 1, j + 1);
      starts.pop();
    }
  };
  go(0, 0);
  return out;
}

interface Candidate {
  line: LineRef;
  kind: 'none' | 'done' | 'slide' | 'deep';
  fill: number[]; // positions along the line
  empty: number[];
  score: number;
}

export function nextMosaicHint(c: Clues, board: readonly number[], solution: readonly number[]): MosaicHint | null {
  const W = c.w;
  const where = (i: number): string => `row ${Math.floor(i / W) + 1}, column ${(i % W) + 1}`;

  // A square that doesn't match the picture comes first: everything else builds on it.
  const wrong = board.map((v, i) => i).filter((i) => (board[i] === FILLED && solution[i] === 0) || (board[i] === CROSSED && solution[i] === 1));
  if (wrong.length) {
    const i = wrong[0]!;
    const more = wrong.length > 1 ? ` ${Cap(count(wrong.length - 1, 'more square'))} ${wrong.length === 2 ? "doesn't" : "don't"} match either.` : '';
    const text = board[i] === FILLED
      ? `The square at ${where(i)} is filled, but it isn't part of the picture. Clear it and look again.${more}`
      : `The square at ${where(i)} is crossed out, but it belongs in the picture. Clear it and look again.${more}`;
    return { steps: [step(text, null, { out: [i] })], action: [{ cell: i, value: 0 }], wrong: true, revealed: false };
  }
  if (solution.every((v, i) => (v === 1) === (board[i] === FILLED))) return null;

  // Look at every line for what it gives away, and keep the clearest find.
  let best: Candidate | null = null;
  const rank = { none: 3, done: 2, slide: 1, deep: 0 };
  const better = (a: Candidate, b: Candidate | null): boolean =>
    !b || rank[a.kind] > rank[b.kind] || (rank[a.kind] === rank[b.kind] && a.score > b.score);
  for (const l of allLines(c)) {
    const cells = cellsOf(c, l);
    const line = cells.map((i) => known(board[i]!));
    if (!line.includes(-1)) continue;
    const clue = clueFor(c, l);
    const open = line.map((v, t) => (v === -1 ? t : -1)).filter((t) => t >= 0);
    const filled = line.filter((v) => v === 1).length;
    const sum = clue.reduce((a, b) => a + b, 0);
    let cand: Candidate | null = null;
    if (!clue.length) cand = { line: l, kind: 'none', fill: [], empty: open, score: open.length };
    else if (filled === sum) {
      const r = solveLine(clue, line);
      if (r && open.every((t) => r[t] === 0)) cand = { line: l, kind: 'done', fill: [], empty: open, score: open.length };
    }
    if (!cand) {
      const s = slide(clue, line);
      const fill = s ? s.fill.filter((t) => line[t] === -1) : [];
      const empty = s ? s.empty.filter((t) => line[t] === -1) : [];
      if (fill.length || empty.length) cand = { line: l, kind: 'slide', fill, empty, score: fill.length * 2 + empty.length };
    }
    if (!cand) {
      const r = solveLine(clue, line);
      const fill = r ? open.filter((t) => r[t] === 1) : [];
      const empty = r ? open.filter((t) => r[t] === 0) : [];
      if (fill.length || empty.length) cand = { line: l, kind: 'deep', fill, empty, score: fill.length * 2 + empty.length };
    }
    if (cand && better(cand, best)) best = cand;
  }

  if (!best) {
    // Nothing a person could reason out (shouldn't happen on our boards): show one square.
    const i = solution.findIndex((v, k) => v === 1 && board[k] !== FILLED);
    return {
      steps: [step(`Try filling the square at ${where(i)}.`, null, { fill: [i] })],
      action: [{ cell: i, value: 1 }], wrong: false, revealed: true,
    };
  }

  const l = best.line;
  const cells = cellsOf(c, l);
  const line = cells.map((i) => known(board[i]!));
  const clue = clueFor(c, l);
  const at = (ts: number[]): number[] => ts.map((t) => cells[t]!);
  const fill = at(best.fill), out = at(best.empty);
  const action = [...fill.map((cell) => ({ cell, value: 1 as const })), ...out.map((cell) => ({ cell, value: 2 as const }))];
  const name = lineName(l);
  const marked = line.some((v) => v !== -1);
  const blocks = (starts: number[]): number[][] => starts.map((s, j) => at(Array.from({ length: clue[j]! }, (_, k) => s + k)));
  const along = l.kind === 'row' ? ['left', 'right'] : ['up', 'down'];
  const steps: MosaicHintStep[] = [];

  const look = `Look at ${name}. Its clue is ${clueText(clue)}: ${clue.length > 1
    ? `blocks of ${clue.join(', then ')}, in that order, with at least one empty square between them`
    : clue[0] === 1 ? 'a single filled square' : `one block of ${clue[0]} filled squares in a row`}.`;

  switch (best.kind) {
    case 'none':
      steps.push(step(`${Cap(name)} has the clue 0: none of its squares are in the picture.`, l, { out }));
      break;
    case 'done':
      steps.push(step(look, l, { focus: cells }));
      steps.push(step(`${Cap(name)} already has every filled square its clue asks for, so the rest of it is empty.`, l, { out }));
      break;
    case 'slide': {
      const s = slide(clue, line)!;
      steps.push(step(look, l, { focus: cells }));
      const same = s.left.every((v, j) => v === s.right[j]);
      const keep = marked ? `, keeping to the squares you've already filled and crossed out` : '';
      if (same) {
        steps.push(step(`There's only one way to fit ${clueText(clue)} here${keep}.`, l, { ghost: blocks(s.left) }));
      } else {
        steps.push(step(`Push the ${clue.length > 1 ? 'blocks' : 'block'} as far ${along[0]} as ${clue.length > 1 ? 'they' : 'it'} can go${keep}.`, l, { ghost: blocks(s.left) }));
        steps.push(step(`Now push ${clue.length > 1 ? 'them' : 'it'} as far ${along[1]} as ${clue.length > 1 ? 'they' : 'it'} can go.`, l, { ghost: blocks(s.right) }));
      }
      const these = (xs: number[]): string => (xs.length === 1 ? 'this square' : `these ${count(xs.length, 'square')}`);
      const crossed = (xs: number[]): string => (xs.length === 1 ? 'the square marked ✕' : `the ${count(xs.length, 'square')} marked ✕`);
      let text: string;
      if (same) {
        const bits: string[] = [];
        if (fill.length) bits.push(`${these(fill)} ${fill.length === 1 ? 'is' : 'are'} filled`);
        if (out.length) bits.push(`${crossed(out)} ${out.length === 1 ? 'is' : 'are'} empty`);
        text = `So ${bits.join(', and ')}.`;
      } else {
        const bits: string[] = [];
        if (fill.length) bits.push(`The same block covers ${these(fill)} both times, so ${fill.length === 1 ? 'it' : 'they'} must be filled.`);
        if (out.length) bits.push(`No block can reach ${crossed(out)}, so ${out.length === 1 ? "it's" : "they're"} empty.`);
        text = bits.join(' ');
      }
      steps.push(step(text, l, { fill, out }));
      break;
    }
    case 'deep': {
      steps.push(step(look, l, { focus: cells }));
      const ways = arrangements(clue, line, 4);
      if (ways.length <= 4) {
        steps.push(step(`Around the squares you've already filled and crossed out, there ${ways.length === 1 ? 'is only one way' : `are only ${count(ways.length, 'way')}`} to fit ${clueText(clue)}.`, l, { focus: cells }));
        ways.forEach((w, k) => steps.push(step(`Way ${k + 1} of ${ways.length}.`, l, { ghost: blocks(w) })));
        const bits: string[] = [];
        if (fill.length) bits.push(`${fill.length === 1 ? 'this square is' : `these ${count(fill.length, 'square')} are`} filled`);
        if (out.length) bits.push(`${fill.length ? 'the' : 'the'} ${out.length === 1 ? 'square' : count(out.length, 'square')} marked ✕ ${out.length === 1 ? 'is' : 'are'} empty`);
        steps.push(step(`In every way, ${bits.join(', and ')}.`, l, { fill, out }));
      } else {
        const first = fill[0] ?? out[0]!;
        const isFill = fill.length > 0;
        steps.push(step(
          isFill
            ? `Suppose this square were empty. Then there would be no way left to fit ${clueText(clue)} around the squares you've already marked. So it must be filled.`
            : `Suppose this square were filled. Then there would be no way left to fit ${clueText(clue)} around the squares you've already marked. So it must be empty.`,
          l, isFill ? { fill: [first] } : { out: [first] },
        ));
        if (fill.length + out.length > 1) steps.push(step('The same check settles every square lit up here.', l, { fill, out }));
      }
      break;
    }
  }
  return { steps, action, wrong: false, revealed: false };
}

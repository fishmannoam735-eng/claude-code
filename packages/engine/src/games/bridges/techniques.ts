import { across, type Bridges, type Layout } from './grid.js';
import { closedGroup } from './solver.js';

/**
 * The reasoning a person uses on an island puzzle, written so every
 * conclusion remembers why it holds. The rater uses it to grade boards and
 * the hint uses the same record to explain a move one short step at a time.
 *
 *   level 0  a 1 never takes a double; a placed bridge blocks the ones that would cross it
 *   level 1  counting at one island: room left, and bridges it can't do without
 *   level 2  keeping everything joined: a link that would close off a finished
 *            group can't be built, and the only way to reach some islands must be
 *   level 3  what-if: try one choice, follow the counting, and see it break
 */

export type Tech = 'cap' | 'cross' | 'room' | 'must' | 'isolate' | 'connect' | 'whatif';
export const LEVEL: Record<Tech, number> = { cap: 0, cross: 0, room: 1, must: 1, isolate: 2, connect: 2, whatif: 3 };

export interface Contradiction {
  kind: 'over' | 'short' | 'closed' | 'cut' | 'cross';
  islands: number[];
  links: number[];
}

export interface Fact {
  link: number;
  kind: 'lo' | 'hi';
  value: number;
  tech: Tech;
  /** Facts from one application of a technique share an id, so they read as one step. */
  app: number;
  /** The island the reasoning is about, or -1. */
  island: number;
  deps: number[];
  /** Crossing: the link in the way. */
  by?: number;
  /** Isolate / connect: the islands that would be cut off. */
  group?: number[];
  /** Numbers as they stood: room → [placed], must → [most reachable]. */
  nums?: number[];
  /** Links that mattered as they stood: room → links with bridges, must → links still open. */
  around?: number[];
  /** What-if: what was tried, what happened, and the trial's own facts. */
  trial?: { kind: 'lo' | 'hi'; value: number; facts: Fact[]; why: Contradiction; whyDeps: number[]; base: number };
}

export class Deducer {
  lo: number[];
  hi: number[];
  loWhy: number[];
  hiWhy: number[];
  facts: Fact[] = [];
  private apps = 0;

  constructor(readonly layout: Layout, given?: Bridges) {
    const { links, islands } = layout;
    this.lo = links.map((_, k) => given?.[k] ?? 0);
    this.hi = links.map(() => 2);
    this.loWhy = links.map(() => -1);
    this.hiWhy = links.map(() => -1);
    const app = this.apps++;
    links.forEach((l, k) => {
      const cap = Math.min(2, islands[l.a]!.need, islands[l.b]!.need);
      if (cap < 2) this.set(k, 'hi', cap, 'cap', -1, [], {}, app);
    });
  }

  clone(): Deducer {
    const d = Object.create(Deducer.prototype) as Deducer;
    Object.assign(d, { layout: this.layout, lo: this.lo.slice(), hi: this.hi.slice(), loWhy: this.loWhy.slice(), hiWhy: this.hiWhy.slice(), facts: this.facts.slice(), apps: this.apps });
    return d;
  }

  private set(link: number, kind: 'lo' | 'hi', value: number, tech: Tech, island: number, deps: number[], extra: Partial<Fact>, app: number): number {
    const id = this.facts.length;
    this.facts.push({ link, kind, value, tech, app, island, deps: deps.filter((d) => d >= 0), ...extra });
    if (kind === 'lo') { this.lo[link] = value; this.loWhy[link] = id; } else { this.hi[link] = value; this.hiWhy[link] = id; }
    return id;
  }

  get done(): boolean { return this.lo.every((v, k) => v === this.hi[k]); }

  contradiction(): Contradiction | null {
    const { layout, lo, hi } = this;
    const { islands, links, linksOf, crosses } = layout;
    for (let k = 0; k < links.length; k++) {
      if (lo[k]! > hi[k]!) return { kind: 'over', islands: [links[k]!.a, links[k]!.b], links: [k] };
      if (lo[k]! > 0) for (const x of crosses[k]!) if (lo[x]! > 0) return { kind: 'cross', islands: [], links: [k, x] };
    }
    for (let i = 0; i < islands.length; i++) {
      let sLo = 0, sHi = 0;
      for (const k of linksOf[i]!) { sLo += lo[k]!; sHi += hi[k]!; }
      if (sLo > islands[i]!.need) return { kind: 'over', islands: [i], links: linksOf[i]!.filter((k) => lo[k]! > 0) };
      if (sHi < islands[i]!.need) return { kind: 'short', islands: [i], links: linksOf[i]!.filter((k) => hi[k]! > 0) };
    }
    const g = closedGroup(layout, lo);
    if (g) return { kind: 'closed', islands: g, links: [] };
    const side = cutOff(layout, hi, -1);
    if (side) return { kind: 'cut', islands: side, links: [] };
    return null;
  }

  /** Facts a contradiction rests on. */
  depsOf(c: Contradiction): number[] {
    const { linksOf } = this.layout;
    const out: number[] = [];
    if (c.kind === 'over' || c.kind === 'cross') for (const k of c.links) out.push(this.loWhy[k]!);
    if (c.kind === 'over' && c.links.length === 1) out.push(this.hiWhy[c.links[0]!]!);
    if (c.kind === 'short') for (const i of c.islands) for (const k of linksOf[i]!) out.push(this.hiWhy[k]!);
    if (c.kind === 'closed') for (const i of c.islands) for (const k of linksOf[i]!) out.push(this.loWhy[k]!);
    if (c.kind === 'cut') for (const i of c.islands) for (const k of linksOf[i]!) out.push(this.hiWhy[k]!);
    return out.filter((d) => d >= 0);
  }

  /** Apply the first technique at `level` that teaches something. */
  step(level: number): boolean {
    switch (level) {
      case 0: return this.cross();
      case 1: return this.room() || this.must();
      case 2: return this.isolate() || this.connect();
      case 3: return this.whatIf();
    }
    return false;
  }

  /** Simplest reasoning first, until stuck or broken. Returns the highest level used. */
  run(maxLevel: number, stop?: () => boolean): { level: number; broken: boolean } {
    let used = 0;
    for (;;) {
      if (this.contradiction()) return { level: used, broken: true };
      if (stop?.()) return { level: used, broken: false };
      let moved = false;
      for (let lv = 0; lv <= maxLevel; lv++) {
        if (this.step(lv)) { used = Math.max(used, lv); moved = true; break; }
      }
      if (!moved) return { level: used, broken: false };
    }
  }

  private cross(): boolean {
    const { crosses } = this.layout;
    for (let k = 0; k < this.lo.length; k++) {
      if (this.lo[k]! === 0) continue;
      const hit = crosses[k]!.filter((x) => this.hi[x]! > 0);
      if (!hit.length) continue;
      const app = this.apps++;
      for (const x of hit) this.set(x, 'hi', 0, 'cross', -1, [this.loWhy[k]!], { by: k }, app);
      return true;
    }
    return false;
  }

  private room(): boolean {
    const { islands, linksOf } = this.layout;
    for (let i = 0; i < islands.length; i++) {
      const need = islands[i]!.need;
      const ls = linksOf[i]!;
      let sLo = 0;
      for (const k of ls) sLo += this.lo[k]!;
      const cut = ls.filter((k) => this.hi[k]! > need - (sLo - this.lo[k]!));
      if (!cut.length) continue;
      const app = this.apps++;
      for (const k of cut) {
        const deps = ls.filter((x) => x !== k && this.lo[x]! > 0).map((x) => this.loWhy[x]!);
        this.set(k, 'hi', need - (sLo - this.lo[k]!), 'room', i, deps, { nums: [sLo], around: ls.filter((x) => this.lo[x]! > 0) }, app);
      }
      return true;
    }
    return false;
  }

  private must(): boolean {
    const { islands, linksOf } = this.layout;
    for (let i = 0; i < islands.length; i++) {
      const need = islands[i]!.need;
      const ls = linksOf[i]!;
      let sHi = 0;
      for (const k of ls) sHi += this.hi[k]!;
      const raise = ls.filter((k) => this.lo[k]! < need - (sHi - this.hi[k]!));
      if (!raise.length) continue;
      const app = this.apps++;
      const around = ls.filter((x) => this.hi[x]! > 0);
      for (const k of raise) {
        const deps = ls.filter((x) => x !== k).map((x) => this.hiWhy[x]!);
        this.set(k, 'lo', need - (sHi - this.hi[k]!), 'must', i, deps, { nums: [sHi], around }, app);
      }
      return true;
    }
    return false;
  }

  private isolate(): boolean {
    const { links, linksOf } = this.layout;
    for (let k = 0; k < links.length; k++) {
      if (this.lo[k]! >= this.hi[k]!) continue;
      const lo = this.lo.slice();
      lo[k]!++;
      const g = closedGroup(this.layout, lo);
      if (!g || !g.includes(links[k]!.a)) continue;
      const deps: number[] = [];
      for (const i of g) for (const x of linksOf[i]!) if (x !== k && this.lo[x]! > 0) deps.push(this.loWhy[x]!);
      this.set(k, 'hi', this.lo[k]!, 'isolate', -1, deps, { group: g }, this.apps++);
      return true;
    }
    return false;
  }

  private connect(): boolean {
    const { links, linksOf } = this.layout;
    for (let k = 0; k < links.length; k++) {
      if (this.lo[k]! > 0 || this.hi[k]! === 0) continue;
      const side = cutOff(this.layout, this.hi, k);
      if (!side) continue;
      const deps: number[] = [];
      for (const i of side) for (const x of linksOf[i]!) if (this.hi[x]! === 0) deps.push(this.hiWhy[x]!);
      this.set(k, 'lo', 1, 'connect', -1, deps, { group: side }, this.apps++);
      return true;
    }
    return false;
  }

  /**
   * Try one choice on an open link and follow levels 0–2. If the board breaks,
   * the other choice holds. Links at the tightest islands are tried first,
   * since that is where a person would look.
   */
  private whatIf(): boolean {
    const { links, islands, linksOf } = this.layout;
    const open: number[] = [];
    for (let k = 0; k < links.length; k++) if (this.lo[k]! < this.hi[k]!) open.push(k);
    const slack = (i: number) => linksOf[i]!.reduce((s, k) => s + this.hi[k]! - this.lo[k]!, 0) - (islands[i]!.need - linksOf[i]!.reduce((s, k) => s + this.lo[k]!, 0));
    open.sort((x, y) => Math.min(slack(links[x]!.a), slack(links[x]!.b)) - Math.min(slack(links[y]!.a), slack(links[y]!.b)));
    for (const k of open) {
      for (const kind of ['hi', 'lo'] as const) {
        const t = this.clone();
        const base = t.facts.length;
        const value = kind === 'hi' ? this.lo[k]! : this.lo[k]! + 1;
        t.set(k, kind, value, 'whatif', -1, [], {}, t.apps++);
        const r = t.run(2);
        if (!r.broken) continue;
        const why = t.contradiction()!;
        const whyDeps = t.depsOf(why);
        const trial = { kind, value, facts: t.facts, why, whyDeps, base };
        if (kind === 'hi') this.set(k, 'lo', value + 1, 'whatif', -1, [], { trial }, this.apps++);
        else this.set(k, 'hi', this.lo[k]!, 'whatif', -1, [], { trial }, this.apps++);
        return true;
      }
    }
    return false;
  }
}

/**
 * Islands that can't reach island 0's side (or, if island 0 is the one cut
 * off, the smaller side) over links still possible, ignoring `skip`.
 */
export function cutOff(layout: Layout, hi: readonly number[], skip: number): number[] | null {
  const { islands, links, linksOf } = layout;
  const N = islands.length;
  if (N <= 1) return null;
  const seen = new Uint8Array(N);
  const stack = [0];
  seen[0] = 1;
  let count = 1;
  while (stack.length) {
    const i = stack.pop()!;
    for (const k of linksOf[i]!) {
      if (k === skip || hi[k]! === 0) continue;
      const j = across(links[k]!, i);
      if (!seen[j]) { seen[j] = 1; count++; stack.push(j); }
    }
  }
  if (count === N) return null;
  const inside: number[] = [], outside: number[] = [];
  for (let i = 0; i < N; i++) (seen[i] ? inside : outside).push(i);
  return inside.length < outside.length ? inside : outside;
}

export interface HumanResult { solved: boolean; level: number; whatIfs: number; steps: number }

export function humanSolve(layout: Layout): HumanResult {
  const d = new Deducer(layout);
  let level = 0, whatIfs = 0, steps = 0;
  for (;;) {
    if (d.contradiction()) return { solved: false, level, whatIfs, steps };
    if (d.done) return { solved: true, level, whatIfs, steps };
    let moved = false;
    for (let lv = 0; lv <= 3; lv++) {
      if (d.step(lv)) {
        moved = true; steps++;
        level = Math.max(level, lv);
        if (lv === 3) whatIfs++;
        break;
      }
    }
    if (!moved) return { solved: false, level, whatIfs, steps };
  }
}

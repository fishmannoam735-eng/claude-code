import { across, type Bridges, type Layout } from './grid.js';

/**
 * Exact solver: bounds on each link ([lo, hi] bridges), tightened by the
 * island counts and by crossings, then a search over the link with the fewest
 * options. Connectivity prunes the search twice: the links still possible
 * must reach every island, and a group whose islands are all complete must
 * be the whole board.
 */

export interface Bounds { lo: number[]; hi: number[] }

export function initialBounds(layout: Layout, given?: Bridges): Bounds {
  const { islands, links } = layout;
  const lo = links.map((_, k) => given?.[k] ?? 0);
  const hi = links.map((l) => Math.min(2, islands[l.a]!.need, islands[l.b]!.need));
  return { lo, hi };
}

/** Tighten bounds until nothing changes. Returns false on a contradiction. */
export function propagate(layout: Layout, b: Bounds): boolean {
  const { islands, links, linksOf, crosses } = layout;
  const { lo, hi } = b;
  let changed = true;
  while (changed) {
    changed = false;
    for (let k = 0; k < links.length; k++) {
      if (lo[k]! > hi[k]!) return false;
      if (lo[k]! > 0) {
        for (const x of crosses[k]!) {
          if (lo[x]! > 0) return false;
          if (hi[x]! > 0) { hi[x] = 0; changed = true; }
        }
      }
    }
    for (let i = 0; i < islands.length; i++) {
      const need = islands[i]!.need;
      let sumLo = 0, sumHi = 0;
      for (const k of linksOf[i]!) { sumLo += lo[k]!; sumHi += hi[k]!; }
      if (sumLo > need || sumHi < need) return false;
      for (const k of linksOf[i]!) {
        const maxHere = need - (sumLo - lo[k]!);
        if (hi[k]! > maxHere) { hi[k] = maxHere; changed = true; }
        const minHere = need - (sumHi - hi[k]!);
        if (lo[k]! < minHere) { lo[k] = minHere; changed = true; }
        if (lo[k]! > hi[k]!) return false;
      }
    }
  }
  return connectedEnough(layout, b);
}

/**
 * The possible links (hi > 0) must still join every island, and no finished
 * group (every island in it complete on its placed bridges) may be smaller
 * than the whole board.
 */
export function connectedEnough(layout: Layout, b: Bounds): boolean {
  const { islands, links, linksOf } = layout;
  const N = islands.length;
  if (N <= 1) return true;
  // Reachability over possible links.
  const seen = new Uint8Array(N);
  const stack = [0];
  seen[0] = 1;
  let reached = 1;
  while (stack.length) {
    const i = stack.pop()!;
    for (const k of linksOf[i]!) {
      if (b.hi[k]! === 0) continue;
      const j = across(links[k]!, i);
      if (!seen[j]) { seen[j] = 1; reached++; stack.push(j); }
    }
  }
  if (reached < N) return false;
  return closedGroup(layout, b.lo) === null;
}

/** A group joined by placed bridges whose islands are all complete, if smaller than the board. */
export function closedGroup(layout: Layout, lo: readonly number[]): number[] | null {
  const { islands, links, linksOf } = layout;
  const N = islands.length;
  const seen = new Uint8Array(N);
  for (let s = 0; s < N; s++) {
    if (seen[s]) continue;
    const group = [s];
    seen[s] = 1;
    let closed = true;
    for (let q = 0; q < group.length; q++) {
      const i = group[q]!;
      let got = 0;
      for (const k of linksOf[i]!) {
        got += lo[k]!;
        if (lo[k]! === 0) continue;
        const j = across(links[k]!, i);
        if (!seen[j]) { seen[j] = 1; group.push(j); }
      }
      if (got !== islands[i]!.need) closed = false;
    }
    if (closed && group.length < N) return group;
  }
  return null;
}

/** Count solutions, stopping at `cap`. */
export function countSolutions(layout: Layout, cap = 2): { count: number; solution: Bridges | null } {
  let count = 0;
  let first: Bridges | null = null;
  const start = initialBounds(layout);

  const search = (b: Bounds): void => {
    if (count >= cap) return;
    if (!propagate(layout, b)) return;
    // Pick the open link with the fewest options, preferring tight islands.
    let best = -1, bestScore = Infinity;
    for (let k = 0; k < layout.links.length; k++) {
      const span = b.hi[k]! - b.lo[k]!;
      if (span === 0) continue;
      if (span < bestScore) { bestScore = span; best = k; if (span === 1) break; }
    }
    if (best < 0) {
      count++;
      if (!first) first = b.lo.slice();
      return;
    }
    for (let v = b.hi[best]!; v >= b.lo[best]!; v--) {
      const next: Bounds = { lo: b.lo.slice(), hi: b.hi.slice() };
      next.lo[best] = v; next.hi[best] = v;
      search(next);
      if (count >= cap) return;
    }
  };
  search(start);
  return { count, solution: first };
}

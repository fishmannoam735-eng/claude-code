/**
 * Bridges (island puzzle). Islands sit on an n×n grid of water; each shows how
 * many bridges touch it. Bridges run straight across or down between two
 * islands with only water between them, at most two between the same pair,
 * never crossing another bridge, and in the end every island is joined into
 * one group.
 *
 * A board is described by its islands. Every pair of islands that see each
 * other along a row or column is a "link"; a player's state is simply how
 * many bridges (0, 1 or 2) are on each link.
 */

export interface Island {
  cell: number;
  r: number;
  c: number;
  need: number;
}

export interface Link {
  /** Island indices; `a` is the left (or upper) end. */
  a: number;
  b: number;
  horizontal: boolean;
  /** The water cells the bridge passes over, in order from `a` to `b`. */
  cells: number[];
}

/** Bridges per link, in link order. */
export type Bridges = number[];

export interface Layout {
  n: number;
  islands: Island[];
  links: Link[];
  /** For each link, the links whose bridges would cross it. */
  crosses: number[][];
  /** For each island, the links that touch it. */
  linksOf: number[][];
}

export const rowOf = (i: number, n: number): number => Math.floor(i / n);
export const colOf = (i: number, n: number): number => i % n;

/** Builds every link between islands that can see each other, and which links cross. */
export function buildLayout(n: number, cells: readonly number[], needs: readonly number[]): Layout {
  const order = cells.map((cell, k) => ({ cell, need: needs[k]! })).sort((x, y) => x.cell - y.cell);
  const islands: Island[] = order.map(({ cell, need }) => ({ cell, r: rowOf(cell, n), c: colOf(cell, n), need }));
  const at = new Map(islands.map((s, k) => [s.cell, k]));
  const links: Link[] = [];
  islands.forEach((s, a) => {
    // right
    const row: number[] = [];
    for (let c = s.c + 1; c < n; c++) {
      const cell = s.r * n + c;
      const b = at.get(cell);
      if (b !== undefined) { if (row.length) links.push({ a, b, horizontal: true, cells: row.slice() }); break; }
      row.push(cell);
    }
    // down
    const col: number[] = [];
    for (let r = s.r + 1; r < n; r++) {
      const cell = r * n + s.c;
      const b = at.get(cell);
      if (b !== undefined) { if (col.length) links.push({ a, b, horizontal: false, cells: col.slice() }); break; }
      col.push(cell);
    }
  });
  const crosses: number[][] = links.map(() => []);
  for (let i = 0; i < links.length; i++) {
    const h = links[i]!;
    if (!h.horizontal) continue;
    const set = new Set(h.cells);
    for (let j = 0; j < links.length; j++) {
      const v = links[j]!;
      if (v.horizontal) continue;
      if (v.cells.some((c) => set.has(c))) { crosses[i]!.push(j); crosses[j]!.push(i); }
    }
  }
  const linksOf: number[][] = islands.map(() => []);
  links.forEach((l, k) => { linksOf[l.a]!.push(k); linksOf[l.b]!.push(k); });
  return { n, islands, links, crosses, linksOf };
}

/** The island at the other end of a link. */
export const across = (l: Link, island: number): number => (l.a === island ? l.b : l.a);

/** Bridges touching each island. */
export function counts(layout: Layout, bridges: Bridges): number[] {
  const out = new Array<number>(layout.islands.length).fill(0);
  layout.links.forEach((l, k) => { out[l.a]! += bridges[k]!; out[l.b]! += bridges[k]!; });
  return out;
}

/** Islands joined into groups by the bridges placed; returns a group id per island. */
export function groups(layout: Layout, bridges: Bridges): number[] {
  const parent = layout.islands.map((_, k) => k);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  layout.links.forEach((l, k) => { if (bridges[k]! > 0) parent[find(l.a)] = find(l.b); });
  return layout.islands.map((_, k) => find(k));
}

/** True when the link can take a bridge without crossing one already placed. */
export function blockedBy(layout: Layout, bridges: Bridges, link: number): number | null {
  for (const x of layout.crosses[link]!) if (bridges[x]! > 0) return x;
  return null;
}

export function isSolved(layout: Layout, bridges: Bridges): boolean {
  if (bridges.length !== layout.links.length) return false;
  for (let k = 0; k < bridges.length; k++) {
    const v = bridges[k]!;
    if (v < 0 || v > 2) return false;
    if (v > 0 && blockedBy(layout, bridges, k) !== null) return false;
  }
  const c = counts(layout, bridges);
  if (layout.islands.some((s, k) => c[k] !== s.need)) return false;
  const g = groups(layout, bridges);
  return g.every((x) => x === g[0]);
}

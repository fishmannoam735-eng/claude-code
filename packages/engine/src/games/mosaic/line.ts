/**
 * One row or column of a Mosaic board. A line is read as known squares:
 * 1 filled, 0 empty (crossed out), -1 not known yet. A clue is the list of
 * block lengths in order; an empty clue means the line has no filled squares.
 */
export type Known = 1 | 0 | -1;

/** The clue a line of filled (1) and empty squares spells. */
export function clueOf(line: ArrayLike<number>): number[] {
  const out: number[] = [];
  let run = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out;
}

/**
 * Everything that follows from the clue and the known squares, by trying every
 * way the blocks fit: a square filled in every way is filled, a square empty in
 * every way is empty. Returns null when no way fits (a contradiction).
 */
export function solveLine(clue: readonly number[], line: readonly Known[]): Known[] | null {
  const n = line.length, k = clue.length;
  // ok[i*(k+1)+j]: blocks j.. fit into squares i.. (1 yes, 2 no, 0 not worked out).
  const memo = new Uint8Array((n + 2) * (k + 1));
  const fits = (i: number, j: number): boolean => {
    if (i >= n) return j === k;
    const key = i * (k + 1) + j;
    if (memo[key]) return memo[key] === 1;
    let ok = false;
    if (j === k) {
      ok = true;
      for (let t = i; t < n; t++) if (line[t] === 1) { ok = false; break; }
    } else {
      if (line[i] !== 1 && fits(i + 1, j)) ok = true;
      if (!ok && canPlace(i, clue[j]!)) {
        const end = i + clue[j]!;
        ok = end === n ? j === k - 1 : line[end] !== 1 && fits(end + 1, j + 1);
      }
    }
    memo[key] = ok ? 1 : 2;
    return ok;
  };
  const canPlace = (i: number, len: number): boolean => {
    if (i + len > n) return false;
    for (let t = i; t < i + len; t++) if (line[t] === 0) return false;
    return true;
  };
  if (!fits(0, 0)) return null;

  const can1 = new Uint8Array(n), can0 = new Uint8Array(n);
  const seen = new Uint8Array((n + 2) * (k + 1));
  const stack: [number, number][] = [[0, 0]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const key = i * (k + 1) + j;
    if (seen[key] || i >= n) continue;
    seen[key] = 1;
    if (j === k) { for (let t = i; t < n; t++) can0[t] = 1; continue; }
    if (line[i] !== 1 && fits(i + 1, j)) { can0[i] = 1; stack.push([i + 1, j]); }
    if (canPlace(i, clue[j]!)) {
      const end = i + clue[j]!;
      if (end === n) {
        if (j === k - 1) for (let t = i; t < end; t++) can1[t] = 1;
      } else if (line[end] !== 1 && fits(end + 1, j + 1)) {
        for (let t = i; t < end; t++) can1[t] = 1;
        can0[end] = 1;
        stack.push([end + 1, j + 1]);
      }
    }
  }
  const out: Known[] = new Array(n);
  for (let t = 0; t < n; t++) out[t] = can1[t] && !can0[t] ? 1 : can0[t] && !can1[t] ? 0 : -1;
  return out;
}

/**
 * Where each block starts when every block is pushed as far left (towards
 * square 0) as the known squares allow. Null when nothing fits.
 */
export function leftmost(clue: readonly number[], line: readonly Known[]): number[] | null {
  const n = line.length, k = clue.length;
  const memo = new Map<number, boolean>();
  const fits = (i: number, j: number): boolean => {
    if (i >= n) return j === k;
    const key = i * (k + 1) + j;
    const m = memo.get(key);
    if (m !== undefined) return m;
    let ok: boolean;
    if (j === k) {
      ok = true;
      for (let t = i; t < n; t++) if (line[t] === 1) { ok = false; break; }
    } else {
      ok = (place(i, j) !== null) || (line[i] !== 1 && fits(i + 1, j));
    }
    memo.set(key, ok);
    return ok;
  };
  // Placing block j at i, and the rest fitting after it: where the rest starts, or null.
  const place = (i: number, j: number): number | null => {
    const len = clue[j]!;
    if (i + len > n) return null;
    for (let t = i; t < i + len; t++) if (line[t] === 0) return null;
    const end = i + len;
    if (end === n) return j === k - 1 ? n : null;
    if (line[end] === 1) return null;
    return fits(end + 1, j + 1) ? end + 1 : null;
  };
  if (!fits(0, 0)) return null;
  const starts: number[] = [];
  let i = 0;
  for (let j = 0; j < k; j++) {
    for (;;) {
      const next = place(i, j);
      if (next !== null) { starts.push(i); i = next; break; }
      i++;
    }
  }
  return starts;
}

/** Where each block starts when every block is pushed as far right as it goes. */
export function rightmost(clue: readonly number[], line: readonly Known[]): number[] | null {
  const n = line.length;
  const rev = leftmost(clue.slice().reverse(), line.slice().reverse());
  if (!rev) return null;
  return rev.reverse().map((s, j) => n - s - clue[j]!);
}

/**
 * The "slide" reasoning a person can do: push all the blocks left, then all
 * right. A square the same block covers both times is filled; a square no
 * block can reach in between is empty.
 */
export function slide(clue: readonly number[], line: readonly Known[]): { left: number[]; right: number[]; fill: number[]; empty: number[] } | null {
  const left = leftmost(clue, line), right = rightmost(clue, line);
  if (!left || !right) return null;
  const n = line.length;
  const fill: number[] = [], reach = new Uint8Array(n);
  clue.forEach((len, j) => {
    for (let t = right[j]!; t < left[j]! + len; t++) fill.push(t);
    for (let t = left[j]!; t < right[j]! + len; t++) reach[t] = 1;
  });
  const empty: number[] = [];
  for (let t = 0; t < n; t++) if (!reach[t]) empty.push(t);
  return { left, right, fill, empty };
}

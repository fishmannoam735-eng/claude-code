import { create } from 'zustand';
import { quilt, quiltGame, parseSeed, type QuiltPuzzle } from '@pb/engine';
import type { BaseSnapshot } from '../../lib/persistence';

const { boundsOf, colOf, fitsClue, rectCells, rowOf } = quiltGame;

/** Only the cells a move actually changed, so the undo stack stays small. */
export interface Move { cells: number[]; prev: number[] }

export interface Snapshot extends BaseSnapshot {
  owner: number[];
  undo: Move[];
  rowMistakes: number[];
}

/** What the player has drawn for one clue, and whether it contradicts it. */
export interface Patch {
  rect: { r: number; c: number; w: number; h: number } | null;
  broken: boolean;
}

interface GameState {
  seed: string | null;
  puzzle: QuiltPuzzle | null;
  owner: number[];
  undo: Move[];
  /** Cursor for keyboard play, and the corner a keyboard rectangle grows from. */
  selected: number | null;
  anchor: number | null;
  /** Live drag, before it is committed. */
  dragFrom: number | null;
  dragTo: number | null;
  /** Bumped when a drag spanned two clues and had to be refused; cleared by
   *  the next move that does something. */
  refused: number;
  elapsedBase: number;
  runningSince: number | null;
  mistakes: number;
  rowMistakes: number[];
  status: 'in_progress' | 'solved';
  puzzleDate: string | null;
  startedAt: string;
  completedAt: string | null;
  dirty: number;

  load: (seed: string, snapshot: Snapshot | null, puzzleDate: string | null) => boolean;
  snapshot: () => Snapshot;
  elapsed: () => number;
  patches: () => Patch[];
  previewRect: () => Span | null;
  beginAt: (i: number) => void;
  dragOver: (i: number) => void;
  endDrag: () => void;
  eraseAt: (i: number) => void;
  toggleAnchor: () => void;
  commitKeyboard: () => void;
  undoMove: () => void;
  clearAll: () => void;
  pause: () => void;
  resume: () => void;
  moveSelection: (dr: number, dc: number) => void;
}

export interface Span { r: number; c: number; w: number; h: number }

export const spanOf = (a: number, b: number, n: number): Span => {
  const r0 = Math.min(rowOf(a, n), rowOf(b, n)), r1 = Math.max(rowOf(a, n), rowOf(b, n));
  const c0 = Math.min(colOf(a, n), colOf(b, n)), c1 = Math.max(colOf(a, n), colOf(b, n));
  return { r: r0, c: c0, w: c1 - c0 + 1, h: r1 - r0 + 1 };
};

/**
 * What each clue's patch looks like right now.
 *
 * This is a plain function, not a store selector, and deliberately so: it
 * builds a fresh array every call, and a zustand selector returning a fresh
 * array re-renders forever because the identity never settles. Components
 * memoise it against `owner` instead. (React #185, found by mounting the page
 * — the store's own unit tests were all green.)
 */
export function patchesOf(puzzle: QuiltPuzzle | null, owner: readonly number[]): Patch[] {
  if (!puzzle) return [];
  const n = puzzle.n;
  const mine: number[][] = puzzle.clues.map(() => []);
  owner.forEach((k, i) => { if (k >= 0 && mine[k]) mine[k]!.push(i); });
  return puzzle.clues.map((clue, k) => {
    const b = boundsOf(mine[k]!, n);
    if (!b) return { rect: null, broken: false };
    return { rect: b.rect, broken: !b.exact || !fitsClue(clue, b.rect) };
  });
}

export const useQuilt = create<GameState>((set, get) => {
  function fold(): number {
    const { elapsedBase, runningSince } = get();
    return runningSince ? elapsedBase + (Date.now() - runningSince) : elapsedBase;
  }

  /**
   * Commit the rectangle spanned by two cells.
   *
   * One clue inside means "this patch is that clue's"; none means "rub out
   * whatever is here". Two or more is refused outright — there is no sensible
   * reading of it, and guessing one would quietly destroy work.
   *
   * Any patch the new rectangle touches is cleared *whole*, never trimmed.
   * Trimming leaves L-shaped remnants that are not rectangles and cannot be
   * anything the player meant.
   */
  function commit(a: number, b: number): void {
    const s = get();
    if (!s.puzzle || s.status !== 'in_progress') return;
    const n = s.puzzle.n;
    const rect = spanOf(a, b, n);
    const cells = rectCells(rect, n);
    const cellSet = new Set(cells);

    const inside = s.puzzle.clues
      .map((clue, k) => (cellSet.has(clue.cell) ? k : -1))
      .filter((k) => k >= 0);
    if (inside.length > 1) { set({ refused: s.refused + 1 }); return; }

    const k = inside[0];
    // A tap on a clue that already has a patch rubs it out; a tap on a bare
    // clue starts a 1x1. That makes the single tap a complete erase gesture.
    const already = k !== undefined && s.owner.some((o) => o === k);
    const assign = k !== undefined && !(cells.length === 1 && already);

    const owner = s.owner.slice();
    const changed: number[] = [];
    const prev: number[] = [];
    const touch = (i: number, v: number): void => {
      if (owner[i] === v) return;
      changed.push(i); prev.push(owner[i]!); owner[i] = v;
    };

    const doomed = new Set<number>();
    for (const i of cells) if (owner[i]! >= 0) doomed.add(owner[i]!);
    if (k !== undefined) doomed.add(k);
    for (let i = 0; i < owner.length; i++) {
      if (owner[i]! >= 0 && doomed.has(owner[i]!)) touch(i, -1);
    }
    if (assign) for (const i of cells) touch(i, k);

    if (changed.length === 0) return;

    // A finished rectangle that contradicts its own clue is a mistake. A rub-out
    // never is, and neither is a patch that is merely in the wrong place.
    let { mistakes } = s;
    const rowMistakes = s.rowMistakes.slice();
    if (assign && !fitsClue(s.puzzle.clues[k]!, rect)) {
      mistakes++;
      rowMistakes[rowOf(s.puzzle.clues[k]!.cell, n)]!++;
    }

    let status: 'in_progress' | 'solved' = s.status;
    let completedAt = s.completedAt;
    let elapsedBase = s.elapsedBase;
    let runningSince = s.runningSince;
    if (quilt.validate(s.puzzle, owner).ok) {
      status = 'solved';
      completedAt = new Date().toISOString();
      elapsedBase = fold();
      runningSince = null;
    }

    set({
      owner, undo: [...s.undo, { cells: changed, prev }], mistakes, rowMistakes,
      // The refusal notice stands until something works, then goes. Left to
      // itself it is sticky, and a sticky notice masks every later hint.
      refused: 0,
      status, completedAt, elapsedBase, runningSince, dirty: s.dirty + 1,
    });
  }

  return {
    seed: null, puzzle: null, owner: [], undo: [], selected: null, anchor: null,
    dragFrom: null, dragTo: null, refused: 0,
    elapsedBase: 0, runningSince: null, mistakes: 0, rowMistakes: [],
    status: 'in_progress', puzzleDate: null, startedAt: new Date().toISOString(),
    completedAt: null, dirty: 0,

    load: (seed, snap, puzzleDate) => {
      const parsed = parseSeed(seed);
      if (!parsed || parsed.game !== 'quilt') return false;
      const puzzle = quilt.generate(seed);
      const cells = puzzle.n * puzzle.n;
      const base = {
        seed, puzzle, selected: null, anchor: null,
        dragFrom: null, dragTo: null, refused: 0, dirty: 0,
      };
      if (snap && snap.v === 1 && snap.owner.length === cells) {
        set({
          ...base,
          owner: snap.owner.slice(), undo: snap.undo.slice(),
          elapsedBase: snap.elapsedMs, runningSince: snap.status === 'in_progress' ? Date.now() : null,
          mistakes: snap.mistakes, rowMistakes: snap.rowMistakes.slice(),
          status: snap.status, puzzleDate: snap.puzzleDate,
          startedAt: snap.startedAt, completedAt: snap.completedAt,
        });
      } else {
        set({
          ...base,
          owner: new Array<number>(cells).fill(-1), undo: [],
          elapsedBase: 0, runningSince: Date.now(),
          mistakes: 0, rowMistakes: new Array<number>(puzzle.n).fill(0),
          status: 'in_progress', puzzleDate, startedAt: new Date().toISOString(),
          completedAt: null, dirty: 1,
        });
      }
      return true;
    },

    snapshot: () => {
      const s = get();
      return {
        v: 1, owner: s.owner, undo: s.undo, elapsedMs: fold(), mistakes: s.mistakes,
        rowMistakes: s.rowMistakes, status: s.status, puzzleDate: s.puzzleDate,
        startedAt: s.startedAt, completedAt: s.completedAt,
      };
    },

    elapsed: fold,

    patches: () => patchesOf(get().puzzle, get().owner),

    previewRect: () => {
      const s = get();
      if (!s.puzzle) return null;
      if (s.dragFrom !== null && s.dragTo !== null) return spanOf(s.dragFrom, s.dragTo, s.puzzle.n);
      if (s.anchor !== null && s.selected !== null) return spanOf(s.anchor, s.selected, s.puzzle.n);
      return null;
    },

    beginAt: (i) => {
      if (get().status !== 'in_progress') return;
      set({ dragFrom: i, dragTo: i, selected: i, anchor: null });
    },

    dragOver: (i) => {
      const s = get();
      if (s.dragFrom === null || s.dragTo === i) return;
      set({ dragTo: i, selected: i });
    },

    endDrag: () => {
      const s = get();
      if (s.dragFrom === null || s.dragTo === null) return;
      const from = s.dragFrom, to = s.dragTo;
      set({ dragFrom: null, dragTo: null });
      commit(from, to);
    },

    eraseAt: (i) => {
      const s = get();
      const k = s.owner[i];
      if (k === undefined || k < 0 || !s.puzzle || s.status !== 'in_progress') return;
      const owner = s.owner.slice();
      const cells: number[] = [], prev: number[] = [];
      owner.forEach((v, j) => { if (v === k) { cells.push(j); prev.push(v); owner[j] = -1; } });
      set({ owner, undo: [...s.undo, { cells, prev }], dirty: s.dirty + 1 });
    },

    toggleAnchor: () => {
      const s = get();
      if (s.status !== 'in_progress') return;
      set({ anchor: s.anchor === null ? (s.selected ?? 0) : null });
    },

    commitKeyboard: () => {
      const s = get();
      if (s.selected === null) return;
      const from = s.anchor ?? s.selected;
      set({ anchor: null });
      commit(from, s.selected);
    },

    undoMove: () => {
      const s = get();
      const move = s.undo[s.undo.length - 1];
      if (!move || s.status !== 'in_progress') return;
      const owner = s.owner.slice();
      move.cells.forEach((i, k) => { owner[i] = move.prev[k]!; });
      set({ owner, undo: s.undo.slice(0, -1), dirty: s.dirty + 1 });
    },

    /** Wipes the board and the undo stack together — a stack whose entries no
     *  longer match anything on screen is worse than no stack. */
    clearAll: () => {
      const s = get();
      if (s.status !== 'in_progress' || !s.owner.some((k) => k >= 0)) return;
      set({ owner: s.owner.map(() => -1), undo: [], anchor: null, dirty: s.dirty + 1 });
    },

    pause: () => {
      const s = get();
      if (s.runningSince === null) return;
      set({ elapsedBase: fold(), runningSince: null, dirty: s.dirty + 1 });
    },

    resume: () => {
      const s = get();
      if (s.runningSince !== null || s.status !== 'in_progress' || !s.puzzle) return;
      set({ runningSince: Date.now() });
    },

    moveSelection: (dr, dc) => {
      const s = get();
      if (!s.puzzle) return;
      const n = s.puzzle.n;
      const cur = s.selected ?? 0;
      const r = Math.min(n - 1, Math.max(0, rowOf(cur, n) + dr));
      const c = Math.min(n - 1, Math.max(0, colOf(cur, n) + dc));
      set({ selected: r * n + c });
    },
  };
});

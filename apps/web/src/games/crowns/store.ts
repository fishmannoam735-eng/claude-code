import { create } from 'zustand';
import { crowns, crownsGame, parseSeed, type CrownsPuzzle } from '@pb/engine';
import type { BaseSnapshot } from '../../lib/persistence';

const { EMPTY, MARK, CROWN, CELLS, N, rowOf, colOf } = crownsGame;

/** Tapping a cell walks empty → mark → crown → empty. */
const nextValue = (v: number): number => (v === EMPTY ? MARK : v === MARK ? CROWN : EMPTY);

export interface Move { i: number; pv: number; nv: number }

export interface Snapshot extends BaseSnapshot {
  grid: number[];
  undo: Move[];
  rowMistakes: number[];
}

interface GameState {
  seed: string | null;
  puzzle: CrownsPuzzle | null;
  grid: number[];
  undo: Move[];
  selected: number | null;
  elapsedBase: number;
  runningSince: number | null;
  mistakes: number;
  rowMistakes: number[];
  status: 'in_progress' | 'solved';
  puzzleDate: string | null;
  startedAt: string;
  completedAt: string | null;
  lastPlaced: number | null;
  dirty: number;

  load: (seed: string, snapshot: Snapshot | null, puzzleDate: string | null) => boolean;
  snapshot: () => Snapshot;
  elapsed: () => number;
  tapCell: (i: number) => void;
  setCell: (i: number, v: number) => void;
  erase: () => void;
  undoMove: () => void;
  clearMarks: () => void;
  pause: () => void;
  resume: () => void;
  moveSelection: (dr: number, dc: number) => void;
}

export const useCrowns = create<GameState>((set, get) => {
  function fold(): number {
    const { elapsedBase, runningSince } = get();
    return runningSince ? elapsedBase + (Date.now() - runningSince) : elapsedBase;
  }

  function place(i: number, nv: number): void {
    const s = get();
    if (!s.puzzle || s.status !== 'in_progress') return;
    const grid = s.grid.slice();
    const pv = grid[i]!;
    if (pv === nv) return;
    grid[i] = nv;

    // Only a crown can be a mistake — marks are the player's own bookkeeping.
    let { mistakes } = s;
    const rowMistakes = s.rowMistakes.slice();
    if (nv === CROWN && s.puzzle.solution[i] !== CROWN) {
      mistakes++;
      rowMistakes[rowOf(i)]!++;
    }

    let status: 'in_progress' | 'solved' = s.status;
    let completedAt = s.completedAt;
    let elapsedBase = s.elapsedBase;
    let runningSince = s.runningSince;
    if (crowns.validate(s.puzzle, grid).ok) {
      status = 'solved';
      completedAt = new Date().toISOString();
      elapsedBase = fold();
      runningSince = null;
    }

    set({
      grid, undo: [...s.undo, { i, pv, nv }], mistakes, rowMistakes,
      lastPlaced: nv === CROWN ? i : null,
      status, completedAt, elapsedBase, runningSince, dirty: s.dirty + 1,
    });
  }

  return {
    seed: null, puzzle: null, grid: [], undo: [], selected: null,
    elapsedBase: 0, runningSince: null, mistakes: 0, rowMistakes: new Array<number>(N).fill(0),
    status: 'in_progress', puzzleDate: null, startedAt: new Date().toISOString(), completedAt: null,
    lastPlaced: null, dirty: 0,

    load: (seed, snap, puzzleDate) => {
      const parsed = parseSeed(seed);
      if (!parsed || parsed.game !== 'crowns') return false;
      const puzzle = crowns.generate(seed);
      const base = { seed, puzzle, selected: null, lastPlaced: null, dirty: 0 };
      if (snap && snap.v === 1 && snap.grid.length === CELLS) {
        set({
          ...base,
          grid: snap.grid.slice(), undo: snap.undo.slice(),
          elapsedBase: snap.elapsedMs, runningSince: snap.status === 'in_progress' ? Date.now() : null,
          mistakes: snap.mistakes, rowMistakes: snap.rowMistakes.slice(),
          status: snap.status, puzzleDate: snap.puzzleDate,
          startedAt: snap.startedAt, completedAt: snap.completedAt,
        });
      } else {
        set({
          ...base,
          grid: new Array<number>(CELLS).fill(EMPTY), undo: [],
          elapsedBase: 0, runningSince: Date.now(),
          mistakes: 0, rowMistakes: new Array<number>(N).fill(0),
          status: 'in_progress', puzzleDate, startedAt: new Date().toISOString(), completedAt: null,
          dirty: 1,
        });
      }
      return true;
    },

    snapshot: () => {
      const s = get();
      return {
        v: 1, grid: s.grid, undo: s.undo, elapsedMs: fold(), mistakes: s.mistakes,
        rowMistakes: s.rowMistakes, status: s.status, puzzleDate: s.puzzleDate,
        startedAt: s.startedAt, completedAt: s.completedAt,
      };
    },

    elapsed: fold,

    tapCell: (i) => {
      set({ selected: i });
      place(i, nextValue(get().grid[i]!));
    },

    setCell: (i, v) => { set({ selected: i }); place(i, v); },

    erase: () => {
      const s = get();
      if (s.selected !== null) place(s.selected, EMPTY);
    },

    undoMove: () => {
      const s = get();
      const move = s.undo[s.undo.length - 1];
      if (!move || s.status !== 'in_progress') return;
      const grid = s.grid.slice();
      grid[move.i] = move.pv;
      set({ grid, undo: s.undo.slice(0, -1), selected: move.i, lastPlaced: null, dirty: s.dirty + 1 });
    },

    /**
     * Marks pile up fast in this game. Clearing them wipes the undo history
     * too, rather than leaving a stack whose entries no longer match the board.
     */
    clearMarks: () => {
      const s = get();
      if (s.status !== 'in_progress' || !s.grid.some((v) => v === MARK)) return;
      set({ grid: s.grid.map((v) => (v === MARK ? EMPTY : v)), undo: [], dirty: s.dirty + 1 });
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
      const cur = s.selected ?? 0;
      const r = Math.min(N - 1, Math.max(0, rowOf(cur) + dr));
      const c = Math.min(N - 1, Math.max(0, colOf(cur) + dc));
      set({ selected: r * N + c });
    },
  };
});

export { EMPTY, MARK, CROWN };

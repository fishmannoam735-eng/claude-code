import { create } from 'zustand';
import { eclipse, eclipseGame, parseSeed, type EclipsePuzzle } from '@pb/engine';
import type { BaseSnapshot } from '../../lib/persistence';

const { SUN, MOON, CELLS, N, rowOf } = eclipseGame;

/** Tapping a cell walks empty → sun → moon → empty. */
const nextValue = (v: number): number => (v === 0 ? SUN : v === SUN ? MOON : 0);

export interface Move { i: number; pv: number; nv: number }

export interface Snapshot extends BaseSnapshot {
  grid: number[];
  undo: Move[];
  rowMistakes: number[];
}

interface GameState {
  seed: string | null;
  puzzle: EclipsePuzzle | null;
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
  pause: () => void;
  resume: () => void;
  moveSelection: (dr: number, dc: number) => void;
}

export const useEclipse = create<GameState>((set, get) => {
  function fold(): number {
    const { elapsedBase, runningSince } = get();
    return runningSince ? elapsedBase + (Date.now() - runningSince) : elapsedBase;
  }

  function place(i: number, nv: number): void {
    const s = get();
    if (!s.puzzle || s.status !== 'in_progress' || s.puzzle.givens[i] !== 0) return;

    const grid = s.grid.slice();
    const pv = grid[i]!;
    if (pv === nv) return;
    grid[i] = nv;

    // A mistake is a committed value that disagrees with the solution. Clearing
    // a cell is never a mistake, and the same wrong cell is only counted once.
    let { mistakes } = s;
    const rowMistakes = s.rowMistakes.slice();
    if (nv !== 0 && nv !== s.puzzle.solution[i]) {
      mistakes++;
      rowMistakes[rowOf(i)]!++;
    }

    let status: 'in_progress' | 'solved' = s.status;
    let completedAt = s.completedAt;
    let elapsedBase = s.elapsedBase;
    let runningSince = s.runningSince;
    if (eclipse.validate(s.puzzle, grid).ok) {
      status = 'solved';
      completedAt = new Date().toISOString();
      elapsedBase = fold();
      runningSince = null;
    }

    set({
      grid, undo: [...s.undo, { i, pv, nv }], mistakes, rowMistakes,
      lastPlaced: nv === 0 ? null : i, status, completedAt, elapsedBase, runningSince,
      dirty: s.dirty + 1,
    });
  }

  return {
    seed: null, puzzle: null, grid: [], undo: [], selected: null,
    elapsedBase: 0, runningSince: null, mistakes: 0, rowMistakes: new Array<number>(N).fill(0),
    status: 'in_progress', puzzleDate: null, startedAt: new Date().toISOString(), completedAt: null,
    lastPlaced: null, dirty: 0,

    load: (seed, snap, puzzleDate) => {
      const parsed = parseSeed(seed);
      if (!parsed || parsed.game !== 'eclipse') return false;
      const puzzle = eclipse.generate(seed);
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
          grid: puzzle.givens.slice(), undo: [],
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
      const s = get();
      if (!s.puzzle) return;
      set({ selected: i });
      if (s.puzzle.givens[i] === 0) place(i, nextValue(s.grid[i]!));
    },

    setCell: (i, v) => { set({ selected: i }); place(i, v); },

    erase: () => {
      const s = get();
      if (s.selected === null) return;
      place(s.selected, 0);
    },

    undoMove: () => {
      const s = get();
      const move = s.undo[s.undo.length - 1];
      if (!move || s.status !== 'in_progress') return;
      const grid = s.grid.slice();
      grid[move.i] = move.pv;
      set({ grid, undo: s.undo.slice(0, -1), selected: move.i, lastPlaced: null, dirty: s.dirty + 1 });
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
      const r = Math.min(N - 1, Math.max(0, Math.floor(cur / N) + dr));
      const c = Math.min(N - 1, Math.max(0, (cur % N) + dc));
      set({ selected: r * N + c });
    },
  };
});

export { SUN, MOON };

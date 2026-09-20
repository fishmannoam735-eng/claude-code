import { create } from 'zustand';
import { thread, threadGame, parseSeed, type ThreadPuzzle } from '@pb/engine';
import type { BaseSnapshot } from '../../lib/persistence';

const { openNeighbours, rowOf } = threadGame;

export interface Snapshot extends BaseSnapshot {
  path: number[];
  backtracks: number;
  rowBacktracks: number[];
}

interface GameState {
  seed: string | null;
  puzzle: ThreadPuzzle | null;
  /** Open neighbour lists for this board, walls already removed. */
  open: number[][];
  path: number[];
  dragging: boolean;
  elapsedBase: number;
  runningSince: number | null;
  backtracks: number;
  rowBacktracks: number[];
  status: 'in_progress' | 'solved';
  puzzleDate: string | null;
  startedAt: string;
  completedAt: string | null;
  dirty: number;

  load: (seed: string, snapshot: Snapshot | null, puzzleDate: string | null) => boolean;
  snapshot: () => Snapshot;
  elapsed: () => number;
  /** Pointer went down on a cell: continue from there, or start a new stroke. */
  beginAt: (cell: number) => void;
  /** Pointer moved over a cell while dragging. */
  dragTo: (cell: number) => void;
  endDrag: () => void;
  /** Extend (or retract) the line one cell in a compass direction. */
  stepDir: (dr: number, dc: number) => void;
  stepBack: () => void;
  clearPath: () => void;
  pause: () => void;
  resume: () => void;
}

export const useThread = create<GameState>((set, get) => {
  function fold(): number {
    const { elapsedBase, runningSince } = get();
    return runningSince ? elapsedBase + (Date.now() - runningSince) : elapsedBase;
  }

  /** Commit a new path, checking for a win and keeping the clock honest. */
  function commit(path: number[], extra: Partial<GameState> = {}): void {
    const s = get();
    if (!s.puzzle) return;
    let status: 'in_progress' | 'solved' = s.status;
    let completedAt = s.completedAt;
    let elapsedBase = s.elapsedBase;
    let runningSince = s.runningSince;
    if (thread.validate(s.puzzle, path).ok) {
      status = 'solved';
      completedAt = new Date().toISOString();
      elapsedBase = fold();
      runningSince = null;
    }
    set({ path, status, completedAt, elapsedBase, runningSince, dirty: s.dirty + 1, ...extra });
  }

  /**
   * Walking back over the cell you came from retracts a step. Anything else
   * has to be a legal move: adjacent, not through a wall, not already used.
   */
  function advance(cell: number): void {
    const s = get();
    if (!s.puzzle || s.status !== 'in_progress') return;
    const path = s.path;
    const tail = path[path.length - 1];
    if (tail === undefined || cell === tail) return;

    if (path.length >= 2 && cell === path[path.length - 2]) {
      const rowBacktracks = s.rowBacktracks.slice();
      rowBacktracks[rowOf(tail, s.puzzle.n)]!++;
      commit(path.slice(0, -1), { backtracks: s.backtracks + 1, rowBacktracks });
      return;
    }

    if (path.includes(cell)) return;
    if (!s.open[tail]!.includes(cell)) return;
    commit([...path, cell]);
  }

  return {
    seed: null, puzzle: null, open: [], path: [], dragging: false,
    elapsedBase: 0, runningSince: null, backtracks: 0, rowBacktracks: [],
    status: 'in_progress', puzzleDate: null, startedAt: new Date().toISOString(),
    completedAt: null, dirty: 0,

    load: (seed, snap, puzzleDate) => {
      const parsed = parseSeed(seed);
      if (!parsed || parsed.game !== 'thread') return false;
      const puzzle = thread.generate(seed);
      const open = openNeighbours(puzzle.n, new Set(puzzle.walls));
      // The path always begins on number 1; there is nowhere else it could.
      const fresh = [puzzle.waypoints[0]!];
      const base = { seed, puzzle, open, dragging: false, dirty: 0 };

      if (snap && snap.v === 1 && snap.path.length > 0) {
        set({
          ...base,
          path: snap.path.slice(),
          elapsedBase: snap.elapsedMs, runningSince: snap.status === 'in_progress' ? Date.now() : null,
          backtracks: snap.backtracks, rowBacktracks: snap.rowBacktracks.slice(),
          status: snap.status, puzzleDate: snap.puzzleDate,
          startedAt: snap.startedAt, completedAt: snap.completedAt,
        });
      } else {
        set({
          ...base,
          path: fresh,
          elapsedBase: 0, runningSince: Date.now(),
          backtracks: 0, rowBacktracks: new Array<number>(puzzle.n).fill(0),
          status: 'in_progress', puzzleDate, startedAt: new Date().toISOString(), completedAt: null,
          dirty: 1,
        });
      }
      return true;
    },

    snapshot: () => {
      const s = get();
      return {
        v: 1, path: s.path, elapsedMs: fold(),
        // `mistakes` is the shared column; Thread has no wrong moves to make,
        // only steps retraced, so it stays zero and backtracks ride alongside.
        mistakes: 0,
        backtracks: s.backtracks, rowBacktracks: s.rowBacktracks,
        status: s.status, puzzleDate: s.puzzleDate,
        startedAt: s.startedAt, completedAt: s.completedAt,
      };
    },

    elapsed: fold,

    beginAt: (cell) => {
      const s = get();
      if (!s.puzzle || s.status !== 'in_progress') return;
      set({ dragging: true });
      const at = s.path.indexOf(cell);
      if (at >= 0) {
        // Grabbing a cell already on the line rewinds to it.
        if (at < s.path.length - 1) {
          const rowBacktracks = s.rowBacktracks.slice();
          for (let k = at + 1; k < s.path.length; k++) rowBacktracks[rowOf(s.path[k]!, s.puzzle.n)]!++;
          commit(s.path.slice(0, at + 1), {
            backtracks: s.backtracks + (s.path.length - 1 - at),
            rowBacktracks,
          });
        }
        return;
      }
      advance(cell);
    },

    dragTo: (cell) => { if (get().dragging) advance(cell); },

    stepDir: (dr, dc) => {
      const s = get();
      if (!s.puzzle) return;
      const n = s.puzzle.n;
      const tail = s.path[s.path.length - 1];
      if (tail === undefined) return;
      const r = Math.floor(tail / n) + dr;
      const c = (tail % n) + dc;
      if (r < 0 || c < 0 || r >= n || c >= n) return;
      advance(r * n + c);
    },

    endDrag: () => set({ dragging: false }),

    stepBack: () => {
      const s = get();
      if (s.path.length < 2 || s.status !== 'in_progress' || !s.puzzle) return;
      const rowBacktracks = s.rowBacktracks.slice();
      rowBacktracks[rowOf(s.path[s.path.length - 1]!, s.puzzle.n)]!++;
      commit(s.path.slice(0, -1), { backtracks: s.backtracks + 1, rowBacktracks });
    },

    clearPath: () => {
      const s = get();
      if (!s.puzzle || s.status !== 'in_progress' || s.path.length < 2) return;
      commit([s.puzzle.waypoints[0]!]);
    },

    pause: () => {
      const s = get();
      if (s.runningSince === null) return;
      set({ elapsedBase: fold(), runningSince: null, dragging: false, dirty: s.dirty + 1 });
    },

    resume: () => {
      const s = get();
      if (s.runningSince !== null || s.status !== 'in_progress' || !s.puzzle) return;
      set({ runningSince: Date.now() });
    },
  };
});

import { create } from 'zustand';
import { noteHint } from '../../lib/assists';
import { mosaic as game, mosaicGame, parseSeed, type MosaicHint, type MosaicPuzzle } from '@pb/engine';
import type { BaseSnapshot } from '../../lib/persistence';
import { readJSON, writeJSON } from '../../lib/storage';

const { nextMosaicHint } = mosaicGame;

/** A square: untouched, filled in, or crossed out as empty. */
export const OPEN = 0, FILL = 1, CROSS = 2;
export type Tool = 'fill' | 'cross';

export interface Snapshot extends BaseSnapshot {
  /** Every square, row by row: 0 untouched, 1 filled, 2 crossed out. */
  paint: number[];
  /** Squares in the finished picture, so the start page can show progress without building it. */
  goal: number;
}

interface GameState {
  seed: string | null;
  puzzle: MosaicPuzzle | null;
  paint: number[];
  history: number[][];
  elapsedBase: number;
  runningSince: number | null;
  status: 'in_progress' | 'solved';
  puzzleDate: string | null;
  startedAt: string;
  completedAt: string | null;
  dirty: number;
  tool: Tool;
  /** The stroke in progress: what it writes, and over which squares it may write it. */
  stroke: { value: number; over: number } | null;
  /** Solved just now, rather than opened already solved: the picture waits for the win plaque. */
  justSolved: boolean;
  hint: MosaicHint | null;
  hintStep: number;

  load: (seed: string, snapshot: Snapshot | null, puzzleDate: string | null) => boolean;
  snapshot: () => Snapshot;
  elapsed: () => number;
  setTool: (t: Tool) => void;
  /** Press on a square: decides what the stroke writes, and writes it there. */
  begin: (i: number) => void;
  /** The stroke passes over another square. */
  extend: (i: number) => void;
  end: () => void;
  undo: () => void;
  clear: () => void;
  pause: () => void;
  resume: () => void;
  showHint: () => void;
  setHintStep: (k: number) => void;
  applyHint: () => void;
  dismissHint: () => void;
}

const TOOL_KEY = 'pb:mosaic:tool';
const goalOf = (p: MosaicPuzzle): number => p.solution.reduce((s, v) => s + v, 0);

export const useMosaic = create<GameState>((set, get) => {
  function fold(): number {
    const { elapsedBase, runningSince } = get();
    return runningSince ? elapsedBase + (Date.now() - runningSince) : elapsedBase;
  }

  /** Writes a new board; `remember` pushes the old one onto the undo history. */
  function write(next: number[], remember: boolean): void {
    const s = get();
    if (!s.puzzle) return;
    let status: 'in_progress' | 'solved' = s.status;
    let completedAt = s.completedAt;
    let elapsedBase = s.elapsedBase;
    let runningSince = s.runningSince;
    let stroke = s.stroke;
    let justSolved = s.justSolved;
    if (game.validate(s.puzzle, next).ok) {
      status = 'solved';
      completedAt = new Date().toISOString();
      elapsedBase = fold();
      runningSince = null;
      stroke = null;
      justSolved = true;
    }
    set({
      paint: next, history: remember ? [...s.history.slice(-199), s.paint] : s.history,
      status, completedAt, elapsedBase, runningSince, stroke, justSolved,
      dirty: s.dirty + 1, hint: null, hintStep: 0,
    });
  }

  const playable = (): boolean => {
    const s = get();
    return !!s.puzzle && s.status === 'in_progress' && s.runningSince !== null;
  };

  return {
    seed: null, puzzle: null, paint: [], history: [],
    elapsedBase: 0, runningSince: null, status: 'in_progress', puzzleDate: null,
    startedAt: new Date().toISOString(), completedAt: null, dirty: 0,
    tool: readJSON<Tool>(TOOL_KEY) === 'cross' ? 'cross' : 'fill',
    stroke: null, justSolved: false, hint: null, hintStep: 0,

    load: (seed, snap, puzzleDate) => {
      const parsed = parseSeed(seed);
      if (!parsed || parsed.game !== 'mosaic') return false;
      const puzzle = game.generate(seed);
      const base = { seed, puzzle, history: [], dirty: 0, hint: null, hintStep: 0, stroke: null, justSolved: false };
      if (snap && snap.v === 1 && Array.isArray(snap.paint) && snap.paint.length === puzzle.w * puzzle.h) {
        set({
          ...base,
          paint: snap.paint.slice(),
          elapsedBase: snap.elapsedMs, runningSince: snap.status === 'in_progress' ? Date.now() : null,
          status: snap.status, puzzleDate: snap.puzzleDate, startedAt: snap.startedAt, completedAt: snap.completedAt,
        });
      } else {
        set({
          ...base,
          paint: puzzle.solution.map(() => OPEN),
          elapsedBase: 0, runningSince: Date.now(),
          status: 'in_progress', puzzleDate, startedAt: new Date().toISOString(), completedAt: null,
          dirty: 1,
        });
      }
      return true;
    },

    snapshot: () => {
      const s = get();
      return {
        v: 1, paint: s.paint, goal: s.puzzle ? goalOf(s.puzzle) : 0, elapsedMs: fold(),
        // Like Eclipse, Mosaic counts no mistakes: the picture simply isn't finished until it's right.
        mistakes: 0,
        status: s.status, puzzleDate: s.puzzleDate, startedAt: s.startedAt, completedAt: s.completedAt,
      };
    },

    elapsed: fold,

    setTool: (tool) => { writeJSON(TOOL_KEY, tool); set({ tool }); },

    begin: (i) => {
      if (!playable()) return;
      const s = get();
      const cur = s.paint[i]!;
      const want = s.tool === 'fill' ? FILL : CROSS;
      // Pressing on a square that already holds the tool's mark rubs it out,
      // and so does the rest of the stroke; otherwise the stroke writes the
      // mark over untouched squares (it never paints over the other mark).
      const stroke = cur === want ? { value: OPEN, over: want } : { value: want, over: cur === OPEN ? OPEN : cur };
      const next = s.paint.slice();
      next[i] = stroke.value;
      set({ stroke });
      write(next, true);
    },

    extend: (i) => {
      const s = get();
      if (!s.stroke || !playable()) return;
      if (s.paint[i] !== s.stroke.over || s.paint[i] === s.stroke.value) return;
      const next = s.paint.slice();
      next[i] = s.stroke.value;
      write(next, false);
    },

    end: () => set({ stroke: null }),

    undo: () => {
      const s = get();
      if (!s.history.length || s.status !== 'in_progress') return;
      const prev = s.history[s.history.length - 1]!;
      set({ paint: prev, history: s.history.slice(0, -1), dirty: s.dirty + 1, hint: null, hintStep: 0, stroke: null });
    },

    clear: () => {
      const s = get();
      if (!s.puzzle || s.status !== 'in_progress' || s.paint.every((v) => v === OPEN)) return;
      write(s.paint.map(() => OPEN), true);
    },

    pause: () => {
      const s = get();
      if (s.runningSince === null) return;
      set({ elapsedBase: fold(), runningSince: null, dirty: s.dirty + 1, stroke: null });
    },

    resume: () => {
      const s = get();
      if (s.runningSince !== null || s.status !== 'in_progress' || !s.puzzle) return;
      set({ runningSince: Date.now() });
    },

    showHint: () => {
      const s = get();
      if (!s.puzzle || s.status !== 'in_progress') return;
      if (s.hint) { set({ hint: null, hintStep: 0 }); return; }
      noteHint(s.seed, s.paint);
      set({ hint: nextMosaicHint(s.puzzle, s.paint, s.puzzle.solution), hintStep: 0 });
    },

    setHintStep: (k) => {
      const { hint } = get();
      if (!hint) return;
      set({ hintStep: Math.max(0, Math.min(hint.steps.length - 1, k)) });
    },

    applyHint: () => {
      const s = get();
      if (!s.hint || !s.puzzle || s.status !== 'in_progress') return;
      const next = s.paint.slice();
      for (const a of s.hint.action) next[a.cell] = a.value;
      write(next, true);
    },

    dismissHint: () => set({ hint: null, hintStep: 0 }),
  };
});

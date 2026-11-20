import { create } from 'zustand';
import { noteHint } from '../../lib/assists';
import { bridges as game, bridgesGame, parseSeed, type BridgesHint, type BridgesPuzzle } from '@pb/engine';
import type { BaseSnapshot } from '../../lib/persistence';

const { blockedBy, nextBridgesHint } = bridgesGame;

export interface Snapshot extends BaseSnapshot {
  bridges: number[];
  /** Bridges in the finished board, so the start page can show progress without building it. */
  goal: number;
}

/** The last change, so the board knows which end a new bridge grows from. */
export interface Change { link: number; from: 'a' | 'b'; n: number }

interface GameState {
  seed: string | null;
  puzzle: BridgesPuzzle | null;
  bridges: number[];
  history: number[][];
  elapsedBase: number;
  runningSince: number | null;
  status: 'in_progress' | 'solved';
  puzzleDate: string | null;
  startedAt: string;
  completedAt: string | null;
  dirty: number;
  change: Change | null;
  /** A refused bridge: the link that was in the way, so the board can flash it. */
  refused: { link: number; by: number; n: number } | null;
  hint: BridgesHint | null;
  hintStep: number;

  load: (seed: string, snapshot: Snapshot | null, puzzleDate: string | null) => boolean;
  snapshot: () => Snapshot;
  elapsed: () => number;
  /** Add a bridge (0 → 1 → 2 → none). `from` is the end the player started at. */
  cycle: (link: number, from?: 'a' | 'b') => void;
  undo: () => void;
  clear: () => void;
  pause: () => void;
  resume: () => void;
  showHint: () => void;
  setHintStep: (k: number) => void;
  applyHint: () => void;
  dismissHint: () => void;
}

const goalOf = (p: BridgesPuzzle): number => p.solution.reduce((s, v) => s + v, 0);

export const useBridges = create<GameState>((set, get) => {
  function fold(): number {
    const { elapsedBase, runningSince } = get();
    return runningSince ? elapsedBase + (Date.now() - runningSince) : elapsedBase;
  }

  function commit(next: number[], change: Change | null): void {
    const s = get();
    if (!s.puzzle) return;
    let status: 'in_progress' | 'solved' = s.status;
    let completedAt = s.completedAt;
    let elapsedBase = s.elapsedBase;
    let runningSince = s.runningSince;
    if (game.validate(s.puzzle, next).ok) {
      status = 'solved';
      completedAt = new Date().toISOString();
      elapsedBase = fold();
      runningSince = null;
    }
    set({
      bridges: next, history: [...s.history.slice(-199), s.bridges], status, completedAt, elapsedBase, runningSince,
      dirty: s.dirty + 1, hint: null, hintStep: 0, change,
    });
  }

  return {
    seed: null, puzzle: null, bridges: [], history: [],
    elapsedBase: 0, runningSince: null, status: 'in_progress', puzzleDate: null,
    startedAt: new Date().toISOString(), completedAt: null, dirty: 0,
    change: null, refused: null, hint: null, hintStep: 0,

    load: (seed, snap, puzzleDate) => {
      const parsed = parseSeed(seed);
      if (!parsed || parsed.game !== 'bridges') return false;
      const puzzle = game.generate(seed);
      const base = { seed, puzzle, history: [], dirty: 0, hint: null, hintStep: 0, change: null, refused: null };
      if (snap && snap.v === 1 && snap.bridges.length === puzzle.layout.links.length) {
        set({
          ...base,
          bridges: snap.bridges.slice(),
          elapsedBase: snap.elapsedMs, runningSince: snap.status === 'in_progress' ? Date.now() : null,
          status: snap.status, puzzleDate: snap.puzzleDate, startedAt: snap.startedAt, completedAt: snap.completedAt,
        });
      } else {
        set({
          ...base,
          bridges: puzzle.layout.links.map(() => 0),
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
        v: 1, bridges: s.bridges, goal: s.puzzle ? goalOf(s.puzzle) : 0, elapsedMs: fold(),
        // Like Eclipse, Bridges counts no mistakes: an island with too many bridges just turns red.
        mistakes: 0,
        status: s.status, puzzleDate: s.puzzleDate, startedAt: s.startedAt, completedAt: s.completedAt,
      };
    },

    elapsed: fold,

    cycle: (link, from = 'a') => {
      const s = get();
      if (!s.puzzle || s.status !== 'in_progress' || s.runningSince === null) return;
      const cur = s.bridges[link]!;
      const nextCount = cur === 2 ? 0 : cur + 1;
      if (cur === 0) {
        const by = blockedBy(s.puzzle.layout, s.bridges, link);
        if (by !== null) { set({ refused: { link, by, n: (s.refused?.n ?? 0) + 1 } }); return; }
      }
      const next = s.bridges.slice();
      next[link] = nextCount;
      commit(next, { link, from, n: (s.change?.n ?? 0) + 1 });
    },

    undo: () => {
      const s = get();
      if (!s.history.length || s.status !== 'in_progress') return;
      const prev = s.history[s.history.length - 1]!;
      set({ bridges: prev, history: s.history.slice(0, -1), dirty: s.dirty + 1, hint: null, hintStep: 0, change: null });
    },

    clear: () => {
      const s = get();
      if (!s.puzzle || s.status !== 'in_progress' || s.bridges.every((v) => v === 0)) return;
      commit(s.bridges.map(() => 0), null);
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

    showHint: () => {
      const s = get();
      if (!s.puzzle || s.status !== 'in_progress') return;
      if (s.hint) { set({ hint: null, hintStep: 0 }); return; }
      noteHint(s.seed, s.bridges);
      set({ hint: nextBridgesHint(s.puzzle.layout, s.bridges, s.puzzle.solution), hintStep: 0 });
    },

    setHintStep: (k) => {
      const { hint } = get();
      if (!hint) return;
      set({ hintStep: Math.max(0, Math.min(hint.steps.length - 1, k)) });
    },

    applyHint: () => {
      const s = get();
      if (!s.hint || !s.puzzle || s.status !== 'in_progress') return;
      const next = s.bridges.slice();
      for (const a of s.hint.action) next[a.link] = a.count;
      const first = s.hint.action[0];
      commit(next, first ? { link: first.link, from: 'a', n: (s.change?.n ?? 0) + 1 } : null);
    },

    dismissHint: () => set({ hint: null, hintStep: 0 }),
  };
});

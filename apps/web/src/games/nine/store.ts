import { create } from 'zustand';
import { nine, nineGame, parseSeed, type NinePuzzle } from '@pb/engine';

/** One undoable action. Placing a digit also strips that digit from peers' notes. */
export interface Move {
  i: number;
  pv: number; nv: number;         // value before / after
  pn: number; nn: number;         // notes bitmask before / after
  peers: [number, number][];      // [peerIndex, notesBefore]
}

export type Status = 'in_progress' | 'solved';

/** What gets persisted (localStorage + plays.state). Puzzle is regenerated from the seed. */
export interface Snapshot {
  v: 1;
  grid: number[];
  notes: number[];
  undo: Move[];
  elapsedMs: number;
  mistakes: number;
  boxMistakes: number[];
  status: Status;
  puzzleDate: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface GameState {
  seed: string | null;
  puzzle: NinePuzzle | null;
  mode: 'daily' | 'practice';
  grid: number[];
  notes: number[];
  undo: Move[];
  selected: number | null;
  lockedDigit: number | null;     // digit-first input: paint this digit into tapped cells
  highlightDigit: number | null;  // every cell with this digit is highlighted
  notesMode: boolean;
  elapsedBase: number;
  runningSince: number | null;
  mistakes: number;
  boxMistakes: number[];
  status: Status;
  puzzleDate: string | null;
  startedAt: string;
  completedAt: string | null;
  lastPlaced: number | null;
  lastWrong: number | null;
  dirty: number;                  // bumps on every persisted-state change
  /** The hint on show, if any. Cleared by the next move. */
  hint: NineHint | null;

  load: (seed: string, snapshot: Snapshot | null, puzzleDate: string | null) => boolean;
  snapshot: () => Snapshot;
  elapsed: () => number;
  selectCell: (i: number) => void;
  tapDigit: (d: number) => void;
  erase: () => void;
  toggleNotes: () => void;
  undoMove: () => void;
  pause: () => void;
  resume: () => void;
  moveSelection: (dr: number, dc: number) => void;
  /** Work out the next step and show it. */
  showHint: () => void;
  /** Place the digit the hint points at (or erase the wrong entry it found). */
  applyHint: () => void;
  dismissHint: () => void;
  /** Pencil every empty cell with all the numbers it can still take. */
  fillNotes: () => void;
}

export type NineHint = nineGame.Hint & { wrong?: boolean };

const bit = (d: number): number => 1 << d;

export const useNine = create<GameState>((set, get) => {
  function fold(): number {
    const { elapsedBase, runningSince } = get();
    return runningSince ? elapsedBase + (Date.now() - runningSince) : elapsedBase;
  }

  function apply(i: number, d: number): void {
    const s = get();
    if (!s.puzzle || s.status !== 'in_progress' || s.puzzle.givens[i] !== 0) return;
    const grid = s.grid.slice();
    const notes = s.notes.slice();
    const move: Move = { i, pv: grid[i]!, nv: grid[i]!, pn: notes[i]!, nn: notes[i]!, peers: [] };

    if (s.notesMode) {
      if (grid[i] !== 0) return;
      notes[i] = notes[i]! ^ bit(d);
      move.nn = notes[i]!;
      set({ grid, notes, undo: [...s.undo, move], hint: null, dirty: s.dirty + 1 });
      return;
    }

    const nv = grid[i] === d ? 0 : d;
    grid[i] = nv;
    notes[i] = 0;
    move.nv = nv; move.nn = 0;
    if (nv !== 0) {
      for (const j of nineGame.PEERS[i]!) {
        if (grid[j] === 0 && (notes[j]! & bit(nv))) {
          move.peers.push([j, notes[j]!]);
          notes[j] = notes[j]! & ~bit(nv);
        }
      }
    }

    let { mistakes, lastWrong } = s;
    const boxMistakes = s.boxMistakes.slice();
    if (nv !== 0 && nv !== s.puzzle.solution[i]) {
      mistakes++;
      boxMistakes[nineGame.boxOf(i)]!++;
      lastWrong = i;
    } else {
      lastWrong = null;
    }

    let status: Status = s.status;
    let completedAt = s.completedAt;
    let elapsedBase = s.elapsedBase;
    let runningSince = s.runningSince;
    if (nineGame.isComplete(grid) && nine.validate(s.puzzle, grid).ok) {
      status = 'solved';
      completedAt = new Date().toISOString();
      elapsedBase = fold();
      runningSince = null;
    }

    set({
      grid, notes, undo: [...s.undo, move], mistakes, boxMistakes, lastWrong, lastPlaced: i, hint: null,
      status, completedAt, elapsedBase, runningSince, dirty: s.dirty + 1,
    });
  }

  return {
    seed: null, puzzle: null, mode: 'practice',
    grid: [], notes: [], undo: [],
    selected: null, lockedDigit: null, highlightDigit: null, notesMode: false,
    elapsedBase: 0, runningSince: null, mistakes: 0, boxMistakes: new Array<number>(9).fill(0),
    status: 'in_progress', puzzleDate: null, startedAt: new Date().toISOString(), completedAt: null,
    lastPlaced: null, lastWrong: null, dirty: 0, hint: null,

    load: (seed, snap, puzzleDate) => {
      const parsed = parseSeed(seed);
      if (!parsed || parsed.game !== 'nine') return false;
      const puzzle = nine.generate(seed);
      const base = {
        seed, puzzle, mode: parsed.isDaily ? 'daily' as const : 'practice' as const,
        selected: null, lockedDigit: null, highlightDigit: null, notesMode: false,
        lastPlaced: null, lastWrong: null, dirty: 0, hint: null,
      };
      if (snap && snap.v === 1 && snap.grid.length === 81) {
        set({
          ...base,
          grid: snap.grid.slice(), notes: snap.notes.slice(), undo: snap.undo.slice(),
          elapsedBase: snap.elapsedMs, runningSince: snap.status === 'in_progress' ? Date.now() : null,
          mistakes: snap.mistakes, boxMistakes: snap.boxMistakes.slice(),
          status: snap.status, puzzleDate: snap.puzzleDate, startedAt: snap.startedAt, completedAt: snap.completedAt,
        });
      } else {
        set({
          ...base,
          grid: puzzle.givens.slice(), notes: new Array<number>(81).fill(0), undo: [],
          elapsedBase: 0, runningSince: Date.now(), mistakes: 0, boxMistakes: new Array<number>(9).fill(0),
          status: 'in_progress', puzzleDate, startedAt: new Date().toISOString(), completedAt: null,
          dirty: 1,
        });
      }
      return true;
    },

    snapshot: () => {
      const s = get();
      return {
        v: 1, grid: s.grid, notes: s.notes, undo: s.undo, elapsedMs: fold(),
        mistakes: s.mistakes, boxMistakes: s.boxMistakes, status: s.status,
        puzzleDate: s.puzzleDate, startedAt: s.startedAt, completedAt: s.completedAt,
      };
    },

    elapsed: fold,

    selectCell: (i) => {
      const s = get();
      if (!s.puzzle) return;
      const given = s.puzzle.givens[i] !== 0;
      if (s.lockedDigit !== null && !given && s.status === 'in_progress') {
        set({ selected: i });
        apply(i, s.lockedDigit);
        return;
      }
      const v = s.grid[i]!;
      set({ selected: i, highlightDigit: v !== 0 ? v : s.lockedDigit });
    },

    tapDigit: (d) => {
      const s = get();
      if (!s.puzzle || s.status !== 'in_progress') return;
      if (s.selected !== null && s.puzzle.givens[s.selected] === 0) {
        set({ highlightDigit: d });
        apply(s.selected, d);
        return;
      }
      const locked = s.lockedDigit === d ? null : d;
      set({ lockedDigit: locked, highlightDigit: locked });
    },

    erase: () => {
      const s = get();
      const i = s.selected;
      if (i === null || !s.puzzle || s.puzzle.givens[i] !== 0 || s.status !== 'in_progress') return;
      if (s.grid[i] === 0 && s.notes[i] === 0) return;
      const grid = s.grid.slice(); const notes = s.notes.slice();
      const move: Move = { i, pv: grid[i]!, nv: 0, pn: notes[i]!, nn: 0, peers: [] };
      grid[i] = 0; notes[i] = 0;
      set({ grid, notes, undo: [...s.undo, move], lastWrong: null, hint: null, dirty: s.dirty + 1 });
    },

    toggleNotes: () => set((s) => ({ notesMode: !s.notesMode })),

    undoMove: () => {
      const s = get();
      const move = s.undo[s.undo.length - 1];
      if (!move || s.status !== 'in_progress') return;
      const grid = s.grid.slice(); const notes = s.notes.slice();
      grid[move.i] = move.pv; notes[move.i] = move.pn;
      for (const [j, pn] of move.peers) notes[j] = pn;
      set({ grid, notes, undo: s.undo.slice(0, -1), selected: move.i, lastWrong: null, hint: null, dirty: s.dirty + 1 });
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
      // A wrong digit poisons every deduction after it, so that comes first.
      const bad = s.grid.findIndex((v, i) => v !== 0 && s.puzzle!.givens[i] === 0 && v !== s.puzzle!.solution[i]);
      if (bad >= 0) {
        const v = s.grid[bad]!;
        set({
          selected: bad, highlightDigit: null, lockedDigit: null,
          hint: {
            cell: bad, digit: 0, focus: [bad], revealed: false, wrong: true,
            steps: [`The ${v} at ${nineGame.cellName(bad)} isn't right, and anything worked out from it will be off too. Clear it first, then ask for another hint.`],
          },
        });
        return;
      }
      const hint = nineGame.nextHint(s.grid, s.puzzle.solution);
      if (hint) set({ hint, selected: hint.cell, highlightDigit: null, lockedDigit: null });
    },

    applyHint: () => {
      const s = get();
      const h = s.hint;
      if (!h || !s.puzzle) return;
      if (h.wrong) { set({ selected: h.cell, notesMode: false }); get().erase(); return; }
      const notesMode = s.notesMode;
      set({ selected: h.cell, notesMode: false });
      apply(h.cell, h.digit);
      set({ notesMode, highlightDigit: h.digit });
    },

    dismissHint: () => set({ hint: null }),

    fillNotes: () => {
      const s = get();
      if (!s.puzzle || s.status !== 'in_progress') return;
      const cand = nineGame.candidates(s.grid);
      const notes = s.notes.slice();
      const changed: [number, number][] = [];
      for (let i = 0; i < 81; i++) {
        if (s.grid[i] === 0 && notes[i] !== cand[i]) { changed.push([i, notes[i]!]); notes[i] = cand[i]!; }
      }
      if (!changed.length) return;
      // One undo step for the whole fill: the first cell carries the move and
      // the rest ride along as `peers`, whose notes undo restores.
      const [first, ...rest] = changed;
      const move: Move = { i: first![0], pv: 0, nv: 0, pn: first![1], nn: notes[first![0]]!, peers: rest };
      set({ notes, undo: [...s.undo, move], hint: null, dirty: s.dirty + 1 });
    },

    moveSelection: (dr, dc) => {
      const s = get();
      const cur = s.selected ?? 0;
      const r = Math.min(8, Math.max(0, nineGame.rowOf(cur) + dr));
      const c = Math.min(8, Math.max(0, nineGame.colOf(cur) + dc));
      const i = r * 9 + c;
      set({ selected: i, highlightDigit: s.grid[i] || s.lockedDigit });
    },
  };
});

export const digitsRemaining = (grid: number[]): number[] => {
  const left = new Array<number>(10).fill(9);
  for (const v of grid) if (v) left[v]!--;
  return left;
};

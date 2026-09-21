import { beforeEach, describe, expect, it } from 'vitest';
import { quiltGame } from '@pb/engine';
import { useQuilt } from './store';

const SEED = 'quilt:2026-09-20:easy';
const load = (): void => { useQuilt.getState().load(SEED, null, '2026-09-20'); };

const st = () => useQuilt.getState();
const puzzle = () => st().puzzle!;
const owner = () => st().owner;
const n = () => puzzle().n;

/** Drag a rectangle from cell a to cell b, as a pointer would. */
function drag(a: number, b: number): void {
  const s = st();
  s.beginAt(a);
  s.dragOver(b);
  useQuilt.getState().endDrag();
}

/** The corners of the solution's patch for clue k. */
function solvedRect(k: number): { first: number; last: number } {
  const cells = owner().map((_, i) => i).filter((i) => puzzle().solution[i] === k);
  return { first: Math.min(...cells), last: Math.max(...cells) };
}

/** Draw the whole answer, patch by patch. */
function solve(): void {
  for (let k = 0; k < puzzle().clues.length; k++) {
    const { first, last } = solvedRect(k);
    drag(first, last);
  }
}

describe('quilt store', () => {
  beforeEach(load);

  it('starts with an empty board and a running clock', () => {
    expect(owner()).toHaveLength(n() * n());
    expect(owner().every((k) => k === -1)).toBe(true);
    expect(st().status).toBe('in_progress');
    expect(st().runningSince).not.toBeNull();
  });

  it('draws a patch for the one clue inside the rectangle', () => {
    const { first, last } = solvedRect(0);
    drag(first, last);
    const cells = owner().map((k, i) => (k === 0 ? i : -1)).filter((i) => i >= 0);
    expect(cells).toEqual(puzzle().solution.map((k, i) => (k === 0 ? i : -1)).filter((i) => i >= 0));
    expect(st().patches()[0]!.broken).toBe(false);
  });

  /**
   * The rule the whole game rests on: one clue per patch. A drag spanning two
   * of them has no sensible reading, so it must change nothing at all rather
   * than pick one and quietly destroy the other.
   */
  it('refuses a rectangle covering two clues and leaves the board untouched', () => {
    const before = owner().slice();
    const a = puzzle().clues[0]!.cell;
    const b = puzzle().clues[1]!.cell;
    const refusedBefore = st().refused;

    // Assert the precondition rather than guarding on it: a test that quietly
    // skips itself when the board changes is worse than no test at all.
    const span = quiltGame.rectCells(
      {
        r: Math.min(Math.floor(a / n()), Math.floor(b / n())),
        c: Math.min(a % n(), b % n()),
        w: Math.abs((a % n()) - (b % n())) + 1,
        h: Math.abs(Math.floor(a / n()) - Math.floor(b / n())) + 1,
      },
      n(),
    );
    expect(span).toContain(a);
    expect(span).toContain(b);

    drag(a, b);
    expect(owner()).toEqual(before);
    expect(st().refused).toBe(refusedBefore + 1);
  });

  it('clears a patch whole when a new rectangle overlaps it, never trimming it', () => {
    const { first, last } = solvedRect(0);
    drag(first, last);
    expect(owner().filter((k) => k === 0).length).toBeGreaterThan(0);

    // Draw a 1x1 on one of clue 0's cells that is not its clue cell. That
    // rectangle holds no clue, so it is an erase — and it must take the whole
    // patch, not punch a hole in it.
    const victim = owner().findIndex((k, i) => k === 0 && puzzle().clues[0]!.cell !== i);
    expect(victim).toBeGreaterThanOrEqual(0);
    drag(victim, victim);
    expect(owner().filter((k) => k === 0)).toHaveLength(0);
  });

  it('treats a tap on a drawn clue as a rub-out and a tap on a bare clue as a 1x1', () => {
    const cell = puzzle().clues[0]!.cell;
    drag(cell, cell);
    expect(owner().filter((k) => k === 0)).toHaveLength(1);
    drag(cell, cell);
    expect(owner().filter((k) => k === 0)).toHaveLength(0);
  });

  it('counts a misfit only when the finished patch contradicts its clue', () => {
    const clue = puzzle().clues.find((c) => c.kind === 'area' && c.area > 1);
    expect(clue).toBeDefined();
    if (clue?.kind !== 'area') throw new Error('expected an area clue larger than one cell');
    const k = puzzle().clues.indexOf(clue);

    drag(clue.cell, clue.cell);                       // a 1x1 where the clue wants more
    expect(st().mistakes).toBe(1);
    expect(st().patches()[k]!.broken).toBe(true);

    const { first, last } = solvedRect(k);
    drag(first, last);                                // the right rectangle
    expect(st().mistakes).toBe(1);                    // the count does not rise
    expect(st().patches()[k]!.broken).toBe(false);
  });

  it('undoes one move at a time, restoring exactly what was there', () => {
    const { first, last } = solvedRect(0);
    drag(first, last);
    const after = owner().slice();
    const other = solvedRect(1);
    drag(other.first, other.last);
    expect(owner()).not.toEqual(after);
    st().undoMove();
    expect(owner()).toEqual(after);
    st().undoMove();
    expect(owner().every((k) => k === -1)).toBe(true);
  });

  it('erases the patch under a cell and leaves the rest alone', () => {
    const a = solvedRect(0), b = solvedRect(1);
    drag(a.first, a.last);
    drag(b.first, b.last);
    st().eraseAt(a.first);
    expect(owner().filter((k) => k === 0)).toHaveLength(0);
    expect(owner().filter((k) => k === 1).length).toBeGreaterThan(0);
  });

  it('clears the board and the undo stack together', () => {
    const { first, last } = solvedRect(0);
    drag(first, last);
    st().clearAll();
    expect(owner().every((k) => k === -1)).toBe(true);
    expect(st().undo).toHaveLength(0);
  });

  it('builds a rectangle from the keyboard: Space, move, Enter', () => {
    const { first, last } = solvedRect(0);
    const s = st();
    useQuilt.setState({ selected: first });
    s.toggleAnchor();
    expect(st().anchor).toBe(first);
    useQuilt.setState({ selected: last });
    expect(st().previewRect()).not.toBeNull();
    useQuilt.getState().commitKeyboard();
    expect(st().anchor).toBeNull();
    expect(owner().filter((k) => k === 0).length).toBeGreaterThan(0);
  });

  it('solves when every patch is drawn, and stops the clock', () => {
    solve();
    expect(st().status).toBe('solved');
    expect(st().runningSince).toBeNull();
    expect(st().completedAt).not.toBeNull();
    expect(owner()).toEqual(puzzle().solution);
  });

  it('refuses further moves once solved', () => {
    solve();
    const frozen = owner().slice();
    drag(0, 0);
    expect(owner()).toEqual(frozen);
  });

  it('round-trips through a snapshot', () => {
    const { first, last } = solvedRect(0);
    drag(first, last);
    const snap = st().snapshot();
    useQuilt.getState().load(SEED, snap, '2026-09-20');
    expect(owner()).toEqual(snap.owner);
    expect(st().undo).toHaveLength(1);
  });

  it('ignores a snapshot whose board is the wrong size', () => {
    const snap = { ...st().snapshot(), owner: [1, 2, 3] };
    useQuilt.getState().load(SEED, snap, '2026-09-20');
    expect(owner()).toHaveLength(n() * n());
    expect(owner().every((k) => k === -1)).toBe(true);
  });

  it('rejects a seed for another game', () => {
    expect(useQuilt.getState().load('nine:2026-09-20:easy', null, null)).toBe(false);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { nine } from '@pb/engine';
import { digitsRemaining, useNine } from './store';

const SEED = 'nine:2026-09-20:easy';

function firstEmpty(): number {
  const p = useNine.getState().puzzle!;
  return p.givens.findIndex((v) => v === 0);
}

describe('nine store', () => {
  beforeEach(() => {
    useNine.getState().load(SEED, null, '2026-09-20');
  });

  it('loads givens and rejects a bad seed', () => {
    const s = useNine.getState();
    expect(s.grid).toEqual(s.puzzle!.givens);
    expect(s.status).toBe('in_progress');
    expect(useNine.getState().load('chess:2026-09-20:easy', null, null)).toBe(false);
  });

  it('places a digit, then undo restores the previous value', () => {
    const i = firstEmpty();
    const s = useNine.getState();
    s.selectCell(i);
    s.tapDigit(5);
    expect(useNine.getState().grid[i]).toBe(5);
    useNine.getState().undoMove();
    expect(useNine.getState().grid[i]).toBe(0);
  });

  it('tapping the same digit twice clears the cell', () => {
    const i = firstEmpty();
    useNine.getState().selectCell(i);
    useNine.getState().tapDigit(7);
    useNine.getState().tapDigit(7);
    expect(useNine.getState().grid[i]).toBe(0);
  });

  it('never overwrites a given', () => {
    const p = useNine.getState().puzzle!;
    const g = p.givens.findIndex((v) => v !== 0);
    useNine.getState().selectCell(g);
    useNine.getState().tapDigit(((p.givens[g]! % 9) + 1));
    expect(useNine.getState().grid[g]).toBe(p.givens[g]);
  });

  it('notes mode toggles candidates and undo covers them', () => {
    const i = firstEmpty();
    const s = useNine.getState();
    s.selectCell(i);
    s.toggleNotes();
    s.tapDigit(3);
    s.tapDigit(6);
    expect(useNine.getState().notes[i]).toBe((1 << 3) | (1 << 6));
    useNine.getState().undoMove();
    expect(useNine.getState().notes[i]).toBe(1 << 3);
  });

  it('placing a digit strips it from peers notes and undo restores them', () => {
    const p = useNine.getState().puzzle!;
    const i = p.givens.findIndex((v) => v === 0);
    // find an empty peer of i
    const peer = [...Array(81).keys()].find(
      (j) => j !== i && p.givens[j] === 0 && (Math.floor(j / 9) === Math.floor(i / 9)),
    )!;
    const s = useNine.getState();
    s.selectCell(peer); s.toggleNotes(); s.tapDigit(4); s.toggleNotes();
    expect(useNine.getState().notes[peer]! & (1 << 4)).toBeTruthy();

    useNine.getState().selectCell(i);
    useNine.getState().tapDigit(4);
    expect(useNine.getState().notes[peer]! & (1 << 4)).toBeFalsy();
    useNine.getState().undoMove();
    expect(useNine.getState().notes[peer]! & (1 << 4)).toBeTruthy();
  });

  it('digit-first input paints into tapped cells', () => {
    const i = firstEmpty();
    const s = useNine.getState();
    s.tapDigit(2);                    // nothing selected -> locks the digit
    expect(useNine.getState().lockedDigit).toBe(2);
    s.selectCell(i);
    expect(useNine.getState().grid[i]).toBe(2);
  });

  it('counts a wrong digit as a mistake and attributes it to the box', () => {
    const p = useNine.getState().puzzle!;
    const i = p.givens.findIndex((v) => v === 0);
    const wrong = (p.solution[i]! % 9) + 1;
    useNine.getState().selectCell(i);
    useNine.getState().tapDigit(wrong);
    const s = useNine.getState();
    expect(s.mistakes).toBe(1);
    expect(s.boxMistakes.reduce((a, b) => a + b, 0)).toBe(1);
    expect(s.lastWrong).toBe(i);
  });

  it('reaches solved when the full solution is entered, and stops the clock', () => {
    const p = useNine.getState().puzzle!;
    for (let i = 0; i < 81; i++) {
      if (p.givens[i] !== 0) continue;
      useNine.getState().selectCell(i);
      useNine.getState().tapDigit(p.solution[i]!);
    }
    const s = useNine.getState();
    expect(s.status).toBe('solved');
    expect(s.runningSince).toBeNull();
    expect(s.mistakes).toBe(0);
    expect(nine.validate(p, s.grid)).toEqual({ ok: true });
  });

  it('restores from a snapshot', () => {
    const i = firstEmpty();
    useNine.getState().selectCell(i);
    useNine.getState().tapDigit(9);
    const snap = useNine.getState().snapshot();
    useNine.getState().load(SEED, null, '2026-09-20');
    expect(useNine.getState().grid[i]).toBe(0);
    useNine.getState().load(SEED, snap, '2026-09-20');
    expect(useNine.getState().grid[i]).toBe(9);
  });

  it('digitsRemaining counts down from nine', () => {
    const left = digitsRemaining(useNine.getState().grid);
    for (let d = 1; d <= 9; d++) expect(left[d]).toBeLessThanOrEqual(9);
    expect(left.slice(1).reduce((a, b) => a + b, 0)).toBe(81 - useNine.getState().grid.filter((v) => v).length);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { thread } from '@pb/engine';
import { useThread } from './store';

const SEED = 'thread:2026-09-20:easy';

function load(): void {
  useThread.getState().load(SEED, null, '2026-09-20');
}
const path = (): number[] => useThread.getState().path;
const sol = (): number[] => useThread.getState().puzzle!.solution;

describe('thread store', () => {
  beforeEach(load);

  it('starts the line on number 1 and nowhere else', () => {
    const p = useThread.getState().puzzle!;
    expect(path()).toEqual([p.waypoints[0]]);
    expect(path()[0]).toBe(p.solution[0]);
  });

  it('extends along the solution one legal step at a time', () => {
    const s = useThread.getState();
    s.beginAt(sol()[1]!);
    expect(path()).toEqual(sol().slice(0, 2));
    s.dragTo(sol()[2]!);
    expect(path()).toEqual(sol().slice(0, 3));
  });

  it('refuses a cell that is not a neighbour of the tail', () => {
    const s = useThread.getState();
    const far = sol()[sol().length - 1]!;
    s.beginAt(far);
    expect(path()).toHaveLength(1);
  });

  it('refuses to cross a wall', () => {
    const p = useThread.getState().puzzle!;
    if (p.walls.length === 0) return;
    const [a, b] = p.walls[0]!.split('-').map(Number) as [number, number];
    // Drive the line to `a`, then try to step through the wall to `b`.
    const upTo = p.solution.indexOf(a);
    if (upTo < 1) return;
    const s = useThread.getState();
    for (let k = 1; k <= upTo; k++) s.dragTo(p.solution[k]!);
    useThread.setState({ dragging: true });
    for (let k = 1; k <= upTo; k++) s.dragTo(p.solution[k]!);
    if (path()[path().length - 1] !== a) return;
    const before = path().length;
    s.dragTo(b);
    expect(path()).toHaveLength(before);
  });

  it('retracts when the drag goes back over the previous cell', () => {
    const s = useThread.getState();
    s.beginAt(sol()[1]!);
    s.dragTo(sol()[2]!);
    s.dragTo(sol()[3]!);
    expect(path()).toHaveLength(4);
    s.dragTo(sol()[2]!);
    expect(path()).toEqual(sol().slice(0, 3));
    expect(useThread.getState().backtracks).toBe(1);
  });

  it('retracts on a fresh press: grab the tail, drag back', () => {
    const s = useThread.getState();
    s.beginAt(sol()[1]!);
    s.dragTo(sol()[2]!);
    s.dragTo(sol()[3]!);
    s.endDrag();
    expect(path()).toHaveLength(4);

    // Press on the tail, then drag onto the cell before it.
    s.beginAt(sol()[3]!);
    s.dragTo(sol()[2]!);
    expect(path()).toEqual(sol().slice(0, 3));
  });

  it('rewinds when a cell further back down the line is grabbed', () => {
    const s = useThread.getState();
    for (let k = 1; k <= 4; k++) s.dragTo(sol()[k]!);
    useThread.setState({ dragging: true });
    for (let k = 1; k <= 4; k++) s.dragTo(sol()[k]!);
    expect(path()).toHaveLength(5);
    s.beginAt(sol()[1]!);
    expect(path()).toEqual(sol().slice(0, 2));
    expect(useThread.getState().backtracks).toBe(3);
  });

  it('clear returns to just number 1', () => {
    const s = useThread.getState();
    s.beginAt(sol()[1]!);
    s.dragTo(sol()[2]!);
    s.clearPath();
    expect(path()).toHaveLength(1);
  });

  it('solves when the whole path is walked', () => {
    const s = useThread.getState();
    const full = sol();
    s.beginAt(full[1]!);
    for (let k = 2; k < full.length; k++) s.dragTo(full[k]!);
    expect(path()).toEqual(full);
    expect(useThread.getState().status).toBe('solved');
    expect(useThread.getState().runningSince).toBeNull();
    expect(thread.validate(useThread.getState().puzzle!, path())).toEqual({ ok: true });
  });

  it('restores from a snapshot', () => {
    const s = useThread.getState();
    s.beginAt(sol()[1]!);
    s.dragTo(sol()[2]!);
    const snap = useThread.getState().snapshot();
    load();
    expect(path()).toHaveLength(1);
    useThread.getState().load(SEED, snap, '2026-09-20');
    expect(path()).toEqual(sol().slice(0, 3));
  });
});

describe('keyboard walking', () => {
  beforeEach(load);

  it('arrow keys walk the line and retrace it', () => {
    const s = useThread.getState();
    const n = s.puzzle!.n;
    const dir = (from: number, to: number): [number, number] =>
      [Math.floor(to / n) - Math.floor(from / n), (to % n) - (from % n)];

    for (let k = 1; k <= 3; k++) {
      const [dr, dc] = dir(sol()[k - 1]!, sol()[k]!);
      s.stepDir(dr, dc);
    }
    expect(path()).toEqual(sol().slice(0, 4));

    // Walking back the way we came retracts rather than doubling up.
    const [br, bc] = dir(sol()[3]!, sol()[2]!);
    s.stepDir(br, bc);
    expect(path()).toEqual(sol().slice(0, 3));
  });

  it('ignores a direction that leaves the board', () => {
    const s = useThread.getState();
    const n = s.puzzle!.n;
    const tail = path()[0]!;
    const before = path().length;
    if (Math.floor(tail / n) === 0) s.stepDir(-1, 0);
    if (tail % n === 0) s.stepDir(0, -1);
    expect(path()).toHaveLength(before);
  });
});

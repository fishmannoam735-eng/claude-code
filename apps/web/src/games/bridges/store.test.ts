import { beforeEach, describe, expect, it } from 'vitest';
import { useBridges } from './store';

describe('bridges store', () => {
  beforeEach(() => { useBridges.setState({ seed: null, puzzle: null }); });

  it('cycles a link 0 → 1 → 2 → 0 and solves with the answer', () => {
    const s = useBridges.getState();
    expect(s.load('bridges:2026-11-17:easy', null, '2026-11-17')).toBe(true);
    const p = useBridges.getState().puzzle!;
    const k = p.solution.findIndex((v) => v > 0);
    useBridges.getState().cycle(k);
    expect(useBridges.getState().bridges[k]).toBe(1);
    useBridges.getState().cycle(k);
    useBridges.getState().cycle(k);
    expect(useBridges.getState().bridges[k]).toBe(0);
    useBridges.getState().undo();
    expect(useBridges.getState().bridges[k]).toBe(2);
    useBridges.getState().clear();
    p.solution.forEach((v, link) => { for (let i = 0; i < v; i++) useBridges.getState().cycle(link); });
    expect(useBridges.getState().status).toBe('solved');
    const snap = useBridges.getState().snapshot();
    expect(snap.goal).toBe(p.solution.reduce((a, b) => a + b, 0));
  });

  it('refuses a bridge that would cross one already built', () => {
    useBridges.getState().load('bridges:2026-11-17:hard', null, null);
    const p = useBridges.getState().puzzle!;
    const k = p.layout.crosses.findIndex((c) => c.length > 0);
    expect(k).toBeGreaterThanOrEqual(0);
    useBridges.getState().cycle(k);
    const x = p.layout.crosses[k]![0]!;
    useBridges.getState().cycle(x);
    expect(useBridges.getState().bridges[x]).toBe(0);
    expect(useBridges.getState().refused?.by).toBe(k);
  });
});

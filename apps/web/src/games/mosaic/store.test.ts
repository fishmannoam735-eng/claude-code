import { beforeEach, describe, expect, it } from 'vitest';
import { CROSS, FILL, OPEN, useMosaic } from './store';

describe('mosaic store', () => {
  beforeEach(() => { useMosaic.setState({ seed: null, puzzle: null, tool: 'fill' }); });

  it('a stroke fills, a stroke from a filled square rubs out, and the picture solves', () => {
    const s = useMosaic.getState();
    expect(s.load('mosaic:2026-11-17:easy', null, '2026-11-17')).toBe(true);
    const p = useMosaic.getState().puzzle!;
    const st = useMosaic.getState;
    st().begin(0); st().extend(1); st().extend(2); st().end();
    expect(st().paint.slice(0, 3)).toEqual([FILL, FILL, FILL]);
    expect(st().history.length).toBe(1); // one stroke, one undo step
    st().begin(1); st().extend(2); st().end();
    expect(st().paint.slice(0, 3)).toEqual([FILL, OPEN, OPEN]);
    st().setTool('cross');
    st().begin(1); st().extend(0); st().extend(2); st().end();
    // A cross stroke never paints over a filled square.
    expect(st().paint.slice(0, 3)).toEqual([FILL, CROSS, CROSS]);
    st().undo();
    expect(st().paint.slice(0, 3)).toEqual([FILL, OPEN, OPEN]);
    st().clear();
    st().setTool('fill');
    p.solution.forEach((v, i) => { if (v) { st().begin(i); st().end(); } });
    expect(st().status).toBe('solved');
    expect(st().justSolved).toBe(true);
    expect(st().snapshot().goal).toBe(p.solution.filter((v) => v).length);
  });
});

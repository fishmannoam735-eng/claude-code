import { describe, expect, it } from 'vitest';
import { createRng } from '../src/rng.js';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng('nine:2026-09-20:normal');
    const b = createRng('nine:2026-09-20:normal');
    const xs = Array.from({ length: 20 }, () => a.next());
    const ys = Array.from({ length: 20 }, () => b.next());
    expect(xs).toEqual(ys);
  });
  it('diverges on near-identical seeds', () => {
    const a = createRng('nine:2026-09-20:normal').next();
    const b = createRng('nine:2026-09-21:normal').next();
    expect(a).not.toBe(b);
  });
  it('int stays in range and is roughly uniform', () => {
    const r = createRng('uniform');
    const buckets = new Array(9).fill(0);
    for (let i = 0; i < 9000; i++) buckets[r.int(9)]++;
    for (const b of buckets) { expect(b).toBeGreaterThan(800); expect(b).toBeLessThan(1200); }
  });
});

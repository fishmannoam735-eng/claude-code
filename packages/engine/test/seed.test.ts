import { describe, expect, it } from 'vitest';
import { makeSeed, parseSeed, randomToken } from '../src/seed.js';

describe('seed', () => {
  it('round-trips a daily seed', () => {
    const s = makeSeed('nine', '2026-09-20', 'hard');
    expect(parseSeed(s)).toEqual({ game: 'nine', key: '2026-09-20', difficulty: 'hard', isDaily: true });
  });
  it('accepts practice tokens and rejects junk', () => {
    expect(parseSeed('nine:abc123xy:easy')?.isDaily).toBe(false);
    expect(parseSeed('nine:2026-09-20')).toBeNull();
    expect(parseSeed('chess:2026-09-20:easy')).toBeNull();
    expect(parseSeed('nine:2026-09-20:brutal')).toBeNull();
    expect(parseSeed('nine:has space:easy')).toBeNull();
  });
  it('random tokens parse', () => {
    for (let i = 0; i < 20; i++) expect(parseSeed(`nine:${randomToken()}:normal`)).not.toBeNull();
  });
});

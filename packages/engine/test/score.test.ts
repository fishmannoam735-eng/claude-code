import { describe, expect, it } from 'vitest';
import { scorePlay } from '../src/score.js';

// The same cases run against public.score_play in SQL (see the migration);
// if one side changes, these numbers say so.
describe('scorePlay', () => {
  it('pays base at par', () => {
    expect(scorePlay({ game: 'crowns', difficulty: 'normal', durationMs: 120_000, hints: 0, mistakes: 0, fills: 0 }).total).toBe(200);
  });
  it('caps the speed bonus at +50%', () => {
    expect(scorePlay({ game: 'nine', difficulty: 'hard', durationMs: 1000, hints: 0, mistakes: 0, fills: 0 }).total).toBe(450);
  });
  it('takes points for hints, mistakes and Fill', () => {
    const s = scorePlay({ game: 'nine', difficulty: 'normal', durationMs: 720_000, hints: 2, mistakes: 3, fills: 1 });
    expect(s).toEqual({ base: 200, speed: 0, hints: 60, mistakes: 30, fill: 50, total: 60 });
  });
  it('never goes below a tenth of base', () => {
    expect(scorePlay({ game: 'thread', difficulty: 'easy', durationMs: 999_000, hints: 9, mistakes: 0, fills: 0 }).total).toBe(10);
  });
  it('slow solves keep half', () => {
    expect(scorePlay({ game: 'quilt', difficulty: 'easy', durationMs: 600_000, hints: 0, mistakes: 0, fills: 0 }).total).toBe(50);
  });
});

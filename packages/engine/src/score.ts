import type { Difficulty, GameId } from './types.js';

/**
 * Points for one solve. The database computes the same number in
 * `public.score_play` (supabase/migrations/0002_contest.sql) and that copy is
 * the one that ranks; this one is for showing the breakdown on the solved
 * card. Change both together — `score.test.ts` pins the shared examples.
 */
export const SCORE_BASE: Record<Difficulty, number> = { easy: 100, normal: 200, hard: 300 };

/** Seconds a steady player takes. Faster than par earns up to +50%, slower down to −50%. */
export const SCORE_PAR: Record<GameId, Record<Difficulty, number>> = {
  nine:    { easy: 360, normal: 720, hard: 1200 },
  crowns:  { easy: 60,  normal: 120, hard: 240 },
  eclipse: { easy: 60,  normal: 120, hard: 240 },
  thread:  { easy: 45,  normal: 90,  hard: 180 },
  quilt:   { easy: 60,  normal: 150, hard: 300 },
};

/** Below this a solve is too fast to be a person and does not enter the contest. */
export const SCORE_MIN_MS: Record<GameId, number> = { nine: 45_000, crowns: 5_000, eclipse: 5_000, thread: 5_000, quilt: 5_000 };

export const HINT_COST = 0.15;   // of base, per hint opened
export const MISTAKE_COST = 0.05; // of base, per mistake
export const FILL_COST = 0.25;    // of base, once if Fill was used

export interface ScoreInput {
  game: GameId;
  difficulty: Difficulty;
  durationMs: number;
  hints: number;
  mistakes: number;
  fills: number;
}

export interface ScoreBreakdown {
  base: number;
  speed: number;      // points added (or taken) for time, can be negative
  hints: number;      // points taken, as a positive number
  mistakes: number;
  fill: number;
  total: number;
}

export function scorePlay(p: ScoreInput): ScoreBreakdown {
  const base = SCORE_BASE[p.difficulty];
  const par = SCORE_PAR[p.game][p.difficulty];
  const t = Math.max(0, p.durationMs) / 1000;
  const factor = Math.min(1.5, Math.max(0.5, 1.5 - 0.5 * (t / par)));
  const speed = Math.round(base * factor) - base;
  const hints = Math.round(base * HINT_COST * Math.max(0, p.hints));
  const mistakes = Math.round(base * MISTAKE_COST * Math.max(0, p.mistakes));
  const fill = p.fills > 0 ? Math.round(base * FILL_COST) : 0;
  const total = Math.max(Math.round(base * 0.1), base + speed - hints - mistakes - fill);
  return { base, speed, hints, mistakes, fill, total };
}

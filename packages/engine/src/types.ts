export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export type GameId = 'nine' | 'crowns' | 'eclipse' | 'thread' | 'quilt';

/**
 * A seed fully describes a board: `<game>:<key>:<difficulty>`.
 * `key` is an ISO date (daily) or an opaque token (practice / challenge).
 */
export interface ParsedSeed {
  game: GameId;
  key: string;
  difficulty: Difficulty;
  /** True when `key` is a YYYY-MM-DD date. */
  isDaily: boolean;
}

export interface DifficultyScore {
  /** 0 = trivial … 1 = at the top of what the rater can solve. */
  score: number;
  /** Human-readable name of the hardest technique the solve required. */
  hardest: string;
  /** Extra per-game detail (givens, chain depth, …). */
  detail: Record<string, number>;
}

export type Result =
  | { ok: true }
  | { ok: false; reason: 'incomplete' | 'invalid' | 'wrong' };

export interface Generator<P, S> {
  readonly game: GameId;
  generate(seed: string): P;
  /** All solutions, enumeration capped at 2 — enough to prove uniqueness. */
  solve(puzzle: P): S[];
  validate(puzzle: P, attempt: S): Result;
  rate(puzzle: P): DifficultyScore;
}

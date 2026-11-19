import { useEffect, useRef } from 'react';
import { upsertPlay, type Json } from '@pb/data';
import { localDateKey, makeSeed, parseSeed, scorePlay, type Difficulty, type GameId } from '@pb/engine';
import { supabase, useSession } from './session';
import { readJSON, writeJSON } from './storage';
import { readAssists } from './assists';

export const localKey = (gameId: GameId, seed: string): string => `pb:${gameId}:${seed}`;

/** The best board of a game on a day, daily or new, as this device saw it. */
export interface DayBest { score: number; elapsedMs: number; difficulty: Difficulty; seed: string }
export const dayBestKey = (date: string, gameId: GameId): string => `pb:daybest:${date}:${gameId}`;
export const replayKey = (seed: string): string => `pb:replayed:${seed}`;

/**
 * Keep the day's best board up to date when a board is solved. A Try again
 * on a board already solved is practice, so it never counts here (the server
 * follows the same rule).
 */
function recordDayBest(gameId: GameId, seed: string, snap: BaseSnapshot): void {
  const parsed = parseSeed(seed);
  if (!parsed || snap.status !== 'solved' || readJSON<boolean>(replayKey(seed))) return;
  const date = parsed.isDaily
    ? (snap.puzzleDate ?? parsed.key)
    : localDateKey(snap.completedAt ? new Date(snap.completedAt) : new Date());
  // A new board counts only once that game's daily board is solved that day.
  if (!parsed.isDaily && !(['easy', 'normal', 'hard'] as const).some((d) =>
    readJSON<BaseSnapshot>(localKey(gameId, makeSeed(gameId, date, d)))?.status === 'solved')) return;
  const a = readAssists(seed);
  const score = scorePlay({
    game: gameId, difficulty: parsed.difficulty, durationMs: snap.elapsedMs,
    hints: a.hints, mistakes: snap.mistakes, fills: a.fills,
  }).total;
  const prev = readJSON<DayBest>(dayBestKey(date, gameId));
  if (prev && prev.seed !== seed && prev.score >= score) return;
  if (prev && prev.seed === seed) return; // a board counts once, from its first solve
  writeJSON(dayBestKey(date, gameId), { score, elapsedMs: snap.elapsedMs, difficulty: parsed.difficulty, seed });
}

/** The shape every game's snapshot must expose for persistence to work. */
export interface BaseSnapshot {
  v: 1;
  elapsedMs: number;
  mistakes: number;
  status: 'in_progress' | 'solved';
  puzzleDate: string | null;
  startedAt: string;
  completedAt: string | null;
}

/**
 * Mirrors game state to localStorage on every change and to Supabase on a
 * debounce — immediately on solve and on pagehide. Local is the source of
 * truth for the session; the server is what makes streaks and cross-device
 * resume work.
 */
export function usePersistence<S extends BaseSnapshot>(opts: {
  gameId: GameId;
  seed: string | null;
  dirty: number;
  status: 'in_progress' | 'solved';
  snapshot: () => S;
}): void {
  const { gameId, seed, dirty, status, snapshot } = opts;
  const userId = useSession((s) => s.userId);
  const timer = useRef<number | null>(null);

  const flush = async (): Promise<void> => {
    if (!seed || !supabase || !userId) return;
    const parsed = parseSeed(seed);
    if (!parsed) return;
    const snap = snapshot();
    try {
      await upsertPlay(supabase, userId, {
        seed,
        game_id: gameId,
        difficulty: parsed.difficulty,
        mode: parsed.isDaily ? 'daily' : 'practice',
        puzzle_date: parsed.isDaily
          ? (snap.puzzleDate ?? parsed.key)
          : localDateKey(snap.completedAt ? new Date(snap.completedAt) : new Date()),
        status: snap.status,
        state: snap as unknown as Json,
        duration_ms: snap.elapsedMs,
        mistakes: snap.mistakes,
        hints: readAssists(seed).hints,
        fills: readAssists(seed).fills,
        completed_at: snap.completedAt,
      });
    } catch (e) {
      console.warn('play sync failed', e);
    }
  };

  useEffect(() => {
    if (!seed || dirty === 0) return;
    writeJSON(localKey(gameId, seed), snapshot());
    if (timer.current) window.clearTimeout(timer.current);
    if (status === 'solved') { recordDayBest(gameId, seed, snapshot()); void flush(); return; }
    timer.current = window.setTimeout(() => { void flush(); }, 2500);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, status, seed, gameId, userId]);

  useEffect(() => {
    const onHide = (): void => {
      if (!seed) return;
      writeJSON(localKey(gameId, seed), snapshot());
      void flush();
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, gameId, userId]);
}

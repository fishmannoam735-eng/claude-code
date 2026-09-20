import { useEffect, useRef } from 'react';
import { upsertPlay, type Json } from '@pb/data';
import { parseSeed, type GameId } from '@pb/engine';
import { supabase, useSession } from './session';
import { writeJSON } from './storage';

export const localKey = (gameId: GameId, seed: string): string => `pb:${gameId}:${seed}`;

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
        puzzle_date: parsed.isDaily ? (snap.puzzleDate ?? parsed.key) : null,
        status: snap.status,
        state: snap as unknown as Json,
        duration_ms: snap.elapsedMs,
        mistakes: snap.mistakes,
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
    if (status === 'solved') { void flush(); return; }
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

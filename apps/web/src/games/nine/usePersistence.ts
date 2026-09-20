import { useEffect, useRef } from 'react';
import { upsertPlay, type Json } from '@pb/data';
import { parseSeed } from '@pb/engine';
import { supabase, useSession } from '../../lib/session';
import { writeJSON } from '../../lib/storage';
import { useNine, type Snapshot } from './store';

export const localKey = (seed: string): string => `pb:nine:${seed}`;

/**
 * Mirrors game state to localStorage on every change and to Supabase on a
 * debounce (immediately on solve and on pagehide). Local is the source of
 * truth for the session; the server is what makes streaks and cross-device
 * resume work.
 */
export function usePersistence(seed: string | null): void {
  const dirty = useNine((s) => s.dirty);
  const status = useNine((s) => s.status);
  const snapshot = useNine((s) => s.snapshot);
  const userId = useSession((s) => s.userId);
  const timer = useRef<number | null>(null);

  const flush = async (): Promise<void> => {
    if (!seed || !supabase || !userId) return;
    const snap: Snapshot = snapshot();
    const parsed = parseSeed(seed);
    if (!parsed) return;
    try {
      await upsertPlay(supabase, userId, {
        seed,
        game_id: 'nine',
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
    writeJSON(localKey(seed), snapshot());
    if (timer.current) window.clearTimeout(timer.current);
    if (status === 'solved') { void flush(); return; }
    timer.current = window.setTimeout(() => { void flush(); }, 2500);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, status, seed, userId]);

  useEffect(() => {
    const onHide = (): void => {
      if (!seed) return;
      writeJSON(localKey(seed), snapshot());
      void flush();
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, userId]);
}

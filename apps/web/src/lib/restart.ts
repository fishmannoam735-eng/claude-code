import { upsertPlay } from '@pb/data';
import { parseSeed } from '@pb/engine';
import { supabase, useSession } from './session';
import { localKey } from './persistence';
import { removeKey } from './storage';

/**
 * Start the same board again to beat your best. The server keeps the best
 * try; this only clears the board, here and on the server, then reloads so
 * every game starts from its own clean state.
 */
export async function restartBoard(seed: string): Promise<void> {
  const parsed = parseSeed(seed);
  if (!parsed) return;
  const userId = useSession.getState().userId;
  if (supabase && userId) {
    try {
      await upsertPlay(supabase, userId, {
        seed, game_id: parsed.game, difficulty: parsed.difficulty,
        mode: parsed.isDaily ? 'daily' : 'practice',
        puzzle_date: parsed.isDaily ? parsed.key : null,
        status: 'in_progress', state: null, duration_ms: 0,
        mistakes: 0, hints: 0, fills: 0, completed_at: null,
      });
    } catch { /* offline: the fresh board still starts here */ }
  }
  removeKey(localKey(parsed.game, seed));
  removeKey(`pb:assist:${seed}`);
  window.location.reload();
}

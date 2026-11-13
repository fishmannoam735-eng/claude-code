import { localDateKey, makeSeed, DIFFICULTIES, type GameId } from '@pb/engine';
import { readJSON, removeKey, writeJSON } from './storage';

const FLAG = 'pb:contest-start';
const GAMES: GameId[] = ['nine', 'eclipse', 'crowns', 'thread', 'quilt'];

/**
 * Runs once per phone when the contest version first opens. Boards played
 * earlier today, before the contest existed, were only ever saved on the
 * phone and never reached the server, so they could not count. Clearing them
 * gives the player a clean first try at today's contest.
 */
export function startContestOnce(): void {
  if (readJSON<string>(FLAG)) return;
  const today = localDateKey();
  for (const g of GAMES) {
    for (const d of DIFFICULTIES) {
      const seed = makeSeed(g, today, d);
      removeKey(`pb:${g}:${seed}`);
      removeKey(`pb:assist:${seed}`);
    }
  }
  writeJSON(FLAG, today);
}

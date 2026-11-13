import { readJSON, writeJSON } from './storage';

/**
 * Hints and Fill cost points, so every game records them here, keyed by
 * seed. Kept outside the game stores so all five count the same way, and
 * persistence picks them up for the server without each snapshot changing.
 */
export interface Assists { hints: number; fills: number; lastHintAt: string }

const key = (seed: string): string => `pb:assist:${seed}`;

export function readAssists(seed: string): Assists {
  return readJSON<Assists>(key(seed)) ?? { hints: 0, fills: 0, lastHintAt: '' };
}

/**
 * `board` is the board as it stands. Opening the hint again on the very same
 * board is re-reading it, so only the first look at each position costs.
 */
export function noteHint(seed: string | null, board: unknown): void {
  if (!seed) return;
  const a = readAssists(seed);
  const at = fingerprint(board);
  if (a.lastHintAt === at) return;
  writeJSON(key(seed), { ...a, hints: a.hints + 1, lastHintAt: at });
  window.dispatchEvent(new CustomEvent('pb:assist', { detail: seed }));
}

export function noteFill(seed: string | null): void {
  if (!seed) return;
  const a = readAssists(seed);
  writeJSON(key(seed), { ...a, fills: a.fills + 1 });
  window.dispatchEvent(new CustomEvent('pb:assist', { detail: seed }));
}

function fingerprint(v: unknown): string {
  const str = JSON.stringify(v);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

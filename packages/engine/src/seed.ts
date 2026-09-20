import type { Difficulty, GameId, ParsedSeed } from './types.js';
import { DIFFICULTIES } from './types.js';

const GAMES: readonly GameId[] = ['nine', 'crowns', 'eclipse', 'thread', 'quilt'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN = /^[A-Za-z0-9_-]{4,32}$/;

export function makeSeed(game: GameId, key: string, difficulty: Difficulty): string {
  return `${game}:${key}:${difficulty}`;
}

export function parseSeed(seed: string): ParsedSeed | null {
  const parts = seed.split(':');
  if (parts.length !== 3) return null;
  const [game, key, difficulty] = parts as [string, string, string];
  if (!GAMES.includes(game as GameId)) return null;
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) return null;
  const isDaily = DATE.test(key);
  if (!isDaily && !TOKEN.test(key)) return null;
  return { game: game as GameId, key, difficulty: difficulty as Difficulty, isDaily };
}

/** Local calendar date as YYYY-MM-DD — "today" is the player's day, not UTC's. */
export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
/** Random practice / challenge token. Not seeded — that's the point. */
export function randomToken(len = 8): string {
  let out = '';
  const buf = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 256);
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i]! % ALPHABET.length];
  return out;
}

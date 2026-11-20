import type { Difficulty } from '@pb/engine';

/** Crown Quest, the pinball table. The game itself is a self-contained page (public/pinball.html) run in a frame. */
export const PINBALL_LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];

export const PINBALL_LEVEL_NOTE: Record<Difficulty, string> = {
  easy: 'Flattest table · the ball rolls slowly',
  normal: 'Gentle slope',
  hard: 'Steeper · faster ball',
};

/** The table keeps its own high score per level, in the same storage the app uses. */
const hiKey = (level: Difficulty) => (level === 'normal' ? 'cq_hi' : `cq_hi_${level}`);

export function pinballHigh(level: Difficulty): number {
  try { return Number(localStorage.getItem(hiKey(level))) || 0; } catch { return 0; }
}

export function pinballBest(): number {
  return Math.max(...PINBALL_LEVELS.map(pinballHigh));
}

export const pinballUrl = (level: Difficulty) => `${import.meta.env.BASE_URL}pinball.html?level=${level}`;

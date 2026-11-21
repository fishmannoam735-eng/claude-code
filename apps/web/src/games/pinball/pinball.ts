import type { Difficulty } from '@pb/engine';

/**
 * The pinball tables. Each table is a self-contained page in public/ run in a
 * frame: Crown Quest (pinball.html), Hollow Manor (manor.html) and Fossil Isle (fossil.html).
 */
export const PINBALL_LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];

export const PINBALL_LEVEL_NOTE: Record<Difficulty, string> = {
  easy: 'Flattest table · the ball rolls slowly',
  normal: 'Gentle slope',
  hard: 'Steeper · faster ball',
};

export type PinballTable = 'crown' | 'manor' | 'fossil';

export interface PinballTableDef {
  id: PinballTable;
  name: string;
  blurb: string;
  /** The page in public/ that runs the table. */
  file: string;
  /** What the table calls itself in the messages it posts to the app. */
  source: string;
  /** Route prefix in the app; the level follows it. */
  route: string;
  /** localStorage key for the normal level's best; other levels add _easy / _hard. */
  hiKey: string;
  colour: string;
  /** Whether the table's games go to the online high-score board and the contest. */
  online: boolean;
  howTo: string;
}

export const PINBALL_TABLES: Record<PinballTable, PinballTableDef> = {
  crown: {
    id: 'crown', name: 'Crown Quest', blurb: 'Pinball · win back the crown jewels', file: 'pinball.html', source: 'crown-quest', route: '/arcade/pinball',
    hiKey: 'cq_hi', colour: '#5B4BC4', online: true,
    howTo: 'Your mission is always written big at the top, with a glowing arrow on the shot. Tap the left or right half to flip. The right side also fires the green side flipper by the launcher: flip it just as the ball flies past to jump up to the tower, where everything scores triple. To launch, drag down on the right half and let go. On a keyboard: Z and M (or the arrows) flip, hold Space to pull.',
  },
  manor: {
    id: 'manor', name: 'Hollow Manor', blurb: 'Haunted pinball · free three spirits by midnight', file: 'manor.html', source: 'hollow-manor', route: '/arcade/manor',
    hiKey: 'hm_hi', colour: '#2F8A63', online: false,
    howTo: 'Your mission is always written big at the top, with a glowing arrow on the shot. Tap the left or right half to flip. The right side also fires the green side flipper by the launcher: flip it just as the ball flies past to jump up to the deck, where everything scores triple. To launch, drag down on the right half and let go. On a keyboard: Z and M (or the arrows) flip, hold Space to pull.',
  },
  fossil: {
    id: 'fossil', name: 'Fossil Isle', blurb: 'Pinball · recapture three escaped creatures', file: 'fossil.html', source: 'fossil-isle', route: '/arcade/fossil',
    hiKey: 'fi_hi', colour: '#C8681A', online: false,
    howTo: 'Your mission is always written big at the top, with a glowing arrow on the shot. Knock down A·M·B·E·R, then shoot the NEST to start a hunt. The Ironjaw watches the ball from the volcano crater: catch all three creatures and it breaks loose for Breakout multiball. Tap the left or right half to flip. The right side also fires the side flipper by the launcher: flip it as the ball flies past to jump up to the crater, where everything scores triple. To launch, drag down on the right half and let go. On a keyboard: Z and M (or the arrows) flip, hold Space to pull.',
  },
};

const hiKey = (table: PinballTable, level: Difficulty) => {
  const k = PINBALL_TABLES[table].hiKey;
  return level === 'normal' ? k : `${k}_${level}`;
};

/** The table keeps its own high score per level, in the same storage the app uses. */
export function pinballHigh(level: Difficulty, table: PinballTable = 'crown'): number {
  try { return Number(localStorage.getItem(hiKey(table, level))) || 0; } catch { return 0; }
}

export function pinballBest(table: PinballTable = 'crown'): number {
  return Math.max(...PINBALL_LEVELS.map((l) => pinballHigh(l, table)));
}

export const pinballUrl = (level: Difficulty, table: PinballTable = 'crown') => `${import.meta.env.BASE_URL}${PINBALL_TABLES[table].file}?level=${level}`;

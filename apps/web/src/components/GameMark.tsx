import type { GameId } from '@pb/engine';

/**
 * Each game's mark is a portrait of its own board, not a generic pictogram.
 *
 * The first set were five line icons — a grid, a crown, a squiggle — sitting
 * in five identical mint tiles, which made the home screen read as one list of
 * one thing. A player should be able to tell Crowns from Thread at 40px
 * without reading a word, so each mark draws the thing you actually do:
 * digits in a sudoku box, a sun beside a moon, a crown standing on its region,
 * a line threading corner to corner, patches cut from a square.
 *
 * Drawn from a 24-unit square so one component serves the 44px home tile and
 * the 18px inline mention, and so both themes get it for free — every stroke
 * is `currentColor`, every fill is the game's own tint.
 */

export const GAME_COLOR: Record<GameId, string> = {
  nine: 'var(--color-game-nine)',
  eclipse: 'var(--color-game-eclipse)',
  crowns: 'var(--color-game-crowns)',
  thread: 'var(--color-game-thread)',
  quilt: 'var(--color-game-quilt)',
};

export const GAME_INK: Record<GameId, string> = {
  nine: 'var(--color-game-nine-text)',
  eclipse: 'var(--color-game-eclipse-text)',
  crowns: 'var(--color-game-crowns-text)',
  thread: 'var(--color-game-thread-text)',
  quilt: 'var(--color-game-quilt-text)',
};

const frame = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** A 3×3 box with three digits set, the way a sudoku box looks part-solved. */
function NineMark() {
  return (
    <svg {...frame} className="h-full w-full">
      <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />
      <path d="M8.83 2.5v19M15.17 2.5v19M2.5 8.83h19M2.5 15.17h19" strokeWidth="0.9" opacity="0.55" />
      <text x="5.67" y="7.6" textAnchor="middle" fontSize="4.6" fontWeight="700"
        fill="currentColor" stroke="none" fontFamily="inherit">5</text>
      <text x="12" y="14" textAnchor="middle" fontSize="4.6" fontWeight="700"
        fill="currentColor" stroke="none" fontFamily="inherit">3</text>
      <text x="18.33" y="20.3" textAnchor="middle" fontSize="4.6" fontWeight="700"
        fill="currentColor" stroke="none" fontFamily="inherit">7</text>
    </svg>
  );
}

/** A rayed sun and a crescent, the two things the board is made of. */
function EclipseMark() {
  return (
    <svg {...frame} className="h-full w-full">
      <circle cx="8" cy="8.6" r="3.1" />
      <path d="M8 3.1v1.3M8 12.8v1.3M2.5 8.6h1.3M12.2 8.6h1.3M4.1 4.7l.9.9M11 11.6l.9.9M4.1 12.5l.9-.9M11 5.6l.9-.9"
        strokeWidth="1.2" />
      <path d="M21 17.4a4.6 4.6 0 0 1-8.2-2.8 4.6 4.6 0 0 1 3.2-4.4 4.9 4.9 0 0 0 5 7.2z"
        fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * A crown standing in its own region, with a neighbour ruled out.
 *
 * The first version put a small crown in a top-left quadrant and left the
 * bottom half of the tile empty, which read as a box with something stuck in
 * the corner. Giving the crown a tall region of its own lets it fill the
 * space and be the thing you see first.
 */
function CrownsMark() {
  return (
    <svg {...frame} className="h-full w-full">
      <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />
      <path d="M2.5 2.5h13v19h-13z" fill="currentColor" stroke="none" opacity="0.17" />
      <path d="M15.5 2.5v19M15.5 12h6" strokeWidth="1.2" />
      <path d="M4.7 15.9h8.6M4.7 15.9 4 9.7l2.6 2.1L9 7.9l2.4 3.9L14 9.7l-.7 6.2"
        strokeWidth="1.5" />
      <path d="M17.2 6.2l2.6 2.6M19.8 6.2l-2.6 2.6" strokeWidth="1.4" opacity="0.7" />
    </svg>
  );
}

/**
 * One unbroken line between two stops.
 *
 * Two earlier tries both failed the same way: a symmetric serpentine inside a
 * rounded box is a numeral. The first read as a maze, the second read plainly
 * as a "2" — next to Nine, which contains real digits. What fixes it is
 * asymmetry: this route descends, doubles back and stops somewhere unexpected,
 * which no digit does.
 */
function ThreadMark() {
  return (
    <svg {...frame} className="h-full w-full">
      <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />
      <path d="M6.6 6.6v6.4h5v4.6h5V9.4"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.6" cy="6.6" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="16.6" cy="9.4" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A square cut into patches of different proportions. */
function QuiltMark() {
  return (
    <svg {...frame} className="h-full w-full">
      <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />
      <rect x="2.5" y="2.5" width="11" height="7" fill="currentColor" stroke="none" opacity="0.22" />
      <rect x="13.5" y="2.5" width="8" height="12" fill="currentColor" stroke="none" opacity="0.14" />
      <rect x="2.5" y="9.5" width="6" height="12" fill="currentColor" stroke="none" opacity="0.14" />
      <path d="M13.5 2.5v12M2.5 9.5h11M8.5 9.5v12M13.5 14.5h8M8.5 15.5h5" strokeWidth="1.4" />
    </svg>
  );
}

const MARKS: Record<GameId, () => React.JSX.Element> = {
  nine: NineMark,
  eclipse: EclipseMark,
  crowns: CrownsMark,
  thread: ThreadMark,
  quilt: QuiltMark,
};

/** The bare mark, inheriting colour from its parent. */
export function GameMark({ game }: { game: GameId }) {
  const Mark = MARKS[game];
  return <Mark />;
}

/**
 * The mark in its game's tinted tile. `--pb-game` is set here and read by the
 * `.pb-game` rule, so the tint is always the same mix of the same colour.
 */
export function GameTile({ game, className = 'h-11 w-11' }: { game: GameId; className?: string }) {
  return (
    <div
      className={`pb-game flex flex-shrink-0 items-center justify-center rounded-xl ${className}`}
      style={{ ['--pb-game' as string]: GAME_COLOR[game], color: GAME_INK[game] }}
      aria-hidden="true"
    >
      <div className="h-[62%] w-[62%]"><GameMark game={game} /></div>
    </div>
  );
}

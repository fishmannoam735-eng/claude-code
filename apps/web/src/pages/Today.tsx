import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchPlaysForDate, fetchStreaks } from '@pb/data';
import {
  localDateKey, makeSeed, quiltGame, threadGame,
  type Difficulty, type GameId,
} from '@pb/engine';
import { Icon } from '../components/Icon';
import { GAME_COLOR, GAME_INK, GameTile } from '../components/GameMark';
import { fmtDate, fmtTime, DIFF_LABEL } from '../lib/format';
import { supabase, useSession } from '../lib/session';
import { readJSON } from '../lib/storage';
import type { Snapshot as NineSnapshot } from '../games/nine/store';
import type { Snapshot as EclipseSnapshot } from '../games/eclipse/store';
import type { Snapshot as CrownsSnapshot } from '../games/crowns/store';
import type { Snapshot as ThreadSnapshot } from '../games/thread/store';
import type { Snapshot as QuiltSnapshot } from '../games/quilt/store';
import { localKey } from '../lib/persistence';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

interface GameDef { id: GameId; name: string; blurb: string }

const GAMES: GameDef[] = [
  { id: 'nine', name: 'Nine', blurb: '9×9 sudoku · the long one' },
  { id: 'eclipse', name: 'Eclipse', blurb: 'Suns and moons' },
  { id: 'crowns', name: 'Crowns', blurb: 'One crown per colour' },
  { id: 'thread', name: 'Thread', blurb: 'One line, every cell' },
  { id: 'quilt', name: 'Quilt', blurb: 'Cut it into patches' },
];

/** How much there is to fill, so a progress bar means the same thing everywhere. */
const TOTAL: Record<GameId, (d: Difficulty) => number> = {
  nine: () => 81,
  eclipse: () => 36,
  crowns: () => 8,
  thread: (d) => threadGame.SIDES[d] ** 2,
  quilt: (d) => quiltGame.SIDES[d] ** 2,
};

interface TileState { status: 'none' | 'in_progress' | 'solved'; elapsedMs: number; placed: number }
const BLANK: TileState = { status: 'none', elapsedMs: 0, placed: 0 };

type AnySnapshot =
  | NineSnapshot | EclipseSnapshot | CrownsSnapshot | ThreadSnapshot | QuiltSnapshot;

/** How far along a snapshot is, whichever shape it happens to be. */
function progressOf(s: AnySnapshot): number {
  if ('path' in s) return s.path.length;
  if ('owner' in s) return s.owner.filter((k) => k >= 0).length;
  return s.grid.filter((v) => v !== 0).length;
}

type Board = Record<GameId, Record<Difficulty, TileState>>;

const emptyBoard = (): Board =>
  Object.fromEntries(GAMES.map((g) => [g.id, { easy: BLANK, normal: BLANK, hard: BLANK }])) as Board;

function localBoard(today: string): Board {
  const out = emptyBoard();
  for (const g of GAMES) {
    for (const d of DIFFS) {
      const s = readJSON<AnySnapshot>(localKey(g.id, makeSeed(g.id, today, d)));
      if (s) out[g.id][d] = { status: s.status, elapsedMs: s.elapsedMs, placed: progressOf(s) };
    }
  }
  return out;
}

export function Today() {
  const today = localDateKey();
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);
  const [streak, setStreak] = useState<number | null>(null);
  const [board, setBoard] = useState<Board>(() => localBoard(today));

  useEffect(() => {
    if (!supabase || !userId) return;
    void fetchStreaks(supabase, userId)
      .then((rows) => setStreak(rows.reduce((best, r) => Math.max(best, r.current ?? 0), 0)))
      .catch(() => { /* offline is fine */ });

    void fetchPlaysForDate(supabase, userId, today).then((rows) => {
      setBoard((prev) => {
        const next: Board = { ...prev };
        for (const row of rows) {
          const g = row.game_id as GameId;
          if (!next[g]) continue;
          const snap = row.state as AnySnapshot | null;
          const remote: TileState = {
            status: row.status === 'solved' ? 'solved' : 'in_progress',
            elapsedMs: row.duration_ms ?? 0,
            placed: snap ? progressOf(snap) : 0,
          };
          const local = prev[g][row.difficulty];
          const better = local.status === 'none'
            || (remote.status === 'solved' && local.status !== 'solved')
            || remote.elapsedMs > local.elapsedMs;
          if (better) next[g] = { ...next[g], [row.difficulty]: remote };
        }
        return next;
      });
    }).catch(() => { /* offline is fine */ });
  }, [userId, today]);

  const solvedToday = GAMES.filter((g) => board[g.id].normal.status === 'solved').length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-4 pb-10">
      <header className="flex items-end justify-between pb-3 pt-5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Puzzle Break</div>
          <div className="text-[13px] text-ink-2">{fmtDate(today)}</div>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border border-line-minor bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-text"
          title="Longest current streak"
        >
          <Icon.Flame width={14} height={14} />
          <span>{streak ?? (sessionStatus === 'offline' ? '–' : '…')}</span>
        </div>
      </header>

      {sessionStatus === 'offline' && (
        <div className="mb-3 rounded-xl border border-line-minor bg-raised px-3 py-2 text-[12px] text-ink-2">
          Playing offline — progress is saved on this device only.
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 text-[12px] text-ink-2">
        <span className="flex gap-1">
          {GAMES.map((g) => (
            <span
              key={g.id}
              className={`h-1.5 w-1.5 rounded-full ${board[g.id].normal.status === 'solved' ? '' : 'bg-line-major'}`}
              style={board[g.id].normal.status === 'solved' ? { backgroundColor: GAME_COLOR[g.id] } : undefined}
            />
          ))}
        </span>
        <span>{solvedToday} of {GAMES.length} done today</span>
      </div>

      <div className="flex flex-col gap-3">
        {GAMES.map((g) => <GameCard key={g.id} def={g} today={today} states={board[g.id]} />)}
      </div>

      <div className="mt-5 rounded-2xl border border-line-minor bg-raised p-4">
        <div className="text-[14px] font-bold">Practice</div>
        <div className="mt-0.5 text-[12px] text-ink-2">
          Unlimited puzzles, fresh every time. They don't count toward your streak.
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {GAMES.map((g) => (
            <div key={g.id} className="flex items-center gap-2.5">
              <GameTile game={g.id} className="h-7 w-7 rounded-lg" />
              <span className="w-[58px] flex-shrink-0 text-[13px] font-semibold">{g.name}</span>
              <div className="flex flex-grow gap-1.5">
                {DIFFS.map((d) => (
                  <Link
                    key={d}
                    to={`/practice/${g.id}/${d}`}
                    className="flex h-8 flex-grow items-center justify-center rounded-lg border border-line-minor bg-raised-2 text-[12px] font-semibold text-ink-2"
                  >
                    {DIFF_LABEL[d]}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One card per game, with the day's three boards inside it.
 *
 * The three difficulties used to be three separate cards stacked below the
 * game, which meant every game appeared on this screen four times over and two
 * of the labels collided at 390px. Folding them in makes each game one object
 * that shows its own state at a glance.
 */
function GameCard({ def, today, states }: { def: GameDef; today: string; states: Record<Difficulty, TileState> }) {
  // Summarise whichever board is actually under way — normal when it is one of
  // them, since that is the canonical daily. Pinning the bar to normal made a
  // card read "Hard · Resume" with no progress shown anywhere.
  const shown = DIFFS.find((d) => states[d].status !== 'none' && d === 'normal')
    ?? DIFFS.find((d) => states[d].status !== 'none')
    ?? 'normal';
  const normal = states[shown];
  const total = TOTAL[def.id](shown);
  const started = normal.status !== 'none';

  return (
    <div
      className="rounded-[18px] border border-line-minor bg-raised p-4 shadow-[0_1px_2px_rgba(26,24,20,0.04)]"
      style={{ ['--pb-game' as string]: GAME_COLOR[def.id] }}
    >
      <div className="flex items-center gap-3.5">
        <GameTile game={def.id} />
        <div className="flex flex-grow flex-col gap-0.5">
          <span className="text-[17px] font-bold tracking-tight">{def.name}</span>
          <span className="text-[12px] text-ink-2">{def.blurb}</span>
        </div>
        {normal.status === 'solved' && (
          <span className="flex items-center gap-1 text-[14px] font-semibold text-success">
            <Icon.Check width={15} height={15} /> {fmtTime(normal.elapsedMs)}
          </span>
        )}
        {normal.status === 'in_progress' && (
          <span className="text-[14px] font-semibold tabular-nums" style={{ color: GAME_INK[def.id] }}>
            {fmtTime(normal.elapsedMs)}
          </span>
        )}
      </div>

      {started && (
        <div className="mt-3">
          <div className="h-[5px] w-full overflow-hidden rounded-full bg-raised-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.round((normal.placed / total) * 100))}%`,
                backgroundColor: normal.status === 'solved' ? 'var(--color-success)' : GAME_COLOR[def.id],
              }}
            />
          </div>
          <div className="mt-1 text-[11.5px] text-ink-2">
            {normal.status === 'solved'
              ? `Solved on ${DIFF_LABEL[shown].toLowerCase()}`
              : `${normal.placed} of ${total} on ${DIFF_LABEL[shown].toLowerCase()}`}
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-1.5">
        {DIFFS.map((d) => (
          <DifficultyChip key={d} game={def.id} today={today} difficulty={d} state={states[d]} />
        ))}
      </div>
    </div>
  );
}

/**
 * A difficulty, its state, and a link to it. The chip carries a tint of the
 * game's colour once it has been touched, so a glance across the card says
 * which of the three you are part-way through — never colour alone, though:
 * the word under it says the same thing.
 */
function DifficultyChip(props: { game: GameId; today: string; difficulty: Difficulty; state: TileState }) {
  const { game, today, difficulty, state } = props;
  const touched = state.status !== 'none';
  const label = state.status === 'solved' ? 'Solved'
    : state.status === 'in_progress' ? 'Resume'
      : 'Play';

  return (
    <Link
      to={`/g/${makeSeed(game, today, difficulty)}`}
      aria-label={`${DIFF_LABEL[difficulty]} — ${label}`}
      className={`flex flex-grow basis-0 flex-col items-center justify-center gap-0.5 rounded-xl border py-2 ${
        touched ? 'pb-game' : 'border-line-minor bg-raised-2'
      }`}
      style={touched ? { borderColor: GAME_COLOR[game] } : undefined}
    >
      <span className="text-[12.5px] font-bold leading-none">{DIFF_LABEL[difficulty]}</span>
      <span
        className="text-[10.5px] font-semibold leading-none"
        style={{ color: state.status === 'solved' ? 'var(--color-success)' : touched ? GAME_INK[game] : 'var(--color-ink-2)' }}
      >
        {label}
      </span>
    </Link>
  );
}

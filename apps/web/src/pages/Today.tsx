import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchPlaysForDate, fetchStreaks } from '@pb/data';
import {
  localDateKey, makeSeed, quiltGame, threadGame,
  type Difficulty, type GameId,
} from '@pb/engine';
import { Icon } from '../components/Icon';
import { GAME_COLOR, GAME_INK, GameMark, GameTile } from '../components/GameMark';
import { MiniBoard } from '../components/TodayArt';
import crownUrl from '../games/crowns/assets/crown.webp';
import { fmtDate, fmtTime, DIFF_LABEL } from '../lib/format';
import { supabase, useSession } from '../lib/session';
import { readJSON } from '../lib/storage';
import type { Snapshot as NineSnapshot } from '../games/nine/store';
import type { Snapshot as EclipseSnapshot } from '../games/eclipse/store';
import type { Snapshot as CrownsSnapshot } from '../games/crowns/store';
import type { Snapshot as ThreadSnapshot } from '../games/thread/store';
import type { Snapshot as QuiltSnapshot } from '../games/quilt/store';
import { localKey } from '../lib/persistence';
import { Avatar } from '../components/Avatar';
import { fetchLeaderboard } from '@pb/data';
import { fmtPoints, ordinal, useMe } from '../lib/contest';

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

/** A game's daily task is done once any one of its difficulties is solved. */
const isDone = (states: Record<Difficulty, TileState>): boolean =>
  DIFFS.some((d) => states[d].status === 'solved');

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
  const me = useMe((s) => s.stats);
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

  const solvedToday = GAMES.filter((g) => isDone(board[g.id])).length;

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      {/* A warm wash behind the header, like light falling on the table. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: 'radial-gradient(120% 70% at 50% -10%, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 70%)' }}
      />
      <div className="relative mx-auto flex w-full max-w-[440px] flex-col px-4 pb-12">
        <header className="pb-rise flex items-start justify-between pb-4 pt-6">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent-text">{fmtDate(today)}</div>
            <h1 className="mt-1 flex items-center gap-2 text-[30px] font-bold leading-none tracking-[-0.02em]">
              Puzzle Break
              <img src={crownUrl} alt="" className="pb-float h-8 w-8" style={{ filter: 'drop-shadow(0 3px 3px rgb(90 60 10 / 0.35))' }} />
            </h1>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--color-accent)_35%,transparent)] bg-raised px-3 py-1.5 text-[14px] font-bold text-accent-text shadow-[0_4px_12px_-6px_rgb(120_80_20/0.5)]"
              title="Longest current streak"
            >
              <span className="pb-flicker inline-flex text-[#E07A1F]"><Icon.Flame width={19} height={19} strokeWidth={2.3} /></span>
              <span className="tabular-nums">{streak ?? (sessionStatus === 'offline' ? '–' : '…')}</span>
            </div>
            {me && (
              <Link to="/me" aria-label="Your profile" className="transition-transform active:scale-95">
                <Avatar name={me.nickname} colour={me.avatar} size={36} />
              </Link>
            )}
          </div>
        </header>

        <TodayPlank board={board} solved={solvedToday} />
        {sessionStatus === 'online' && <ContestStrip />}

        {sessionStatus === 'offline' && (
          <div className="pb-rise mt-3 flex items-center gap-2 rounded-xl bg-raised-2/70 px-3 py-2 text-[12px] text-ink-2" style={{ ['--d' as string]: '120ms' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-line-major" />
            Playing offline. Progress is saved on this device.
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3.5">
          {GAMES.map((g, k) => (
            <GameCard key={g.id} def={g} today={today} states={board[g.id]} index={k} />
          ))}
        </div>

        <Practice />
      </div>
    </div>
  );
}

const CHEERS = ['Five fresh boards are waiting.', 'Nice start. Keep it rolling.', 'Two down, three to go.', 'Past halfway. Lovely.', 'One more and the set is yours.', 'All five solved. See you tomorrow!'];

/**
 * The day at a glance: five tiles set into a wooden plank, one per game. A
 * solved game's tile turns its own glossy colour with a check on it.
 */
function TodayPlank({ board, solved }: { board: Board; solved: number }) {
  const all = solved === GAMES.length;
  return (
    <section
      className="pb-rise pb-wood relative rounded-[20px] p-3.5"
      style={{ ['--d' as string]: '60ms' }}
      aria-label={`${solved} of ${GAMES.length} games done today`}
    >
      <div className="flex items-baseline justify-between px-0.5 pb-2.5 text-[#FFF4E2]">
        <span className="text-[15px] font-bold tracking-tight [text-shadow:0_1px_1px_rgb(60_30_5/0.5)]">Today&apos;s set</span>
        <span className="text-[13px] font-semibold tabular-nums opacity-90 [text-shadow:0_1px_1px_rgb(60_30_5/0.5)]">
          {solved} of {GAMES.length} done
        </span>
      </div>
      <div className="grid grid-cols-5 gap-[5px] rounded-[12px] p-[5px]" style={{ background: '#5C4028', boxShadow: 'inset 0 2px 6px rgb(30 18 8 / 0.65)' }}>
        {GAMES.map((g, k) => {
          const done = isDone(board[g.id]);
          const c = GAME_COLOR[g.id];
          return (
            <div
              key={g.id}
              className="pb-in relative aspect-square rounded-[9px]"
              style={{
                ['--d' as string]: `${180 + k * 70}ms`,
                background: done
                  ? `linear-gradient(140deg, color-mix(in srgb, ${c} 55%, white) 0%, ${c} 55%, color-mix(in srgb, ${c} 80%, black) 100%)`
                  : 'linear-gradient(135deg, rgb(255 251 240) 0%, rgb(250 243 226) 45%, rgb(232 220 196) 100%)',
                boxShadow: `0 3px 0 ${done ? `color-mix(in srgb, ${c} 60%, black)` : 'rgb(176 158 126)'}, inset 1px 1px 0 rgb(255 255 255 / 0.5)`,
                marginBottom: 3,
              }}
              title={g.name}
            >
              <div className={`absolute inset-[22%] ${done ? 'text-white' : 'text-[#8C7A60] opacity-70'}`}>
                <GameMark game={g.id} />
              </div>
              {done && (
                <span
                  className="pb-stamp absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-success text-white ring-2 ring-[#5C4028]"
                  style={{ ['--d' as string]: `${520 + k * 90}ms` }}
                >
                  <Icon.Check width={11} height={11} strokeWidth={3.4} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 px-0.5 text-[12.5px] font-medium text-[#FBE9CC] [text-shadow:0_1px_1px_rgb(60_30_5/0.5)]">
        {CHEERS[solved]}
      </div>
      {all && <Confetti />}
    </section>
  );
}

/** A one-off shower of little glossy tiles when the whole set is solved. */
function Confetti() {
  const colours = ['#C4B2EC', '#F7C4A8', '#AAE0C6', '#A0C8F0', '#F8E496', '#F0A094', '#ECA6D4'];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <span
          key={i}
          className="pb-confetti absolute top-2 block h-2.5 w-2.5 rounded-[3px]"
          style={{
            left: `${6 + ((i * 37) % 88)}%`,
            background: colours[i % colours.length],
            boxShadow: '0 1.5px 0 rgb(0 0 0 / 0.18)',
            ['--dx' as string]: `${((i * 53) % 60) - 30}px`,
            ['--rot' as string]: `${((i * 97) % 540) - 270}deg`,
            ['--d' as string]: `${700 + (i % 6) * 70}ms`,
          }}
        />
      ))}
    </div>
  );
}

function Practice() {
  return (
    <section className="pb-rise mt-7" style={{ ['--d' as string]: '520ms' }}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[17px] font-bold tracking-tight">Practice</h2>
        <span className="text-[12px] text-ink-2">New boards, points for your score</span>
      </div>
      <div className="mt-3 flex flex-col gap-2.5 rounded-[20px] border border-line-minor bg-raised p-3.5 shadow-[0_8px_24px_-14px_rgb(60_40_20/0.35)]">
        {GAMES.map((g) => (
          <div key={g.id} className="flex items-center gap-2.5">
            <GameTile game={g.id} className="h-8 w-8 rounded-[10px]" />
            <span className="w-[60px] flex-shrink-0 text-[13.5px] font-semibold">{g.name}</span>
            <div className="flex flex-grow gap-1.5">
              {DIFFS.map((d) => (
                <Link
                  key={d}
                  to={`/practice/${g.id}/${d}`}
                  className="pb-key flex h-8 flex-grow items-center justify-center rounded-[10px] bg-raised-2 text-[12px] font-semibold text-ink-2"
                >
                  {DIFF_LABEL[d]}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * One card per game: its board in a little wooden tray, what's happening with
 * it today, and the three difficulties as tiles you press.
 */
function GameCard({ def, today, states, index }: { def: GameDef; today: string; states: Record<Difficulty, TileState>; index: number }) {
  // Solving any one difficulty completes the game for the day, so a solved
  // board is summarised first (normal if several are). Otherwise show whichever
  // board is under way, preferring normal.
  const prefer = (ok: (d: Difficulty) => boolean): Difficulty | undefined =>
    (ok('normal') ? 'normal' : DIFFS.find(ok));
  const shown = prefer((d) => states[d].status === 'solved')
    ?? prefer((d) => states[d].status !== 'none')
    ?? 'normal';
  const cur = states[shown];
  const total = TOTAL[def.id](shown);
  const started = cur.status !== 'none';
  const solved = cur.status === 'solved';
  const delayMs = 200 + index * 80;
  const pct = Math.min(100, Math.round((cur.placed / total) * 100));

  return (
    <div
      className="pb-rise relative overflow-hidden rounded-[22px] border border-line-minor bg-raised p-3.5 shadow-[0_10px_28px_-16px_rgb(60_40_20/0.45)]"
      style={{
        ['--d' as string]: `${delayMs}ms`,
        ['--card-d' as string]: `${delayMs}ms`,
        ['--glint' as string]: `${2 + index * 1.3}s`,
      }}
    >
      {/* The game's colour as a soft light in the card's corner. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full"
        style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${GAME_COLOR[def.id]} 20%, transparent), transparent)` }}
      />
      <div className="relative flex items-center gap-3.5">
        <Link
          to={`/g/${makeSeed(def.id, today, shown)}`}
          className="relative w-[92px] flex-shrink-0 transition-transform active:scale-[0.96]"
          aria-label={`Play ${def.name}`}
        >
          <MiniBoard game={def.id} />
          {solved && (
            <span
              className="pb-stamp absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-success text-white shadow-[0_3px_8px_rgb(30_60_40/0.45)] ring-[3px] ring-raised"
              style={{ ['--d' as string]: `${delayMs + 650}ms` }}
            >
              <Icon.Check width={15} height={15} strokeWidth={3.2} />
            </span>
          )}
        </Link>
        <div className="flex min-w-0 flex-grow flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[19px] font-bold tracking-[-0.01em]">{def.name}</span>
            {started && (
              <span
                className={`text-[13.5px] font-semibold tabular-nums ${solved ? 'text-success' : ''}`}
                style={solved ? undefined : { color: GAME_INK[def.id] }}
              >
                {fmtTime(cur.elapsedMs)}
              </span>
            )}
          </div>
          <span className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{def.blurb}</span>
          <div className="mt-2.5">
            <div className="h-[6px] w-full overflow-hidden rounded-full bg-raised-2 shadow-[inset_0_1px_1px_rgb(60_40_20/0.12)]">
              {started && (
                <div
                  className="pb-grow h-full rounded-full"
                  style={{
                    width: `${solved ? 100 : Math.max(pct, 4)}%`,
                    background: solved
                      ? 'linear-gradient(90deg, var(--color-success), color-mix(in srgb, var(--color-success) 70%, white))'
                      : `linear-gradient(90deg, ${GAME_COLOR[def.id]}, color-mix(in srgb, ${GAME_COLOR[def.id]} 65%, white))`,
                    ['--d' as string]: `${delayMs + 300}ms`,
                  }}
                />
              )}
            </div>
            <div className="mt-1 text-[11.5px] font-medium text-ink-2">
              {solved ? `Solved on ${DIFF_LABEL[shown].toLowerCase()}`
                : started ? `${cur.placed} of ${total} on ${DIFF_LABEL[shown].toLowerCase()}`
                  : 'Not started yet'}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-3.5 flex gap-2">
        {DIFFS.map((d) => (
          <DifficultyChip key={d} game={def.id} today={today} difficulty={d} state={states[d]} />
        ))}
      </div>
    </div>
  );
}

/**
 * A difficulty as a tile you press: ivory to play, the game's colour while
 * under way, green once solved. The word on it says the same thing, so colour
 * is never the only channel.
 */
function DifficultyChip(props: { game: GameId; today: string; difficulty: Difficulty; state: TileState }) {
  const { game, today, difficulty, state } = props;
  const c = GAME_COLOR[game];
  const label = state.status === 'solved' ? 'Solved'
    : state.status === 'in_progress' ? 'Resume'
      : 'Play';
  const look: React.CSSProperties = state.status === 'solved'
    ? {
      // Fixed greens rather than the theme token, so the white text keeps its contrast in dark mode too.
      background: 'linear-gradient(160deg, #6FA27D, #437A55)',
      color: '#fff', ['--key-side' as string]: '#2E5A3C',
    }
    : state.status === 'in_progress'
      ? {
        background: `linear-gradient(160deg, color-mix(in srgb, ${c} 14%, var(--color-raised)), color-mix(in srgb, ${c} 26%, var(--color-raised)))`,
        color: GAME_INK[game], ['--key-side' as string]: `color-mix(in srgb, ${c} 55%, var(--color-raised))`,
      }
      : {
        background: 'linear-gradient(160deg, var(--color-raised), var(--color-raised-2))',
        ['--key-side' as string]: 'var(--color-line-major)',
      };

  return (
    <Link
      to={`/g/${makeSeed(game, today, difficulty)}`}
      aria-label={`${DIFF_LABEL[difficulty]}, ${label}`}
      className="pb-key mb-[3px] flex h-[50px] flex-grow basis-0 flex-col items-center justify-center gap-[3px] rounded-[13px]"
      style={look}
    >
      <span className="text-[13px] font-bold leading-none">{DIFF_LABEL[difficulty]}</span>
      <span className={`flex items-center gap-1 text-[10.5px] font-semibold leading-none ${state.status === 'none' ? 'text-ink-2' : 'opacity-90'}`}>
        {state.status === 'solved' && <Icon.Check width={10} height={10} strokeWidth={3.4} />}
        {label}
      </span>
    </Link>
  );
}

/**
 * Today's contest in one line under the plank: where you stand, and the way
 * into the full rankings.
 */
function ContestStrip() {
  const today = localDateKey();
  const userId = useSession((s) => s.userId);
  const [mine, setMine] = useState<{ rank: number; score: number; players: number } | null>(null);
  const [players, setPlayers] = useState<number | null>(null);
  useEffect(() => {
    if (!supabase) return;
    void fetchLeaderboard(supabase, 'day', today, null, 500).then((rows) => {
      setPlayers(rows.length);
      const r = rows.find((x) => x.is_me);
      setMine(r ? { rank: r.rank, score: r.score, players: rows.length } : null);
    }).catch(() => { /* fine */ });
  }, [today, userId]);

  return (
    <Link
      to="/rankings"
      className="pb-rise pb-key mt-3 flex items-center gap-3 rounded-[16px] px-3.5 py-2.5"
      style={{ ['--d' as string]: '140ms', background: 'linear-gradient(160deg, #FFF3CF 0%, #F6D98A 45%, #E8B44A 100%)', color: '#4E2E04', ['--key-side' as string]: '#9A6410' }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(255_255_255/0.45)]"><Icon.Trophy width={20} height={20} /></span>
      <span className="flex-grow">
        <span className="block text-[14px] font-extrabold leading-tight">Today&apos;s contest</span>
        <span className="block text-[12px] font-semibold opacity-80">
          {mine ? `You are ${ordinal(mine.rank)} of ${mine.players} · ${fmtPoints(mine.score)} pts`
            : players ? `${players} player${players === 1 ? '' : 's'} so far. Solve a board to join.` : 'Solve a board to get on the board.'}
        </span>
      </span>
      <span className="text-[13px] font-bold">Rankings ›</span>
    </Link>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { fetchPlaysForDate, fetchStreaks } from '@pb/data';
import {
  localDateKey, makeSeed, quiltGame, threadGame,
  type Difficulty, type GameId,
} from '@pb/engine';
import { Icon } from '../components/Icon';
import { GAME_COLOR, GAME_INK, GameMark } from '../components/GameMark';
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
import type { Snapshot as BridgesSnapshot } from '../games/bridges/store';
import type { Snapshot as MosaicSnapshot } from '../games/mosaic/store';
import { dayBestKey, localKey, type DayBest } from '../lib/persistence';
import { Avatar } from '../components/Avatar';
import { LeadersStage } from '../components/LeadersStage';
import { fmtPoints, useMe } from '../lib/contest';
import { playInvite } from '../lib/sound';
import pinballThumb from '../games/pinball/assets/thumb.webp';
import pinballHero from '../games/pinball/assets/hero.webp';
import { PINBALL_LEVELS, PINBALL_LEVEL_NOTE, pinballBest, pinballHigh } from '../games/pinball/pinball';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

interface GameDef { id: GameId; name: string; blurb: string }

const GAMES: GameDef[] = [
  { id: 'bridges', name: 'Bridges', blurb: 'Join every island' },
  { id: 'mosaic', name: 'Mosaic', blurb: 'Paint the hidden picture' },
  { id: 'eclipse', name: 'Eclipse', blurb: 'Suns and moons' },
  { id: 'nine', name: 'Nine', blurb: '9×9 sudoku · the long one' },
  { id: 'quilt', name: 'Quilt', blurb: 'Cut it into patches' },
  { id: 'crowns', name: 'Crowns', blurb: 'One crown per colour' },
  { id: 'thread', name: 'Thread', blurb: 'One line, every cell' },
];

/** How much there is to fill, so a progress bar means the same thing everywhere. */
const TOTAL: Record<GameId, (d: Difficulty) => number> = {
  nine: () => 81,
  eclipse: () => 36,
  crowns: () => 8,
  thread: (d) => threadGame.SIDES[d] ** 2,
  quilt: (d) => quiltGame.SIDES[d] ** 2,
  // A stand-in until a board is opened; its snapshot carries the real number.
  bridges: (d) => ({ easy: 16, normal: 26, hard: 36 })[d],
  mosaic: (d) => ({ easy: 40, normal: 52, hard: 94 })[d],
};

interface TileState { status: 'none' | 'in_progress' | 'solved'; elapsedMs: number; placed: number; total?: number }
const BLANK: TileState = { status: 'none', elapsedMs: 0, placed: 0 };

type AnySnapshot =
  | NineSnapshot | EclipseSnapshot | CrownsSnapshot | ThreadSnapshot | QuiltSnapshot | BridgesSnapshot | MosaicSnapshot;

/** How far along a snapshot is, whichever shape it happens to be. */
function progressOf(s: AnySnapshot): number {
  if ('bridges' in s) return s.bridges.reduce((a, b) => a + b, 0);
  if ('paint' in s) return s.paint.filter((v) => v === 1).length;
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
      if (s) out[g.id][d] = { status: s.status, elapsedMs: s.elapsedMs, placed: progressOf(s), ...('goal' in s && s.goal ? { total: s.goal } : {}) };
    }
  }
  return out;
}

type Bests = Partial<Record<GameId, DayBest>>;

function localBests(today: string): Bests {
  const out: Bests = {};
  for (const g of GAMES) {
    const b = readJSON<DayBest>(dayBestKey(today, g.id));
    if (b) out[g.id] = b;
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
  // The best board of each game today, daily or new: the one the contest counts.
  const [bests, setBests] = useState<Bests>(() => localBests(today));

  useEffect(() => {
    if (!supabase || !userId) return;
    void fetchStreaks(supabase, userId)
      .then((rows) => setStreak(rows.reduce((best, r) => Math.max(best, r.current ?? 0), 0)))
      .catch(() => { /* offline is fine */ });

    void fetchPlaysForDate(supabase, userId, today).then((rows) => {
      setBests((prev) => {
        const next: Bests = { ...prev };
        for (const row of rows) {
          if (row.status !== 'solved' || row.score === null || (row.mode !== 'daily' && !row.contest)) continue;
          const g = row.game_id as GameId;
          const cur = next[g];
          if (cur && cur.score >= row.score) continue;
          next[g] = { score: row.score, elapsedMs: row.best_ms ?? row.duration_ms ?? 0, difficulty: row.difficulty, seed: row.seed };
        }
        return next;
      });
      setBoard((prev) => {
        const next: Board = { ...prev };
        for (const row of rows) {
          if (row.mode !== 'daily') continue;
          const g = row.game_id as GameId;
          if (!next[g]) continue;
          const snap = row.state as AnySnapshot | null;
          const remote: TileState = {
            status: row.status === 'solved' ? 'solved' : 'in_progress',
            elapsedMs: row.duration_ms ?? 0,
            placed: snap ? progressOf(snap) : 0,
            ...(snap && 'goal' in snap && snap.goal ? { total: snap.goal } : {}),
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
  const [open, setOpen] = useState<GameId | 'pinball' | null>(null);
  const openDef = GAMES.find((g) => g.id === open);

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
                <Avatar name={me.nickname} colour={me.avatar} photo={me.photo} size={36} />
              </Link>
            )}
          </div>
        </header>

        <TodayPlank board={board} solved={solvedToday} />
        {sessionStatus === 'offline' && (
          <div className="pb-rise mt-3 flex items-center gap-2 rounded-xl bg-raised-2/70 px-3 py-2 text-[12px] text-ink-2" style={{ ['--d' as string]: '120ms' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-line-major" />
            Playing offline. Progress is saved on this device.
          </div>
        )}
        <Shelf title="Mind puzzles" note="A new board every day" delay={160}>
          {GAMES.map((g, k) => (
            <GameBox key={g.id} def={g} states={board[g.id]} index={k} onOpen={() => setOpen(g.id)} />
          ))}
        </Shelf>

        <Shelf title="Speed &amp; skill" note="Quick hands, high scores" delay={320}>
          <PinballBox index={GAMES.length} onOpen={() => setOpen('pinball')} />
          <div
            className="col-span-2 flex items-center justify-center rounded-[20px] border-2 border-dashed border-line-major/70 px-3 text-center text-[12px] font-medium leading-snug text-ink-2"
            aria-hidden="true"
          >
            More speed games are on the way
          </div>
        </Shelf>
        <div className="mt-6"><LeadersStage /></div>


      </div>
      {openDef && <GameSheet def={openDef} today={today} states={board[openDef.id]} best={bests[openDef.id]} onClose={() => setOpen(null)} />}
      {open === 'pinball' && <PinballSheet onClose={() => setOpen(null)} />}
    </div>
  );
}

const CHEERS = ['Seven fresh boards are waiting.', 'Nice start. Keep it rolling.', 'Two down, five to go.', 'Three down. Lovely.', 'Past halfway. Keep going.', 'Five down, two to go.', 'One more and the set is yours.', 'All seven solved. See you tomorrow!'];

/**
 * The day at a glance: seven tiles set into a wooden plank, one per game. A
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
      <div className="grid grid-cols-7 gap-[5px] rounded-[12px] p-[5px]" style={{ background: '#5C4028', boxShadow: 'inset 0 2px 6px rgb(30 18 8 / 0.65)' }}>
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

/** A titled shelf of small game boxes, three to a row. */
function Shelf({ title, note, delay, children }: { title: string; note: string; delay: number; children: ReactNode }) {
  return (
    <section className="pb-rise mt-6" style={{ ['--d' as string]: `${delay}ms` }}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[18px] font-bold tracking-tight">{title}</h2>
        <span className="text-[12px] text-ink-2">{note}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

/** Where a game stands today, in one short line. */
function statusOf(states: Record<Difficulty, TileState>): { kind: TileState['status']; text: string } {
  const solved = DIFFS.find((d) => states[d].status === 'solved');
  if (solved) return { kind: 'solved', text: fmtTime(states[solved].elapsedMs) };
  const going = DIFFS.find((d) => states[d].status === 'in_progress');
  if (going) return { kind: 'in_progress', text: 'Resume' };
  return { kind: 'none', text: 'Play' };
}

/** The shared shell of a game box: a glossy tile that lifts and glows when touched. */
function BoxShell(props: { colour: string; index: number; label: string; onOpen: () => void; children: ReactNode }) {
  const { colour, index, label, onOpen, children } = props;
  const { live, handlers } = useCardLive(index);
  return (
    <div className="pb-in pb-card-wrap relative" data-live={live || undefined} style={{ ['--d' as string]: `${260 + index * 60}ms` }} {...handlers}>
      <div
        aria-hidden="true"
        className="pb-card-glow pointer-events-none absolute inset-0 rounded-[20px]"
        style={{ boxShadow: `0 0 0 2px color-mix(in srgb, ${colour} 70%, white), 0 14px 32px -8px color-mix(in srgb, ${colour} 75%, transparent)` }}
      />
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        aria-haspopup="dialog"
        className="pb-card relative block w-full overflow-hidden rounded-[20px] p-2 pb-2.5 text-left shadow-[0_2px_0_rgb(120_90_50/0.18),0_12px_24px_-14px_rgb(60_40_20/0.6)]"
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${colour} 22%, var(--color-raised)) 0%, var(--color-raised) 70%)`,
          border: `1.5px solid color-mix(in srgb, ${colour} 45%, transparent)`,
          ['--card-d' as string]: `${260 + index * 60}ms`,
        }}
      >
        <div aria-hidden="true" className="pb-card-shine pointer-events-none absolute inset-y-0 left-0 w-[45%]" />
        {children}
      </button>
    </div>
  );
}

/** A mind puzzle as a small box: its board in a little tray, its name, and today's state. */
function GameBox({ def, states, index, onOpen }: { def: GameDef; states: Record<Difficulty, TileState>; index: number; onOpen: () => void }) {
  const st = statusOf(states);
  const c = GAME_COLOR[def.id];
  return (
    <BoxShell colour={c} index={index} label={`${def.name}: ${st.kind === 'solved' ? 'solved today' : st.text}`} onOpen={onOpen}>
      <div className="pb-card-art relative">
        <MiniBoard game={def.id} />
        {st.kind === 'solved' && (
          <span className="pb-stamp absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-success text-white shadow-[0_3px_8px_rgb(30_60_40/0.45)] ring-[2.5px] ring-raised" style={{ ['--d' as string]: `${700 + index * 60}ms` }}>
            <Icon.Check width={13} height={13} strokeWidth={3.2} />
          </span>
        )}
      </div>
      <div className="relative mt-2 flex items-baseline justify-between gap-1 px-0.5">
        <span className="truncate text-[14.5px] font-bold tracking-[-0.01em]">{def.name}</span>
        <span
          className={`flex-shrink-0 text-[11px] font-semibold tabular-nums ${st.kind === 'solved' ? 'text-success' : st.kind === 'none' ? 'text-ink-2' : ''}`}
          style={st.kind === 'in_progress' ? { color: GAME_INK[def.id] } : undefined}
        >
          {st.text}
        </span>
      </div>
    </BoxShell>
  );
}

const PINBALL_COLOUR = '#5B4BC4';

/** The pinball table as a small box, shown as a glimpse of the real 3D table. */
function PinballBox({ index, onOpen }: { index: number; onOpen: () => void }) {
  const best = pinballBest();
  return (
    <BoxShell colour={PINBALL_COLOUR} index={index} label="Pinball: Crown Quest" onOpen={onOpen}>
      <div className="pb-card-art relative">
        <div className="pb-wood rounded-[14px] p-[5px]">
          <img src={pinballThumb} alt="" className="block aspect-square w-full rounded-[10px] object-cover" style={{ boxShadow: 'inset 0 2px 6px rgb(0 0 0 / 0.6)' }} />
        </div>
      </div>
      <div className="relative mt-2 flex items-baseline justify-between gap-1 px-0.5">
        <span className="truncate text-[14.5px] font-bold tracking-[-0.01em]">Pinball</span>
        <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums text-ink-2">{best ? shortPoints(best) : 'Play'}</span>
      </div>
    </BoxShell>
  );
}

const shortPoints = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);

/** A sheet that rises from the bottom over a soft veil; tap outside or press Esc to close. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label}>
      <div className="pb-sheet-veil absolute inset-0 bg-[rgb(30_20_10/0.45)]" onClick={onClose} />
      <div className="pb-sheet relative max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[26px] bg-surface px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-18px_40px_-12px_rgb(40_25_10/0.5)]">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line-major" aria-hidden="true" />
        <button type="button" onClick={onClose} aria-label="Close" className="pb-key absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-raised-2 text-ink-2">
          <Icon.Close width={16} height={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

/** What opens when a puzzle's box is tapped: today's board at each level, or a new board to practise. */
function GameSheet({ def, today, states, best, onClose }: { def: GameDef; today: string; states: Record<Difficulty, TileState>; best: DayBest | undefined; onClose: () => void }) {
  const c = GAME_COLOR[def.id];
  const st = statusOf(states);
  return (
    <Sheet label={def.name} onClose={onClose}>
      <div className="flex items-center gap-4 pr-10 pt-1">
        <div className="w-[96px] flex-shrink-0"><MiniBoard game={def.id} /></div>
        <div className="min-w-0">
          <div className="text-[24px] font-bold leading-tight tracking-[-0.02em]">{def.name}</div>
          <div className="mt-0.5 text-[13px] text-ink-2">{def.blurb}</div>
          <div className="mt-2 text-[12px] font-semibold" style={{ color: st.kind === 'solved' ? 'var(--color-success)' : GAME_INK[def.id] }}>
            {best ? `Best today: ${fmtPoints(best.score)} points on ${DIFF_LABEL[best.difficulty].toLowerCase()}`
              : st.kind === 'solved' ? 'Solved today'
                : st.kind === 'in_progress' ? 'Today’s board is under way'
                  : 'Today’s board is waiting'}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[20px] p-3.5" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${c} 14%, var(--color-raised)), var(--color-raised) 70%)`, border: `1.5px solid color-mix(in srgb, ${c} 35%, transparent)` }}>
        <div className="flex items-baseline justify-between px-0.5">
          <span className="text-[15px] font-bold">Today’s board</span>
          <span className="text-[11.5px] text-ink-2">Counts for the contest</span>
        </div>
        <div className="mt-2.5 flex gap-2">
          {DIFFS.map((d) => <DifficultyChip key={d} game={def.id} today={today} difficulty={d} state={states[d]} />)}
        </div>
      </div>

      <div className="mt-3 rounded-[20px] border border-line-minor bg-raised p-3.5">
        <div className="flex items-baseline justify-between px-0.5">
          <span className="text-[15px] font-bold">A new board</span>
          <span className="text-[11.5px] text-ink-2">Practice, points for your score</span>
        </div>
        <div className="mt-2.5 flex gap-2">
          {DIFFS.map((d) => (
            <Link key={d} to={`/practice/${def.id}/${d}`} className="pb-key mb-[3px] flex h-[44px] flex-grow basis-0 items-center justify-center rounded-[13px] bg-raised-2 text-[13px] font-semibold text-ink-2">
              {DIFF_LABEL[d]}
            </Link>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/** What opens when the pinball box is tapped: the table, a level, and your best at each. */
function PinballSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet label="Pinball" onClose={onClose}>
      <div className="relative mt-10 overflow-hidden rounded-[20px] pb-wood p-[6px]">
        <div className="relative overflow-hidden rounded-[15px]">
          <img src={pinballHero} alt="The Crown Quest pinball table" className="block h-[210px] w-full object-cover object-[50%_22%]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgb(12_8_30/0.92)] to-transparent px-3.5 pb-3 pt-10">
            <div className="text-[24px] font-bold leading-tight text-[#FFE6A8] [font-family:Georgia,serif] [text-shadow:0_2px_0_rgb(40_20_5)]">Crown Quest</div>
            <div className="text-[12.5px] text-[#E9D6B2]">Pinball · ramps, locks and multiball</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] p-3.5" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${PINBALL_COLOUR} 14%, var(--color-raised)), var(--color-raised) 70%)`, border: `1.5px solid color-mix(in srgb, ${PINBALL_COLOUR} 35%, transparent)` }}>
        <div className="flex items-baseline justify-between px-0.5">
          <span className="text-[15px] font-bold">Pick a level</span>
          <span className="text-[11.5px] text-ink-2">Your best on each</span>
        </div>
        <div className="mt-2.5 flex gap-2">
          {PINBALL_LEVELS.map((lv) => {
            const hi = pinballHigh(lv);
            return (
              <Link
                key={lv}
                to={`/arcade/pinball/${lv}`}
                className="pb-key mb-[3px] flex h-[62px] flex-grow basis-0 flex-col items-center justify-center gap-[3px] rounded-[13px]"
                style={lv === 'normal'
                  ? { background: 'linear-gradient(160deg, #7B6BE0, #4C3DAE)', color: '#fff', ['--key-side' as string]: '#2F2477' }
                  : { background: 'linear-gradient(160deg, var(--color-raised), var(--color-raised-2))' }}
              >
                <span className="text-[14px] font-bold leading-none">{DIFF_LABEL[lv]}</span>
                <span className={`text-[10.5px] font-semibold leading-none tabular-nums ${lv === 'normal' ? 'opacity-90' : 'text-ink-2'}`}>{hi ? fmtPoints(hi) : 'Play'}</span>
              </Link>
            );
          })}
        </div>
        <ul className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[10.5px] leading-snug text-ink-2">
          {PINBALL_LEVELS.map((lv) => <li key={lv}>{PINBALL_LEVEL_NOTE[lv]}</li>)}
        </ul>
      </div>

      <div className="mt-3 rounded-[20px] border border-line-minor bg-raised p-3.5 text-[12.5px] leading-relaxed text-ink-2">
        <b className="text-ink">How to play.</b> Tap the left or right half of the screen to flip. Hold the right side to pull the plunger and let go to launch. On a keyboard: Z and M (or the arrows) flip, Space launches.
      </div>
    </Sheet>
  );
}

/**
 * A card comes alive under the mouse, or under a finger that rests on it: it
 * lifts and grows, glows in its game's colour, a light sweeps across, and a
 * soft sound invites you in. On touch it waits a moment, so a finger that is
 * only scrolling past (the browser cancels that touch) never sets it off.
 */
function useCardLive(index: number) {
  const [live, setLive] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const on = useRef(false);
  const set = (v: boolean) => { on.current = v; setLive(v); };
  const wake = () => { if (!on.current) playInvite(index); set(true); };
  const clear = () => { window.clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => clear, []);
  const handlers = {
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') wake(); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') { clear(); set(false); } },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      clear();
      timer.current = window.setTimeout(() => { timer.current = undefined; wake(); }, 90);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      if (timer.current !== undefined) { clear(); wake(); }
      timer.current = window.setTimeout(() => set(false), 420);
    },
    onPointerCancel: (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') { clear(); set(false); } },
    onFocus: () => wake(),
    onBlur: (e: React.FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) set(false); },
  };
  return { live, handlers };
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

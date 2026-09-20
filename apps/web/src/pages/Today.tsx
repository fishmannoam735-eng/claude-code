import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchPlaysForDate, fetchStreaks } from '@pb/data';
import { localDateKey, makeSeed, type Difficulty, type GameId } from '@pb/engine';
import { Icon } from '../components/Icon';
import { fmtDate, fmtTime, DIFF_LABEL } from '../lib/format';
import { supabase, useSession } from '../lib/session';
import { readJSON } from '../lib/storage';
import type { Snapshot as NineSnapshot } from '../games/nine/store';
import type { Snapshot as EclipseSnapshot } from '../games/eclipse/store';
import type { Snapshot as CrownsSnapshot } from '../games/crowns/store';
import type { Snapshot as ThreadSnapshot } from '../games/thread/store';
import { localKey } from '../lib/persistence';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

const GAME_NAMES: Record<string, string> = { nine: 'Nine', eclipse: 'Eclipse', crowns: 'Crowns', thread: 'Thread' };

/** Everything except Nine, which gets the hero card of its own above. */
const SIDE_GAMES = [
  { id: 'eclipse' as const, name: 'Eclipse', blurb: 'Suns and moons · quick', Glyph: Icon.Eclipse },
  { id: 'crowns' as const, name: 'Crowns', blurb: 'One crown per colour · quick', Glyph: Icon.Crown },
  { id: 'thread' as const, name: 'Thread', blurb: 'One line, every cell · quick', Glyph: Icon.Thread },
];

interface TileState { status: 'none' | 'in_progress' | 'solved'; elapsedMs: number; placed: number }

type AnySnapshot = NineSnapshot | EclipseSnapshot | CrownsSnapshot | ThreadSnapshot;

/** How far along a snapshot is, whichever shape it happens to be. */
function progressOf(s: AnySnapshot): number {
  if ('path' in s) return s.path.length;
  return s.grid.filter((v) => v !== 0).length;
}

function localState(gameId: GameId, seed: string): TileState {
  const s = readJSON<AnySnapshot>(localKey(gameId, seed));
  if (!s) return { status: 'none', elapsedMs: 0, placed: 0 };
  return { status: s.status, elapsedMs: s.elapsedMs, placed: progressOf(s) };
}

export function Today() {
  const today = localDateKey();
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);
  const [streak, setStreak] = useState<number | null>(null);
  const [states, setStates] = useState<Record<Difficulty, TileState>>(() => ({
    easy: localState('nine', makeSeed('nine', today, 'easy')),
    normal: localState('nine', makeSeed('nine', today, 'normal')),
    hard: localState('nine', makeSeed('nine', today, 'hard')),
  }));
  const [sideStates, setSideStates] = useState<Record<'eclipse' | 'crowns' | 'thread', TileState>>(() => ({
    eclipse: localState('eclipse', makeSeed('eclipse', today, 'normal')),
    crowns: localState('crowns', makeSeed('crowns', today, 'normal')),
    thread: localState('thread', makeSeed('thread', today, 'normal')),
  }));

  useEffect(() => {
    if (!supabase || !userId) return;
    void fetchStreaks(supabase, userId).then((rows) => setStreak(rows.find((r) => r.game_id === 'nine')?.current ?? 0)).catch(() => {});
    void fetchPlaysForDate(supabase, userId, today).then((rows) => {
      setSideStates((prev) => {
        const next = { ...prev };
        for (const g of ['eclipse', 'crowns', 'thread'] as const) {
          const row = rows.find((r) => r.game_id === g && r.difficulty === 'normal');
          if (!row) continue;
          const snap = row.state as AnySnapshot | null;
          next[g] = {
            status: row.status === 'solved' ? 'solved' : 'in_progress',
            elapsedMs: row.duration_ms ?? 0,
            placed: snap ? progressOf(snap) : 0,
          };
        }
        return next;
      });
    }).catch(() => {});
    void fetchPlaysForDate(supabase, userId, today).then((rows) => {
      setStates((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (row.game_id !== 'nine') continue;
          const d = row.difficulty;
          const snap = row.state as AnySnapshot | null;
          const remote: TileState = {
            status: row.status === 'solved' ? 'solved' : 'in_progress',
            elapsedMs: row.duration_ms ?? 0,
            placed: snap ? progressOf(snap) : 0,
          };
          const local = prev[d];
          if (local.status === 'none' || (remote.status === 'solved' && local.status !== 'solved') || remote.elapsedMs > local.elapsedMs) next[d] = remote;
        }
        return next;
      });
    }).catch(() => {});
  }, [userId, today]);

  const normal = states.normal;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-4 pb-8">
      <header className="flex items-end justify-between pb-3 pt-5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Puzzle Break</div>
          <div className="text-[13px] text-ink-2">{fmtDate(today)}</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line-minor bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-text" title="Current streak">
          <Icon.Flame width={14} height={14} />
          <span>{streak ?? (sessionStatus === 'offline' ? '–' : '…')}</span>
        </div>
      </header>

      {sessionStatus === 'offline' && (
        <div className="mb-3 rounded-xl border border-line-minor bg-raised px-3 py-2 text-[12px] text-ink-2">
          Playing offline — progress is saved on this device only.
        </div>
      )}

      <Link to={`/g/${makeSeed('nine', today, 'normal')}`} className="block rounded-[18px] border border-line-minor bg-raised p-[18px] shadow-[0_1px_2px_rgba(26,24,20,0.04),0_8px_20px_rgba(26,24,20,0.05)]">
        <div className="flex items-start gap-3.5">
          <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[14px] bg-raised-2 text-accent-text">
            <Icon.Grid width={28} height={28} strokeWidth={1.6} />
          </div>
          <div className="flex flex-grow flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[19px] font-bold tracking-tight">Nine</span>
              <span className="rounded-full border border-line-minor px-2 py-0.5 text-[11px] font-semibold text-ink-2">NORMAL</span>
            </div>
            <div className="text-[13px] text-ink-2">9×9 sudoku · the long one</div>
          </div>
          {normal.status === 'solved' && <span className="flex items-center gap-1 text-[15px] font-semibold text-success"><Icon.Check width={16} height={16} /> {fmtTime(normal.elapsedMs)}</span>}
          {normal.status === 'in_progress' && <span className="text-[15px] font-semibold text-accent-text">{fmtTime(normal.elapsedMs)}</span>}
        </div>
        <div className="mt-4">
          <div className="h-[5px] w-full overflow-hidden rounded-full bg-raised-2">
            <div className={`h-full rounded-full ${normal.status === 'solved' ? 'bg-success' : 'bg-accent'}`} style={{ width: `${Math.round((normal.placed / 81) * 100)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[12px] text-ink-2">
            <span>{normal.status === 'none' ? 'Not started' : `${normal.placed} of 81 placed`}</span>
            <span className="font-semibold text-accent-text">{normal.status === 'solved' ? 'Solved' : normal.status === 'in_progress' ? 'Resume' : 'Play'}</span>
          </div>
        </div>
      </Link>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {(['easy', 'hard'] as Difficulty[]).map((d) => {
          const st = states[d];
          return (
            <Link key={d} to={`/g/${makeSeed('nine', today, d)}`} className="flex items-center justify-between rounded-2xl border border-line-minor bg-raised px-4 py-3">
              <span className="text-[14px] font-semibold">Nine · {DIFF_LABEL[d]}</span>
              <span className={`text-[12px] font-semibold ${st.status === 'solved' ? 'text-success' : 'text-ink-2'}`}>
                {st.status === 'solved' ? fmtTime(st.elapsedMs) : st.status === 'in_progress' ? 'Resume' : 'Play'}
              </span>
            </Link>
          );
        })}
      </div>

      {SIDE_GAMES.map(({ id, name, blurb, Glyph }) => (
        <div key={id}>
          <Link
            to={`/g/${makeSeed(id, today, 'normal')}`}
            className="mt-3 flex items-center gap-3.5 rounded-[18px] border border-line-minor bg-raised p-4"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
              <Glyph width={24} height={24} />
            </div>
            <div className="flex flex-grow flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold">{name}</span>
                <span className="rounded-full border border-line-minor px-2 py-0.5 text-[10px] font-semibold text-ink-2">NORMAL</span>
              </div>
              <span className="text-[12px] text-ink-2">{blurb}</span>
            </div>
            <span className={`text-[13px] font-semibold ${sideStates[id].status === 'solved' ? 'text-success' : 'text-accent-text'}`}>
              {sideStates[id].status === 'solved'
                ? fmtTime(sideStates[id].elapsedMs)
                : sideStates[id].status === 'in_progress' ? 'Resume' : 'Play'}
            </span>
          </Link>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(['easy', 'hard'] as Difficulty[]).map((d) => (
              <Link key={d} to={`/g/${makeSeed(id, today, d)}`} className="flex items-center justify-between rounded-2xl border border-line-minor bg-raised px-4 py-3">
                <span className="text-[14px] font-semibold">{name} · {DIFF_LABEL[d]}</span>
                <span className="text-[12px] font-semibold text-ink-2">Play</span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-6 text-[11px] font-bold tracking-wider text-ink-2">COMING SOON</div>
      <div className="mt-2 grid grid-cols-2 gap-3 opacity-60">
        {[['Quilt', Icon.Quilt]].map(([name, I]) => {
          const IconC = I as typeof Icon.Crown;
          return (
            <div key={name as string} className="flex h-[120px] flex-col justify-between rounded-[18px] border border-dashed border-line-minor bg-raised p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-raised-2 text-ink-2"><IconC width={24} height={24} /></div>
              <div className="text-[15px] font-bold">{name as string}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-line-minor bg-raised p-4">
        <div className="text-[14px] font-bold">Practice</div>
        <div className="text-[12px] text-ink-2">Unlimited puzzles, any difficulty. They don't count toward your streak.</div>
        {(['nine', 'eclipse', 'crowns', 'thread'] as const).map((g) => (
          <div key={g} className="mt-3">
            <div className="mb-1.5 text-[11px] font-semibold text-ink-2">{GAME_NAMES[g]}</div>
            <div className="grid grid-cols-3 gap-2">
              {DIFFS.map((d) => (
                <Link key={d} to={`/practice/${g}/${d}`} className="flex h-11 items-center justify-center rounded-xl border border-line-minor bg-raised-2 text-[13px] font-semibold text-ink">
                  {DIFF_LABEL[d]}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchContestStats, fetchLeaderboard, type ContestStats, type Period, type RankRow } from '@pb/data';
import { localDateKey, type GameId } from '@pb/engine';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { GAME_COLOR, GameTile } from '../components/GameMark';
import { BarChart, MeterRow, SplitBar, StatTile } from '../components/Charts';
import crownUrl from '../games/crowns/assets/crown.webp';
import { fmtTime, DIFF_LABEL } from '../lib/format';
import { supabase, useSession } from '../lib/session';
import { GAME_NAME, fmtPoints, ordinal, useMe } from '../lib/contest';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'all', label: 'All time' },
];
const GAMES: GameId[] = ['nine', 'eclipse', 'crowns', 'thread', 'quilt'];

const shortDay = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export function Rankings() {
  const today = localDateKey();
  const userId = useSession((s) => s.userId);
  const sessionStatus = useSession((s) => s.status);
  const [period, setPeriod] = useState<Period>('day');
  const [game, setGame] = useState<GameId | null>(null);
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [stats, setStats] = useState<ContestStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!supabase || sessionStatus === 'loading') return;
    let alive = true;
    setRows(null);
    fetchLeaderboard(supabase, period, today, game, 50)
      .then((r) => { if (alive) { setRows(r); setFailed(false); } })
      .catch(() => { if (alive) { setRows([]); setFailed(true); } });
    return () => { alive = false; };
  }, [period, game, today, userId, sessionStatus]);

  useEffect(() => {
    if (!supabase || sessionStatus === 'loading') return;
    fetchContestStats(supabase, today).then(setStats).catch(() => setFailed(true));
    void useMe.getState().refresh();
  }, [today, userId, sessionStatus]);

  const top = rows?.filter((r) => r.rank <= 3) ?? [];
  const rest = rows?.filter((r) => r.rank > 3) ?? [];
  const me = rows?.find((r) => r.is_me) ?? null;

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: 'radial-gradient(120% 70% at 50% -10%, color-mix(in srgb, var(--color-accent) 24%, transparent) 0%, transparent 70%)' }}
      />
      <div className="relative mx-auto flex w-full max-w-[440px] flex-col px-4 pb-14">
        <header className="pb-rise flex items-center gap-3 pb-4 pt-5">
          <Link to="/" aria-label="Back to today" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-minor bg-raised text-ink">
            <Icon.Back />
          </Link>
          <div className="flex-grow">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent-text">Public contest</div>
            <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">Rankings</h1>
          </div>
          <MeChip />
        </header>

        {!supabase || sessionStatus === 'offline' ? (
          <Notice text="Rankings need an internet connection. Your games still save on this phone." />
        ) : (
          <>
            <section className="pb-rise pb-wood rounded-[20px] p-2.5" style={{ ['--d' as string]: '40ms' }}>
              <div className="grid grid-cols-3 gap-1.5 rounded-[12px] p-1" style={{ background: '#5C4028', boxShadow: 'inset 0 2px 6px rgb(30 18 8 / 0.65)' }} role="tablist" aria-label="Period">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={period === p.id}
                    onClick={() => setPeriod(p.id)}
                    className="pb-key h-10 rounded-[9px] text-[13.5px] font-bold"
                    style={period === p.id
                      ? { background: 'linear-gradient(160deg, #FFF3CF 0%, #F6D98A 45%, #E8B44A 100%)', color: '#4E2E04', ['--key-side' as string]: '#9A6410' }
                      : { background: 'linear-gradient(135deg, rgb(255 251 240), rgb(232 220 196))', color: '#6B5638', ['--key-side' as string]: 'rgb(150 130 100)' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Game">
                <FilterChip on={game === null} onClick={() => setGame(null)}>All games</FilterChip>
                {GAMES.map((g) => (
                  <FilterChip key={g} on={game === g} onClick={() => setGame(g)}>
                    <GameTile game={g} className="h-5 w-5 rounded-[6px]" /> {GAME_NAME[g]}
                  </FilterChip>
                ))}
              </div>
            </section>

            <p className="pb-rise mt-2.5 px-1 text-[12px] leading-snug text-ink-2" style={{ ['--d' as string]: '80ms' }}>
              {period === 'day' ? 'Everyone plays the same boards today. Your first daily board of each game is your entry.'
                : period === 'week' ? 'Contest points from the last seven days.' : 'Every contest point since the start.'}
              {' '}Hints, mistakes and Fill cost points.
            </p>

            {rows === null ? (
              <div className="mt-6 flex justify-center text-ink-2"><span className="pb-spin-slow text-[13px]">Loading…</span></div>
            ) : rows.length === 0 ? (
              <EmptyBoard failed={failed} period={period} />
            ) : (
              <>
                <Podium rows={top} />
                {me && me.rank > 3 && <YouCard row={me} period={period} />}
                <ol className="mt-3 flex flex-col gap-1.5" aria-label="Ranking">
                  {rest.map((r, i) => <RankLine key={`${r.rank}-${r.nickname}`} row={r} index={i} />)}
                </ol>
              </>
            )}

            {stats && <Infographics stats={stats} />}
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-transform active:scale-95 ${on ? 'bg-[#FFF4E2] text-[#4E2E04] shadow-[0_2px_0_rgb(60_30_5/0.45)]' : 'bg-[rgb(255_244_226/0.16)] text-[#FFF4E2]'}`}
    >
      {children}
    </button>
  );
}

export function MeChip() {
  const stats = useMe((s) => s.stats);
  if (!stats) return null;
  return (
    <Link to="/me" aria-label="Your profile" className="flex items-center gap-2 rounded-full border border-line-minor bg-raised py-1 pl-1 pr-3 shadow-[0_4px_12px_-6px_rgb(120_80_20/0.5)]">
      <Avatar name={stats.nickname} colour={stats.avatar} size={28} />
      <span className="text-[13px] font-bold tabular-nums text-accent-text">{fmtPoints(stats.personalScore)}</span>
    </Link>
  );
}

function Notice({ text }: { text: string }) {
  return <div className="mt-3 rounded-xl bg-raised-2/70 px-3 py-2.5 text-[13px] text-ink-2">{text}</div>;
}

function EmptyBoard({ failed, period }: { failed: boolean; period: Period }) {
  return (
    <div className="pb-rise mt-4 flex flex-col items-center rounded-[20px] border border-line-minor bg-raised px-5 py-7 text-center">
      <img src={crownUrl} alt="" className="pb-float h-12 w-12" />
      <div className="mt-2 text-[16px] font-bold">{failed ? 'Could not load the rankings' : 'The top spot is free'}</div>
      <p className="mt-1 text-[13px] text-ink-2">
        {failed ? 'Check your connection and try again.'
          : period === 'day' ? "Nobody has finished today's boards yet. Solve one and you lead." : 'No contest solves here yet. Be the first.'}
      </p>
      {!failed && <Link to="/" className="pb-key mt-4 rounded-xl bg-accent px-5 py-2.5 text-[14px] font-bold text-ink" style={{ ['--key-side' as string]: '#94621C' }}>Play today&apos;s boards</Link>}
    </div>
  );
}

/** First, second and third standing on wooden blocks; the winner wears the crown. */
function Podium({ rows }: { rows: RankRow[] }) {
  const order: { row: RankRow | undefined; place: 1 | 2 | 3; h: number; d: number }[] = [
    { row: rows[1], place: 2, h: 86, d: 220 },
    { row: rows[0], place: 1, h: 116, d: 80 },
    { row: rows[2], place: 3, h: 66, d: 340 },
  ];
  return (
    <section className="mt-10 grid grid-cols-3 items-end gap-2" aria-label="Top three">
      {order.map(({ row, place, h, d }) => (
        <div key={place} className="flex min-w-0 flex-col items-center">
          {row ? (
            <div className="pb-drop relative flex min-w-0 max-w-full flex-col items-center px-1" style={{ ['--d' as string]: `${d + 300}ms` }}>
              {place === 1 && <img src={crownUrl} alt="" className="pb-float absolute -top-7 h-8 w-8" style={{ filter: 'drop-shadow(0 3px 3px rgb(90 60 10 / 0.35))' }} />}
              <Avatar name={row.nickname} colour={row.avatar} size={place === 1 ? 58 : 46} ring={row.is_me ? 'var(--color-accent)' : undefined} />
              <span className="mt-1.5 w-full truncate text-center text-[12.5px] font-bold">{row.is_me ? 'You' : row.nickname}</span>
              <span className="text-[12px] font-semibold tabular-nums text-accent-text">{fmtPoints(row.score)} pts</span>
            </div>
          ) : (
            <div className="text-[11px] text-ink-2">open</div>
          )}
          <div className="mt-1.5 w-full overflow-hidden rounded-t-[12px]" style={{ height: h }}>
            <div className="pb-podium pb-wood flex h-full flex-col items-center justify-start rounded-t-[12px] pt-2" style={{ ['--d' as string]: `${d}ms` }}>
              <span className={`pb-medal-${place} flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-extrabold`}>{row?.rank ?? place}</span>
              {row && <span className="mt-1.5 text-[10.5px] font-semibold text-[#FBE9CC]">{row.solves} solve{row.solves === 1 ? '' : 's'}</span>}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function YouCard({ row, period }: { row: RankRow; period: Period }) {
  return (
    <div className="pb-rise mt-3 flex items-center gap-3 rounded-[16px] border border-[color-mix(in_srgb,var(--color-accent)_45%,transparent)] bg-accent-soft px-3.5 py-2.5" style={{ ['--d' as string]: '500ms' }}>
      <Avatar name={row.nickname} colour={row.avatar} size={36} />
      <div className="flex-grow">
        <div className="text-[14px] font-bold">You are {ordinal(row.rank)}</div>
        <div className="text-[12px] text-ink-2">{period === 'day' ? 'today' : period === 'week' ? 'this week' : 'of all time'} · {row.solves} solve{row.solves === 1 ? '' : 's'}</div>
      </div>
      <span className="text-[17px] font-extrabold tabular-nums text-accent-text">{fmtPoints(row.score)}</span>
    </div>
  );
}

function RankLine({ row, index }: { row: RankRow; index: number }) {
  return (
    <li
      className={`pb-rise flex items-center gap-3 rounded-[14px] border px-3 py-2 ${row.is_me ? 'border-accent bg-accent-soft' : 'border-line-minor bg-raised'}`}
      style={{ ['--d' as string]: `${420 + Math.min(index, 12) * 40}ms` }}
    >
      <span className="w-7 text-center text-[14px] font-extrabold tabular-nums text-ink-2">{row.rank}</span>
      <Avatar name={row.nickname} colour={row.avatar} size={32} />
      <div className="min-w-0 flex-grow">
        <div className="truncate text-[14px] font-bold">{row.is_me ? `${row.nickname} (you)` : row.nickname}</div>
        <div className="text-[11.5px] text-ink-2">
          {row.solves} solve{row.solves === 1 ? '' : 's'} · {row.hintless} without hints · {fmtTime(row.total_ms)}
        </div>
      </div>
      <span className="text-[15px] font-extrabold tabular-nums">{fmtPoints(row.score)}</span>
    </li>
  );
}

/** The day in numbers, then how each game went, then who keeps winning. */
function Infographics({ stats }: { stats: ContestStats }) {
  const t = stats.today;
  const byGame = new Map(stats.games.map((g) => [g.game, g]));
  return (
    <section className="mt-8" aria-label="Contest statistics">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="flex items-center gap-2 text-[18px] font-bold tracking-tight"><Icon.Chart width={18} height={18} /> Today in numbers</h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <StatTile value={t.players} label="Players" delay={80} />
        <StatTile value={t.solves} label="Contest solves" delay={140} />
        <StatTile value={fmtPoints(t.avgScore)} label="Average points" delay={200} />
        <StatTile value={`${t.hintFreePct}%`} label="Solved without hints" delay={260} />
      </div>

      <Card delay={120}>
        <BarChart
          title="Players, last 14 days"
          ariaLabel="Players and solves per day over the last 14 days"
          height={110}
          data={stats.trend.map((d) => ({
            key: d.date,
            label: shortDay(d.date),
            segments: [{ value: d.players, colour: 'var(--color-accent)', name: d.players === 1 ? 'player' : 'players' }],
          }))}
        />
      </Card>

      <Card delay={160} title="Each game today">
        <div className="flex flex-col gap-3.5">
          {GAMES.map((g, k) => {
            const s = byGame.get(g);
            const started = s?.started ?? 0;
            const solved = s?.solved ?? 0;
            const rate = started ? Math.round((solved / started) * 100) : 0;
            return (
              <MeterRow
                key={g}
                delay={k * 80}
                icon={<GameTile game={g} className="h-9 w-9 rounded-[10px]" />}
                label={GAME_NAME[g]}
                value={solved}
                max={started}
                colour={GAME_COLOR[g]}
                right={started ? `${rate}% solved` : 'no plays yet'}
                sub={s ? (
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span>{solved} of {started} boards finished</span>
                    {s.avgMs !== null && <span>· avg {fmtTime(s.avgMs)}</span>}
                    <span>· {s.hintPct}% used hints</span>
                    {s.best && (
                      <span className="flex items-center gap-1">· top <Avatar name={s.best.nickname} colour={s.best.avatar} size={14} />
                        <b className="text-ink">{s.best.nickname}</b> {fmtTime(s.best.ms)} on {DIFF_LABEL[s.best.difficulty as 'easy'].toLowerCase()}
                      </span>
                    )}
                  </span>
                ) : undefined}
              />
            );
          })}
        </div>
      </Card>

      <Card delay={200} title="Boards chosen this week">
        <SplitBar parts={[
          { name: 'Easy', value: stats.difficulty.easy, colour: '#F2DDB0', ink: '#5A3E10' },
          { name: 'Normal', value: stats.difficulty.normal, colour: '#D9A54E', ink: '#3A2606' },
          { name: 'Hard', value: stats.difficulty.hard, colour: '#94621C', ink: '#FFF4E2' },
        ]} />
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
        <Card delay={240} title="Most daily wins" flush>
          <PeopleList
            empty="No winners yet."
            items={stats.champions.map((c) => ({ ...c, value: `${c.wins} win${c.wins === 1 ? '' : 's'}` }))}
            medal
          />
        </Card>
        <Card delay={280} title="Longest streaks" flush>
          <PeopleList
            empty="No streaks yet."
            items={stats.streaks.map((s) => ({ ...s, value: <span className="flex items-center gap-0.5"><Icon.Flame width={13} height={13} className="text-[#E07A1F]" />{s.current}</span> }))}
          />
        </Card>
      </div>
    </section>
  );
}

function Card({ title, children, delay = 0, flush }: { title?: string; children: React.ReactNode; delay?: number; flush?: boolean }) {
  return (
    <div
      className={`pb-rise ${flush ? '' : 'mt-3'} rounded-[18px] border border-line-minor bg-raised p-3.5 shadow-[0_8px_24px_-14px_rgb(60_40_20/0.35)]`}
      style={{ ['--d' as string]: `${delay}ms` }}
    >
      {title && <h3 className="mb-3 text-[13px] font-semibold">{title}</h3>}
      {children}
    </div>
  );
}

function PeopleList({ items, empty, medal }: {
  items: { nickname: string; avatar: number; isMe?: boolean; value: React.ReactNode }[]; empty: string; medal?: boolean;
}) {
  if (!items.length) return <div className="text-[12.5px] text-ink-2">{empty}</div>;
  return (
    <ol className="flex flex-col gap-2">
      {items.map((p, i) => (
        <li key={p.nickname} className="flex items-center gap-2">
          {medal && i < 3
            ? <span className={`pb-medal-${i + 1} flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-extrabold`}>{i + 1}</span>
            : <span className="w-5 text-center text-[12px] font-bold text-ink-2">{i + 1}</span>}
          <Avatar name={p.nickname} colour={p.avatar} size={24} />
          <span className={`min-w-0 flex-grow truncate text-[13px] ${p.isMe ? 'font-bold text-accent-text' : 'font-semibold'}`}>{p.isMe ? 'You' : p.nickname}</span>
          <span className="text-[12.5px] font-bold tabular-nums">{p.value}</span>
        </li>
      ))}
    </ol>
  );
}

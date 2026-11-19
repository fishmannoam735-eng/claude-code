import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchContestStats, fetchLeaderboard, type ContestStats, type RankRow } from '@pb/data';
import { localDateKey } from '@pb/engine';
import { Avatar } from './Avatar';
import { Podium } from './Podium';
import { supabase, useSession } from '../lib/session';
import { readJSON, writeJSON } from '../lib/storage';
import { fmtPoints, ordinal } from '../lib/contest';

/**
 * Today's leaders on the home page, as a calm scoreboard: a live dot, the
 * top three in a clean row, where you stand and how far it is to the next
 * place up, and yesterday's champion as a footnote. The jokes are in the
 * words, not the decoration. Only opacity and transform animate, gently.
 *
 * The board is kept on this device too, so the box is never empty just
 * because the signal is weak: it shows the last board it saw until the
 * live one arrives.
 */
const CACHE = 'pb:leaders';
interface Cached { date: string; rows: RankRow[]; stats: ContestStats | null }

// One line under the title, a different one each day.
const TAGLINES = [
  'Ranked by points, not by vibes.',
  'Serious competition. Unserious prizes.',
  'Glory is temporary. Screenshots are forever.',
  'No trophies were harmed in the making of this list.',
  'The prize is bragging rights. Use them responsibly.',
  'It’s just a puzzle game. (It is not just a puzzle game.)',
  'Updated live, judged silently.',
];

const dayIndex = (key: string): number => [...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7);

export function LeadersStage() {
  const today = localDateKey();
  const userId = useSession((s) => s.userId);
  const status = useSession((s) => s.status);
  const cached = readJSON<Cached>(CACHE);
  const fresh = cached?.date === today ? cached : null;
  const [rows, setRows] = useState<RankRow[] | null>(fresh?.rows ?? null);
  const [stats, setStats] = useState<ContestStats | null>(fresh?.stats ?? null);

  useEffect(() => {
    if (!supabase || status !== 'online') return;
    let alive = true;
    void Promise.all([
      fetchLeaderboard(supabase, 'day', today, null, 50),
      fetchContestStats(supabase, today).catch(() => null),
    ]).then(([r, s]) => {
      if (!alive) return;
      setRows(r);
      if (s) setStats(s);
      // Keep only what this box shows: the top three, you, and the place above you.
      const me = r.find((x) => x.is_me);
      const keep = r.filter((x) => x.rank <= 3 || x.is_me || (me && x === above(r, me)));
      writeJSON(CACHE, { date: today, rows: keep, stats: s ?? stats } satisfies Cached);
    }).catch(() => { if (alive) setRows((x) => x ?? []); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, userId, status]);

  const top = (rows ?? []).filter((r) => r.rank <= 3).slice(0, 3);
  const me = rows?.find((r) => r.is_me) ?? null;
  const next = me && rows ? above(rows, me) : null;
  const players = stats?.today.players ?? null;
  const champ = stats?.yesterday ?? null;
  const tagline = TAGLINES[dayIndex(today) % TAGLINES.length]!;

  return (
    <section
      className="pb-rise relative mt-3 overflow-hidden rounded-[20px] border border-line-minor bg-raised px-4 pb-3.5 pt-3.5 shadow-[0_1px_0_rgb(120_90_50/0.12),0_12px_28px_-16px_rgb(60_40_20/0.45)]"
      style={{ ['--d' as string]: '120ms' }}
      aria-label="Today's leaders"
    >
      {/* A single thin line of gold along the top edge: the only ornament. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent) 30%, var(--color-accent) 70%, transparent)' }} />

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-danger">
            <span className="relative flex h-2 w-2">
              <span aria-hidden="true" className="pb-live-ping absolute inset-0 rounded-full bg-danger" />
              <span className="relative h-2 w-2 rounded-full bg-danger" />
            </span>
            Live
            {players ? <span className="font-semibold normal-case tracking-normal text-ink-2">· {players} {players === 1 ? 'player' : 'players'}</span> : null}
          </div>
          <h2 className="mt-0.5 text-[19px] font-extrabold leading-tight tracking-[-0.015em] text-ink">Today&apos;s leaderboard</h2>
          <p className="mt-0.5 text-[12.5px] italic leading-snug text-ink-2">{tagline}</p>
        </div>
        <Link to="/rankings" className="mt-1 flex-shrink-0 rounded-full border border-line-major px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:bg-raised-2">
          Full rankings →
        </Link>
      </header>

      <Podium top={top} />

      {/* Where you stand. */}
      <div className="pb-fade-up mt-3 text-[13px] leading-snug text-ink" style={{ ['--d' as string]: '620ms' }}>
        <YourLine rows={rows} me={me} next={next} offline={status === 'offline'} />
      </div>

      {champ && (
        <p className="pb-fade-up mt-2.5 flex items-start gap-2 border-t border-line-minor pt-2.5 text-[12px] text-ink-2" style={{ ['--d' as string]: '720ms' }}>
          <Avatar name={champ.nickname} colour={champ.avatar} photo={champ.photo} size={22} />
          <span className="min-w-0 leading-snug">
            Yesterday&apos;s champion: <b className="font-semibold text-ink">{champ.isMe ? 'you' : champ.nickname}</b>, {fmtPoints(champ.score)} pts.
            {' '}{champ.isMe ? 'We know. You’ve mentioned it.' : 'Still talking about it.'}
          </span>
        </p>
      )}
    </section>
  );
}

/** The player just above you, if there is one. */
function above(rows: RankRow[], me: RankRow): RankRow | null {
  let best: RankRow | null = null;
  for (const r of rows) {
    if (r.is_me || r.score <= me.score) continue;
    if (!best || r.score < best.score) best = r;
  }
  return best;
}

function YourLine({ rows, me, next, offline }: { rows: RankRow[] | null; me: RankRow | null; next: RankRow | null; offline: boolean }) {
  if (rows === null) {
    return <span className="text-ink-2">{offline ? 'Looking for the internet. The leaders will be right here when it turns up.' : 'Counting points. Recounting points.'}</span>;
  }
  if (!rows.length) {
    return <>Nobody has scored yet. First place is free, <span className="text-ink-2">which never happens.</span> Solve today&apos;s daily board to take it.</>;
  }
  if (!me) {
    return <>You&apos;re not on the board yet. <span className="text-ink-2">Solve today&apos;s daily board to join; the leaders are pretending not to notice.</span></>;
  }
  if (me.rank === 1) {
    return (
      <>
        You&apos;re <b className="text-accent-text">1st</b> with {fmtPoints(me.score)} points. <span className="text-ink-2">Act natural. Play a new board to stay there.</span>
      </>
    );
  }
  const gap = next ? next.score - me.score : null;
  const pct = next ? Math.max(4, Math.min(100, Math.round((me.score / next.score) * 100))) : 0;
  return (
    <div>
      <div>
        You&apos;re <b className="text-accent-text">{ordinal(me.rank)}</b> with {fmtPoints(me.score)} points.
        {gap !== null && next ? (
          <span className="text-ink-2"> {fmtPoints(gap)} behind {next.is_me ? 'yourself, somehow' : next.nickname}. Play a new board to climb.</span>
        ) : <span className="text-ink-2"> Play a new board to climb.</span>}
      </div>
      {next && (
        <div className="mt-2 h-[5px] w-full overflow-hidden rounded-full bg-raised-2" aria-hidden="true">
          <div className="pb-grow h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-accent)', ['--d' as string]: '760ms' }} />
        </div>
      )}
    </div>
  );
}

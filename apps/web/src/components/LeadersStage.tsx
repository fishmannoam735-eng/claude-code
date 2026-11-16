import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchContestStats, fetchLeaderboard, type ContestStats, type RankRow } from '@pb/data';
import { localDateKey } from '@pb/engine';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import crownUrl from '../games/crowns/assets/crown.webp';
import { supabase, useSession } from '../lib/session';
import { fmtPoints, ordinal } from '../lib/contest';

/**
 * Today's leaders on the home page: a lit stage with a gold, silver and
 * bronze podium, the crown over first place, sparkles in the air, where you
 * stand, and yesterday's champion. Only transform and opacity animate.
 */
export function LeadersStage() {
  const today = localDateKey();
  const userId = useSession((s) => s.userId);
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [stats, setStats] = useState<ContestStats | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void fetchLeaderboard(supabase, 'day', today, null, 3).then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setRows([]); });
    void fetchContestStats(supabase, today).then((s) => { if (alive) setStats(s); }).catch(() => { /* fine */ });
    return () => { alive = false; };
  }, [today, userId]);

  const top = (rows ?? []).filter((r) => r.rank <= 3).slice(0, 3);
  const me = rows?.find((r) => r.is_me) ?? null;
  const players = stats?.today.players ?? null;
  const champ = stats?.yesterday ?? null;

  return (
    <section className="pb-rise pb-stage relative mt-3 overflow-hidden rounded-[22px] px-3.5 pb-3.5 pt-3" style={{ ['--d' as string]: '120ms' }} aria-label="Today's leaders">
      {/* Two spotlights sweeping slowly over the podium. */}
      <div aria-hidden="true" className="pb-spot pointer-events-none absolute -top-10 left-[12%] h-[340px] w-[120px]" style={{ ['--spot-a' as string]: '-14deg', ['--spot-b' as string]: '6deg' }} />
      <div aria-hidden="true" className="pb-spot pointer-events-none absolute -top-10 right-[12%] h-[340px] w-[120px]" style={{ ['--spot-a' as string]: '14deg', ['--spot-b' as string]: '-6deg', animationDelay: '-3s' }} />
      <Sparkles />

      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F6D98A]">Live contest</div>
          <h2 className="text-[20px] font-extrabold leading-tight tracking-tight text-[#FFF4E2]">Today&apos;s leaders</h2>
        </div>
        <Link to="/rankings" className="pb-key flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold" style={{ background: 'linear-gradient(160deg, #FFF3CF 0%, #F6D98A 45%, #E8B44A 100%)', color: '#4E2E04', ['--key-side' as string]: '#9A6410' }}>
          <Icon.Trophy width={15} height={15} /> All rankings
        </Link>
      </div>

      <div className="relative mt-9 grid grid-cols-3 items-end gap-2">
        {([[1, 2, 74, 260], [0, 1, 100, 120], [2, 3, 56, 380]] as const).map(([idx, place, h, d]) => {
          const row = top[idx];
          return (
            <div key={place} className="flex min-w-0 flex-col items-center">
              {row ? (
                <div className="pb-drop relative flex min-w-0 max-w-full flex-col items-center" style={{ ['--d' as string]: `${d + 420}ms` }}>
                  {place === 1 && <img src={crownUrl} alt="" className="pb-float absolute -top-8 h-9 w-9" style={{ filter: 'drop-shadow(0 4px 4px rgb(0 0 0 / 0.45))' }} />}
                  <Avatar name={row.nickname} colour={row.avatar} size={place === 1 ? 56 : 44} ring={row.is_me ? '#F6D98A' : undefined} />
                  <span className="mt-1.5 w-full truncate text-center text-[12.5px] font-bold text-[#FFF4E2]">{row.is_me ? 'You' : row.nickname}</span>
                  <span className="text-[12px] font-extrabold tabular-nums text-[#F6D98A]">{fmtPoints(row.score)}</span>
                </div>
              ) : (
                <div className="pb-in flex flex-col items-center opacity-80" style={{ ['--d' as string]: `${d + 300}ms` }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-[30%] border-2 border-dashed border-[rgb(246_217_138/0.55)] text-[18px] font-bold text-[#F6D98A]">+</span>
                  <span className="mt-1.5 text-[11.5px] font-semibold text-[#FBE9CC]">Open seat</span>
                </div>
              )}
              <div className="mt-1.5 w-full overflow-hidden rounded-t-[10px]" style={{ height: h }}>
                <div className={`pb-podium pb-step-${place} flex h-full flex-col items-center rounded-t-[10px] pt-2`} style={{ ['--d' as string]: `${d}ms` }}>
                  <span className="text-[22px] font-black leading-none">{place}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative -mx-3.5 h-2.5" style={{ background: 'linear-gradient(180deg, #3A2414, #241608)' }} />

      <div className="relative mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 rounded-[14px] bg-[rgb(255_244_226/0.1)] px-3 py-2 text-[#FFF4E2]">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgb(246_217_138/0.2)] text-[#F6D98A]"><Icon.User width={16} height={16} /></span>
          <span className="flex-grow text-[12.5px] font-semibold leading-snug">
            {rows === null ? 'Loading the board…'
              : me ? <>You are <b className="text-[#F6D98A]">{ordinal(me.rank)}</b>{players ? ` of ${players}` : ''} with {fmtPoints(me.score)} points. Replay any board to climb.</>
                : top.length ? 'Solve a board to join. Replay it as often as you like; your best try counts.'
                  : 'Nobody has scored yet today. Solve a board and take first place.'}
          </span>
        </div>
        {champ && (
          <div className="flex items-center gap-2.5 rounded-[14px] px-3 py-2" style={{ background: 'linear-gradient(100deg, rgb(246 217 138 / 0.28), rgb(246 217 138 / 0.08))' }}>
            <img src={crownUrl} alt="" className="h-7 w-7 flex-shrink-0" />
            <Avatar name={champ.nickname} colour={champ.avatar} size={28} />
            <span className="min-w-0 flex-grow truncate text-[12.5px] text-[#FFF4E2]">
              <span className="font-semibold opacity-80">Yesterday&apos;s champion · </span>
              <b>{champ.isMe ? 'You!' : champ.nickname}</b>
            </span>
            <span className="text-[12.5px] font-extrabold tabular-nums text-[#F6D98A]">{fmtPoints(champ.score)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/** Little gold glints that fade in and out above the podium. */
function Sparkles() {
  const spots = [[8, 30], [22, 12], [37, 26], [52, 9], [66, 24], [81, 14], [92, 34], [15, 48], [74, 44], [45, 40]];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[180px]">
      {spots.map(([x, y], i) => (
        <span
          key={i}
          className="pb-twinkle absolute block h-[7px] w-[7px]"
          style={{ left: `${x}%`, top: `${y}%`, ['--d' as string]: `${(i * 470) % 2600}ms` }}
        >
          <svg viewBox="0 0 10 10" width="7" height="7"><path d="M5 0 6 4 10 5 6 6 5 10 4 6 0 5 4 4Z" fill="#FFE7A3" /></svg>
        </span>
      ))}
    </div>
  );
}

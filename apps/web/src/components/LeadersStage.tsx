import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchContestStats, fetchLeaderboard, type ContestStats, type RankRow } from '@pb/data';
import { localDateKey } from '@pb/engine';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import crownUrl from '../games/crowns/assets/crown.webp';
import { supabase, useSession } from '../lib/session';
import { readJSON, writeJSON } from '../lib/storage';
import { fmtPoints, ordinal } from '../lib/contest';

/**
 * Today's leaders on the home page, staged like a superhero entrance: a lit
 * stage, rays bursting behind first place, the winners swooping in one by
 * one, the champion landing last with a shockwave, a cape and a crown, and
 * gold, silver and bronze medals spinning onto their ribbons. Tap the stage
 * to play it again. Only transform and opacity animate, and all of it rests
 * on its final frame under reduced motion.
 *
 * The board is kept on this device too, so the stage is never empty just
 * because the signal is weak: it shows the last board it saw until the live
 * one arrives.
 */
const CACHE = 'pb:leaders';
interface Cached { date: string; rows: RankRow[]; stats: ContestStats | null }

// Where each place flies in from, and when it lands (ms after the stage rises).
const SEATS = [
  { idx: 1, place: 2, step: 74, land: 520, from: { x: '-160%', y: '-60%', r: '-28deg' } },
  { idx: 0, place: 1, step: 100, land: 980, from: { x: '0%', y: '-260%', r: '0deg' } },
  { idx: 2, place: 3, step: 56, land: 300, from: { x: '160%', y: '-60%', r: '28deg' } },
] as const;
const CHAMP_LAND = 980 + 620;

export function LeadersStage() {
  const today = localDateKey();
  const userId = useSession((s) => s.userId);
  const status = useSession((s) => s.status);
  const cached = readJSON<Cached>(CACHE);
  const fresh = cached?.date === today ? cached : null;
  const [rows, setRows] = useState<RankRow[] | null>(fresh?.rows ?? null);
  const [stats, setStats] = useState<ContestStats | null>(fresh?.stats ?? null);
  const [take, setTake] = useState(0);

  useEffect(() => {
    if (!supabase || status !== 'online') return;
    let alive = true;
    void Promise.all([
      fetchLeaderboard(supabase, 'day', today, null, 3),
      fetchContestStats(supabase, today).catch(() => null),
    ]).then(([r, s]) => {
      if (!alive) return;
      setRows(r);
      if (s) setStats(s);
      writeJSON(CACHE, { date: today, rows: r, stats: s ?? stats } satisfies Cached);
    }).catch(() => { if (alive) setRows((x) => x ?? []); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, userId, status]);

  const top = (rows ?? []).filter((r) => r.rank <= 3).slice(0, 3);
  const me = rows?.find((r) => r.is_me) ?? null;
  const players = stats?.today.players ?? null;
  const champ = stats?.yesterday ?? null;
  const hasChamp = !!top[0];

  return (
    <section
      className="pb-rise pb-stage relative mt-3 overflow-hidden rounded-[22px] px-3.5 pb-3.5 pt-3"
      style={{ ['--d' as string]: '120ms' }}
      aria-label="Today's leaders"
    >
      <div aria-hidden="true" className="pb-spot pointer-events-none absolute -top-10 left-[12%] h-[340px] w-[120px]" style={{ ['--spot-a' as string]: '-14deg', ['--spot-b' as string]: '6deg' }} />
      <div aria-hidden="true" className="pb-spot pointer-events-none absolute -top-10 right-[12%] h-[340px] w-[120px]" style={{ ['--spot-a' as string]: '14deg', ['--spot-b' as string]: '-6deg', animationDelay: '-3s' }} />
      <Sparkles />

      <div className="relative z-[2] flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F6D98A]">Live contest</div>
          <h2 className="text-[20px] font-extrabold leading-tight tracking-tight text-[#FFF4E2]">Today&apos;s leaders</h2>
        </div>
        <Link to="/rankings" className="pb-key flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold" style={{ background: 'linear-gradient(160deg, #FFF3CF 0%, #F6D98A 45%, #E8B44A 100%)', color: '#4E2E04', ['--key-side' as string]: '#9A6410' }}>
          <Icon.Trophy width={15} height={15} /> All rankings
        </Link>
      </div>

      {/* The scene. Tapping it plays the entrance again. */}
      <button
        type="button"
        key={take}
        onClick={() => setTake((t) => t + 1)}
        aria-label="Play the winners' entrance again"
        className="relative mt-2 block w-full cursor-pointer text-left"
      >
        {/* Rays bursting behind first place, then turning slowly. */}
        {hasChamp && (
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[34px] h-0 w-0">
            <div className="pb-hero-burst absolute -left-[150px] -top-[150px] h-[300px] w-[300px]" style={{ ['--d' as string]: `${CHAMP_LAND - 120}ms` }}>
              <div className="pb-hero-rays h-full w-full rounded-full" />
            </div>
            <div className="pb-hero-shock absolute -left-[60px] -top-[60px] h-[120px] w-[120px] rounded-full" style={{ ['--d' as string]: `${CHAMP_LAND}ms` }} />
            <div className="pb-hero-shock absolute -left-[60px] -top-[60px] h-[120px] w-[120px] rounded-full" style={{ ['--d' as string]: `${CHAMP_LAND + 160}ms` }} />
          </div>
        )}
        {/* Speed lines as the champion dives in. */}
        {hasChamp && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[150px]">
            {[30, 40, 47, 53, 60, 70].map((x, i) => (
              <span key={x} className="pb-hero-speed absolute top-0 block h-[70px] w-[2px] rounded-full" style={{ left: `${x}%`, ['--d' as string]: `${CHAMP_LAND - 520 + i * 40}ms` }} />
            ))}
          </div>
        )}

        <div className={`relative grid grid-cols-3 items-end gap-2 pt-12 ${hasChamp ? 'pb-hero-quake' : ''}`} style={{ ['--d' as string]: `${CHAMP_LAND}ms` }}>
          {SEATS.map(({ idx, place, step, land, from }) => {
            const row = top[idx];
            return (
              <div key={place} className="relative flex min-w-0 flex-col items-center">
                {row ? (
                  <div
                    className="pb-hero-fly relative flex min-w-0 max-w-full flex-col items-center"
                    style={{ ['--d' as string]: `${land}ms`, ['--fx' as string]: from.x, ['--fy' as string]: from.y, ['--fr' as string]: from.r }}
                  >
                    {place === 1 && (
                      <>
                        <Cape />
                        <div className="pb-hero-crown absolute -top-9 z-[3]" style={{ ['--d' as string]: `${CHAMP_LAND + 380}ms` }}>
                          <img src={crownUrl} alt="" className="pb-float h-10 w-10" style={{ filter: 'drop-shadow(0 4px 4px rgb(0 0 0 / 0.45))' }} />
                        </div>
                        <ComicBadge delay={CHAMP_LAND + 650} />
                      </>
                    )}
                    <div className="relative z-[2]">
                      <Avatar name={row.nickname} colour={row.avatar} size={place === 1 ? 58 : 44} ring={row.is_me ? '#F6D98A' : undefined} />
                    </div>
                    <span className="relative z-[2] mt-1.5 w-full truncate text-center text-[12.5px] font-bold text-[#FFF4E2]">{row.is_me ? 'You' : row.nickname}</span>
                    <span className="relative z-[2] text-[12px] font-extrabold tabular-nums text-[#F6D98A]">{fmtPoints(row.score)}</span>
                    <Medal place={place} delay={(place === 1 ? CHAMP_LAND : land + 420) + 200} />
                  </div>
                ) : (
                  <div className="pb-in flex flex-col items-center opacity-80" style={{ ['--d' as string]: `${land}ms` }}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-[30%] border-2 border-dashed border-[rgb(246_217_138/0.55)] text-[18px] font-bold text-[#F6D98A]">+</span>
                    <span className="mt-1.5 text-[11.5px] font-semibold text-[#FBE9CC]">Open seat</span>
                    <span className="mt-1 h-[34px]" />
                  </div>
                )}
                <div className="mt-1 w-full overflow-hidden rounded-t-[10px]" style={{ height: step }}>
                  <div className={`pb-podium pb-step-${place} flex h-full flex-col items-center rounded-t-[10px] pt-2`} style={{ ['--d' as string]: `${land - 260}ms` }}>
                    <span className="text-[22px] font-black leading-none">{place}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </button>

      <div className="relative -mx-3.5 h-2.5" style={{ background: 'linear-gradient(180deg, #3A2414, #241608)' }} />

      <div className="relative mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 rounded-[14px] bg-[rgb(255_244_226/0.1)] px-3 py-2 text-[#FFF4E2]">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgb(246_217_138/0.2)] text-[#F6D98A]"><Icon.User width={16} height={16} /></span>
          <span className="flex-grow text-[12.5px] font-semibold leading-snug">
            {rows === null ? (status === 'offline' ? 'Reaching the contest… the leaders appear as soon as you are online.' : 'Loading the board…')
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

/** A red hero's cape behind the champion, rippling from the shoulders. */
function Cape() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[26px] z-[1] -ml-[38px] h-[74px] w-[76px]">
      <div className="pb-hero-cape h-full w-full">
        <svg viewBox="0 0 76 86" width="76" height="74" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pb-cape-g" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#F2545B" />
              <stop offset="0.55" stopColor="#C81E2B" />
              <stop offset="1" stopColor="#7E0F19" />
            </linearGradient>
          </defs>
          <path d="M22 2 C30 6 46 6 54 2 L74 78 C62 72 54 86 44 78 C36 86 26 72 18 82 C12 74 6 80 2 76 Z" fill="url(#pb-cape-g)" />
          <path d="M22 2 C30 6 46 6 54 2 L58 18 C48 22 28 22 18 18 Z" fill="#000" opacity="0.18" />
          <path d="M30 10 L20 74 M46 10 L56 72" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" fill="none" />
        </svg>
      </div>
    </div>
  );
}

/** A comic-book starburst that pops beside the champion. */
function ComicBadge({ delay }: { delay: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -right-7 -top-6 z-[4]">
      <div className="pb-hero-pow" style={{ ['--d' as string]: `${delay}ms` }}>
        <svg viewBox="0 0 64 44" width="54" height="38">
          <path d="M32 0 38 10 50 4 48 15 63 16 52 24 60 34 46 32 44 44 35 35 26 43 24 32 9 37 15 26 1 20 15 15 10 4 24 10Z" fill="#FFD23F" stroke="#4E2E04" strokeWidth="2" strokeLinejoin="round" />
          <text x="32" y="26" textAnchor="middle" fontSize="11" fontWeight="900" fill="#C81E2B" fontFamily="system-ui, sans-serif" letterSpacing="0.5">#1!</text>
        </svg>
      </div>
    </div>
  );
}

/** A medal on a ribbon that spins in, then sways. */
function Medal({ place, delay }: { place: 1 | 2 | 3; delay: number }) {
  const ribbon = place === 1 ? ['#C81E2B', '#1F4FA8'] : place === 2 ? ['#1F4FA8', '#C81E2B'] : ['#2E7D4F', '#C81E2B'];
  return (
    <div aria-hidden="true" className="relative z-[2] mt-0.5 h-[34px] w-[30px]">
      <div className="pb-hero-medal h-full w-full" style={{ ['--d' as string]: `${delay}ms` }}>
        <div className="pb-medal-sway relative h-full w-full" style={{ animationDelay: `${-place * 0.7}s` }}>
          <span className="absolute left-[7px] top-0 block h-[14px] w-[7px] -skew-x-[18deg]" style={{ background: ribbon[0] }} />
          <span className="absolute right-[7px] top-0 block h-[14px] w-[7px] skew-x-[18deg]" style={{ background: ribbon[1] }} />
          <span className={`pb-medal-${place} absolute bottom-[2px] left-[3px] flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-black`}>
            {place}
            <span className="pb-medal-glint absolute inset-0 overflow-hidden rounded-full"><span className="block h-full w-[40%]" /></span>
          </span>
        </div>
      </div>
    </div>
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

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import crownUrl from '../games/crowns/assets/crown.webp';
import { fmtPoints } from '../lib/contest';
import { playRecord } from '../lib/sound';

/**
 * The extra moment on top of the usual win, when a solve sets a record:
 *
 *  - 'best'  a new personal best at this game: a gold "New high score"
 *            ribbon swings in with a shine, fireworks pop around it, and the
 *            old record is shown being beaten;
 *  - 'first' taking 1st place in today's contest: the same, bigger, with a
 *            crown dropping onto the ribbon, gold coins raining and applause.
 *
 * It waits until the usual "Solved!" plaque has had its turn, stays a few
 * seconds (tap to skip), then leaves a small badge on the score card.
 * Transform and opacity only; under reduced motion it is a still banner.
 */

export type HighRecord = { kind: 'best' | 'first'; score: number; prev: number | null };

const LINES = {
  best: [
    'Your past self has been notified.',
    'New personal best. Previous you is furious.',
    'Frame it. Or at least screenshot it.',
    'The best you’ve ever done. No pressure next time.',
  ],
  first: [
    'Everyone else: please act surprised.',
    'Top of the board. Try to stay humble. Or don’t.',
    'The podium has been informed.',
    'First place. Your rivals are refreshing the page.',
  ],
};

const reduced = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function HighScoreMoment({ record, delayMs }: { record: HighRecord; delayMs: number }) {
  const [phase, setPhase] = useState<'wait' | 'show' | 'leave' | 'done'>('wait');
  const [line] = useState(() => LINES[record.kind][Math.floor(Math.random() * LINES[record.kind].length)]!);
  const big = record.kind === 'first';

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setPhase('show');
      playRecord(record.kind);
      try { navigator.vibrate?.(big ? [40, 50, 40, 50, 160] : [30, 50, 90]); } catch { /* not every phone */ }
    }, delayMs);
    const t2 = window.setTimeout(() => setPhase('leave'), delayMs + (big ? 4600 : 3600));
    const t3 = window.setTimeout(() => setPhase('done'), delayMs + (big ? 5100 : 4100));
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
  }, [delayMs, record.kind, big]);

  if (phase === 'wait' || phase === 'done') return null;
  const still = reduced();

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      onClick={() => setPhase('done')}
      className={`fixed inset-0 z-[80] flex items-center justify-center ${phase === 'leave' ? 'pb-hs-out' : 'pb-hs-in'}`}
    >
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'radial-gradient(70% 55% at 50% 45%, rgb(30 10 45 / 0.72), rgb(10 4 18 / 0.88))' }} />
      {!still && <Fireworks big={big} />}
      {!still && big && <CoinRain />}

      <div className="relative flex flex-col items-center px-6 text-center">
        {big && <img src={crownUrl} alt="" className="pb-hs-crown relative z-[2] -mb-4 h-16 w-16" style={{ filter: 'drop-shadow(0 6px 8px rgb(0 0 0 / 0.5))' }} />}
        <div className="pb-hs-ribbon relative">
          <div className="pb-hs-ribbon-face relative overflow-hidden rounded-[14px] px-7 py-3">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.28em] text-[#6B3F06]">{big ? 'Today’s contest' : 'Personal record'}</div>
            <div className="text-[30px] font-black uppercase leading-none tracking-[-0.01em] text-[#3E2302] [text-shadow:0_1px_0_rgb(255_255_255/0.6)]">
              {big ? '1st place!' : 'New high score!'}
            </div>
            {!still && <span aria-hidden="true" className="pb-hs-shine absolute inset-y-0 left-0 w-1/3" />}
          </div>
          <span aria-hidden="true" className="pb-hs-tail pb-hs-tail-l" />
          <span aria-hidden="true" className="pb-hs-tail pb-hs-tail-r" />
        </div>
        <div className="pb-hs-sub mt-4 flex items-baseline gap-2 text-[#FFF4E2]">
          <span className="text-[34px] font-black tabular-nums text-[#F6D98A] [text-shadow:0_2px_10px_rgb(246_217_138/0.45)]">{fmtPoints(record.score)}</span>
          <span className="text-[14px] font-semibold">points</span>
        </div>
        {record.prev !== null && !big && (
          <div className="pb-hs-sub mt-0.5 text-[13px] text-[#E8D9F2]">
            old record <s className="tabular-nums opacity-80">{fmtPoints(record.prev)}</s> <span className="font-bold text-[#9BE3A8]">+{fmtPoints(record.score - record.prev)}</span>
          </div>
        )}
        <p className="pb-hs-line mt-3 max-w-[280px] text-[15px] font-semibold italic leading-snug text-[#FFF4E2]">{line}</p>
        <p className="pb-hs-line mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#BFAFD0]">tap to carry on</p>
      </div>
    </div>,
    document.body,
  );
}

/** Bursts of sparks around the ribbon. Each spark flies out along its own angle. */
function Fireworks({ big }: { big: boolean }) {
  const bursts: [number, number, number][] = big
    ? [[22, 28, 0], [78, 24, 260], [50, 16, 520], [16, 64, 780], [84, 62, 980], [50, 78, 1240]]
    : [[24, 30, 0], [76, 26, 300], [50, 72, 620], [20, 66, 900]];
  const colours = ['#F6D98A', '#FFF1C9', '#F29A5C', '#F09CC2', '#8FD3F0', '#B6E39A'];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {bursts.map(([x, y, d], b) => (
        <div key={b} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
          {Array.from({ length: 14 }, (_, k) => {
            const a = (k / 14) * Math.PI * 2 + b;
            const r = 60 + ((k * 37) % 30);
            return (
              <span
                key={k}
                className="pb-hs-spark absolute block h-[6px] w-[6px] rounded-full"
                style={{
                  background: colours[(k + b) % colours.length],
                  ['--x' as string]: `${Math.cos(a) * r}px`,
                  ['--y' as string]: `${Math.sin(a) * r}px`,
                  ['--d' as string]: `${d + 200}ms`,
                }}
              />
            );
          })}
          <span className="pb-hs-flash absolute -left-6 -top-6 block h-12 w-12 rounded-full" style={{ ['--d' as string]: `${d + 200}ms` }} />
        </div>
      ))}
    </div>
  );
}

/** Gold coins falling past, for first place. */
function CoinRain() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 22 }, (_, k) => (
        <span
          key={k}
          className="pb-hs-coin absolute -top-8 block h-5 w-5 rounded-full"
          style={{
            left: `${(k * 41) % 100}%`,
            ['--d' as string]: `${600 + ((k * 173) % 2200)}ms`,
            ['--s' as string]: `${1.6 + ((k * 7) % 10) / 10}s`,
            ['--r' as string]: `${(k % 2 ? 1 : -1) * (240 + (k * 31) % 300)}deg`,
          }}
        />
      ))}
    </div>
  );
}

/** The small badge that stays on the score card afterwards. */
export function RecordBadge({ kind }: { kind: 'best' | 'first' }) {
  return (
    <span className="pb-stamp inline-flex items-center gap-1 rounded-full bg-[#3E1A55] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#F6D98A] shadow-[0_0_0_1px_rgb(246_217_138/0.5)]" style={{ ['--d' as string]: '200ms' }}>
      {kind === 'first' ? '♛ 1st today' : '★ New high score'}
    </span>
  );
}

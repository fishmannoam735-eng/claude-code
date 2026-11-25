import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { bridgesGame, type BridgesHintStep } from '@pb/engine';
import { useBridges } from './store';
import { WoodTray } from '../../components/WoodTray';
import { play } from '../../lib/sound';

const { counts } = bridgesGame;

/**
 * The board is a pond in the wooden tray. Seigaiha waves drift over deep
 * water, two koi swim slowly underneath, a few blossom petals float by, and
 * each island is a mossy stone with its number on it. Bridges are wooden
 * planks with vermilion rails that push out from the island you drag from
 * and land on the other with a splash.
 *
 * Everything that moves moves by transform or opacity only: the water, the
 * fish and the petals are painted once and slid around, so phones keep it
 * on the GPU and never repaint per frame.
 */

const R = 0.39;           // island radius, in cells
const THICK1 = 0.25;      // a single bridge's width, in cells
const THICK2 = 0.17;      // each of a double's two bridges
const GAP2 = 0.125;       // how far each of a double sits from the middle

export const WAVES = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'><g fill='none' stroke='white' stroke-width='1.1'>" +
  "<path d='M0 20a20 20 0 0 1 40 0M6 20a14 14 0 0 1 28 0M12 20a8 8 0 0 1 16 0'/>" +
  "<path d='M-20 10a20 20 0 0 1 40 0M-14 10a14 14 0 0 1 28 0M-8 10a8 8 0 0 1 16 0'/>" +
  "<path d='M20 10a20 20 0 0 1 40 0M26 10a14 14 0 0 1 28 0M32 10a8 8 0 0 1 16 0'/>" +
  '</g></svg>',
)}")`;

/** A mossy island with its stone, which turns gold once the island has all its bridges. */
export function Isle({ u, need, state, ring = null, pop = false }: { u: number; need: number; state: 'open' | 'done' | 'over'; ring?: string | null; pop?: boolean }) {
  const over = state === 'over', done = state === 'done';
  return (
    <>
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle at 34% 28%, #B5D68A 0%, #79A852 40%, #4B7A35 78%, #335A24 100%)',
          boxShadow: `0 ${0.09 * u}cqw 0 #2E4A1E, ${0.06 * u}cqw ${0.16 * u}cqw ${0.06 * u}cqw rgb(6 30 40 / 0.45)${ring ? `, 0 0 0 ${0.07 * u}cqw ${ring}` : ''}`,
        }}
      />
      <span
        key={state}
        className={`absolute flex items-center justify-center rounded-full ${pop ? 'pb-coin' : ''}`}
        style={{
          inset: '15%',
          background: over
            ? 'radial-gradient(circle at 36% 30%, #FFE9E2 0%, #F2A797 55%, #C7553F 100%)'
            : done
              ? 'radial-gradient(circle at 36% 30%, #FFF8D6 0%, #F4CC62 50%, #C08A1E 100%)'
              : 'radial-gradient(circle at 36% 30%, #FFFFFB 0%, #ECE5D6 52%, #B9AE98 100%)',
          boxShadow: `0 ${0.05 * u}cqw 0 ${over ? '#8E2F1F' : done ? '#8A5E0E' : '#8C826C'}, inset 0 ${-0.03 * u}cqw ${0.06 * u}cqw rgb(0 0 0 / 0.12)`,
        }}
      >
        <span
          className="font-extrabold leading-none"
          style={{ fontSize: `${0.42 * u}cqw`, color: over ? '#7A1E10' : done ? '#5A3A06' : '#2B2420', marginTop: `${-0.02 * u}cqw` }}
        >{need}</span>
      </span>
    </>
  );
}

/** One bridge: plank deck, two vermilion rails, a soft shadow on the water. */
export function Deck({ u, thick, solvedDelay }: { u: number; thick: number; solvedDelay?: number | undefined }) {
  const t = thick * u;
  const plank = 0.2 * u, seam = 0.035 * u;
  return (
    <>
      <span
        className="absolute rounded-[0.4cqw]"
        style={{ left: 0, right: 0, top: `${0.09 * u}cqw`, height: `${t}cqw`, background: 'rgb(8 34 44 / 0.32)' }}
      />
      <span
        className="pb-deck absolute overflow-hidden rounded-[0.35cqw]"
        style={{
          left: 0, right: 0, top: 0, height: `${t}cqw`,
          background: [
            `linear-gradient(to bottom, #E2654A 0 ${t * 0.08}cqw, #A8301F ${t * 0.08}cqw ${t * 0.17}cqw, transparent ${t * 0.17}cqw ${t * 0.83}cqw, #A8301F ${t * 0.83}cqw ${t * 0.92}cqw, #7A2014 ${t * 0.92}cqw)`,
            `linear-gradient(to bottom, rgb(255 240 210 / 0.35), transparent 45%, rgb(60 30 10 / 0.25))`,
            `repeating-linear-gradient(90deg, #D9A066 0 ${plank - seam}cqw, #5A3818 ${plank - seam}cqw ${plank}cqw)`,
          ].join(','),
          ...(solvedDelay !== undefined ? { ['--sd' as string]: `${solvedDelay}ms` } : {}),
        }}
      />
    </>
  );
}

interface Ghost { key: string; style: CSSProperties; u: number; thick: number }

export function BridgesBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useBridges((s) => s.puzzle);
  const bridges = useBridges((s) => s.bridges);
  const status = useBridges((s) => s.status);
  const change = useBridges((s) => s.change);
  const refused = useBridges((s) => s.refused);
  const hint = useBridges((s) => s.hint);
  const hintStep = useBridges((s) => s.hintStep);
  const { cycle } = useBridges.getState();
  const row: BridgesHintStep | undefined = hidden ? undefined : hint?.steps[hintStep];
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; link: number | null; end: 'a' | 'b' } | null>(null);
  const tap = useRef<{ link: number; x: number; y: number; end: 'a' | 'b' } | null>(null);
  const [flash, setFlash] = useState<{ link: number; n: number } | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const prev = useRef<number[] | null>(null);

  const n = puzzle?.n ?? 7;
  const u = 92.4 / n;                     // one cell, in cqw of the tray
  const solved = status === 'solved';
  const L = puzzle?.layout;

  // Islands by cell, and which link runs over each water cell.
  const { islandAt, linkOver } = useMemo(() => {
    const islandAt = new Map<number, number>();
    const linkOver = new Map<number, number[]>();
    L?.islands.forEach((s, i) => islandAt.set(s.cell, i));
    L?.links.forEach((l, k) => l.cells.forEach((c) => linkOver.set(c, [...(linkOver.get(c) ?? []), k])));
    return { islandAt, linkOver };
  }, [L]);

  // A refused bridge: thud, and flash the one in the way.
  useEffect(() => {
    if (!refused) return;
    play('error');
    setFlash({ link: refused.by, n: refused.n });
    const t = window.setTimeout(() => setFlash(null), 700);
    return () => window.clearTimeout(t);
  }, [refused]);

  /** Where a bridge slot sits: from end a, along the link, nudged sideways for a double. */
  const slotStyle = useCallback((k: number, offset: number): CSSProperties => {
    const l = L!.links[k]!;
    const a = L!.islands[l.a]!, b = L!.islands[l.b]!;
    const len = (l.horizontal ? b.c - a.c : b.r - a.r) * u;
    return {
      left: `${(a.c + 0.5) * u}cqw`, top: `${(a.r + 0.5) * u}cqw`, width: `${len}cqw`, height: 0,
      transformOrigin: '0 0',
      transform: `rotate(${l.horizontal ? 0 : 90}deg) translateY(${offset * u}cqw)`,
    };
  }, [L, u]);

  // Bridges taken away fade out where they stood instead of vanishing.
  useEffect(() => {
    if (!L) return;
    const before = prev.current;
    prev.current = bridges;
    if (!before || before.length !== bridges.length || hidden) return;
    const gone: Ghost[] = [];
    bridges.forEach((v, k) => {
      const was = before[k]!;
      if (v >= was) return;
      const offs = (c: number) => (c === 1 ? [0] : [-GAP2, GAP2]);
      for (const o of offs(was)) gone.push({ key: `${k}:${o}:${Date.now()}`, style: slotStyle(k, o), u, thick: was === 2 ? THICK2 : THICK1 });
    });
    if (!gone.length) return;
    setGhosts((g) => [...g, ...gone]);
    const t = window.setTimeout(() => setGhosts((g) => g.filter((x) => !gone.includes(x))), 320);
    return () => window.clearTimeout(t);
  }, [bridges, L, slotStyle, u, hidden]);

  /** Cell position (in cells, fractional) under a pointer. */
  const at = useCallback((x: number, y: number): [number, number] | null => {
    const el = boxRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [((x - r.left) / r.width) * n, ((y - r.top) / r.height) * n];
  }, [n]);

  if (!puzzle || !L) return null;
  const have = counts(L, bridges);
  const focus = new Set(row?.focus ?? []);
  const lit = new Set(row?.links ?? []);
  const out = new Set(row?.out ?? []);
  const play_ = !hidden && !solved;

  const islandNear = (fx: number, fy: number): number | null => {
    const c = Math.floor(fx), r = Math.floor(fy);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const i = islandAt.get((r + dr) * n + (c + dc));
      if (i === undefined || r + dr < 0 || c + dc < 0 || r + dr >= n || c + dc >= n) continue;
      const s = L.islands[i]!;
      if (Math.hypot(fx - (s.c + 0.5), fy - (s.r + 0.5)) <= 0.55) return i;
    }
    return null;
  };

  const linkToward = (i: number, fx: number, fy: number): { link: number; end: 'a' | 'b' } | null => {
    const s = L.islands[i]!;
    const dx = fx - (s.c + 0.5), dy = fy - (s.r + 0.5);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.42) return null;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const forward = horizontal ? dx > 0 : dy > 0;
    for (const k of L.linksOf[i]!) {
      const l = L.links[k]!;
      if (l.horizontal !== horizontal) continue;
      if (forward && l.a === i) return { link: k, end: 'a' };
      if (!forward && l.b === i) return { link: k, end: 'b' };
    }
    return null;
  };

  const centre = (i: number): [number, number] => [(L.islands[i]!.c + 0.5) * u, (L.islands[i]!.r + 0.5) * u];
  const latest = change && change.n;
  const target = drag?.link != null ? (L.links[drag.link]!.a === drag.from ? L.links[drag.link]!.b : L.links[drag.link]!.a) : null;

  return (
    <WoodTray
      gridRef={boxRef}
      grid={{
        className: `${play_ ? 'touch-none' : ''} ${solved ? 'pb-pond-solved' : ''}`,
        style: { background: 'radial-gradient(ellipse at 38% 30%, #6CC0BC 0%, #3A8E98 42%, #1F5A6C 100%)' },
        onDragStart: (e) => e.preventDefault(),
        onPointerDown: (e) => {
          if (!play_) return;
          const p = at(e.clientX, e.clientY);
          if (!p) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const i = islandNear(p[0], p[1]);
          if (i !== null) { setDrag({ from: i, link: null, end: 'a' }); tap.current = null; return; }
          const cell = Math.floor(p[1]) * n + Math.floor(p[0]);
          const over = linkOver.get(cell);
          if (!over?.length) { tap.current = null; return; }
          // Over a crossing, prefer the bridge that is built.
          const k = over.find((x) => bridges[x]! > 0) ?? over[0]!;
          const l = L.links[k]!;
          const along = l.horizontal ? p[0] : p[1];
          const mid = l.horizontal ? (L.islands[l.a]!.c + L.islands[l.b]!.c + 1) / 2 : (L.islands[l.a]!.r + L.islands[l.b]!.r + 1) / 2;
          tap.current = { link: k, x: p[0], y: p[1], end: along < mid ? 'a' : 'b' };
        },
        onPointerMove: (e) => {
          if (!drag || !play_) return;
          const p = at(e.clientX, e.clientY);
          if (!p) return;
          const t = linkToward(drag.from, p[0], p[1]);
          if ((t?.link ?? null) !== drag.link) setDrag({ from: drag.from, link: t?.link ?? null, end: t?.end ?? 'a' });
        },
        onPointerUp: (e) => {
          if (drag) {
            if (drag.link !== null) cycle(drag.link, drag.end);
            setDrag(null);
            return;
          }
          const t = tap.current;
          tap.current = null;
          if (!t) return;
          const p = at(e.clientX, e.clientY);
          if (p && Math.hypot(p[0] - t.x, p[1] - t.y) < 0.5) cycle(t.link, t.end);
        },
        onPointerCancel: () => { setDrag(null); tap.current = null; },
      }}
    >
      {/* the water: drifting seigaiha waves and slow light */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="pb-waves absolute" style={{ inset: '-12%', backgroundImage: WAVES, backgroundSize: `${u * 1.5}cqw ${u * 0.75}cqw`, opacity: 0.1 }} />
        <div className="pb-caustic absolute" style={{ left: '-20%', top: '-20%', width: '80%', height: '80%', background: 'radial-gradient(closest-side, rgb(220 255 250 / 0.22), transparent)' }} />
        <div className="pb-caustic pb-caustic-2 absolute" style={{ right: '-25%', bottom: '-25%', width: '90%', height: '90%', background: 'radial-gradient(closest-side, rgb(200 245 255 / 0.16), transparent)' }} />
        {!hidden && <Koi u={u} />}
        {!hidden && <Petals />}
        {/* soft dark rim where water meets the tray */}
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 3cqw rgb(6 30 40 / 0.55)' }} />
      </div>

      {!hidden && (
        <>
          {/* a still ring of lighter water round each island; a ripple runs out once when it is complete */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {L.islands.map((s, i) => {
              const complete = have[i] === s.need;
              return (
                <span
                  key={`${i}${complete ? 'c' : ''}`}
                  className={`absolute rounded-full ${complete && !solved ? 'pb-isle-ripple' : ''}`}
                  style={{
                    left: `${(s.c + 0.5 - R * 1.18) * u}cqw`, top: `${(s.r + 0.5 - R * 1.18) * u}cqw`, width: `${2.36 * R * u}cqw`, height: `${2.36 * R * u}cqw`,
                    border: `${0.3}cqw solid rgb(225 250 245 / ${complete ? 0.8 : 0.28})`,
                  }}
                />
              );
            })}
          </div>

          {/* bridges */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {bridges.map((v, k) => {
              if (!v) return null;
              const offsets = v === 1 ? [0] : [-GAP2, GAP2];
              const thick = v === 1 ? THICK1 : THICK2;
              const fresh = change && change.link === k && latest === change.n;
              return offsets.map((o, slot) => {
                const isNew = fresh && slot === v - 1;
                const fromB = change?.from === 'b';
                const isFlash = flash?.link === k;
                return (
                  <div key={`${k}:${slot}`} className="absolute transition-transform duration-300 ease-out" style={slotStyle(k, o)}>
                    <div
                      className={`absolute left-0 right-0 overflow-hidden ${isFlash ? 'pb-bridge-flash' : ''}`}
                      style={{ top: `${-thick * u / 2}cqw`, height: `${(thick + 0.12) * u}cqw` }}
                    >
                      <div
                        className={`absolute inset-0 ${isNew ? 'pb-bridge-build' : ''}`}
                        style={{ ['--from' as string]: fromB ? '100%' : '-100%' }}
                      >
                        <Deck u={u} thick={thick} solvedDelay={solved ? k * 60 : undefined} />
                      </div>
                    </div>
                  </div>
                );
              });
            })}
            {ghosts.map((g) => (
              <div key={g.key} className="absolute" style={g.style}>
                <div className="pb-bridge-gone absolute left-0 right-0" style={{ top: `${-g.thick * g.u / 2}cqw`, height: `${(g.thick + 0.12) * g.u}cqw` }}>
                  <Deck u={g.u} thick={g.thick} />
                </div>
              </div>
            ))}
            {/* a splash where a new bridge lands */}
            {change && bridges[change.link]! > 0 && (() => {
              const l = L.links[change.link]!;
              const [x, y] = centre(change.from === 'b' ? l.a : l.b);
              return (
                <span
                  key={`splash${change.n}`}
                  className="pb-splash absolute rounded-full"
                  style={{ left: `${x - R * u * 1.1}cqw`, top: `${y - R * u * 1.1}cqw`, width: `${2.2 * R * u}cqw`, height: `${2.2 * R * u}cqw`, border: '0.5cqw solid rgb(240 255 252 / 0.9)' }}
                />
              );
            })()}
          </div>

          {/* a hint dims everything it isn't about */}
          {row && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[rgb(10_30_40/0.42)]" />}
          {row && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {[...lit].map((k) => {
                const v = bridges[k]!;
                const offsets = v === 2 ? [-GAP2, GAP2] : [0];
                return offsets.map((o, s) => (
                  <div key={`h${k}:${s}`} className="absolute" style={slotStyle(k, o)}>
                    {v > 0 ? (
                      <div className="absolute left-0 right-0" style={{ top: `${-(v === 2 ? THICK2 : THICK1) * u / 2}cqw` }}>
                        <Deck u={u} thick={v === 2 ? THICK2 : THICK1} />
                        <span className="absolute left-0 right-0 top-0 rounded-[0.5cqw]" style={{ height: `${(v === 2 ? THICK2 : THICK1) * u}cqw`, boxShadow: '0 0 0 0.6cqw var(--color-accent)' }} />
                      </div>
                    ) : (
                      <span className="pb-hint-ghost absolute left-0 right-0 rounded-full" style={{ top: `${-0.06 * u}cqw`, height: `${0.12 * u}cqw` }} />
                    )}
                  </div>
                ));
              })}
            </div>
          )}
          {row && [...out].map((k) => {
            const l = L.links[k]!;
            const [ax, ay] = centre(l.a), [bx, by] = centre(l.b);
            const s = 0.42 * u;
            return (
              <span
                key={`xo${k}`}
                aria-hidden="true"
                className="pointer-events-none absolute flex items-center justify-center rounded-full bg-[rgb(255_250_240/0.95)] font-black text-danger"
                style={{ left: `${(ax + bx) / 2 - s / 2}cqw`, top: `${(ay + by) / 2 - s / 2}cqw`, width: `${s}cqw`, height: `${s}cqw`, fontSize: `${s * 0.72}cqw`, lineHeight: 1, boxShadow: '0 0.3cqw 0.8cqw rgb(0 0 0 / 0.3)' }}
              >✕</span>
            );
          })}

          {/* the drag's preview: a ghost bridge to the island it would reach */}
          {drag?.link != null && (
            <div aria-hidden="true" className="pointer-events-none absolute" style={slotStyle(drag.link, 0)}>
              <span className="pb-preview absolute left-0 right-0 rounded-full" style={{ top: `${-0.07 * u}cqw`, height: `${0.14 * u}cqw` }} />
            </div>
          )}

          {/* islands */}
          {L.islands.map((s, i) => {
            const got = have[i]!;
            const done = got === s.need;
            const over = got > s.need;
            const dim = row && !focus.has(i);
            const ring = row && focus.has(i) ? 'var(--color-accent)' : drag?.from === i || target === i ? '#FFF6D8' : null;
            const size = 2 * R * u;
            return (
              <div
                key={i}
                data-tile
                className="pointer-events-none absolute rounded-full transition-transform duration-200"
                style={{
                  left: `${(s.c + 0.5 - R) * u}cqw`, top: `${(s.r + 0.5 - R) * u}cqw`, width: `${size}cqw`, height: `${size}cqw`,
                  transform: drag?.from === i ? 'scale(1.1)' : target === i ? 'scale(1.06)' : undefined,
                }}
              >
                <Isle u={u} need={s.need} state={over ? 'over' : done ? 'done' : 'open'} ring={ring} pop={done && !solved} />
                {dim && <span className="absolute inset-0 rounded-full bg-[rgb(10_30_40/0.45)]" />}
              </div>
            );
          })}
        </>
      )}

      {/* an accessible cell for every island */}
      <div role="grid" aria-label="Bridges board" className="pointer-events-none absolute inset-0">
        {L.islands.map((s, i) => (
          <div
            key={i}
            role="gridcell"
            className="absolute"
            style={{ left: `${(s.c / n) * 100}%`, top: `${(s.r / n) * 100}%`, width: `${100 / n}%`, height: `${100 / n}%` }}
            aria-label={`Island ${s.need}, row ${s.r + 1}, column ${s.c + 1}${hidden ? '' : `, ${have[i]} of ${s.need} bridges`}`}
          />
        ))}
      </div>
    </WoodTray>
  );
}

/** Two koi, painted once, gliding along slow loops under the bridges. */
function Koi({ u }: { u: number }) {
  const w = Math.max(14, u * 2);
  const fish = (spots: string) => (
    <svg viewBox="0 0 60 24" width="100%" height="100%" aria-hidden="true">
      <path d="M9 12 L0 4.5 Q3 12 0 19.5 Z" fill="#F4F0E6" opacity="0.9" />
      <ellipse cx="24" cy="5.5" rx="5" ry="2.6" fill="#F4F0E6" opacity="0.85" transform="rotate(-25 24 5.5)" />
      <ellipse cx="24" cy="18.5" rx="5" ry="2.6" fill="#F4F0E6" opacity="0.85" transform="rotate(25 24 18.5)" />
      <path d="M8 12 C16 3.5 40 3 54 12 C40 21 16 20.5 8 12 Z" fill="#FFF8EE" />
      <path d={spots} fill="#E8572E" />
      <circle cx="49" cy="10.2" r="0.9" fill="#2B1A12" />
      <circle cx="49" cy="13.8" r="0.9" fill="#2B1A12" />
    </svg>
  );
  return (
    <>
      <div className="pb-koi pb-koi-1 absolute left-0 top-0" style={{ width: `${w}cqw`, height: `${w * 0.4}cqw`, opacity: 0.72 }}>
        <div className="pb-koi-swim h-full w-full">{fish('M30 5.2 C38 4.5 47 7 52 11 C46 9.5 41 10 36 12.5 C33 10 31 8 30 5.2 Z M18 9 C22 8 27 10 26 13 C23 15 18 14 16 12 Z')}</div>
      </div>
      <div className="pb-koi pb-koi-2 absolute left-0 top-0" style={{ width: `${w * 0.85}cqw`, height: `${w * 0.34}cqw`, opacity: 0.66 }}>
        <div className="pb-koi-swim h-full w-full" style={{ animationDelay: '-0.6s' }}>{fish('M38 6 C45 7 51 9 53 12 C51 15 45 17 38 18 C40 14 40 10 38 6 Z M14 10 C17 8 21 9 22 12 C19 15 15 14 14 10 Z')}</div>
      </div>
    </>
  );
}

/** A few blossom petals drifting across the pond. */
function Petals() {
  return (
    <>
      {[0, 1, 2, 3].map((k) => (
        <span key={k} className={`pb-petal pb-petal-${k} absolute left-0 top-0`} style={{ width: '2.6cqw', height: '2cqw' }}>
          <svg viewBox="0 0 26 20" width="100%" height="100%" aria-hidden="true">
            <path d="M13 19 C4 15 0 7 5 2 C8 0 11 2 13 5 C15 2 18 0 21 2 C26 7 22 15 13 19 Z" fill={k % 2 ? '#F7C6D3' : '#FADDE4'} />
            <path d="M13 17 C11 12 11 9 13 6" stroke="#E79AB0" strokeWidth="1" fill="none" />
          </svg>
        </span>
      ))}
    </>
  );
}

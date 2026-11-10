import { useCallback, useId, useMemo, useRef } from 'react';
import { threadGame } from '@pb/engine';
import { useThread } from './store';
import { WoodTray, tileStyle } from '../../components/WoodTray';

const { colOf, rowOf } = threadGame;

// Warm ivory tiles, like Eclipse: they are objects in the tray and stay light in dark mode.
const IVORY = {
  face: 'linear-gradient(135deg, rgb(255 251 240) 0%, rgb(250 243 226) 45%, rgb(238 228 206) 100%)',
  side: 'rgb(196 180 150)',
};

/**
 * The line is a glossy ceramic pipe laid over the tiles. It is drawn as the
 * same route several times: a soft shadow on the tiles, a dark rim, the body,
 * then two highlights nudged towards the top-left. Because every segment's
 * highlight moves the same way, the light reads as coming from one place, and
 * the round joins become elbows of a bent tube.
 */
const PIPE = {
  rim: '#14505C',
  body: '#2A8798',
  mid: '#4FB4C6',
  light: '#A6E6F0',
  spec: '#F4FEFF',
};

export function ThreadBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useThread((s) => s.puzzle);
  const path = useThread((s) => s.path);
  const status = useThread((s) => s.status);
  const hint = useThread((s) => s.hint);
  const hintStep = useThread((s) => s.hintStep);
  const row = hidden ? undefined : hint?.steps[hintStep];
  const { beginAt, dragTo, endDrag } = useThread.getState();
  const boxRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, '');

  /** Which cell is under this pointer position? Computed from the board's own box. */
  const cellAt = useCallback((clientX: number, clientY: number): number | null => {
    const el = boxRef.current;
    if (!el || !puzzle) return null;
    const r = el.getBoundingClientRect();
    const c = Math.floor(((clientX - r.left) / r.width) * puzzle.n);
    const row = Math.floor(((clientY - r.top) / r.height) * puzzle.n);
    if (c < 0 || row < 0 || c >= puzzle.n || row >= puzzle.n) return null;
    return row * puzzle.n + c;
  }, [puzzle]);

  const wallSegments = useMemo(() => {
    if (!puzzle) return [];
    const n = puzzle.n;
    return puzzle.walls.map((key) => {
      const [a, b] = key.split('-').map(Number) as [number, number];
      const horizontal = b === a + 1;       // wall runs vertically between side-by-side cells
      const r = rowOf(a, n), c = colOf(a, n);
      return horizontal
        ? { x1: c + 1, y1: r, x2: c + 1, y2: r + 1 }
        : { x1: c, y1: r + 1, x2: c + 1, y2: r + 1 };
    });
  }, [puzzle]);

  if (!puzzle) return null;
  const n = puzzle.n;
  const centre = (i: number): [number, number] => [colOf(i, n) + 0.5, rowOf(i, n) + 0.5];
  const numberOf = new Map(puzzle.waypoints.map((cell, k) => [cell, k + 1]));
  const solved = status === 'solved';
  const points = path.map((i) => centre(i).join(',')).join(' ');
  const head = path.length ? centre(path[path.length - 1]!) : null;
  const onPath = new Set(path);
  const focus = new Set(row?.focus ?? []);
  const out = new Set(row?.out ?? []);

  // One stroke of the route, so every layer of the pipe is the same shape.
  const route = (stroke: string, width: number, extra: React.SVGProps<SVGPolylineElement> = {}) => (
    <polyline points={points} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" {...extra} />
  );

  return (
    <WoodTray
      gridRef={boxRef}
      grid={{
        className: `touch-none ${solved ? 'pb-thread-solved' : ''}`,
        // Pressing on a number and moving makes the browser start a native drag,
        // which fires pointercancel and kills every pointer event after the
        // first — the line would extend but never retract. Suppressing the
        // default on pointerdown, plus select-none and the guard below, is what
        // keeps the stroke alive.
        onDragStart: (e) => e.preventDefault(),
        onPointerDown: (e) => {
          if (hidden) return;
          const cell = cellAt(e.clientX, e.clientY);
          if (cell === null) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          beginAt(cell);
        },
        onPointerMove: (e) => {
          if (hidden) return;
          const cell = cellAt(e.clientX, e.clientY);
          if (cell !== null) dragTo(cell);
        },
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onLostPointerCapture: endDrag,
      }}
    >
      {/* The tiles. A hint dims the ones it isn't about. */}
      <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: n * n }, (_, i) => (
          <div key={i} className="relative">
            <span
              data-tile
              className="absolute flex items-center justify-center"
              style={tileStyle(IVORY.face, IVORY.side,
                row ? (out.has(i) ? 'var(--color-danger)' : focus.has(i) ? 'var(--color-accent)' : undefined) : undefined)}
            >
              {row && !focus.has(i) && !out.has(i) && <span className="absolute inset-0 rounded-[inherit] bg-[rgb(40_28_16/0.38)]" />}
            </span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${n} ${n}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id={`${id}gold`} cx="38%" cy="32%" r="72%">
            <stop offset="0" stopColor="#FFF6C4" />
            <stop offset="0.45" stopColor="#F2C14A" />
            <stop offset="1" stopColor="#B87A14" />
          </radialGradient>
          <radialGradient id={`${id}walnut`} cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor="#8A6440" />
            <stop offset="0.55" stopColor="#5C4028" />
            <stop offset="1" stopColor="#36240F" />
          </radialGradient>
          <radialGradient id={`${id}cap`} cx="36%" cy="32%" r="70%">
            <stop offset="0" stopColor={PIPE.light} />
            <stop offset="0.5" stopColor={PIPE.body} />
            <stop offset="1" stopColor={PIPE.rim} />
          </radialGradient>
        </defs>

        {/* the pipe */}
        {!hidden && path.length > 1 && (
          <g>
            {/* A soft shadow from two plain strokes; a blur filter would repaint slowly on phones. */}
            <g transform="translate(0.05 0.09)">{route('rgb(60 36 14 / 0.16)', 0.52)}{route('rgb(60 36 14 / 0.22)', 0.4)}</g>
            {route(PIPE.rim, 0.42)}
            {route(PIPE.body, 0.35)}
            <g transform="translate(-0.035 -0.035)">{route(PIPE.mid, 0.2)}</g>
            <g transform="translate(-0.07 -0.07)">{route(PIPE.light, 0.09, { opacity: 0.9 })}</g>
            <g transform="translate(-0.08 -0.08)">{route(PIPE.spec, 0.035, { opacity: 0.95 })}</g>
            {/* once solved, light runs along the whole pipe */}
            {solved && route('#FFFFFF', 0.16, { pathLength: 1, className: 'pb-flow', opacity: 0.85, strokeDasharray: '0.06 0.94' })}
          </g>
        )}

        {/* the end of the pipe the player is drawing from */}
        {!hidden && head && !solved && path.length > 0 && !numberOf.has(path[path.length - 1]!) && (
          <g>
            <circle cx={head[0]} cy={head[1]} r={0.3} fill="none" stroke={PIPE.mid} strokeWidth={0.05} className="pb-ripple" style={{ transformOrigin: `${head[0]}px ${head[1]}px` }} />
            <circle cx={head[0]} cy={head[1]} r={0.24} fill={`url(#${id}cap)`} stroke={PIPE.rim} strokeWidth={0.04} />
            <circle cx={head[0]} cy={head[1]} r={0.1} fill={PIPE.rim} opacity={0.7} />
          </g>
        )}

        {/* walls: dark wooden bars along the seams, on top of everything that can't cross them */}
        {wallSegments.map((w, k) => (
          <g key={`w${k}`}>
            <line x1={w.x1 + 0.02} y1={w.y1 + 0.04} x2={w.x2 + 0.02} y2={w.y2 + 0.04} stroke="rgb(40 24 10 / 0.35)" strokeWidth={0.16} strokeLinecap="round" />
            <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#3E2A18" strokeWidth={0.15} strokeLinecap="round" />
            <line x1={w.x1 - 0.02} y1={w.y1 - 0.02} x2={w.x2 - 0.02} y2={w.y2 - 0.02} stroke="#9A7048" strokeWidth={0.035} strokeLinecap="round" opacity={0.8} />
          </g>
        ))}

        {/* numbered stops: walnut until the pipe reaches them, then polished gold */}
        {!hidden && puzzle.waypoints.map((cell, k) => {
          const [x, y] = centre(cell);
          const lit = onPath.has(cell);
          return (
            <g key={`n${cell}`}>
              <circle cx={x + 0.03} cy={y + 0.06} r={0.33} fill="rgb(40 24 10 / 0.25)" />
              <circle
                key={lit ? 'lit' : 'dark'}
                cx={x} cy={y} r={0.3}
                fill={`url(#${id}${lit ? 'gold' : 'walnut'})`}
                stroke={lit ? '#9A6410' : '#2A1A0A'} strokeWidth={0.03}
                className={lit ? 'pb-coin' : undefined}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
              <ellipse cx={x - 0.09} cy={y - 0.12} rx={0.12} ry={0.06} fill="#fff" opacity={lit ? 0.6 : 0.18} transform={`rotate(-30 ${x - 0.09} ${y - 0.12})`} />
              <text
                x={x} y={y + 0.115} textAnchor="middle" fontSize={0.32} fontWeight={800}
                fill={lit ? '#4A2E08' : '#FBE9CC'} style={{ fontFamily: 'inherit' }}
              >{k + 1}</text>
            </g>
          );
        })}

        {/* red crosses on squares a hint rules out */}
        {row?.out?.map((i) => (
          <path
            key={`x${i}`}
            d={`M${colOf(i, n) + 0.32} ${rowOf(i, n) + 0.32}l0.36 0.36M${colOf(i, n) + 0.68} ${rowOf(i, n) + 0.32}l-0.36 0.36`}
            stroke="var(--color-danger)" strokeWidth={0.09} strokeLinecap="round"
          />
        ))}
      </svg>

      {/* an accessible cell for every square */}
      <div role="grid" aria-label="Thread board" className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {Array.from({ length: n * n }, (_, i) => {
          const num = numberOf.get(i);
          const at = path.indexOf(i);
          const label =
            `Row ${rowOf(i, n) + 1}, column ${colOf(i, n) + 1}` +
            (num ? `, number ${num}` : '') +
            (hidden ? '' : at >= 0 ? `, step ${at + 1} of the line` : ', not on the line');
          return <div key={i} role="gridcell" aria-label={label} />;
        })}
      </div>
    </WoodTray>
  );
}

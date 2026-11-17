import { memo, useEffect, useMemo, useRef, type CSSProperties, type PointerEvent } from 'react';
import { mosaicGame, type MosaicPuzzle } from '@pb/engine';
import { CROSS, FILL, OPEN, useMosaic } from './store';
import { WoodTray, tileStyle } from '../../components/WoodTray';
import { LivingPicture } from './LivingPicture';

/** How long the win plaque covers the screen (see Celebrate). */
const WIN_PLAQUE_MS = 3400;

const { clueOf } = mosaicGame;

/**
 * The board: number clues on cream strips along the top and left, the squares
 * as ivory tiles in the wooden tray, and in the corner a little sketch of the
 * picture as it takes shape. Filled squares are glossy ink tiles; crossed-out
 * squares carry a small ✕. Once the picture is right it comes to life (see
 * LivingPicture): the clues fold away, the picture fills the tray in its own
 * colours, and it starts to move.
 */

/** How much room the clue strips need, in squares, for the longest clue. */
export function layoutOf(p: MosaicPuzzle): { n: number; band: number; N: number } {
  const n = p.w;
  const longest = Math.max(1, ...p.rows.map((r) => r.length), ...p.cols.map((c) => c.length));
  const band = Math.max(1.7, longest * 0.6 + 0.5);
  return { n, band, N: n + band };
}

const INK = { face: 'linear-gradient(160deg, #4C5C78 0%, #34415A 55%, #283349 100%)', side: '#1A2232' };
const IVORY = { face: 'linear-gradient(160deg, #FBF7EE 0%, #F1E9D8 100%)', side: '#CDBE9F' };
const PAPER = 'linear-gradient(180deg, #F6EEDC 0%, #EDE2C8 100%)';

/** Thin guide lines every few squares make counting easier: 4s for 8 and 12, 5s for 10. */
const guideEvery = (n: number): number => (n % 5 === 0 ? 5 : 4);

export function MosaicBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useMosaic((s) => s.puzzle);
  const paint = useMosaic((s) => s.paint);
  const status = useMosaic((s) => s.status);
  const justSolved = useMosaic((s) => s.justSolved);
  const stroke = useMosaic((s) => s.stroke);
  const hint = useMosaic((s) => s.hint);
  const hintStep = useMosaic((s) => s.hintStep);
  const { begin, extend, end } = useMosaic.getState();
  const row = hint?.steps[hintStep];

  // Press, then drag along a row or column: the first move picks the
  // direction, and the stroke stays on that line, filling any square a fast
  // finger skipped over.
  const press = useRef<{ start: number; last: number; axis: 'row' | 'col' | null } | null>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const n = puzzle?.w ?? 1;
  const cellAt = (e: PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-i]');
    return el ? Number(el.dataset.i) : null;
  };
  const showCursor = (i: number | null): void => {
    const el = cursor.current;
    if (!el) return;
    if (i === null) { el.style.opacity = '0'; return; }
    el.style.opacity = '1';
    el.style.setProperty('--r', String(Math.floor(i / n)));
    el.style.setProperty('--c', String(i % n));
  };
  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const i = cellAt(e);
    if (i === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { start: i, last: i, axis: null };
    showCursor(i);
    begin(i);
  };
  const onPointerMove = (e: PointerEvent): void => {
    const p = press.current;
    if (!p) return;
    const i = cellAt(e);
    if (i === null || i === p.last) return;
    const r0 = Math.floor(p.start / n), c0 = p.start % n;
    const r = Math.floor(i / n), c = i % n;
    if (!p.axis) {
      if (r === r0 && c === c0) return;
      p.axis = Math.abs(c - c0) >= Math.abs(r - r0) ? 'row' : 'col';
    }
    // Keep to the line: the square on it nearest the finger.
    const target = p.axis === 'row' ? r0 * n + c : r * n + c0;
    if (target === p.last) return;
    const a = p.axis === 'row' ? p.last % n : Math.floor(p.last / n);
    const b = p.axis === 'row' ? c : r;
    const dir = b > a ? 1 : -1;
    for (let k = a + dir; dir > 0 ? k <= b : k >= b; k += dir) extend(p.axis === 'row' ? r0 * n + k : k * n + c0);
    p.last = target;
    showCursor(target);
  };
  const onPointerUp = (): void => { press.current = null; showCursor(null); end(); };

  // Phones: a swipe on the board in play draws and never scrolls the page.
  const boardRef = useRef<HTMLDivElement>(null);
  const live = !hidden && status === 'in_progress';
  const playing = useRef(live);
  playing.current = live;
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const stop = (e: TouchEvent): void => { if (e.cancelable && playing.current) e.preventDefault(); };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, [puzzle]);

  // Lines whose filled squares already spell their clue: the clue fades.
  const done = useMemo(() => {
    if (!puzzle) return { rows: [] as boolean[], cols: [] as boolean[] };
    const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, k) => v === b[k]);
    const filled = paint.map((v) => (v === FILL ? 1 : 0));
    return {
      rows: puzzle.rows.map((clue, y) => same(clueOf(filled.slice(y * n, y * n + n)), clue)),
      cols: puzzle.cols.map((clue, x) => same(clueOf(Array.from({ length: n }, (_, y) => filled[y * n + x]!)), clue)),
    };
  }, [puzzle, paint, n]);

  const hintLine = !hidden && row?.line ? row.line : null;
  const lineCells = useMemo(() => {
    if (!hintLine) return null;
    return new Set(Array.from({ length: n }, (_, k) => (hintLine.kind === 'row' ? hintLine.index * n + k : k * n + hintLine.index)));
  }, [hintLine, n]);
  const fillSet = useMemo(() => new Set(hidden ? [] : row?.fill ?? []), [row, hidden]);
  const outSet = useMemo(() => new Set(hidden ? [] : row?.out ?? []), [row, hidden]);

  if (!puzzle) return null;
  const { band, N } = layoutOf(puzzle);
  const u = 100 / N;                 // one square, in % of the opening
  const q = 92.4 / N;                // one square, in cqw of the tray
  const solved = status === 'solved';
  const every = guideEvery(n);
  const hintOn = !!row && !hidden;
  // A fresh solve lets the win plaque have its moment first, then the picture wakes up.
  const wait = justSolved ? WIN_PLAQUE_MS : 0;

  return (
    <WoodTray
      gridRef={boardRef}
      grid={{
        className: `${live ? 'touch-none' : ''} select-none [-webkit-touch-callout:none]`,
        style: solved ? { backgroundColor: '#3B2A1C', ['--mo-wait' as string]: `${wait}ms` } : {},
      }}
    >
      {/* Clue strips */}
      <div
        className={`absolute ${solved ? 'pb-mo-fold' : ''}`}
        style={{ left: `${band * u}%`, top: 0, width: `${n * u}%`, height: `${band * u}%`, background: PAPER, boxShadow: 'inset 0 -0.3cqw 0.6cqw rgb(90 60 30 / 0.18)' }}
        aria-hidden="true"
      >
        {puzzle.cols.map((clue, x) => {
          const lit = hintLine?.kind === 'col' && hintLine.index === x;
          return (
            <div
              key={x}
              className="absolute bottom-0 flex flex-col items-center justify-end"
              style={{
                left: `${(x / n) * 100}%`, width: `${100 / n}%`, top: 0, paddingBottom: `${q * 0.12}cqw`,
                background: lit ? 'rgb(200 138 46 / 0.35)' : x % 2 ? 'rgb(120 90 50 / 0.06)' : undefined,
                opacity: done.cols[x] && !lit ? 0.35 : 1,
              }}
            >
              {(clue.length ? clue : [0]).map((v, k) => (
                <span key={k} className="font-extrabold leading-none tabular-nums" style={{ fontSize: `${q * 0.5}cqw`, color: lit ? '#6B4210' : '#3A2E24', marginTop: `${q * 0.08}cqw` }}>{v}</span>
              ))}
            </div>
          );
        })}
      </div>
      <div
        className={`absolute ${solved ? 'pb-mo-fold' : ''}`}
        style={{ left: 0, top: `${band * u}%`, width: `${band * u}%`, height: `${n * u}%`, background: PAPER, boxShadow: 'inset -0.3cqw 0 0.6cqw rgb(90 60 30 / 0.18)' }}
        aria-hidden="true"
      >
        {puzzle.rows.map((clue, y) => {
          const lit = hintLine?.kind === 'row' && hintLine.index === y;
          return (
            <div
              key={y}
              className="absolute right-0 flex items-center justify-end"
              style={{
                top: `${(y / n) * 100}%`, height: `${100 / n}%`, left: 0, paddingRight: `${q * 0.16}cqw`, gap: `${q * 0.2}cqw`,
                background: lit ? 'rgb(200 138 46 / 0.35)' : y % 2 ? 'rgb(120 90 50 / 0.06)' : undefined,
                opacity: done.rows[y] && !lit ? 0.35 : 1,
              }}
            >
              {(clue.length ? clue : [0]).map((v, k) => (
                <span key={k} className="font-extrabold leading-none tabular-nums" style={{ fontSize: `${q * 0.5}cqw`, color: lit ? '#6B4210' : '#3A2E24' }}>{v}</span>
              ))}
            </div>
          );
        })}
      </div>
      {/* The corner: a pencil sketch of the picture so far. */}
      <div className={`absolute flex items-center justify-center ${solved ? 'pb-mo-fold' : ''}`} style={{ left: 0, top: 0, width: `${band * u}%`, height: `${band * u}%`, background: '#E6D8BA' }} aria-hidden="true">
        <Sketch paint={hidden ? [] : paint} n={n} />
      </div>

      {/* The squares */}
      <div
        role="grid"
        aria-label="Mosaic board"
        className="absolute grid"
        style={{ left: `${band * u}%`, top: `${band * u}%`, width: `${n * u}%`, height: `${n * u}%`, gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
      >
        {paint.map((v, i) => (
          <Cell
            key={i}
            i={i}
            n={n}
            value={hidden ? OPEN : v}
            hint={!hintOn ? 0 : outSet.has(i) ? 3 : fillSet.has(i) ? 4 : lineCells ? (lineCells.has(i) ? 2 : 1) : 2}
            q={q}
          />
        ))}
        {/* Guide lines, and the row and column under the finger. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: Math.floor((n - 1) / every) }, (_, k) => (k + 1) * every).map((t) => (
            <span key={`v${t}`} className="absolute top-0 bottom-0" style={{ left: `calc(${(t / n) * 100}% - 0.18cqw)`, width: '0.36cqw', background: 'rgb(40 26 14 / 0.75)' }} />
          ))}
          {Array.from({ length: Math.floor((n - 1) / every) }, (_, k) => (k + 1) * every).map((t) => (
            <span key={`h${t}`} className="absolute left-0 right-0" style={{ top: `calc(${(t / n) * 100}% - 0.18cqw)`, height: '0.36cqw', background: 'rgb(40 26 14 / 0.75)' }} />
          ))}
        </div>
        <div ref={cursor} className="pointer-events-none absolute inset-0 opacity-0 transition-opacity" aria-hidden="true">
          <span className="absolute left-0 right-0" style={{ top: `calc(var(--r, 0) * ${100 / n}%)`, height: `${100 / n}%`, background: stroke?.value === CROSS ? 'rgb(255 236 200 / 0.16)' : 'rgb(255 226 160 / 0.2)' }} />
          <span className="absolute top-0 bottom-0" style={{ left: `calc(var(--c, 0) * ${100 / n}%)`, width: `${100 / n}%`, background: 'rgb(255 226 160 / 0.2)' }} />
        </div>
        {/* A hint's arrangement: see-through blocks with their length on them. */}
        {hintOn && row!.ghost.map((cells, k) => {
          const xs = cells.map((i) => i % n), ys = cells.map((i) => Math.floor(i / n));
          const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
          return (
            <div
              key={`${hintStep}-${k}`}
              className="pb-mo-ghost pointer-events-none absolute flex items-center justify-center"
              style={{
                left: `calc(${(x0 / n) * 100}% + 0.4cqw)`, top: `calc(${(y0 / n) * 100}% + 0.4cqw)`,
                width: `calc(${((x1 - x0 + 1) / n) * 100}% - 0.8cqw)`, height: `calc(${((y1 - y0 + 1) / n) * 100}% - 0.8cqw)`,
                borderRadius: `${q * 0.22}cqw`,
              }}
            >
              <span className="rounded-full font-extrabold leading-none text-white" style={{ fontSize: `${q * 0.42}cqw`, padding: `${q * 0.06}cqw ${q * 0.16}cqw`, background: '#A8691A' }}>{cells.length}</span>
            </div>
          );
        })}
      </div>

      {solved && !hidden && <LivingPicture puzzle={puzzle} wait={wait} from={{ left: band * u, top: band * u, size: n * u }} />}
    </WoodTray>
  );
}

/** The picture so far, drawn small in the corner: filled squares only. */
function Sketch({ paint, n }: { paint: number[]; n: number }) {
  let d = '';
  paint.forEach((v, i) => { if (v === FILL) d += `M${i % n} ${Math.floor(i / n)}h1v1h-1z`; });
  return (
    <svg viewBox={`-0.5 -0.5 ${n + 1} ${n + 1}`} className="h-[78%] w-[78%]" aria-hidden="true">
      <rect x="-0.5" y="-0.5" width={n + 1} height={n + 1} rx="0.6" fill="#F7F0E0" />
      <path d={d} fill="#34415A" shapeRendering="crispEdges" />
    </svg>
  );
}

interface CellProps {
  i: number; n: number; value: number; q: number;
  /** 0 no hint showing, 1 dimmed, 2 on the hint's line, 3 ruled out by it, 4 filled by it. */
  hint: 0 | 1 | 2 | 3 | 4;
}

const Cell = memo(function Cell(p: CellProps) {
  const r = Math.floor(p.i / p.n), c = p.i % p.n;
  const filled = p.value === FILL;
  const look = filled ? INK : IVORY;
  const ring = p.hint === 3 ? 'var(--color-danger)' : p.hint === 4 ? 'var(--color-accent)' : undefined;
  const tile: CSSProperties = tileStyle(look.face, look.side, ring);
  const what = filled ? 'filled' : p.value === CROSS ? 'crossed out' : 'empty';
  return (
    <div role="gridcell" aria-label={`Row ${r + 1}, column ${c + 1}, ${what}`} data-i={p.i} className="relative" onContextMenu={(e) => e.preventDefault()}>
      <span key={filled ? 'f' : 'o'} data-tile className={`absolute flex items-center justify-center ${filled ? 'pb-mo-press' : ''}`} style={tile}>
        {p.value === CROSS && (
          <svg viewBox="0 0 24 24" className="pb-mo-press h-[46%] w-[46%]" fill="none" stroke="#8C6A48" strokeWidth={3.2} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        )}
        {p.hint === 1 && <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[rgb(40_28_16/0.4)]" />}
        {p.hint === 3 && p.value !== CROSS && (
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute h-[56%] w-[56%] text-danger" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        )}
        {p.hint === 4 && !filled && (
          <span className="pb-mo-ghost pointer-events-none absolute rounded-[0.6cqw]" style={{ inset: '22%', background: '#C88A2E' }} />
        )}
      </span>
    </div>
  );
});

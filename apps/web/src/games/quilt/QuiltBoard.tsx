import { useCallback, useId, useMemo, useRef } from 'react';
import { quiltGame } from '@pb/engine';
import { CROWNS_PALETTE, tileColours } from '../crowns/palette';
import { WoodTray, tileStyle } from '../../components/WoodTray';
import { patchesOf, spanOf, useQuilt } from './store';

type Clue = quiltGame.Clue;

const { colOf, rowOf } = quiltGame;

// Each clue owns one pastel, LinkedIn Patches style: its badge wears it, and
// the patch you draw around it fills with it, so which clue a patch belongs
// to is never in doubt. The palette is Crowns' tray pastels.
const pick = (k: number) => CROWNS_PALETTE[k % CROWNS_PALETTE.length]!;
const rgb = (k: number, f = 1): string =>
  `rgb(${pick(k).rgb.map((v) => Math.min(255, Math.round(v * f))).join(' ')})`;
export const clueColourName = (k: number): string => pick(k).name;

// Unclaimed cells are plain ivory tiles, as on Eclipse.
const EMPTY = {
  face: 'linear-gradient(135deg, rgb(255 251 240) 0%, rgb(250 243 226) 45%, rgb(238 228 206) 100%)',
  side: 'rgb(196 180 150)',
};
const CONFLICT_TINT = 'linear-gradient(rgb(180 80 60 / 0.32), rgb(180 80 60 / 0.32))';

const BADGE: Record<quiltGame.Shape, { x: number; y: number; w: number; h: number }> = {
  square: { x: 3, y: 3, w: 18, h: 18 },
  wide: { x: 0.5, y: 5.5, w: 23, h: 13 },
  tall: { x: 5.5, y: 0.5, w: 13, h: 23 },
};

/**
 * A clue badge: its outline is the patch's shape (square, wide or tall) or a
 * round chip for a size or a free patch, and it carries the number or a "?".
 */
export function ClueBadge({ clue, k, className }: { clue: Clue; k: number; className?: string }) {
  const id = useId();
  const b = clue.kind === 'shape' ? BADGE[clue.shape] : null;
  const ink = rgb(k, 0.42);
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'h-[76%] w-[76%]'} aria-hidden="true"
      style={{ filter: 'drop-shadow(0 0.25cqw 0.25cqw rgb(60 40 20 / 0.35))', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={rgb(k, 1.04)} />
          <stop offset="1" stopColor={rgb(k, 0.84)} />
        </linearGradient>
      </defs>
      {b
        ? <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="3" fill={`url(#${id})`} stroke="#fff" strokeWidth="1.5" />
        : <circle cx="12" cy="12" r="9.5" fill={`url(#${id})`} stroke="#fff" strokeWidth="1.5" />}
      {clue.kind !== 'shape' && (
        <text x="12" y="12.4" textAnchor="middle" dominantBaseline="central" fill={ink}
          fontSize={clue.kind === 'area' && clue.area >= 10 ? 10 : 12} fontWeight="800"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {clue.kind === 'area' ? clue.area : '?'}
        </text>
      )}
    </svg>
  );
}

const describeClue = (clue: Clue): string =>
  clue.kind === 'area' ? `clue ${clue.area} cell${clue.area === 1 ? '' : 's'}`
    : clue.kind === 'shape' ? `clue ${clue.shape} patch`
      : 'clue any size';

export function QuiltBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useQuilt((s) => s.puzzle);
  const owner = useQuilt((s) => s.owner);
  const selected = useQuilt((s) => s.selected);
  const status = useQuilt((s) => s.status);
  const dragFrom = useQuilt((s) => s.dragFrom);
  const anchor = useQuilt((s) => s.anchor);
  const dragTo = useQuilt((s) => s.dragTo);
  // Derived, not subscribed: a selector that builds a new array every render
  // never settles and loops React forever.
  const patches = useMemo(() => patchesOf(puzzle, owner), [puzzle, owner]);
  const preview = useMemo(() => {
    if (!puzzle) return null;
    if (dragFrom !== null && dragTo !== null) return spanOf(dragFrom, dragTo, puzzle.n);
    if (anchor !== null && selected !== null) return spanOf(anchor, selected, puzzle.n);
    return null;
  }, [puzzle, dragFrom, dragTo, anchor, selected]);
  const { beginAt, dragOver, endDrag } = useQuilt.getState();
  const boxRef = useRef<HTMLDivElement>(null);

  /** Which cell is under this pointer? Read off the board's own box, as in Thread. */
  const cellAt = useCallback((clientX: number, clientY: number): number | null => {
    const el = boxRef.current;
    if (!el || !puzzle) return null;
    const b = el.getBoundingClientRect();
    const c = Math.floor(((clientX - b.left) / b.width) * puzzle.n);
    const r = Math.floor(((clientY - b.top) / b.height) * puzzle.n);
    if (c < 0 || r < 0 || c >= puzzle.n || r >= puzzle.n) return null;
    return r * puzzle.n + c;
  }, [puzzle]);

  if (!puzzle) return null;
  const n = puzzle.n;
  const pc = (v: number): string => `${(v / n) * 100}%`;
  const clueAt = new Map(puzzle.clues.map((clue, k) => [clue.cell, { clue, k }]));
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` };

  return (
    <WoodTray
      gridRef={boxRef}
      grid={{
        className: 'touch-none',
        // Same native-drag trap Thread hit: pressing on a glyph and moving starts
        // a browser drag, which fires pointercancel and kills every event after
        // the first, so a rectangle could grow but never shrink.
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
          if (hidden || dragFrom === null) return;
          const cell = cellAt(e.clientX, e.clientY);
          if (cell !== null) dragOver(cell);
        },
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onLostPointerCapture: endDrag,
      }}
    >
      {/* Loose ivory tiles: the cloth before any patch is cut. */}
      <div className="pointer-events-none absolute inset-0 grid" style={cols} aria-hidden="true">
        {Array.from({ length: n * n }, (_, i) => (
          <div key={i} className="relative"><span className="absolute" style={tileStyle(EMPTY.face, EMPTY.side)} /></div>
        ))}
      </div>

      {/* A drawn patch is one glossy piece in its clue's colour. */}
      {!hidden && patches.map((p, k) => {
        if (!p.rect) return null;
        const { face, side } = tileColours(k);
        return (
          <div
            key={`p${k}`}
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ left: pc(p.rect.c), top: pc(p.rect.r), width: pc(p.rect.w), height: pc(p.rect.h) }}
          >
            <span className="absolute" style={tileStyle(
              p.broken ? `${CONFLICT_TINT}, ${face}` : face,
              side,
              p.broken ? 'var(--color-danger)' : undefined,
            )} />
          </div>
        );
      })}

      {!hidden && preview && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ left: pc(preview.c), top: pc(preview.r), width: pc(preview.w), height: pc(preview.h) }}
        >
          <span className="absolute inset-[0.4cqw] rounded-[1.1cqw] border-[0.7cqw] border-dashed border-accent bg-accent/20" />
        </div>
      )}

      <div role="grid" aria-label="Quilt board" className="pointer-events-none absolute inset-0 grid" style={cols}>
        {Array.from({ length: n * n }, (_, i) => {
          const here = clueAt.get(i);
          const k = owner[i] ?? -1;
          const mine = k >= 0 ? patches[k] : undefined;
          const label =
            `Row ${rowOf(i, n) + 1}, column ${colOf(i, n) + 1}` +
            (here ? `, ${describeClue(here.clue)}` : '') +
            (hidden ? ''
              : k < 0 ? ', unassigned'
                : `, in the ${clueColourName(k)} patch${mine?.broken ? ', which breaks its clue' : ''}`);
          return (
            <div
              key={i}
              role="gridcell"
              aria-label={label}
              aria-selected={selected === i}
              draggable={false}
              className="relative flex items-center justify-center pb-[0.6cqw]"
            >
              {selected === i && (
                <span
                  className="absolute inset-[0.22cqw] rounded-[1.1cqw]"
                  style={{ boxShadow: `inset 0 0 0 0.6cqw var(${anchor !== null ? '--color-accent-text' : '--color-accent'})` }}
                />
              )}
              {here && !hidden && <ClueBadge clue={here.clue} k={here.k} />}
            </div>
          );
        })}
      </div>

      {status === 'solved' && <div className="pb-sweep pointer-events-none absolute inset-0 opacity-60" />}
    </WoodTray>
  );
}

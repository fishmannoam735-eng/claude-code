import { useCallback, useMemo, useRef } from 'react';
import { quiltGame } from '@pb/engine';

type Clue = quiltGame.Clue;
import { regionName, regionStyle } from '../../lib/regionPalette';
import { patchesOf, spanOf, useQuilt } from './store';

const { colOf, rowOf } = quiltGame;

const SWATCH: Record<quiltGame.Shape, { x: number; y: number; w: number; h: number }> = {
  square: { x: 6, y: 6, w: 12, h: 12 },
  wide: { x: 2, y: 8, w: 20, h: 8 },
  tall: { x: 8, y: 2, w: 8, h: 20 },
};

/**
 * A shape clue is drawn as a solid swatch, not an outline. An outlined
 * rectangle next to real number clues reads as a digit — the tall one was
 * indistinguishable from a 0 on the first build.
 */
export function ShapeSwatch({ shape, className }: { shape: quiltGame.Shape; className?: string }) {
  const b = SWATCH[shape];
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'h-[54%] w-[54%] text-ink'} aria-hidden="true">
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2.5" fill="currentColor" fillOpacity="0.88" />
    </svg>
  );
}

/** A patch is here, and that is all this one says. */
export function AnyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'h-[46%] w-[46%] text-ink'} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="3"
        strokeDasharray="3.6 3.4" strokeLinecap="round" />
    </svg>
  );
}

/** A clue draws what it says: a number, a proportion, or just its own ring. */
function ClueMark({ clue }: { clue: Clue }) {
  if (clue.kind === 'area') {
    return (
      <span className="text-[clamp(13px,4vw,20px)] font-bold leading-none tabular-nums text-ink">
        {clue.area}
      </span>
    );
  }
  if (clue.kind === 'any') return <AnyGlyph />;
  return <ShapeSwatch shape={clue.shape} />;
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

  return (
    <div
      ref={boxRef}
      className={`relative aspect-square w-full touch-none select-none overflow-hidden rounded-md border-2 border-ink bg-board ${status === 'solved' ? 'pb-sweep' : ''}`}
      // Same native-drag trap Thread hit: pressing on a glyph and moving starts
      // a browser drag, which fires pointercancel and kills every event after
      // the first, so a rectangle could grow but never shrink.
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (hidden) return;
        const cell = cellAt(e.clientX, e.clientY);
        if (cell === null) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        beginAt(cell);
      }}
      onPointerMove={(e) => {
        if (hidden || dragFrom === null) return;
        const cell = cellAt(e.clientX, e.clientY);
        if (cell !== null) dragOver(cell);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <svg viewBox={`0 0 ${n} ${n}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        {Array.from({ length: n - 1 }, (_, k) => (
          <g key={`g${k}`} stroke="var(--color-line-minor)" strokeWidth={0.02}>
            <line x1={k + 1} y1={0} x2={k + 1} y2={n} />
            <line x1={0} y1={k + 1} x2={n} y2={k + 1} />
          </g>
        ))}
      </svg>

      {/* Patches. Colour tells them apart at a glance; the border is what
          actually separates them, so colour is never load-bearing. */}
      {!hidden && patches.map((p, k) => p.rect && (
        <div
          key={`p${k}`}
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-[3px] border-[2.5px] ${
            p.broken ? 'border-danger' : 'border-ink'
          }`}
          style={{
            left: pc(p.rect.c), top: pc(p.rect.r),
            width: pc(p.rect.w), height: pc(p.rect.h),
            // The inline fill wins over any class, so a broken patch has to
            // swap the colour here rather than layer one on top.
            ...regionStyle(k),
            ...(p.broken ? { backgroundColor: 'var(--color-danger-soft)' } : {}),
          }}
        />
      ))}

      {!hidden && preview && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[3px] border-[2.5px] border-dashed border-accent bg-accent/15"
          style={{
            left: pc(preview.c), top: pc(preview.r),
            width: pc(preview.w), height: pc(preview.h),
          }}
        />
      )}

      <div
        role="grid"
        aria-label="Quilt board"
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: n * n }, (_, i) => {
          const here = clueAt.get(i);
          const k = owner[i] ?? -1;
          const mine = k >= 0 ? patches[k] : undefined;
          const label =
            `Row ${rowOf(i, n) + 1}, column ${colOf(i, n) + 1}` +
            (here ? `, ${describeClue(here.clue)}` : '') +
            (hidden ? ''
              : k < 0 ? ', unassigned'
                : `, in the ${regionName(k)} patch${mine?.broken ? ', which breaks its clue' : ''}`);
          return (
            <div
              key={i}
              role="gridcell"
              aria-label={label}
              aria-selected={selected === i}
              draggable={false}
              className={`pointer-events-none relative flex items-center justify-center ${
                selected === i
                  ? anchor !== null
                    ? 'shadow-[inset_0_0_0_2.5px_var(--color-accent-text)]'
                    : 'shadow-[inset_0_0_0_2.5px_var(--color-accent)]'
                  : ''
              }`}
            >
              {here && !hidden && <ClueMark clue={here.clue} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

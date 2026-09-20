import { useCallback, useMemo, useRef } from 'react';
import { threadGame } from '@pb/engine';
import { useThread } from './store';

const { colOf, rowOf, wallKey } = threadGame;

export function ThreadBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useThread((s) => s.puzzle);
  const path = useThread((s) => s.path);
  const status = useThread((s) => s.status);
  const { beginAt, dragTo, endDrag } = useThread.getState();
  const boxRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={boxRef}
      className={`relative aspect-square w-full touch-none select-none overflow-hidden rounded-md border-2 border-ink bg-board ${status === 'solved' ? 'pb-sweep' : ''}`}
      // Pressing on a number and moving makes the browser start a native drag,
      // which fires pointercancel and kills every pointer event after the
      // first — the line would extend but never retract. Suppressing the
      // default on pointerdown, plus select-none and the guard below, is what
      // keeps the stroke alive.
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
        if (hidden) return;
        const cell = cellAt(e.clientX, e.clientY);
        if (cell !== null) dragTo(cell);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <svg viewBox={`0 0 ${n} ${n}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* cell grid */}
        {Array.from({ length: n - 1 }, (_, k) => (
          <g key={`g${k}`} stroke="var(--color-line-minor)" strokeWidth={0.02}>
            <line x1={k + 1} y1={0} x2={k + 1} y2={n} />
            <line x1={0} y1={k + 1} x2={n} y2={k + 1} />
          </g>
        ))}

        {/* the line the player has drawn */}
        {!hidden && path.length > 1 && (
          <polyline
            points={path.map((i) => centre(i).join(',')).join(' ')}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={0.34}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />
        )}

        {/* walls sit on top of the line so a blocked edge always reads as blocked */}
        {wallSegments.map((w, k) => (
          <line
            key={`w${k}`}
            x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
            stroke="var(--color-ink)" strokeWidth={0.13} strokeLinecap="round"
          />
        ))}
      </svg>

      {/* numbered stops, and an accessible cell for every square */}
      <div
        role="grid"
        aria-label="Thread board"
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: n * n }, (_, i) => {
          const num = numberOf.get(i);
          const at = path.indexOf(i);
          const onPath = at >= 0;
          const isTail = at === path.length - 1 && path.length > 0;
          const label =
            `Row ${rowOf(i, n) + 1}, column ${colOf(i, n) + 1}` +
            (num ? `, number ${num}` : '') +
            (hidden ? '' : onPath ? `, step ${at + 1} of the line` : ', not on the line');
          return (
            <div key={i} role="gridcell" aria-label={label} draggable={false} className="pointer-events-none flex items-center justify-center">
              {num !== undefined && !hidden && (
                <span
                  className={`flex items-center justify-center rounded-full border-2 border-ink text-[clamp(11px,3.4vw,16px)] font-bold leading-none ${
                    onPath ? 'bg-ink text-board' : 'bg-board text-ink'
                  }`}
                  style={{ width: '62%', height: '62%' }}
                >
                  {num}
                </span>
              )}
              {num === undefined && isTail && !hidden && (
                <span className="rounded-full bg-accent-text" style={{ width: '26%', height: '26%' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

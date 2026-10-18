import { memo, useEffect, useMemo, useRef, type PointerEvent } from 'react';
import { crownsGame } from '@pb/engine';
import { crownsRegionName, tileColours } from './palette';
import { CROWN, EMPTY, MARK, useCrowns } from './store';
import crownUrl from './assets/crown.webp';
import { WoodTray, tileStyle } from '../../components/WoodTray';

const { colOf, rowOf, violations } = crownsGame;

export function CrownsBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useCrowns((s) => s.puzzle);
  const grid = useCrowns((s) => s.grid);
  const selected = useCrowns((s) => s.selected);
  const lastPlaced = useCrowns((s) => s.lastPlaced);
  const status = useCrowns((s) => s.status);
  const tapCell = useCrowns((s) => s.tapCell);
  const setCell = useCrowns((s) => s.setCell);

  // Press and drag marks every empty tile the pointer passes over with ✕. A
  // press that never leaves its tile is a tap, and only fires on release so
  // that starting a drag doesn't also cycle the first tile.
  const press = useRef<{ start: number; dragging: boolean } | null>(null);
  const cellAt = (e: PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-i]');
    return el ? Number(el.dataset.i) : null;
  };
  const markIfEmpty = (i: number): void => {
    if (useCrowns.getState().grid[i] === EMPTY) setCell(i, MARK);
  };
  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const i = cellAt(e);
    if (i === null) return;
    e.preventDefault();
    // Capture on the board itself, as Quilt does: moves keep arriving wherever
    // the finger goes, and cellAt finds the tile under it.
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { start: i, dragging: false };
  };
  const onPointerMove = (e: PointerEvent): void => {
    const p = press.current;
    if (!p) return;
    const i = cellAt(e);
    if (i === null || (!p.dragging && i === p.start)) return;
    if (!p.dragging) { p.dragging = true; markIfEmpty(p.start); }
    markIfEmpty(i);
  };
  const onPointerUp = (): void => {
    const p = press.current;
    press.current = null;
    if (p && !p.dragging) tapCell(p.start);
  };

  // Phones: a swipe must never scroll the page, select text or start a native
  // drag, or the browser cancels the pointer and the swipe marks one tile at
  // most. touch-action covers most browsers; a non-passive touchmove that
  // cancels itself covers the in-app web views that ignore it.
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const stop = (e: TouchEvent): void => { if (e.cancelable) e.preventDefault(); };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, [puzzle]);

  const bad = useMemo(
    () => (puzzle ? violations(grid, puzzle.regions) : []),
    [grid, puzzle],
  );

  if (!puzzle) return null;

  return (
    <WoodTray
      gridRef={boardRef}
      grid={{
        role: 'grid',
        'aria-label': 'Crowns board',
        className: 'grid touch-none select-none grid-cols-8 grid-rows-8 [-webkit-touch-callout:none]',
        onDragStart: (e) => e.preventDefault(),
        onPointerDown, onPointerMove, onPointerUp,
        onPointerCancel: () => { press.current = null; },
        onLostPointerCapture: () => { press.current = null; },
      }}
    >
        {grid.map((v, i) => (
          <Cell
            key={i}
            i={i}
            value={hidden ? 0 : v}
            region={puzzle.regions[i]!}
            selected={selected === i}
            conflict={!hidden && !!bad[i]}
            pop={lastPlaced === i}
          />
        ))}
        {status === 'solved' && <div className="pb-sweep pointer-events-none absolute inset-0 opacity-60" />}
    </WoodTray>
  );
}

interface CellProps {
  i: number; value: number; region: number;
  selected: boolean; conflict: boolean; pop: boolean;
}

const Cell = memo(function Cell(p: CellProps) {
  const r = rowOf(p.i), c = colOf(p.i);

  const { face, side } = tileColours(p.region);
  const tile = tileStyle(
    p.conflict ? `linear-gradient(rgb(180 80 60 / 0.35), rgb(180 80 60 / 0.35)), ${face}` : face,
    side,
    p.selected ? 'var(--color-accent)' : p.conflict ? 'var(--color-danger)' : undefined,
  );

  const what = p.value === CROWN ? 'crown' : p.value === MARK ? 'marked' : 'empty';
  const label = `Row ${r + 1}, column ${c + 1}, ${crownsRegionName(p.region)} region, ${what}${p.conflict ? ', breaks a rule' : ''}`;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={label}
      aria-selected={p.selected}
      data-i={p.i}
      onContextMenu={(e) => e.preventDefault()}
      className="relative outline-none"
    >
      <span className="absolute flex items-center justify-center" style={tile}>
        {p.value === CROWN && (
          <img
            src={crownUrl} alt="" draggable={false}
            className={`w-[78%] ${p.pop ? 'pb-pop' : ''}`}
            style={{ filter: 'drop-shadow(0.15cqw 0.4cqw 0.3cqw rgb(60 40 10 / 0.45))' }}
          />
        )}
        {p.value === MARK && (
          // Fixed dark brown rather than `ink`: the tiles stay pastel in dark mode.
          <svg viewBox="0 0 24 24" className="h-[30%] w-[30%] text-[#5C4028]/60" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        )}
      </span>
    </button>
  );
});

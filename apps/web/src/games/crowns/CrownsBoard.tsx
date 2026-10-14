import { memo, useMemo, useRef, type CSSProperties, type PointerEvent } from 'react';
import { crownsGame } from '@pb/engine';
import { crownsRegionName, tileColours } from './palette';
import { CROWN, EMPTY, MARK, useCrowns } from './store';
import crownUrl from './assets/crown.webp';
import trayUrl from './assets/tray.webp';

const { colOf, rowOf, violations } = crownsGame;

// Where the tray's opening sits in tray.webp, as a percentage of its side.
// Measured on the Kling tray render the asset was cropped from.
const OPENING = { left: 3.8, top: 4.2, size: 92.4 };

// Sizes are in cqw of the tray, so the board looks the same at any width.
const SEAM = 0.22;        // half the gap between two tiles, the same everywhere
const THICK = 0.6;        // how much of the tile's side shows below its face
const RADIUS = 1.1;

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
    // Touch captures the pointer to the first tile; release it so moves are seen across the board.
    (e.target as Element).releasePointerCapture?.(e.pointerId);
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

  const bad = useMemo(
    () => (puzzle ? violations(grid, puzzle.regions) : []),
    [grid, puzzle],
  );

  if (!puzzle) return null;

  return (
    <div
      className="relative aspect-square w-full select-none [container-type:inline-size]"
      style={{
        backgroundImage: `url(${trayUrl})`, backgroundSize: '100% 100%',
        boxShadow: '0.6cqw 1.4cqw 2.6cqw rgb(60 40 20 / 0.28)',
      }}
    >
      <div
        role="grid"
        aria-label="Crowns board"
        className="absolute grid touch-none grid-cols-8 grid-rows-8 overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { press.current = null; }}
        onPointerLeave={() => { press.current = null; }}
        style={{
          left: `${OPENING.left}%`, top: `${OPENING.top}%`,
          width: `${OPENING.size}%`, height: `${OPENING.size}%`,
          // Dark warm bed: what shows through the seams between tiles.
          backgroundColor: '#5C4028',
          borderRadius: '0.6cqw',
          boxShadow: 'inset 0 0 1.6cqw rgb(40 26 14 / 0.55)',
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
      </div>
    </div>
  );
}

interface CellProps {
  i: number; value: number; region: number;
  selected: boolean; conflict: boolean; pop: boolean;
}

const Cell = memo(function Cell(p: CellProps) {
  const r = rowOf(p.i), c = colOf(p.i);

  const tile: CSSProperties = {
    top: `${SEAM}cqw`, bottom: `${SEAM + THICK}cqw`, left: `${SEAM}cqw`, right: `${SEAM}cqw`,
    borderRadius: `${RADIUS}cqw`,
  };

  const { face, side } = tileColours(p.region);
  const ring = p.selected
    ? ', inset 0 0 0 0.6cqw var(--color-accent)'
    : p.conflict
      ? ', inset 0 0 0 0.6cqw var(--color-danger)'
      : '';
  tile.background = p.conflict
    ? `linear-gradient(rgb(180 80 60 / 0.35), rgb(180 80 60 / 0.35)), ${face}`
    : face;
  tile.boxShadow = `0 ${THICK}cqw 0 ${side}, inset 0.2cqw 0.2cqw 0 rgb(255 255 255 / 0.35)${ring}`;

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

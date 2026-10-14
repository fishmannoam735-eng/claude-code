import { memo, useMemo, type CSSProperties } from 'react';
import { crownsGame } from '@pb/engine';
import { crownsRegionName, tileColours } from './palette';
import { CROWN, MARK, useCrowns } from './store';
import crownUrl from './assets/crown.webp';
import trayUrl from './assets/tray.webp';

const { N, colOf, rowOf, violations } = crownsGame;

// Where the tray's opening sits in tray.webp, as a percentage of its side.
// Measured on the Kling tray render the asset was cropped from.
const OPENING = { left: 3.8, top: 4.2, size: 92.4 };

// Sizes are in cqw of the tray, so the board looks the same at any width.
const SEAM = 0.1;         // half the gap between two tiles of one region
const REGION_SEAM = 0.32; // half the gap where two regions meet
const THICK = 0.6;        // how much of the tile's side shows below its face
const RADIUS = 1.1;

export function CrownsBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useCrowns((s) => s.puzzle);
  const grid = useCrowns((s) => s.grid);
  const selected = useCrowns((s) => s.selected);
  const lastPlaced = useCrowns((s) => s.lastPlaced);
  const status = useCrowns((s) => s.status);
  const tapCell = useCrowns((s) => s.tapCell);

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
        className="absolute grid grid-cols-8 grid-rows-8 overflow-hidden"
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
            regions={puzzle.regions}
            selected={selected === i}
            conflict={!hidden && !!bad[i]}
            pop={lastPlaced === i}
            onTap={tapCell}
          />
        ))}
        {status === 'solved' && <div className="pb-sweep pointer-events-none absolute inset-0 opacity-60" />}
      </div>
    </div>
  );
}

interface CellProps {
  i: number; value: number; region: number; regions: number[];
  selected: boolean; conflict: boolean; pop: boolean;
  onTap: (i: number) => void;
}

const Cell = memo(function Cell(p: CellProps) {
  const r = rowOf(p.i), c = colOf(p.i);

  // Region outlines are drawn as wider seams, so colour is never load-bearing alone.
  // Each side's gap is split between the two tiles that share it.
  const gap = (there: number | undefined): number =>
    there === undefined ? SEAM : there === p.region ? SEAM : REGION_SEAM;
  const tile: CSSProperties = {
    top: `${gap(r > 0 ? p.regions[p.i - N] : undefined)}cqw`,
    bottom: `${gap(r < N - 1 ? p.regions[p.i + N] : undefined) + THICK}cqw`,
    left: `${gap(c > 0 ? p.regions[p.i - 1] : undefined)}cqw`,
    right: `${gap(c < N - 1 ? p.regions[p.i + 1] : undefined)}cqw`,
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
      onPointerDown={(e) => { e.preventDefault(); p.onTap(p.i); }}
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

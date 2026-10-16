import { memo, useId, useMemo } from 'react';
import { eclipseGame } from '@pb/engine';
import { useEclipse, MOON, SUN } from './store';
import { BED, WoodTray, tileStyle } from '../../components/WoodTray';

const { N, colOf, rowOf, violations } = eclipseGame;

// Tiles are a fixed warm ivory, darker sand for the givens, so a given reads
// as part of the board rather than something you placed. Like Crowns, they stay
// light in dark mode: they are objects in the tray, not page surface.
const ENTERED = {
  face: 'linear-gradient(135deg, rgb(255 251 240) 0%, rgb(250 243 226) 45%, rgb(238 228 206) 100%)',
  side: 'rgb(196 180 150)',
};
const GIVEN = {
  face: 'linear-gradient(135deg, rgb(240 224 192) 0%, rgb(230 211 174) 45%, rgb(214 194 156) 100%)',
  side: 'rgb(170 146 108)',
};
const CONFLICT_TINT = 'linear-gradient(rgb(180 80 60 / 0.32), rgb(180 80 60 / 0.32))';

/** A glossy gold sun: a domed disc with eight short rays. */
function Sun({ given }: { given: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className="h-[66%] w-[66%]" aria-hidden="true"
      style={{ filter: 'drop-shadow(0.1cqw 0.35cqw 0.25cqw rgb(120 70 10 / 0.45))' }}>
      <defs>
        <radialGradient id={`${id}d`} cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#FFF6C4" />
          <stop offset="0.45" stopColor="#FFC93C" />
          <stop offset="1" stopColor={given ? '#D9820F' : '#E89A1C'} />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD45A" />
          <stop offset="1" stopColor="#E08A12" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${id}r)`} strokeWidth={2} strokeLinecap="round">
        <path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8" />
      </g>
      <circle cx="12" cy="12" r="5.6" fill={`url(#${id}d)`} stroke="#C9780C" strokeOpacity={0.55} strokeWidth={0.5} />
      <ellipse cx="10.2" cy="9.6" rx="2.2" ry="1.3" fill="#fff" opacity={0.55} transform="rotate(-30 10.2 9.6)" />
    </svg>
  );
}

/** A glossy silver-blue crescent moon. */
function Moon({ given }: { given: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" aria-hidden="true"
      style={{ filter: 'drop-shadow(0.1cqw 0.35cqw 0.25cqw rgb(30 40 80 / 0.45))' }}>
      <defs>
        <linearGradient id={`${id}m`} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#EEF2FF" />
          <stop offset="0.45" stopColor="#9DB0E8" />
          <stop offset="1" stopColor={given ? '#4A5CB0' : '#5B6DC4'} />
        </linearGradient>
      </defs>
      <path d="M19.6 15.2A8.4 8.4 0 0 1 8.8 3.6a9 9 0 1 0 10.8 11.6z"
        fill={`url(#${id}m)`} stroke="#3E4C96" strokeOpacity={0.5} strokeWidth={0.5} strokeLinejoin="round" />
      <path d="M6.6 7.4a7 7 0 0 0 .4 7.4" fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.1} strokeLinecap="round" />
    </svg>
  );
}

export function EclipseBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useEclipse((s) => s.puzzle);
  const grid = useEclipse((s) => s.grid);
  const selected = useEclipse((s) => s.selected);
  const lastPlaced = useEclipse((s) => s.lastPlaced);
  const status = useEclipse((s) => s.status);
  const tapCell = useEclipse((s) => s.tapCell);

  const bad = useMemo(
    () => (puzzle ? violations(grid, puzzle.edges) : []),
    [grid, puzzle],
  );

  if (!puzzle) return null;

  // Edge clues sit on the seam between two tiles, as small dark wooden chips.
  const badges = hidden ? null : puzzle.edges.map((e) => {
    const horizontal = e.b === e.a + 1;
    const r = rowOf(e.a), c = colOf(e.a);
    const left = horizontal ? ((c + 1) / N) * 100 : ((c + 0.5) / N) * 100;
    const top = horizontal ? ((r + 0.5) / N) * 100 : ((r + 1) / N) * 100;
    return (
      <div
        key={`${e.a}-${e.b}`}
        aria-hidden="true"
        className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-bold leading-none"
        style={{
          left: `${left}%`, top: `${top}%`,
          width: '5.4cqw', height: '5.4cqw', fontSize: '3.6cqw',
          background: `radial-gradient(circle at 35% 30%, #8A6440, ${BED} 70%)`,
          color: '#FBEFD8',
          boxShadow: '0 0.35cqw 0.5cqw rgb(40 26 14 / 0.5), inset 0 0.15cqw 0 rgb(255 255 255 / 0.25)',
        }}
      >
        {e.same ? '=' : '×'}
      </div>
    );
  });

  return (
    <WoodTray
      grid={{ role: 'grid', 'aria-label': 'Eclipse board', className: 'grid grid-cols-6 grid-rows-6' }}
      overlay={badges}
    >
      {grid.map((v, i) => (
        <Cell
          key={i}
          i={i}
          value={hidden ? 0 : v}
          given={puzzle.givens[i] !== 0}
          selected={selected === i}
          conflict={!hidden && !!bad[i]}
          pop={lastPlaced === i}
          onTap={tapCell}
        />
      ))}
      {status === 'solved' && <div className="pb-sweep pointer-events-none absolute inset-0 opacity-60" />}
    </WoodTray>
  );
}

interface CellProps {
  i: number; value: number; given: boolean; selected: boolean;
  conflict: boolean; pop: boolean; onTap: (i: number) => void;
}

const Cell = memo(function Cell(p: CellProps) {
  const r = rowOf(p.i), c = colOf(p.i);
  const { face, side } = p.given ? GIVEN : ENTERED;
  const tile = tileStyle(
    p.conflict ? `${CONFLICT_TINT}, ${face}` : face,
    side,
    p.selected ? 'var(--color-accent)' : p.conflict ? 'var(--color-danger)' : undefined,
  );

  const name = p.value === SUN ? 'sun' : p.value === MOON ? 'moon' : 'empty';
  const label = `Row ${r + 1}, column ${c + 1}, ${p.given ? `given ${name}` : name}${p.conflict ? ', breaks a rule' : ''}`;
  const pop = p.pop ? 'pb-pop' : '';

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
        {p.value === SUN && <span className={`flex h-full w-full items-center justify-center ${pop}`}><Sun given={p.given} /></span>}
        {p.value === MOON && <span className={`flex h-full w-full items-center justify-center ${pop}`}><Moon given={p.given} /></span>}
      </span>
    </button>
  );
});

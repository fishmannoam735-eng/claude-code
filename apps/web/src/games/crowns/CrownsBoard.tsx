import { memo, useMemo } from 'react';
import { crownsGame } from '@pb/engine';
import { regionName, regionStyle } from '../../lib/regionPalette';
import { CROWN, MARK, useCrowns } from './store';

const { N, colOf, rowOf, violations } = crownsGame;

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
      role="grid"
      aria-label="Crowns board"
      className={`grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-md border-2 border-ink ${status === 'solved' ? 'pb-sweep' : ''}`}
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

  // A region boundary is always drawn, so colour is never load-bearing alone.
  const edge = (there: number | undefined): boolean => there === undefined || there !== p.region;
  const right = c === N - 1 ? '' : edge(p.regions[p.i + 1]) ? 'border-r-[2.5px] border-r-ink' : 'border-r border-r-ink/20';
  const bottom = r === N - 1 ? '' : edge(p.regions[p.i + N]) ? 'border-b-[2.5px] border-b-ink' : 'border-b border-b-ink/20';

  const fill = regionStyle(p.region, p.value === CROWN && !p.conflict);
  // Tailwind only sees class names it can read in the source, so these stay
  // whole strings rather than being assembled from parts.
  const ring = p.selected
    ? 'shadow-[inset_0_0_0_2.5px_var(--color-accent)]'
    : p.value !== CROWN
      ? ''
      : p.conflict
        ? 'shadow-[inset_0_0_0_2.5px_var(--color-danger)]'
        : 'shadow-[inset_0_0_0_2.5px_var(--color-ink)]';

  const what = p.value === CROWN ? 'crown' : p.value === MARK ? 'marked' : 'empty';
  const label = `Row ${r + 1}, column ${c + 1}, ${regionName(p.region)} region, ${what}${p.conflict ? ', breaks a rule' : ''}`;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={label}
      aria-selected={p.selected}
      onPointerDown={(e) => { e.preventDefault(); p.onTap(p.i); }}
      style={p.conflict ? undefined : fill}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative flex items-center justify-center outline-none select-none ${right} ${bottom} ${ring} ${p.conflict ? 'bg-danger-soft' : ''}`}
    >
      {p.value === CROWN && (
        <svg
          viewBox="0 0 24 24" className={`h-[62%] w-[62%] ${p.pop ? 'pb-pop' : ''} ${p.conflict ? 'text-danger' : 'text-ink'}`}
          fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M4 18h16M4 18L3 8l5 3.5L12 5l4 6.5L21 8l-1 10" />
        </svg>
      )}
      {p.value === MARK && (
        <svg viewBox="0 0 24 24" className="h-[30%] w-[30%] text-ink/45" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )}
    </button>
  );
});

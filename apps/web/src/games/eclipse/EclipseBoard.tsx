import { memo, useMemo } from 'react';
import { eclipseGame } from '@pb/engine';
import { useEclipse, MOON, SUN } from './store';

const { N, colOf, rowOf, violations } = eclipseGame;

function Sun({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.4" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 3.4v2.1M12 18.5v2.1M3.4 12h2.1M18.5 12h2.1M6 6l1.5 1.5M16.5 16.5 18 18M6 18l1.5-1.5M16.5 7.5 18 6" />
    </svg>
  );
}

function Moon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[54%] w-[54%]" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
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

  return (
    <div className={`relative aspect-square w-full ${status === 'solved' ? 'pb-sweep' : ''}`}>
      <div role="grid" aria-label="Eclipse board" className="grid h-full w-full grid-cols-6 grid-rows-6 overflow-hidden rounded-md border-2 border-line-major bg-board">
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
      </div>

      {/* Edge badges sit on the line between two cells, above the grid. */}
      {!hidden && puzzle.edges.map((e) => {
        const horizontal = e.b === e.a + 1;
        const r = rowOf(e.a), c = colOf(e.a);
        const left = horizontal ? ((c + 1) / N) * 100 : ((c + 0.5) / N) * 100;
        const top = horizontal ? ((r + 0.5) / N) * 100 : ((r + 1) / N) * 100;
        return (
          <div
            key={`${e.a}-${e.b}`}
            aria-hidden="true"
            style={{ left: `${left}%`, top: `${top}%` }}
            className="pointer-events-none absolute z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-ink bg-board text-[11px] font-bold leading-none text-ink"
          >
            {e.same ? '=' : '×'}
          </div>
        );
      })}
    </div>
  );
}

interface CellProps {
  i: number; value: number; given: boolean; selected: boolean;
  conflict: boolean; pop: boolean; onTap: (i: number) => void;
}

const Cell = memo(function Cell(p: CellProps) {
  const r = rowOf(p.i), c = colOf(p.i);
  const right = c === N - 1 ? '' : 'border-r border-r-line-minor';
  const bottom = r === N - 1 ? '' : 'border-b border-b-line-minor';

  const bg = p.conflict ? 'bg-danger-soft' : p.selected ? 'bg-sel' : p.given ? 'bg-raised-2' : '';
  const ring = p.selected
    ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
    : p.conflict ? 'shadow-[inset_0_0_0_1.5px_var(--color-danger)]' : '';
  const color = p.conflict ? 'text-danger' : p.given ? 'text-ink' : 'text-ink-entered';

  const name = p.value === SUN ? 'sun' : p.value === MOON ? 'moon' : 'empty';
  const label = `Row ${r + 1}, column ${c + 1}, ${p.given ? `given ${name}` : name}`;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={label}
      aria-selected={p.selected}
      onPointerDown={(e) => { e.preventDefault(); p.onTap(p.i); }}
      className={`flex items-center justify-center outline-none select-none ${right} ${bottom} ${bg} ${ring} ${color}`}
    >
      {p.value === SUN && <span className={p.pop ? 'pb-pop flex h-full w-full items-center justify-center' : 'flex h-full w-full items-center justify-center'}><Sun filled={p.given} /></span>}
      {p.value === MOON && <span className={p.pop ? 'pb-pop flex h-full w-full items-center justify-center' : 'flex h-full w-full items-center justify-center'}><Moon filled={p.given} /></span>}
    </button>
  );
});

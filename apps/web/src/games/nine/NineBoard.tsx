import { memo, useMemo } from 'react';
import { nineGame } from '@pb/engine';
import { useNine } from './store';

const NOTE_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function NineBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useNine((s) => s.puzzle);
  const grid = useNine((s) => s.grid);
  const notes = useNine((s) => s.notes);
  const selected = useNine((s) => s.selected);
  const highlightDigit = useNine((s) => s.highlightDigit);
  const lastPlaced = useNine((s) => s.lastPlaced);
  const lastWrong = useNine((s) => s.lastWrong);
  const status = useNine((s) => s.status);
  const selectCell = useNine((s) => s.selectCell);

  const clash = useMemo(() => nineGame.conflicts(grid), [grid]);
  const peers = useMemo(() => {
    const set = new Set<number>();
    if (selected !== null) for (const j of nineGame.PEERS[selected]!) set.add(j);
    return set;
  }, [selected]);

  if (!puzzle) return null;

  return (
    <div
      role="grid"
      aria-label="Sudoku board"
      className={`grid aspect-square w-full grid-cols-9 grid-rows-9 overflow-hidden rounded-md border-2 border-line-major bg-board ${status === 'solved' ? 'pb-sweep' : ''}`}
    >
      {grid.map((v, i) => (
        <Cell
          key={i}
          i={i}
          value={hidden ? 0 : v}
          notes={hidden ? 0 : notes[i]!}
          given={puzzle.givens[i] !== 0}
          selected={selected === i}
          peer={peers.has(i)}
          same={!hidden && highlightDigit !== null && v === highlightDigit}
          conflict={!hidden && clash[i]!}
          pop={lastPlaced === i}
          shake={lastWrong === i}
          onSelect={selectCell}
        />
      ))}
    </div>
  );
}

interface CellProps {
  i: number; value: number; notes: number; given: boolean;
  selected: boolean; peer: boolean; same: boolean; conflict: boolean;
  pop: boolean; shake: boolean;
  onSelect: (i: number) => void;
}

const Cell = memo(function Cell(p: CellProps) {
  const r = nineGame.rowOf(p.i), c = nineGame.colOf(p.i);
  const right = c === 2 || c === 5 ? 'border-r-2 border-r-line-major' : c === 8 ? '' : 'border-r border-r-line-minor';
  const bottom = r === 2 || r === 5 ? 'border-b-2 border-b-line-major' : r === 8 ? '' : 'border-b border-b-line-minor';

  let bg = '';
  if (p.peer) bg = 'bg-peer';
  if (p.same) bg = 'bg-same';
  if (p.conflict) bg = 'bg-danger-soft';
  if (p.selected) bg = 'bg-sel';

  let ring = '';
  if (p.selected) ring = 'shadow-[inset_0_0_0_2px_var(--color-accent)]';
  else if (p.conflict) ring = 'shadow-[inset_0_0_0_1.5px_var(--color-danger)]';
  // `same` gets its fill only — a ring on top of the blue digit reads as noise.

  const color = p.conflict ? 'text-danger' : p.given ? 'text-ink' : 'text-ink-entered';
  const label = `Row ${r + 1}, column ${c + 1}, ${p.value ? (p.given ? `given ${p.value}` : p.value) : p.notes ? `notes ${NOTE_SLOTS.filter((d) => p.notes & (1 << d)).join(' ')}` : 'empty'}`;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={label}
      aria-selected={p.selected}
      onPointerDown={(e) => { e.preventDefault(); p.onSelect(p.i); }}
      className={`relative flex items-center justify-center select-none outline-none ${right} ${bottom} ${bg} ${ring} ${p.shake ? 'pb-shake' : ''}`}
    >
      {p.value !== 0 ? (
        <span
          key={p.value}
          className={`text-[clamp(17px,5.4vw,24px)] leading-none tracking-[0.5px] ${p.given ? 'font-semibold' : 'font-medium'} ${color} ${p.pop ? 'pb-pop' : ''}`}
        >
          {p.value}
        </span>
      ) : p.notes !== 0 ? (
        <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[2px]">
          {NOTE_SLOTS.map((d) => (
            <span key={d} className={`flex items-center justify-center text-[clamp(7px,2.3vw,10px)] leading-none ${p.notes & (1 << d) ? 'text-ink-note' : 'text-transparent'}`}>
              {d}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
});

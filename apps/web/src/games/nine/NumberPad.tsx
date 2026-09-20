import { digitsRemaining, useNine } from './store';

export function NumberPad() {
  const grid = useNine((s) => s.grid);
  const locked = useNine((s) => s.lockedDigit);
  const tapDigit = useNine((s) => s.tapDigit);
  const left = digitsRemaining(grid);

  return (
    <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Number pad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
        const on = locked === d;
        const done = left[d] === 0;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={`${d}, ${left[d]} remaining${on ? ', locked' : ''}`}
            onPointerDown={(e) => { e.preventDefault(); tapDigit(d); }}
            className={`flex h-14 flex-col items-center justify-center gap-px rounded-2xl border transition-colors ${
              on ? 'border-accent bg-accent text-surface' : 'border-line-minor bg-raised text-ink active:bg-raised-2'
            } ${done && !on ? 'opacity-40' : ''}`}
          >
            <span className="text-2xl font-semibold leading-none">{d}</span>
            <span className={`text-[10px] leading-none ${on ? 'text-surface/80' : 'text-ink-2'}`}>{left[d]}</span>
          </button>
        );
      })}
    </div>
  );
}

import { useState, type ReactNode } from 'react';

/**
 * Small hand-made charts in the app's own look: thin rounded bars on a quiet
 * baseline, a tooltip on hover or tap, no axes beyond what the reader needs.
 * Only transform and opacity animate.
 */

export interface BarDatum { key: string; label: string; segments: { value: number; colour: string; name: string }[] }

export function BarChart({ data, height = 120, title, legend, ariaLabel }: {
  data: BarDatum[]; height?: number; title?: string; legend?: { name: string; colour: string }[]; ariaLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const totals = data.map((d) => d.segments.reduce((s, x) => s + x.value, 0));
  const max = Math.max(1, ...totals);
  const shown = active ?? data.length - 1;
  const cur = data[shown];

  return (
    <figure className="m-0" aria-label={ariaLabel}>
      <div className="flex flex-col gap-1">
        {title && <figcaption className="text-[13px] font-semibold">{title}</figcaption>}
        {legend && legend.length > 1 && (
          <div className="flex gap-3 text-[11px] text-ink-2">
            {legend.map((l) => (
              <span key={l.name} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: l.colour }} />{l.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* The reading for the bar under the finger (the latest one by default). */}
      <div className="mt-1 h-5 text-[12px] text-ink-2" aria-live="polite">
        {cur && (
          <>
            <span className="font-semibold text-ink">{cur.label}</span>
            {cur.segments.map((s) => <span key={s.name}> · {s.value.toLocaleString('en-US')} {s.name}</span>)}
          </>
        )}
      </div>
      <div
        className="relative mt-1 flex items-end gap-[3px] border-b border-line-major"
        style={{ height }}
        onPointerLeave={() => setActive(null)}
      >
        {data.map((d, i) => (
          <button
            type="button"
            key={d.key}
            aria-label={`${d.label}: ${d.segments.map((s) => `${s.value} ${s.name}`).join(', ')}`}
            className="relative flex h-full flex-grow basis-0 flex-col justify-end"
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
          >
            <div
              className="pb-grow-y flex w-full flex-col-reverse gap-[2px]"
              style={{ height: `${(totals[i]! / max) * 100}%`, ['--d' as string]: `${i * 28}ms` }}
            >
              {d.segments.map((s, k) => s.value > 0 && (
                <div
                  key={s.name}
                  className={k === d.segments.length - 1 || d.segments.slice(k + 1).every((x) => x.value === 0) ? 'rounded-t-[4px]' : ''}
                  style={{
                    flexGrow: s.value,
                    minHeight: 2,
                    background: s.colour,
                    opacity: active === null || active === i ? 1 : 0.45,
                    transition: 'opacity 120ms',
                  }}
                />
              ))}
            </div>
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-ink-2">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </figure>
  );
}

/** One labelled horizontal bar — the label carries identity, so colour never has to. */
export function MeterRow({ icon, label, value, max, colour, right, sub, delay = 0 }: {
  icon?: ReactNode; label: string; value: number; max: number; colour: string; right: ReactNode; sub?: ReactNode; delay?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div className="min-w-0 flex-grow">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-semibold">{label}</span>
          <span className="flex-shrink-0 text-[12.5px] font-semibold tabular-nums">{right}</span>
        </div>
        <div className="mt-1 h-[7px] w-full overflow-hidden rounded-full bg-raised-2 shadow-[inset_0_1px_1px_rgb(60_40_20/0.12)]">
          <div
            className="pb-grow h-full rounded-full"
            style={{ width: `${pct * 100}%`, background: `linear-gradient(90deg, ${colour}, color-mix(in srgb, ${colour} 65%, white))`, ['--d' as string]: `${delay}ms` }}
          />
        </div>
        {sub && <div className="mt-1 text-[11px] text-ink-2">{sub}</div>}
      </div>
    </div>
  );
}

/** A big number with a small word under it, on an ivory tile. */
export function StatTile({ value, label, icon, delay = 0 }: { value: ReactNode; label: string; icon?: ReactNode; delay?: number }) {
  return (
    <div
      className="pb-in flex flex-col items-start rounded-[14px] px-3 py-2.5"
      style={{
        ['--d' as string]: `${delay}ms`,
        background: 'linear-gradient(135deg, rgb(255 251 240) 0%, rgb(250 243 226) 45%, rgb(236 224 200) 100%)',
        boxShadow: '0 3px 0 rgb(176 158 126), inset 1px 1px 0 rgb(255 255 255 / 0.6)',
        marginBottom: 3,
        color: '#3B2A14',
      }}
    >
      <span className="flex items-center gap-1 text-[21px] font-extrabold leading-tight tabular-nums">{icon}{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7A6440]">{label}</span>
    </div>
  );
}

/** Easy / normal / hard as one bar in a single hue, light to dark, each part labelled. */
export function SplitBar({ parts }: { parts: { name: string; value: number; colour: string; ink: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <div className="text-[12px] text-ink-2">No boards finished this week yet.</div>;
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-[8px]">
        {parts.filter((p) => p.value > 0).map((p, k) => (
          <div
            key={p.name}
            className="pb-in flex items-center justify-center text-[11px] font-bold"
            style={{ flexGrow: p.value, background: p.colour, color: p.ink, ['--d' as string]: `${k * 90}ms` }}
          >
            {Math.round((p.value / total) * 100)}%
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-3 text-[11.5px] text-ink-2">
        {parts.map((p) => (
          <span key={p.name} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: p.colour }} />
            {p.name} {p.value}
          </span>
        ))}
      </div>
    </div>
  );
}

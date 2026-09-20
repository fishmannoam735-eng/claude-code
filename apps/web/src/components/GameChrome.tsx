import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Difficulty, ParsedSeed } from '@pb/engine';
import { localDateKey } from '@pb/engine';
import { Icon } from './Icon';
import { fmtTime, DIFF_LABEL } from '../lib/format';

/** Re-renders once a second while the clock runs, and not at all when it doesn't. */
export function Timer({ elapsed, running }: { elapsed: () => number; running: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return <span className="text-xl font-semibold tabular-nums tracking-tight">{fmtTime(elapsed())}</span>;
}

export function GameHeader(props: {
  title: string;
  parsed: ParsedSeed;
  subtitle: string;
  elapsed: () => number;
  running: boolean;
  solved: boolean;
  onTogglePause: () => void;
}) {
  const paused = !props.solved && !props.running;
  const isToday = props.parsed.isDaily && props.parsed.key === localDateKey();
  return (
    <header className="flex h-13 items-center gap-3">
      <Link to="/" aria-label="Back to today" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-minor bg-raised text-ink">
        <Icon.Back />
      </Link>
      <div className="flex flex-grow flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">{props.title}</span>
          <span className="rounded-full border border-line-minor bg-accent-soft px-2 py-0.5 text-[10px] font-bold tracking-wider text-accent-text">
            {DIFF_LABEL[props.parsed.difficulty].toUpperCase()}
          </span>
          {!props.parsed.isDaily && <span className="text-[11px] text-ink-2">practice</span>}
          {props.parsed.isDaily && !isToday && <span className="text-[11px] text-ink-2">{props.parsed.key}</span>}
        </div>
        <div className="text-[11px] text-ink-2">{props.subtitle}</div>
      </div>
      <Timer elapsed={props.elapsed} running={props.running} />
      <button
        type="button"
        aria-label={paused ? 'Resume' : 'Pause'}
        disabled={props.solved}
        onClick={props.onTogglePause}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-minor bg-raised text-ink-2 disabled:opacity-40"
      >
        {paused ? <Icon.Play /> : <Icon.Pause />}
      </button>
    </header>
  );
}

/** Covers the board while paused, so a paused puzzle can't be studied for free. */
export function PausedOverlay({ onResume }: { onResume: () => void }) {
  return (
    <button
      type="button"
      onClick={onResume}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-board/95 text-ink"
    >
      <Icon.Play width={32} height={32} />
      <span className="text-sm font-semibold">Paused — tap to resume</span>
    </button>
  );
}

export function ActionButton(p: {
  label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled}
      aria-pressed={p.active}
      className={`flex h-14 flex-grow flex-col items-center justify-center gap-1 rounded-2xl border text-[11px] disabled:opacity-40 ${
        p.active ? 'border-accent bg-accent-soft font-semibold text-accent-text' : 'border-line-minor bg-raised text-ink-2'
      }`}
    >
      {p.children}
      <span>{p.label}</span>
    </button>
  );
}

export function SolvedCard(props: {
  elapsedMs: number;
  mistakes: number;
  /** What a mistake is called in this game; Thread counts steps back. */
  mistakeWord?: string;
  streak: number | null;
  shareLabel: string | null;
  onShare: () => void;
  practiceHref: string | null;
  difficulty: Difficulty;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-line-minor bg-raised p-5">
      <div className="flex items-center gap-2 text-success">
        <Icon.Check />
        <span className="text-lg font-bold">Solved</span>
      </div>
      <div className="mt-2 flex items-baseline gap-4">
        <span className="text-3xl font-semibold tabular-nums">{fmtTime(props.elapsedMs)}</span>
        <span className="text-sm text-ink-2">
          {((word) => (props.mistakes === 0
            ? `no ${word}s`
            : `${props.mistakes} ${word}${props.mistakes === 1 ? '' : 's'}`))(props.mistakeWord ?? 'mistake')}
        </span>
        {props.streak !== null && props.streak > 0 && (
          <span className="flex items-center gap-1 text-sm font-semibold text-accent-text">
            <Icon.Flame width={14} height={14} /> {props.streak}
          </span>
        )}
      </div>
      <div className="mt-4 flex gap-2.5">
        <button type="button" onClick={props.onShare} className="flex h-12 flex-grow items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-ink">
          <Icon.Share /> {props.shareLabel ?? 'Share'}
        </button>
        <Link to="/" className="flex h-12 flex-grow items-center justify-center rounded-xl border border-line-minor bg-raised text-sm font-semibold text-ink">
          Back to today
        </Link>
      </div>
      {props.practiceHref && (
        <Link to={props.practiceHref} className="mt-3 block text-center text-sm font-semibold text-accent-text">
          Another {DIFF_LABEL[props.difficulty].toLowerCase()} one →
        </Link>
      )}
    </div>
  );
}

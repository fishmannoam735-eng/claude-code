import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Difficulty, ParsedSeed } from '@pb/engine';
import { localDateKey, parseSeed, scorePlay } from '@pb/engine';
import { fetchLeaderboard, fetchPlay } from '@pb/data';
import { Icon } from './Icon';
import { GAME_COLOR, GAME_INK } from './GameMark';
import { fmtTime, DIFF_LABEL } from '../lib/format';
import { useSoundSetting } from '../lib/sound';
import { readAssists } from '../lib/assists';
import { supabase, useSession } from '../lib/session';
import { fmtPoints, ordinal, useMe } from '../lib/contest';

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
          {/* The chip wears the game's own colour, so the board and its card
              on the home screen read as the same object. */}
          <span
            className="pb-game rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider"
            style={{
              ['--pb-game' as string]: GAME_COLOR[props.parsed.game],
              color: GAME_INK[props.parsed.game],
            }}
          >
            {DIFF_LABEL[props.parsed.difficulty].toUpperCase()}
          </span>
          {!props.parsed.isDaily && <span className="text-[11px] text-ink-2">practice</span>}
          {props.parsed.isDaily && !isToday && <span className="text-[11px] text-ink-2">{props.parsed.key}</span>}
        </div>
        <div className="text-[11px] text-ink-2">{props.subtitle}</div>
      </div>
      <Timer elapsed={props.elapsed} running={props.running} />
      <SoundToggle />
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

function SoundToggle() {
  const on = useSoundSetting((s) => s.on);
  const toggle = useSoundSetting((s) => s.toggle);
  return (
    <button
      type="button"
      aria-label={on ? 'Mute sounds' : 'Turn sounds on'}
      aria-pressed={on}
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-minor bg-raised text-ink-2"
    >
      {on ? <Icon.Sound /> : <Icon.Mute />}
    </button>
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
  seed: string;
  elapsedMs: number;
  /** Left out by games that count no mistakes (Eclipse). */
  mistakes?: number;
  /** What a mistake is called in this game; Thread counts steps back. */
  mistakeWord?: string;
  /** The mistakes that cost points (Thread's steps back don't). */
  scoreMistakes: number;
  streak: number | null;
  shareLabel: string | null;
  onShare: () => void;
  difficulty: Difficulty;
}) {
  const parsed = parseSeed(props.seed);
  return (
    <div data-solved-card className="pb-rise mt-5 rounded-2xl border border-line-minor bg-raised p-5">
      <div className="flex items-center gap-2 text-success">
        <Icon.Check />
        <span className="text-lg font-bold">Solved</span>
      </div>
      <div className="mt-2 flex items-baseline gap-4">
        <span className="text-3xl font-semibold tabular-nums">{fmtTime(props.elapsedMs)}</span>
        {props.mistakes !== undefined && (
          <span className="text-sm text-ink-2">
            {((word, n) => (n === 0
              ? `no ${word}s`
              : `${n} ${word}${n === 1 ? '' : 's'}`))(props.mistakeWord ?? 'mistake', props.mistakes)}
          </span>
        )}
        {props.streak !== null && props.streak > 0 && (
          <span className="flex items-center gap-1 text-sm font-semibold text-accent-text">
            <Icon.Flame width={14} height={14} /> {props.streak}
          </span>
        )}
      </div>
      {parsed && <ScorePanel seed={props.seed} elapsedMs={props.elapsedMs} mistakes={props.scoreMistakes} />}
      <div className="mt-4 flex gap-2.5">
        <button type="button" onClick={props.onShare} className="pb-key flex h-12 flex-grow basis-0 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-ink" style={{ ['--key-side' as string]: '#94621C' }}>
          <Icon.Share /> {props.shareLabel ?? 'Share'}
        </button>
        {parsed && (
          <Link
            to={`/practice/${parsed.game}/${props.difficulty}`}
            className="pb-key flex h-12 flex-grow basis-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(160deg, #6FA27D, #437A55)', ['--key-side' as string]: '#2E5A3C' }}
          >
            <Icon.Play width={16} height={16} /> Play again
          </Link>
        )}
      </div>
      <div className="mt-2.5 flex gap-2.5">
        <Link to="/rankings" className="pb-key flex h-11 flex-grow basis-0 items-center justify-center gap-1.5 rounded-xl bg-raised-2 text-[13px] font-semibold text-ink">
          <Icon.Trophy width={16} height={16} /> Rankings
        </Link>
        <Link to="/" className="pb-key flex h-11 flex-grow basis-0 items-center justify-center rounded-xl bg-raised-2 text-[13px] font-semibold text-ink">
          Back to today
        </Link>
      </div>
      <p className="mt-2 text-center text-[11.5px] text-ink-2">Play again gives you a new {DIFF_LABEL[props.difficulty].toLowerCase()} board of the same game.</p>
    </div>
  );
}

/**
 * The points for this solve, line by line, then what they count for. Shown
 * from the local numbers at once and replaced by the server's when it answers,
 * because the server's are the ones that rank.
 */
function ScorePanel({ seed, elapsedMs, mistakes }: { seed: string; elapsedMs: number; mistakes: number }) {
  const parsed = parseSeed(seed)!;
  const userId = useSession((s) => s.userId);
  const assists = readAssists(seed);
  const local = scorePlay({
    game: parsed.game, difficulty: parsed.difficulty, durationMs: elapsedMs,
    hints: assists.hints, mistakes, fills: assists.fills,
  });
  const [server, setServer] = useState<{ score: number; contest: boolean } | null>(null);
  const [rank, setRank] = useState<{ rank: number; players: number } | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!supabase || !userId) { setOffline(true); return; }
    let alive = true;
    let tries = 0;
    const poll = async (): Promise<void> => {
      tries++;
      try {
        const row = await fetchPlay(supabase!, userId, seed);
        if (!alive) return;
        if (row && row.status === 'solved' && row.score !== null) {
          setServer({ score: row.score, contest: row.contest });
          void useMe.getState().refresh();
          if (row.contest && row.puzzle_date) {
            const rows = await fetchLeaderboard(supabase!, 'day', row.puzzle_date, null, 500);
            const me = rows.find((r) => r.is_me);
            if (alive && me) setRank({ rank: me.rank, players: rows.length });
          }
          return;
        }
      } catch { /* try again */ }
      if (alive && tries < 8) window.setTimeout(() => { void poll(); }, 1200);
      else if (alive) setOffline(true);
    };
    const t = window.setTimeout(() => { void poll(); }, 700);
    return () => { alive = false; window.clearTimeout(t); };
  }, [seed, userId]);

  const total = server?.score ?? local.total;
  const rows: [string, number][] = [
    [`${DIFF_LABEL[parsed.difficulty]} board`, local.base],
    [local.speed >= 0 ? 'Speed bonus' : 'Slow finish', local.speed],
  ];
  if (local.hints) rows.push([`${assists.hints} hint${assists.hints === 1 ? '' : 's'}`, -local.hints]);
  if (local.mistakes) rows.push([`${mistakes} mistake${mistakes === 1 ? '' : 's'}`, -local.mistakes]);
  if (local.fill) rows.push(['Fill used', -local.fill]);

  let note: string;
  if (!parsed.isDaily) note = 'Practice board. The points go to your personal score.';
  else if (!server) note = offline ? 'Offline: points will be saved when you are back online.' : 'Sending your score…';
  else if (server.contest) note = rank ? `Counts for today's contest. You are ${ordinal(rank.rank)} of ${rank.players} today.` : "Counts for today's contest.";
  else note = 'Your first daily board of this game already counts for the contest, so these points go to your personal score.';

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line-minor">
      <div className="pb-wood relative flex items-center justify-between px-3.5 py-2.5 text-[#FFF4E2]">
        <span className="text-[13px] font-bold tracking-tight [text-shadow:0_1px_1px_rgb(60_30_5/0.5)]">Points</span>
        <span className="pb-plaque-sm pb-stamp rounded-lg px-3 py-0.5 text-[22px] font-extrabold tabular-nums text-[#4E2E04]" style={{ ['--d' as string]: '300ms' }}>
          +{fmtPoints(total)}
        </span>
      </div>
      <dl className="flex flex-col gap-1 bg-raised px-3.5 py-2.5 text-[12.5px]">
        {rows.map(([label, v]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-ink-2">{label}</dt>
            <dd className={`font-semibold tabular-nums ${v < 0 ? 'text-danger' : ''}`}>{v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}</dd>
          </div>
        ))}
      </dl>
      <div className={`flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium ${server?.contest ? 'bg-accent-soft text-accent-text' : 'bg-raised-2 text-ink-2'}`}>
        {server?.contest ? <Icon.Trophy width={14} height={14} /> : <Icon.Check width={13} height={13} />}
        {note}
      </div>
    </div>
  );
}

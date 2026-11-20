import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Difficulty, ParsedSeed } from '@pb/engine';
import { localDateKey, parseSeed, scorePlay } from '@pb/engine';
import { fetchLeaderboard, fetchPlay } from '@pb/data';
import { Icon } from './Icon';
import { GAME_COLOR, GAME_INK } from './GameMark';
import { fmtTime, DIFF_LABEL } from '../lib/format';
import { useSoundSetting } from '../lib/sound';
import { useGameMusic, useMusicSetting } from '../lib/music';
import { readAssists } from '../lib/assists';
import { supabase, useSession } from '../lib/session';
import { GAME_NAME, fmtPoints, ordinal, useMe } from '../lib/contest';
import { restartBoard } from '../lib/restart';
import { localKey } from '../lib/persistence';
import { readJSON, writeJSON } from '../lib/storage';
import { HighScoreMoment, RecordBadge, type HighRecord } from './HighScore';

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
  // Each game's own gentle loop, while the clock runs.
  useGameMusic(props.parsed.game, props.running && !props.solved);
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

/**
 * The speaker button opens a small card with two switches: Sounds silences
 * everything (moves and music), Music silences just the music.
 */
function SoundToggle() {
  const on = useSoundSetting((s) => s.on);
  const toggle = useSoundSetting((s) => s.toggle);
  const music = useMusicSetting((s) => s.on);
  const toggleMusic = useMusicSetting((s) => s.toggle);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event): void => {
      if (!(e.target as Element | null)?.closest?.('[data-sound-menu]')) setOpen(false);
    };
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="relative" data-sound-menu>
      <button
        type="button"
        aria-label="Sound and music"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-minor bg-raised text-ink-2"
      >
        {on ? <Icon.Sound /> : <Icon.Mute />}
      </button>
      {open && (
        <div
          role="group"
          aria-label="Sound and music"
          className="pb-in absolute right-0 top-12 z-30 w-[208px] origin-top-right rounded-2xl border border-line-minor bg-raised p-1.5 shadow-[0_14px_30px_-12px_rgb(40_24_10/0.45)]"
          style={{ animationDuration: '220ms' }}
        >
          <SwitchRow icon={on ? <Icon.Sound /> : <Icon.Mute />} label="Sounds" note="Moves and music" on={on} onToggle={toggle} />
          <SwitchRow icon={<Icon.Music />} label="Music" note="A soft tune per game" on={on && music} disabled={!on} onToggle={toggleMusic} />
        </div>
      )}
    </div>
  );
}

function SwitchRow(p: { icon: ReactNode; label: string; note: string; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={p.on}
      disabled={p.disabled}
      onClick={p.onToggle}
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left disabled:opacity-45"
    >
      <span className="text-ink-2">{p.icon}</span>
      <span className="flex flex-grow flex-col">
        <span className="text-[13.5px] font-semibold leading-tight text-ink">{p.label}</span>
        <span className="text-[11px] leading-tight text-ink-2">{p.note}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-[22px] w-[38px] flex-shrink-0 rounded-full transition-colors duration-200 ${p.on ? 'bg-accent' : 'bg-line-minor'}`}
      >
        <span
          className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform duration-200"
          style={{ transform: `translateX(${p.on ? 18 : 2}px)` }}
        />
      </span>
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
  const [busy, setBusy] = useState(false);
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
      {parsed && (
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => { setBusy(true); void restartBoard(props.seed); }}
            disabled={busy}
            className="pb-key flex h-12 flex-grow basis-0 items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-60"
            style={{ background: 'linear-gradient(160deg, #FFF3CF 0%, #F6D98A 45%, #E8B44A 100%)', color: '#4E2E04', ['--key-side' as string]: '#9A6410' }}
          >
            <Icon.Undo width={16} height={16} /> {busy ? 'Starting…' : 'Try again'}
          </button>
          <Link
            to={`/practice/${parsed.game}/${props.difficulty}`}
            className="pb-key flex h-12 flex-grow basis-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(160deg, #6FA27D, #437A55)', ['--key-side' as string]: '#2E5A3C' }}
          >
            <Icon.Play width={16} height={16} /> New board
          </Link>
        </div>
      )}
      <p className="mt-2 text-center text-[11.5px] leading-snug text-ink-2">
        <b className="text-ink">New board</b> gives a fresh {DIFF_LABEL[props.difficulty].toLowerCase()} {parsed ? GAME_NAME[parsed.game] : ''} board; after the daily, your best board of the day counts for the contest.
        {' '}<b className="text-ink">Try again</b> replays this one for practice and doesn't change your points.
      </p>
      <div className="mt-2.5 flex gap-2">
        <button type="button" onClick={props.onShare} className="pb-key flex h-11 flex-grow basis-0 items-center justify-center gap-1.5 rounded-xl bg-raised-2 text-[13px] font-semibold text-ink">
          <Icon.Share width={16} height={16} /> {props.shareLabel ?? 'Share'}
        </button>
        <Link to="/rankings" className="pb-key flex h-11 flex-grow basis-0 items-center justify-center gap-1.5 rounded-xl bg-raised-2 text-[13px] font-semibold text-ink">
          <Icon.Trophy width={16} height={16} /> Rankings
        </Link>
        <Link to="/" className="pb-key flex h-11 flex-grow basis-0 items-center justify-center rounded-xl bg-raised-2 text-[13px] font-semibold text-ink">
          Today
        </Link>
      </div>
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
  const [server, setServer] = useState<{ best: number; contest: boolean; attempts: number } | null>(null);
  const completedAt = readJSON<{ completedAt: string | null }>(localKey(parsed.game, seed))?.completedAt ?? null;
  const [rank, setRank] = useState<{ rank: number; players: number } | null>(null);
  const [offline, setOffline] = useState(false);
  const [rankDone, setRankDone] = useState(false);
  const [record, setRecord] = useState<{ rec: HighRecord; delay: number } | null>(null);

  // Did this solve set a record? Decided once per solve, when the server has
  // answered (or we know we're offline), and only right after the solve.
  useEffect(() => {
    if (!completedAt || record) return;
    if (!(rankDone || offline)) return;
    const seenKey = `pb:hs-seen:${seed}`;
    if (readJSON<string>(seenKey) === completedAt) return;
    const age = Date.now() - new Date(completedAt).getTime();
    if (age > 3 * 60_000) return;
    writeJSON(seenKey, completedAt);
    if (server && server.attempts > 1) return; // Try again is practice
    const score = server ? server.best : local.total;
    const bestKey = `pb:best:${parsed.game}`;
    const prev = readJSON<number>(bestKey);
    if (prev === null || score > prev) writeJSON(bestKey, score);
    const cache = readJSON<{ date: string; rows: { is_me: boolean; rank: number }[] }>('pb:leaders');
    const wasFirst = cache?.rows.find((r) => r.is_me)?.rank === 1;
    const delay = Math.max(0, 4700 - age);
    if (server?.contest && rank?.rank === 1 && !wasFirst) setRecord({ rec: { kind: 'first', score, prev }, delay });
    else if (prev !== null && score > prev) setRecord({ rec: { kind: 'best', score, prev }, delay });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankDone, offline, server, completedAt]);

  useEffect(() => {
    if (!supabase || !userId) { setOffline(true); return; }
    let alive = true;
    let tries = 0;
    const poll = async (): Promise<void> => {
      tries++;
      try {
        const row = await fetchPlay(supabase!, userId, seed);
        if (!alive) return;
        const thisTry = !completedAt || !row?.last_solved_at
          || Math.abs(new Date(row.last_solved_at).getTime() - new Date(completedAt).getTime()) < 1500;
        if (row && row.status === 'solved' && row.score !== null && (thisTry || tries >= 6)) {
          setServer({ best: row.score, contest: row.contest, attempts: row.attempts });
          void useMe.getState().refresh();
          if (row.contest && row.puzzle_date) {
            const rows = await fetchLeaderboard(supabase!, 'day', row.puzzle_date, null, 500);
            const me = rows.find((r) => r.is_me);
            if (alive && me) setRank({ rank: me.rank, players: rows.length });
          }
          if (alive) setRankDone(true);
          return;
        }
      } catch { /* try again */ }
      if (alive && tries < 8) window.setTimeout(() => { void poll(); }, 1200);
      else if (alive) setOffline(true);
    };
    const t = window.setTimeout(() => { void poll(); }, 700);
    return () => { alive = false; window.clearTimeout(t); };
  }, [seed, userId, completedAt]);

  const total = local.total;
  const rows: [string, number][] = [
    [`${DIFF_LABEL[parsed.difficulty]} board`, local.base],
    [local.speed >= 0 ? 'Speed bonus' : 'Slow finish', local.speed],
  ];
  if (local.hints) rows.push([`${assists.hints} hint${assists.hints === 1 ? '' : 's'}`, -local.hints]);
  if (local.mistakes) rows.push([`${mistakes} mistake${mistakes === 1 ? '' : 's'}`, -local.mistakes]);
  if (local.fill) rows.push(['Fill used', -local.fill]);

  const replay = !!server && server.attempts > 1;
  const standing = rank ? ` You are ${ordinal(rank.rank)} of ${rank.players} today.` : '';
  let note: string;
  if (!server) note = offline ? 'Offline: points will be saved when you are back online.' : 'Sending your score…';
  else if (replay) note = "Try again is practice: this board's first try is what counts.";
  else if (server.contest) note = parsed.isDaily
    ? `Counts for today's contest. Want more? Play a new board; your best board today counts.${standing}`
    : `New board: counts for today's contest if it beats your best today.${standing}`;
  else if (!parsed.isDaily) note = `New boards count for the contest once today's ${GAME_NAME[parsed.game]} daily board is solved. This one goes to your personal score.`;
  else note = "This board can't enter today's contest (an older day, or solved too fast), so it goes to your personal score.";

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line-minor">
      {record && <HighScoreMoment record={record.rec} delayMs={record.delay} />}
      <div className="pb-wood relative flex items-center justify-between px-3.5 py-2.5 text-[#FFF4E2]">
        <span className="flex items-center gap-2 text-[13px] font-bold tracking-tight [text-shadow:0_1px_1px_rgb(60_30_5/0.5)]">This try{record && <RecordBadge kind={record.rec.kind} />}</span>
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
      {server && (
        <div className="flex items-center justify-between border-t border-line-minor bg-raised px-3.5 py-2 text-[12.5px]">
          <span className="text-ink-2">{replay ? `Counted from the first try · ${server.attempts} tries` : 'Counted for this board'}</span>
          <span className="flex items-center gap-1.5 font-bold tabular-nums">
            {fmtPoints(server.best)}
          </span>
        </div>
      )}
      <div className={`flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium ${server?.contest && !replay ? 'bg-accent-soft text-accent-text' : 'bg-raised-2 text-ink-2'}`}>
        {server?.contest && !replay ? <Icon.Trophy width={14} height={14} /> : <Icon.Check width={13} height={13} />}
        {note}
      </div>
    </div>
  );
}

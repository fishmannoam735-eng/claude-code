import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { fetchPlay, fetchStreaks } from '@pb/data';
import { parseSeed } from '@pb/engine';
import { Icon } from '../../components/Icon';
import { ActionButton, GameHeader, PausedOverlay, SolvedCard } from '../../components/GameChrome';
import { localKey, usePersistence } from '../../lib/persistence';
import { buildShareText, mistakeRows, share } from '../../lib/share';
import { supabase, useSession } from '../../lib/session';
import { readJSON } from '../../lib/storage';
import { ThreadBoard } from './ThreadBoard';
import { useThread, type Snapshot } from './store';
import { useGameSounds, type Sound } from '../../lib/sound';

// The line ticks along as it grows, and brushes back as it retracts.
const threadBoard = (s: { path: number[] }) => s.path;
const threadSound = (a: number[], b: number[]): Sound => (b.length < a.length ? 'erase' : 'mark');

export function ThreadPage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
  useGameSounds(useThread, threadBoard, threadSound);
  const parsed = useMemo(() => parseSeed(seed), [seed]);
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);

  const load = useThread((s) => s.load);
  const loadedSeed = useThread((s) => s.seed);
  const puzzle = useThread((s) => s.puzzle);
  const status = useThread((s) => s.status);
  const running = useThread((s) => s.runningSince !== null);
  const path = useThread((s) => s.path);
  const backtracks = useThread((s) => s.backtracks);
  const rowBacktracks = useThread((s) => s.rowBacktracks);
  const dirty = useThread((s) => s.dirty);
  const snapshot = useThread((s) => s.snapshot);
  const elapsed = useThread((s) => s.elapsed);
  const hint = useThread((s) => s.hint);
  const { stepBack, stepDir, clearPath, pause, resume, showHint } = useThread.getState();

  const [streak, setStreak] = useState<number | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed || parsed.game !== 'thread') { navigate('/', { replace: true }); return; }
    if (sessionStatus === 'loading' || loadedSeed === seed) return;
    const local = readJSON<Snapshot>(localKey('thread', seed));
    const puzzleDate = parsed.isDaily ? parsed.key : null;
    load(seed, local, puzzleDate);
    if (supabase && userId) {
      void fetchPlay(supabase, userId, seed).then((row) => {
        const remote = row?.state as Snapshot | null | undefined;
        if (!remote || remote.v !== 1) return;
        const better = !local
          || (remote.status === 'solved' && local.status !== 'solved')
          || remote.elapsedMs > local.elapsedMs;
        if (better && useThread.getState().dirty <= 1) load(seed, remote, puzzleDate);
      }).catch(() => { /* offline is fine */ });
    }
  }, [seed, parsed, sessionStatus, userId, loadedSeed, load, navigate]);

  usePersistence({
    gameId: 'thread',
    seed: loadedSeed === seed ? seed : null,
    dirty, status, snapshot,
  });

  useEffect(() => {
    const onVis = (): void => { if (document.hidden) pause(); else resume(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pause, resume]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowUp': stepDir(-1, 0); e.preventDefault(); break;
        case 'ArrowDown': stepDir(1, 0); e.preventDefault(); break;
        case 'ArrowLeft': stepDir(0, -1); e.preventDefault(); break;
        case 'ArrowRight': stepDir(0, 1); e.preventDefault(); break;
        case 'Backspace': case 'Delete': case 'z': case 'Z':
          stepBack(); e.preventDefault(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepBack, stepDir]);

  useEffect(() => {
    if (status !== 'solved' || !supabase || !userId) return;
    void fetchStreaks(supabase, userId)
      .then((rows) => setStreak(rows.find((r) => r.game_id === 'thread')?.current ?? null))
      .catch(() => { /* fine */ });
  }, [status, userId]);

  if (!parsed || loadedSeed !== seed || !puzzle) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-2">Loading…</div>;
  }

  const cells = puzzle.n * puzzle.n;
  const paused = status === 'in_progress' && !running;

  const onShare = async (): Promise<void> => {
    const text = buildShareText({
      game: 'Thread', parsed, seed, elapsedMs: elapsed(),
      rows: mistakeRows(rowBacktracks, Math.ceil(puzzle.n / 2)), streak,
    });
    const r = await share(text);
    setShared(r === 'copied' ? 'Copied' : r === 'shared' ? 'Shared' : 'Could not share');
    window.setTimeout(() => setShared(null), 2000);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-[15px] pb-5 pt-3.5">
      <GameHeader
        title="Thread"
        parsed={parsed}
        subtitle={`${path.length} of ${cells} cells${backtracks ? ` · ${backtracks} step${backtracks === 1 ? '' : 's'} back` : ''}`}
        elapsed={elapsed}
        running={running}
        solved={status === 'solved'}
        onTogglePause={() => (paused ? resume() : pause())}
      />

      <div className="relative mt-3.5">
        <ThreadBoard hidden={paused} />
        {paused && <PausedOverlay onResume={resume} />}
      </div>

      {hint && !paused && <HintCard />}

      <p className="mt-3 text-center text-[11.5px] leading-snug text-ink-2">
        Drag one line through every cell, meeting the numbers in order.
        <br />
        Thick bars are walls the line cannot cross. Drag back — or use the arrow keys — to undo a step.
      </p>

      <div className="mt-auto flex gap-2.5 pt-4">
        <ActionButton label="Step back" onClick={stepBack} disabled={path.length < 2 || status === 'solved'}><Icon.Undo /></ActionButton>
        <ActionButton label="Clear" onClick={clearPath} disabled={path.length < 2 || status === 'solved'}><Icon.Sweep /></ActionButton>
        <ActionButton label="Hint" onClick={showHint} active={hint !== null} disabled={status === 'solved' || paused}><Icon.Bulb /></ActionButton>
      </div>

      {status === 'solved' && (
        <SolvedCard
          elapsedMs={elapsed()}
          mistakes={backtracks}
          mistakeWord="step back"
          streak={streak}
          shareLabel={shared}
          onShare={() => { void onShare(); }}
          practiceHref={parsed.isDaily ? null : `/practice/thread/${parsed.difficulty}`}
          difficulty={parsed.difficulty}
        />
      )}
    </div>
  );
}

/**
 * The hint, one short row at a time. Each row lights up the squares it talks
 * about on the board, and the last row's button draws the line on (or backs
 * it up to where it went wrong).
 */
function HintCard() {
  const hint = useThread((s) => s.hint)!;
  const step = useThread((s) => s.hintStep);
  const setHintStep = useThread((s) => s.setHintStep);
  const applyHint = useThread((s) => s.applyHint);
  const dismissHint = useThread((s) => s.dismissHint);
  const last = step >= hint.steps.length - 1;
  const a = hint.action;
  const doIt = a.kind === 'backup' ? 'Back up' : a.cells.length === 1 ? 'Draw it' : `Draw ${a.cells.length} squares`;
  return (
    <div role="status" className="relative mt-3 rounded-2xl border border-accent bg-accent-soft px-3 pb-3 pt-3 text-[13px] leading-snug text-ink">
      <button type="button" aria-label="Close hint" onClick={dismissHint} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-2">
        <Icon.Close width={16} height={16} />
      </button>
      <div className="mb-2 flex items-center gap-1.5 px-1 pr-8 text-[11px] font-bold uppercase tracking-wider text-accent-text">
        <Icon.Bulb width={14} height={14} /> {hint.wrong ? 'Check this part' : hint.revealed ? 'A nudge' : 'Hint'}
        {hint.steps.length > 1 && (
          <span className="font-semibold normal-case tracking-normal text-ink-2">· step {step + 1} of {hint.steps.length}</span>
        )}
      </div>
      <p className="min-h-[3.4em] rounded-xl bg-surface px-3 py-2 text-[14px] font-medium leading-snug text-ink shadow-sm">
        {hint.steps[step]!.text}
      </p>
      {hint.steps.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1" role="tablist" aria-label="Hint steps">
          {hint.steps.map((_, k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === step}
              aria-label={`Step ${k + 1}`}
              onClick={() => setHintStep(k)}
              className={`h-2.5 rounded-full transition-all ${k === step ? 'w-6 bg-accent' : k < step ? 'w-2.5 bg-accent/50' : 'w-2.5 bg-line-major'}`}
            />
          ))}
        </div>
      )}
      <div className="mt-2.5 flex gap-2 px-1">
        {step > 0 && (
          <button type="button" onClick={() => setHintStep(step - 1)} className="rounded-xl border border-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-text">
            Back
          </button>
        )}
        {last ? (
          <button type="button" onClick={applyHint} className="rounded-xl bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-ink">
            {doIt}
          </button>
        ) : (
          <button type="button" onClick={() => setHintStep(step + 1)} className="rounded-xl bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-ink">
            Next
          </button>
        )}
      </div>
    </div>
  );
}

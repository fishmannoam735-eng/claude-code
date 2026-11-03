import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { fetchPlay, fetchStreaks } from '@pb/data';
import { eclipseGame, parseSeed } from '@pb/engine';
import { Icon } from '../../components/Icon';
import { ActionButton, GameHeader, PausedOverlay, SolvedCard } from '../../components/GameChrome';
import { localKey, usePersistence } from '../../lib/persistence';
import { buildShareText, share } from '../../lib/share';
import { supabase, useSession } from '../../lib/session';
import { readJSON } from '../../lib/storage';
import { EclipseBoard } from './EclipseBoard';
import { MOON, SUN, useEclipse, type Snapshot } from './store';
import { byCount, useGameSounds } from '../../lib/sound';

const eclipseBoard = (s: { grid: number[] }) => s.grid;

export function EclipsePage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
  useGameSounds(useEclipse, eclipseBoard, byCount);
  const parsed = useMemo(() => parseSeed(seed), [seed]);
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);

  const load = useEclipse((s) => s.load);
  const loadedSeed = useEclipse((s) => s.seed);
  const status = useEclipse((s) => s.status);
  const hint = useEclipse((s) => s.hint);
  const running = useEclipse((s) => s.runningSince !== null);
  const canUndo = useEclipse((s) => s.undo.length > 0);
  const grid = useEclipse((s) => s.grid);
  const dirty = useEclipse((s) => s.dirty);
  const snapshot = useEclipse((s) => s.snapshot);
  const elapsed = useEclipse((s) => s.elapsed);
  const { setCell, erase, undoMove, pause, resume, moveSelection } = useEclipse.getState();

  const [streak, setStreak] = useState<number | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed || parsed.game !== 'eclipse') { navigate('/', { replace: true }); return; }
    if (sessionStatus === 'loading' || loadedSeed === seed) return;
    const local = readJSON<Snapshot>(localKey('eclipse', seed));
    const puzzleDate = parsed.isDaily ? parsed.key : null;
    load(seed, local, puzzleDate);
    if (supabase && userId) {
      void fetchPlay(supabase, userId, seed).then((row) => {
        const remote = row?.state as Snapshot | null | undefined;
        if (!remote || remote.v !== 1) return;
        const better = !local
          || (remote.status === 'solved' && local.status !== 'solved')
          || remote.elapsedMs > local.elapsedMs;
        if (better && useEclipse.getState().dirty <= 1) load(seed, remote, puzzleDate);
      }).catch(() => { /* offline is fine */ });
    }
  }, [seed, parsed, sessionStatus, userId, loadedSeed, load, navigate]);

  usePersistence({
    gameId: 'eclipse',
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
      const sel = useEclipse.getState().selected;
      switch (e.key) {
        case 'ArrowUp': moveSelection(-1, 0); e.preventDefault(); break;
        case 'ArrowDown': moveSelection(1, 0); e.preventDefault(); break;
        case 'ArrowLeft': moveSelection(0, -1); e.preventDefault(); break;
        case 'ArrowRight': moveSelection(0, 1); e.preventDefault(); break;
        case 'o': case 'O': case '1': if (sel !== null) setCell(sel, SUN); break;
        case 'x': case 'X': case '2': if (sel !== null) setCell(sel, MOON); break;
        case 'Backspace': case 'Delete': case '0': erase(); e.preventDefault(); break;
        case 'z': case 'Z': undoMove(); e.preventDefault(); break;
        case 'Escape': useEclipse.setState({ selected: null }); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCell, erase, undoMove, moveSelection]);

  useEffect(() => {
    if (status !== 'solved' || !supabase || !userId) return;
    void fetchStreaks(supabase, userId)
      .then((rows) => setStreak(rows.find((r) => r.game_id === 'eclipse')?.current ?? null))
      .catch(() => { /* fine */ });
  }, [status, userId]);

  if (!parsed || loadedSeed !== seed) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-2">Loading…</div>;
  }

  const placed = grid.filter((v) => v !== 0).length;
  const paused = status === 'in_progress' && !running;

  const onShare = async (): Promise<void> => {
    const text = buildShareText({
      game: 'Eclipse', parsed, seed, elapsedMs: elapsed(),
      rows: [], streak,
    });
    const r = await share(text);
    setShared(r === 'copied' ? 'Copied' : r === 'shared' ? 'Shared' : 'Could not share');
    window.setTimeout(() => setShared(null), 2000);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-[15px] pb-5 pt-3.5">
      {/* header stays pinned; the board block takes the slack below it */}
      <GameHeader
        title="Eclipse"
        parsed={parsed}
        subtitle={`${placed} of ${eclipseGame.CELLS} placed`}
        elapsed={elapsed}
        running={running}
        solved={status === 'solved'}
        onTogglePause={() => (paused ? resume() : pause())}
      />

      <div className="relative mt-3.5">
        <EclipseBoard hidden={paused} />
        {paused && <PausedOverlay onResume={resume} />}
      </div>

      {hint && !paused && <HintCard />}

      <p className="mt-3 text-center text-[11.5px] leading-snug text-ink-2">
        Three of each per row and column, never three alike in a row.
        <br />
        Tap a cell to cycle sun → moon → blank. <span className="font-semibold">=</span> means the pair matches, <span className="font-semibold">×</span> means it differs.
      </p>

      <div className="mt-auto flex gap-2.5 pt-4">
        <ActionButton label="Undo" onClick={undoMove} disabled={!canUndo || status === 'solved'}><Icon.Undo /></ActionButton>
        <ActionButton label="Erase" onClick={erase} disabled={status === 'solved'}><Icon.Erase /></ActionButton>
        <ActionButton label="Hint" onClick={() => useEclipse.getState().showHint()} active={hint !== null} disabled={status === 'solved' || paused}><Icon.Bulb /></ActionButton>
      </div>

      {status === 'solved' && (
        <SolvedCard
          elapsedMs={elapsed()}
          streak={streak}
          shareLabel={shared}
          onShare={() => { void onShare(); }}
          practiceHref={parsed.isDaily ? null : `/practice/eclipse/${parsed.difficulty}`}
          difficulty={parsed.difficulty}
        />
      )}
    </div>
  );
}

/**
 * The hint, one short row at a time. Each row lights up the squares it talks
 * about on the board, and the last row's button puts the sun or moon down (or
 * clears a wrong one).
 */
function HintCard() {
  const hint = useEclipse((s) => s.hint)!;
  const step = useEclipse((s) => s.hintStep);
  const setHintStep = useEclipse((s) => s.setHintStep);
  const applyHint = useEclipse((s) => s.applyHint);
  const dismissHint = useEclipse((s) => s.dismissHint);
  const last = step >= hint.steps.length - 1;
  const a = hint.action;
  const doIt = a.kind === 'clear' ? 'Clear it' : a.value === SUN ? 'Place the sun' : 'Place the moon';
  return (
    <div role="status" className="relative mt-3 rounded-2xl border border-accent bg-accent-soft px-3 pb-3 pt-3 text-[13px] leading-snug text-ink">
      <button type="button" aria-label="Close hint" onClick={dismissHint} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-2">
        <Icon.Close width={16} height={16} />
      </button>
      <div className="mb-2 flex items-center gap-1.5 px-1 pr-8 text-[11px] font-bold uppercase tracking-wider text-accent-text">
        <Icon.Bulb width={14} height={14} /> {hint.wrong ? 'Check this one' : hint.revealed ? 'A nudge' : 'Hint'}
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

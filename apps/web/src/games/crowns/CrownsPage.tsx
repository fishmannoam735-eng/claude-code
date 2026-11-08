import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { fetchPlay, fetchStreaks } from '@pb/data';
import { crownsGame, parseSeed } from '@pb/engine';
import { Icon } from '../../components/Icon';
import { ActionButton, GameHeader, PausedOverlay, SolvedCard } from '../../components/GameChrome';
import { WinCelebration } from '../../components/Celebrate';
import { localKey, usePersistence } from '../../lib/persistence';
import { buildShareText, mistakeRows, share } from '../../lib/share';
import { supabase, useSession } from '../../lib/session';
import { readJSON } from '../../lib/storage';
import { CrownsBoard } from './CrownsBoard';
import { CROWN, EMPTY, MARK, useCrowns, type Snapshot } from './store';
import { useGameSounds, type Sound } from '../../lib/sound';

// A crown is a piece set down, a ✕ is a fingertip note, anything else lifts off.
const crownsBoard = (s: { grid: number[] }) => s.grid;
const crownsSound = (a: number[], b: number[]): Sound => {
  const i = b.findIndex((v, k) => v !== a[k]);
  if (i < 0) return 'place';
  return b[i] === CROWN ? 'place' : b[i] === MARK ? 'mark' : 'erase';
};

export function CrownsPage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
  useGameSounds(useCrowns, crownsBoard, crownsSound);
  const parsed = useMemo(() => parseSeed(seed), [seed]);
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);

  const load = useCrowns((s) => s.load);
  const loadedSeed = useCrowns((s) => s.seed);
  const status = useCrowns((s) => s.status);
  const running = useCrowns((s) => s.runningSince !== null);
  const canUndo = useCrowns((s) => s.undo.length > 0);
  const mistakes = useCrowns((s) => s.mistakes);
  const rowMistakes = useCrowns((s) => s.rowMistakes);
  const grid = useCrowns((s) => s.grid);
  const dirty = useCrowns((s) => s.dirty);
  const snapshot = useCrowns((s) => s.snapshot);
  const elapsed = useCrowns((s) => s.elapsed);
  const hint = useCrowns((s) => s.hint);
  const { setCell, erase, undoMove, clearMarks, pause, resume, moveSelection, showHint } = useCrowns.getState();

  const [streak, setStreak] = useState<number | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed || parsed.game !== 'crowns') { navigate('/', { replace: true }); return; }
    if (sessionStatus === 'loading' || loadedSeed === seed) return;
    const local = readJSON<Snapshot>(localKey('crowns', seed));
    const puzzleDate = parsed.isDaily ? parsed.key : null;
    load(seed, local, puzzleDate);
    if (supabase && userId) {
      void fetchPlay(supabase, userId, seed).then((row) => {
        const remote = row?.state as Snapshot | null | undefined;
        if (!remote || remote.v !== 1) return;
        const better = !local
          || (remote.status === 'solved' && local.status !== 'solved')
          || remote.elapsedMs > local.elapsedMs;
        if (better && useCrowns.getState().dirty <= 1) load(seed, remote, puzzleDate);
      }).catch(() => { /* offline is fine */ });
    }
  }, [seed, parsed, sessionStatus, userId, loadedSeed, load, navigate]);

  usePersistence({
    gameId: 'crowns',
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
      const sel = useCrowns.getState().selected;
      switch (e.key) {
        case 'ArrowUp': moveSelection(-1, 0); e.preventDefault(); break;
        case 'ArrowDown': moveSelection(1, 0); e.preventDefault(); break;
        case 'ArrowLeft': moveSelection(0, -1); e.preventDefault(); break;
        case 'ArrowRight': moveSelection(0, 1); e.preventDefault(); break;
        case 'x': case 'X': if (sel !== null) setCell(sel, MARK); break;
        case 'Enter': case ' ': if (sel !== null) setCell(sel, CROWN); e.preventDefault(); break;
        case 'Backspace': case 'Delete': if (sel !== null) setCell(sel, EMPTY); e.preventDefault(); break;
        case 'z': case 'Z': undoMove(); e.preventDefault(); break;
        case 'h': case 'H': showHint(); break;
        case 'Escape': useCrowns.setState({ selected: null, hint: null, hintStep: 0 }); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCell, erase, undoMove, moveSelection]);

  useEffect(() => {
    if (status !== 'solved' || !supabase || !userId) return;
    void fetchStreaks(supabase, userId)
      .then((rows) => setStreak(rows.find((r) => r.game_id === 'crowns')?.current ?? null))
      .catch(() => { /* fine */ });
  }, [status, userId]);

  if (!parsed || loadedSeed !== seed) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-2">Loading…</div>;
  }

  const placed = grid.filter((v) => v === CROWN).length;
  const paused = status === 'in_progress' && !running;
  const hasMarks = grid.some((v) => v === MARK);

  const onShare = async (): Promise<void> => {
    const text = buildShareText({
      game: 'Crowns', parsed, seed, elapsedMs: elapsed(),
      rows: mistakeRows(rowMistakes, 4), streak,
    });
    const r = await share(text);
    setShared(r === 'copied' ? 'Copied' : r === 'shared' ? 'Shared' : 'Could not share');
    window.setTimeout(() => setShared(null), 2000);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-[15px] pb-5 pt-3.5">
      <WinCelebration game="crowns" elapsed={elapsed} />
      <GameHeader
        title="Crowns"
        parsed={parsed}
        subtitle={`${placed} of ${crownsGame.N} crowns${mistakes ? ` · ${mistakes} mistake${mistakes === 1 ? '' : 's'}` : ''}`}
        elapsed={elapsed}
        running={running}
        solved={status === 'solved'}
        onTogglePause={() => (paused ? resume() : pause())}
      />

      <div className="relative mt-3.5">
        <CrownsBoard hidden={paused} />
        {paused && <PausedOverlay onResume={resume} />}
      </div>

      {hint && !paused && <HintCard />}

      <p className="mt-3 text-center text-[11.5px] leading-snug text-ink-2">
        One crown per row, column and colour. No two crowns may touch, even corner to corner.
        <br />
        Tap to cycle ✕ → crown → blank, or drag to ✕ several tiles. The ✕ is just your own note.
      </p>

      <div className="mt-auto flex gap-2.5 pt-4">
        <ActionButton label="Undo" onClick={undoMove} disabled={!canUndo || status === 'solved'}><Icon.Undo /></ActionButton>
        <ActionButton label="Erase" onClick={erase} disabled={status === 'solved'}><Icon.Erase /></ActionButton>
        <ActionButton label="Clear ✕" onClick={clearMarks} disabled={!hasMarks || status === 'solved'}><Icon.Sweep /></ActionButton>
        <ActionButton label="Hint" onClick={showHint} active={hint !== null} disabled={status === 'solved' || paused}><Icon.Bulb /></ActionButton>
      </div>

      {status === 'solved' && (
        <SolvedCard
          elapsedMs={elapsed()}
          mistakes={mistakes}
          streak={streak}
          shareLabel={shared}
          onShare={() => { void onShare(); }}
          practiceHref={parsed.isDaily ? null : `/practice/crowns/${parsed.difficulty}`}
          difficulty={parsed.difficulty}
        />
      )}
    </div>
  );
}

/**
 * The hint, one short row at a time. Each row lights up the squares it talks
 * about on the board (and dims the rest), and the last row's button does the
 * move: put the crown down, ✕ the squares, or take a wrong crown off.
 */
function HintCard() {
  const hint = useCrowns((s) => s.hint)!;
  const step = useCrowns((s) => s.hintStep);
  const setHintStep = useCrowns((s) => s.setHintStep);
  const applyHint = useCrowns((s) => s.applyHint);
  const dismissHint = useCrowns((s) => s.dismissHint);
  const last = step >= hint.steps.length - 1;
  const a = hint.action;
  const doIt = a.kind === 'crown' ? 'Place the crown'
    : a.kind === 'clear' ? 'Take it off'
      : `Mark ${a.cells.length === 1 ? 'it' : `these ${a.cells.length}`} with ✕`;
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

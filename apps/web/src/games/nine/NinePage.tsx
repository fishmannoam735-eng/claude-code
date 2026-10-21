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
import { NineBoard } from './NineBoard';
import { NumberPad } from './NumberPad';
import { useNine, type Snapshot } from './store';
import { useNoteHighlight } from './settings';
import { byCount, useGameSounds, type Sound } from '../../lib/sound';

// Digits are pieces; pencil marks are light taps.
const nineBoard = (s: { grid: number[]; notes: number[] }) => s;
const nineSound = (a: { grid: number[]; notes: number[] }, b: { grid: number[]; notes: number[] }): Sound | null =>
  a.grid !== b.grid ? byCount(a.grid, b.grid) : a.notes !== b.notes ? 'mark' : null;

export function NinePage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
  useGameSounds(useNine, nineBoard, nineSound);
  const parsed = useMemo(() => parseSeed(seed), [seed]);
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);

  const load = useNine((s) => s.load);
  const loadedSeed = useNine((s) => s.seed);
  const status = useNine((s) => s.status);
  const running = useNine((s) => s.runningSince !== null);
  const notesMode = useNine((s) => s.notesMode);
  const hint = useNine((s) => s.hint);
  const showHint = useNine((s) => s.showHint);
  const fillNotes = useNine((s) => s.fillNotes);
  const canUndo = useNine((s) => s.undo.length > 0);
  const mistakes = useNine((s) => s.mistakes);
  const boxMistakes = useNine((s) => s.boxMistakes);
  const elapsed = useNine((s) => s.elapsed);
  const grid = useNine((s) => s.grid);
  const dirty = useNine((s) => s.dirty);
  const snapshot = useNine((s) => s.snapshot);
  const { tapDigit, erase, toggleNotes, undoMove, pause, resume, moveSelection } = useNine.getState();

  const [streak, setStreak] = useState<number | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  // Load: local snapshot first (instant), then prefer the server copy if it's further along.
  useEffect(() => {
    if (!parsed || parsed.game !== 'nine') { navigate('/', { replace: true }); return; }
    if (sessionStatus === 'loading') return;
    if (loadedSeed === seed) return;
    const local = readJSON<Snapshot>(localKey('nine', seed));
    const puzzleDate = parsed.isDaily ? parsed.key : null;
    load(seed, local, puzzleDate);
    if (supabase && userId) {
      void fetchPlay(supabase, userId, seed).then((row) => {
        const remote = row?.state as Snapshot | null | undefined;
        if (!remote || remote.v !== 1) return;
        const better = !local || remote.status === 'solved' && local.status !== 'solved' || remote.elapsedMs > local.elapsedMs;
        if (better && useNine.getState().dirty <= 1) load(seed, remote, puzzleDate);
      }).catch(() => { /* offline is fine */ });
    }
  }, [seed, parsed, sessionStatus, userId, loadedSeed, load, navigate]);

  usePersistence({
    gameId: 'nine',
    seed: loadedSeed === seed ? seed : null,
    dirty, status, snapshot,
  });

  // Pause when the tab is hidden; a 20-minute puzzle will be interrupted.
  useEffect(() => {
    const onVis = (): void => { if (document.hidden) pause(); else resume(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pause, resume]);

  // Keyboard: digits, arrows, backspace, N, Z / ⌘Z, Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key >= '1' && e.key <= '9') { tapDigit(Number(e.key)); e.preventDefault(); return; }
      switch (e.key) {
        case 'ArrowUp': moveSelection(-1, 0); e.preventDefault(); break;
        case 'ArrowDown': moveSelection(1, 0); e.preventDefault(); break;
        case 'ArrowLeft': moveSelection(0, -1); e.preventDefault(); break;
        case 'ArrowRight': moveSelection(0, 1); e.preventDefault(); break;
        case 'Backspace': case 'Delete': case '0': erase(); e.preventDefault(); break;
        case 'n': case 'N': toggleNotes(); break;
        case 'z': case 'Z': undoMove(); e.preventDefault(); break;  // plain Z too — no text fields on this page
        case 'Escape': useNine.setState({ selected: null, lockedDigit: null, highlightDigit: null }); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tapDigit, moveSelection, erase, toggleNotes, undoMove]);

  useEffect(() => {
    if (status !== 'solved' || !supabase || !userId) return;
    void fetchStreaks(supabase, userId).then((rows) => {
      const s = rows.find((r) => r.game_id === 'nine');
      setStreak(s?.current ?? null);
    }).catch(() => { /* fine */ });
  }, [status, userId]);

  if (!parsed || loadedSeed !== seed) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-2">Loading…</div>;
  }

  const placed = grid.filter((v) => v !== 0).length;
  const paused = status === 'in_progress' && !running;
  
  const onShare = async (): Promise<void> => {
    const text = buildShareText({
      game: 'Nine', parsed, seed, elapsedMs: elapsed(),
      rows: mistakeRows(boxMistakes, 3), streak,
    });
    const r = await share(text);
    setShared(r === 'copied' ? 'Copied to clipboard' : r === 'shared' ? 'Shared' : 'Could not share');
    window.setTimeout(() => setShared(null), 2000);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-[15px] pb-5 pt-3.5">
      <GameHeader
        title="Nine"
        parsed={parsed}
        subtitle={`${placed} of 81 placed${mistakes ? ` · ${mistakes} mistake${mistakes === 1 ? '' : 's'}` : ''}`}
        elapsed={elapsed}
        running={running}
        solved={status === 'solved'}
        onTogglePause={() => (paused ? resume() : pause())}
      />

      <div className="relative mt-3.5">
        <NineBoard hidden={paused} />
        {paused && <PausedOverlay onResume={resume} />}
      </div>

      {hint && !paused && <HintCard />}

      <div className="mt-4 flex gap-2.5">
        <ActionButton label="Undo" onClick={undoMove} disabled={!canUndo || status === 'solved'}><Icon.Undo /></ActionButton>
        <ActionButton label="Erase" onClick={erase} disabled={status === 'solved'}><Icon.Erase /></ActionButton>
        <ActionButton label={notesMode ? 'Notes · On' : 'Notes'} onClick={toggleNotes} active={notesMode} disabled={status === 'solved'}><Icon.Pencil /></ActionButton>
        <ActionButton label="Fill" onClick={fillNotes} disabled={status === 'solved' || paused}><Icon.Fill /></ActionButton>
        <ActionButton label="Hint" onClick={showHint} active={hint !== null} disabled={status === 'solved' || paused}><Icon.Bulb /></ActionButton>
      </div>

      <div className="mt-4">
        <NumberPad />
      </div>

      <NotesHighlightToggle />

      {status === 'solved' && (
        <SolvedCard
          elapsedMs={elapsed()}
          mistakes={mistakes}
          streak={streak}
          shareLabel={shared}
          onShare={() => { void onShare(); }}
          practiceHref={parsed.isDaily ? null : `/practice/nine/${parsed.difficulty}`}
          difficulty={parsed.difficulty}
        />
      )}
    </div>
  );
}

/** Whether picking a number lights up the pencil marks that hold it too. */
function NotesHighlightToggle() {
  const on = useNoteHighlight((s) => s.on);
  const toggle = useNoteHighlight((s) => s.toggle);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className="mx-auto mt-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] text-ink-2"
    >
      <span className={`relative h-[18px] w-8 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line-major'}`}>
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-surface shadow transition-[left] ${on ? 'left-[16px]' : 'left-[2px]'}`} />
      </span>
      Highlight the number in notes too
    </button>
  );
}

/** The hint on show: its reasoning step by step, and a way to act on it. */
function HintCard() {
  const hint = useNine((s) => s.hint)!;
  const applyHint = useNine((s) => s.applyHint);
  const dismissHint = useNine((s) => s.dismissHint);
  return (
    <div role="status" className="relative mt-3 rounded-2xl border border-accent bg-accent-soft px-4 pb-3 pt-3 text-[13px] leading-snug text-ink">
      <button type="button" aria-label="Close hint" onClick={dismissHint} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-2">
        <Icon.Close width={16} height={16} />
      </button>
      <div className="mb-1.5 flex items-center gap-1.5 pr-8 text-[11px] font-bold uppercase tracking-wider text-accent-text">
        <Icon.Bulb width={14} height={14} /> {hint.wrong ? 'Check this one' : hint.revealed ? 'A nudge' : 'Hint'}
      </div>
      {hint.steps.length > 1 ? (
        <ol className="list-decimal space-y-1.5 pl-5">
          {hint.steps.map((t, k) => <li key={k}>{t}</li>)}
        </ol>
      ) : <p>{hint.steps[0]}</p>}
      <button
        type="button"
        onClick={applyHint}
        className="mt-2.5 rounded-xl bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-ink"
      >
        {hint.wrong ? 'Clear it' : `Place the ${hint.digit}`}
      </button>
    </div>
  );
}

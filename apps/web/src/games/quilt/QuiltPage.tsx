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
import { AnyGlyph, QuiltBoard, ShapeSwatch } from './QuiltBoard';
import { useQuilt, type Snapshot } from './store';

export function QuiltPage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
  const parsed = useMemo(() => parseSeed(seed), [seed]);
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);

  const load = useQuilt((s) => s.load);
  const loadedSeed = useQuilt((s) => s.seed);
  const puzzle = useQuilt((s) => s.puzzle);
  const status = useQuilt((s) => s.status);
  const running = useQuilt((s) => s.runningSince !== null);
  const canUndo = useQuilt((s) => s.undo.length > 0);
  const mistakes = useQuilt((s) => s.mistakes);
  const rowMistakes = useQuilt((s) => s.rowMistakes);
  const owner = useQuilt((s) => s.owner);
  const refused = useQuilt((s) => s.refused);
  const anchor = useQuilt((s) => s.anchor);
  const selected = useQuilt((s) => s.selected);
  const dirty = useQuilt((s) => s.dirty);
  const snapshot = useQuilt((s) => s.snapshot);
  const elapsed = useQuilt((s) => s.elapsed);
  const {
    undoMove, clearAll, eraseAt, pause, resume, moveSelection,
    toggleAnchor, commitKeyboard,
  } = useQuilt.getState();

  const [streak, setStreak] = useState<number | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed || parsed.game !== 'quilt') { navigate('/', { replace: true }); return; }
    if (sessionStatus === 'loading' || loadedSeed === seed) return;
    const local = readJSON<Snapshot>(localKey('quilt', seed));
    const puzzleDate = parsed.isDaily ? parsed.key : null;
    load(seed, local, puzzleDate);
    if (supabase && userId) {
      void fetchPlay(supabase, userId, seed).then((row) => {
        const remote = row?.state as Snapshot | null | undefined;
        if (!remote || remote.v !== 1) return;
        const better = !local
          || (remote.status === 'solved' && local.status !== 'solved')
          || remote.elapsedMs > local.elapsedMs;
        if (better && useQuilt.getState().dirty <= 1) load(seed, remote, puzzleDate);
      }).catch(() => { /* offline is fine */ });
    }
  }, [seed, parsed, sessionStatus, userId, loadedSeed, load, navigate]);

  usePersistence({
    gameId: 'quilt',
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
      const sel = useQuilt.getState().selected;
      switch (e.key) {
        case 'ArrowUp': moveSelection(-1, 0); e.preventDefault(); break;
        case 'ArrowDown': moveSelection(1, 0); e.preventDefault(); break;
        case 'ArrowLeft': moveSelection(0, -1); e.preventDefault(); break;
        case 'ArrowRight': moveSelection(0, 1); e.preventDefault(); break;
        case ' ': toggleAnchor(); e.preventDefault(); break;
        case 'Enter': commitKeyboard(); e.preventDefault(); break;
        case 'Backspace': case 'Delete': if (sel !== null) eraseAt(sel); e.preventDefault(); break;
        case 'z': case 'Z': undoMove(); e.preventDefault(); break;
        case 'Escape': useQuilt.setState({ selected: null, anchor: null }); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoMove, eraseAt, moveSelection, toggleAnchor, commitKeyboard]);

  useEffect(() => {
    if (status !== 'solved' || !supabase || !userId) return;
    void fetchStreaks(supabase, userId)
      .then((rows) => setStreak(rows.find((r) => r.game_id === 'quilt')?.current ?? null))
      .catch(() => { /* fine */ });
  }, [status, userId]);

  if (!parsed || loadedSeed !== seed || !puzzle) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-2">Loading…</div>;
  }

  const cells = puzzle.n * puzzle.n;
  const filled = owner.filter((k) => k >= 0).length;
  const paused = status === 'in_progress' && !running;
  const anyDrawn = owner.some((k) => k >= 0);
  const canErase = selected !== null && (owner[selected] ?? -1) >= 0;

  const onShare = async (): Promise<void> => {
    const text = buildShareText({
      game: 'Quilt', parsed, seed, elapsedMs: elapsed(),
      rows: mistakeRows(rowMistakes, Math.ceil(puzzle.n / 2)), streak,
    });
    const r = await share(text);
    setShared(r === 'copied' ? 'Copied' : r === 'shared' ? 'Shared' : 'Could not share');
    window.setTimeout(() => setShared(null), 2000);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-[15px] pb-5 pt-3.5">
      <GameHeader
        title="Quilt"
        parsed={parsed}
        subtitle={`${filled} of ${cells} cells${mistakes ? ` · ${mistakes} misfit${mistakes === 1 ? '' : 's'}` : ''}`}
        elapsed={elapsed}
        running={running}
        solved={status === 'solved'}
        onTogglePause={() => (paused ? resume() : pause())}
      />

      <div className="relative mt-3.5">
        <QuiltBoard hidden={paused} />
        {paused && <PausedOverlay onResume={resume} />}
      </div>

      <p className="mt-3 text-center text-[11.5px] leading-snug text-ink-2" aria-live="polite">
        Cut the board into rectangles, one clue in each. A number is that patch's
        area;{' '}
        <span className="inline-flex translate-y-[2px] items-center gap-[3px]" aria-hidden="true">
          <ShapeSwatch shape="wide" className="h-4 w-4 text-ink" />
          <ShapeSwatch shape="tall" className="h-4 w-4 text-ink" />
          <ShapeSwatch shape="square" className="h-4 w-4 text-ink" />
        </span>{' '}
        say only wide, tall or square;{' '}
        <AnyGlyph className="inline-block h-4 w-4 translate-y-[2px] text-ink" />{' '}
        says nothing but that a patch lives here.
        <br />
        {status === 'solved' ? null : refused > 0
          ? <span className="font-semibold text-danger">A patch can hold only one clue — that rectangle covered two.</span>
          : anchor !== null
            ? <>Corner set. Move to the far corner and press <b>Enter</b>.</>
            : <>Drag to draw. Tap a drawn patch to rub it out; press <b>Space</b> to set a corner by keyboard.</>}
      </p>

      <div className="mt-auto flex gap-2.5 pt-4">
        <ActionButton label="Undo" onClick={undoMove} disabled={!canUndo || status === 'solved'}><Icon.Undo /></ActionButton>
        <ActionButton
          label="Erase"
          onClick={() => { if (selected !== null) eraseAt(selected); }}
          disabled={!canErase || status === 'solved'}
        ><Icon.Erase /></ActionButton>
        <ActionButton label="Clear" onClick={clearAll} disabled={!anyDrawn || status === 'solved'}><Icon.Sweep /></ActionButton>
      </div>

      {status === 'solved' && (
        <SolvedCard
          elapsedMs={elapsed()}
          mistakes={mistakes}
          mistakeWord="misfit"
          streak={streak}
          shareLabel={shared}
          onShare={() => { void onShare(); }}
          practiceHref={parsed.isDaily ? null : `/practice/quilt/${parsed.difficulty}`}
          difficulty={parsed.difficulty}
        />
      )}
    </div>
  );
}

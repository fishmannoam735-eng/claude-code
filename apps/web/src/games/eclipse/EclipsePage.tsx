import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { fetchPlay, fetchStreaks } from '@pb/data';
import { eclipseGame, parseSeed } from '@pb/engine';
import { Icon } from '../../components/Icon';
import { ActionButton, GameHeader, PausedOverlay, SolvedCard } from '../../components/GameChrome';
import { localKey, usePersistence } from '../../lib/persistence';
import { buildShareText, mistakeRows, share } from '../../lib/share';
import { supabase, useSession } from '../../lib/session';
import { readJSON } from '../../lib/storage';
import { EclipseBoard } from './EclipseBoard';
import { MOON, SUN, useEclipse, type Snapshot } from './store';

export function EclipsePage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
  const parsed = useMemo(() => parseSeed(seed), [seed]);
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);

  const load = useEclipse((s) => s.load);
  const loadedSeed = useEclipse((s) => s.seed);
  const status = useEclipse((s) => s.status);
  const running = useEclipse((s) => s.runningSince !== null);
  const canUndo = useEclipse((s) => s.undo.length > 0);
  const mistakes = useEclipse((s) => s.mistakes);
  const rowMistakes = useEclipse((s) => s.rowMistakes);
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
      rows: mistakeRows(rowMistakes, 3), streak,
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
        subtitle={`${placed} of ${eclipseGame.CELLS} placed${mistakes ? ` · ${mistakes} mistake${mistakes === 1 ? '' : 's'}` : ''}`}
        elapsed={elapsed}
        running={running}
        solved={status === 'solved'}
        onTogglePause={() => (paused ? resume() : pause())}
      />

      <div className="relative mt-3.5 mb-auto">
        <EclipseBoard hidden={paused} />
        {paused && <PausedOverlay onResume={resume} />}
      </div>

      <p className="mt-3 text-center text-[11.5px] leading-snug text-ink-2">
        Three of each per row and column, never three alike in a row.
        <br />
        Tap a cell to cycle sun → moon → blank. <span className="font-semibold">=</span> means the pair matches, <span className="font-semibold">×</span> means it differs.
      </p>

      <div className="mt-4 flex gap-2.5">
        <ActionButton label="Undo" onClick={undoMove} disabled={!canUndo || status === 'solved'}><Icon.Undo /></ActionButton>
        <ActionButton label="Erase" onClick={erase} disabled={status === 'solved'}><Icon.Erase /></ActionButton>
      </div>

      {status === 'solved' && (
        <SolvedCard
          elapsedMs={elapsed()}
          mistakes={mistakes}
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

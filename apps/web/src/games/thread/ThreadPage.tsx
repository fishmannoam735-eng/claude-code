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

export function ThreadPage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
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
  const { stepBack, stepDir, clearPath, pause, resume } = useThread.getState();

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

      <p className="mt-3 text-center text-[11.5px] leading-snug text-ink-2">
        Drag one line through every cell, meeting the numbers in order.
        <br />
        Thick bars are walls the line cannot cross. Drag back — or use the arrow keys — to undo a step.
      </p>

      <div className="mt-auto flex gap-2.5 pt-4">
        <ActionButton label="Step back" onClick={stepBack} disabled={path.length < 2 || status === 'solved'}><Icon.Undo /></ActionButton>
        <ActionButton label="Clear" onClick={clearPath} disabled={path.length < 2 || status === 'solved'}><Icon.Sweep /></ActionButton>
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

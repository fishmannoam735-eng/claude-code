import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchPlay, fetchStreaks } from '@pb/data';
import { localDateKey, parseSeed } from '@pb/engine';
import { Icon } from '../../components/Icon';
import { fmtTime, DIFF_LABEL } from '../../lib/format';
import { supabase, useSession } from '../../lib/session';
import { readJSON } from '../../lib/storage';
import { NineBoard } from './NineBoard';
import { NumberPad } from './NumberPad';
import { buildShareText, share } from './share';
import { useNine, type Snapshot } from './store';
import { localKey, usePersistence } from './usePersistence';

function Timer() {
  const elapsed = useNine((s) => s.elapsed);
  const running = useNine((s) => s.runningSince !== null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return <span className="text-xl font-semibold tabular-nums tracking-tight">{fmtTime(elapsed())}</span>;
}

export function NinePage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
  const parsed = useMemo(() => parseSeed(seed), [seed]);
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);

  const load = useNine((s) => s.load);
  const loadedSeed = useNine((s) => s.seed);
  const status = useNine((s) => s.status);
  const running = useNine((s) => s.runningSince !== null);
  const notesMode = useNine((s) => s.notesMode);
  const canUndo = useNine((s) => s.undo.length > 0);
  const mistakes = useNine((s) => s.mistakes);
  const boxMistakes = useNine((s) => s.boxMistakes);
  const elapsed = useNine((s) => s.elapsed);
  const grid = useNine((s) => s.grid);
  const { tapDigit, erase, toggleNotes, undoMove, pause, resume, moveSelection } = useNine.getState();

  const [streak, setStreak] = useState<number | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  // Load: local snapshot first (instant), then prefer the server copy if it's further along.
  useEffect(() => {
    if (!parsed || parsed.game !== 'nine') { navigate('/', { replace: true }); return; }
    if (sessionStatus === 'loading') return;
    if (loadedSeed === seed) return;
    const local = readJSON<Snapshot>(localKey(seed));
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

  usePersistence(loadedSeed === seed ? seed : null);

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
  const isToday = parsed.isDaily && parsed.key === localDateKey();

  const onShare = async (): Promise<void> => {
    const text = buildShareText({ parsed, seed, elapsedMs: elapsed(), boxMistakes, streak });
    const r = await share(text);
    setShared(r === 'copied' ? 'Copied to clipboard' : r === 'shared' ? 'Shared' : 'Could not share');
    window.setTimeout(() => setShared(null), 2000);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-[15px] pb-5 pt-3.5">
      <header className="flex h-13 items-center gap-3">
        <Link to="/" aria-label="Back to today" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-minor bg-raised text-ink">
          <Icon.Back />
        </Link>
        <div className="flex flex-grow flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">Nine</span>
            <span className="rounded-full border border-line-minor bg-accent-soft px-2 py-0.5 text-[10px] font-bold tracking-wider text-accent-text">
              {DIFF_LABEL[parsed.difficulty].toUpperCase()}
            </span>
            {!parsed.isDaily && <span className="text-[11px] text-ink-2">practice</span>}
            {parsed.isDaily && !isToday && <span className="text-[11px] text-ink-2">{parsed.key}</span>}
          </div>
          <div className="text-[11px] text-ink-2">{placed} of 81 placed{mistakes ? ` · ${mistakes} mistake${mistakes === 1 ? '' : 's'}` : ''}</div>
        </div>
        <Timer />
        <button
          type="button"
          aria-label={paused ? 'Resume' : 'Pause'}
          disabled={status === 'solved'}
          onClick={() => (paused ? resume() : pause())}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-minor bg-raised text-ink-2 disabled:opacity-40"
        >
          {paused ? <Icon.Play /> : <Icon.Pause />}
        </button>
      </header>

      <div className="relative mt-3.5">
        <NineBoard hidden={paused} />
        {paused && (
          <button
            type="button"
            onClick={resume}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-board/95 text-ink"
          >
            <Icon.Play width={32} height={32} />
            <span className="text-sm font-semibold">Paused — tap to resume</span>
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-2.5">
        <ActionButton label="Undo" onClick={undoMove} disabled={!canUndo || status === 'solved'}><Icon.Undo /></ActionButton>
        <ActionButton label="Erase" onClick={erase} disabled={status === 'solved'}><Icon.Erase /></ActionButton>
        <ActionButton label={notesMode ? 'Notes · On' : 'Notes'} onClick={toggleNotes} active={notesMode} disabled={status === 'solved'}><Icon.Pencil /></ActionButton>
      </div>

      <div className="mt-4">
        <NumberPad />
      </div>

      {status === 'solved' && (
        <div className="mt-5 rounded-2xl border border-line-minor bg-raised p-5">
          <div className="flex items-center gap-2 text-success">
            <Icon.Check />
            <span className="text-lg font-bold">Solved</span>
          </div>
          <div className="mt-2 flex items-baseline gap-4">
            <span className="text-3xl font-semibold tabular-nums">{fmtTime(elapsed())}</span>
            <span className="text-sm text-ink-2">{mistakes === 0 ? 'no mistakes' : `${mistakes} mistake${mistakes === 1 ? '' : 's'}`}</span>
            {streak !== null && streak > 0 && (
              <span className="flex items-center gap-1 text-sm font-semibold text-accent-text"><Icon.Flame width={14} height={14} /> {streak}</span>
            )}
          </div>
          <div className="mt-4 flex gap-2.5">
            <button type="button" onClick={() => { void onShare(); }} className="flex h-12 flex-grow items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-ink">
              <Icon.Share /> {shared ?? 'Share'}
            </button>
            <Link to="/" className="flex h-12 flex-grow items-center justify-center rounded-xl border border-line-minor bg-raised text-sm font-semibold text-ink">
              Back to today
            </Link>
          </div>
          {!parsed.isDaily && (
            <Link to={`/practice/nine/${parsed.difficulty}`} className="mt-3 block text-center text-sm font-semibold text-accent-text">
              Another {DIFF_LABEL[parsed.difficulty].toLowerCase()} one →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton(p: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
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

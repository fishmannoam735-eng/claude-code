import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { fetchPlay, fetchStreaks } from '@pb/data';
import { parseSeed } from '@pb/engine';
import { Icon } from '../../components/Icon';
import { ActionButton, GameHeader, PausedOverlay, SolvedCard } from '../../components/GameChrome';
import { WinCelebration } from '../../components/Celebrate';
import { localKey, usePersistence } from '../../lib/persistence';
import { buildShareText, share } from '../../lib/share';
import { supabase, useSession } from '../../lib/session';
import { readJSON } from '../../lib/storage';
import { BridgesBoard } from './BridgesBoard';
import { useBridges, type Snapshot } from './store';
import { useGameSounds, type Sound } from '../../lib/sound';
import { HowToPlay } from '../../components/HowToPlay';

// A plank set down is a wooden knock; a bridge taken away is a soft brush.
const bridgesBoard = (s: { bridges: number[] }) => s.bridges;
const total = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const bridgesSound = (a: number[], b: number[]): Sound => (total(b) < total(a) ? 'erase' : 'place');

export function BridgesPage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
  useGameSounds(useBridges, bridgesBoard, bridgesSound);
  const parsed = useMemo(() => parseSeed(seed), [seed]);
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);

  const load = useBridges((s) => s.load);
  const loadedSeed = useBridges((s) => s.seed);
  const puzzle = useBridges((s) => s.puzzle);
  const status = useBridges((s) => s.status);
  const running = useBridges((s) => s.runningSince !== null);
  const bridges = useBridges((s) => s.bridges);
  const history = useBridges((s) => s.history);
  const dirty = useBridges((s) => s.dirty);
  const snapshot = useBridges((s) => s.snapshot);
  const elapsed = useBridges((s) => s.elapsed);
  const hint = useBridges((s) => s.hint);
  const { undo, clear, pause, resume, showHint } = useBridges.getState();

  const [streak, setStreak] = useState<number | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed || parsed.game !== 'bridges') { navigate('/', { replace: true }); return; }
    if (sessionStatus === 'loading' || loadedSeed === seed) return;
    const local = readJSON<Snapshot>(localKey('bridges', seed));
    const puzzleDate = parsed.isDaily ? parsed.key : null;
    load(seed, local, puzzleDate);
    if (supabase && userId) {
      void fetchPlay(supabase, userId, seed).then((row) => {
        const remote = row?.state as Snapshot | null | undefined;
        if (!remote || remote.v !== 1) return;
        const better = !local
          || (remote.status === 'solved' && local.status !== 'solved')
          || remote.elapsedMs > local.elapsedMs;
        if (better && useBridges.getState().dirty <= 1) load(seed, remote, puzzleDate);
      }).catch(() => { /* offline is fine */ });
    }
  }, [seed, parsed, sessionStatus, userId, loadedSeed, load, navigate]);

  usePersistence({
    gameId: 'bridges',
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
      if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') { undo(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  useEffect(() => {
    if (status !== 'solved' || !supabase || !userId) return;
    void fetchStreaks(supabase, userId)
      .then((rows) => setStreak(rows.find((r) => r.game_id === 'bridges')?.current ?? null))
      .catch(() => { /* fine */ });
  }, [status, userId]);

  if (!parsed || loadedSeed !== seed || !puzzle) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-2">Loading…</div>;
  }

  const islands = puzzle.layout.islands;
  const have = new Array<number>(islands.length).fill(0);
  puzzle.layout.links.forEach((l, k) => { have[l.a]! += bridges[k]!; have[l.b]! += bridges[k]!; });
  const done = islands.filter((s, i) => have[i] === s.need).length;
  const placed = total(bridges);
  const paused = status === 'in_progress' && !running;

  const onShare = async (): Promise<void> => {
    const text = buildShareText({
      game: 'Bridges', parsed, seed, elapsedMs: elapsed(),
      rows: [`🏝️🌉🏝️🌉🏝️ ${islands.length} islands joined`], streak,
    });
    const r = await share(text);
    setShared(r === 'copied' ? 'Copied' : r === 'shared' ? 'Shared' : 'Could not share');
    window.setTimeout(() => setShared(null), 2000);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-[15px] pb-5 pt-3.5">
      <WinCelebration game="bridges" elapsed={elapsed} />
      <GameHeader
        title="Bridges"
        parsed={parsed}
        subtitle={`${done} of ${islands.length} islands · ${placed} bridge${placed === 1 ? '' : 's'}`}
        elapsed={elapsed}
        running={running}
        solved={status === 'solved'}
        onTogglePause={() => (paused ? resume() : pause())}
      />

      <div className="relative mt-3.5">
        <BridgesBoard hidden={paused} />
        {paused && <PausedOverlay onResume={resume} />}
      </div>

      {hint && !paused && <HintCard />}

      <HowToPlay game="bridges" />

      <div className="mt-auto flex gap-2.5 pt-4">
        <ActionButton label="Undo" onClick={undo} disabled={!history.length || status === 'solved' || paused}><Icon.Undo /></ActionButton>
        <ActionButton label="Clear" onClick={clear} disabled={placed === 0 || status === 'solved' || paused}><Icon.Sweep /></ActionButton>
        <ActionButton label="Hint" onClick={showHint} active={hint !== null} disabled={status === 'solved' || paused}><Icon.Bulb /></ActionButton>
      </div>

      {status === 'solved' && (
        <SolvedCard
          seed={seed}
          scoreMistakes={0}
          elapsedMs={elapsed()}
          streak={streak}
          shareLabel={shared}
          onShare={() => { void onShare(); }}
          difficulty={parsed.difficulty}
        />
      )}
    </div>
  );
}

/**
 * The hint, one short row at a time. Each row lights up the islands and water
 * it talks about on the board, and the last row's button builds the bridge (or
 * takes away one that doesn't belong).
 */
function HintCard() {
  const hint = useBridges((s) => s.hint)!;
  const step = useBridges((s) => s.hintStep);
  const setHintStep = useBridges((s) => s.setHintStep);
  const applyHint = useBridges((s) => s.applyHint);
  const dismissHint = useBridges((s) => s.dismissHint);
  const last = step >= hint.steps.length - 1;
  const a = hint.action;
  const doIt = hint.wrong ? (a[0]?.count ? 'Make it a single' : 'Take it away') : a.length > 1 ? `Build ${a.length} bridges` : a[0]?.count === 2 ? 'Build the double' : 'Build it';
  return (
    <div role="status" className="relative mt-3 rounded-2xl border border-accent bg-accent-soft px-3 pb-3 pt-3 text-[13px] leading-snug text-ink">
      <button type="button" aria-label="Close hint" onClick={dismissHint} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-2">
        <Icon.Close width={16} height={16} />
      </button>
      <div className="mb-2 flex items-center gap-1.5 px-1 pr-8 text-[11px] font-bold uppercase tracking-wider text-accent-text">
        <Icon.Bulb width={14} height={14} /> {hint.wrong ? 'Check this bridge' : hint.revealed ? 'A nudge' : 'Hint'}
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

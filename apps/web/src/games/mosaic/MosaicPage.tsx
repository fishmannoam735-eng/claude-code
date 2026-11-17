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
import { MosaicBoard } from './MosaicBoard';
import { aliveLine } from './LivingPicture';
import { CROSS, FILL, useMosaic, type Snapshot } from './store';
import { useGameSounds, type Sound } from '../../lib/sound';
import { HowToPlay } from '../../components/HowToPlay';

// A square filled is a wooden knock, a cross a light tick, a square cleared a soft brush.
const mosaicBoard = (s: { paint: number[] }) => s.paint;
const count = (xs: number[], v: number): number => xs.reduce((a, x) => a + (x === v ? 1 : 0), 0);
const mosaicSound = (a: number[], b: number[]): Sound => {
  if (count(b, FILL) > count(a, FILL)) return 'place';
  if (count(b, CROSS) > count(a, CROSS)) return 'mark';
  return 'erase';
};

export function MosaicPage() {
  const { seed = '' } = useParams();
  const navigate = useNavigate();
  useGameSounds(useMosaic, mosaicBoard, mosaicSound);
  const parsed = useMemo(() => parseSeed(seed), [seed]);
  const sessionStatus = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);

  const load = useMosaic((s) => s.load);
  const loadedSeed = useMosaic((s) => s.seed);
  const puzzle = useMosaic((s) => s.puzzle);
  const status = useMosaic((s) => s.status);
  const running = useMosaic((s) => s.runningSince !== null);
  const paint = useMosaic((s) => s.paint);
  const tool = useMosaic((s) => s.tool);
  const justSolved = useMosaic((s) => s.justSolved);
  const history = useMosaic((s) => s.history);
  const dirty = useMosaic((s) => s.dirty);
  const snapshot = useMosaic((s) => s.snapshot);
  const elapsed = useMosaic((s) => s.elapsed);
  const hint = useMosaic((s) => s.hint);
  const { undo, clear, pause, resume, showHint, setTool } = useMosaic.getState();

  const [streak, setStreak] = useState<number | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed || parsed.game !== 'mosaic') { navigate('/', { replace: true }); return; }
    if (sessionStatus === 'loading' || loadedSeed === seed) return;
    const local = readJSON<Snapshot>(localKey('mosaic', seed));
    const puzzleDate = parsed.isDaily ? parsed.key : null;
    load(seed, local, puzzleDate);
    if (supabase && userId) {
      void fetchPlay(supabase, userId, seed).then((row) => {
        const remote = row?.state as Snapshot | null | undefined;
        if (!remote || remote.v !== 1) return;
        const better = !local
          || (remote.status === 'solved' && local.status !== 'solved')
          || remote.elapsedMs > local.elapsedMs;
        if (better && useMosaic.getState().dirty <= 1) load(seed, remote, puzzleDate);
      }).catch(() => { /* offline is fine */ });
    }
  }, [seed, parsed, sessionStatus, userId, loadedSeed, load, navigate]);

  usePersistence({
    gameId: 'mosaic',
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
      .then((rows) => setStreak(rows.find((r) => r.game_id === 'mosaic')?.current ?? null))
      .catch(() => { /* fine */ });
  }, [status, userId]);

  if (!parsed || loadedSeed !== seed || !puzzle) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-2">Loading…</div>;
  }

  const goal = puzzle.solution.reduce((x, v) => x + v, 0);
  const filled = count(paint, FILL);
  const marked = paint.some((v) => v !== 0);
  const paused = status === 'in_progress' && !running;

  const onShare = async (): Promise<void> => {
    const text = buildShareText({
      game: 'Mosaic', parsed, seed, elapsedMs: elapsed(),
      rows: shareRows(puzzle.solution, puzzle.w), streak,
    });
    const r = await share(text);
    setShared(r === 'copied' ? 'Copied' : r === 'shared' ? 'Shared' : 'Could not share');
    window.setTimeout(() => setShared(null), 2000);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-[15px] pb-5 pt-3.5">
      <WinCelebration game="mosaic" elapsed={elapsed} line={aliveLine(puzzle)} scrollTo="[data-tray]" />
      <GameHeader
        title="Mosaic"
        parsed={parsed}
        subtitle={`${filled} of ${goal} squares filled`}
        elapsed={elapsed}
        running={running}
        solved={status === 'solved'}
        onTogglePause={() => (paused ? resume() : pause())}
      />

      <div className="relative mt-3.5">
        <MosaicBoard hidden={paused} />
        {paused && <PausedOverlay onResume={resume} />}
      </div>

      {status === 'solved' ? (
        <p className="pb-rise mt-3 text-center text-[14px] font-semibold text-ink-2" style={{ animationDelay: justSolved ? '5.6s' : '2.2s' }}>
          ✨ {aliveLine(puzzle)}! <span className="font-normal">Tap the picture to see it again.</span>
        </p>
      ) : (
        <ToolSwitch tool={tool} onChange={setTool} disabled={paused} />
      )}

      {hint && !paused && <HintCard />}

      <HowToPlay game="mosaic" />

      <div className="mt-auto flex gap-2.5 pt-4">
        <ActionButton label="Undo" onClick={undo} disabled={!history.length || status === 'solved' || paused}><Icon.Undo /></ActionButton>
        <ActionButton label="Clear" onClick={clear} disabled={!marked || status === 'solved' || paused}><Icon.Sweep /></ActionButton>
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

/** Fill or cross out: what a tap or a drag puts on the squares. */
function ToolSwitch({ tool, onChange, disabled }: { tool: 'fill' | 'cross'; onChange: (t: 'fill' | 'cross') => void; disabled: boolean }) {
  const opt = (t: 'fill' | 'cross', label: string, icon: React.JSX.Element) => (
    <button
      type="button"
      role="radio"
      aria-checked={tool === t}
      disabled={disabled}
      onClick={() => onChange(t)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[14px] font-semibold transition-colors ${tool === t ? 'bg-raised text-ink shadow-sm' : 'text-ink-2'}`}
    >
      {icon}{label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="What a tap does" className="mt-3 flex gap-1 rounded-2xl border border-line-minor bg-raised-2 p-1">
      {opt('fill', 'Fill', <span className="h-4 w-4 rounded-[4px]" style={{ background: 'linear-gradient(160deg, #4C5C78, #283349)' }} />)}
      {opt('cross', 'Cross out', (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#8C6A48" strokeWidth={3.2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      ))}
    </div>
  );
}

/** The share card: the picture's outline in squares. */
function shareRows(solution: number[], w: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < solution.length / w; y++) rows.push(solution.slice(y * w, y * w + w).map((v) => (v ? '⬛' : '⬜')).join(''));
  return rows;
}

/**
 * The hint, one short row at a time. Each row lights up the line it talks
 * about and draws the blocks as it slides them, and the last row's button
 * fills and crosses out the squares it worked out (or clears a wrong one).
 */
function HintCard() {
  const hint = useMosaic((s) => s.hint)!;
  const step = useMosaic((s) => s.hintStep);
  const setHintStep = useMosaic((s) => s.setHintStep);
  const applyHint = useMosaic((s) => s.applyHint);
  const dismissHint = useMosaic((s) => s.dismissHint);
  const last = step >= hint.steps.length - 1;
  const a = hint.action;
  const fills = a.filter((x) => x.value === 1).length, crosses = a.filter((x) => x.value === 2).length;
  const doIt = hint.wrong ? 'Clear it'
    : fills && crosses ? 'Fill and cross them'
    : fills ? (fills === 1 ? 'Fill it' : `Fill ${fills} squares`)
    : crosses === 1 ? 'Cross it out' : `Cross out ${crosses}`;
  return (
    <div role="status" className="relative mt-3 rounded-2xl border border-accent bg-accent-soft px-3 pb-3 pt-3 text-[13px] leading-snug text-ink">
      <button type="button" aria-label="Close hint" onClick={dismissHint} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-2">
        <Icon.Close width={16} height={16} />
      </button>
      <div className="mb-2 flex items-center gap-1.5 px-1 pr-8 text-[11px] font-bold uppercase tracking-wider text-accent-text">
        <Icon.Bulb width={14} height={14} /> {hint.wrong ? 'Check this square' : hint.revealed ? 'A nudge' : 'Hint'}
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

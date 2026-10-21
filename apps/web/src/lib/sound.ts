import { useEffect } from 'react';
import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import { readJSON, writeJSON } from './storage';

/**
 * Soft, tactile sounds for the boards, synthesised with Web Audio so there are
 * no files to load or license. They are tuned to the wooden tray: a muted
 * wooden tock for placing, a light tick for notes and marks, a cloth-like
 * brush for rubbing out, a low thud for a mistake and a small chime on solve.
 * Everything is quiet on purpose; the master gain is the volume knob.
 */
export type Sound = 'place' | 'mark' | 'erase' | 'error' | 'solve';

const KEY = 'pb.sound';
const VOLUME = 0.9;

export const useSoundSetting = create<{ on: boolean; toggle: () => void }>((set, get) => ({
  on: readJSON<boolean>(KEY) ?? true,
  toggle: () => {
    const on = !get().on;
    writeJSON(KEY, on);
    set({ on });
    if (on) play('mark');
  },
}));

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; out: GainNode; noise: AudioBuffer } | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    // A gentle limiter, so loud enough on a phone speaker never means clipping
    // when a drag fires several taps at once.
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -8;
    limit.knee.value = 6;
    limit.ratio.value = 8;
    master.connect(limit).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return { ctx, out: master!, noise: noise! };
}

/**
 * Browsers only start audio from inside a user gesture, and iOS also mutes
 * web audio when the ringer switch is on silent unless the page declares it
 * plays media. So on the first touch anywhere, declare that, start the
 * context and play one silent sample to unlock it.
 */
function unlock(): void {
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session) { try { session.type = 'playback'; } catch { /* older Safari */ } }
  const a = audio();
  if (!a) return;
  const src = a.ctx.createBufferSource();
  src.buffer = a.ctx.createBuffer(1, 1, a.ctx.sampleRate);
  src.connect(a.ctx.destination);
  src.start();
  if (a.ctx.state === 'running') {
    for (const e of GESTURES) window.removeEventListener(e, unlock, true);
  }
}
const GESTURES = ['pointerdown', 'touchend', 'keydown', 'click'] as const;
if (typeof window !== 'undefined') {
  for (const e of GESTURES) window.addEventListener(e, unlock, true);
}

/** Small random detune, so a run of taps sounds handled rather than looped. */
const vary = (f: number, amount = 0.05): number => f * (1 + (Math.random() * 2 - 1) * amount);

function envelope(a: AudioContext, peak: number, attack: number, decay: number, at: number): GainNode {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

function tone(type: OscillatorType, from: number, to: number, peak: number, attack: number, decay: number, delay = 0): void {
  const a = audio();
  if (!a) return;
  const at = a.ctx.currentTime + delay;
  const o = a.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + attack + decay * 0.6);
  const g = envelope(a.ctx, peak, attack, decay, at);
  o.connect(g).connect(a.out);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}

function hiss(freq: number, q: number, peak: number, attack: number, decay: number, delay = 0): void {
  const a = audio();
  if (!a) return;
  const at = a.ctx.currentTime + delay;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  const f = a.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = envelope(a.ctx, peak, attack, decay, at);
  src.connect(f).connect(g).connect(a.out);
  src.start(at, Math.random() * 0.3);
  src.stop(at + attack + decay + 0.05);
}

const SOUNDS: Record<Sound, () => void> = {
  // A piece set down on wood: a short knock with a click on contact. Pitched
  // where phone speakers actually reproduce sound, not down in the bass.
  place: () => {
    const f = vary(620);
    tone('triangle', f * 1.4, f, 0.9, 0.002, 0.12);
    tone('sine', f * 2.7, f * 2.4, 0.25, 0.001, 0.05);
    hiss(vary(3000), 0.8, 1.2, 0.001, 0.02);
  },
  // A fingertip tap: higher, lighter, mostly click.
  mark: () => {
    hiss(vary(4500), 0.7, 1.6, 0.001, 0.025);
    tone('sine', vary(1900), vary(1600), 0.7, 0.001, 0.045);
  },
  // Lifting a piece off and brushing the tile: a soft swish.
  erase: () => {
    hiss(vary(2200, 0.08), 0.5, 1.6, 0.015, 0.11);
    tone('sine', vary(700), vary(560), 0.4, 0.004, 0.06);
  },
  // Wrong move: a dull, low thud. Never a buzzer.
  error: () => {
    tone('triangle', 300, 190, 0.8, 0.004, 0.2);
    hiss(700, 0.8, 0.25, 0.003, 0.07);
  },
  // Solved: one knock, then a soft rising three-note chime.
  solve: () => {
    SOUNDS.place();
    [1046.5, 1318.5, 1568].forEach((f, k) => {
      tone('sine', f, f, 0.38, 0.006, 1.3, 0.12 + k * 0.11);
      tone('sine', f * 2.01, f * 2.01, 0.08, 0.006, 0.6, 0.12 + k * 0.11);
    });
  },
};

export function play(sound: Sound): void {
  if (!useSoundSetting.getState().on) return;
  try { SOUNDS[sound](); } catch { /* audio is a nicety; never break a move over it */ }
}

/** The parts of a game's state that sounds react to. */
interface Watched { seed: string | null; status: string; mistakes?: number }

/**
 * Plays a game's sounds by watching its store, so no game logic has to know
 * about audio. `board` picks out the state that changes on a move; `classify`
 * says what kind of move a change was, or null for one that should be silent.
 * Loading a new puzzle is never a move.
 */
export function useGameSounds<S extends Watched, B>(
  store: UseBoundStore<StoreApi<S>>,
  board: (s: S) => B,
  classify: (prev: B, next: B) => Sound | null,
): void {
  useEffect(() => store.subscribe((s, prev) => {
    if (s.seed !== prev.seed) return;
    if (s.status === 'solved' && prev.status !== 'solved') { play('solve'); return; }
    if ((s.mistakes ?? 0) > (prev.mistakes ?? 0)) { play('error'); return; }
    const a = board(prev), b = board(s);
    if (a === b) return;
    const kind = classify(a, b);
    if (kind) play(kind);
  }), [store, board, classify]);
}

/** Cells holding something, for boards where 0 (or -1) means empty. */
export const filled = (xs: readonly number[]): number => xs.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);

/** The usual reading of a grid change: more pieces is a place, fewer an erase. */
export function byCount(prev: readonly number[], next: readonly number[]): Sound {
  return filled(next) < filled(prev) ? 'erase' : 'place';
}

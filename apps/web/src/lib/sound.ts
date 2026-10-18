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
const VOLUME = 0.55;

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
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master!, noise: noise! };
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
  // A piece set down on wood: a short knock with a tiny click on contact.
  place: () => {
    const f = vary(420);
    tone('triangle', f * 1.35, f, 0.42, 0.002, 0.11);
    tone('sine', f / 2, f / 2.3, 0.22, 0.003, 0.09);
    hiss(vary(2600), 1.4, 0.12, 0.001, 0.018);
  },
  // A fingertip tap: higher, lighter, mostly click.
  mark: () => {
    hiss(vary(4200), 2, 0.1, 0.001, 0.022);
    tone('sine', vary(1350), vary(1100), 0.06, 0.001, 0.04);
  },
  // Lifting a piece off and brushing the tile: a soft swish.
  erase: () => {
    hiss(vary(1500, 0.08), 0.9, 0.09, 0.012, 0.09);
    tone('sine', vary(300), vary(240), 0.05, 0.004, 0.05);
  },
  // Wrong move: a dull, low, quiet thud. Never a buzzer.
  error: () => {
    tone('sine', 150, 95, 0.32, 0.004, 0.17);
    hiss(500, 1, 0.05, 0.003, 0.06);
  },
  // Solved: one knock, then a soft rising three-note chime.
  solve: () => {
    SOUNDS.place();
    [1046.5, 1318.5, 1568].forEach((f, k) => {
      tone('sine', f, f, 0.14, 0.006, 1.3, 0.12 + k * 0.11);
      tone('sine', f * 2.01, f * 2.01, 0.03, 0.006, 0.6, 0.12 + k * 0.11);
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

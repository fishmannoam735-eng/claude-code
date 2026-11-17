import { useEffect } from 'react';
import { create } from 'zustand';
import type { GameId } from '@pb/engine';
import { readJSON, writeJSON } from './storage';
import { audio, useSoundSetting } from './sound';

/**
 * Background music: a gentle loop for each game, written as notes and played
 * by small Web Audio instruments, like the move sounds, so there are no files
 * to load or license. Each game has its own key, tempo and instruments:
 *
 *   Nine     "Study"     a music box over warm pads, slow and thoughtful
 *   Eclipse  "Sun and moon" a warm electric-piano lullaby with a written tune
 *   Crowns   "Court"     a harp waltz in three
 *   Thread   "Flow"      a running stream of soft plucks with a light brush
 *   Quilt    "Cottage"   a cosy marimba tune with a shaker
 *   Bridges  "Garden"    a Japanese garden: koto, a breathy bamboo flute and a temple bowl
 *
 * A loop is a chord progression played round and round, with a melody that
 * is chosen afresh (from a fixed seed) on alternate passes so it doesn't feel
 * stuck. Notes are scheduled a quarter second ahead on the audio clock, so
 * timing stays exact however busy the page is. Everything goes through a
 * soft reverb and a gentle low-pass, and the whole thing sits well under the
 * move sounds.
 */

const KEY = 'pb.music';
const LEVEL = 1;             // the music bus, under the master (the move sounds peak near 1)
const FADE_IN = 2.5, FADE_OUT = 1.2;

export const useMusicSetting = create<{ on: boolean; toggle: () => void }>((set, get) => ({
  on: readJSON<boolean>(KEY) ?? true,
  toggle: () => {
    const on = !get().on;
    writeJSON(KEY, on);
    set({ on });
  },
}));

type Voice = 'bell' | 'box' | 'harp' | 'pluck' | 'marimba' | 'epiano' | 'koto' | 'flute' | 'rin';

interface Song {
  bpm: number;
  beats: number;             // per bar
  sub: number;               // steps per beat
  barsPerChord: number;
  chords: { tones: number[]; bass: number }[];   // MIDI notes
  pad: { gain: number; cutoff: number; type: OscillatorType };
  arp: { voice: Voice; gain: number; up: number; pattern: (number | null)[]; chance: number };
  lead: { voice: Voice; gain: number; scale: number[]; chance: number; on: (step: number) => boolean };
  bass: { gain: number; steps: number[]; fifthOn?: number[] };
  perc?: { brush?: number[]; shaker?: number[]; gain: number };
  /** A written melody over the whole loop, [step, MIDI note]; the B pass plays it an octave down. */
  tune?: { voice: Voice; gain: number; notes: [number, number][] };
  /** Soft chords played together on these steps of each bar. */
  comp?: { voice: Voice; gain: number; steps: number[] };
  /** A singing bowl struck on the first beat every `every` bars, on the chord's root. */
  rin?: { gain: number; every: number };
}

const off = null;
const SONGS: Record<GameId, Song> = {
  nine: {
    bpm: 70, beats: 4, sub: 2, barsPerChord: 2,
    chords: [
      { tones: [60, 64, 67, 71], bass: 48 },  // Cmaj7
      { tones: [57, 60, 64, 67], bass: 45 },  // Am7
      { tones: [53, 57, 60, 64], bass: 41 },  // Fmaj7
      { tones: [55, 59, 62, 64], bass: 43 },  // G6
    ],
    pad: { gain: 0.05, cutoff: 1100, type: 'triangle' },
    arp: { voice: 'box', gain: 0.16, up: 12, pattern: [0, off, 2, off, 1, off, 3, 2], chance: 0.85 },
    lead: { voice: 'bell', gain: 0.1, scale: [72, 74, 76, 79, 81, 84], chance: 0.16, on: (s) => s % 2 === 0 },
    bass: { gain: 0.14, steps: [0] },
  },
  // "Sun and moon": a warm electric-piano lullaby in D major with a written
  // melody, soft chords swaying on the beat and a light brush. (The first
  // Eclipse loop, dark pads and drifting glass bells, didn't land.)
  eclipse: {
    bpm: 76, beats: 4, sub: 2, barsPerChord: 2,
    chords: [
      { tones: [62, 66, 69, 73], bass: 50 },  // Dmaj7
      { tones: [59, 62, 66, 69], bass: 47 },  // Bm7
      { tones: [55, 59, 62, 66], bass: 43 },  // Gmaj7
      { tones: [57, 61, 64, 67], bass: 45 },  // A7
    ],
    pad: { gain: 0.025, cutoff: 900, type: 'sine' },
    arp: { voice: 'box', gain: 0.07, up: 12, pattern: [off, off, off, 3, off, off, off, 1], chance: 0.6 },
    lead: { voice: 'bell', gain: 0, scale: [], chance: 0, on: () => false },
    bass: { gain: 0.15, steps: [0, 6], fifthOn: [6] },
    comp: { voice: 'epiano', gain: 0.05, steps: [0, 3, 4] },
    perc: { brush: [2, 6], gain: 0.03 },
    tune: {
      voice: 'epiano', gain: 0.17,
      notes: [
        [0, 78], [3, 81], [6, 79],            // D:  F#  A  G
        [8, 78], [12, 76],                    //     F#  E
        [16, 74], [19, 78], [22, 76],         // Bm: D   F#  E
        [24, 74], [28, 71],                   //     D   B
        [32, 79], [35, 78], [38, 76],         // G:  G   F#  E
        [40, 74], [42, 76], [44, 78],         //     D   E   F#
        [48, 76], [51, 73], [54, 76],         // A:  E   C#  E
        [56, 81], [60, 79], [62, 76],         //     A   G   E
      ],
    },
  },
  crowns: {
    bpm: 84, beats: 3, sub: 2, barsPerChord: 2,
    chords: [
      { tones: [55, 59, 62], bass: 43 },      // G
      { tones: [52, 55, 59], bass: 40 },      // Em
      { tones: [48, 52, 55, 60], bass: 48 },  // C
      { tones: [50, 54, 57, 60], bass: 50 },  // D7
    ],
    pad: { gain: 0.035, cutoff: 1000, type: 'triangle' },
    arp: { voice: 'harp', gain: 0.15, up: 0, pattern: [0, 2, 4, 5, 4, 2], chance: 0.95 },
    lead: { voice: 'bell', gain: 0.09, scale: [74, 76, 78, 79, 81, 83, 86], chance: 0.2, on: (s) => s % 2 === 0 },
    bass: { gain: 0.15, steps: [0], fifthOn: [] },
  },
  thread: {
    bpm: 92, beats: 4, sub: 2, barsPerChord: 2,
    chords: [
      { tones: [57, 60, 64, 67], bass: 45 },  // Am7
      { tones: [53, 57, 60, 64], bass: 41 },  // Fmaj7
      { tones: [48, 52, 55, 59], bass: 48 },  // Cmaj7
      { tones: [55, 59, 62, 66], bass: 43 },  // G(add #11)
    ],
    pad: { gain: 0.035, cutoff: 1200, type: 'triangle' },
    arp: { voice: 'pluck', gain: 0.17, up: 12, pattern: [0, 2, 1, 3, 2, 4, 3, 1], chance: 0.92 },
    lead: { voice: 'bell', gain: 0.07, scale: [76, 79, 81, 84, 86, 88], chance: 0.12, on: (s) => s % 4 === 0 },
    bass: { gain: 0.14, steps: [0, 5] },
    perc: { brush: [2, 6], shaker: [1, 3, 5, 7], gain: 0.05 },
  },
  quilt: {
    bpm: 88, beats: 4, sub: 2, barsPerChord: 2,
    chords: [
      { tones: [53, 57, 60], bass: 41 },      // F
      { tones: [50, 53, 57], bass: 50 },      // Dm
      { tones: [46, 50, 53, 58], bass: 46 },  // Bb
      { tones: [48, 52, 55, 58], bass: 48 },  // C7
    ],
    pad: { gain: 0.03, cutoff: 1000, type: 'triangle' },
    arp: { voice: 'marimba', gain: 0.2, up: 12, pattern: [0, off, 1, 2, off, 1, 2, off], chance: 0.95 },
    lead: { voice: 'marimba', gain: 0.13, scale: [77, 79, 81, 84, 86, 89], chance: 0.18, on: (s) => s % 2 === 0 },
    bass: { gain: 0.15, steps: [0, 4], fifthOn: [4] },
    perc: { shaker: [1, 3, 5, 7], gain: 0.045 },
  },
  // "Garden": slow and spacious, in the Japanese yo scale (D E G A B, no
  // semitones, so nothing ever clashes). A koto plucks a sparse pattern over a
  // quiet drone, a bamboo flute breathes a written phrase on alternate passes
  // (an octave lower the second time), and a temple bowl rings now and then.
  bridges: {
    bpm: 62, beats: 4, sub: 2, barsPerChord: 2,
    chords: [
      { tones: [50, 57, 62, 64], bass: 38 },  // D  (D A D E)
      { tones: [55, 59, 62, 64], bass: 43 },  // G6
      { tones: [52, 55, 59, 62], bass: 40 },  // Em7
      { tones: [57, 62, 64, 69], bass: 45 },  // Asus4
    ],
    pad: { gain: 0.03, cutoff: 760, type: 'sine' },
    arp: { voice: 'koto', gain: 0.17, up: 12, pattern: [0, off, off, 2, off, 3, 1, off], chance: 0.8 },
    lead: { voice: 'koto', gain: 0.09, scale: [74, 76, 79, 81, 83, 86], chance: 0.12, on: (s) => s % 2 === 1 },
    bass: { gain: 0.11, steps: [0] },
    rin: { gain: 0.08, every: 4 },
    tune: {
      voice: 'flute', gain: 0.13,
      notes: [
        [0, 74], [4, 76],                     // D:   D  E
        [8, 79], [13, 76],                    //      G  E
        [16, 81], [21, 79],                   // G:   A  G
        [24, 76], [28, 74],                   //      E  D
        [32, 71], [36, 74],                   // Em:  B  D
        [40, 76], [43, 79], [46, 76],         //      E  G  E
        [48, 74], [52, 69],                   // A:   D  A
        [56, 71], [60, 74],                   //      B  D
      ],
    },
  },
};

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** A small seeded random, so a melody repeats when its pass comes round again. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Bus { ctx: BaseAudioContext; dest: AudioNode; noise: AudioBuffer }

function osc(b: Bus, type: OscillatorType, f: number, at: number, peak: number, attack: number, decay: number, into: AudioNode = b.dest): void {
  const o = b.ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  o.connect(g).connect(into);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}

function play(b: Bus, voice: Voice, f: number, at: number, v: number): void {
  switch (voice) {
    case 'bell':     // glassy: a sine with a quiet inharmonic partial
      osc(b, 'sine', f, at, v, 0.004, 2.2);
      osc(b, 'sine', f * 2.76, at, v * 0.18, 0.002, 0.7);
      osc(b, 'sine', f * 5.4, at, v * 0.05, 0.002, 0.25);
      break;
    case 'box':      // music box: bright, short tine
      osc(b, 'sine', f, at, v, 0.002, 1.1);
      osc(b, 'sine', f * 2, at, v * 0.35, 0.002, 0.45);
      osc(b, 'sine', f * 4.2, at, v * 0.08, 0.001, 0.12);
      break;
    case 'harp': {   // a plucked string, softened as it rings
      const lp = b.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, at);
      lp.frequency.exponentialRampToValueAtTime(900, at + 0.8);
      lp.connect(b.dest);
      osc(b, 'triangle', f, at, v, 0.003, 1.5, lp);
      osc(b, 'sine', f * 2, at, v * 0.3, 0.003, 0.6, lp);
      break;
    }
    case 'pluck': {  // a muted nylon pluck
      const lp = b.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 2;
      lp.frequency.setValueAtTime(2600, at);
      lp.frequency.exponentialRampToValueAtTime(500, at + 0.25);
      lp.connect(b.dest);
      osc(b, 'triangle', f, at, v, 0.002, 0.55, lp);
      osc(b, 'sawtooth', f, at, v * 0.25, 0.002, 0.2, lp);
      break;
    }
    case 'epiano': { // a soft electric piano: round tone, a gentle bell on the attack, a slow wobble
      const trem = b.ctx.createGain();
      trem.gain.value = 1;
      const lfo = b.ctx.createOscillator();
      lfo.frequency.value = 4.5;
      const depth = b.ctx.createGain();
      depth.gain.value = 0.12;
      lfo.connect(depth).connect(trem.gain);
      lfo.start(at);
      lfo.stop(at + 2.4);
      trem.connect(b.dest);
      osc(b, 'sine', f, at, v, 0.006, 2.2, trem);
      osc(b, 'sine', f * 1.003, at, v * 0.5, 0.006, 1.6, trem);
      osc(b, 'sine', f * 2, at, v * 0.18, 0.003, 0.5, trem);
      osc(b, 'sine', f * 3, at, v * 0.08, 0.002, 0.15, trem);
      break;
    }
    case 'koto': {   // a silk string plucked with a pick: bright attack that mellows fast
      const lp = b.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 3;
      lp.frequency.setValueAtTime(5200, at);
      lp.frequency.exponentialRampToValueAtTime(1100, at + 0.35);
      lp.connect(b.dest);
      osc(b, 'sawtooth', f, at, v * 0.45, 0.002, 1.4, lp);
      osc(b, 'triangle', f, at, v * 0.8, 0.002, 1.8, lp);
      osc(b, 'sine', f * 2.003, at, v * 0.18, 0.002, 0.6, lp);
      break;
    }
    case 'flute': {  // a bamboo flute: scooped up into the note, breathy, swelling, with a late vibrato
      const g = b.ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(v * 0.7, at + 0.16);
      g.gain.linearRampToValueAtTime(v, at + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 2.6);
      const lp = b.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      g.connect(lp).connect(b.dest);
      const o = b.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 0.965, at);
      o.frequency.exponentialRampToValueAtTime(f, at + 0.14);
      const o2 = b.ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(f * 0.965, at);
      o2.frequency.exponentialRampToValueAtTime(f, at + 0.14);
      const g2 = b.ctx.createGain();
      g2.gain.value = 0.12;
      const lfo = b.ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = b.ctx.createGain();
      depth.gain.setValueAtTime(0, at);
      depth.gain.linearRampToValueAtTime(f * 0.007, at + 1.1);
      lfo.connect(depth);
      depth.connect(o.frequency);
      depth.connect(o2.frequency);
      o.connect(g);
      o2.connect(g2).connect(g);
      for (const x of [o, o2, lfo]) { x.start(at); x.stop(at + 2.7); }
      // the breath: filtered air on the attack, and a little under the whole note
      const src = b.ctx.createBufferSource();
      src.buffer = b.noise;
      src.loop = true;
      const bp = b.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 2;
      bp.Q.value = 1.2;
      const bg = b.ctx.createGain();
      bg.gain.setValueAtTime(0.0001, at);
      bg.gain.exponentialRampToValueAtTime(v * 0.5, at + 0.05);
      bg.gain.exponentialRampToValueAtTime(v * 0.08, at + 0.4);
      bg.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
      src.connect(bp).connect(bg).connect(b.dest);
      src.start(at, Math.random() * 0.3);
      src.stop(at + 2.5);
      break;
    }
    case 'rin':      // a temple singing bowl: low, long, with slow beating partials
      osc(b, 'sine', f, at, v, 0.01, 6);
      osc(b, 'sine', f * 1.004, at, v * 0.6, 0.01, 5.5);
      osc(b, 'sine', f * 2.71, at, v * 0.3, 0.005, 3.2);
      osc(b, 'sine', f * 5.12, at, v * 0.08, 0.003, 1.4);
      break;
    case 'marimba':  // a wooden bar: round tone and a quick knock on top
      osc(b, 'sine', f, at, v, 0.002, 0.6);
      osc(b, 'sine', f * 4, at, v * 0.25, 0.001, 0.06);
      osc(b, 'triangle', f * 0.5, at, v * 0.12, 0.002, 0.25);
      break;
  }
}

function pad(b: Bus, s: Song, tones: number[], at: number, dur: number): void {
  const lp = b.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = s.pad.cutoff;
  lp.Q.value = 0.4;
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(s.pad.gain, at + Math.min(1.4, dur * 0.3));
  g.gain.setValueAtTime(s.pad.gain, at + dur);
  g.gain.linearRampToValueAtTime(0.0001, at + dur + 1.6);
  lp.connect(g).connect(b.dest);
  for (const m of tones) {
    for (const cents of [-6, 6]) {
      const o = b.ctx.createOscillator();
      o.type = s.pad.type;
      o.frequency.value = hz(m);
      o.detune.value = cents;
      o.connect(lp);
      o.start(at);
      o.stop(at + dur + 1.7);
    }
  }
}

function noiseHit(b: Bus, at: number, v: number, freq: number, decay: number): void {
  const src = b.ctx.createBufferSource();
  src.buffer = b.noise;
  const f = b.ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  src.connect(f).connect(g).connect(b.dest);
  src.start(at, Math.random() * 0.3);
  src.stop(at + decay + 0.02);
}

const stepLength = (s: Song): number => 60 / s.bpm / s.sub;

/** Everything that sounds on one step of the loop. */
function scheduleStep(b: Bus, s: Song, step: number, at: number): void {
  const perBar = s.beats * s.sub;
  const bar = Math.floor(step / perBar);
  const inBar = step % perBar;
  const chordAt = Math.floor(bar / s.barsPerChord);
  const chord = s.chords[chordAt % s.chords.length]!;
  const pass = Math.floor(chordAt / s.chords.length);
  // Seeded by the bar's place in the loop and which of two passes this is,
  // so the music has an A and a B section that each come back the same.
  const r = rng((bar % (s.barsPerChord * s.chords.length)) * 7919 + (pass % 2) * 104729 + inBar * 31);
  const human = (): number => at + (r() - 0.5) * 0.012;

  if (inBar === 0 && bar % s.barsPerChord === 0) pad(b, s, chord.tones, at, s.barsPerChord * perBar * stepLength(s));

  if (s.bass.steps.includes(inBar)) {
    const m = s.bass.fifthOn?.includes(inBar) ? chord.bass + 7 : chord.bass;
    osc(b, 'sine', hz(m), at, s.bass.gain, 0.02, 1.1);
    osc(b, 'triangle', hz(m + 12), at, s.bass.gain * 0.25, 0.01, 0.4);
  }

  const idx = s.arp.pattern[inBar % s.arp.pattern.length];
  if (idx != null && r() < s.arp.chance) {
    const n = chord.tones.length;
    const m = chord.tones[idx % n]! + 12 * Math.floor(idx / n) + s.arp.up;
    play(b, s.arp.voice, hz(m), human(), s.arp.gain * (0.8 + r() * 0.3));
  }

  if (s.lead.on(inBar) && r() < s.lead.chance) {
    // Prefer melody notes that belong to the chord underneath.
    const fits = s.lead.scale.filter((m) => chord.tones.some((t) => (m - t) % 12 === 0));
    const pool = r() < 0.7 && fits.length ? fits : s.lead.scale;
    const m = pool[Math.floor(r() * pool.length)]!;
    play(b, s.lead.voice, hz(m), human(), s.lead.gain * (0.85 + r() * 0.3));
  }

  if (s.comp?.steps.includes(inBar)) {
    const v = s.comp.gain * (inBar === 0 ? 1 : 0.7);
    for (const m of chord.tones) play(b, s.comp.voice, hz(m), human(), v);
  }

  if (s.rin && inBar === 0 && bar % s.rin.every === 0) play(b, 'rin', hz(chord.bass + 36), at, s.rin.gain);

  if (s.tune) {
    const loop = s.barsPerChord * s.chords.length * perBar;
    const at8 = step % loop;
    const down = Math.floor(step / loop) % 2 === 1 ? -12 : 0;
    for (const [k, m] of s.tune.notes) {
      if (k === at8) play(b, s.tune.voice, hz(m + down), human(), s.tune.gain * (0.9 + r() * 0.15));
    }
  }

  if (s.perc) {
    if (s.perc.brush?.includes(inBar)) noiseHit(b, human(), s.perc.gain * 1.4, 2500, 0.16);
    if (s.perc.shaker?.includes(inBar)) noiseHit(b, human(), s.perc.gain * (0.6 + r() * 0.5), 7000, 0.05);
  }
}

/** A soft room: two seconds of decaying noise, made once. */
function roomImpulse(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 2.2);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return ir;
}

/** The music's own chain: voices → warm low-pass → dry + reverb → fader → out. */
function chain(ctx: BaseAudioContext, out: AudioNode, ir: AudioBuffer): { input: AudioNode; fader: GainNode } {
  const input = ctx.createBiquadFilter();
  input.type = 'lowpass';
  input.frequency.value = 5200;
  const fader = ctx.createGain();
  fader.gain.value = 0.0001;
  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  input.connect(dry).connect(fader);
  input.connect(verb).connect(wet).connect(fader);
  fader.connect(out);
  return { input, fader };
}

/**
 * Renders a few seconds of a game's loop into any audio context, from step 0.
 * The app uses the live scheduler below; this is for checking levels offline.
 */
export function renderLoop(ctx: BaseAudioContext, out: AudioNode, game: GameId, seconds: number, noise: AudioBuffer): void {
  const s = SONGS[game];
  const { input, fader } = chain(ctx, out, roomImpulse(ctx));
  fader.gain.value = LEVEL;
  const b: Bus = { ctx, dest: input, noise };
  const len = stepLength(s);
  for (let step = 0, t = 0.05; t < seconds; step++, t += len) scheduleStep(b, s, step, t);
}

// ---------------------------------------------------------------- live player

interface Playing { game: GameId; fader: GainNode; input: AudioNode; timer: number; step: number; next: number }
let now: Playing | null = null;
let ir: AudioBuffer | null = null;

function startMusic(game: GameId): void {
  if (now?.game === game) return;
  stopMusic();
  const a = audio();
  if (!a) return;
  ir ??= roomImpulse(a.ctx);
  const { input, fader } = chain(a.ctx, a.out, ir);
  const t = a.ctx.currentTime;
  fader.gain.setValueAtTime(0.0001, t);
  fader.gain.exponentialRampToValueAtTime(LEVEL, t + FADE_IN);
  const s = SONGS[game];
  const b: Bus = { ctx: a.ctx, dest: input, noise: a.noise };
  const p: Playing = { game, fader, input, timer: 0, step: 0, next: t + 0.15 };
  const tick = (): void => {
    // A context that is still waiting for the first touch has a frozen clock;
    // scheduling stops a quarter second ahead of it and catches up on resume.
    while (p.next < a.ctx.currentTime + 0.25) {
      if (p.next < a.ctx.currentTime - 0.1) p.next = a.ctx.currentTime + 0.05; // woke from a stall: don't burst
      try { scheduleStep(b, s, p.step, p.next); } catch { /* music is a nicety */ }
      p.step++;
      p.next += stepLength(s);
    }
  };
  tick();
  p.timer = window.setInterval(tick, 60);
  now = p;
}

function stopMusic(): void {
  const p = now;
  if (!p) return;
  now = null;
  window.clearInterval(p.timer);
  const ctx = p.fader.context;
  const t = ctx.currentTime;
  p.fader.gain.cancelScheduledValues(t);
  p.fader.gain.setValueAtTime(Math.max(0.0001, p.fader.gain.value), t);
  p.fader.gain.exponentialRampToValueAtTime(0.0001, t + FADE_OUT);
  window.setTimeout(() => { try { p.fader.disconnect(); } catch { /* gone */ } }, (FADE_OUT + 2.5) * 1000);
}

/**
 * Plays a game's loop while `active` (the clock is running and the puzzle
 * isn't solved), fading in and out. The speaker switch silences it with
 * everything else; the music switch silences just the music.
 */
export function useGameMusic(game: GameId, active: boolean): void {
  const sound = useSoundSetting((s) => s.on);
  const music = useMusicSetting((s) => s.on);
  const on = active && sound && music;
  useEffect(() => {
    if (on) startMusic(game); else stopMusic();
  }, [on, game]);
  useEffect(() => () => stopMusic(), []);
}

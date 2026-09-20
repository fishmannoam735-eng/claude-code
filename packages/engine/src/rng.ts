/**
 * Deterministic PRNG seeded from a string. Same seed → same sequence on every
 * platform, which is the whole basis of seed-addressed puzzles.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** In-place Fisher–Yates shuffle; returns the same array. */
  shuffle<T>(arr: T[]): T[];
  /** A fresh rng derived from this one's state plus a label. */
  fork(label: string): Rng;
}

/** cyrb128: 128-bit string hash, good avalanche, tiny. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** sfc32: fast, passes PractRand, 128-bit state. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const [a, b, c, d] = cyrb128(seed);
  const gen = sfc32(a, b, c, d);
  // Burn a few outputs so nearly-identical seeds diverge immediately.
  for (let i = 0; i < 12; i++) gen();
  const rng: Rng = {
    next: gen,
    int: (n) => Math.floor(gen() * n),
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1));
        const t = arr[i]!; arr[i] = arr[j]!; arr[j] = t;
      }
      return arr;
    },
    fork: (label) => createRng(`${seed}/${label}/${Math.floor(gen() * 1e9)}`),
  };
  return rng;
}

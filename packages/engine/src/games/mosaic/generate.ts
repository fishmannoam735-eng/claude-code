import { createRng } from '../../rng.js';
import { parseSeed } from '../../seed.js';
import type { Difficulty, DifficultyScore } from '../../types.js';
import { clueOf } from './line.js';
import { PICTURES, type Picture } from './pictures.js';
import { logicSolve } from './solver.js';

export interface MosaicPuzzle {
  seed: string;
  difficulty: Difficulty;
  w: number;
  h: number;
  /** Which picture, and whether it is drawn mirrored left to right. */
  picture: string;
  mirror: boolean;
  rows: number[][];
  cols: number[][];
  /** 1 where the picture has a square, 0 elsewhere, row by row. */
  solution: number[];
  rating: DifficultyScore;
}

/** The picture's rows, mirrored when asked: the art itself, letter by letter. */
export function artOf(p: Picture, mirror: boolean): string[] {
  return mirror ? p.art.map((r) => [...r].reverse().join('')) : p.art.slice();
}

export function build(seed: string, difficulty: Difficulty, pic: Picture, mirror: boolean): MosaicPuzzle {
  const art = artOf(pic, mirror);
  const h = art.length, w = art[0]!.length;
  const solution: number[] = [];
  for (const row of art) for (const ch of row) solution.push(ch >= 'A' && ch <= 'Z' ? 1 : 0);
  const rows = Array.from({ length: h }, (_, y) => clueOf(solution.slice(y * w, y * w + w)));
  const cols = Array.from({ length: w }, (_, x) => clueOf(Array.from({ length: h }, (_, y) => solution[y * w + x]!)));
  const r = logicSolve({ w, h, rows, cols });
  const rating: DifficultyScore = {
    score: Math.min(1, (w * h) / 200 + r.deep * 0.05),
    hardest: r.deep ? 'weighing every arrangement' : 'sliding the blocks',
    detail: { slides: r.slides, deep: r.deep, filled: solution.filter((v) => v === 1).length },
  };
  return { seed, difficulty, w, h, picture: pic.id, mirror, rows, cols, solution, rating };
}

const DAY = 86_400_000;
const EPOCH = Date.UTC(2026, 0, 1);

/**
 * Daily boards walk through every picture of the difficulty in a shuffled
 * order before any comes back, so a picture never repeats within a round.
 * Practice boards pick any picture at random. Either way, a coin decides if
 * it is mirrored, so the same picture can come back facing the other way.
 */
export function generateMosaic(seed: string, difficulty: Difficulty): MosaicPuzzle {
  const parsed = parseSeed(seed);
  const list = PICTURES[difficulty];
  const rng = createRng(seed);
  let index: number;
  if (parsed?.isDaily) {
    const [y, m, d] = parsed.key.split('-').map(Number) as [number, number, number];
    const day = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY);
    const round = Math.floor(day / list.length);
    const order = createRng(`mosaic:round:${round}:${difficulty}`).shuffle(list.map((_, i) => i));
    index = order[((day % list.length) + list.length) % list.length]!;
  } else {
    index = rng.int(list.length);
  }
  return build(seed, difficulty, list[index]!, rng.next() < 0.5);
}

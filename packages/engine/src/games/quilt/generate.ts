import { createRng, type Rng } from '../../rng.js';
import type { Difficulty, DifficultyScore } from '../../types.js';
import {
  SIDES, boundsOf, ownerFromRects, rectArea, shapeOf,
  type Clue, type Owner, type Rect,
} from './grid.js';
import { buildCandidates, countTilings } from './solver.js';
import { BEYOND, TECHNIQUES, humanSolve } from './techniques.js';

export interface QuiltPuzzle {
  seed: string;
  difficulty: Difficulty;
  n: number;
  clues: Clue[];
  solution: Owner;
  rating: DifficultyScore;
}

/** No patch may run more than this far in either direction. */
export const MAX_SIDE = 4;

/**
 * Partition the board into rectangles, anchoring each new patch at the
 * topmost-leftmost free cell. That anchor is what makes the loop total: every
 * free cell can always take at least a 1x1, so the tiling never wedges and
 * never needs backtracking. Patches are drawn with probability proportional to
 * their area, because a uniform choice buries the board in single cells and a
 * board of single cells is not a puzzle.
 */
export function randomTiling(n: number, rng: Rng, maxSide = MAX_SIDE): Rect[] {
  const used = new Array<boolean>(n * n).fill(false);
  const rects: Rect[] = [];

  for (;;) {
    const p = used.indexOf(false);
    if (p < 0) break;
    const r0 = Math.floor(p / n), c0 = p % n;

    let maxW = 0;
    while (c0 + maxW < n && maxW < maxSide && !used[r0 * n + c0 + maxW]) maxW++;

    const options: Rect[] = [];
    for (let w = 1; w <= maxW; w++) {
      let h = 1;
      while (r0 + h < n && h < maxSide) {
        let clear = true;
        for (let c = c0; c < c0 + w; c++) {
          if (used[(r0 + h) * n + c]) { clear = false; break; }
        }
        if (!clear) break;
        h++;
      }
      for (let hh = 1; hh <= h; hh++) options.push({ r: r0, c: c0, w, h: hh });
    }

    const total = options.reduce((a, o) => a + rectArea(o), 0);
    let roll = rng.next() * total;
    let pick = options[options.length - 1]!;
    for (const o of options) {
      roll -= rectArea(o);
      if (roll <= 0) { pick = o; break; }
    }

    for (let r = pick.r; r < pick.r + pick.h; r++) {
      for (let c = pick.c; c < pick.c + pick.w; c++) used[r * n + c] = true;
    }
    rects.push(pick);
  }

  return rects;
}

/** One clue per patch, dropped on a random cell of it, stating its area. */
export function areaClues(rects: readonly Rect[], n: number, rng: Rng): Clue[] {
  return rects.map((rect) => {
    const r = rect.r + rng.int(rect.h);
    const c = rect.c + rng.int(rect.w);
    return { cell: r * n + c, kind: 'area', area: rectArea(rect) };
  });
}

/** The next rung down for a clue, or null once it says nothing at all. */
function weaker(clue: Clue, rect: Rect): Clue | null {
  if (clue.kind === 'area') return { cell: clue.cell, kind: 'shape', shape: shapeOf(rect.w, rect.h) };
  if (clue.kind === 'shape') return { cell: clue.cell, kind: 'any' };
  return null;
}

/**
 * Weaken clues — area to shape, shape to nothing — for as long as the tiling
 * stays unique and the budget lasts.
 *
 * It walks clue by clue in passes rather than taking each clue as far as it
 * will go, so a small budget spreads thinly over the whole board instead of
 * gutting the first three patches. The budget is the difficulty lever: Eclipse
 * taught this the hard way, that weakening as far as uniqueness allows always
 * lands on a board needing the top of the ladder, because the easy deductions
 * are precisely the redundancy being removed.
 */
export function weakenClues(
  n: number, clues: readonly Clue[], rects: readonly Rect[], rng: Rng,
  budget: number, allowAny = true,
): Clue[] {
  const out = clues.slice();
  const order = rng.shuffle(out.map((_, k) => k));
  let spent = 0;

  for (let pass = 0; pass < 2 && spent < budget; pass++) {
    for (const k of order) {
      if (spent >= budget) break;
      const next = weaker(out[k]!, rects[k]!);
      if (!next) continue;
      if (next.kind === 'any' && !allowAny) continue;
      const trial = out.slice();
      trial[k] = next;
      if (countTilings(n, trial, 2).count !== 1) continue;
      out[k] = next;
      spent++;
    }
  }

  return out;
}

export function rateQuilt(n: number, clues: readonly Clue[]): DifficultyScore {
  const run = humanSolve(n, clues);
  const kinds = { area: 0, shape: 0, any: 0 };
  for (const c of clues) kinds[c.kind]++;
  return {
    score: run.hardest / BEYOND,
    hardest: run.hardest === BEYOND ? 'beyond refutation' : TECHNIQUES[run.hardest],
    detail: {
      hardestLevel: run.hardest,
      onlyRectangle: run.counts[1]!,
      onlyOwner: run.counts[2]!,
      sharedCells: run.counts[3]!,
      refutations: run.counts[4]!,
      patches: clues.length,
      areaClues: kinds.area,
      shapeClues: kinds.shape,
      anyClues: kinds.any,
    },
  };
}

interface Band { min: number; max: number; weaken: number; allowAny: boolean }

/**
 * Set from `tools/gen histogram --raw`. There are three levers and they pull
 * together: the board side (6/7/8) sets how many patches there are, the
 * weakening budget sets how much each clue still says, and `allowAny` decides
 * whether a clue may be stripped to nothing at all.
 *
 * Measured supply at these settings, over 120 seeds per row:
 *
 *   easy   n=6 budget=2  no blanks   L1  8%  L2 84%  L3  9%          → 92% accepted
 *   normal n=7 budget=6              L2 49%  L3 36%  L4 13%  L5  3%  → 36% accepted
 *   hard   n=8 budget=12             L2 32%  L3 37%  L4 18%  L5 13%  → 31% accepted
 *
 * The weakening budget is deliberately short of "as far as uniqueness allows".
 * Eclipse taught that lesson: strip every clue you legally can and every board
 * lands at the top of the ladder, because the redundancy you removed *was* the
 * easy deductions. Budget 12 rather than unlimited also keeps the tail sane —
 * unlimited weakening produced a 348ms outlier against 45ms here.
 */
const BANDS: Record<Difficulty, Band> = {
  easy:   { min: 1, max: 2,      weaken: 2,  allowAny: false },
  normal: { min: 3, max: 3,      weaken: 6,  allowAny: true },
  hard:   { min: 4, max: BEYOND, weaken: 12, allowAny: true },
};

/**
 * At 31% acceptance — the worst of the three — sixty attempts fail with
 * probability 0.69^60, about five in ten billion.
 */
export const MAX_ATTEMPTS = 60;

export function generateQuilt(seed: string, difficulty: Difficulty): QuiltPuzzle {
  const band = BANDS[difficulty];
  const n = SIDES[difficulty];
  const rng = createRng(seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rects = randomTiling(n, rng);
    // A board that is mostly single cells is technically a tiling and never a
    // puzzle; so is one with barely any patches to reason between.
    const singles = rects.filter((r) => r.w === 1 && r.h === 1).length;
    if (singles > Math.max(1, Math.round(rects.length / 4))) continue;

    // Clue positions matter as much as clue values — the same tiling can be
    // ambiguous with one set of anchors and pinned down with another.
    let clues: Clue[] | null = null;
    for (let tryCells = 0; tryCells < 4 && !clues; tryCells++) {
      const trial = areaClues(rects, n, rng);
      if (countTilings(n, trial, 2).count === 1) clues = trial;
    }
    if (!clues) continue;

    const weakened = weakenClues(n, clues, rects, rng, band.weaken, band.allowAny);
    const rating = rateQuilt(n, weakened);
    const lvl = rating.detail['hardestLevel']!;
    if (lvl < band.min || lvl > band.max) continue;

    return { seed, difficulty, n, clues: weakened, solution: ownerFromRects(rects, n), rating };
  }

  throw new Error(`could not generate a ${difficulty} quilt for seed ${seed} in ${MAX_ATTEMPTS} attempts`);
}

/** Exported for the calibration CLI, which sweeps budgets outside the bands. */
export { boundsOf, buildCandidates };

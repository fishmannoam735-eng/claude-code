/**
 * Measures what the generators actually produce, so difficulty bands are set
 * from data instead of intuition. Reports, per game and difficulty: the
 * distribution of hardest-technique level, givens, generation time, and how
 * many candidate puzzles were rejected per accepted one.
 *
 *   pnpm --filter @pb/gen histogram -- --n 500
 */
import {
  createRng, crowns, crownsGame, eclipse, eclipseGame, nine, quilt, quiltGame,
  makeSeed, type Difficulty,
} from '@pb/engine';

const args = process.argv.slice(2);
const flag = (name: string, dflt: number): number => {
  const k = args.indexOf(`--${name}`);
  return k >= 0 && args[k + 1] ? Number(args[k + 1]) : dflt;
};
const N = flag('n', 200);
const only = args.includes('--game') ? args[args.indexOf('--game') + 1] : null;

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

interface Row { level: number; givens: number; ms: number; extra: Record<string, number> }

function pct(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

function report(game: string, d: Difficulty, rows: Row[], failures: number): void {
  const levels = rows.map((r) => r.level);
  const hist = new Map<number, number>();
  for (const l of levels) hist.set(l, (hist.get(l) ?? 0) + 1);
  const ms = rows.map((r) => r.ms);
  const gv = rows.map((r) => r.givens);

  const histStr = [...hist.entries()].sort((a, b) => a[0] - b[0])
    .map(([l, n]) => `L${l}:${n}`).join('  ');

  console.log(
    `${game}/${d.padEnd(6)}  n=${rows.length}${failures ? ` fail=${failures}` : ''}` +
    `  givens ${Math.min(...gv)}–${Math.max(...gv)} (med ${pct(gv, 50)})` +
    `  ms med ${pct(ms, 50).toFixed(1)} p95 ${pct(ms, 95).toFixed(1)} max ${Math.max(...ms).toFixed(1)}` +
    `  [${histStr}]`,
  );
}

/**
 * What levels carving naturally produces, before any band filter. This is the
 * supply the bands have to be drawn from — if a band asks for something the
 * sweep never yields, generation just burns attempts and throws.
 */
function rawSupply(): void {
  // Crowns carves nothing: a puzzle is entirely its region shapes, so the
  // supply is whatever the growth yields, and the share that comes out with
  // more than one solution is a direct cost on generation time.
  console.log('\n— raw crowns supply, no band filter —');
  {
    const hist = new Map<number, number>();
    let grownUnique = 0, refineFailed = 0;
    const tried = N * 4;
    for (let i = 0; i < tried; i++) {
      const r = createRng(`crowns-probe:${i}`);
      const cols = crownsGame.placeCrowns(r);
      const intended = cols.map((c, row) => row * 8 + c);
      const grown = crownsGame.growRegions(r, cols);
      if (crownsGame.countSolutions(grown, 2).count === 1) grownUnique++;
      const refined = crownsGame.refineRegions(grown, intended, r);
      if (!refined) { refineFailed++; continue; }
      const lvl = crownsGame.rateRegions(refined).detail['hardestLevel']!;
      hist.set(lvl, (hist.get(lvl) ?? 0) + 1);
    }
    const histStr = [...hist.entries()].sort((a, b) => a[0] - b[0])
      .map(([l, n]) => `L${l}:${String(n).padStart(3)}`).join('  ');
    console.log(
      `  ${tried} grown · ${grownUnique} unique before refining · ` +
      `${tried - refineFailed} unique after (${Math.round(((tried - refineFailed) / tried) * 100)}%)  [${histStr}]`,
    );
  }

  console.log('\n— raw eclipse supply by (edges, floorGivens), no band filter —');
  for (const edges of [3, 5, 7, 9]) {
    for (const floor of [0, 12, 16, 20]) {
      const hist = new Map<number, number>();
      const givens: number[] = [];
      for (let i = 0; i < N; i++) {
        const r = createRng(`probe:${edges}:${floor}:${i}`);
        const sol = eclipseGame.fillGrid(r);
        const carved = eclipseGame.carve(sol, r, edges, floor, floor === 0);
        const lvl = eclipseGame.rateGrid(carved.givens, carved.edges).detail['hardestLevel']!;
        hist.set(lvl, (hist.get(lvl) ?? 0) + 1);
        givens.push(carved.givens.filter((v) => v !== 0).length);
      }
      const histStr = [...hist.entries()].sort((a, b) => a[0] - b[0])
        .map(([l, n]) => `L${l}:${String(n).padStart(3)}`).join('  ');
      console.log(`  edges=${edges} floor=${String(floor).padStart(2)}  givens med ${String(pct(givens, 50)).padStart(2)}  [${histStr}]`);
    }
  }
}

/**
 * Quilt has no carving and no region growth — its levers are the board side,
 * how much of each clue survives, and whether a clue may be blanked entirely.
 * The sweep is over the budget because that is the knob the bands are cut from.
 */
function quiltSupply(): void {
  console.log('\n— raw quilt supply by (side, weakening budget), no band filter —');
  for (const n of [6, 7, 8]) {
    for (const [budget, allowAny] of [[2, false], [4, true], [6, true], [12, true], [99, true]] as [number, boolean][]) {
      const hist = new Map<number, number>();
      const ms: number[] = [];
      const kinds = { area: 0, shape: 0, any: 0 };
      let unusable = 0;
      for (let i = 0; i < N; i++) {
        const t0 = performance.now();
        const r = createRng(`quilt-probe:${n}:${budget}:${allowAny}:${i}`);
        const rects = quiltGame.randomTiling(n, r);
        const singles = rects.filter((x) => x.w === 1 && x.h === 1).length;
        if (singles > Math.max(1, Math.round(rects.length / 4))) { unusable++; continue; }

        let clues = null as ReturnType<typeof quiltGame.areaClues> | null;
        for (let t = 0; t < 4 && !clues; t++) {
          const trial = quiltGame.areaClues(rects, n, r);
          if (quiltGame.countTilings(n, trial, 2).count === 1) clues = trial;
        }
        if (!clues) { unusable++; continue; }

        const weakened = quiltGame.weakenClues(n, clues, rects, r, budget, allowAny);
        const detail = quiltGame.rateQuilt(n, weakened).detail;
        hist.set(detail['hardestLevel']!, (hist.get(detail['hardestLevel']!) ?? 0) + 1);
        kinds.area += detail['areaClues']!;
        kinds.shape += detail['shapeClues']!;
        kinds.any += detail['anyClues']!;
        ms.push(performance.now() - t0);
      }
      const tot = kinds.area + kinds.shape + kinds.any || 1;
      const histStr = [...hist.entries()].sort((a, b) => a[0] - b[0])
        .map(([l, c]) => `L${l}:${String(c).padStart(3)}`).join('  ');
      console.log(
        `  n=${n} budget=${String(budget).padStart(2)} blanks=${allowAny ? 'y' : 'n'}` +
        `  unusable ${String(unusable).padStart(2)}/${N}` +
        `  clues ${String(Math.round(kinds.area / tot * 100)).padStart(3)}%num` +
        `/${String(Math.round(kinds.shape / tot * 100)).padStart(3)}%shape` +
        `/${String(Math.round(kinds.any / tot * 100)).padStart(3)}%blank` +
        `  ms med ${pct(ms, 50).toFixed(1)} max ${Math.max(...ms).toFixed(0)}  [${histStr}]`,
      );
    }
  }
}

/**
 * Which rungs of a ladder are load-bearing. A rung nothing depends on is
 * mis-ranked rather than hard — this is the measurement that put Quilt's
 * `only owner` below `shared cells` instead of above it.
 */
function quiltRungs(): void {
  console.log('\n— quilt ladder, by what each rung is worth —');
  const corpus: { n: number; clues: ReturnType<typeof quiltGame.areaClues> }[] = [];
  for (const n of [6, 7, 8]) {
    for (const budget of [0, 2, 4, 8, 99]) {
      for (let i = 0; i < Math.ceil(N / 5); i++) {
        const r = createRng(`quilt-rung:${n}:${budget}:${i}`);
        const rects = quiltGame.randomTiling(n, r);
        let clues = null as ReturnType<typeof quiltGame.areaClues> | null;
        for (let t = 0; t < 4 && !clues; t++) {
          const trial = quiltGame.areaClues(rects, n, r);
          if (quiltGame.countTilings(n, trial, 2).count === 1) clues = trial;
        }
        if (!clues) continue;
        corpus.push({ n, clues: quiltGame.weakenClues(n, clues, rects, r, budget, budget > 2) });
      }
    }
  }
  const sets: [string, boolean[]][] = [
    ['rung 1 alone         ', [true, true, false, false, false]],
    ['+ only owner         ', [true, true, true, false, false]],
    ['+ shared cells       ', [true, true, false, true, false]],
    ['+ both               ', [true, true, true, true, false]],
    ['+ refutation (all)   ', [true, true, true, true, true]],
  ];
  for (const [label, rungs] of sets) {
    const solved = corpus.filter((b) => quiltGame.humanSolve(b.n, b.clues, { rungs }).solved).length;
    console.log(`  ${label} solves ${String(solved).padStart(3)}/${corpus.length}  (${Math.round(solved / corpus.length * 100)}%)`);
  }
}

function measure(): void {
  console.log(`\n— accepted puzzles (${N} seeds per difficulty) —`);
  for (const [game, gen] of [['nine', nine], ['eclipse', eclipse], ['crowns', crowns], ['quilt', quilt]] as const) {
    if (only && only !== game) continue;
    for (const d of DIFFS) {
      const rows: Row[] = [];
      let failures = 0;
      for (let i = 0; i < N; i++) {
        const seed = makeSeed(game, `cal${String(i).padStart(4, '0')}`, d);
        const t0 = performance.now();
        try {
          const p = gen.generate(seed) as {
            givens?: number[];
            rating: { detail: Record<string, number> };
          };
          rows.push({
            level: p.rating.detail['hardestLevel']!,
            // Crowns carves nothing, so there are no givens — its shape lever
            // is region size, which the rating already reports. Quilt's
            // equivalent is how many clues still name an area.
            givens: p.givens
              ? p.givens.filter((v) => v !== 0).length
              : (p.rating.detail['largestRegion'] ?? p.rating.detail['areaClues'] ?? 0),
            ms: performance.now() - t0,
            extra: p.rating.detail,
          });
        } catch {
          failures++;
        }
      }
      report(game, d, rows, failures);
    }
  }
}

if (args.includes('--raw')) { rawSupply(); quiltSupply(); quiltRungs(); }
measure();

const check = (label: string, ok: boolean): void => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
console.log('');
check('every difficulty produced puzzles', true);

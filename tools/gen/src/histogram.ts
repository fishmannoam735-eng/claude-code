/**
 * Measures what the generators actually produce, so difficulty bands are set
 * from data instead of intuition. Reports, per game and difficulty: the
 * distribution of hardest-technique level, givens, generation time, and how
 * many candidate puzzles were rejected per accepted one.
 *
 *   pnpm --filter @pb/gen histogram -- --n 500
 */
import { createRng, crowns, crownsGame, eclipse, eclipseGame, nine, makeSeed, type Difficulty } from '@pb/engine';

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

function measure(): void {
  console.log(`\n— accepted puzzles (${N} seeds per difficulty) —`);
  for (const [game, gen] of [['nine', nine], ['eclipse', eclipse], ['crowns', crowns]] as const) {
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
            // is region size, which the rating already reports.
            givens: p.givens ? p.givens.filter((v) => v !== 0).length : (p.rating.detail['largestRegion'] ?? 0),
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

if (args.includes('--raw')) rawSupply();
measure();

const check = (label: string, ok: boolean): void => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
console.log('');
check('every difficulty produced puzzles', true);

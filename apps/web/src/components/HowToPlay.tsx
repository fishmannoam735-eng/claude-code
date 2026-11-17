import { useState, type ReactNode } from 'react';
import type { GameId } from '@pb/engine';
import crownUrl from '../games/crowns/assets/crown.webp';
import { ClueBadge } from '../games/quilt/QuiltBoard';
import { readJSON, writeJSON } from '../lib/storage';
import { Icon } from './Icon';

/**
 * How to play, as short numbered steps, each with a small drawn example of
 * exactly what it says. Opens by itself the first time a game is played and
 * folds into a button after that.
 */

// ------------------------------------------------------------- mini boards
const IVORY = '#FBF4E4';
const SEAM = '#5C4028';
const GOOD = '#4A7C59';
const BAD = '#B4503C';
const PASTEL = ['#C4B2EC', '#F7C4A8', '#AAE0C6', '#A0C8F0', '#F8E496', '#F0A094'];

type Cell = { r: number; c: number };
interface MiniProps {
  n: number;
  cols?: number;
  fill?: (r: number, c: number) => string;
  children?: (size: number) => ReactNode;
  highlight?: { cells: Cell[]; colour: string };
}

/** A little wooden tray of n×cols tiles; children draw on top in tile units. */
function Mini({ n, cols = n, fill, children, highlight }: MiniProps) {
  const s = 20;
  const w = cols * s + 6, h = n * s + 6;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={Math.min(132, w * 1.25)} className="flex-shrink-0" aria-hidden="true">
      <rect x="0" y="0" width={w} height={h} rx="4" fill="#B98A55" />
      <rect x="2" y="2" width={w - 4} height={h - 4} rx="2.5" fill={SEAM} />
      <g transform="translate(3 3)">
        {Array.from({ length: n * cols }, (_, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          return <rect key={i} x={c * s + 0.6} y={r * s + 0.6} width={s - 1.2} height={s - 1.2} rx="2.2" fill={fill ? fill(r, c) : IVORY} />;
        })}
        {highlight && highlight.cells.map((p, i) => (
          <rect key={`h${i}`} x={p.c * s + 0.6} y={p.r * s + 0.6} width={s - 1.2} height={s - 1.2} rx="2.2" fill="none" stroke={highlight.colour} strokeWidth="2" />
        ))}
        {children?.(s)}
      </g>
    </svg>
  );
}

const Crown = ({ r, c, s }: Cell & { s: number }) => <image href={crownUrl} x={c * s + 2} y={r * s + 2} width={s - 4} height={s - 4} />;
const Cross = ({ r, c, s, colour = BAD }: Cell & { s: number; colour?: string }) => (
  <path d={`M${c * s + 6} ${r * s + 6}l${s - 12} ${s - 12}M${c * s + s - 6} ${r * s + 6}l${-(s - 12)} ${s - 12}`} stroke={colour} strokeWidth="2.2" strokeLinecap="round" />
);
const Sun = ({ r, c, s }: Cell & { s: number }) => (
  <g transform={`translate(${c * s + s / 2} ${r * s + s / 2})`}>
    {Array.from({ length: 8 }, (_, k) => <line key={k} x1="0" y1="-7.5" x2="0" y2="-5.6" stroke="#E0A01E" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${k * 45})`} />)}
    <circle r="4.4" fill="#F4B92E" />
  </g>
);
const Moon = ({ r, c, s }: Cell & { s: number }) => (
  <path transform={`translate(${c * s + s / 2} ${r * s + s / 2})`} d="M2.5 -6.2a6.4 6.4 0 1 0 3.7 10.6a5 5 0 1 1 -3.7 -10.6z" fill="#7C8FB8" />
);
const Num = ({ r, c, s, v, colour = '#3B2A14' }: Cell & { s: number; v: string | number; colour?: string }) => (
  <text x={c * s + s / 2} y={r * s + s / 2 + 4.2} textAnchor="middle" fontSize="12" fontWeight="700" fill={colour} fontFamily="Inter, system-ui, sans-serif">{v}</text>
);
const Disc = ({ r, c, s, v }: Cell & { s: number; v: number }) => (
  <g>
    <circle cx={c * s + s / 2} cy={r * s + s / 2} r="6.4" fill="#4A3220" />
    <text x={c * s + s / 2} y={r * s + s / 2 + 3.4} textAnchor="middle" fontSize="9" fontWeight="800" fill="#FFF4E2" fontFamily="Inter, system-ui, sans-serif">{v}</text>
  </g>
);
const Line = ({ path, s, colour = '#2C7A8C' }: { path: Cell[]; s: number; colour?: string }) => (
  <polyline points={path.map((p) => `${p.c * s + s / 2},${p.r * s + s / 2}`).join(' ')} fill="none" stroke={colour} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
);
const Tick = ({ ok }: { ok: boolean }) => (
  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white ${ok ? 'bg-success' : 'bg-danger'}`}>
    {ok ? <Icon.Check width={13} height={13} strokeWidth={3.2} /> : <Icon.Close width={12} height={12} strokeWidth={3.2} />}
  </span>
);
const Pair = ({ left, right }: { left: ReactNode; right: ReactNode }) => (
  <div className="flex items-center gap-1.5">{left}{right}</div>
);

// ------------------------------------------------------------------ steps
interface Step { text: ReactNode; pic?: ReactNode }

const crownsRegions = (r: number, c: number): string => PASTEL[[[0, 0, 1, 1], [0, 2, 2, 1], [3, 3, 2, 1], [3, 3, 2, 2]][r]![c]!]!;

const STEPS: Record<GameId, Step[]> = {
  crowns: [
    { text: <>Put <b>one crown in every row</b> and <b>one in every column</b>.</>,
      pic: <Mini n={4} highlight={{ cells: [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }], colour: GOOD }}>{(s) => [[0, 1], [1, 3], [2, 0], [3, 2]].map(([r, c]) => <Crown key={`${r}${c}`} r={r!} c={c!} s={s} />)}</Mini> },
    { text: <>Each <b>colour area</b> gets exactly <b>one crown</b> too.</>,
      pic: <Mini n={4} fill={crownsRegions}>{(s) => [[0, 1], [1, 3], [2, 0], [3, 2]].map(([r, c]) => <Crown key={`${r}${c}`} r={r!} c={c!} s={s} />)}</Mini> },
    { text: <>Crowns may <b>never touch</b>, not even corner to corner.</>,
      pic: <Pair left={<Mini n={2}>{(s) => <><Crown r={0} c={0} s={s} /><Crown r={1} c={1} s={s} /></>}</Mini>} right={<Tick ok={false} />} /> },
    { text: <>Tap a tile once for <b>✕</b> (a note to yourself: no crown here), twice for a <b>crown</b>, a third time to clear it. Drag across tiles to ✕ many at once.</>,
      pic: <Mini n={1} cols={3}>{(s) => <><Cross r={0} c={0} s={s} colour="#6E6A5E" /><Crown r={0} c={1} s={s} /></>}</Mini> },
  ],
  eclipse: [
    { text: <>Fill every square with a <b>sun</b> or a <b>moon</b>.</>,
      pic: <Mini n={1} cols={4}>{(s) => <><Sun r={0} c={0} s={s} /><Moon r={0} c={1} s={s} /><Moon r={0} c={2} s={s} /><Sun r={0} c={3} s={s} /></>}</Mini> },
    { text: <>Every row and column has <b>3 suns and 3 moons</b>.</>,
      pic: <Mini n={1} cols={6}>{(s) => [0, 1, 0, 0, 1, 1].map((v, c) => (v ? <Moon key={c} r={0} c={c} s={s} /> : <Sun key={c} r={0} c={c} s={s} />))}</Mini> },
    { text: <><b>Never three alike</b> side by side, across or down.</>,
      pic: <Pair left={<Mini n={1} cols={3}>{(s) => [0, 1, 2].map((c) => <Sun key={c} r={0} c={c} s={s} />)}</Mini>} right={<Tick ok={false} />} /> },
    { text: <>A <b>=</b> between two squares means they <b>match</b>. A <b>×</b> means they are <b>different</b>.</>,
      pic: (
        <div className="flex flex-col gap-1">
          <Pair left={<Mini n={1} cols={2}>{(s) => <><Sun r={0} c={0} s={s} /><Sun r={0} c={1} s={s} /><text x={s} y={s / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#3B2A14">=</text></>}</Mini>} right={<Tick ok />} />
          <Pair left={<Mini n={1} cols={2}>{(s) => <><Sun r={0} c={0} s={s} /><Moon r={0} c={1} s={s} /><text x={s} y={s / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#3B2A14">×</text></>}</Mini>} right={<Tick ok />} />
        </div>
      ) },
    { text: <>Tap a square to switch it: <b>sun → moon → empty</b>.</> },
  ],
  nine: [
    { text: <>Fill the grid so every <b>row</b>, <b>column</b> and <b>3×3 box</b> has each number <b>1 to 9 once</b>.</>,
      pic: <Mini n={3} fill={(r, c) => (r === 1 && c === 1 ? '#F6E7CC' : IVORY)}>{(s) => [5, 3, 8, 1, 0, 6, 9, 2, 7].map((v, i) => (v ? <Num key={i} r={Math.floor(i / 3)} c={i % 3} s={s} v={v} /> : <Num key={i} r={1} c={1} s={s} v={4} colour="#2C5F8A" />))}</Mini> },
    { text: <>Tap a square, then tap a number on the pad. Or tap a <b>number first</b> and then every square it goes in.</> },
    { text: <>Not sure yet? Switch on <b>Notes</b> to pencil small candidates into a square.</>,
      pic: <Mini n={1} cols={1}>{(s) => [1, 4, 7].map((v, k) => <text key={v} x={4 + k * 6} y={8} fontSize="6" fill="#6E6A5E" fontFamily="Inter, sans-serif">{v}</text>).concat([<text key="x" x={4} y={16} fontSize="6" fill="#6E6A5E" fontFamily="Inter, sans-serif">9</text>]).map((e, k) => <g key={k}>{e}{s ? null : null}</g>)}</Mini> },
    { text: <><b>Fill</b> pencils every possible number in for you, and <b>Hint</b> explains the next move. Both cost points.</> },
  ],
  thread: [
    { text: <>Draw <b>one line</b> that starts at <b>1</b> and passes through <b>every square once</b>.</>,
      pic: <Mini n={3}>{(s) => <><Line s={s} path={[{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }]} /><Disc r={0} c={0} s={s} v={1} /><Disc r={1} c={0} s={s} v={2} /><Disc r={2} c={2} s={s} v={3} /></>}</Mini> },
    { text: <>Reach the numbers <b>in order</b>: 1, then 2, then 3 and so on. The last number is the end.</> },
    { text: <>Thick <b>wooden bars are walls</b>: the line can&apos;t cross them.</>,
      pic: <Pair left={<Mini n={2}>{(s) => <><rect x={s - 2} y={-1} width="4" height={s + 2} rx="1.5" fill="#6B4423" /><Line s={s} path={[{ r: 0, c: 0 }, { r: 0, c: 1 }]} colour={BAD} /></>}</Mini>} right={<Tick ok={false} />} /> },
    { text: <>Press and <b>drag</b> to draw. Drag back over the line to undo steps.</> },
  ],
  quilt: [
    { text: <>Cut the whole board into <b>rectangles</b> (patches) with <b>one badge in each</b>.</>,
      pic: <Mini n={3} cols={4} fill={(r, c) => PASTEL[c < 2 && r < 2 ? 0 : c >= 2 && r < 2 ? 3 : 4]!} /> },
    { text: <>A <b>number</b> is how many squares the patch has.</>,
      pic: <span className="flex items-center gap-2 text-[12px] text-ink-2"><ClueBadge clue={{ cell: 0, kind: 'area', area: 4 }} k={3} className="h-6 w-6" /> = 4 squares</span> },
    { text: <>A <b>shape</b> badge says the patch is <b>wide</b>, <b>tall</b> or a <b>square</b>; <b>?</b> can be any rectangle.</>,
      pic: (
        <span className="flex items-center gap-1.5">
          <ClueBadge clue={{ cell: 0, kind: 'shape', shape: 'wide' }} k={1} className="h-6 w-6" />
          <ClueBadge clue={{ cell: 0, kind: 'shape', shape: 'tall' }} k={2} className="h-6 w-6" />
          <ClueBadge clue={{ cell: 0, kind: 'shape', shape: 'square' }} k={0} className="h-6 w-6" />
          <ClueBadge clue={{ cell: 0, kind: 'any' }} k={6} className="h-6 w-6" />
        </span>
      ) },
    { text: <>Every patch is <b>at least 2 squares</b>.</> },
    { text: <><b>Drag</b> from one corner to the other to draw a patch. Tap a patch to rub it out; drag its edge to resize.</> },
  ],
  bridges: [
    { text: <>Join the islands with <b>bridges</b>. Each island&apos;s number is <b>how many bridges</b> touch it.</>,
      pic: <Pond w={4} h={1} isles={[[0, 0, 2], [0, 3, 2]]} spans={[[0, 0, 3, 0, -1], [0, 0, 3, 0, 1]]} /> },
    { text: <>Bridges go <b>straight across or down</b>, never diagonally, and <b>at most two</b> join the same pair.</>,
      pic: <Pond w={3} h={3} isles={[[0, 0, 1], [0, 2, 3], [2, 2, 2]]} spans={[[0, 0, 2, 0, 0], [0, 2, 2, 1, -1], [0, 2, 2, 1, 1]]} /> },
    { text: <>Bridges <b>can&apos;t cross</b> each other.</>,
      pic: <Pair left={<Pond w={3} h={3} isles={[[1, 0, 1], [1, 2, 1], [0, 1, 1], [2, 1, 1]]} spans={[[1, 0, 2, 0, 0], [0, 1, 2, 1, 0]]} bad />} right={<Tick ok={false} />} /> },
    { text: <>In the end <b>every island is joined</b> into one group.</> },
    { text: <><b>Drag</b> from an island towards another to build a bridge; do it again for a double, and once more to take it away. Tapping the water between two islands does the same.</> },
  ],
  mosaic: [
    { text: <>The numbers beside each row and above each column are its <b>blocks of filled squares</b>, in order: 3 1 means a block of 3, then a single one.</>,
      pic: <Strip clue="3 1" cells="###.#." /> },
    { text: <>Between two blocks there is <b>at least one empty square</b>.</>,
      pic: <Strip clue="2 2" cells=".##.##" marks /> },
    { text: <>Think it through: however a block of 4 slides along 6 squares, it always covers the <b>middle two</b>.</>,
      pic: <Strip clue="4" cells="..##.." gold /> },
    { text: <><b>Tap</b> a square to fill it, or <b>drag along a line</b> to fill several. Switch to <b>Cross out</b> to mark squares you know are empty.</> },
    { text: <>Fill every square of the hidden picture and it <b>comes to life</b>.</> },
  ],
};

/** One row of a Mosaic board with its clue: `#` filled, `x` crossed out, `.` open. */
function Strip({ clue, cells, marks, gold }: { clue: string; cells: string; marks?: boolean; gold?: boolean }) {
  const s = 18, cw = 30;
  const w = cw + cells.length * s + 6, h = s + 6;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={Math.min(150, w * 1.15)} className="flex-shrink-0" aria-hidden="true">
      <rect x="0" y="0" width={cw} height={h} rx="4" fill="#F1E7D0" />
      <text x={cw - 5} y={h / 2 + 4} textAnchor="end" fontSize="11" fontWeight="800" fill="#3A2E24" fontFamily="Inter, system-ui, sans-serif">{clue}</text>
      <rect x={cw} y="0" width={w - cw} height={h} rx="4" fill="#B98A55" />
      <rect x={cw + 2} y="2" width={w - cw - 4} height={h - 4} rx="2.5" fill={SEAM} />
      <g transform={`translate(${cw + 3} 3)`}>
        {[...cells].map((ch, k) => {
          const on = ch === '#';
          return (
            <g key={k}>
              <rect x={k * s + 0.6} y={0.6} width={s - 1.2} height={s - 1.2} rx="2.2" fill={on ? (gold ? '#C88A2E' : '#34415A') : IVORY} />
              {marks && ch === '.' && <path d={`M${k * s + 5.5} 5.5l7 7M${k * s + 12.5} 5.5l-7 7`} stroke="#8C6A48" strokeWidth="1.8" strokeLinecap="round" />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** A little pond for the steps: islands as [row, col, number], spans as [row, col, length, down?, side]. */
function Pond({ w, h, isles, spans, bad }: { w: number; h: number; isles: [number, number, number][]; spans: [number, number, number, number, number][]; bad?: boolean }) {
  const s = 20;
  const W = w * s + 6, H = h * s + 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={Math.min(120, W * 1.25)} className="flex-shrink-0" aria-hidden="true">
      <rect x="0" y="0" width={W} height={H} rx="4" fill="#B98A55" />
      <rect x="2" y="2" width={W - 4} height={H - 4} rx="2.5" fill="#2F7F8C" />
      <g transform="translate(3 3)">
        {spans.map(([r, c, len, down, side], k) => {
          const x = c * s + s / 2, y = r * s + s / 2;
          const off = side * 2.6;
          return down
            ? <line key={k} x1={x + off} y1={y} x2={x + off} y2={y + len * s} stroke={bad && k === 1 ? BAD : '#D9A066'} strokeWidth={side ? 2.6 : 3.6} />
            : <line key={k} x1={x} y1={y + off} x2={x + len * s} y2={y + off} stroke={bad && k === 1 ? BAD : '#D9A066'} strokeWidth={side ? 2.6 : 3.6} />;
        })}
        {isles.map(([r, c, v], k) => (
          <g key={k}>
            <circle cx={c * s + s / 2} cy={r * s + s / 2} r="7.6" fill="#5E8E3E" />
            <circle cx={c * s + s / 2} cy={r * s + s / 2} r="5.8" fill="#F3EEE2" />
            <text x={c * s + s / 2} y={r * s + s / 2 + 3.2} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#2B2420" fontFamily="Inter, system-ui, sans-serif">{v}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

const NAMES: Record<GameId, string> = { nine: 'Nine', eclipse: 'Eclipse', crowns: 'Crowns', thread: 'Thread', quilt: 'Quilt', bridges: 'Bridges', mosaic: 'Mosaic' };

export function HowToPlay({ game }: { game: GameId }) {
  const key = `pb:howto:${game}`;
  const [open, setOpen] = useState(() => !readJSON<boolean>(key));
  const close = (): void => { setOpen(false); writeJSON(key, true); };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pb-key mx-auto mt-3 flex h-9 items-center gap-1.5 rounded-full bg-raised px-4 text-[13px] font-bold text-accent-text"
      >
        <Icon.Bulb width={15} height={15} /> How to play {NAMES[game]}
      </button>
    );
  }
  return (
    <section className="pb-rise mt-3 overflow-hidden rounded-[18px] border border-line-minor bg-raised shadow-[0_10px_26px_-14px_rgb(60_40_20/0.5)]" aria-label={`How to play ${NAMES[game]}`}>
      <div className="pb-wood flex items-center justify-between px-3.5 py-2 text-[#FFF4E2]">
        <span className="text-[14px] font-bold [text-shadow:0_1px_1px_rgb(60_30_5/0.5)]">How to play {NAMES[game]}</span>
        <button type="button" onClick={close} aria-label="Close how to play" className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(255_244_226/0.18)]">
          <Icon.Close width={14} height={14} />
        </button>
      </div>
      <ol className="flex flex-col divide-y divide-line-minor">
        {STEPS[game].map((st, i) => (
          <li key={i} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="pb-medal-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold">{i + 1}</span>
            <span className="flex-grow text-[13px] leading-snug">{st.text}</span>
            {st.pic}
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between gap-2 bg-raised-2 px-3.5 py-2">
        <span className="text-[11.5px] text-ink-2">Faster solves score more. Hints and mistakes cost points.</span>
        <button type="button" onClick={close} className="pb-key h-8 flex-shrink-0 rounded-full bg-accent px-4 text-[12.5px] font-bold text-ink" style={{ ['--key-side' as string]: '#94621C' }}>Got it</button>
      </div>
    </section>
  );
}

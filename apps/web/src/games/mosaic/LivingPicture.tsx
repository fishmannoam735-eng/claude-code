import { useState, type CSSProperties, type ReactNode } from 'react';
import { mosaicGame, type MosaicMotion as Motion, type MosaicPicture as Picture, type MosaicPuzzle } from '@pb/engine';

const { pictureById, partOf } = mosaicGame;

/**
 * The solved picture coming to life. It starts exactly over the squares the
 * player filled, washes into its own colours tile by tile, grows to fill the
 * whole tray as the clues fold away, its scene appears behind it, and then it
 * moves: a cat blinks and wags its tail, a fish swims, a robin flaps off and
 * comes back, a rocket blasts off, and so on.
 *
 * Every moving part is a layer the size of the picture that turns, slides or
 * scales about its own pivot, so the motion is transform and opacity only.
 * Parts nest: the whale's spout rides on the bobbing whale. Tap the picture to
 * play it all again.
 */

/** Timings, in ms from the solve. */
export const T_WASH = 150, T_GROW = 1150, T_ALIVE = 2200;

/** Motions that run per piece with a stagger, rather than the part all at once. */
const PER_PIECE = new Set(['rise', 'steam', 'twinkle']);

interface Node { name: string; letters: string; children: Node[] }

function partTree(p: Picture): Node {
  const parts = Object.entries(p.parts ?? {}).map(([name, letters]) => ({ name, letters, children: [] as Node[] }));
  const root: Node = { name: '*', letters: '', children: [] };
  const within = (a: Node, b: Node) => a !== b && [...a.letters].every((ch) => b.letters.includes(ch)) && b.letters.length > a.letters.length;
  for (const part of parts) {
    const homes = parts.filter((q) => within(part, q)).sort((x, y) => x.letters.length - y.letters.length);
    (homes[0] ?? root).children.push(part);
  }
  return root;
}

export function LivingPicture({ puzzle, from, wait }: { puzzle: MosaicPuzzle; from: { left: number; top: number; size: number }; wait: number }) {
  const [run, setRun] = useState(0);
  // A replay (tap) starts at once; the first showing after a solve waits for the plaque.
  const w = run ? 0 : wait;
  const T_GROW_ = T_GROW + w, T_ALIVE_ = T_ALIVE + w;
  const pic = pictureById(puzzle.picture);
  if (!pic) return null;
  const n = puzzle.w;
  const tree = partTree(pic);

  // Every piece of the picture, sorted into the part it moves with.
  const pieces = new Map<string, { x: number; y: number; ch: string }[]>();
  pic.art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const part = partOf(pic, ch);
    if (!pieces.has(part)) pieces.set(part, []);
    pieces.get(part)!.push({ x, y, ch });
  }));
  const motions = new Map<string, Motion[]>();
  for (const m of pic.motion) {
    if (!motions.has(m.part)) motions.set(m.part, []);
    motions.get(m.part)!.push(m);
  }

  const pct = (v: number): string => `${(v / n) * 100}%`;
  const q = 92.4 / n; // one square of the grown picture, in cqw

  // Decorations appear one after another once the picture has grown, in their own order.
  const decorOrder = new Map<string, number>();
  pic.art.forEach((row, y) => [...row].forEach((ch, x) => { if (ch >= 'a' && ch <= 'z') decorOrder.set(`${x}-${y}`, decorOrder.size); }));

  const piece = (pc: { x: number; y: number; ch: string }, k: number, perPiece: Motion | undefined): ReactNode => {
    const colour = pic.ink[pc.ch]!;
    const decor = pc.ch >= 'a' && pc.ch <= 'z';
    const round = pic.shape?.[pc.ch] === 'round', star = pic.shape?.[pc.ch] === 'star';
    const box: CSSProperties = { left: pct(pc.x), top: pct(pc.y), width: pct(1), height: pct(1) };
    const appear = decor ? T_ALIVE_ - 300 + (decorOrder.get(`${pc.x}-${pc.y}`) ?? 0) * 50 : T_WASH + (pc.x + pc.y) * 45;
    const inner: CSSProperties = round || star
      ? {
        inset: round ? '22%' : '14%', borderRadius: round ? '50%' : 0,
        background: round ? `radial-gradient(circle at 35% 30%, #FFFFFF 0 20%, ${colour}CC 45%, ${colour}55 100%)` : colour,
        ...(star ? { clipPath: 'polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)' } : {}),
      }
      : {
        inset: `${q * 0.035}cqw`, borderRadius: decor ? `${q * 0.12}cqw` : `${q * 0.16}cqw`,
        background: decor ? colour : `linear-gradient(155deg, color-mix(in srgb, ${colour} 78%, white) 0%, ${colour} 45%, color-mix(in srgb, ${colour} 82%, black) 100%)`,
        boxShadow: decor ? undefined : `inset ${q * 0.03}cqw ${q * 0.04}cqw 0 rgb(255 255 255 / 0.35), inset 0 -${q * 0.06}cqw 0 rgb(0 0 0 / 0.12)`,
      };
    const motion = perPiece
      ? { className: `pb-mo-${perPiece.kind}`, style: { animationDelay: `${T_ALIVE_ + (perPiece.delay ?? 0) + k * 430}ms` } }
      : null;
    return (
      <span key={`${pc.x}-${pc.y}`} className="absolute" style={box}>
        <span className="pb-mo-in absolute inset-0" style={{ animationDelay: `${appear}ms` }}>
          <span className={`absolute inset-0 ${motion?.className ?? ''}`} style={motion?.style}>
            <span className="absolute" style={inner} />
          </span>
        </span>
      </span>
    );
  };

  /** A spinning part is drawn as one round wheel over its squares: square wheels don't roll. */
  const wheel = (list: { x: number; y: number }[]): ReactNode => {
    const xs = list.map((p) => p.x), ys = list.map((p) => p.y);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), side = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) + 1;
    return (
      <span className="absolute" style={{ left: pct(x0), top: pct(y0), width: pct(side), height: pct(side) }}>
        <span className="pb-mo-in absolute inset-0" style={{ animationDelay: `${T_WASH + (x0 + y0) * 45}ms` }}>
          <svg viewBox="-10 -10 20 20" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle r="9.6" fill="#2A2A2A" />
            <circle r="8.4" fill="none" stroke="#454545" strokeWidth="0.8" />
            <circle r="5" fill="#C9C9C9" />
            {[0, 60, 120].map((a) => <rect key={a} x="-0.7" y="-5" width="1.4" height="10" fill="#8E8E8E" transform={`rotate(${a})`} />)}
            <circle r="1.6" fill="#EDEDED" />
            <circle cx="-3" cy="-3.4" r="1.6" fill="#FFFFFF" opacity="0.35" />
          </svg>
        </span>
      </span>
    );
  };

  const render = (node: Node): ReactNode => {
    const ms = motions.get(node.name) ?? [];
    const per = ms.find((m) => PER_PIECE.has(m.kind));
    const whole = ms.filter((m) => !PER_PIECE.has(m.kind));
    const own = pieces.get(node.name === '*' ? 'body' : node.name) ?? [];
    let body: ReactNode = (
      <>
        {whole.some((m) => m.kind === 'spin') ? wheel(own) : own.map((pc, k) => piece(pc, k, per))}
        {node.children.map((c) => <div key={c.name} className="absolute inset-0">{render(c)}</div>)}
      </>
    );
    // A part can have more than one motion: each wraps the next.
    for (const m of whole) {
      const [x, y] = m.at ?? [n / 2, n / 2];
      body = (
        <div
          className={`pb-mo-${m.kind} absolute inset-0`}
          style={{
            transformOrigin: `${pct(x)} ${pct(y)}`,
            animationDelay: `${T_ALIVE_ + (m.delay ?? 0)}ms`,
            ['--dir' as string]: x < n / 2 ? 1 : -1,
          }}
        >
          {body}
        </div>
      );
    }
    return body;
  };

  // The grow: from where the squares sit among the clues to the whole opening.
  const s = from.size / 100;
  const grow = { ['--mo-from' as string]: `translate(${from.left}%, ${from.top}%) scale(${s})`, animationDelay: `${T_GROW_}ms` } as CSSProperties;

  return (
    <div
      key={run}
      className="pb-mo-grow absolute inset-0 overflow-hidden"
      style={grow}
      onClick={() => setRun((k) => k + 1)}
      role="img"
      aria-label={`${pic.alive}.`}
    >
      <div className="pb-mo-scene absolute inset-0" style={{ background: `radial-gradient(ellipse at 40% 30%, color-mix(in srgb, ${pic.bg} 70%, white) 0%, ${pic.bg} 55%, color-mix(in srgb, ${pic.bg} 80%, black) 100%)`, animationDelay: `${T_GROW_ - 300}ms` }} />
      <div className="absolute inset-0" style={puzzle.mirror ? { transform: 'scaleX(-1)' } : undefined}>
        {render(tree)}
      </div>
      <div className="pb-mo-scene pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 4cqw rgb(30 20 10 / 0.35)', animationDelay: `${T_GROW_}ms` }} />
    </div>
  );
}

/** What the picture does, for the line under the board. */
export function aliveLine(puzzle: MosaicPuzzle): string {
  return pictureById(puzzle.picture)?.alive ?? 'The picture comes to life';
}

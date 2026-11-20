import { useCallback, useId, useMemo, useRef } from 'react';
import { quiltGame } from '@pb/engine';
import { quiltColourName, quiltFace, quiltRgb } from './palette';
import { SEAM, WoodTray, tileStyle } from '../../components/WoodTray';
import { patchesOf, spanOf, useQuilt } from './store';

type Clue = quiltGame.Clue;

const { colOf, rowOf } = quiltGame;

// Each clue owns one pastel, LinkedIn Patches style: its badge wears it, and
// the patch you draw around it fills with it, so which clue a patch belongs
// to is never in doubt.
const rgb = quiltRgb;
export const clueColourName = quiltColourName;

// Unclaimed cells are plain ivory tiles, as on Eclipse.
const EMPTY = {
  face: 'linear-gradient(135deg, rgb(255 251 240) 0%, rgb(250 243 226) 45%, rgb(238 228 206) 100%)',
  side: 'rgb(196 180 150)',
};
const CONFLICT_TINT = 'linear-gradient(rgb(200 70 50 / 0.34), rgb(200 70 50 / 0.34))';

// A drawn patch is a padded piece of cloth: a lacquer-like gloss across its
// top, a faint woven texture, a thick side and stitches sewn round its edge.
// All of it is plain gradients and shadows, so nothing repaints per frame.
const GLOSS = 'linear-gradient(172deg, rgb(255 255 255 / 0.5) 0%, rgb(255 255 255 / 0.16) 30%, rgb(255 255 255 / 0) 31%)';
const WEAVE =
  'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.07) 0 0.35cqw, rgb(255 255 255 / 0) 0.35cqw 0.7cqw), ' +
  'repeating-linear-gradient(-45deg, rgb(60 30 10 / 0.05) 0 0.35cqw, rgb(60 30 10 / 0) 0.35cqw 0.7cqw)';
const PATCH_THICK = 0.95; // cqw, a little more than a loose tile: patches sit proud of the cloth

function patchStyle(k: number, broken: boolean): React.CSSProperties {
  const face = quiltFace(k);
  const side = broken ? 'rgb(150 60 44)' : rgb(k, 0.66);
  return {
    top: `${SEAM}cqw`, bottom: `${SEAM + PATCH_THICK}cqw`, left: `${SEAM}cqw`, right: `${SEAM}cqw`,
    borderRadius: '1.6cqw',
    background: `${GLOSS}, ${WEAVE}, ${broken ? `${CONFLICT_TINT}, ` : ''}${face}`,
    boxShadow:
      `0 ${PATCH_THICK}cqw 0 ${side}, 0 ${PATCH_THICK + 0.5}cqw 1.2cqw rgb(40 22 8 / 0.38), ` +
      `inset 0.25cqw 0.3cqw 0 rgb(255 255 255 / 0.55), inset -0.2cqw -0.35cqw 0 rgb(0 0 0 / 0.07)` +
      (broken ? ', inset 0 0 0 0.6cqw var(--color-danger)' : ''),
  };
}

/**
 * The stitches round a patch. They sew themselves in when the patch is cut:
 * a mask uncovers them along the edge, one short animation per patch.
 */
function Stitches({ w, h, k, broken }: { w: number; h: number; k: number; broken: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const W = w * 100, H = h * 100;
  // In hundredths of a cell. The face stops about a tenth of a cell above the
  // patch's bottom, where its thick side shows, so the stitches stop short too.
  const inset = 15;
  const x = inset, y = inset, rw = W - inset * 2, rh = H - inset * 2 - 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect x={x} y={y} width={rw} height={rh} rx="13" fill="none" stroke="#fff" strokeWidth="14" pathLength={1} className="pb-sew" />
        </mask>
      </defs>
      <g mask={`url(#${id}m)`}>
        <rect x={x} y={y + 1.5} width={rw} height={rh} rx="13" fill="none" stroke={broken ? 'rgb(120 30 20 / 0.5)' : rgb(k, 0.55)} strokeOpacity={0.55} strokeWidth="3.2" strokeDasharray="9 7" strokeLinecap="round" />
        <rect x={x} y={y} width={rw} height={rh} rx="13" fill="none" stroke="rgb(255 255 255 / 0.9)" strokeWidth="3.2" strokeDasharray="9 7" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const BADGE: Record<quiltGame.Shape, { x: number; y: number; w: number; h: number }> = {
  square: { x: 3.5, y: 3.5, w: 17, h: 17 },
  wide: { x: 1, y: 6, w: 22, h: 12 },
  tall: { x: 6, y: 1, w: 12, h: 22 },
};

/**
 * A clue badge, made like an enamel button: a shadow on the cloth, a darker
 * rim, a domed face lit from the top left and a glossy highlight. Its
 * outline is the patch's shape (square, wide or tall), or round for a size or
 * a free patch, and it carries the number or a "?". Shape badges carry a row
 * of stitches, so they read as a little patch themselves.
 */
export function ClueBadge({ clue, k, className }: { clue: Clue; k: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const b = clue.kind === 'shape' ? BADGE[clue.shape] : null;
  const ink = rgb(k, 0.36);
  const shape = (dx: number, dy: number, grow: number, props: React.SVGProps<SVGRectElement & SVGCircleElement>) => b
    ? <rect x={b.x + dx - grow} y={b.y + dy - grow} width={b.w + grow * 2} height={b.h + grow * 2} rx={3.2 + grow} {...props} />
    : <circle cx={12 + dx} cy={12 + dy} r={9.6 + grow} {...props} />;
  const label = clue.kind === 'area' ? String(clue.area) : clue.kind === 'any' ? '?' : null;
  const size = clue.kind === 'area' && clue.area >= 10 ? 10.5 : 12.5;
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'h-[78%] w-[78%]'} aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${id}f`} cx="34%" cy="28%" r="80%">
          <stop offset="0" stopColor={rgb(k, 1.14)} />
          <stop offset="0.55" stopColor={rgb(k, 1)} />
          <stop offset="1" stopColor={rgb(k, 0.8)} />
        </radialGradient>
      </defs>
      {shape(0.5, 1.4, 0.3, { fill: 'rgb(50 30 12 / 0.32)' })}
      {shape(0, 0, 0.9, { fill: '#fff' })}
      {shape(0, 0, 0, { fill: rgb(k, 0.62) })}
      {shape(0, -0.45, -0.9, { fill: `url(#${id}f)` })}
      {b && shape(0, -0.45, -3, { fill: 'none', stroke: 'rgb(255 255 255 / 0.85)', strokeWidth: 0.8, strokeDasharray: '1.6 1.3', strokeLinecap: 'round' })}
      {b
        ? <rect x={b.x + 2} y={b.y + 1.2} width={b.w - 4} height={Math.min(4, b.h * 0.28)} rx={2} fill="#fff" opacity={0.45} />
        : <ellipse cx={9.4} cy={7.2} rx={5} ry={2.4} fill="#fff" opacity={0.5} transform="rotate(-24 9.4 7.2)" />}
      {label && (
        <>
          <text x="12" y="13.1" textAnchor="middle" dominantBaseline="central" fill="#fff" opacity={0.6}
            fontSize={size} fontWeight="900" style={{ fontVariantNumeric: 'tabular-nums' }}>{label}</text>
          <text x="12" y="12.4" textAnchor="middle" dominantBaseline="central" fill={ink}
            fontSize={size} fontWeight="900" style={{ fontVariantNumeric: 'tabular-nums' }}>{label}</text>
        </>
      )}
    </svg>
  );
}

const describeClue = (clue: Clue): string =>
  clue.kind === 'area' ? `clue ${clue.area} cell${clue.area === 1 ? '' : 's'}`
    : clue.kind === 'shape' ? `clue ${clue.shape} patch`
      : 'clue any size';

export function QuiltBoard({ hidden }: { hidden: boolean }) {
  const puzzle = useQuilt((s) => s.puzzle);
  const owner = useQuilt((s) => s.owner);
  const selected = useQuilt((s) => s.selected);
  const status = useQuilt((s) => s.status);
  const dragFrom = useQuilt((s) => s.dragFrom);
  const anchor = useQuilt((s) => s.anchor);
  const dragTo = useQuilt((s) => s.dragTo);
  const hint = useQuilt((s) => s.hint);
  const hintStep = useQuilt((s) => s.hintStep);
  // Derived, not subscribed: a selector that builds a new array every render
  // never settles and loops React forever.
  const patches = useMemo(() => patchesOf(puzzle, owner), [puzzle, owner]);
  const preview = useMemo(() => {
    if (!puzzle) return null;
    if (dragFrom !== null && dragTo !== null) return spanOf(dragFrom, dragTo, puzzle.n);
    if (anchor !== null && selected !== null) return spanOf(anchor, selected, puzzle.n);
    return null;
  }, [puzzle, dragFrom, dragTo, anchor, selected]);
  const { beginAt, dragOver, endDrag } = useQuilt.getState();
  const boxRef = useRef<HTMLDivElement>(null);

  /** Which cell is under this pointer? Read off the board's own box, as in Thread. */
  const cellAt = useCallback((clientX: number, clientY: number): number | null => {
    const el = boxRef.current;
    if (!el || !puzzle) return null;
    const b = el.getBoundingClientRect();
    const c = Math.floor(((clientX - b.left) / b.width) * puzzle.n);
    const r = Math.floor(((clientY - b.top) / b.height) * puzzle.n);
    if (c < 0 || r < 0 || c >= puzzle.n || r >= puzzle.n) return null;
    return r * puzzle.n + c;
  }, [puzzle]);

  if (!puzzle) return null;
  const n = puzzle.n;
  const pc = (v: number): string => `${(v / n) * 100}%`;
  const clueAt = new Map(puzzle.clues.map((clue, k) => [clue.cell, { clue, k }]));
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` };

  return (
    <WoodTray
      gridRef={boxRef}
      overlay={!hidden && preview && preview.w * preview.h > 1 ? (
        // The size of the rectangle being drawn, on a tag pinned to its top
        // edge (its bottom edge on the top row), above the badges.
        <span
          className="absolute whitespace-nowrap rounded-full bg-[rgb(255_252_244)] px-[1.6cqw] py-[0.5cqw] text-[3.3cqw] font-extrabold tabular-nums leading-none text-[rgb(70_48_24)] shadow-[0_0.45cqw_0_rgb(150_120_80),0_0.8cqw_1.4cqw_rgb(40_24_10/0.3)]"
          style={{
            left: pc(preview.c + preview.w / 2),
            top: preview.r > 0 ? pc(preview.r) : pc(preview.r + preview.h),
            transform: 'translate(-50%, -50%)',
          }}
        >
          {preview.w}×{preview.h}{preview.w > 1 && preview.h > 1 ? ` = ${preview.w * preview.h}` : ''}
        </span>
      ) : undefined}
      grid={{
        // Only a board in play keeps the finger for drawing; once it is solved
        // or paused, a swipe on it scrolls the page like anywhere else.
        className: !hidden && status === 'in_progress' ? 'touch-none' : '',
        // Same native-drag trap Thread hit: pressing on a glyph and moving starts
        // a browser drag, which fires pointercancel and kills every event after
        // the first, so a rectangle could grow but never shrink.
        onDragStart: (e) => e.preventDefault(),
        onPointerDown: (e) => {
          if (hidden) return;
          const cell = cellAt(e.clientX, e.clientY);
          if (cell === null) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          beginAt(cell);
        },
        onPointerMove: (e) => {
          if (hidden || dragFrom === null) return;
          const cell = cellAt(e.clientX, e.clientY);
          if (cell !== null) dragOver(cell);
        },
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onLostPointerCapture: endDrag,
      }}
    >
      {/* Loose ivory tiles: the cloth before any patch is cut. */}
      <div className="pointer-events-none absolute inset-0 grid" style={cols} aria-hidden="true">
        {Array.from({ length: n * n }, (_, i) => (
          <div key={i} className="relative"><span data-tile className="absolute" style={tileStyle(EMPTY.face, EMPTY.side)} /></div>
        ))}
      </div>

      {/* A drawn patch is one padded, stitched piece in its clue's colour. It
          pops in when cut, and its stitches sew themselves round it. */}
      {!hidden && patches.map((p, k) => {
        if (!p.rect) return null;
        const { r, c, w, h } = p.rect;
        return (
          <div
            key={`p${k}-${r}-${c}-${w}-${h}`}
            aria-hidden="true"
            className="pb-patch pointer-events-none absolute"
            style={{ left: pc(c), top: pc(r), width: pc(w), height: pc(h) }}
          >
            <span data-tile className="absolute overflow-hidden" style={patchStyle(k, p.broken)}>
              <Stitches w={w} h={h} k={k} broken={p.broken} />
            </span>
          </div>
        );
      })}

      {/* The rectangle being drawn wears the colour of the clue it would
          claim, or red if it covers two. Its size rides on a tag in the overlay. */}
      {!hidden && preview && (() => {
        const inside = puzzle.clues
          .map((clue, k) => ({ clue, k }))
          .filter(({ clue }) => {
            const r = rowOf(clue.cell, n), c = colOf(clue.cell, n);
            return r >= preview.r && r < preview.r + preview.h && c >= preview.c && c < preview.c + preview.w;
          });
        const one = inside.length === 1 ? inside[0]!.k : null;
        const tint = inside.length > 1 ? 'rgb(214 80 60)' : one !== null ? rgb(one, 0.8) : 'var(--color-accent)';
        const fill = inside.length > 1 ? 'rgb(214 80 60 / 0.28)' : one !== null ? `${rgb(one, 1.02).slice(0, -1)} / 0.62)` : 'rgb(255 255 255 / 0.25)';
        return (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ left: pc(preview.c), top: pc(preview.r), width: pc(preview.w), height: pc(preview.h) }}
          >
            <span
              className="absolute inset-[0.35cqw] rounded-[1.5cqw] border-[0.6cqw] border-dashed"
              style={{ borderColor: tint, background: fill, boxShadow: '0 0 0 0.35cqw rgb(255 255 255 / 0.55)' }}
            />
          </div>
        );
      })()}

      {/* The hint row being read: the rest of the board dims, its squares light
          up, and squares it rules out get a red cross. */}
      {!hidden && hint && (() => {
        const row = hint.steps[hintStep]!;
        const focus = new Set(row.focus), out = new Set(row.out ?? []);
        return (
          <div className="pointer-events-none absolute inset-0 grid" style={cols} aria-hidden="true">
            {Array.from({ length: n * n }, (_, i) => (
              <div key={i} className="relative flex items-center justify-center">
                {out.has(i) ? (
                  <>
                    <span className="absolute inset-[0.3cqw] rounded-[1.1cqw] bg-danger/25" style={{ boxShadow: 'inset 0 0 0 0.6cqw var(--color-danger)' }} />
                    <svg viewBox="0 0 24 24" className="absolute h-[44%] w-[44%] text-danger" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </>
                ) : focus.has(i) ? (
                  <span className="absolute inset-[0.3cqw] rounded-[1.1cqw]" style={{ boxShadow: 'inset 0 0 0 0.7cqw var(--color-accent)' }} />
                ) : (
                  <span className="absolute inset-0 bg-[rgb(40_28_16/0.34)]" />
                )}
              </div>
            ))}
          </div>
        );
      })()}

      <div role="grid" aria-label="Quilt board" className="pointer-events-none absolute inset-0 grid" style={cols}>
        {Array.from({ length: n * n }, (_, i) => {
          const here = clueAt.get(i);
          const k = owner[i] ?? -1;
          const mine = k >= 0 ? patches[k] : undefined;
          const label =
            `Row ${rowOf(i, n) + 1}, column ${colOf(i, n) + 1}` +
            (here ? `, ${describeClue(here.clue)}` : '') +
            (hidden ? ''
              : k < 0 ? ', unassigned'
                : `, in the ${clueColourName(k)} patch${mine?.broken ? ', which breaks its clue' : ''}`);
          return (
            <div
              key={i}
              role="gridcell"
              aria-label={label}
              aria-selected={selected === i}
              draggable={false}
              className="relative flex items-center justify-center pb-[0.6cqw]"
            >
              {selected === i && (
                <span
                  className="absolute inset-[0.22cqw] rounded-[1.1cqw]"
                  style={{ boxShadow: `inset 0 0 0 0.6cqw var(${anchor !== null ? '--color-accent-text' : '--color-accent'})` }}
                />
              )}
              {here && !hidden && <ClueBadge clue={here.clue} k={here.k} />}
            </div>
          );
        })}
      </div>

      {status === 'solved' && <div className="pb-sweep pointer-events-none absolute inset-0 opacity-60" />}
    </WoodTray>
  );
}

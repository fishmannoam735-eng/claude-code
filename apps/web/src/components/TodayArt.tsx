import type { CSSProperties, ReactNode } from 'react';
import type { GameId } from '@pb/engine';
import { WoodTray, tileStyle } from './WoodTray';
import { tileColours } from '../games/crowns/palette';
import { Moon, Sun } from '../games/eclipse/EclipseBoard';
import crownUrl from '../games/crowns/assets/crown.webp';

/**
 * Small portraits of each game's real board for the start page: the same
 * wooden tray, the same glossy tiles, a few pieces already placed. They are
 * drawn, not screenshots, so they stay crisp at any size and can animate.
 */

const IVORY = {
  face: 'linear-gradient(135deg, rgb(255 251 240) 0%, rgb(250 243 226) 45%, rgb(238 228 206) 100%)',
  side: 'rgb(196 180 150)',
};
const SAND = {
  face: 'linear-gradient(135deg, rgb(240 224 192) 0%, rgb(230 211 174) 45%, rgb(214 194 156) 100%)',
  side: 'rgb(170 146 108)',
};

/** `--d` staggers each piece's entrance after the card's own. */
const delay = (s: number): CSSProperties => ({ ['--d' as string]: `calc(var(--card-d, 0ms) + ${Math.round(s * 1000)}ms)` });

/** A light band that crosses the tiles now and then, like a glint on lacquer. */
function Sheen() {
  return <span className="pb-sheen pointer-events-none absolute inset-0 z-10" aria-hidden="true" />;
}

function Grid({ n, children }: { n: number; children: ReactNode }) {
  return (
    <WoodTray grid={{ className: `grid ${n === 3 ? 'grid-cols-3 grid-rows-3' : 'grid-cols-4 grid-rows-4'}` }}>
      {children}
      <Sheen />
    </WoodTray>
  );
}

function Tile({ face, side, children, ring }: { face: string; side: string; children?: ReactNode; ring?: string | undefined }) {
  return (
    <div className="relative">
      <span className="absolute flex items-center justify-center" style={tileStyle(face, side, ring)}>{children}</span>
    </div>
  );
}

// ------------------------------------------------------------------ Nine
const NINE: (readonly [number, boolean] | null)[] = [
  [5, true], null, [3, true],
  null, [7, false], null,
  [1, true], null, [9, true],
];

function NineMini() {
  return (
    <Grid n={3}>
      {NINE.map((d, i) => (
        <Tile key={i} {...(d?.[1] ? SAND : IVORY)} >
          {d && (
            <span
              className="pb-in font-bold leading-none"
              style={{ fontSize: '17cqw', color: d[1] ? '#3B2A18' : '#2C5F8A', ...delay(0.12 + i * 0.05) }}
            >{d[0]}</span>
          )}
          {i === 5 && <span className="pb-pulse absolute inset-0 rounded-[inherit]" />}
        </Tile>
      ))}
    </Grid>
  );
}

// ------------------------------------------------------------------ Eclipse
const S = 1, M = 2;
const ECLIPSE = [
  S, S, M, 0,
  M, 0, M, S,
  S, M, 0, M,
  0, M, S, S,
];
const ECLIPSE_GIVEN = new Set([0, 6, 9, 15]);

function EclipseMini() {
  return (
    <Grid n={4}>
      {ECLIPSE.map((v, i) => (
        <Tile key={i} {...(ECLIPSE_GIVEN.has(i) ? SAND : IVORY)}>
          {v !== 0 && (
            <span className={`pb-in flex h-full w-full items-center justify-center ${v === S ? 'pb-spin-slow' : ''}`} style={delay(0.1 + i * 0.04)}>
              {v === S ? <Sun given={ECLIPSE_GIVEN.has(i)} /> : <Moon given={ECLIPSE_GIVEN.has(i)} />}
            </span>
          )}
        </Tile>
      ))}
    </Grid>
  );
}

// ------------------------------------------------------------------ Crowns
const REGIONS = [
  0, 0, 1, 1,
  0, 2, 2, 1,
  3, 2, 2, 1,
  3, 3, 2, 2,
];
const REGION_COLOUR = [0, 1, 2, 4];
const CROWN_AT = [1, 7, 8, 14];

function CrownsMini() {
  return (
    <Grid n={4}>
      {REGIONS.map((g, i) => {
        const k = CROWN_AT.indexOf(i);
        return (
          <Tile key={i} {...tileColours(REGION_COLOUR[g]!)}>
            {k >= 0 && (
              <img
                src={crownUrl} alt="" draggable={false}
                className="pb-drop w-[80%]"
                style={{ filter: 'drop-shadow(0.4cqw 1cqw 0.8cqw rgb(60 40 10 / 0.45))', ...delay(0.25 + k * 0.18) }}
              />
            )}
          </Tile>
        );
      })}
    </Grid>
  );
}

// ------------------------------------------------------------------ Thread
// One line through every square, as [row, col].
const ROUTE: [number, number][] = [
  [0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1], [0, 1],
  [0, 2], [0, 3], [1, 3], [1, 2], [2, 2], [2, 3], [3, 3], [3, 2],
];
const STOPS = [0, 10, 15];

function ThreadMini() {
  const pts = ROUTE.map(([r, c]) => `${c + 0.5},${r + 0.5}`).join(' ');
  return (
    <WoodTray grid={{ className: 'grid grid-cols-4 grid-rows-4' }}>
      {ROUTE.map((_, i) => <Tile key={i} {...IVORY} />)}
      <svg viewBox="0 0 4 4" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <polyline
          points={pts} pathLength={1}
          fill="none" stroke="var(--color-game-thread)" strokeWidth={0.3}
          strokeLinecap="round" strokeLinejoin="round"
          className="pb-draw" style={delay(0.15)}
        />
        {STOPS.map((k, n) => {
          const [r, c] = ROUTE[k]!;
          return (
            <g key={k} className="pb-in" style={{ ...delay(0.15 + n * 0.5), transformOrigin: `${c + 0.5}px ${r + 0.5}px` }}>
              <circle cx={c + 0.5} cy={r + 0.5} r={0.3} fill="#2A2018" />
              <text x={c + 0.5} y={r + 0.6} textAnchor="middle" fontSize={0.3} fontWeight={700} fill="#fff">{n + 1}</text>
            </g>
          );
        })}
      </svg>
      <Sheen />
    </WoodTray>
  );
}

// ------------------------------------------------------------------ Quilt
// Patches as [row, col, rows, cols], with the size badge some of them carry.
const PATCHES: [number, number, number, number, number, boolean][] = [
  [0, 0, 2, 2, 0, true],
  [0, 2, 1, 2, 1, false],
  [1, 2, 2, 2, 3, true],
  [2, 0, 2, 1, 6, false],
  [2, 1, 2, 1, 2, true],
  [3, 2, 1, 2, 4, false],
];

function QuiltMini() {
  const unit = 100 / 4;
  return (
    <WoodTray grid={{}}>
      {PATCHES.map(([r, c, h, w, g, badge], k) => {
        const { face, side } = tileColours(g);
        return (
          <div
            key={k}
            className="pb-in absolute"
            style={{ left: `${c * unit}%`, top: `${r * unit}%`, width: `${w * unit}%`, height: `${h * unit}%`, ...delay(0.12 + k * 0.1) }}
          >
            <span className="absolute flex items-center justify-center" style={tileStyle(face, side)}>
              {badge && (
                <span
                  className="flex items-center justify-center rounded-full bg-white/85 font-bold text-[#3B2A18]"
                  style={{ width: '12cqw', height: '12cqw', fontSize: '7.5cqw', boxShadow: '0 0.4cqw 0.8cqw rgb(60 40 20 / 0.3)' }}
                >{h * w}</span>
              )}
            </span>
          </div>
        );
      })}
      <Sheen />
    </WoodTray>
  );
}

const MINIS: Record<GameId, () => React.JSX.Element> = {
  nine: NineMini, eclipse: EclipseMini, crowns: CrownsMini, thread: ThreadMini, quilt: QuiltMini,
};

/** The game's little board in its tray. */
export function MiniBoard({ game }: { game: GameId }) {
  const Mini = MINIS[game];
  return <Mini />;
}

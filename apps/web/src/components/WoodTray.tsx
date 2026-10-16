import type { CSSProperties, ReactNode, Ref } from 'react';
import trayUrl from '../assets/tray.webp';

// Where the tray's opening sits in tray.webp, as a percentage of its side.
// Measured on the Kling tray render the asset was cropped from.
const OPENING = { left: 3.8, top: 4.2, size: 92.4 };

// Sizes are in cqw of the tray, so a board looks the same at any width.
export const SEAM = 0.22;   // half the gap between two tiles, the same everywhere
export const THICK = 0.6;   // how much of a tile's side shows below its face
export const RADIUS = 1.1;

/** Dark warm bed: what shows through the seams between tiles. */
export const BED = '#5C4028';

/**
 * The approved wooden tray every tile board sits in. `grid` is spread onto the
 * element that fills the tray's opening, so a game lays its cells out there;
 * `overlay` is drawn above it in the same box (edge badges, solved sweep).
 */
export function WoodTray({ grid, gridRef, children, overlay }: {
  grid: React.HTMLAttributes<HTMLDivElement> & { className?: string };
  gridRef?: Ref<HTMLDivElement>;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const box: CSSProperties = {
    left: `${OPENING.left}%`, top: `${OPENING.top}%`,
    width: `${OPENING.size}%`, height: `${OPENING.size}%`,
  };
  return (
    <div
      className="relative aspect-square w-full select-none [container-type:inline-size]"
      style={{
        backgroundImage: `url(${trayUrl})`, backgroundSize: '100% 100%',
        boxShadow: '0.6cqw 1.4cqw 2.6cqw rgb(60 40 20 / 0.28)',
      }}
    >
      <div
        {...grid}
        ref={gridRef}
        className={`absolute overflow-hidden ${grid.className ?? ''}`}
        style={{
          ...box,
          backgroundColor: BED,
          borderRadius: '0.6cqw',
          boxShadow: `inset 0 0 1.6cqw rgb(40 26 14 / 0.55)`,
          ...grid.style,
        }}
      >
        {children}
      </div>
      {overlay && <div className="pointer-events-none absolute" style={box}>{overlay}</div>}
    </div>
  );
}

/**
 * One glossy tile inside a cell: `face` is the top surface, `side` the darker
 * edge that shows its thickness, `ring` an optional inset outline colour.
 */
export function tileStyle(face: string, side: string, ring?: string): CSSProperties {
  return {
    top: `${SEAM}cqw`, bottom: `${SEAM + THICK}cqw`, left: `${SEAM}cqw`, right: `${SEAM}cqw`,
    borderRadius: `${RADIUS}cqw`,
    background: face,
    boxShadow: `0 ${THICK}cqw 0 ${side}, inset 0.2cqw 0.2cqw 0 rgb(255 255 255 / 0.35)${ring ? `, inset 0 0 0 0.6cqw ${ring}` : ''}`,
  };
}

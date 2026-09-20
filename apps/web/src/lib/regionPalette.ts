/**
 * Okabe–Ito, chosen because it stays distinguishable under deuteranopia and
 * protanopia — Crowns identifies regions by colour, which would otherwise
 * exclude roughly one man in twelve.
 *
 * Colour is never the only channel. Each region also gets its own hatch angle,
 * and region borders are always drawn rather than implied by a colour change.
 */
export const REGION_PALETTE: readonly { rgb: string; angle: number; name: string }[] = [
  { rgb: '230 159 0',   angle: 45,  name: 'orange' },
  { rgb: '86 180 233',  angle: 135, name: 'sky' },
  { rgb: '0 158 115',   angle: 0,   name: 'green' },
  { rgb: '240 228 66',  angle: 90,  name: 'yellow' },
  { rgb: '0 114 178',   angle: 22,  name: 'blue' },
  { rgb: '213 94 0',    angle: 112, name: 'vermillion' },
  { rgb: '204 121 167', angle: 67,  name: 'pink' },
  { rgb: '140 140 140', angle: 157, name: 'grey' },
];

export function regionStyle(g: number, strong = false): { backgroundColor: string; backgroundImage: string } {
  const p = REGION_PALETTE[g % REGION_PALETTE.length]!;
  const alpha = strong ? 'var(--region-alpha-strong)' : 'var(--region-alpha)';
  return {
    backgroundColor: `rgb(${p.rgb} / ${alpha})`,
    backgroundImage: `repeating-linear-gradient(${p.angle}deg, var(--hatch) 0 3px, transparent 3px 9px)`,
  };
}

export const regionName = (g: number): string =>
  REGION_PALETTE[g % REGION_PALETTE.length]!.name;

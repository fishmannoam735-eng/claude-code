/**
 * Crowns' pastel tile colours, matched to the approved wooden-tray board
 * (seven from the reference render, plus a cool stone for the eighth region).
 *
 * Colour is still not the only channel: where two regions meet, the seam
 * between tiles is drawn three times wider, so the region outline reads in
 * greyscale too — the tray's version of "region borders always drawn".
 */
export const CROWNS_PALETTE: readonly { rgb: readonly [number, number, number]; name: string }[] = [
  { rgb: [196, 178, 236], name: 'purple' },
  { rgb: [247, 196, 168], name: 'peach' },
  { rgb: [170, 224, 198], name: 'mint' },
  { rgb: [160, 200, 240], name: 'blue' },
  { rgb: [248, 228, 150], name: 'yellow' },
  { rgb: [240, 160, 148], name: 'coral' },
  { rgb: [236, 166, 212], name: 'pink' },
  { rgb: [204, 206, 214], name: 'stone' },
];

const pick = (g: number) => CROWNS_PALETTE[g % CROWNS_PALETTE.length]!;
const shade = ([r, g, b]: readonly number[], k: number): string =>
  `rgb(${[r!, g!, b!].map((v) => Math.min(255, Math.round(v * k))).join(' ')})`;

/** Top face (a soft top-left light) and the darker side that shows the tile's thickness. */
export function tileColours(g: number): { face: string; side: string } {
  const { rgb } = pick(g);
  return {
    face: `linear-gradient(135deg, ${shade(rgb, 1.06)} 0%, ${shade(rgb, 1)} 45%, ${shade(rgb, 0.93)} 100%)`,
    side: shade(rgb, 0.74),
  };
}

export const crownsRegionName = (g: number): string => pick(g).name;

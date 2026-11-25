import { CROWNS_PALETTE } from '../crowns/palette';

/**
 * Quilt's clue colours. A big board has a dozen or more clues, and with
 * Crowns' eight pastels two clues often shared a colour, so a patch could
 * not be told from its neighbour's. These are the same eight plus eight more,
 * ordered so that similar shades sit far apart in clue order (and clues near
 * each other in order are near each other on the board).
 */
export const QUILT_PALETTE: readonly { rgb: readonly [number, number, number]; name: string }[] = [
  ...CROWNS_PALETTE,
  { rgb: [204, 230, 140], name: 'lime' },
  { rgb: [140, 214, 212], name: 'teal' },
  { rgb: [250, 192, 118], name: 'orange' },
  { rgb: [178, 184, 242], name: 'periwinkle' },
  { rgb: [246, 186, 196], name: 'rose' },
  { rgb: [192, 212, 168], name: 'sage' },
  { rgb: [150, 220, 246], name: 'sky' },
  { rgb: [224, 202, 164], name: 'sand' },
];

const pick = (k: number) => QUILT_PALETTE[k % QUILT_PALETTE.length]!;

/** The clue's colour, lightened or darkened by `f`. */
export const quiltRgb = (k: number, f = 1): string =>
  `rgb(${pick(k).rgb.map((v) => Math.min(255, Math.round(v * f))).join(' ')})`;

export const quiltColourName = (k: number): string => pick(k).name;

/** A patch's top face, softly lit from the top left. */
export const quiltFace = (k: number): string =>
  `linear-gradient(135deg, ${quiltRgb(k, 1.06)} 0%, ${quiltRgb(k, 1)} 45%, ${quiltRgb(k, 0.93)} 100%)`;

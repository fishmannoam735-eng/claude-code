/**
 * Checks every colour pair the UI actually relies on, in both themes.
 *
 * This exists because eyeballing failed three times on this project: two
 * "obviously fine" mid-greys for pencil marks landed at ~3.2:1, and an
 * accent used as text failed until it was darkened. A token table is not a
 * design until something has measured it.
 *
 *   pnpm --filter @pb/gen contrast
 */
const hex = (h: string): [number, number, number] => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
};

/** Relative luminance, per WCAG 2.1. */
function luminance(h: string): number {
  const [r, g, b] = hex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Flatten a translucent colour over a background, so tints are judged as seen. */
export function over(fg: string, bg: string, alpha: number): string {
  const [fr, fg_, fb] = hex(fg), [br, bg_, bb] = hex(bg);
  const mix = (f: number, b: number): string =>
    Math.round(f * alpha + b * (1 - alpha)).toString(16).padStart(2, '0');
  return `#${mix(fr, br)}${mix(fg_, bg_)}${mix(fb, bb)}`;
}

interface Theme {
  name: string;
  surface: string; raised: string; raised2: string; ink: string; ink2: string;
  games: Record<string, { base: string; text: string }>;
}

const LIGHT: Theme = {
  name: 'light',
  surface: '#FAF7F2', raised: '#FFFFFF', raised2: '#F4EEE3', ink: '#1A1814', ink2: '#6E6A5E',
  games: {
    nine:    { base: '#B87A22', text: '#8A5E18' },
    eclipse: { base: '#4F5BD5', text: '#3F49B0' },
    crowns:  { base: '#4A7C59', text: '#3A6247' },
    thread:  { base: '#2C7A8C', text: '#22606E' },
    quilt:   { base: '#9B4F72', text: '#7E3F5C' },
  },
};

const DARK: Theme = {
  name: 'dark',
  surface: '#16161A', raised: '#1E1E24', raised2: '#26262E', ink: '#F2EFE9', ink2: '#9A9AA6',
  games: {
    nine:    { base: '#E0A54A', text: '#E0A54A' },
    eclipse: { base: '#8E96F0', text: '#9AA2F5' },
    crowns:  { base: '#6FA67E', text: '#7FB88E' },
    thread:  { base: '#5FB3C7', text: '#6FC0D3' },
    quilt:   { base: '#D48CAF', text: '#DF9DBC' },
  },
};

/** The tile alpha a game glyph sits on. Must match --game-tile-alpha in index.css. */
const TILE_ALPHA = { light: 0.16, dark: 0.24 } as const;

const TEXT_MIN = 4.5;     // WCAG AA, body text
const GRAPHIC_MIN = 3.0;  // WCAG 1.4.11, non-text (glyph strokes, borders)

/*
 * The pairs below are the ones the UI actually renders, and the list is
 * deliberately short because the design was narrowed to make it short.
 *
 * The first draft filled the selected difficulty chip with the saturated game
 * colour and put `ink` on top. That failed in dark mode for all five games
 * (1.90–2.46:1): dark-theme `ink` is near-white and the game colours are
 * pastels. Rather than pick a bespoke foreground per game per theme, the game
 * colour now only ever carries the tile tint, a border and a progress fill —
 * never a solid field beneath text. Labels stay on ink, which is safe by
 * construction in both themes.
 */

let failures = 0;
function check(label: string, fg: string, bg: string, min: number): void {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(44)} ${r.toFixed(2)}:1  (needs ${min})`);
}

for (const t of [LIGHT, DARK]) {
  console.log(`\n— ${t.name} —`);
  check('ink on surface', t.ink, t.surface, TEXT_MIN);
  check('ink-2 on surface', t.ink2, t.surface, TEXT_MIN);
  check('ink-2 on raised', t.ink2, t.raised, TEXT_MIN);

  const alpha = TILE_ALPHA[t.name as 'light' | 'dark'];
  for (const [game, c] of Object.entries(t.games)) {
    const tile = over(c.base, t.raised, alpha);
    // The glyph, drawn in the game's text-weight colour on its own soft tile.
    check(`${game}: glyph on its tile`, c.text, tile, GRAPHIC_MIN);
    // A label in the game's colour ("Play", the streak count) on a card.
    check(`${game}: text on raised`, c.text, t.raised, TEXT_MIN);
    // The selected difficulty chip: ink on the soft tile, never on a solid fill.
    check(`${game}: chip label on its tile`, t.ink, tile, TEXT_MIN);
    // The tile border and the progress bar, both graphical.
    check(`${game}: border on raised`, c.base, t.raised, GRAPHIC_MIN);
  }
}

console.log(failures === 0
  ? '\nAll pairs pass.\n'
  : `\n${failures} pair(s) FAIL — fix the token before shipping it.\n`);
process.exit(failures === 0 ? 0 : 1);

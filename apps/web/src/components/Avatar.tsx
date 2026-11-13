/**
 * A player's face on the rankings: a glossy pastel tile, like a Crowns piece,
 * with their initials pressed into it. Twelve colours; the player picks one.
 */
export const AVATAR_COLOURS: readonly (readonly [number, number, number])[] = [
  [196, 178, 236], [247, 196, 168], [170, 224, 198], [160, 200, 240],
  [248, 228, 150], [240, 160, 148], [236, 166, 212], [204, 206, 214],
  [180, 214, 150], [150, 214, 222], [232, 190, 120], [214, 170, 150],
];

const shade = ([r, g, b]: readonly number[], k: number): string =>
  `rgb(${[r!, g!, b!].map((v) => Math.min(255, Math.round(v * k))).join(' ')})`;

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !/^\d+$/.test(w));
  const letters = (words.length >= 2 ? words[0]![0]! + words[1]![0]! : (words[0] ?? name).slice(0, 2));
  return letters.toUpperCase();
}

export function Avatar({ name, colour, size = 36, ring }: { name: string; colour: number; size?: number; ring?: string | undefined }) {
  const rgb = AVATAR_COLOURS[((colour % AVATAR_COLOURS.length) + AVATAR_COLOURS.length) % AVATAR_COLOURS.length]!;
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex flex-shrink-0 items-center justify-center rounded-[30%] font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        color: shade(rgb, 0.42),
        background: `linear-gradient(135deg, ${shade(rgb, 1.08)} 0%, ${shade(rgb, 1)} 45%, ${shade(rgb, 0.9)} 100%)`,
        boxShadow: `0 ${Math.max(2, size / 14)}px 0 ${shade(rgb, 0.7)}, inset 1px 1px 0 rgb(255 255 255 / 0.55)${ring ? `, 0 0 0 3px ${ring}` : ''}`,
        marginBottom: Math.max(2, size / 14),
      }}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Turns a picture the player picked (or just took) into a small square for
 * their cube: centre-cropped, 160x160, WebP where the browser can write it
 * and JPEG otherwise, squeezed until it is comfortably under the server's cap.
 */
const SIDE = 160;
const MAX_CHARS = 56_000;

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not a picture')); };
    img.src = url;
  });
}

export async function squarePhoto(file: File): Promise<string> {
  const img = await load(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  // Faces sit in the upper part of most portraits, so lean the crop up a little.
  const sy = Math.max(0, (img.naturalHeight - side) / 2 - (img.naturalHeight > img.naturalWidth ? side * 0.12 : 0));
  const canvas = document.createElement('canvas');
  canvas.width = SIDE; canvas.height = SIDE;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no canvas');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, side, side, 0, 0, SIDE, SIDE);
  for (const q of [0.85, 0.75, 0.62, 0.5, 0.4]) {
    let url = canvas.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error('picture too large');
}

/**
 * Ready-made avatars for players who'd rather not use a photo: a character
 * on a glossy backdrop. The pick is drawn once on this device and saved like
 * a photo, so every phone shows exactly the same picture.
 */
export const AVATAR_ART: readonly { glyph: string; name: string; bg: readonly [string, string] }[] = [
  { glyph: '🦊', name: 'Fox', bg: ['#FFD9B8', '#F29A5C'] },
  { glyph: '🐼', name: 'Panda', bg: ['#E6F4EA', '#8FC9A3'] },
  { glyph: '🐯', name: 'Tiger', bg: ['#FFE7A8', '#F2B33D'] },
  { glyph: '🦁', name: 'Lion', bg: ['#FFE2B0', '#E59A3A'] },
  { glyph: '🐸', name: 'Frog', bg: ['#DDF5C8', '#7FC45A'] },
  { glyph: '🐨', name: 'Koala', bg: ['#E3E8F2', '#9AA8C4'] },
  { glyph: '🐰', name: 'Bunny', bg: ['#FFE0EE', '#F09CC2'] },
  { glyph: '🐻', name: 'Bear', bg: ['#F3DCC4', '#B9875A'] },
  { glyph: '🐧', name: 'Penguin', bg: ['#D6ECFF', '#6FA8E0'] },
  { glyph: '🦉', name: 'Owl', bg: ['#EADCF8', '#A887D8'] },
  { glyph: '🐙', name: 'Octopus', bg: ['#FFD6D6', '#E57373'] },
  { glyph: '🦄', name: 'Unicorn', bg: ['#F6DDFB', '#C98BE0'] },
  { glyph: '🐲', name: 'Dragon', bg: ['#D4F5E4', '#4DB487'] },
  { glyph: '🦖', name: 'Dino', bg: ['#E2F3D2', '#8BBF5F'] },
  { glyph: '🐵', name: 'Monkey', bg: ['#F8E2CC', '#C99566'] },
  { glyph: '🐱', name: 'Cat', bg: ['#FFF0C9', '#EFC157'] },
  { glyph: '🐶', name: 'Puppy', bg: ['#F5E6D3', '#CFA57A'] },
  { glyph: '🦋', name: 'Butterfly', bg: ['#D9F1FB', '#5FB7DE'] },
  { glyph: '🤖', name: 'Robot', bg: ['#E1E7EE', '#8C9BAD'] },
  { glyph: '👽', name: 'Alien', bg: ['#DCF7D4', '#62C46E'] },
  { glyph: '🦸', name: 'Hero', bg: ['#FFD5D0', '#E0473C'] },
  { glyph: '🧙', name: 'Wizard', bg: ['#DCD9FA', '#7A6FD6'] },
  { glyph: '🥷', name: 'Ninja', bg: ['#D8DCE3', '#5D6676'] },
  { glyph: '🧑‍🚀', name: 'Astronaut', bg: ['#D3E3FA', '#3F67B5'] },
];

export function renderAvatarArt(index: number): string {
  const art = AVATAR_ART[index]!;
  const canvas = document.createElement('canvas');
  canvas.width = SIDE; canvas.height = SIDE;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no canvas');
  const bg = g.createRadialGradient(SIDE * 0.35, SIDE * 0.28, SIDE * 0.05, SIDE * 0.5, SIDE * 0.5, SIDE * 0.75);
  bg.addColorStop(0, art.bg[0]);
  bg.addColorStop(1, art.bg[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, SIDE, SIDE);
  // A soft halo behind the character, then the character with a gentle drop shadow.
  const halo = g.createRadialGradient(SIDE / 2, SIDE * 0.52, 0, SIDE / 2, SIDE * 0.52, SIDE * 0.42);
  halo.addColorStop(0, 'rgba(255,255,255,0.55)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, SIDE, SIDE);
  g.shadowColor = 'rgba(40,20,0,0.35)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(SIDE * 0.66)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.fillText(art.glyph, SIDE / 2, SIDE * 0.55);
  for (const q of [0.9, 0.8, 0.7]) {
    let url = canvas.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/png');
    if (url.length <= MAX_CHARS) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.8);
}

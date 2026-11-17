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

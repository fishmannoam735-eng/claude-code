export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(h ? 2 : 1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export const DIFF_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard' } as const;

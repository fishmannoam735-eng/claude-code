/** localStorage that never throws — private windows and blocked storage just become no-ops. */
export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
export function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
export function removeKey(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
export function keysWithPrefix(prefix: string): string[] {
  try {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  } catch { return []; }
}

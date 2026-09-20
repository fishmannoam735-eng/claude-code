import type { ParsedSeed } from '@pb/engine';
import { fmtTime, DIFF_LABEL } from '../../lib/format';

export function buildShareText(opts: {
  parsed: ParsedSeed; seed: string; elapsedMs: number; boxMistakes: number[]; streak: number | null;
}): string {
  const { parsed, seed, elapsedMs, boxMistakes, streak } = opts;
  const title = parsed.isDaily ? `Nine ${parsed.key}` : 'Nine practice';
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    rows.push([0, 1, 2].map((c) => (boxMistakes[r * 3 + c]! > 0 ? '🟨' : '🟩')).join(''));
  }
  const line2 = `⏱ ${fmtTime(elapsedMs)}` + (streak ? ` · 🔥 ${streak}` : '');
  const url = `${location.origin}/g/${seed}`;
  return `Puzzle Break · ${title} · ${DIFF_LABEL[parsed.difficulty]}\n${line2}\n${rows.join('\n')}\n${url}`;
}

export async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
  } catch { /* fall through to clipboard */ }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}

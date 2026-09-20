import type { ParsedSeed } from '@pb/engine';
import { fmtTime, DIFF_LABEL } from './format';

/**
 * A spoiler-free result card. Each game supplies its own emoji rows — a
 * coarse map of where it went wrong, never anything that leaks the solution.
 */
export function buildShareText(opts: {
  game: string;
  parsed: ParsedSeed;
  seed: string;
  elapsedMs: number;
  rows: string[];
  streak: number | null;
}): string {
  const { game, parsed, seed, elapsedMs, rows, streak } = opts;
  const title = parsed.isDaily ? `${game} ${parsed.key}` : `${game} practice`;
  const line2 = `⏱ ${fmtTime(elapsedMs)}` + (streak ? ` · 🔥 ${streak}` : '');
  return `Puzzle Break · ${title} · ${DIFF_LABEL[parsed.difficulty]}\n${line2}\n${rows.join('\n')}\n${location.origin}/g/${seed}`;
}

/** Chunk a per-region mistake tally into emoji rows. */
export function mistakeRows(mistakes: readonly number[], perRow: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < mistakes.length; i += perRow) {
    out.push(mistakes.slice(i, i + perRow).map((m) => (m > 0 ? '🟨' : '🟩')).join(''));
  }
  return out;
}

export async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
  } catch { /* fall through to clipboard */ }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}

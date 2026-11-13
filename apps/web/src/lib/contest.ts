import { create } from 'zustand';
import { fetchMyStats, type MyStats } from '@pb/data';
import { localDateKey } from '@pb/engine';
import { supabase } from './session';

/** The signed-in player's numbers, shared by the home header, profile and rankings. */
interface MeState {
  stats: MyStats | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useMe = create<MeState>((set) => ({
  stats: null,
  loading: false,
  refresh: async () => {
    if (!supabase) return;
    set({ loading: true });
    try {
      const stats = await fetchMyStats(supabase, localDateKey());
      set({ stats, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));

export const GAME_NAME = { nine: 'Nine', eclipse: 'Eclipse', crowns: 'Crowns', thread: 'Thread', quilt: 'Quilt' } as const;

export const fmtPoints = (n: number): string => n.toLocaleString('en-US');

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

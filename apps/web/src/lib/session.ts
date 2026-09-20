import { create } from 'zustand';
import { createDataClient, ensureSession, type DataClient } from '@pb/data';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase: DataClient | null = url && key ? createDataClient(url, key) : null;

type Status = 'loading' | 'online' | 'offline';

interface SessionState {
  status: Status;
  userId: string | null;
  error: string | null;
  init: () => Promise<void>;
}

/**
 * Anonymous auth on first load. If it fails (project setting off, no network)
 * the app keeps working from localStorage and says so quietly — play is never
 * blocked on the backend.
 */
export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  userId: null,
  error: null,
  init: async () => {
    if (!supabase) { set({ status: 'offline', error: 'no backend configured' }); return; }
    try {
      const userId = await ensureSession(supabase);
      set({ status: 'online', userId, error: null });
    } catch (e) {
      set({ status: 'offline', userId: null, error: e instanceof Error ? e.message : String(e) });
    }
  },
}));

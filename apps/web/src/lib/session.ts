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
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let tries = 0;
let busy = false;

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  userId: null,
  error: null,
  init: async () => {
    if (!supabase) { set({ status: 'offline', error: 'no backend configured' }); return; }
    if (busy) return;
    busy = true;
    clearTimeout(retryTimer);
    try {
      const userId = await ensureSession(supabase);
      tries = 0;
      set({ status: 'online', userId, error: null });
    } catch (e) {
      set({ status: 'offline', userId: get().userId, error: e instanceof Error ? e.message : String(e) });
      // A weak signal at start-up shouldn't leave the contest dark all day:
      // keep trying, further apart each time.
      tries += 1;
      retryTimer = setTimeout(() => { void get().init(); }, Math.min(60_000, 3_000 * 2 ** (tries - 1)));
    } finally {
      busy = false;
    }
  },
}));

// Coming back online, or back to the app, tries again straight away.
if (typeof window !== 'undefined') {
  const again = () => { if (useSession.getState().status === 'offline') void useSession.getState().init(); };
  window.addEventListener('online', again);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') again(); });
}

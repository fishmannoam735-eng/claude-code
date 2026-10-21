import { create } from 'zustand';
import { readJSON, writeJSON } from '../../lib/storage';

const KEY = 'pb.nine.highlightNotes';

/**
 * Whether picking a number also lights up the pencil marks holding it, not
 * just the placed digits. On by default; remembered per device.
 */
export const useNoteHighlight = create<{ on: boolean; toggle: () => void }>((set, get) => ({
  on: readJSON<boolean>(KEY) ?? true,
  toggle: () => {
    const on = !get().on;
    writeJSON(KEY, on);
    set({ on });
  },
}));

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, Tables, TablesInsert } from './database.types.js';

export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from './database.types.js';

export type DataClient = SupabaseClient<Database>;
export type PlayRow = Tables<'plays'>;
export type StreakRow = Tables<'streaks'>;

export function createDataClient(url: string, publishableKey: string): DataClient {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

/**
 * Every visitor is a real user from the first load. Returns the user id, or
 * throws if anonymous sign-in is disabled on the project — callers should
 * then run in local-only mode rather than blocking play.
 */
export async function ensureSession(client: DataClient): Promise<string> {
  const { data: { session } } = await client.auth.getSession();
  if (session?.user) return session.user.id;
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error('anonymous sign-in returned no user');
  return data.user.id;
}

export interface PlayUpsert {
  seed: string;
  game_id: Database['public']['Enums']['game_id'];
  difficulty: Database['public']['Enums']['difficulty'];
  mode: Database['public']['Enums']['play_mode'];
  puzzle_date: string | null;
  status: Database['public']['Enums']['play_status'];
  state: Json | null;
  duration_ms: number | null;
  mistakes: number;
  completed_at: string | null;
}

export async function upsertPlay(client: DataClient, userId: string, play: PlayUpsert): Promise<void> {
  const row: TablesInsert<'plays'> = { user_id: userId, ...play };
  const { error } = await client.from('plays').upsert(row, { onConflict: 'user_id,seed' });
  if (error) throw error;
}

export async function fetchPlay(client: DataClient, userId: string, seed: string): Promise<PlayRow | null> {
  const { data, error } = await client.from('plays').select('*').eq('user_id', userId).eq('seed', seed).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchPlaysForDate(client: DataClient, userId: string, date: string): Promise<PlayRow[]> {
  const { data, error } = await client.from('plays').select('*').eq('user_id', userId).eq('puzzle_date', date);
  if (error) throw error;
  return data ?? [];
}

export async function fetchStreaks(client: DataClient, userId: string): Promise<StreakRow[]> {
  const { data, error } = await client.from('streaks').select('*').eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

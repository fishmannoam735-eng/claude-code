import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, Tables, TablesInsert } from './database.types.js';

export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from './database.types.js';

export type DataClient = SupabaseClient<Database>;
export type PlayRow = Tables<'plays'>;
export type StreakRow = Tables<'streaks'>;

export function createDataClient(url: string, publishableKey: string): DataClient {
  return createClient<Database>(url, publishableKey, {
    // pkce: email links come back as ?code=…, which survives the hash router.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
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
  hints: number;
  fills: number;
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

// ------------------------------------------------------------------ contest

export type Period = 'day' | 'week' | 'all';
type GameEnum = Database['public']['Enums']['game_id'];

export interface RankRow {
  rank: number; nickname: string; avatar: number; score: number;
  solves: number; total_ms: number; hintless: number; is_me: boolean;
}

export async function fetchLeaderboard(client: DataClient, period: Period, today: string, game: GameEnum | null, limit = 50): Promise<RankRow[]> {
  const { data, error } = await client.rpc('leaderboard', {
    p_period: period, p_today: today, p_limit: limit, ...(game ? { p_game: game } : {}),
  });
  if (error) throw error;
  return (data ?? []) as RankRow[];
}

export interface PlayerRef { nickname: string; avatar: number; isMe?: boolean }
export interface ContestStats {
  today: { players: number; solves: number; avgScore: number; hintFreePct: number };
  games: { game: GameEnum; started: number; solved: number; avgMs: number | null; hintPct: number;
           best: (PlayerRef & { ms: number; difficulty: string; score: number }) | null }[];
  trend: { date: string; players: number; solves: number }[];
  difficulty: { easy: number; normal: number; hard: number };
  champions: (PlayerRef & { wins: number })[];
  streaks: (PlayerRef & { current: number; longest: number })[];
}

export async function fetchContestStats(client: DataClient, today: string): Promise<ContestStats> {
  const { data, error } = await client.rpc('contest_stats', { p_today: today });
  if (error) throw error;
  return data as unknown as ContestStats;
}

export interface MyStats {
  nickname: string; avatar: number;
  personalScore: number; contestScore: number; solves: number; contestSolves: number;
  practiceSolves: number; hintFree: number; days: number; wins: number; streak: number; hasEmail: boolean;
  games: { game: GameEnum; solves: number; score: number; bestMs: number | null; avgScore: number }[];
  trend: { date: string; score: number; contest: number }[];
}

export async function fetchMyStats(client: DataClient, today: string): Promise<MyStats | null> {
  const { data, error } = await client.rpc('my_stats', { p_today: today });
  if (error) throw error;
  return (data as unknown as MyStats | null) ?? null;
}

export async function updateProfile(client: DataClient, userId: string, patch: { nickname?: string; avatar?: number }): Promise<void> {
  const { error } = await client.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export async function makeTransferCode(client: DataClient): Promise<string> {
  const { data, error } = await client.rpc('make_transfer_code');
  if (error) throw error;
  return data as string;
}

export async function claimTransferCode(client: DataClient, code: string): Promise<string> {
  const { data, error } = await client.rpc('claim_transfer_code', { code });
  if (error) throw error;
  return data as string;
}

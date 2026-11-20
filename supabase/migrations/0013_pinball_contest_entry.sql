create or replace function public.pinball_points(p_level public.difficulty, p_score bigint) returns integer
language sql immutable set search_path = public as $$
  select round(
    (case p_level when 'easy' then 100 when 'normal' then 200 else 300 end)
    * least(1.5, greatest(0.1, sqrt(greatest(p_score, 0)::numeric / (case p_level when 'easy' then 1000000 when 'normal' then 700000 else 400000 end))))
  )::int
$$;

create or replace function public.pinball_to_contest() returns trigger
language plpgsql security definer set search_path = public as $$
declare pts integer := public.pinball_points(new.level, new.score);
begin
  if new.score <= 0 then return new; end if;
  perform set_config('pb.merging', 'on', true);
  insert into public.plays (user_id, game_id, seed, difficulty, mode, puzzle_date, started_at, completed_at,
                            duration_ms, status, score, best_ms, best_hints, attempts, contest, last_solved_at)
  values (new.user_id, 'pinball', 'pinball:' || new.played_on || ':' || new.level, new.level, 'daily', new.played_on,
          new.created_at, new.created_at, 0, 'solved', pts, 0, 0, 1, true, new.created_at)
  on conflict (user_id, seed) do update
     set score = greatest(coalesce(public.plays.score, 0), excluded.score),
         attempts = public.plays.attempts + 1,
         last_solved_at = excluded.last_solved_at;
  perform set_config('pb.merging', 'off', true);
  return new;
end $$;

create trigger pinball_to_contest after insert on public.pinball_scores
  for each row execute function public.pinball_to_contest();

revoke all on function public.pinball_to_contest() from public, anon, authenticated;

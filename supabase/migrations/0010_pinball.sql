-- Crown Quest pinball joins as the first "Speed & skill" game. It is scored by
-- points, not time, so it keeps its own table and its own high-score board;
-- the puzzle contest (plays, leaderboard_v2) is untouched.

create table public.pinball_scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  level      public.difficulty not null,
  score      bigint not null check (score >= 0 and score <= 2000000000),
  played_on  date not null,
  created_at timestamptz not null default now()
);
create index pinball_scores_board on public.pinball_scores (level, played_on, score desc);
create index pinball_scores_user on public.pinball_scores (user_id);

alter table public.pinball_scores enable row level security;
create policy "pinball: read own"   on public.pinball_scores for select using (user_id = auth.uid());
create policy "pinball: insert own" on public.pinball_scores for insert with check (user_id = auth.uid());

-- The day a game belongs to is the player's local date, kept within a day of
-- the server's, and the time it was played is always the server's.
create or replace function public.pinball_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare utc_day date := (now() at time zone 'utc')::date;
begin
  new.created_at := now();
  if new.played_on is null or new.played_on not between utc_day - 1 and utc_day + 1 then
    new.played_on := utc_day;
  end if;
  return new;
end $$;
create trigger pinball_guard before insert on public.pinball_scores
  for each row execute function public.pinball_guard();

-- High scores for one level: each player's best game in the period.
create or replace function public.pinball_board(p_level public.difficulty, p_period text, p_today date default null, p_limit integer default 50)
returns table (rank integer, nickname text, avatar smallint, score bigint, games integer, is_me boolean, photo text)
language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_today, (now() at time zone 'utc')::date) as today),
  mine as (
    select s.user_id, max(s.score) as score, count(*)::int as games
      from public.pinball_scores s, d
     where s.level = p_level
       and case p_period
             when 'day'  then s.played_on = d.today
             when 'week' then s.played_on between d.today - 6 and d.today
             else true end
     group by s.user_id
  ),
  ranked as (
    select (rank() over (order by m.score desc))::int as rank, m.* from mine m
  )
  select r.rank, pr.nickname, pr.avatar, r.score, r.games, r.user_id = auth.uid(), pr.photo
    from ranked r join public.profiles pr on pr.id = r.user_id
   where r.rank <= p_limit or r.user_id = auth.uid()
   order by r.rank, pr.nickname
$$;
grant execute on function public.pinball_board(public.difficulty, text, date, integer) to anon, authenticated;

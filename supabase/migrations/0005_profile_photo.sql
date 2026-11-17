-- Puzzle Break: a profile picture on each player's cube.
--
-- The picture is a small square image (the app shrinks it to 160x160 WebP or
-- JPEG before sending), kept inline as a data: URL so no storage bucket is
-- needed. Capped at 60 kB, and only image data URLs are accepted.

alter table public.profiles
  add column photo text
  constraint profiles_photo_ok check (
    photo is null or (length(photo) <= 60000 and photo ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$')
  );

-- The rankings with each player's picture. A new name, so the old function
-- (and older copies of the app) keep working unchanged.
create or replace function public.leaderboard_v2(p_period text, p_today date default null, p_game public.game_id default null, p_limit integer default 50)
returns table (rank integer, nickname text, avatar smallint, score integer, solves integer, total_ms bigint, hintless integer, is_me boolean, photo text)
language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_today, (now() at time zone 'utc')::date) as today),
  entries as (
    select distinct on (p.user_id, p.game_id, p.puzzle_date)
           p.user_id, p.score, p.best_ms, p.best_hints
      from public.plays p, d
     where p.contest
       and (p_game is null or p.game_id = p_game)
       and case p_period
             when 'day'  then p.puzzle_date = d.today
             when 'week' then p.puzzle_date between d.today - 6 and d.today
             else true end
     order by p.user_id, p.game_id, p.puzzle_date, p.score desc, p.best_ms asc
  ),
  agg as (
    select user_id, sum(score)::int as score, count(*)::int as solves,
           sum(coalesce(best_ms, 0))::bigint as total_ms,
           count(*) filter (where coalesce(best_hints, 0) = 0)::int as hintless
      from entries group by user_id
  ),
  ranked as (
    select (rank() over (order by a.score desc, a.total_ms asc))::int as rank, a.*
      from agg a
  )
  select r.rank, pr.nickname, pr.avatar, r.score, r.solves, r.total_ms, r.hintless, r.user_id = auth.uid(), pr.photo
    from ranked r join public.profiles pr on pr.id = r.user_id
   where r.rank <= p_limit or r.user_id = auth.uid()
   order by r.rank, pr.nickname
$$;

create or replace function public.contest_stats(p_today date default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_today, (now() at time zone 'utc')::date) as today),
  best as (
    select distinct on (p.user_id, p.game_id, p.puzzle_date) p.*
      from public.plays p where p.contest
     order by p.user_id, p.game_id, p.puzzle_date, p.score desc, p.best_ms asc
  ),
  today_plays as (
    select p.* from public.plays p, d where p.mode = 'daily' and p.puzzle_date = d.today
  ),
  today_best as (select b.* from best b, d where b.puzzle_date = d.today),
  daily_totals as (
    select puzzle_date, user_id, sum(score) as score, sum(best_ms) as ms from best group by 1, 2
  ),
  winners as (
    select distinct on (puzzle_date) puzzle_date, user_id
      from daily_totals order by puzzle_date, score desc, ms asc
  )
  select jsonb_build_object(
    'today', jsonb_build_object(
        'players', (select count(distinct user_id) from today_plays),
        'solves',  (select count(*) from today_best),
        'avgScore', coalesce((select round(avg(score)) from today_best), 0),
        'hintFreePct', coalesce((select round(100.0 * count(*) filter (where coalesce(best_hints, 0) = 0) / nullif(count(*), 0)) from today_best), 0),
        'attempts', coalesce((select sum(attempts) from today_plays), 0)),
    'games', (
      select coalesce(jsonb_agg(g order by g->>'game'), '[]'::jsonb) from (
        select jsonb_build_object(
          'game', tp.game_id,
          'started', count(*),
          'solved', count(*) filter (where tp.score is not null),
          'avgMs', (select round(avg(b.best_ms)) from today_best b where b.game_id = tp.game_id),
          'hintPct', coalesce((select round(100.0 * count(*) filter (where coalesce(b.best_hints, 0) > 0) / nullif(count(*), 0)) from today_best b where b.game_id = tp.game_id), 0),
          'best', (
            select jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar, 'photo', pr.photo, 'ms', b.best_ms, 'difficulty', b.difficulty, 'score', b.score)
              from today_best b join public.profiles pr on pr.id = b.user_id
             where b.game_id = tp.game_id
             order by b.score desc, b.best_ms asc limit 1)
        ) as g
        from today_plays tp group by tp.game_id
      ) x),
    'trend', (
      select jsonb_agg(jsonb_build_object('date', day::date, 'players', coalesce(t.players, 0), 'solves', coalesce(t.solves, 0)) order by day)
        from d, generate_series(d.today - 13, d.today, interval '1 day') as day
        left join (
          select puzzle_date, count(distinct user_id) as players, count(*) as solves from best group by puzzle_date
        ) t on t.puzzle_date = day::date),
    'difficulty', (
      select jsonb_build_object(
        'easy', count(*) filter (where difficulty = 'easy'),
        'normal', count(*) filter (where difficulty = 'normal'),
        'hard', count(*) filter (where difficulty = 'hard'))
        from best b, d where b.puzzle_date between d.today - 6 and d.today),
    'champions', (
      select coalesce(jsonb_agg(c order by (c->>'wins')::int desc, c->>'nickname'), '[]'::jsonb) from (
        select jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar, 'photo', pr.photo, 'wins', count(*), 'isMe', w.user_id = auth.uid()) as c
          from winners w join public.profiles pr on pr.id = w.user_id
         where pr.nickname is not null
         group by pr.nickname, pr.avatar, pr.photo, w.user_id
         order by count(*) desc limit 5) y),
    'yesterday', (
      select jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar, 'photo', pr.photo, 'score', t.score, 'isMe', t.user_id = auth.uid())
        from d, daily_totals t join public.profiles pr on pr.id = t.user_id
       where t.puzzle_date = d.today - 1
       order by t.score desc, t.ms asc limit 1),
    'streaks', (
      select coalesce(jsonb_agg(s order by (s->>'current')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar, 'photo', pr.photo, 'current', max(st.current), 'longest', max(st.longest), 'isMe', st.user_id = auth.uid()) as s
          from public.streaks st join public.profiles pr on pr.id = st.user_id
         where st.current > 0 and pr.nickname is not null
         group by st.user_id, pr.nickname, pr.avatar, pr.photo
         order by max(st.current) desc, max(st.longest) desc limit 5) z)
  )
$$;

create or replace function public.my_stats(p_today date default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_today, (now() at time zone 'utc')::date) as today),
  mine as (select * from public.plays where user_id = auth.uid() and score is not null),
  my_best as (
    select distinct on (game_id, puzzle_date) * from mine where contest
     order by game_id, puzzle_date, score desc, best_ms asc
  ),
  all_best as (
    select distinct on (user_id, game_id, puzzle_date) user_id, puzzle_date, score, best_ms
      from public.plays where contest
     order by user_id, game_id, puzzle_date, score desc, best_ms asc
  )
  select case when auth.uid() is null then null else jsonb_build_object(
    'nickname', (select nickname from public.profiles where id = auth.uid()),
    'avatar',   (select avatar from public.profiles where id = auth.uid()),
    'photo',    (select photo from public.profiles where id = auth.uid()),
    'personalScore', coalesce((select sum(score) from mine), 0),
    'contestScore',  coalesce((select sum(score) from my_best), 0),
    'solves',        coalesce((select sum(attempts) from mine), 0),
    'contestSolves', (select count(*) from my_best),
    'practiceSolves',(select count(*) from mine where mode <> 'daily'),
    'hintFree',      (select count(*) from mine where coalesce(best_hints, 0) = 0),
    'days',          (select count(distinct puzzle_date) from my_best),
    'wins', (
      select count(*) from (
        select distinct on (puzzle_date) puzzle_date, user_id
          from (select puzzle_date, user_id, sum(score) s, sum(best_ms) ms from all_best group by 1, 2) t
         order by puzzle_date, s desc, ms asc) w
       where w.user_id = auth.uid()),
    'games', (
      select coalesce(jsonb_agg(g), '[]'::jsonb) from (
        select jsonb_build_object('game', game_id, 'solves', sum(attempts), 'score', sum(score),
                                  'bestMs', min(best_ms), 'avgScore', round(avg(score))) as g
          from mine group by game_id) x),
    'trend', (
      select jsonb_agg(jsonb_build_object('date', day::date, 'score', coalesce(t.score, 0), 'contest', coalesce(c.contest, 0)) order by day)
        from d, generate_series(d.today - 13, d.today, interval '1 day') as day
        left join (
          select coalesce(puzzle_date, (completed_at at time zone 'utc')::date) as day2, sum(score) as score
            from mine group by 1
        ) t on t.day2 = day::date
        left join (select puzzle_date, sum(score) as contest from my_best group by 1) c on c.puzzle_date = day::date),
    'streak', (select coalesce(max(current), 0) from public.streaks where user_id = auth.uid()),
    'hasEmail', (select email is not null and email <> '' from auth.users where id = auth.uid())
  ) end
$$;

revoke all on function public.leaderboard_v2(text, date, public.game_id, integer) from public;
grant execute on function public.leaderboard_v2(text, date, public.game_id, integer) to anon, authenticated;

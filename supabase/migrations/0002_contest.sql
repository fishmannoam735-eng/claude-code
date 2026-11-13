-- Puzzle Break — the public contest.
--
-- Every solve earns points (difficulty × speed, minus hints, mistakes and
-- Fill). The FIRST daily board of each game a player solves on a day is their
-- contest entry for that game; everything else (practice, "play again", more
-- difficulties) still adds to their personal score. Points are computed here,
-- never trusted from the client, and a solved play is frozen.

-- ------------------------------------------------------------- profiles
alter table public.profiles
  add column nickname text,
  add column avatar smallint not null default 0 check (avatar between 0 and 15),
  add column transfer_hash text;

alter table public.profiles
  add constraint profiles_nickname_shape
  check (nickname is null or (char_length(nickname) between 2 and 20 and nickname = btrim(nickname)));

create unique index profiles_nickname_key on public.profiles (lower(nickname));
create unique index profiles_transfer_key on public.profiles (transfer_hash) where transfer_hash is not null;

-- A friendly name the moment a player exists, so nobody ranks as "anonymous".
create function public.random_nickname() returns text
language plpgsql volatile set search_path = public as $$
declare
  adj text[] := array['Amber','Brave','Calm','Clever','Cosy','Crisp','Daring','Golden','Happy','Jolly','Keen','Lucky','Mellow','Nimble','Plucky','Quick','Quiet','Rosy','Sly','Sunny','Swift','Witty','Zesty','Bold'];
  ani text[] := array['Otter','Fox','Owl','Panda','Robin','Lynx','Koala','Badger','Heron','Tiger','Finch','Hare','Moose','Seal','Wren','Gecko','Bison','Crane','Lemur','Mole','Puffin','Raven','Yak','Zebra'];
  n text;
begin
  for i in 1..30 loop
    n := adj[1 + floor(random() * array_length(adj, 1))::int] || ' '
      || ani[1 + floor(random() * array_length(ani, 1))::int] || ' '
      || (10 + floor(random() * 90)::int)::text;
    if not exists (select 1 from public.profiles where lower(nickname) = lower(n)) then return n; end if;
  end loop;
  return 'Player ' || substr(md5(random()::text), 1, 6);
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, is_anonymous, nickname, avatar)
  values (new.id, coalesce(new.is_anonymous, false), public.random_nickname(), floor(random() * 12)::smallint);
  return new;
end $$;

update public.profiles set nickname = public.random_nickname(), avatar = floor(random() * 12)::smallint where nickname is null;

-- ---------------------------------------------------------------- plays
alter table public.plays
  add column hints   integer not null default 0 check (hints >= 0),
  add column fills   integer not null default 0 check (fills >= 0),
  add column score   integer,
  add column contest boolean not null default false;

create index plays_contest_idx on public.plays (puzzle_date, game_id) where contest;
create index plays_solved_idx  on public.plays (user_id, completed_at) where status = 'solved';

-- Mirrors packages/engine/src/score.ts. numeric, so rounding matches JS.
create function public.score_play(g public.game_id, d public.difficulty, ms integer, hints integer, mistakes integer, fills integer)
returns integer language sql immutable as $$
  with k as (
    select (case d when 'easy' then 100 when 'normal' then 200 else 300 end)::numeric as base,
           (case g
              when 'nine'    then case d when 'easy' then 360 when 'normal' then 720 else 1200 end
              when 'crowns'  then case d when 'easy' then 60  when 'normal' then 120 else 240 end
              when 'eclipse' then case d when 'easy' then 60  when 'normal' then 120 else 240 end
              when 'thread'  then case d when 'easy' then 45  when 'normal' then 90  else 180 end
              else                case d when 'easy' then 60  when 'normal' then 150 else 300 end
            end)::numeric as par
  )
  select greatest(
    round(base * 0.1),
    round(base * least(1.5, greatest(0.5, 1.5 - 0.5 * ((greatest(coalesce(ms, 0), 0)::numeric / 1000) / par))))
      - round(base * 0.15 * greatest(coalesce(hints, 0), 0))
      - round(base * 0.05 * greatest(coalesce(mistakes, 0), 0))
      - (case when coalesce(fills, 0) > 0 then round(base * 0.25) else 0 end)
  )::integer
  from k
$$;

create function public.score_play_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  min_ms integer := case new.game_id when 'nine' then 45000 else 5000 end;
  utc_day date := (now() at time zone 'utc')::date;
begin
  if current_setting('pb.merging', true) = 'on' then return new; end if;

  if tg_op = 'UPDATE' then
    -- Assists only ever go up: a cleared phone can't wash a hint away.
    new.hints := greatest(new.hints, old.hints);
    new.fills := greatest(new.fills, old.fills);
    new.mistakes := greatest(new.mistakes, old.mistakes);
    if old.status = 'solved' then
      -- A solved play is final. Its board snapshot may still sync; nothing that ranks moves.
      new.status := 'solved';          new.duration_ms := old.duration_ms;
      new.mistakes := old.mistakes;    new.hints := old.hints;  new.fills := old.fills;
      new.score := old.score;          new.contest := old.contest;
      new.completed_at := old.completed_at;
      new.puzzle_date := old.puzzle_date; new.mode := old.mode;
      new.game_id := old.game_id;      new.difficulty := old.difficulty; new.seed := old.seed;
      return new;
    end if;
  end if;

  new.score := null;
  new.contest := false;
  if new.status = 'solved' then
    new.completed_at := coalesce(new.completed_at, now());
    new.score := public.score_play(new.game_id, new.difficulty, new.duration_ms, new.hints, new.mistakes, new.fills);
    if new.mode = 'daily'
       and new.puzzle_date between utc_day - 2 and utc_day + 1
       and coalesce(new.duration_ms, 0) >= min_ms
       and not exists (
         select 1 from public.plays p
          where p.user_id = new.user_id and p.game_id = new.game_id
            and p.puzzle_date = new.puzzle_date and p.contest and p.id <> new.id)
    then
      new.contest := true;
    end if;
  end if;
  return new;
end $$;

create trigger plays_score
  before insert or update on public.plays
  for each row execute function public.score_play_guard();

-- Old solves (before the contest) get their points; none enter the contest.
update public.plays
   set score = public.score_play(game_id, difficulty, duration_ms, hints, mistakes, fills)
 where status = 'solved' and score is null;

-- A contest entry can't be deleted and replayed.
drop policy "plays: delete own" on public.plays;
create policy "plays: delete own" on public.plays for delete using (user_id = auth.uid() and not contest);

-- ----------------------------------------------------- moving phones
-- A code shown on the profile page; typing it on another phone moves
-- everything (plays, streaks, name) onto that phone's player.
create function public.make_transfer_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  for i in 1..10 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  update public.profiles set transfer_hash = encode(sha256(convert_to(code, 'UTF8')), 'hex') where id = auth.uid();
  return substr(code, 1, 5) || '-' || substr(code, 6, 5);
end $$;

create function public.claim_transfer_code(code text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  old public.profiles%rowtype;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into old from public.profiles where transfer_hash = encode(sha256(convert_to(clean, 'UTF8')), 'hex');
  if not found then raise exception 'code not found' using errcode = 'P0002'; end if;
  if old.id = me then return old.nickname; end if;

  perform set_config('pb.merging', 'on', true);
  -- The older player's boards win wherever both played the same one.
  delete from public.plays where user_id = me and seed in (select seed from public.plays where user_id = old.id);
  -- Keep one contest entry per game per day.
  update public.plays m set contest = false
   where m.user_id = me and m.contest and exists (
     select 1 from public.plays o where o.user_id = old.id and o.contest
        and o.game_id = m.game_id and o.puzzle_date = m.puzzle_date);
  update public.plays set user_id = me where user_id = old.id;
  delete from public.streaks where user_id = me and game_id in (select game_id from public.streaks where user_id = old.id);
  update public.streaks set user_id = me where user_id = old.id;
  delete from public.challenge_entries where user_id = me and challenge_id in (select challenge_id from public.challenge_entries where user_id = old.id);
  update public.challenge_entries set user_id = me where user_id = old.id;
  update public.challenges set creator_id = me where creator_id = old.id;
  perform set_config('pb.merging', 'off', true);

  update public.profiles set nickname = null, transfer_hash = null where id = old.id;
  update public.profiles set nickname = old.nickname, avatar = old.avatar where id = me;
  delete from auth.users where id = old.id and coalesce(is_anonymous, true);
  return old.nickname;
end $$;

-- ------------------------------------------------------------ rankings
-- Public reads. They expose a nickname, an avatar and numbers — never ids.

create function public.leaderboard(p_period text, p_today date default null, p_game public.game_id default null, p_limit integer default 50)
returns table (rank integer, nickname text, avatar smallint, score integer, solves integer, total_ms bigint, hintless integer, is_me boolean)
language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_today, (now() at time zone 'utc')::date) as today),
  entries as (
    select p.user_id, p.score, p.duration_ms, p.hints
      from public.plays p, d
     where p.contest
       and (p_game is null or p.game_id = p_game)
       and case p_period
             when 'day'  then p.puzzle_date = d.today
             when 'week' then p.puzzle_date between d.today - 6 and d.today
             else true end
  ),
  agg as (
    select user_id, sum(score)::int as score, count(*)::int as solves,
           sum(coalesce(duration_ms, 0))::bigint as total_ms,
           count(*) filter (where hints = 0)::int as hintless
      from entries group by user_id
  ),
  ranked as (
    select (rank() over (order by a.score desc, a.total_ms asc))::int as rank, a.*
      from agg a
  )
  select r.rank, pr.nickname, pr.avatar, r.score, r.solves, r.total_ms, r.hintless, r.user_id = auth.uid()
    from ranked r join public.profiles pr on pr.id = r.user_id
   where r.rank <= p_limit or r.user_id = auth.uid()
   order by r.rank, pr.nickname
$$;

create function public.contest_stats(p_today date default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_today, (now() at time zone 'utc')::date) as today),
  today_plays as (
    select p.* from public.plays p, d where p.mode = 'daily' and p.puzzle_date = d.today
  ),
  daily_totals as (
    select p.puzzle_date, p.user_id, sum(p.score) as score, sum(p.duration_ms) as ms
      from public.plays p where p.contest group by 1, 2
  ),
  winners as (
    select distinct on (puzzle_date) puzzle_date, user_id
      from daily_totals order by puzzle_date, score desc, ms asc
  )
  select jsonb_build_object(
    'today', (
      select jsonb_build_object(
        'players', count(distinct user_id),
        'solves',  count(*) filter (where contest),
        'avgScore', coalesce(round(avg(score) filter (where contest)), 0),
        'hintFreePct', coalesce(round(100.0 * count(*) filter (where contest and hints = 0) / nullif(count(*) filter (where contest), 0)), 0)
      ) from today_plays),
    'games', (
      select coalesce(jsonb_agg(g order by g->>'game'), '[]'::jsonb) from (
        select jsonb_build_object(
          'game', tp.game_id,
          'started', count(*),
          'solved', count(*) filter (where tp.status = 'solved'),
          'avgMs', round(avg(tp.duration_ms) filter (where tp.contest)),
          'hintPct', coalesce(round(100.0 * count(*) filter (where tp.contest and tp.hints > 0) / nullif(count(*) filter (where tp.contest), 0)), 0),
          'best', (
            select jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar, 'ms', b.duration_ms, 'difficulty', b.difficulty, 'score', b.score)
              from today_plays b join public.profiles pr on pr.id = b.user_id
             where b.contest and b.game_id = tp.game_id
             order by b.score desc, b.duration_ms asc limit 1)
        ) as g
        from today_plays tp group by tp.game_id
      ) x),
    'trend', (
      select jsonb_agg(jsonb_build_object('date', day::date, 'players', coalesce(t.players, 0), 'solves', coalesce(t.solves, 0)) order by day)
        from d, generate_series(d.today - 13, d.today, interval '1 day') as day
        left join (
          select puzzle_date, count(distinct user_id) as players, count(*) as solves
            from public.plays where contest group by puzzle_date
        ) t on t.puzzle_date = day::date),
    'difficulty', (
      select jsonb_build_object(
        'easy', count(*) filter (where difficulty = 'easy'),
        'normal', count(*) filter (where difficulty = 'normal'),
        'hard', count(*) filter (where difficulty = 'hard'))
        from public.plays p, d where p.contest and p.puzzle_date between d.today - 6 and d.today),
    'champions', (
      select coalesce(jsonb_agg(c order by (c->>'wins')::int desc, c->>'nickname'), '[]'::jsonb) from (
        select jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar, 'wins', count(*), 'isMe', w.user_id = auth.uid()) as c
          from winners w join public.profiles pr on pr.id = w.user_id
         group by pr.nickname, pr.avatar, w.user_id
         order by count(*) desc limit 5) y),
    'streaks', (
      select coalesce(jsonb_agg(s order by (s->>'current')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar, 'current', max(st.current), 'longest', max(st.longest), 'isMe', st.user_id = auth.uid()) as s
          from public.streaks st join public.profiles pr on pr.id = st.user_id
         where st.current > 0
         group by st.user_id, pr.nickname, pr.avatar
         order by max(st.current) desc, max(st.longest) desc limit 5) z)
  )
$$;

create function public.my_stats(p_today date default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_today, (now() at time zone 'utc')::date) as today),
  mine as (select * from public.plays where user_id = auth.uid() and status = 'solved')
  select case when auth.uid() is null then null else jsonb_build_object(
    'nickname', (select nickname from public.profiles where id = auth.uid()),
    'avatar',   (select avatar from public.profiles where id = auth.uid()),
    'personalScore', coalesce((select sum(score) from mine), 0),
    'contestScore',  coalesce((select sum(score) from mine where contest), 0),
    'solves',        (select count(*) from mine),
    'contestSolves', (select count(*) from mine where contest),
    'practiceSolves',(select count(*) from mine where mode <> 'daily'),
    'hintFree',      (select count(*) from mine where hints = 0),
    'days',          (select count(distinct puzzle_date) from mine where contest),
    'wins', (
      select count(*) from (
        select distinct on (puzzle_date) puzzle_date, user_id
          from (select puzzle_date, user_id, sum(score) s, sum(duration_ms) ms from public.plays where contest group by 1, 2) t
         order by puzzle_date, s desc, ms asc) w
       where w.user_id = auth.uid()),
    'games', (
      select coalesce(jsonb_agg(g), '[]'::jsonb) from (
        select jsonb_build_object('game', game_id, 'solves', count(*), 'score', sum(score),
                                  'bestMs', min(duration_ms), 'avgScore', round(avg(score))) as g
          from mine group by game_id) x),
    'trend', (
      select jsonb_agg(jsonb_build_object('date', day::date, 'score', coalesce(t.score, 0), 'contest', coalesce(t.contest, 0)) order by day)
        from d, generate_series(d.today - 13, d.today, interval '1 day') as day
        left join (
          select coalesce(puzzle_date, (completed_at at time zone 'utc')::date) as day2,
                 sum(score) as score, sum(score) filter (where contest) as contest
            from mine group by 1
        ) t on t.day2 = day::date),
    'streak', (select coalesce(max(current), 0) from public.streaks where user_id = auth.uid()),
    'hasEmail', (select email is not null and email <> '' from auth.users where id = auth.uid())
  ) end
$$;

revoke all on function public.leaderboard(text, date, public.game_id, integer) from public;
revoke all on function public.contest_stats(date) from public;
revoke all on function public.my_stats(date) from public;
revoke all on function public.make_transfer_code() from public;
revoke all on function public.claim_transfer_code(text) from public;
revoke all on function public.random_nickname() from public, anon, authenticated;
grant execute on function public.leaderboard(text, date, public.game_id, integer) to anon, authenticated;
grant execute on function public.contest_stats(date) to anon, authenticated;
grant execute on function public.my_stats(date) to authenticated;
grant execute on function public.make_transfer_code() to authenticated;
grant execute on function public.claim_transfer_code(text) to authenticated;

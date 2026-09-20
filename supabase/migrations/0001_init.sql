-- Puzzle Break — initial schema.
-- Postgres stores results, identities and social graph. Never puzzles:
-- a seed fully describes a board, so a row is a seed plus a time.

create type public.game_id     as enum ('nine', 'crowns', 'eclipse', 'thread', 'quilt');
create type public.difficulty  as enum ('easy', 'normal', 'hard');
create type public.play_mode   as enum ('daily', 'practice', 'challenge');
create type public.play_status as enum ('in_progress', 'solved', 'abandoned');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  is_anonymous boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Every auth user (anonymous included) gets a profile row the moment it exists,
-- so linking an email later upgrades the row in place — nothing migrates.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, is_anonymous)
  values (new.id, coalesce(new.is_anonymous, false));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set is_anonymous = coalesce(new.is_anonymous, false) where id = new.id;
  return new;
end $$;

create trigger on_auth_user_updated
  after update of is_anonymous on auth.users
  for each row execute function public.handle_user_updated();

-- ------------------------------------------------------------------- plays
create table public.plays (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  game_id      public.game_id not null,
  seed         text not null,
  difficulty   public.difficulty not null,
  mode         public.play_mode not null,
  -- The player's LOCAL date, captured when the puzzle is started and frozen.
  -- Crossing midnight mid-solve keeps the day you began.
  puzzle_date  date,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms  integer check (duration_ms is null or duration_ms >= 0),
  mistakes     integer not null default 0,
  status       public.play_status not null default 'in_progress',
  -- Resume snapshot: grid, notes, undo stack, elapsed. Shape is the client's.
  state        jsonb,
  move_log     jsonb,
  -- Set only by server-side validation (edge function with service role).
  validated    boolean not null default false,
  updated_at   timestamptz not null default now(),
  unique (user_id, seed),
  check (mode <> 'daily' or puzzle_date is not null)
);

create index plays_user_game_date_idx on public.plays (user_id, game_id, puzzle_date desc);
create index plays_seed_idx on public.plays (seed) where status = 'solved';

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger plays_touch_updated_at
  before update on public.plays
  for each row execute function public.touch_updated_at();

-- Clients can never flip `validated`; only the service role may.
create function public.guard_validated() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.validated := false;
    else
      new.validated := old.validated;
    end if;
  end if;
  return new;
end $$;

create trigger plays_guard_validated
  before insert or update on public.plays
  for each row execute function public.guard_validated();

-- ----------------------------------------------------------------- streaks
create table public.streaks (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  game_id          public.game_id not null,
  current          integer not null default 0,
  longest          integer not null default 0,
  last_solved_date date,
  primary key (user_id, game_id)
);

-- Maintained here, never computed client-side. A daily solve on any
-- difficulty extends the streak for that game; solving an older day
-- (archive) never changes `current`.
create function public.apply_streak() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.streaks%rowtype;
  next_current integer;
begin
  if new.status <> 'solved' or new.mode <> 'daily' or new.puzzle_date is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'solved' then
    return new; -- already counted
  end if;

  select * into s from public.streaks where user_id = new.user_id and game_id = new.game_id;

  if not found then
    insert into public.streaks (user_id, game_id, current, longest, last_solved_date)
    values (new.user_id, new.game_id, 1, 1, new.puzzle_date);
    return new;
  end if;

  if s.last_solved_date is null then
    next_current := 1;
  elsif new.puzzle_date = s.last_solved_date then
    next_current := s.current;                  -- another difficulty, same day
  elsif new.puzzle_date = s.last_solved_date + 1 then
    next_current := s.current + 1;              -- consecutive day
  elsif new.puzzle_date < s.last_solved_date then
    next_current := s.current;                  -- archive: no change
  else
    next_current := 1;                          -- gap: restart
  end if;

  update public.streaks
     set current = next_current,
         longest = greatest(s.longest, next_current),
         last_solved_date = greatest(s.last_solved_date, new.puzzle_date)
   where user_id = new.user_id and game_id = new.game_id;

  return new;
end $$;

create trigger plays_apply_streak
  after insert or update of status on public.plays
  for each row execute function public.apply_streak();

-- -------------------------------------------------------------- challenges
create table public.challenges (
  id         uuid primary key default gen_random_uuid(),
  seed       text not null,
  game_id    public.game_id not null,
  difficulty public.difficulty not null,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.challenge_entries (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  play_id      uuid not null references public.plays (id) on delete cascade,
  duration_ms  integer not null check (duration_ms >= 0),
  created_at   timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

-- --------------------------------------------------------------------- RLS
alter table public.profiles          enable row level security;
alter table public.plays             enable row level security;
alter table public.streaks           enable row level security;
alter table public.challenges        enable row level security;
alter table public.challenge_entries enable row level security;

create policy "profiles: read own"   on public.profiles for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "plays: read own"   on public.plays for select using (user_id = auth.uid());
create policy "plays: insert own" on public.plays for insert with check (user_id = auth.uid());
create policy "plays: update own" on public.plays for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "plays: delete own" on public.plays for delete using (user_id = auth.uid());

-- streaks: readable by owner; written only by the security-definer trigger.
create policy "streaks: read own" on public.streaks for select using (user_id = auth.uid());

-- challenges: anyone signed in can read one (the link is the invitation).
create policy "challenges: read"       on public.challenges for select using (auth.uid() is not null);
create policy "challenges: create own" on public.challenges for insert with check (creator_id = auth.uid());

create policy "entries: read"       on public.challenge_entries for select using (auth.uid() is not null);
create policy "entries: insert own" on public.challenge_entries for insert with check (user_id = auth.uid());

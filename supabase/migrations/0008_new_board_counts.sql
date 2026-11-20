-- Puzzle Break — a better score comes from a NEW board, never from replaying one.
--
-- Noam's rule (2026-11-19): "if someone wants to improve the score he plays a
-- new board, the play again cannot count for the contest, it is not fair."
--
-- * The first solve of any board is the one that scores. Try again on the
--   same board no longer changes its points or contest entry.
-- * A new (practice) board now carries the day it was started in
--   puzzle_date, and its first solve can enter that day's contest. The
--   leaderboards already take each player's best eligible board per game per
--   day, so the best of today's daily board and the new boards counts.

create or replace function public.score_play_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  min_ms integer := case new.game_id when 'nine' then 45000 else 5000 end;
  utc_day date := (now() at time zone 'utc')::date;
  attempt_score integer;
  eligible boolean;
  is_new_solve boolean;
begin
  if current_setting('pb.merging', true) = 'on' then return new; end if;

  -- Who the board is never changes, and nothing a client sends can set the bests.
  if tg_op = 'UPDATE' then
    new.puzzle_date := old.puzzle_date; new.mode := old.mode;
    new.game_id := old.game_id;         new.difficulty := old.difficulty; new.seed := old.seed;
    new.score := old.score;   new.best_ms := old.best_ms;   new.best_hints := old.best_hints;
    new.attempts := old.attempts; new.contest := old.contest;
    new.last_solved_at := old.last_solved_at;
  else
    new.score := null; new.best_ms := null; new.best_hints := null;
    new.attempts := 0; new.contest := false; new.last_solved_at := null;
  end if;

  if new.status <> 'solved' then
    if tg_op = 'UPDATE' and old.status <> 'solved' then
      -- Within one attempt, assists only go up.
      new.hints := greatest(new.hints, old.hints);
      new.fills := greatest(new.fills, old.fills);
      new.mistakes := greatest(new.mistakes, old.mistakes);
    end if;
    return new;  -- an attempt under way (or a fresh restart after a solve)
  end if;

  new.completed_at := coalesce(new.completed_at, now());
  is_new_solve := tg_op = 'INSERT'
    or old.status <> 'solved'
    or new.completed_at is distinct from old.completed_at;

  if not is_new_solve then
    -- The same solved attempt syncing again: keep what was recorded.
    new.duration_ms := old.duration_ms; new.mistakes := old.mistakes;
    new.hints := old.hints; new.fills := old.fills; new.completed_at := old.completed_at;
    return new;
  end if;

  attempt_score := public.score_play(new.game_id, new.difficulty, new.duration_ms, new.hints, new.mistakes, new.fills);
  -- Any board's FIRST solve can enter the contest for the day it was
  -- started: today's daily board or a new board played that day.
  eligible := new.attempts = 0
    and new.puzzle_date between utc_day - 2 and utc_day + 1
    and coalesce(new.duration_ms, 0) >= min_ms;

  -- Only the first solve of a board scores. Replaying the same board (Try
  -- again) is practice: it is counted as a try but changes nothing.
  if new.attempts = 0 then
    new.score := attempt_score;
    new.best_ms := new.duration_ms;
    new.best_hints := new.hints;
    new.contest := eligible;
  end if;
  new.attempts := new.attempts + 1;
  new.last_solved_at := new.completed_at;
  return new;
end $$;

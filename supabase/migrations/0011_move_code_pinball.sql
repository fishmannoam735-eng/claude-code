-- A move code now carries pinball high scores to the new phone too (Noam approved 2026-11-19).
create or replace function public.claim_transfer_code(code text) returns text
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
  -- One contest entry per game per day: the old phone's entry wins.
  update public.plays m set contest = false
   where m.user_id = me and m.contest and exists (
     select 1 from public.plays o where o.user_id = old.id and o.contest
        and o.game_id = m.game_id and o.puzzle_date = m.puzzle_date);
  update public.plays o set user_id = me
   where o.user_id = old.id
     and not exists (select 1 from public.plays m where m.user_id = me and m.seed = o.seed);
  update public.plays set contest = false where user_id = old.id;
  update public.streaks o set user_id = me
   where o.user_id = old.id
     and not exists (select 1 from public.streaks m where m.user_id = me and m.game_id = o.game_id);
  update public.challenges set creator_id = me where creator_id = old.id;
  update public.pinball_scores set user_id = me where user_id = old.id;
  perform set_config('pb.merging', 'off', true);

  update public.profiles set nickname = null, transfer_hash = null where id = old.id;
  update public.profiles set nickname = old.nickname, avatar = old.avatar where id = me;
  return old.nickname;
end $$;

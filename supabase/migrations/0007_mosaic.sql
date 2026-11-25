-- Mosaic (picture logic) joins the set. Its scoring uses score_play's default
-- pars (60/150/300 s, the same as Quilt and Bridges) and the default 5 s floor,
-- so the only change the database needs is the new game id.
alter type public.game_id add value if not exists 'mosaic';

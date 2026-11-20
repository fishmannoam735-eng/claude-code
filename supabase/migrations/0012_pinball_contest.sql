-- Pinball joins the contest (Noam, 2026-11-20: "enter the pinball score to the
-- contest, normalize the pinball score somehow, i.e. level, score").
--
-- Contest points for a pinball game, on the same scale as a puzzle board:
--   level base (easy 100, normal 200, hard 300, as for puzzles)
--   x sqrt(score / par), kept between 0.1 and 1.5 (puzzles' speed factor is 0.5..1.5)
--   par = a good game on that level: easy 1,000,000, normal 700,000, hard 400,000.
-- So a par game on Hard is worth 300, a great one up to 450 (a perfect hard puzzle),
-- and four times par is needed for double the points.
--
-- Every pinball game is a fresh game (no replays), so each game is eligible;
-- like any game, one entry per player per day counts: the best one.
-- The entry lives in plays as game 'pinball', mode 'daily' (one row per day and
-- level, keeping the best points), so rankings, stats and streaks pick it up.

alter type public.game_id add value if not exists 'pinball';

-- AGI games (agi1.app/games, 2026-10-19: the owner's game, Ride 'Em, AGI!, "theres also a rating stars and how many people
-- have played it, dont need sign in a wallet to play it", "if they want to rate it and review and put a comment they need to
-- sign in wallet signature only not transaction. but on how many times played it will still be recorded no need sign in on
-- that one"). Run this once in the Supabase project that SUPABASE_URL points to, any time, **before pushing the games**:
-- SQL Editor → New query → paste all of it → Run. It ends by showing arcade_functions_found = 8. Until it's run, the games
-- still play, nothing is counted, and agi1.app/games shows no numbers and no reviews.
-- It only ADDS five new tables and eight functions (all named agi1_arcade… / arcade_…). It doesn't touch any table the
-- original site uses (and not her Telegram quizzes' agi1_game… tables), so it's safe in the database both sites share.
-- Running it again changes nothing that's saved.
--
-- What's kept, and why:
--   agi1_arcade_games        per game: how many runs were started (plays) and by how many browsers (players)
--   agi1_arcade_players      per game, one row per browser that played it: a scrambled code of the random id that browser
--                            keeps for the games (an HMAC made by our server, a different one per game: never the id
--                            itself, never who), the first and last day it played, and its plays. Only so a browser that
--                            plays again isn't counted as a new player
--   agi1_arcade_days         today's and yesterday's counts for the daily limits: one row per visitor (a code of their
--                            internet address that changes every day, made by our server: never the address) and one for
--                            the whole site. Older rows are deleted as new plays come in
--   agi1_arcade_reviews      one rating per wallet and game: its stars (1 to 5), the words they wrote (if any, up to 300
--                            characters), the name they chose to show (if any), their level then (for her 💜 badge), when;
--                            filed under a scrambled code of the wallet (an HMAC made by our server, not the code her
--                            chat's memory or her burns use), never the address. Saving again changes it; they can delete it
--   agi1_arcade_review_days  today's and yesterday's review saves, for the daily limits: per wallet code, per visitor code
--                            and for the whole site. Older rows are deleted as new saves come in
-- Only the server (the secret key) can use these tables. The owner hides a review with arcade_review_hide (at the end).

create table if not exists public.agi1_arcade_games (
  game     text        primary key check (game ~ '^[a-z0-9]{2,24}$'),
  plays    bigint      not null default 0 check (plays >= 0),
  players  bigint      not null default 0 check (players >= 0),
  updated  timestamptz not null default now()
);

create table if not exists public.agi1_arcade_players (
  game      text    not null check (game ~ '^[a-z0-9]{2,24}$'),
  player    text    not null check (player ~ '^[A-Za-z0-9_-]{16,64}$'),
  first_day date    not null default ((now() at time zone 'utc')::date),
  last_day  date    not null default ((now() at time zone 'utc')::date),
  plays     bigint  not null default 0 check (plays >= 0),
  primary key (game, player)
);

create table if not exists public.agi1_arcade_days (
  day     date    not null,
  who     text    not null check (char_length(who) between 4 and 64),   -- a visitor's daily code, or 'site'
  plays   integer not null default 0 check (plays >= 0),
  players integer not null default 0 check (players >= 0),
  primary key (day, who)
);

create table if not exists public.agi1_arcade_reviews (
  id      bigint      generated always as identity primary key,
  game    text        not null check (game ~ '^[a-z0-9]{2,24}$'),
  wallet  text        not null check (wallet ~ '^[A-Za-z0-9_-]{16,64}$'),
  stars   smallint    not null check (stars between 1 and 5),
  body    text        not null default '' check (char_length(body) <= 300 and body !~ '[[:cntrl:]]'),
  name    text        check (name is null or (char_length(name) between 1 and 24 and name !~ '[[:cntrl:]]')),
  level   smallint    not null default 1 check (level between 1 and 3),
  created timestamptz not null default now(),
  updated timestamptz not null default now(),
  hidden  boolean     not null default false,
  unique (game, wallet)
);
-- (the page's list: a game's shown reviews with words, newest first)
create index if not exists agi1_arcade_reviews_list on public.agi1_arcade_reviews (game, id desc) where not hidden and body <> '';

create table if not exists public.agi1_arcade_review_days (
  day date    not null,
  who text    not null check (char_length(who) between 4 and 70),       -- 'w:' a wallet's code, 'v:' a visitor's, or 'site'
  n   integer not null default 0 check (n >= 0),
  primary key (day, who)
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_arcade_games enable row level security;
alter table public.agi1_arcade_players enable row level security;
alter table public.agi1_arcade_days enable row level security;
alter table public.agi1_arcade_reviews enable row level security;
alter table public.agi1_arcade_review_days enable row level security;
revoke all on table public.agi1_arcade_games from anon, authenticated;
revoke all on table public.agi1_arcade_players from anon, authenticated;
revoke all on table public.agi1_arcade_days from anon, authenticated;
revoke all on table public.agi1_arcade_reviews from anon, authenticated;
revoke all on table public.agi1_arcade_review_days from anon, authenticated;

-- Runs started (our server checked the game and made the codes first). p_game: a game's id · p_player: the scrambled code
-- of the browser's id for this game · p_who: the visitor's code for today · p_plays: runs started since the last report
-- (1 to 50) · p_player_daily / p_plays_daily: new players and plays a day for one visitor · p_site_players /
-- p_site_plays: the same for the whole site. Every try counts toward the day's limits.
-- → {"ok": true, "new": true | false} (new: a player this game hadn't seen) or {"ok": false, "why": "bad" | "person_cap" |
--   "site_cap"} (then nothing is added to the game)
create or replace function public.arcade_play(p_game text, p_player text, p_who text, p_plays integer,
  p_player_daily integer, p_plays_daily integer, p_site_players integer, p_site_plays integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  d     date := (now() at time zone 'utc')::date;
  n     integer;
  fresh boolean;
begin
  if p_game is null or p_game !~ '^[a-z0-9]{2,24}$'
     or p_player is null or p_player !~ '^[A-Za-z0-9_-]{16,64}$'
     or p_who is null or char_length(p_who) not between 16 and 64 or p_who = 'site'
     or p_plays is null or p_plays not between 1 and 50
     or p_player_daily is null or p_player_daily not between 1 and 100000
     or p_plays_daily is null or p_plays_daily not between 1 and 1000000
     or p_site_players is null or p_site_players not between 1 and 10000000
     or p_site_plays is null or p_site_plays not between 1 and 100000000 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  -- counts older than yesterday aren't needed any more
  delete from agi1_arcade_days where day < d - 1;
  -- the site's plays first, then the visitor's (always in this order, so two reports never wait for each other in a circle)
  insert into agi1_arcade_days as c (day, who, plays) values (d, 'site', p_plays)
  on conflict (day, who) do update set plays = c.plays + excluded.plays
  returning c.plays into n;
  if n > p_site_plays then return json_build_object('ok', false, 'why', 'site_cap'); end if;
  insert into agi1_arcade_days as c (day, who, plays) values (d, p_who, p_plays)
  on conflict (day, who) do update set plays = c.plays + excluded.plays
  returning c.plays into n;
  if n > p_plays_daily then return json_build_object('ok', false, 'why', 'person_cap'); end if;
  -- a browser this game hasn't seen: one more player, within the day's limits (the site's first, then the visitor's)
  if not exists (select 1 from agi1_arcade_players where game = p_game and player = p_player) then
    insert into agi1_arcade_days as c (day, who, players) values (d, 'site', 1)
    on conflict (day, who) do update set players = c.players + 1
    returning c.players into n;
    if n > p_site_players then return json_build_object('ok', false, 'why', 'site_cap'); end if;
    insert into agi1_arcade_days as c (day, who, players) values (d, p_who, 1)
    on conflict (day, who) do update set players = c.players + 1
    returning c.players into n;
    if n > p_player_daily then return json_build_object('ok', false, 'why', 'person_cap'); end if;
  end if;
  -- (two first reports of the same browser at once: only one of them inserts its row, so it's one player)
  insert into agi1_arcade_players as p (game, player, first_day, last_day, plays) values (p_game, p_player, d, d, p_plays)
  on conflict (game, player) do update set plays = p.plays + excluded.plays, last_day = d
  returning (xmax = 0) into fresh;
  insert into agi1_arcade_games as g (game, plays, players, updated)
  values (p_game, p_plays, case when fresh then 1 else 0 end, now())
  on conflict (game) do update set plays = g.plays + excluded.plays, players = g.players + excluded.players, updated = now();
  return json_build_object('ok', true, 'new', fresh);
end;
$$;

-- A game's numbers for its page. → {"plays", "players", "ratings", "sum", "s1" … "s5"} (ratings: shown ratings, with or
-- without words; sum: their stars added up; s1 … s5: how many of each)
create or replace function public.arcade_stats(p_game text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'plays', coalesce((select g.plays from agi1_arcade_games g where g.game = p_game), 0),
    'players', coalesce((select g.players from agi1_arcade_games g where g.game = p_game), 0),
    'ratings', count(*),
    'sum', coalesce(sum(r.stars), 0),
    's1', count(*) filter (where r.stars = 1),
    's2', count(*) filter (where r.stars = 2),
    's3', count(*) filter (where r.stars = 3),
    's4', count(*) filter (where r.stars = 4),
    's5', count(*) filter (where r.stars = 5))
  from agi1_arcade_reviews r
  where r.game = p_game and not r.hidden;
$$;

-- A page of a game's shown reviews with words, newest first: those older than p_before (a review's id; null: the newest),
-- at most p_limit (1 to 51). → [{"id", "stars", "body", "name", "level", "created", "updated"}] (never the wallet's code)
create or replace function public.arcade_reviews(p_game text, p_before bigint, p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', x.id, 'stars', x.stars, 'body', x.body, 'name', x.name, 'level', x.level,
    'created', x.created, 'updated', x.updated) order by x.id desc), '[]'::json)
  from (
    select r.id, r.stars, r.body, r.name, r.level, r.created, r.updated
    from agi1_arcade_reviews r
    where r.game = p_game and not r.hidden and r.body <> '' and (p_before is null or r.id < p_before)
    order by r.id desc
    limit greatest(1, least(coalesce(p_limit, 10), 51))
  ) x;
$$;

-- One review save, counted before our server asks the AI to look at its words (so nobody can make it look forever):
-- p_wallet: the wallet's code · p_who: the visitor's code for today · p_per_day: saves a day per wallet and per visitor ·
-- p_site_daily: for the whole site. Every try counts. → 'ok' | 'person_cap' | 'site_cap' | 'bad'
create or replace function public.arcade_review_take(p_wallet text, p_who text, p_per_day integer, p_site_daily integer)
returns text
language plpgsql
set search_path = public
as $$
declare
  d date := (now() at time zone 'utc')::date;
  n integer;
begin
  if p_wallet is null or p_wallet !~ '^[A-Za-z0-9_-]{16,64}$'
     or p_who is null or char_length(p_who) not between 16 and 64 or p_who = 'site'
     or p_per_day is null or p_per_day not between 1 and 1000
     or p_site_daily is null or p_site_daily not between 1 and 1000000 then
    return 'bad';
  end if;
  delete from agi1_arcade_review_days where day < d - 1;
  -- the site's first, then the wallet's, then the visitor's (always in this order)
  insert into agi1_arcade_review_days as c (day, who, n) values (d, 'site', 1)
  on conflict (day, who) do update set n = c.n + 1
  returning c.n into n;
  if n > p_site_daily then return 'site_cap'; end if;
  insert into agi1_arcade_review_days as c (day, who, n) values (d, 'w:' || p_wallet, 1)
  on conflict (day, who) do update set n = c.n + 1
  returning c.n into n;
  if n > p_per_day then return 'person_cap'; end if;
  insert into agi1_arcade_review_days as c (day, who, n) values (d, 'v:' || p_who, 1)
  on conflict (day, who) do update set n = c.n + 1
  returning c.n into n;
  if n > p_per_day then return 'person_cap'; end if;
  return 'ok';
end;
$$;

-- A wallet's rating of a game, saved (our server checked everything first, the AI looked at its words): a new one, or the
-- one it had changed (a review the owner hid stays hidden). p_body: '' for stars alone · p_name: null to show "A player".
-- → {"ok": true, "id", "created": true | false} or {"ok": false, "why": "bad"}
create or replace function public.arcade_review_put(p_game text, p_wallet text, p_stars integer, p_body text, p_name text, p_level integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  rid   bigint;
  fresh boolean;
begin
  if p_game is null or p_game !~ '^[a-z0-9]{2,24}$'
     or p_wallet is null or p_wallet !~ '^[A-Za-z0-9_-]{16,64}$'
     or p_stars is null or p_stars not between 1 and 5
     or p_body is null or char_length(p_body) > 300 or p_body ~ '[[:cntrl:]]' or p_body <> btrim(p_body)
     or (p_name is not null and (char_length(p_name) not between 1 and 24 or p_name ~ '[[:cntrl:]]' or p_name <> btrim(p_name)))
     or p_level is null or p_level not between 1 and 3 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_arcade_reviews as r (game, wallet, stars, body, name, level)
  values (p_game, p_wallet, p_stars, p_body, p_name, p_level)
  on conflict (game, wallet) do update
    set stars = excluded.stars, body = excluded.body, name = excluded.name, level = excluded.level, updated = now()
  returning r.id, (xmax = 0) into rid, fresh;
  return json_build_object('ok', true, 'id', rid, 'created', fresh);
end;
$$;

-- A wallet's own rating of a game (shown to it even when hidden, with "hidden"). → the review, or null
create or replace function public.arcade_review_mine(p_game text, p_wallet text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('id', r.id, 'stars', r.stars, 'body', r.body, 'name', r.name, 'level', r.level,
    'created', r.created, 'updated', r.updated, 'hidden', r.hidden)
  from agi1_arcade_reviews r
  where r.game = p_game and r.wallet = p_wallet;
$$;

-- A wallet deletes its rating of a game. → {"ok": true, "removed": true | false}
create or replace function public.arcade_review_delete(p_game text, p_wallet text)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_game is null or p_wallet is null then return json_build_object('ok', true, 'removed', false); end if;
  delete from agi1_arcade_reviews where game = p_game and wallet = p_wallet;
  return json_build_object('ok', true, 'removed', found);
end;
$$;

-- The owner's tool (run it here, in the SQL Editor): hide a review from the page (true), or show it again (false). Its id is
-- in Table Editor → agi1_arcade_reviews. → true when there was such a review
--   select arcade_review_hide(123, true);
create or replace function public.arcade_review_hide(p_id bigint, p_hidden boolean)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  update agi1_arcade_reviews set hidden = coalesce(p_hidden, true) where id = p_id;
  return found;
end;
$$;

-- Only the server's secret key may call them (and the owner, here in the SQL Editor).
revoke all on function public.arcade_play(text, text, text, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.arcade_stats(text) from public, anon, authenticated;
revoke all on function public.arcade_reviews(text, bigint, integer) from public, anon, authenticated;
revoke all on function public.arcade_review_take(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.arcade_review_put(text, text, integer, text, text, integer) from public, anon, authenticated;
revoke all on function public.arcade_review_mine(text, text) from public, anon, authenticated;
revoke all on function public.arcade_review_delete(text, text) from public, anon, authenticated;
revoke all on function public.arcade_review_hide(bigint, boolean) from public, anon, authenticated;
grant execute on function public.arcade_play(text, text, text, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.arcade_stats(text) to service_role;
grant execute on function public.arcade_reviews(text, bigint, integer) to service_role;
grant execute on function public.arcade_review_take(text, text, integer, integer) to service_role;
grant execute on function public.arcade_review_put(text, text, integer, text, text, integer) to service_role;
grant execute on function public.arcade_review_mine(text, text) to service_role;
grant execute on function public.arcade_review_delete(text, text) to service_role;
grant execute on function public.arcade_review_hide(bigint, boolean) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show arcade_functions_found = 8.
select count(*) as arcade_functions_found from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('arcade_play', 'arcade_stats', 'arcade_reviews', 'arcade_review_take', 'arcade_review_put',
                  'arcade_review_mine', 'arcade_review_delete', 'arcade_review_hide');

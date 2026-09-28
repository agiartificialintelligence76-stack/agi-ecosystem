-- $AGI "The Arena" (the ClankeRRankeR): one vote per visitor per 5-minute round, and a champion for every round.
-- Run this in the Supabase project that SUPABASE_URL points to: SQL Editor → New query → paste → Run.
-- Running it again is safe and keeps every vote and champion (Phase 4 added the Hall of Fame and round history:
-- run it again once after that update). Supabase may warn about a "destructive operation": that's the line that
-- replaces the old arena_state function, no data is deleted.
-- Visitors are stored only as a scrambled code made from their IP that changes every day (like the chat).
-- Real IP addresses are never stored. Only the server (secret key) can use any of this.

-- Who voted in which round. The primary key is what makes it "one vote per round".
create table if not exists public.arena_votes (
  round bigint      not null,                -- round number = time since 1970 in 5-minute steps (the server decides it)
  who   text        not null,                -- the visitor's daily code
  coin  text        not null,                -- ticker, e.g. 'AGI'
  at    timestamptz not null default now(),
  primary key (round, who)
);

-- Votes per coin per round (kept forever: tiny, and it's the history).
create table if not exists public.arena_tally (
  round   bigint      not null,
  coin    text        not null,
  votes   integer     not null default 0,
  last_at timestamptz not null default now(),  -- when its last vote came in (breaks ties)
  primary key (round, coin)
);

-- One champion per finished round: the Hall of Fame.
create table if not exists public.arena_champions (
  round      bigint      primary key,
  coin       text        not null,
  votes      integer     not null,
  crowned_at timestamptz not null default now()
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.arena_votes enable row level security;
alter table public.arena_tally enable row level security;
alter table public.arena_champions enable row level security;
revoke all on table public.arena_votes, public.arena_tally, public.arena_champions from anon, authenticated;

-- Cast a vote in one atomic step. Answers 'ok', 'already' (this visitor already voted this round) or 'bad_coin'.
create or replace function public.arena_vote(p_round bigint, p_who text, p_coin text, p_coins text[])
returns text
language plpgsql
set search_path = public
as $$
declare
  added integer;
begin
  if p_coin is null or not (p_coin = any(p_coins)) then return 'bad_coin'; end if;

  insert into arena_votes (round, who, coin) values (p_round, p_who, p_coin)
  on conflict (round, who) do nothing;
  get diagnostics added = row_count;
  if added = 0 then return 'already'; end if;

  insert into arena_tally (round, coin, votes, last_at) values (p_round, p_coin, 1, now())
  on conflict (round, coin) do update set votes = arena_tally.votes + 1, last_at = now();

  -- Tidy up: forget who voted after about 2 days (576 rounds). Tallies and champions stay. Runs on ~2% of votes.
  if random() < 0.02 then
    delete from arena_votes where round < p_round - 576;
  end if;
  return 'ok';
end;
$$;

-- Everything the page shows: this round's votes, the latest champions, all-time crowns and this week's crowns.
-- First it crowns every finished round (up to a week back) that has votes but no champion yet:
-- most votes wins; a tie goes to the coin that reached that score first.
-- p_week_start = the first round of this week (Monday 00:00 UTC), worked out by the server.
drop function if exists public.arena_state(bigint, integer);          -- the version from before Phase 4
create or replace function public.arena_state(p_round bigint, p_recent integer default 12, p_week_start bigint default null)
returns json
language plpgsql
set search_path = public
as $$
begin
  insert into arena_champions (round, coin, votes)
  select distinct on (t.round) t.round, t.coin, t.votes
  from arena_tally t
  where t.round < p_round
    and t.round >= p_round - 2016
    and t.votes > 0
    and not exists (select 1 from arena_champions c where c.round = t.round)
  order by t.round, t.votes desc, t.last_at asc, t.coin
  on conflict (round) do nothing;

  return json_build_object(
    'tally', coalesce((select json_object_agg(coin, votes) from arena_tally where round = p_round), '{}'::json),
    'recent', coalesce((select json_agg(r order by r.round desc) from (
        select round, coin, votes from arena_champions order by round desc limit greatest(0, least(p_recent, 48))) r), '[]'::json),
    'crowns', coalesce((select json_object_agg(coin, n) from (
        select coin, count(*) as n from arena_champions group by coin) c), '{}'::json),
    'week', coalesce((select json_object_agg(coin, n) from (
        select coin, count(*) as n from arena_champions
        where p_week_start is not null and round >= p_week_start and round < p_round group by coin) w), '{}'::json)
  );
end;
$$;

-- Round history: champions of the rounds before p_before, newest first (the "Show older rounds" button).
create or replace function public.arena_history(p_before bigint, p_limit integer default 24)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(r order by r.round desc), '[]'::json) from (
    select round, coin, votes from arena_champions
    where round < p_before
    order by round desc
    limit greatest(1, least(coalesce(p_limit, 24), 96))
  ) r;
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.arena_vote(bigint, text, text, text[]) from public, anon, authenticated;
revoke all on function public.arena_state(bigint, integer, bigint) from public, anon, authenticated;
revoke all on function public.arena_history(bigint, integer) from public, anon, authenticated;
grant execute on function public.arena_vote(bigint, text, text, text[]) to service_role;
grant execute on function public.arena_state(bigint, integer, bigint) to service_role;
grant execute on function public.arena_history(bigint, integer) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show arena_functions_found = 3.
select count(*) as arena_functions_found from pg_proc
where pronamespace = 'public'::regnamespace and proname in ('arena_vote', 'arena_state', 'arena_history');

-- Community votes (agi1.app/vote, 2026-10-24: the roadmap's "Gamified governance"). The polls (agi_polls: made and
-- changed by the owner at agi1.app/vote/owner, their rules in src/vote/polls.js) and who-picked-what (agi_votes, under
-- a scrambled code).
-- Run this once in the Supabase project that SUPABASE_URL points to: SQL Editor -> New query -> paste -> Run.
-- Safe to run again (it changes nothing that's there).
--
-- One row per wallet and poll (voting again changes it, until the vote closes):
--   who     a scrambled code of the wallet (HMAC with PASS_SECRET, server/vote.js), never its address
--   weight  the whole $AGI it held when it last voted
--   sealed  its address, encrypted with PASS_SECRET (AES-256-GCM), ONLY so it can be read again on the chain when the
--           vote closes; wiped (null) the moment that's done
--   final   the $AGI counted at the close: the lower of `weight` and what it held then (null until counted)
-- Results only ever show each choice's $AGI and number of wallets, never who.

create table if not exists public.agi_votes (
  poll     text        not null check (poll ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  who      text        not null check (char_length(who) between 16 and 64),
  choice   text        not null check (choice ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  weight   bigint      not null check (weight >= 0),
  sealed   text        check (sealed is null or char_length(sealed) <= 200),
  final    bigint      check (final is null or final >= 0),
  voted_at timestamptz not null default now(),
  primary key (poll, who)
);
create index if not exists agi_votes_uncounted on public.agi_votes (poll, voted_at) where final is null;

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change this table.
alter table public.agi_votes enable row level security;
revoke all on table public.agi_votes from anon, authenticated;

-- A vote, or a changed one. Never after this wallet's vote was counted at the close.
-- -> {"ok": true} · {"ok": false, "why": "bad" | "counted"}
create or replace function public.vote_put(p_poll text, p_who text, p_choice text, p_weight bigint, p_sealed text)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_poll is null or p_poll !~ '^[a-z0-9][a-z0-9-]{1,39}$'
     or p_who is null or char_length(p_who) not between 16 and 64
     or p_choice is null or p_choice !~ '^[a-z0-9][a-z0-9-]{0,39}$'
     or p_weight is null or p_weight < 0
     or p_sealed is null or char_length(p_sealed) not between 1 and 200 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi_votes (poll, who, choice, weight, sealed) values (p_poll, p_who, p_choice, p_weight, p_sealed)
  on conflict (poll, who) do update
    set choice = excluded.choice, weight = excluded.weight, sealed = excluded.sealed, voted_at = now()
    where agi_votes.final is null;
  if not found then return json_build_object('ok', false, 'why', 'counted'); end if;
  return json_build_object('ok', true);
end;
$$;

-- One wallet's votes: [{"poll", "choice", "agi", "final"}]
create or replace function public.vote_mine(p_who text)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('poll', poll, 'choice', choice, 'agi', weight, 'final', final) order by poll), '[]'::json)
  from agi_votes where who = p_who;
$$;

-- A poll's numbers: {"rows": [{"choice", "agi", "wallets"}], "left": votes not yet counted again}
-- (a wallet whose $AGI all left before the close counts 0, and isn't counted as a wallet)
create or replace function public.vote_tally(p_poll text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'rows', coalesce((
      select json_agg(json_build_object('choice', choice, 'agi', agi, 'wallets', wallets) order by choice)
      from (
        select choice, sum(coalesce(final, weight))::bigint as agi,
               count(*) filter (where coalesce(final, weight) > 0) as wallets
        from agi_votes where poll = p_poll group by choice
      ) t), '[]'::json),
    'left', (select count(*) from agi_votes where poll = p_poll and final is null),
    'all', (select count(*) from agi_votes where poll = p_poll)
  );
$$;

-- The final count, a few at a time: votes not counted again yet, oldest first -> [{"who", "agi", "sealed"}]
create or replace function public.vote_uncounted(p_poll text, p_limit integer default 15)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('who', who, 'agi', weight, 'sealed', sealed)), '[]'::json)
  from (
    select who, weight, sealed from agi_votes
    where poll = p_poll and final is null
    order by voted_at
    limit least(greatest(coalesce(p_limit, 15), 1), 50)
  ) t;
$$;

-- One wallet counted at the close: the lower of its vote's $AGI and what it holds now; its sealed address is wiped.
-- -> true, or false if it was already counted
create or replace function public.vote_count(p_poll text, p_who text, p_held bigint)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  update agi_votes set final = least(weight, greatest(coalesce(p_held, 0), 0)), sealed = null
  where poll = p_poll and who = p_who and final is null;
  return found;
end;
$$;

-- ---------- the polls (the owner's page, agi1.app/vote/owner) ----------
-- One row per poll: its id, and the rest as the server checked it (src/vote/polls.js checkPoll): question, about,
-- opens, closes, draft (hidden), choices [{id, label, note, picture}]. A picture is a small data: image or a file of
-- the site.
create table if not exists public.agi_polls (
  id         text        primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  body       jsonb       not null check (jsonb_typeof(body) = 'object' and pg_column_size(body) <= 2000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.agi_polls enable row level security;
revoke all on table public.agi_polls from anon, authenticated;

-- Every poll, the newest first: [{"id", ...body}]
create or replace function public.poll_list()
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg((body || jsonb_build_object('id', id)) order by created_at desc), '[]'::json) from agi_polls;
$$;

-- A new poll, or a changed one -> true
create or replace function public.poll_put(p_id text, p_body jsonb)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_id is null or p_id !~ '^[a-z0-9][a-z0-9-]{1,39}$' or p_body is null or jsonb_typeof(p_body) <> 'object' then
    return false;
  end if;
  insert into agi_polls (id, body) values (p_id, p_body - 'id')
  on conflict (id) do update set body = excluded.body, updated_at = now();
  return true;
end;
$$;

-- A poll deleted, only if nobody voted on it (one with votes can only be hidden)
-- -> {"ok": true} · {"ok": false, "why": "has_votes" | "gone"}
create or replace function public.poll_drop(p_id text)
returns json
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from agi_votes where poll = p_id) then
    return json_build_object('ok', false, 'why', 'has_votes');
  end if;
  delete from agi_polls where id = p_id;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  return json_build_object('ok', true);
end;
$$;

-- The first two ideas, hidden until the owner fills them in and shows them (only added once: never over the owner's own)
insert into public.agi_polls (id, body) values
  ('roadmap-next', jsonb_build_object(
    'question', 'What should AGI build next?',
    'about', 'Pick the roadmap stop you want first. The roadmap isn''t in order: this decides what the team works on next.',
    'opens', '2026-10-27T14:00:00.000Z', 'closes', '2026-10-30T14:00:00.000Z', 'draft', true,
    'choices', jsonb_build_array(
      jsonb_build_object('id', 'stake', 'label', 'Stake $AGI', 'note', 'Rewards in USDG, in $AGI, or free AI with sAGI.'),
      jsonb_build_object('id', 'giveaway', 'label', 'Giveaways', 'note', 'Giveaways for the $AGI community.'),
      jsonb_build_object('id', 'buybacks', 'label', 'Buybacks, burns, marketing & listings', 'note', 'Put the fees to work for $AGI.'),
      jsonb_build_object('id', 'aum', 'label', 'AUM', 'note', 'AGI-1 manages AGI''s own wallet, in the open.'),
      jsonb_build_object('id', 'games', 'label', 'More AGI games', 'note', 'More free games at agi1.app/games.')))),
  ('new-logo', jsonb_build_object(
    'question', 'Pick the new AGI logo',
    'about', 'The finalists from the community''s ideas, and keeping the logo we have.',
    'opens', '2026-10-27T14:00:00.000Z', 'closes', '2026-10-30T14:00:00.000Z', 'draft', true,
    'choices', jsonb_build_array(
      jsonb_build_object('id', 'keep', 'label', 'Keep the current logo', 'picture', '/vote/new-logo/keep.svg'),
      jsonb_build_object('id', 'logo-a', 'label', 'Logo A'),
      jsonb_build_object('id', 'logo-b', 'label', 'Logo B'),
      jsonb_build_object('id', 'logo-c', 'label', 'Logo C'))))
on conflict (id) do nothing;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.poll_list() from public, anon, authenticated;
revoke all on function public.poll_put(text, jsonb) from public, anon, authenticated;
revoke all on function public.poll_drop(text) from public, anon, authenticated;
grant execute on function public.poll_list() to service_role;
grant execute on function public.poll_put(text, jsonb) to service_role;
grant execute on function public.poll_drop(text) to service_role;
revoke all on function public.vote_put(text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.vote_mine(text) from public, anon, authenticated;
revoke all on function public.vote_tally(text) from public, anon, authenticated;
revoke all on function public.vote_uncounted(text, integer) from public, anon, authenticated;
revoke all on function public.vote_count(text, text, bigint) from public, anon, authenticated;
grant execute on function public.vote_put(text, text, text, bigint, text) to service_role;
grant execute on function public.vote_mine(text) to service_role;
grant execute on function public.vote_tally(text) to service_role;
grant execute on function public.vote_uncounted(text, integer) to service_role;
grant execute on function public.vote_count(text, text, bigint) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show vote_functions_found = 8.
select count(*) as vote_functions_found from pg_proc
where proname in ('vote_put', 'vote_mine', 'vote_tally', 'vote_uncounted', 'vote_count', 'poll_list', 'poll_put', 'poll_drop');

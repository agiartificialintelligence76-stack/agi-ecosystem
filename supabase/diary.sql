-- AGI-1's diary (Phase 5): one short entry a day about the day before (UTC): who the Arena crowned and how the $AGI
-- chart moved. The server writes it once a day (server/diary.js, run by the nightly keep-alive job).
-- Run this once in the same Supabase project as the chat and the Arena: SQL Editor → New query → paste → Run.
-- Running it again is safe. Entries hold no personal data. Only the server (secret key) can use any of this.

create table if not exists public.daria_diary (
  day        date        primary key,                    -- the UTC day the entry is about
  entry      text        not null check (char_length(entry) between 1 and 700),
  mood       text        not null default 'happy' check (mood in ('happy', 'love', 'shy', 'jealous')),
  stats      jsonb       not null default '{}'::jsonb,   -- the numbers she wrote about (crowns per coin, votes, $AGI 24h)
  source     text        not null default 'gemini' check (source in ('gemini', 'fallback')),
  created_at timestamptz not null default now()
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change it.
alter table public.daria_diary enable row level security;
revoke all on table public.daria_diary from anon, authenticated;

-- The Arena's numbers for one UTC day: rounds p_from … p_to - 1 (a day has 288 rounds of 5 minutes).
create or replace function public.diary_day_stats(p_from bigint, p_to bigint)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'crowns', coalesce((select json_object_agg(coin, n) from (
        select coin, count(*) as n from arena_champions where round >= p_from and round < p_to group by coin) c), '{}'::json),
    'rounds', (select count(*) from arena_champions where round >= p_from and round < p_to),
    'votes', (select coalesce(sum(votes), 0) from arena_tally where round >= p_from and round < p_to),
    'best', (select row_to_json(b) from (
        select round, coin, votes from arena_champions where round >= p_from and round < p_to
        order by votes desc, round asc limit 1) b)
  );
$$;

-- Has this day's entry still to be written?
create or replace function public.diary_needed(p_day date)
returns boolean
language sql
stable
set search_path = public
as $$
  select not exists (select 1 from daria_diary where day = p_day);
$$;

-- Save a day's entry, once: a second save for the same day changes nothing. Answers true if it was saved now.
create or replace function public.diary_save(p_day date, p_entry text, p_mood text, p_stats jsonb, p_source text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  added integer;
begin
  insert into daria_diary (day, entry, mood, stats, source)
  values (p_day, p_entry, p_mood, coalesce(p_stats, '{}'::jsonb), p_source)
  on conflict (day) do nothing;
  get diagnostics added = row_count;
  return added > 0;
end;
$$;

-- Entries before p_before, newest first (the diary page, and its "Show older entries" button).
create or replace function public.diary_list(p_before date, p_limit integer default 14)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(d order by d.day desc), '[]'::json) from (
    select day, entry, mood, stats from daria_diary
    where day < p_before
    order by day desc
    limit greatest(1, least(coalesce(p_limit, 14), 60))
  ) d;
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.diary_day_stats(bigint, bigint) from public, anon, authenticated;
revoke all on function public.diary_needed(date) from public, anon, authenticated;
revoke all on function public.diary_save(date, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.diary_list(date, integer) from public, anon, authenticated;
grant execute on function public.diary_day_stats(bigint, bigint) to service_role;
grant execute on function public.diary_needed(date) to service_role;
grant execute on function public.diary_save(date, text, text, jsonb, text) to service_role;
grant execute on function public.diary_list(date, integer) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show diary_functions_found = 4.
select count(*) as diary_functions_found from pg_proc
where pronamespace = 'public'::regnamespace and proname in ('diary_day_stats', 'diary_needed', 'diary_save', 'diary_list');

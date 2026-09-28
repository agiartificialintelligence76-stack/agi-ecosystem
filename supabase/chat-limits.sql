-- $AGI chat limits. Run this once in your NEW Supabase project: SQL Editor → New query → paste → Run.
-- It keeps tiny counters so /api/chat can limit messages per visitor and for the whole site per day.
-- Visitors are identified by a scrambled code made from their IP that changes every day.
-- Real IP addresses are never stored.

create table if not exists public.chat_usage (
  day     date        not null,
  who     text        not null,                 -- 'global', or a visitor's daily-changing code
  count   integer     not null default 0,
  last_at timestamptz not null default 'epoch',
  primary key (day, who)
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change this table.
alter table public.chat_usage enable row level security;
revoke all on table public.chat_usage from anon, authenticated;

-- One atomic step: check the limits and, if allowed, count the message.
-- Answers 'ok', 'too_fast', 'person_cap' or 'global_cap'.
create or replace function public.chat_take(p_who text, p_person_daily int, p_global_daily int, p_min_gap_ms int)
returns text
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  g chat_usage%rowtype;
  p chat_usage%rowtype;
begin
  insert into chat_usage (day, who) values (today, 'global'), (today, p_who)
  on conflict (day, who) do nothing;

  -- Lock both rows (always in the same order) so simultaneous messages can't sneak past a limit.
  select * into g from chat_usage where day = today and who = 'global' for update;
  select * into p from chat_usage where day = today and who = p_who for update;

  if g.count >= p_global_daily then return 'global_cap'; end if;
  if p.count >= p_person_daily then return 'person_cap'; end if;
  if now() - p.last_at < p_min_gap_ms * interval '1 millisecond' then return 'too_fast'; end if;

  update chat_usage set count = count + 1, last_at = now()
  where day = today and who in ('global', p_who);

  -- Tidy up: forget counters older than 3 days (runs on about 2% of calls).
  if random() < 0.02 then
    delete from chat_usage where day < today - 3;
  end if;
  return 'ok';
end;
$$;

-- Only the server (the secret key = service_role) may call it. The browser keys may not.
revoke all on function public.chat_take(text, int, int, int) from public, anon, authenticated;
grant execute on function public.chat_take(text, int, int, int) to service_role;

-- Tell Supabase's web API to notice the new function right away.
-- (Without this, the API can answer "404 function not found" for a while.)
notify pgrst, 'reload schema';

-- Check: this should show chat_take_found = 1.
select count(*) as chat_take_found from pg_proc where proname = 'chat_take';

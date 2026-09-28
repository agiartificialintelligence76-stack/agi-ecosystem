-- $AGI: AGI-1's voice (2026-09-25). Run this once in the SAME Supabase project, after chat-limits.sql:
-- SQL Editor → New query → paste all of it → Run. It ends by showing voice_take_found = 1.
-- It adds one function that counts how much of her voice is used, in the chat's counter table (chat_usage), so the
-- daily cost has a hard stop. Nothing personal is stored: the same daily-changing visitor code as the chat limits,
-- and a short id of each reply's voice ticket. Old counters are deleted after 3 days (by chat_take's tidy-up).

-- voice.sql uses the chat's counter table, so chat-limits.sql must have been run first.
do $$
begin
  if to_regclass('public.chat_usage') is null then
    raise exception 'Run supabase/chat-limits.sql first, then this file.';
  end if;
end;
$$;

-- One atomic step: check the limits and, if allowed, count it. Answers:
--   'ok', 'used' (this reply was already voiced p_ticket_max times), 'person_cap' (this visitor's daily units),
--   'global_cap' (the whole site's daily units), 'bad' (a wrong number of units).
-- A "unit" is up to 150 characters of her voice (about 10 seconds); the server sends 1 or 2 per reply.
create or replace function public.voice_take(p_who text, p_ticket text, p_units int, p_person_daily int, p_global_daily int, p_ticket_max int)
returns text
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  kg text := 'voice:global';
  kp text := 'voice:' || p_who;
  kt text := 'voice-ticket:' || p_ticket;
  g chat_usage%rowtype;
  p chat_usage%rowtype;
  t chat_usage%rowtype;
begin
  if p_units is null or p_units < 1 or p_units > 10 or length(p_who) > 64 or length(p_ticket) > 64 then
    return 'bad';
  end if;
  insert into chat_usage (day, who) values (today, kg), (today, kp), (today, kt)
  on conflict (day, who) do nothing;

  -- Lock the rows (always in the same order) so simultaneous requests can't sneak past a limit.
  select * into g from chat_usage where day = today and who = kg for update;
  select * into p from chat_usage where day = today and who = kp for update;
  select * into t from chat_usage where day = today and who = kt for update;

  if t.count >= p_ticket_max then return 'used'; end if;
  if g.count + p_units > p_global_daily then return 'global_cap'; end if;
  if p.count + p_units > p_person_daily then return 'person_cap'; end if;

  update chat_usage set count = count + p_units, last_at = now() where day = today and who in (kg, kp);
  update chat_usage set count = count + 1, last_at = now() where day = today and who = kt;
  return 'ok';
end;
$$;

-- Only the server (the secret key = service_role) may call it. The browser keys may not.
revoke all on function public.voice_take(text, text, int, int, int, int) from public, anon, authenticated;
grant execute on function public.voice_take(text, text, int, int, int, int) to service_role;

-- Tell Supabase's web API to notice the new function right away.
notify pgrst, 'reload schema';

-- Check: this should show voice_take_found = 1.
select count(*) as voice_take_found from pg_proc where proname = 'voice_take';

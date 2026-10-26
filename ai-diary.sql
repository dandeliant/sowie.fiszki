-- ═══════════════════════════════════════════════════════════════
--  Migracja #82 — Pamiętnik rozmów z AI
-- ═══════════════════════════════════════════════════════════════
--  Rozmowy z AI (pupil, Sowa Fiszka, postacie Grammar City) i zdania z trybu
--  „🤖 Napisz zdanie” zapisują się na stałe w Pamiętniku użytkownika (ai_chat_logs, #80):
--  • koniec automatycznego usuwania po 7 dniach (zostaje do usunięcia przez administratora
--    albo usunięcia konta — on delete cascade)
--  • session_id — tury jednej rozmowy (grupowanie w Pamiętniku i w panelu admina)
--  • reviewed — administrator oznacza wpisy jako przejrzane (licznik „Wymagają uwagi”)
--  • categories — oprócz kategorii moderacji OpenAI także: off_topic (poza tematem rozdziału),
--    polish (wypowiedź po polsku / w dwóch językach) — ustawia Edge Function „ai”
--  • my_ai_diary() — użytkownik czyta swój Pamiętnik (bez kategorii i znaczników admina)
--  • ai_chat_logs_list(p_filter, p_search, p_limit, p_days, p_user) — panel admina
--  Wymaga: #20, #80. Idempotentna.
-- ═══════════════════════════════════════════════════════════════

alter table public.ai_chat_logs add column if not exists session_id text;
alter table public.ai_chat_logs add column if not exists reviewed boolean not null default false;
create index if not exists ai_chat_logs_session on public.ai_chat_logs (user_id, session_id);
create index if not exists ai_chat_logs_attention on public.ai_chat_logs (created_at)
  where not reviewed and (flagged or categories && array['off_topic', 'polish']);

-- powitanie AI (bez wypowiedzi ucznia) też trafia do Pamiętnika
alter table public.ai_chat_logs alter column message set default '';

-- admin oznacza wpisy jako przejrzane
drop policy if exists "ai_chat_logs: admin update" on public.ai_chat_logs;
create policy "ai_chat_logs: admin update" on public.ai_chat_logs for update using (public._is_admin()) with check (public._is_admin());
grant update (reviewed) on public.ai_chat_logs to authenticated;

-- ── koniec usuwania po 7 dniach ──
create or replace function public.ai_chat_logs_cleanup()
returns int language sql security definer set search_path = public as $$ select 0 $$;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('sowie-ai-chat-logs'); exception when others then null; end;
  end if;
end;
$$;

-- ── zapis (tylko Edge Function) ──
-- stara wersja (8 argumentów) — bez sprzątania, dla starszej funkcji AI
create or replace function public.ai_chat_log_add(p_user uuid, p_kind text, p_partner text, p_topic text,
  p_message text, p_reply text, p_flagged boolean, p_categories text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ai_chat_logs(user_id, kind, partner, topic, message, reply, flagged, categories)
  values (p_user, case when p_kind = 'sentence' then 'sentence' else 'chat' end, left(p_partner, 80), left(p_topic, 160),
          left(coalesce(p_message, ''), 1000), left(p_reply, 2000), coalesce(p_flagged, false), p_categories);
end $$;
revoke all on function public.ai_chat_log_add(uuid, text, text, text, text, text, boolean, text[]) from public, anon, authenticated;
grant execute on function public.ai_chat_log_add(uuid, text, text, text, text, text, boolean, text[]) to service_role;

create or replace function public.ai_chat_log_add(p_user uuid, p_kind text, p_partner text, p_topic text,
  p_message text, p_reply text, p_flagged boolean, p_categories text[], p_session text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ai_chat_logs(user_id, kind, partner, topic, message, reply, flagged, categories, session_id)
  values (p_user, case when p_kind = 'sentence' then 'sentence' else 'chat' end, left(p_partner, 80), left(p_topic, 160),
          left(coalesce(p_message, ''), 1000), left(p_reply, 2000), coalesce(p_flagged, false), p_categories, left(p_session, 40));
end $$;
revoke all on function public.ai_chat_log_add(uuid, text, text, text, text, text, boolean, text[], text) from public, anon, authenticated;
grant execute on function public.ai_chat_log_add(uuid, text, text, text, text, text, boolean, text[], text) to service_role;

-- ── Pamiętnik użytkownika (tylko własne wpisy, bez znaczników moderacji) ──
create or replace function public.my_ai_diary(p_kind text default null, p_before timestamptz default null, p_limit int default 300)
returns table(id bigint, created_at timestamptz, kind text, partner text, topic text, message text, reply text, session_id text)
language sql stable security definer set search_path = public as $$
  select l.id, l.created_at, l.kind, l.partner, l.topic, l.message, l.reply, l.session_id
    from public.ai_chat_logs l
   where l.user_id = auth.uid()
     and (p_kind is null or l.kind = p_kind)
     and (p_before is null or l.created_at < p_before)
   order by l.created_at desc
   limit greatest(1, least(coalesce(p_limit, 300), 1000))
$$;
revoke all on function public.my_ai_diary(text, timestamptz, int) from public, anon;
grant execute on function public.my_ai_diary(text, timestamptz, int) to authenticated;

-- ── panel admina ──
--  p_filter: all | flagged (moderacja) | off_topic | polish | attention (nieprzejrzane z flagą lub poza tematem / po polsku)
drop function if exists public.ai_chat_logs_list(boolean, text, int);
create or replace function public.ai_chat_logs_list(p_filter text default 'all', p_search text default null,
  p_limit int default 1000, p_days int default null, p_user uuid default null)
returns table(id bigint, user_id uuid, username text, role text, created_at timestamptz, kind text, partner text, topic text,
              message text, reply text, flagged boolean, categories text[], session_id text, reviewed boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Brak uprawnień administratora'; end if;
  return query
    select l.id, l.user_id, p.username,
           case when p.is_admin then 'admin' when p.is_teacher then 'nauczyciel' when p.is_parent then 'opiekun' else 'uczeń' end,
           l.created_at, l.kind, l.partner, l.topic, l.message, l.reply, l.flagged, l.categories, l.session_id, l.reviewed
      from public.ai_chat_logs l left join public.profiles p on p.id = l.user_id
     where (p_user is null or l.user_id = p_user)
       and (p_days is null or l.created_at >= now() - make_interval(days => greatest(1, p_days)))
       and (case coalesce(p_filter, 'all')
              when 'flagged' then l.flagged
              when 'off_topic' then l.categories && array['off_topic']
              when 'polish' then l.categories && array['polish']
              when 'attention' then not l.reviewed and (l.flagged or l.categories && array['off_topic', 'polish'])
              else true end)
       and (coalesce(p_search, '') = '' or l.message ilike '%' || p_search || '%' or l.reply ilike '%' || p_search || '%' or p.username ilike '%' || p_search || '%')
     order by l.created_at desc
     limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end $$;
revoke all on function public.ai_chat_logs_list(text, text, int, int, uuid) from public, anon;
grant execute on function public.ai_chat_logs_list(text, text, int, int, uuid) to authenticated;

-- ── licznik do banera „Wymagają Twojej uwagi”: nieprzejrzane niestosowne / poza tematem / po polsku ──
create or replace function public.ai_chat_flagged_count()
returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then return 0; end if;
  return (select count(*)::int from public.ai_chat_logs
           where not reviewed and (flagged or categories && array['off_topic', 'polish']));
end $$;
revoke all on function public.ai_chat_flagged_count() from public, anon;
grant execute on function public.ai_chat_flagged_count() to authenticated;

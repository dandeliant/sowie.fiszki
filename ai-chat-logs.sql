-- ═══════════════════════════════════════════════════════════════
--  Migracja #80 — zapis rozmów z AI (bezpieczeństwo), kasowanie po 7 dniach
-- ═══════════════════════════════════════════════════════════════
--  ai_chat_logs: każda wypowiedź ucznia w rozmowie z AI (akcja chat) i zdanie z trybu
--  „🤖 Napisz zdanie” (check_sentence) + odpowiedź AI. Wypowiedzi zatrzymane przez filtr
--  bezpieczeństwa (moderacja OpenAI) mają flagged = true i kategorie (np. harassment, sexual).
--  • zapis WYŁĄCZNIE przez Edge Function „ai” (RPC ai_chat_log_add, tylko service_role)
--  • odczyt i usuwanie — tylko administrator (RLS + RPC ai_chat_logs_list)
--  • wpisy starsze niż 7 dni są usuwane: przy każdym nowym zapisie, przy otwarciu panelu
--    przez admina i codziennie o 3:30 (pg_cron, jeśli włączony)
--  Opisane w Polityce prywatności (cel: bezpieczeństwo dzieci, okres: 7 dni).
--  Po migracji #82 (Pamiętnik, kolumna session_id) ten plik niczego już nie usuwa — można go uruchomić ponownie bez utraty wpisów.
--  Wymaga: #20 (_is_admin). Idempotentna.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.ai_chat_logs (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  kind        text not null default 'chat' check (kind in ('chat', 'sentence')),
  partner     text,                   -- z kim rozmawiał (pupil / Sowa / postać z Grammar City)
  topic       text,                   -- rozdział / słówko
  message     text not null check (char_length(message) <= 1000),
  reply       text check (reply is null or char_length(reply) <= 2000),
  flagged     boolean not null default false,
  categories  text[]
);
create index if not exists ai_chat_logs_time on public.ai_chat_logs (created_at);
create index if not exists ai_chat_logs_user on public.ai_chat_logs (user_id, created_at);
create index if not exists ai_chat_logs_flag on public.ai_chat_logs (created_at) where flagged;

alter table public.ai_chat_logs enable row level security;
drop policy if exists "ai_chat_logs: admin read" on public.ai_chat_logs;
drop policy if exists "ai_chat_logs: admin delete" on public.ai_chat_logs;
create policy "ai_chat_logs: admin read" on public.ai_chat_logs for select using (public._is_admin());
create policy "ai_chat_logs: admin delete" on public.ai_chat_logs for delete using (public._is_admin());
grant select, delete on public.ai_chat_logs to authenticated;

-- ── usuwanie wpisów starszych niż 7 dni ──
create or replace function public.ai_chat_logs_cleanup()
returns int language sql security definer set search_path = public as $$
  with d as (delete from public.ai_chat_logs where created_at < now() - interval '7 days' and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_chat_logs' and column_name = 'session_id') returning 1)
  select count(*)::int from d
$$;
revoke all on function public.ai_chat_logs_cleanup() from public, anon, authenticated;
grant execute on function public.ai_chat_logs_cleanup() to service_role;

-- ── zapis (tylko Edge Function) — od razu sprząta stare wpisy ──
create or replace function public.ai_chat_log_add(p_user uuid, p_kind text, p_partner text, p_topic text,
  p_message text, p_reply text, p_flagged boolean, p_categories text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ai_chat_logs(user_id, kind, partner, topic, message, reply, flagged, categories)
  values (p_user, case when p_kind = 'sentence' then 'sentence' else 'chat' end, left(p_partner, 80), left(p_topic, 160),
          left(coalesce(p_message, ''), 1000), left(p_reply, 2000), coalesce(p_flagged, false), p_categories);
  delete from public.ai_chat_logs where created_at < now() - interval '7 days' and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_chat_logs' and column_name = 'session_id');
end $$;
revoke all on function public.ai_chat_log_add(uuid, text, text, text, text, text, boolean, text[]) from public, anon, authenticated;
grant execute on function public.ai_chat_log_add(uuid, text, text, text, text, text, boolean, text[]) to service_role;

-- ── lista dla admina (z loginem i rolą), najpierw sprząta stare wpisy ──
create or replace function public.ai_chat_logs_list(p_only_flagged boolean default false, p_search text default null, p_limit int default 300)
returns table(id bigint, user_id uuid, username text, role text, created_at timestamptz, kind text, partner text, topic text,
              message text, reply text, flagged boolean, categories text[])
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Brak uprawnień administratora'; end if;
  delete from public.ai_chat_logs l where l.created_at < now() - interval '7 days' and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_chat_logs' and column_name = 'session_id');
  return query
    select l.id, l.user_id, p.username,
           case when p.is_admin then 'admin' when p.is_teacher then 'nauczyciel' when p.is_parent then 'opiekun' else 'uczeń' end,
           l.created_at, l.kind, l.partner, l.topic, l.message, l.reply, l.flagged, l.categories
      from public.ai_chat_logs l left join public.profiles p on p.id = l.user_id
     where (not coalesce(p_only_flagged, false) or l.flagged)
       and (coalesce(p_search, '') = '' or l.message ilike '%' || p_search || '%' or l.reply ilike '%' || p_search || '%' or p.username ilike '%' || p_search || '%')
     order by l.created_at desc
     limit greatest(1, least(coalesce(p_limit, 300), 2000));
end $$;
revoke all on function public.ai_chat_logs_list(boolean, text, int) from public, anon;
grant execute on function public.ai_chat_logs_list(boolean, text, int) to authenticated;

-- ── liczba oznaczonych (baner admina) ──
create or replace function public.ai_chat_flagged_count()
returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then return 0; end if;
  return (select count(*)::int from public.ai_chat_logs where flagged and created_at >= now() - interval '7 days');
end $$;
revoke all on function public.ai_chat_flagged_count() from public, anon;
grant execute on function public.ai_chat_flagged_count() to authenticated;

-- ── codzienne sprzątanie w bazie (jeśli włączone rozszerzenie pg_cron) ──
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_chat_logs' and column_name = 'session_id') then
    begin
      perform cron.unschedule('sowie-ai-chat-logs');
    exception when others then null;
    end;
    perform cron.schedule('sowie-ai-chat-logs', '30 3 * * *', 'select public.ai_chat_logs_cleanup()');
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
--  Migracja #79 — panel kosztów AI (admin)
-- ═══════════════════════════════════════════════════════════════
--  1) ai_usage (#73) + kolumny tokens_in / tokens_out — Edge Function „ai” dopisuje
--     zużyte tokeny OpenAI (RPC ai_usage_tokens, tylko service_role).
--  2) ai_limits(action, role 'staff'|'student', max) — dzienne limity edytowane w panelu;
--     Edge Function czyta je przy każdym wywołaniu (brak wiersza = limit domyślny z kodu).
--  3) ai_settings(key, value jsonb): 'enabled' {"staff":true,"student":true} — wyłącznik AI,
--     'price' {"in":0.15,"out":0.60} — cena USD za 1 mln tokenów (do szacowania kosztu).
--  4) RPC admina: ai_usage_daily(p_days), ai_usage_top(p_days, p_limit).
--  Wymaga: #20 (_is_admin), #73 (ai_usage). Idempotentna.
-- ═══════════════════════════════════════════════════════════════

alter table public.ai_usage add column if not exists tokens_in  bigint not null default 0;
alter table public.ai_usage add column if not exists tokens_out bigint not null default 0;

create or replace function public.ai_usage_tokens(p_user uuid, p_action text, p_in int, p_out int)
returns void language sql security definer set search_path = public as $$
  insert into public.ai_usage(user_id, day, action, cnt, tokens_in, tokens_out)
  values (p_user, current_date, p_action, 0, greatest(p_in, 0), greatest(p_out, 0))
  on conflict (user_id, day, action) do update
    set tokens_in = public.ai_usage.tokens_in + greatest(excluded.tokens_in, 0),
        tokens_out = public.ai_usage.tokens_out + greatest(excluded.tokens_out, 0)
$$;
revoke all on function public.ai_usage_tokens(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.ai_usage_tokens(uuid, text, int, int) to service_role;

-- ── limity ──
create table if not exists public.ai_limits (
  action     text not null,
  role       text not null check (role in ('staff', 'student')),
  max        int  not null check (max between 0 and 100000),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (action, role)
);
alter table public.ai_limits enable row level security;
drop policy if exists "ai_limits: read" on public.ai_limits;
drop policy if exists "ai_limits: admin write" on public.ai_limits;
create policy "ai_limits: read" on public.ai_limits for select using (auth.uid() is not null);
create policy "ai_limits: admin write" on public.ai_limits for all using (public._is_admin()) with check (public._is_admin());
grant select on public.ai_limits to authenticated;
grant insert, update, delete on public.ai_limits to authenticated;

-- ── ustawienia ──
create table if not exists public.ai_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.ai_settings enable row level security;
drop policy if exists "ai_settings: read" on public.ai_settings;
drop policy if exists "ai_settings: admin write" on public.ai_settings;
create policy "ai_settings: read" on public.ai_settings for select using (auth.uid() is not null);
create policy "ai_settings: admin write" on public.ai_settings for all using (public._is_admin()) with check (public._is_admin());
grant select on public.ai_settings to authenticated;
grant insert, update, delete on public.ai_settings to authenticated;
insert into public.ai_settings(key, value) values
  ('enabled', '{"staff": true, "student": true}'::jsonb),
  ('price',   '{"in": 0.15, "out": 0.60}'::jsonb)
on conflict (key) do nothing;

-- ── statystyki (admin) ──
create or replace function public.ai_usage_daily(p_days int default 30)
returns table(day date, action text, calls bigint, tokens_in bigint, tokens_out bigint, users bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Brak uprawnień administratora'; end if;
  return query
    select u.day, u.action, sum(u.cnt)::bigint, sum(u.tokens_in)::bigint, sum(u.tokens_out)::bigint, count(distinct u.user_id)::bigint
      from public.ai_usage u
     where u.day > current_date - greatest(1, least(coalesce(p_days, 30), 365))
     group by u.day, u.action
     order by u.day, u.action;
end $$;

create or replace function public.ai_usage_top(p_days int default 30, p_limit int default 15)
returns table(user_id uuid, username text, role text, calls bigint, tokens_in bigint, tokens_out bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Brak uprawnień administratora'; end if;
  return query
    select u.user_id, p.username,
           case when p.is_admin then 'admin' when p.is_teacher then 'nauczyciel' else 'uczeń' end,
           sum(u.cnt)::bigint, sum(u.tokens_in)::bigint, sum(u.tokens_out)::bigint
      from public.ai_usage u left join public.profiles p on p.id = u.user_id
     where u.day > current_date - greatest(1, least(coalesce(p_days, 30), 365))
     group by u.user_id, p.username, p.is_admin, p.is_teacher
     order by sum(u.tokens_in) + 4 * sum(u.tokens_out) desc, sum(u.cnt) desc
     limit greatest(1, least(coalesce(p_limit, 15), 100));
end $$;
revoke all on function public.ai_usage_daily(int) from public, anon;
revoke all on function public.ai_usage_top(int, int) from public, anon;
grant execute on function public.ai_usage_daily(int) to authenticated;
grant execute on function public.ai_usage_top(int, int) to authenticated;

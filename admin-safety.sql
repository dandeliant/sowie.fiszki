-- ═══════════════════════════════════════════════════════════════
--  Migracja #74 — bezpieczeństwo uprawnień (admin, role, plan)
-- ═══════════════════════════════════════════════════════════════
--  1) Strażnik profilu: polityka „profiles: własny UPDATE” pozwalała zalogowanemu
--     zmienić w swoim wierszu KAŻDĄ kolumnę — także is_admin, plan Premium, login.
--     Trigger _profiles_guard cofa takie zmiany, gdy zapis przychodzi wprost od
--     użytkownika (rola authenticated/anon). Funkcje SECURITY DEFINER (RPC admina,
--     tworzenie kont, trial) działają jak dotąd.
--       • is_admin — zmienia się WYŁĄCZNIE przez RPC (admin_set_admin, approve_admin_request)
--       • login, plan, data wygaśnięcia, twórca konta, zdjęcie, ukrycie banerów — tylko admin
--         (wyjątek: sam użytkownik może zejść na plan 'free')
--       • is_teacher / is_parent — sam użytkownik może je włączyć tylko tuż po rejestracji
--         (konto bez twórcy, max 2 h od założenia) — tak działa wybór roli w formularzu
--  2) Nadanie admina wymaga wpisania loginu (potwierdzenie po stronie bazy).
--  3) Lista adminów, odbieranie uprawnień (nie sobie, zawsze zostaje min. 1 admin).
--  4) Historia zmian uprawnień admina (admin_audit).
--  Wymaga: #20 (_is_admin). Idempotentna.
-- ═══════════════════════════════════════════════════════════════

-- ── historia zmian ──
create table if not exists public.admin_audit (
  id          bigserial primary key,
  actor_id    uuid,
  actor_name  text,
  target_id   uuid,
  target_name text,
  action      text not null,          -- grant_admin | revoke_admin | reject_request
  details     jsonb,
  created_at  timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
drop policy if exists "admin_audit: admin select" on public.admin_audit;
create policy "admin_audit: admin select" on public.admin_audit for select using (public._is_admin());
grant select on public.admin_audit to authenticated;

-- ── strażnik profilu ──
-- SECURITY INVOKER (domyślnie): current_user to rola wywołującego. Zapis wprost z aplikacji
-- = 'authenticated'/'anon'; zapis z funkcji SECURITY DEFINER = właściciel funkcji (zaufany).
create or replace function public._profiles_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  n jsonb; o jsonb; k text; fix jsonb := '{}'::jsonb;
  locked text[] := array['username','plan','plan_expires_at','trial_used_at','hide_premium_banners',
    'created_by','avatar_url','avatar_path','avatar_updated_at','nickname_cleared_by','nickname_cleared_at',
    'generated_password','last_seen_at'];
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  n := to_jsonb(new);
  if tg_op = 'INSERT' then
    fix := jsonb_build_object('is_admin', false);
    if n ? 'is_teacher' then fix := fix || '{"is_teacher": false}'; end if;
    if n ? 'is_parent' then fix := fix || '{"is_parent": false}'; end if;
    if n ? 'plan' then fix := fix || '{"plan": "free"}'; end if;
    if n ? 'plan_expires_at' then fix := fix || '{"plan_expires_at": null}'; end if;
    if n ? 'created_by' then fix := fix || '{"created_by": null}'; end if;
    if n ? 'hide_premium_banners' then fix := fix || '{"hide_premium_banners": false}'; end if;
    return jsonb_populate_record(new, fix);
  end if;
  o := to_jsonb(old);
  -- flaga admina: tylko przez RPC (także admin nie zmienia jej zwykłym UPDATE)
  if (n -> 'is_admin') is distinct from (o -> 'is_admin') then
    fix := fix || jsonb_build_object('is_admin', o -> 'is_admin');
  end if;
  if not public._is_admin() then
    foreach k in array locked loop
      if n ? k and (n -> k) is distinct from (o -> k) then
        -- rezygnacja z planu (powrót na Free) jest dozwolona
        if k in ('plan', 'plan_expires_at') and n ->> 'plan' = 'free'
           and (k = 'plan' or n -> 'plan_expires_at' = 'null'::jsonb) then
          continue;
        end if;
        fix := fix || jsonb_build_object(k, o -> k);
      end if;
    end loop;
    foreach k in array array['is_teacher', 'is_parent'] loop
      if n ? k and (n -> k) is distinct from (o -> k) and coalesce((n ->> k)::boolean, false) then
        if not ((o ->> 'created_by') is null
                and (o ->> 'created_at') is not null
                and (o ->> 'created_at')::timestamptz > now() - interval '2 hours') then
          fix := fix || jsonb_build_object(k, o -> k);
        end if;
      end if;
    end loop;
  end if;
  if fix <> '{}'::jsonb then new := jsonb_populate_record(new, fix); end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public._profiles_guard();

-- ── nazwa zalogowanego (do historii) ──
create or replace function public._my_username()
returns text language sql stable security definer set search_path = public as $$
  select username from public.profiles where id = auth.uid()
$$;

-- ── zatwierdzenie prośby: wymaga wpisania loginu ──
drop function if exists public.approve_admin_request(uuid);
create or replace function public.approve_admin_request(p_request_id uuid, p_confirm text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_name text;
begin
  if not public._is_admin() then raise exception 'Brak uprawnień administratora'; end if;
  select r.user_id, p.username into v_user, v_name
    from public.admin_requests r join public.profiles p on p.id = r.user_id
   where r.id = p_request_id and r.status = 'pending';
  if v_user is null then raise exception 'Prośba nie istnieje lub już rozpatrzona'; end if;
  if p_confirm is null or lower(trim(p_confirm)) <> lower(v_name) then
    raise exception 'CONFIRM_REQUIRED: wpisz login użytkownika, aby potwierdzić';
  end if;
  update public.profiles set is_admin = true where id = v_user;
  update public.admin_requests set status = 'approved' where id = p_request_id;
  insert into public.admin_audit(actor_id, actor_name, target_id, target_name, action, details)
    values (auth.uid(), public._my_username(), v_user, v_name, 'grant_admin', jsonb_build_object('request', p_request_id));
end $$;

create or replace function public.reject_admin_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_name text;
begin
  if not public._is_admin() then raise exception 'Brak uprawnień administratora'; end if;
  update public.admin_requests set status = 'rejected'
   where id = p_request_id and status = 'pending'
   returning user_id, username into v_user, v_name;
  if v_user is not null then
    insert into public.admin_audit(actor_id, actor_name, target_id, target_name, action)
      values (auth.uid(), public._my_username(), v_user, v_name, 'reject_request');
  end if;
end $$;

-- ── lista adminów (z ostatnim logowaniem) ──
create or replace function public.admin_list_admins()
returns table(id uuid, username text, created_at timestamptz, last_sign_in_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public._is_admin() then raise exception 'Brak uprawnień administratora'; end if;
  return query
    select p.id, p.username, p.created_at,
           (select u.last_sign_in_at from auth.users u where u.id = p.id),
           p.id = auth.uid()
      from public.profiles p
     where p.is_admin
     order by p.created_at;
end $$;

-- ── nadanie / odebranie admina (z potwierdzeniem loginem) ──
create or replace function public.admin_set_admin(p_user_id uuid, p_value boolean, p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_cur boolean; v_admins int;
begin
  if not public._is_admin() then raise exception 'Brak uprawnień administratora'; end if;
  select username, is_admin into v_name, v_cur from public.profiles where id = p_user_id;
  if v_name is null then raise exception 'Nie ma takiego konta'; end if;
  if p_confirm is null or lower(trim(p_confirm)) <> lower(v_name) then
    raise exception 'CONFIRM_REQUIRED: wpisz login użytkownika, aby potwierdzić';
  end if;
  if v_cur = p_value then return; end if;
  if not p_value then
    if p_user_id = auth.uid() then raise exception 'Nie możesz odebrać uprawnień samemu sobie'; end if;
    select count(*) into v_admins from public.profiles where is_admin;
    if v_admins <= 1 then raise exception 'Musi zostać przynajmniej jeden administrator'; end if;
  end if;
  update public.profiles set is_admin = p_value where id = p_user_id;
  insert into public.admin_audit(actor_id, actor_name, target_id, target_name, action)
    values (auth.uid(), public._my_username(), p_user_id, v_name, case when p_value then 'grant_admin' else 'revoke_admin' end);
end $$;

revoke all on function public.admin_list_admins() from public, anon;
revoke all on function public.admin_set_admin(uuid, boolean, text) from public, anon;
revoke all on function public.approve_admin_request(uuid, text) from public, anon;
revoke all on function public.reject_admin_request(uuid) from public, anon;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean, text) to authenticated;
grant execute on function public.approve_admin_request(uuid, text) to authenticated;
grant execute on function public.reject_admin_request(uuid) to authenticated;

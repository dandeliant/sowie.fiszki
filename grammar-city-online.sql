-- ═══════════════════════════════════════════════════════════════
--  #68 Grammar City — gra online z klasą (Supabase Realtime)
--
--  Gracze z tej samej klasy widzą się nawzajem w grze (pozycja, pojazd, strój,
--  ksywka). Bez czatu i wiadomości między graczami.
--
--  1) RPC gc_my_classes() — klasy zalogowanego użytkownika (jako członek klasy
--     lub nauczyciel-właściciel) + jego nazwa w grze (ksywka #61 albo login).
--     Uczeń nie ma SELECT na class_members, dlatego SECURITY DEFINER.
--  2) Autoryzacja kanałów Realtime (prywatne kanały): temat „gc:<class_id>:<mapa>”.
--     Odbierać i nadawać może tylko członek klasy, jej nauczyciel albo admin.
--     Bez tej części klient i tak łączy się tylko z kanałami prywatnymi, więc
--     brak polityk = brak gry online (bezpiecznie).
--
--  Wymaga: #20 (_is_admin), #61 (profiles.nickname — opcjonalnie).
--  Idempotentna. Uruchom w Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- czy bieżący użytkownik może dołączyć do pokoju klasy (tekstowe id — odporne na złe tematy)
create or replace function public._gc_can_join(p_class text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_ok boolean := false;
begin
  if auth.uid() is null or p_class is null or p_class = '' then
    return false;
  end if;
  select exists (
    select 1 from public.classes c
    where c.id::text = p_class
      and (c.admin_id = auth.uid()
           or exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = auth.uid())
           or public._is_admin())
  ) into v_ok;
  return coalesce(v_ok, false);
end;
$$;

-- klasy użytkownika + nazwa w grze
create or replace function public.gc_my_classes()
returns table (class_id uuid, class_name text, role text, my_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_name text;
  v_has_nick boolean;
begin
  if v_me is null then
    return;
  end if;
  select exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'nickname')
    into v_has_nick;
  if v_has_nick then
    execute 'select coalesce(nullif(nickname, ''''), username) from public.profiles where id = $1' into v_name using v_me;
  else
    select username into v_name from public.profiles where id = v_me;
  end if;
  return query
    select c.id, c.name::text, 'student'::text, coalesce(v_name, 'Gracz')
    from public.classes c
    join public.class_members m on m.class_id = c.id and m.user_id = v_me
    union
    select c.id, c.name::text, 'teacher'::text, coalesce(v_name, 'Gracz')
    from public.classes c
    where c.admin_id = v_me
    order by 2;
end;
$$;

revoke all on function public._gc_can_join(text) from public;
grant execute on function public._gc_can_join(text) to authenticated;
revoke all on function public.gc_my_classes() from public;
grant execute on function public.gc_my_classes() to authenticated;

-- polityki Realtime (prywatne kanały „gc:<class_id>:<mapa>”)
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'Brak realtime.messages — pomijam polityki Realtime.';
    return;
  end if;
  execute 'drop policy if exists "gc: class members read" on realtime.messages';
  execute 'drop policy if exists "gc: class members write" on realtime.messages';
  execute $p$
    create policy "gc: class members read" on realtime.messages
      for select to authenticated
      using (
        realtime.topic() like 'gc:%'
        and public._gc_can_join(split_part(realtime.topic(), ':', 2))
      )
  $p$;
  execute $p$
    create policy "gc: class members write" on realtime.messages
      for insert to authenticated
      with check (
        realtime.topic() like 'gc:%'
        and public._gc_can_join(split_part(realtime.topic(), ':', 2))
      )
  $p$;
end $$;

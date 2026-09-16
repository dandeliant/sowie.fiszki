-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — zarządzanie kontami (admin): statystyki logowań +
--  trwałe kasowanie z kaskadą rodzica.  Migracja #53 · idempotentna
--
--  1) admin_login_stats() — dla każdego konta zwraca last_sign_in_at
--     z auth.users (niedostępne przez zwykły SELECT). Admin only.
--  2) admin_delete_user() PRZEPISANE:
--     • uprawnienia: admin (dowolne nie-admin konto) LUB nauczyciel
--       (tylko konta które sam utworzył — created_by = auth.uid()).
--     • kaskada rodzica: po usunięciu ucznia kasuje powiązanego opiekuna
--       TYLKO jeśli nie ma on już żadnego innego dziecka.
--     • odporne na brakujące tabele/kolumny (to_regclass + information_schema),
--       więc działa niezależnie od tego, które migracje uruchomiono.
--
--  Wymaga: fix-rls-recursion.sql (#20) — helpery _is_admin/_is_teacher.
-- ═══════════════════════════════════════════════════════════════

-- ── 1) Statystyki logowań (last_sign_in_at) ──────────────────────
--  Admin → wszystkie konta. Nauczyciel → tylko konta, które sam utworzył
--  (created_by = auth.uid()) — do monitoringu uczniów w widoku „Klasy".
create or replace function public.admin_login_stats()
returns table (user_id uuid, last_sign_in_at timestamptz, auth_created_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if public._is_admin() then
    return query select u.id, u.last_sign_in_at, u.created_at from auth.users u;
  elsif public._is_teacher() then
    return query
      select u.id, u.last_sign_in_at, u.created_at
      from auth.users u
      join public.profiles p on p.id = u.id
      where p.created_by = auth.uid();
  else
    raise exception 'Brak uprawnień';
  end if;
end;
$$;
grant execute on function public.admin_login_stats() to authenticated;

-- ── 2a) Pomocnik: bezpieczne DELETE z tabeli (skip gdy brak tab./kol.) ──
create or replace function public._del_from(p_table text, p_col text, p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.' || p_table) is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = p_table and column_name = p_col
     ) then
    execute format('delete from public.%I where %I = $1', p_table, p_col) using p_uid;
  end if;
end;
$$;

-- ── 2b) Pomocnik: usuń jedno konto + wszystkie powiązane dane ──────
create or replace function public._delete_account_rows(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Własne podręczniki nauczyciela: usuń słowa/unity zanim skasujemy książki
  if to_regclass('public.admin_books') is not null then
    if to_regclass('public.admin_words') is not null then
      execute 'delete from public.admin_words where book_id in (select book_id from public.admin_books where created_by = $1)' using p_uid;
    end if;
    if to_regclass('public.admin_units') is not null then
      execute 'delete from public.admin_units where book_id in (select book_id from public.admin_books where created_by = $1)' using p_uid;
    end if;
  end if;

  -- Dane ucznia / użytkownika
  perform public._del_from('user_books',           'user_id',        p_uid);
  perform public._del_from('class_members',         'user_id',        p_uid);
  perform public._del_from('unit_progress',         'user_id',        p_uid);
  perform public._del_from('admin_requests',        'user_id',        p_uid);
  perform public._del_from('daily_xp_log',          'user_id',        p_uid);
  perform public._del_from('typed_answers',         'user_id',        p_uid);
  perform public._del_from('grade_disabled_weeks',  'user_id',        p_uid);
  perform public._del_from('book_access_requests',  'user_id',        p_uid);
  perform public._del_from('shop_events',           'user_id',        p_uid);
  perform public._del_from('conversations',         'user_id',        p_uid);

  -- Etykiety (obie strony)
  perform public._del_from('user_labels',           'labeler_id',     p_uid);
  perform public._del_from('user_labels',           'target_user_id', p_uid);

  -- Treści tworzone przez nauczyciela/admina
  perform public._del_from('teacher_sets',          'created_by',     p_uid);
  perform public._del_from('book_notes',            'created_by',     p_uid);
  perform public._del_from('dialogs',               'created_by',     p_uid);
  perform public._del_from('class_challenges',      'created_by',     p_uid);
  perform public._del_from('classes',               'admin_id',       p_uid);
  perform public._del_from('admin_books',           'created_by',     p_uid);
  perform public._del_from('word_audio',            'uploaded_by',    p_uid);
  perform public._del_from('word_sentences',        'updated_by',     p_uid);

  -- Relacje rodzic↔dziecko (i tak kaskadują z profiles, ale czyścimy jawnie)
  perform public._del_from('parent_children',       'parent_id',      p_uid);
  perform public._del_from('parent_children',       'child_id',       p_uid);

  -- Profil + konto auth (reszta tabel z FK ON DELETE CASCADE zniknie sama)
  delete from public.profiles where id = p_uid;
  delete from auth.users where id = p_uid;
end;
$$;

-- ── 2c) Główny RPC: usuń użytkownika (z kaskadą rodzica) ──────────
create or replace function public.admin_delete_user(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_is_admin   boolean := public._is_admin();
  v_is_teacher boolean := public._is_teacher();
  v_tgt_admin  boolean;
  v_creator    uuid;
  v_parents    uuid[];
  v_pid        uuid;
begin
  if target_user_id = auth.uid() then
    raise exception 'Nie możesz usunąć własnego konta';
  end if;

  select is_admin, created_by into v_tgt_admin, v_creator
  from public.profiles where id = target_user_id;

  if v_tgt_admin then
    raise exception 'Nie możesz usunąć konta administratora';
  end if;

  -- Uprawnienia: admin → dowolne nie-admin konto; nauczyciel → tylko własne.
  if not v_is_admin then
    if not (v_is_teacher and v_creator = auth.uid()) then
      raise exception 'Brak uprawnień do usunięcia tego konta';
    end if;
  end if;

  -- Zbierz opiekunów powiązanych z tym uczniem (przed usunięciem).
  select array_agg(parent_id) into v_parents
  from public.parent_children where child_id = target_user_id;

  -- Usuń ucznia (kaskada usuwa też wpisy w parent_children).
  perform public._delete_account_rows(target_user_id);

  -- Usuń opiekunów, którzy zostali BEZ dzieci.
  if v_parents is not null then
    foreach v_pid in array v_parents loop
      if not exists (select 1 from public.parent_children where parent_id = v_pid)
         and not exists (select 1 from public.profiles where id = v_pid and is_admin = true)
         -- nauczyciel może skasować tylko opiekuna, którego sam utworzył
         and (v_is_admin or exists (
                select 1 from public.profiles where id = v_pid and created_by = auth.uid()))
      then
        perform public._delete_account_rows(v_pid);
      end if;
    end loop;
  end if;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

select 'OK — migracja #53 (admin_login_stats + kaskadowe kasowanie) gotowa' as status;

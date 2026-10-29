-- ═══════════════════════════════════════════════════════════════════
--  84) POPRAWKI Z „SECURITY ADVISOR” SUPABASE (29.10.2026)
-- ═══════════════════════════════════════════════════════════════════
--  KRYTYCZNE: public._del_from i public._delete_account_rows (#53) to
--  funkcje SECURITY DEFINER bez sprawdzania uprawnień — miały być tylko
--  pomocnikami admin_delete_user / delete_own_account. Supabase nadaje
--  jednak KAŻDEJ nowej funkcji w schemacie public EXECUTE dla anon
--  i authenticated (domyślne uprawnienia), a „revoke … from public” tego
--  nie zdejmuje. Przez to każdy — także bez logowania, bo klucz anon jest
--  publiczny — mógł przez /rest/v1/rpc/… skasować dowolne konto (także
--  administratora) albo wiersze z dowolnej tabeli. Ta migracja to zamyka.
--
--  1) Funkcje wewnętrzne — wykonuje je tylko właściciel (czyli inne
--     funkcje SECURITY DEFINER, np. admin_delete_user).
--  2) anon (niezalogowani) traci EXECUTE na funkcjach SECURITY DEFINER,
--     poza tymi, których potrzebują goście (rejestracja, prośba o admina
--     ze strony logowania, LIVE z PIN-em, Listy przyjaźni, tablice z linku)
--     i funkcjami używanymi w politykach RLS (_is_admin, _can_… itd.).
--     Uprawnienia authenticated i service_role zostają takie jak były.
--  3) search_path dla 12 funkcji (lint 0011).
--  4) Bucket avatars: bez listowania wszystkich zdjęć (lint 0025) —
--     zdjęcia nadal wyświetlają się przez publiczny URL.
--  5) Formularz kontaktowy: wiadomość z formularza nie może od razu być
--     „przeczytana” / „odpowiedziana” / z notatką admina (lint 0024).
--  Bez zmian w aplikacji. Idempotentna.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) Funkcje wewnętrzne: tylko właściciel ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public._del_from(text,text,uuid)',        -- DELETE z dowolnej tabeli
    'public._delete_account_rows(uuid)',       -- usunięcie konta + danych
    'public.get_profile_by_username(text)',    -- login → UUID; nieużywana
    'public._avatar_queue_old()',              -- funkcja wyzwalacza
    'public.handle_new_user()'                 -- funkcja wyzwalacza (auth.users)
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
    end if;
  end loop;
end $$;

-- ── 2) anon: tylko to, czego naprawdę potrzebują goście ─────────────
do $$
declare
  r record;
  v_auth boolean;
  v_srv  boolean;
begin
  for r in
    select p.oid, p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.prokind = 'f'
       and p.prorettype <> 'trigger'::regtype
       and has_function_privilege('anon', p.oid, 'EXECUTE')
       -- pomocnicze sprawdzanie uprawnień (_is_admin, _can_…, _owns_class…)
       and p.proname !~ '^_'
       and p.proname not in (
             'is_admin', 'is_teacher',
             'check_username_exists',        -- rejestracja (przed założeniem konta)
             'submit_admin_request',         -- prośba o admina ze strony logowania
             'join_live_game',               -- LIVE: uczeń dołącza PIN-em bez konta
             'update_live_player_score',
             'penpal_submit', 'penpal_get_own', 'penpal_update_own',   -- Listy przyjaźni
             'notesownik_get_board', 'sowiemysli_get_map')             -- tablice z linku
       -- funkcja użyta w jakiejkolwiek polityce RLS (też storage / realtime)
       and not exists (
             select 1 from pg_policies pol
              where coalesce(pol.qual, '')       ~ ('\m' || p.proname || '\(')
                 or coalesce(pol.with_check, '') ~ ('\m' || p.proname || '\('))
  loop
    v_auth := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    v_srv  := has_function_privilege('service_role',  r.oid, 'EXECUTE');
    execute format('revoke execute on function %s from public, anon', r.sig);
    -- authenticated / service_role mogły mieć EXECUTE tylko przez PUBLIC — zostawiamy
    if v_auth then execute format('grant execute on function %s to authenticated', r.sig); end if;
    if v_srv  then execute format('grant execute on function %s to service_role',  r.sig); end if;
  end loop;
end $$;

-- ── 3) Stały search_path (lint 0011) ────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('tf_book_notes_updated_at', 'tf_teacher_sets_updated_at', 'tf_dialogs_updated_at',
                         'count_unread_contact_messages', '_duel_q_seconds', '_pet_phrases_stamp',
                         '_nickname_ok', '_profiles_nickname_guard', '_safe_ts',
                         '_quiz_norm', '_quiz_fold', '_quiz_grade_from_pct')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
                        where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end $$;

-- ── 4) Bucket avatars: bez listowania (lint 0025) ───────────────────
--  Publiczny bucket nie potrzebuje polityki SELECT do wyświetlania zdjęć
--  (/storage/v1/object/public/…). SELECT zostaje tylko dla tych, którzy
--  mogą plik skasować — Storage wymaga go przy remove().
do $$
begin
  if to_regclass('storage.objects') is not null
     and to_regprocedure('public._can_delete_avatar_object(text)') is not null then
    drop policy if exists "avatars_select_all" on storage.objects;
    drop policy if exists "avatars_select_own_or_mod" on storage.objects;
    create policy "avatars_select_own_or_mod" on storage.objects
      for select to authenticated
      using (bucket_id = 'avatars' and public._can_delete_avatar_object(name));
  end if;
end $$;

-- ── 5) Formularz kontaktowy (lint 0024) ─────────────────────────────
do $$
begin
  if to_regclass('public.public_contact_messages') is not null then
    drop policy if exists "pcm_insert_anyone" on public.public_contact_messages;
    create policy "pcm_insert_anyone" on public.public_contact_messages
      for insert
      with check (is_read = false and is_replied = false and notes is null);
  end if;
end $$;

-- ── Kontrola: funkcje SECURITY DEFINER, które nadal może wywołać anon ──
--  (powinny zostać tylko pomocnicze z polityk RLS i lista dla gości)
select p.proname as "anon może wywołać"
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
   and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by 1;

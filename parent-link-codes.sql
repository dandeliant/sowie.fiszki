-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — dodawanie dziecka przez opiekuna KODEM, nie loginem
--  Migracja #76 · idempotentna
--
--  Problem: rolę „Rodzic/Opiekun" może wybrać każdy przy rejestracji,
--  a parent_add_child(p_child_id) + find_user_by_username pozwalały dodać
--  DOWOLNEGO ucznia po samym loginie (a polityka pc_insert_parent — nawet
--  wstawić relację wprost do parent_children). Opiekun widzi potem postępy,
--  historię nauki, odpowiedzi z trybu Wpisz itd.
--
--  Rozwiązanie: jednorazowy kod połączenia (8 znaków, np. „K7MP-2XQD",
--  ważny 7 dni). Kod generuje:
--    • sam uczeń (Moje konto → 👨‍👩‍👧 Kod dla opiekuna),
--    • nauczyciel tego ucznia lub admin (⚙️ Ustawienia konta ucznia).
--  Opiekun wpisuje kod w „👶 Dodaj dziecko". Nowy kod unieważnia poprzedni.
--  Błędne próby: max 10 na godzinę na opiekuna (kod ma ~40 bitów losowości).
--
--  Zmiany:
--    • tabele parent_link_codes, parent_code_attempts (RLS bez polityk —
--      dostęp tylko przez RPC)
--    • RPC parent_code_create / parent_code_get / parent_code_revoke /
--      parent_add_child_by_code / my_parents
--    • parent_add_child(uuid) — wyłączone (stare wersje aplikacji dostaną komunikat)
--    • pc_insert_parent — usunięta (bez bezpośredniego INSERT do parent_children)
--    • find_user_by_username — tylko admin/nauczyciel
--  Masowe tworzenie kont z opiekunami (admin_link_parent_to_student, #38/#75)
--  działa bez zmian. Istniejące powiązania zostają.
--
--  Wymaga: #17 (parent_children), #20, #75 (_is_teacher_of).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Tabele ────────────────────────────────────────────────────

create table if not exists public.parent_link_codes (
  code        text primary key check (code ~ '^[A-Z0-9]{8}$'),
  child_id    uuid not null references auth.users(id) on delete cascade,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz,
  revoked_at  timestamptz
);
create index if not exists idx_plc_child   on public.parent_link_codes (child_id);
create index if not exists idx_plc_creator on public.parent_link_codes (created_by, created_at desc);

create table if not exists public.parent_code_attempts (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  at       timestamptz not null default now(),
  ok       boolean not null default false
);
create index if not exists idx_pca_user_at on public.parent_code_attempts (user_id, at desc);

alter table public.parent_link_codes    enable row level security;
alter table public.parent_code_attempts enable row level security;
-- Bez polityk: z aplikacji wyłącznie przez RPC poniżej.
revoke all on public.parent_link_codes    from anon, authenticated;
revoke all on public.parent_code_attempts from anon, authenticated;

-- ── 2. Helpery ───────────────────────────────────────────────────

-- Czy konto jest zwykłym uczniem (nie admin / nauczyciel / opiekun)?
create or replace function public._pc_is_student(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = p_user
       and coalesce(is_admin, false) = false
       and coalesce(is_teacher, false) = false
       and coalesce(is_parent, false) = false);
$$;

-- Losowy kod 8 znaków (bez 0/O, 1/I/L). Bajty z gen_random_uuid()
-- (silny generator) — bez potrzeby rozszerzenia pgcrypto.
create or replace function public._pc_new_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid());
  idx int[] := array[0,1,2,3,4,5,10,11];   -- pomijamy bajty wersji/wariantu UUID
  out text := '';
  i int;
begin
  foreach i in array idx loop
    out := out || substr(abc, 1 + get_byte(b, i) % 31, 1);
  end loop;
  return out;
end;
$$;

-- ── 3. RPC: kod ucznia ───────────────────────────────────────────

-- Nowy kod dla ucznia (p_child NULL = dla siebie). Unieważnia poprzedni.
create or replace function public.parent_code_create(p_child uuid default null)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_child uuid := coalesce(p_child, auth.uid());
  v_code  text;
  v_exp   timestamptz := now() + interval '7 days';
  n       int := 0;
begin
  if v_uid is null then raise exception 'Musisz być zalogowany.'; end if;
  if not public._pc_is_student(v_child) then
    raise exception 'Kod dla opiekuna można utworzyć tylko dla konta ucznia.';
  end if;
  if not (v_child = v_uid or public._is_teacher_of(v_child)) then
    raise exception 'Brak uprawnień do tego ucznia.';
  end if;
  if (select count(*) from public.parent_link_codes c
       where c.created_by = v_uid and c.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Za dużo kodów w ciągu godziny — spróbuj później.';
  end if;

  update public.parent_link_codes c set revoked_at = now()
   where c.child_id = v_child and c.used_at is null and c.revoked_at is null;

  loop
    v_code := public._pc_new_code();
    begin
      insert into public.parent_link_codes (code, child_id, created_by, expires_at)
      values (v_code, v_child, v_uid, v_exp);
      exit;
    exception when unique_violation then
      n := n + 1;
      if n > 5 then raise; end if;
    end;
  end loop;

  return query select v_code, v_exp;
end;
$$;

-- Aktywny kod ucznia (do ponownego pokazania). Pusto, gdy brak lub brak uprawnień.
create or replace function public.parent_code_get(p_child uuid default null)
returns table (code text, expires_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select c.code, c.expires_at
    from public.parent_link_codes c
   where c.child_id = coalesce(p_child, auth.uid())
     and (c.child_id = auth.uid() or public._is_teacher_of(c.child_id))
     and c.used_at is null and c.revoked_at is null and c.expires_at > now()
   order by c.created_at desc
   limit 1;
$$;

-- Unieważnij aktywny kod ucznia. Zwraca liczbę unieważnionych.
create or replace function public.parent_code_revoke(p_child uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child uuid := coalesce(p_child, auth.uid());
  n int;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if not (v_child = auth.uid() or public._is_teacher_of(v_child)) then
    raise exception 'Brak uprawnień do tego ucznia.';
  end if;
  update public.parent_link_codes c set revoked_at = now()
   where c.child_id = v_child and c.used_at is null and c.revoked_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── 4. RPC: opiekun wpisuje kod ──────────────────────────────────
-- Zwraca jsonb zamiast wyjątku, żeby nieudana próba została zapisana
-- (wyjątek wycofałby wpis w parent_code_attempts).
--   {ok:true, child_id, username} | {ok:false, error: AUTH|NOT_PARENT|LIMIT|BAD_CODE|NOT_STUDENT|ALREADY}
create or replace function public.parent_add_child_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  r      public.parent_link_codes%rowtype;
  v_name text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  if not exists (select 1 from public.profiles where id = v_uid and coalesce(is_parent, false)) then
    return jsonb_build_object('ok', false, 'error', 'NOT_PARENT');
  end if;
  if (select count(*) from public.parent_code_attempts a
       where a.user_id = v_uid and not a.ok and a.at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'LIMIT');
  end if;

  select * into r from public.parent_link_codes c
   where c.code = v_code and c.used_at is null and c.revoked_at is null and c.expires_at > now()
   for update;

  if not found or r.child_id = v_uid then
    insert into public.parent_code_attempts (user_id, ok) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'BAD_CODE');
  end if;
  if not public._pc_is_student(r.child_id) then
    return jsonb_build_object('ok', false, 'error', 'NOT_STUDENT');
  end if;
  if exists (select 1 from public.parent_children where parent_id = v_uid and child_id = r.child_id) then
    return jsonb_build_object('ok', false, 'error', 'ALREADY');
  end if;

  insert into public.parent_children (parent_id, child_id) values (v_uid, r.child_id);
  update public.parent_link_codes set used_by = v_uid, used_at = now() where code = r.code;
  insert into public.parent_code_attempts (user_id, ok) values (v_uid, true);
  select username into v_name from public.profiles where id = r.child_id;

  return jsonb_build_object('ok', true, 'child_id', r.child_id, 'username', v_name);
end;
$$;

-- Uczeń widzi, kto jest podpięty jako jego opiekun.
create or replace function public.my_parents()
returns table (username text, linked_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select p.username, pc.created_at
    from public.parent_children pc
    join public.profiles p on p.id = pc.parent_id
   where pc.child_id = auth.uid()
   order by pc.created_at;
$$;

grant execute on function public.parent_code_create(uuid)       to authenticated;
grant execute on function public.parent_code_get(uuid)          to authenticated;
grant execute on function public.parent_code_revoke(uuid)       to authenticated;
grant execute on function public.parent_add_child_by_code(text) to authenticated;
grant execute on function public.my_parents()                   to authenticated;
revoke all on function public._pc_new_code() from public, anon, authenticated;

-- ── 5. Stare ścieżki — zamknięte ─────────────────────────────────

-- Bezpośredni INSERT do parent_children (fallback starego db.js) — usunięty.
drop policy if exists "pc_insert_parent" on public.parent_children;

-- parent_add_child(uuid) z #fix-parent-add-child — wyłączone (sygnatura bez zmian,
-- żeby stara wersja aplikacji z pamięci podręcznej dostała czytelny komunikat).
create or replace function public.parent_add_child(p_child_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Dziecko dodaje się teraz kodem. Poproś dziecko o kod (👤 Moje konto → 👨‍👩‍👧 Kod dla opiekuna) albo poproś o niego nauczyciela.';
end;
$$;

-- find_user_by_username — zwracało id i role DOWOLNEGO konta każdemu
-- zalogowanemu. Teraz tylko admin / nauczyciel (opiekun już go nie potrzebuje).
create or replace function public.find_user_by_username(p_username text)
returns table (id uuid, username text, is_admin boolean, is_teacher boolean, is_parent boolean)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.is_admin, p.is_teacher, p.is_parent
    from public.profiles p
   where p.username = trim(p_username)
     and (public._is_admin() or public._is_teacher())
   limit 1;
$$;

select 'OK — kody dla opiekuna gotowe (#76).' as status;

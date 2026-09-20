-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — ZALEGŁE MIGRACJE #49–#54 (do jednorazowego wklejenia)
--  Uruchom CAŁOŚĆ w Supabase → SQL Editor → New query → Run.
--  Każda część jest idempotentna (można puścić ponownie bez szkody).
--  Kolejność ma znaczenie — nie zmieniaj.
-- ═══════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRACJA #49 — shop-schema.sql
-- ╚═══════════════════════════════════════════════════════════╝
-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — Sklep (materiały cyfrowe) + analityka
--  Migracja #49  ·  idempotentna (można uruchomić ponownie)
--
--  Tworzy:
--    • public.shop_products  — produkty/materiały do pobrania
--    • public.shop_events    — analityka (wejścia, pobrania, kliknięcia)
--    • RPC shop_stats()      — zagregowane statystyki (admin only)
--    • Storage bucket 'shop-files' (publiczny odczyt, zapis admin)
--
--  Wymaga wcześniej: fix-rls-recursion.sql (#20) — helper public._is_admin()
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Produkty ──────────────────────────────────────────────────
create table if not exists public.shop_products (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  short_desc    text,
  long_desc     text,
  category      text,                       -- np. 'karty-pracy','gry','testy','plany'
  audience      text not null default 'both'
                  check (audience in ('teacher','student','both','parent')),
  cover_emoji   text default '📄',
  cover_url     text,                        -- opcjonalna miniatura (URL)
  price_grosze  integer not null default 0 check (price_grosze >= 0),
  currency      text not null default 'PLN',
  is_free       boolean not null default true,
  file_url      text,                        -- link do pobrania pliku (Storage/zewnętrzny)
  external_url  text,                        -- alternatywnie: link do materiału
  badge         text,                        -- np. 'Nowość','Bestseller'
  is_published  boolean not null default false,
  sort_order    integer not null default 0,
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists shop_products_pub_idx  on public.shop_products (is_published, sort_order);
create index if not exists shop_products_cat_idx  on public.shop_products (category);

-- Aktualizacja CHECK audience (dla baz, w ktorych tabela juz istniala bez 'parent')
alter table public.shop_products drop constraint if exists shop_products_audience_check;
alter table public.shop_products
  add constraint shop_products_audience_check check (audience in ('teacher','student','both','parent'));

-- ─── Analityka (zdarzenia) ─────────────────────────────────────
create table if not exists public.shop_events (
  id          bigint generated always as identity primary key,
  product_id  uuid references public.shop_products(id) on delete set null,
  event_type  text not null
                check (event_type in ('view_shop','view_product','click_download','click_link','click_buy')),
  path        text,
  referrer    text,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists shop_events_prod_idx on public.shop_events (product_id, event_type);
create index if not exists shop_events_time_idx on public.shop_events (created_at);

-- ─── RLS ───────────────────────────────────────────────────────
alter table public.shop_products enable row level security;
alter table public.shop_events   enable row level security;

-- Produkty: opublikowane widoczne dla wszystkich (także anon); admin widzi wszystko
drop policy if exists shop_products_select on public.shop_products;
create policy shop_products_select on public.shop_products
  for select using ( is_published = true or public._is_admin() );

drop policy if exists shop_products_ins on public.shop_products;
create policy shop_products_ins on public.shop_products
  for insert with check ( public._is_admin() );

drop policy if exists shop_products_upd on public.shop_products;
create policy shop_products_upd on public.shop_products
  for update using ( public._is_admin() ) with check ( public._is_admin() );

drop policy if exists shop_products_del on public.shop_products;
create policy shop_products_del on public.shop_products
  for delete using ( public._is_admin() );

-- Zdarzenia: każdy (także anon) może zalogować wejście/kliknięcie
-- (tylko dozwolone typy); odczyt tylko admin.
drop policy if exists shop_events_ins on public.shop_events;
create policy shop_events_ins on public.shop_events
  for insert with check (
    event_type in ('view_shop','view_product','click_download','click_link','click_buy')
  );

drop policy if exists shop_events_select on public.shop_events;
create policy shop_events_select on public.shop_events
  for select using ( public._is_admin() );

-- ─── GRANT-y (Supabase Data API) ───────────────────────────────
grant select                       on public.shop_products to anon, authenticated;
grant insert, update, delete       on public.shop_products to authenticated;
grant select, insert               on public.shop_events   to anon, authenticated;

-- ─── RPC: zagregowane statystyki (admin only) ──────────────────
create or replace function public.shop_stats()
returns table (
  product_id   uuid,
  title        text,
  is_published boolean,
  views        bigint,
  downloads    bigint,
  link_clicks  bigint,
  buy_clicks   bigint
)
language sql security definer set search_path = public as $$
  select p.id, p.title, p.is_published,
    count(*) filter (where e.event_type = 'view_product')   as views,
    count(*) filter (where e.event_type = 'click_download') as downloads,
    count(*) filter (where e.event_type = 'click_link')     as link_clicks,
    count(*) filter (where e.event_type = 'click_buy')      as buy_clicks
  from public.shop_products p
  left join public.shop_events e on e.product_id = p.id
  where public._is_admin()
  group by p.id, p.title, p.is_published
  order by views desc nulls last, p.sort_order;
$$;

grant execute on function public.shop_stats() to anon, authenticated;

-- RPC: łączna liczba wejść na sklep (view_shop) — dla dashboardu admina
create or replace function public.shop_total_visits()
returns bigint
language sql security definer set search_path = public as $$
  select count(*) from public.shop_events
  where event_type = 'view_shop' and public._is_admin();
$$;

grant execute on function public.shop_total_visits() to anon, authenticated;

-- ─── Storage: bucket na pliki do pobrania ──────────────────────
insert into storage.buckets (id, name, public)
values ('shop-files', 'shop-files', true)
on conflict (id) do nothing;

-- Odczyt publiczny (pobieranie darmowych materiałów)
drop policy if exists shop_files_read on storage.objects;
create policy shop_files_read on storage.objects
  for select using ( bucket_id = 'shop-files' );

-- Zapis/edycja/usuwanie tylko admin
drop policy if exists shop_files_write on storage.objects;
create policy shop_files_write on storage.objects
  for insert with check ( bucket_id = 'shop-files' and public._is_admin() );

drop policy if exists shop_files_update on storage.objects;
create policy shop_files_update on storage.objects
  for update using ( bucket_id = 'shop-files' and public._is_admin() );

drop policy if exists shop_files_delete on storage.objects;
create policy shop_files_delete on storage.objects
  for delete using ( bucket_id = 'shop-files' and public._is_admin() );


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRACJA #50 — add-typed-days.sql
-- ╚═══════════════════════════════════════════════════════════╝
-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — dni pracy w trybie „Wpisz" (do oceny tygodniowej)
--  Migracja #50 · idempotentna
--
--  Ocena tygodniowa opiera się na liczbie DNI w tygodniu, w których
--  uczeń pracował w trybie „Wpisz" (type). Rejestrujemy to per-dzień
--  jako flagę w daily_xp_log.
--
--  Wymaga wcześniej: add-daily-xp-history.sql (#21) — tabela daily_xp_log
--  z UNIQUE(user_id, day).
-- ═══════════════════════════════════════════════════════════════

alter table public.daily_xp_log
  add column if not exists typed boolean not null default false;

-- RPC: oznacz dzisiejszy dzień jako „pracował w trybie Wpisz".
-- SECURITY DEFINER — działa dla zalogowanego ucznia (auth.uid()).
create or replace function public.log_typed_day()
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.daily_xp_log (user_id, day, typed)
  values (auth.uid(), current_date, true)
  on conflict (user_id, day) do update set typed = true;
end;
$$;

grant execute on function public.log_typed_day() to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRACJA #51 — typed-answers-schema.sql
-- ╚═══════════════════════════════════════════════════════════╝
-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — Szczegóły „Wpisz" (log odpowiedzi z trybu Wpisz)
--  Migracja #51 · idempotentna
--
--  Zapisuje każdą odpowiedź ucznia w trybie „Wpisz": jakie słowo dostał,
--  co wpisał, czy poprawnie i o której dokładnie godzinie. Nauczyciel widzi
--  raport w postępie ucznia. Retencja: rekordy starsze niż 60 dni są
--  automatycznie usuwane (RPC cleanup_typed_answers wołane po stronie
--  klienta, raz dziennie).
--
--  Wymaga wcześniej: fix-rls-recursion.sql (#20) — helpery _is_admin/_is_teacher.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.typed_answers (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  book_id     text,
  unit_key    text,
  word_pl     text,
  word_en     text,
  prompt      text,          -- co pokazano (słowo/zdanie do przetłumaczenia)
  expected    text,          -- poprawna odpowiedź
  answer      text,          -- co uczeń wpisał
  correct     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists typed_answers_user_time_idx on public.typed_answers (user_id, created_at desc);

alter table public.typed_answers enable row level security;

-- INSERT: tylko własne wiersze (uczeń zapisuje swoje odpowiedzi)
drop policy if exists typed_answers_ins on public.typed_answers;
create policy typed_answers_ins on public.typed_answers
  for insert with check ( user_id = auth.uid() );

-- SELECT: własne LUB nauczyciel/admin (podgląd raportu ucznia)
drop policy if exists typed_answers_sel on public.typed_answers;
create policy typed_answers_sel on public.typed_answers
  for select using ( user_id = auth.uid() or public._is_admin() or public._is_teacher() );

-- DELETE: własne LUB admin (retencja / sprzątanie)
drop policy if exists typed_answers_del on public.typed_answers;
create policy typed_answers_del on public.typed_answers
  for delete using ( user_id = auth.uid() or public._is_admin() );

grant select, insert, delete on public.typed_answers to authenticated;

-- Retencja: usuwa własne rekordy starsze niż 60 dni (2 miesiące).
create or replace function public.cleanup_typed_answers()
returns void
language sql security definer set search_path = public as $$
  delete from public.typed_answers
  where user_id = auth.uid() and created_at < now() - interval '60 days';
$$;

grant execute on function public.cleanup_typed_answers() to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRACJA #52 — grade-disabled-weeks.sql
-- ╚═══════════════════════════════════════════════════════════╝
-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — wyłączone tygodnie (nauczyciel) do oceny sugerowanej
--  Migracja #52 · idempotentna
--
--  Nauczyciel może wyłączyć wystawianie oceny tygodniowej w konkretnym
--  tygodniu (święta, zielona szkoła). Wyłączony tydzień NIE jest brany
--  pod uwagę przy liczeniu oceny miesięcznej.
--
--  Zakres per-uczeń: (user_id, week_start). week_start = poniedziałek (DATE).
--  Wymaga: fix-rls-recursion.sql (#20) — helpery _is_admin/_is_teacher.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.grade_disabled_weeks (
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,
  disabled_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.grade_disabled_weeks enable row level security;

-- SELECT: własne (uczeń widzi swoje) LUB nauczyciel/admin
drop policy if exists gdw_sel on public.grade_disabled_weeks;
create policy gdw_sel on public.grade_disabled_weeks
  for select using ( user_id = auth.uid() or public._is_admin() or public._is_teacher() );

-- INSERT/DELETE: tylko nauczyciel/admin (uczeń nie wyłącza sobie ocen)
drop policy if exists gdw_ins on public.grade_disabled_weeks;
create policy gdw_ins on public.grade_disabled_weeks
  for insert with check ( public._is_admin() or public._is_teacher() );

drop policy if exists gdw_del on public.grade_disabled_weeks;
create policy gdw_del on public.grade_disabled_weeks
  for delete using ( public._is_admin() or public._is_teacher() );

grant select, insert, delete on public.grade_disabled_weeks to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRACJA #53 — admin-account-management.sql
-- ╚═══════════════════════════════════════════════════════════╝
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


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRACJA #54 — add-well-learned-ranking.sql
-- ╚═══════════════════════════════════════════════════════════╝
-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — ranking klasy dla ucznia wg PRZYSWOJONYCH SŁÓWEK
--  Migracja #54 · idempotentna
--
--  Cel: uczeń widzi ranking klasy uszeregowany wg liczby słów opanowanych
--  BARDZO DOBRZE (interval powtórki > 7 dni). To metryka odporna na
--  „klikanie" — słowo dochodzi do tego progu tylko przez rzetelne, rozłożone
--  w czasie powtórki (a tryby z wpisywaniem są ścisłe).
--
--  1) profiles.well_learned_words INT — licznik utrzymywany przez klienta
--     (liczony z lokalnych word_states przez _acqCompute i zapisywany).
--  2) my_class_rankings() rozszerzone o: level, xp_total, well_learned.
--
--  Wymaga: add-ranking-stats.sql (#45) i student-class-ranking.sql (#47).
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists well_learned_words int not null default 0;

-- RETURNS TABLE zmienia sygnaturę → trzeba DROP przed CREATE.
drop function if exists public.my_class_rankings();

create function public.my_class_rankings()
returns table (
  class_id       uuid,
  class_name     text,
  user_id        uuid,
  username       text,
  xp_today       int,
  xp_week        int,
  xp_month       int,
  longest_streak int,
  best_combo     int,
  level          int,
  xp_total       int,
  well_learned   int
)
language sql
security definer
set search_path = public
as $$
  select
    cl.id, cl.name, p.id, p.username,
    coalesce((select sum(d.xp) from public.daily_xp_log d
                where d.user_id = p.id and d.day = current_date), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d
                where d.user_id = p.id and d.day >= current_date - interval '6 days'), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d
                where d.user_id = p.id and d.day >= current_date - interval '30 days'), 0)::int,
    coalesce(p.longest_streak, 0),
    coalesce(p.best_correct_streak, 0),
    coalesce(p.level, 1),
    coalesce(p.xp, 0),
    coalesce(p.well_learned_words, 0)
  from public.class_members me
  join public.class_members cm on cm.class_id = me.class_id
  join public.classes  cl on cl.id = cm.class_id
  join public.profiles p  on p.id = cm.user_id
  where me.user_id = auth.uid()
    and coalesce(p.is_admin, false) = false
    and coalesce(p.is_teacher, false) = false;
$$;

grant execute on function public.my_class_rankings() to authenticated;

select 'OK — migracja #54 (ranking wg przyswojonych slow) gotowa' as status;


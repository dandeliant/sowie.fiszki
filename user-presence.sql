-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — „🟢 Teraz na Sowich Fiszkach” (kto jest teraz w aplikacji
--  i co dokładnie robi)
--  Migracja #83 · idempotentna
--
--  user_presence: JEDEN wiersz na konto = ostatni stan aplikacji:
--    page       — strona ('app', 'skoczek.html', 'grammar-city', …)
--    activity   — kod czynności ('study:type', 'game:memory', 'screen:sStats', …)
--    label      — opis po polsku („✍️ Nauka: Wpisz — Brainy 6 · Unit 3”)
--    book_id / unit_key — podręcznik i rozdział (gdy są)
--    state      — active (używa) / idle (bez ruchu > 2 min) /
--                 hidden (karta w tle) / left (zamknął stronę)
--    started_at — od kiedy trwa ta sama czynność, updated_at — ostatni sygnał
--  Aplikacja wysyła sygnał co ~30 s (tylko gdy karta jest widoczna) i od razu
--  przy zmianie czynności; przy zamknięciu strony — presence_leave().
--
--  Dostęp WYŁĄCZNIE przez RPC (tabela bez polityk RLS + revoke):
--    presence_ping(...)          — zapis własnego wiersza (upsert)
--    presence_leave()            — „wyszedł”
--    presence_online(p_minutes)  — lista osób z sygnałem w ostatnich N minutach:
--        admin      → wszyscy,
--        nauczyciel → tylko swoi uczniowie (_is_teacher_of z #75),
--        opiekun    → swoje dzieci (_is_parent_of z #20),
--        pozostali  → nic.  Admin / nauczyciel / opiekun widzą też siebie.
--  Wiersze bez sygnału > 24 h są kasowane (przy zapisie, losowo ~2% wywołań),
--  usunięcie konta kasuje wiersz (on delete cascade).
--
--  Wymaga: #20 (_is_admin / _is_teacher / _is_parent_of), #75 (_is_teacher_of).
--  Uruchom raz w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._is_teacher_of(uuid)') is null then
    raise exception 'Najpierw uruchom migrację #75 (teacher-scope-rls.sql) — brak funkcji _is_teacher_of.';
  end if;
  if to_regprocedure('public._is_parent_of(uuid)') is null then
    raise exception 'Najpierw uruchom migrację #20 (fix-rls-recursion.sql) — brak funkcji _is_parent_of.';
  end if;
end $$;

-- ── 1. Tabela ────────────────────────────────────────────────────
create table if not exists public.user_presence (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  page       text check (char_length(page)     <= 60),
  activity   text check (char_length(activity) <= 60),
  label      text check (char_length(label)    <= 200),
  book_id    text check (char_length(book_id)  <= 80),
  unit_key   text check (char_length(unit_key) <= 80),
  state      text not null default 'active' check (state in ('active', 'idle', 'hidden', 'left')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_presence_updated on public.user_presence (updated_at desc);

alter table public.user_presence enable row level security;
-- Bez polityk: zwykły SELECT/INSERT/UPDATE/DELETE z aplikacji jest zablokowany.
revoke all on public.user_presence from anon, authenticated;

-- ── 2. Zapis własnego stanu ─────────────────────────────────────
-- Tekst przycinany do limitów kolumn (sygnał nigdy nie wywala się na długości),
-- znaki sterujące → spacja. started_at zostaje, gdy czynność się nie zmieniła
-- (ten sam kod, opis, podręcznik i rozdział) i poprzedni sygnał był < 5 min temu.
create or replace function public.presence_ping(
  p_page     text default null,
  p_activity text default null,
  p_label    text default null,
  p_book     text default null,
  p_unit     text default null,
  p_state    text default 'active'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_state text := case when p_state in ('active', 'idle', 'hidden') then p_state else 'active' end;
  v_page  text := left(nullif(btrim(regexp_replace(coalesce(p_page, ''),     '[[:cntrl:]]', ' ', 'g')), ''), 60);
  v_act   text := left(nullif(btrim(regexp_replace(coalesce(p_activity, ''), '[[:cntrl:]]', ' ', 'g')), ''), 60);
  v_label text := left(nullif(btrim(regexp_replace(coalesce(p_label, ''),    '[[:cntrl:]]', ' ', 'g')), ''), 200);
  v_book  text := left(nullif(btrim(coalesce(p_book, '')), ''), 80);
  v_unit  text := left(nullif(btrim(coalesce(p_unit, '')), ''), 80);
begin
  if v_uid is null then return; end if;   -- gość / brak sesji — nic nie zapisujemy

  insert into public.user_presence as up
         (user_id, page, activity, label, book_id, unit_key, state, started_at, updated_at)
  values (v_uid, v_page, v_act, v_label, v_book, v_unit, v_state, now(), now())
  on conflict (user_id) do update set
    started_at = case
                   when up.activity is not distinct from excluded.activity
                    and up.label    is not distinct from excluded.label
                    and up.book_id  is not distinct from excluded.book_id
                    and up.unit_key is not distinct from excluded.unit_key
                    and up.updated_at > now() - interval '5 minutes'
                   then up.started_at
                   else now()
                 end,
    page       = excluded.page,
    activity   = excluded.activity,
    label      = excluded.label,
    book_id    = excluded.book_id,
    unit_key   = excluded.unit_key,
    state      = excluded.state,
    updated_at = now();

  -- Sprzątanie: stany starsze niż 24 h nie są nikomu potrzebne.
  if random() < 0.02 then
    delete from public.user_presence where updated_at < now() - interval '24 hours';
  end if;
end;
$$;

-- ── 3. Wyjście (zamknięcie strony) ──────────────────────────────
create or replace function public.presence_leave()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_presence
     set state = 'left', updated_at = now()
   where user_id = auth.uid();
$$;

-- ── 4. Kto jest teraz w aplikacji ───────────────────────────────
-- Zwraca osoby z sygnałem w ostatnich p_minutes minutach (1–1440, domyślnie 3),
-- także te, które już wyszły (state = 'left') — klient sam dzieli je na
-- „teraz” i „ostatnio”. idle_sec / activity_sec liczone zegarem serwera.
-- Ksywka, plan i is_parent czytane przez to_jsonb — działa także bez kolumn
-- z późniejszych migracji.
create or replace function public.presence_online(p_minutes integer default 3)
returns table (
  user_id      uuid,
  username     text,
  nickname     text,
  is_admin     boolean,
  is_teacher   boolean,
  is_parent    boolean,
  plan         text,
  page         text,
  activity     text,
  label        text,
  book_id      text,
  unit_key     text,
  state        text,
  started_at   timestamptz,
  updated_at   timestamptz,
  idle_sec     integer,
  activity_sec integer,
  is_me        boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_admin boolean;
  v_staff boolean;
  v_min   integer := greatest(1, least(coalesce(p_minutes, 3), 1440));
begin
  if v_uid is null then return; end if;
  v_admin := public._is_admin();
  v_staff := v_admin
          or public._is_teacher()
          or exists (select 1 from public.parent_children pc where pc.parent_id = v_uid);
  if not v_staff then return; end if;

  return query
    select up.user_id,
           p.username::text,
           nullif(j.pj->>'nickname', '')::text,
           coalesce((j.pj->>'is_admin')::boolean,   false),
           coalesce((j.pj->>'is_teacher')::boolean, false),
           coalesce((j.pj->>'is_parent')::boolean,  false),
           coalesce(j.pj->>'plan', 'free')::text,
           up.page, up.activity, up.label, up.book_id, up.unit_key, up.state,
           up.started_at, up.updated_at,
           greatest(0, extract(epoch from (now() - up.updated_at)))::integer,
           greatest(0, extract(epoch from (now() - up.started_at)))::integer,
           (up.user_id = v_uid)
      from public.user_presence up
      join public.profiles p on p.id = up.user_id
      cross join lateral (select to_jsonb(p) - 'generated_password' - 'pet' as pj) j
     where up.updated_at > now() - make_interval(mins => v_min)
       and (v_admin
            or up.user_id = v_uid
            or public._is_teacher_of(up.user_id)
            or public._is_parent_of(up.user_id))
     order by (up.state = 'left'), up.updated_at desc
     limit 2000;
end;
$$;

-- ── 5. Uprawnienia ──────────────────────────────────────────────
revoke all on function public.presence_ping(text, text, text, text, text, text) from public, anon;
revoke all on function public.presence_leave()                               from public, anon;
revoke all on function public.presence_online(integer)                       from public, anon;
grant execute on function public.presence_ping(text, text, text, text, text, text) to authenticated;
grant execute on function public.presence_leave()                               to authenticated;
grant execute on function public.presence_online(integer)                       to authenticated;

select 'OK — user_presence + presence_ping / presence_leave / presence_online gotowe' as status;

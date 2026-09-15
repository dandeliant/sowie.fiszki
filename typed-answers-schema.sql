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

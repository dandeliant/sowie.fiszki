-- ════════════════════════════════════════════════════════════════════
--  Migracja #99 — ✅ zaliczenie rozdziałów na 100% wybranym uczniom
--  (07.11.2026, SW v1.257)
--
--  Uczniowie zgłaszali, że po zmianach (nowe słówka w rozdziałach, korekty,
--  sprawdzian „Łatwych”) ukończone rozdziały spadły poniżej 100%. Nauczyciel
--  ucznia (albo admin) może teraz zaliczyć wybrane rozdziały na 100%.
--
--  Aplikacja nauczyciela liczy stan słówek (word_states: każde słówko
--  „opanowane”, powtórka za ≥ 14 dni; słówka z „Ignoruj” bez zmian) z listy
--  słówek rozdziału — baza zapisuje go w unit_progress ucznia (RLS pozwala
--  nauczycielowi tylko czytać, dlatego funkcja SECURITY DEFINER).
--
--  1) unit_completions — historia zaliczeń (kto, komu, który rozdział, przed / po)
--  2) teacher_complete_units(p_user, p_rows) — zapis (≤ 80 rozdziałów naraz)
--  3) uprawnienia jak w #84
--
--  last_studied ucznia zostaje bez zmian (zaliczenie przez nauczyciela to nie nauka).
--  Idempotentna.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.unit_completions (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  by_user     uuid references public.profiles(id) on delete set null,
  book_key    text not null,
  unit_key    text not null,
  known_before int,
  known_after  int not null,
  total        int not null,
  at          timestamptz not null default now()
);
create index if not exists unit_completions_user on public.unit_completions (user_id, at desc);
alter table public.unit_completions enable row level security;
revoke all on table public.unit_completions from public, anon, authenticated;
revoke all on sequence public.unit_completions_id_seq from public, anon, authenticated;

--  p_rows: [{ "book": "klasa4", "unit": "unit1", "states": {…word_states…}, "known": 24, "total": 24 }, …]
create or replace function public.teacher_complete_units(p_user uuid, p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me   uuid := auth.uid();
  r    jsonb;
  b    text;
  u    text;
  st   jsonb;
  k    int;
  t    int;
  prev int;
  n    int := 0;
begin
  if me is null then raise exception 'Musisz być zalogowany.' using errcode = '42501'; end if;
  if p_user is null or not public._is_teacher_of(p_user) then
    raise exception 'Brak uprawnień do tego ucznia.' using errcode = '42501';
  end if;
  if p_user = me and not public._is_admin() then
    raise exception 'Nie możesz zaliczać rozdziałów sobie.' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Nie wybrano rozdziałów.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 80 or length(p_rows::text) > 3000000 then
    raise exception 'Za dużo rozdziałów naraz.' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    b  := btrim(coalesce(r ->> 'book', ''));
    u  := btrim(coalesce(r ->> 'unit', ''));
    st := r -> 'states';
    begin
      k := (r ->> 'known')::int;
      t := (r ->> 'total')::int;
    exception when others then
      raise exception 'Nieprawidłowe dane rozdziału.' using errcode = '22023';
    end;
    if b = '' or u = '' or char_length(b) > 80 or char_length(u) > 80 or u = 'all'
       or st is null or jsonb_typeof(st) <> 'object'
       or k is null or t is null or k < 0 or t < 0 or k > t or t > 5000 then
      raise exception 'Nieprawidłowe dane rozdziału.' using errcode = '22023';
    end if;

    select p.known_count into prev from public.unit_progress p
     where p.user_id = p_user and p.book_key = b and p.unit_key = u;

    insert into public.unit_progress (user_id, book_key, unit_key, word_states, known_count, total)
    values (p_user, b, u, st, k, t)
    on conflict (user_id, book_key, unit_key) do update
       set word_states = excluded.word_states,
           known_count = excluded.known_count,
           total       = excluded.total;

    insert into public.unit_completions (user_id, by_user, book_key, unit_key, known_before, known_after, total)
    values (p_user, me, b, u, prev, k, t);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.teacher_complete_units(uuid, jsonb) from public, anon;
grant execute on function public.teacher_complete_units(uuid, jsonb) to authenticated;

select 'OK — migracja #99 (✅ zaliczenie rozdziałów na 100% wybranym uczniom) gotowa' as status;

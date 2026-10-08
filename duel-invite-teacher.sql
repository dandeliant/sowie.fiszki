-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — RYWALIZACJA ONLINE: ZAPRASZANIE NAUCZYCIELA
--  Migracja #63 · idempotentna
--
--  Uczeń może zaprosić do rywalizacji 1 na 1 nauczyciela, który utworzył
--  jego klasę (classes.admin_id). Symetrycznie nauczyciel może zaprosić
--  ucznia ze swojej klasy. Pozostałe zasady bez zmian (tylko zaproszenie,
--  bez wiadomości; limit 8 zaproszeń / 10 min).
--
--  Wymaga: #61 (student-duels.sql).
-- ═══════════════════════════════════════════════════════════════

-- Czy dwie osoby mogą ze sobą rywalizować: ta sama klasa, albo jedna
-- z nich jest właścicielem (twórcą) klasy, do której należy druga.
create or replace function public._duel_can_pair(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.class_members x join public.class_members y on y.class_id = x.class_id
                  where x.user_id = p_a and y.user_id = p_b)
      or exists (select 1 from public.classes c join public.class_members m on m.class_id = c.id
                  where (c.admin_id = p_a and m.user_id = p_b)
                     or (c.admin_id = p_b and m.user_id = p_a));
$$;

-- Wyszukiwanie przeciwnika: koledzy z klasy + nauczyciel (twórca) moich klas
-- + (dla nauczyciela) uczniowie jego klas. Nauczyciel oznaczony w class_name.
create or replace function public.duel_search_players(p_query text)
returns table (user_id uuid, display_name text, class_name text)
language sql
stable
security definer
set search_path = public
as $$
  with cand as (
    -- koledzy z tej samej klasy (bez kont staffu)
    select p.id, coalesce(p.nickname, p.username) as display_name, c.name as class_name, 1 as ord
      from public.class_members me
      join public.class_members cm on cm.class_id = me.class_id
      join public.classes c        on c.id = cm.class_id
      join public.profiles p       on p.id = cm.user_id
     where me.user_id = auth.uid()
       and p.id <> auth.uid()
       and coalesce(p.is_admin, false) = false
       and coalesce(p.is_teacher, false) = false
    union all
    -- nauczyciel, który utworzył moją klasę
    select p.id, coalesce(p.nickname, p.username), '👩‍🏫 Nauczyciel · ' || c.name, 0
      from public.class_members me
      join public.classes c  on c.id = me.class_id
      join public.profiles p on p.id = c.admin_id
     where me.user_id = auth.uid()
       and c.admin_id <> auth.uid()
    union all
    -- uczniowie klas, które utworzyłem (gdy szuka nauczyciel)
    select p.id, coalesce(p.nickname, p.username), c.name, 1
      from public.classes c
      join public.class_members cm on cm.class_id = c.id
      join public.profiles p       on p.id = cm.user_id
     where c.admin_id = auth.uid()
       and p.id <> auth.uid()
       and coalesce(p.is_admin, false) = false
       and coalesce(p.is_teacher, false) = false
  ), filtered as (
    select distinct on (id) id, display_name, class_name, ord
      from cand
     where coalesce(btrim(p_query), '') = ''
        or display_name ilike '%' || btrim(p_query) || '%'
        or exists (select 1 from public.profiles pp where pp.id = cand.id and pp.username ilike '%' || btrim(p_query) || '%')
     order by id, ord, class_name
  )
  select id, display_name, class_name from filtered
   order by ord, display_name
   limit 60;
$$;

-- Utworzenie zaproszenia (Uczeń 1 → Uczeń 2) — z nową regułą parowania.
create or replace function public.duel_create(p_guest uuid, p_book text, p_unit text, p_title text, p_questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n int := jsonb_array_length(coalesce(p_questions, '[]'::jsonb));
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if p_guest = auth.uid() then raise exception 'Nie możesz zaprosić samego siebie.'; end if;
  if v_n < 5 or v_n > 30 then raise exception 'Nieprawidłowa liczba pytań (5–30).'; end if;
  if not public._duel_can_pair(auth.uid(), p_guest) then
    raise exception 'Możesz zaprosić tylko osobę ze swojej klasy albo swojego nauczyciela.';
  end if;
  if (select count(*) from public.duels where host_id = auth.uid() and created_at > now() - interval '10 minutes') >= 8 then
    raise exception 'Za dużo zaproszeń — odczekaj kilka minut.';
  end if;
  update public.duels set status = 'cancelled' where host_id = auth.uid() and status = 'invited';
  insert into public.duels (host_id, guest_id, book_id, unit_key, title, questions)
  values (auth.uid(), p_guest, p_book, p_unit, left(coalesce(p_title, ''), 120), p_questions)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.duel_search_players(text)                  to authenticated;
grant execute on function public.duel_create(uuid, text, text, text, jsonb) to authenticated;

select 'OK — rywalizacja z nauczycielem włączona' as status;

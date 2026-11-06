-- ════════════════════════════════════════════════════════════════════
--  Migracja #97 — ✏️ ustawianie statystyk ucznia + 🧹 −5 XP za wpisywanie byle czego
--  (06.11.2026, SW v1.254)
--
--  1) profiles.stats_epoch — „epoka” licznika odpowiedzi (celność). Korekta
--     nauczyciela ją podbija; karta ucznia sprzed korekty (inna epoka) nie
--     nadpisze już total_answers / correct_answers (jak combo_epoch z #93).
--  2) _profiles_xp_guard — jak w #93 + ochrona licznika odpowiedzi
--  3) admin_set_stats(p_user, p_reason, p_xp, p_combo, p_total, p_correct, p_day)
--     — nauczyciel ucznia / admin ustawia DOKŁADNIE: XP (poziom = XP / 60 + 1),
--     rekord serii 🎯 (w górę albo w dół), liczbę odpowiedzi i poprawnych (celność).
--     XP przez admin_adjust_xp (#93 — też dzienny log i historia), reszta —
--     osobny wpis w historii korekt (xp_adjustments, opis w powodzie).
--  4) penalize_junk_xp() — uczeń: −5 XP za próbę „na chybił-trafił” po
--     ostrzeżeniu (aplikacja), najwyżej 50 XP dziennie; suma kar w xp_flags
--     (rodzaj 'junk', kolumna dropped_xp) — nauczyciel widzi ją przy 🧹.
--  5) uprawnienia jak w #84
--
--  Wymaga #93 (xp_flags, xp_adjustments, admin_adjust_xp) i #94.
--  Idempotentna. UWAGA: ponowne #85 lub #93 przywraca starą wersję
--  _profiles_xp_guard (bez ochrony celności) — potem uruchom #97 jeszcze raz.
-- ════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.admin_adjust_xp(uuid,int,text,date,int)') is null then
    raise exception 'Najpierw uruchom migrację #93 (xp-anticheat.sql).';
  end if;
  if to_regclass('public.xp_flag_seen') is null then
    raise exception 'Najpierw uruchom migrację #94 (learning-integrity.sql).';
  end if;
end $$;

-- ── 1) Epoka licznika odpowiedzi ────────────────────────────────────
alter table public.profiles add column if not exists stats_epoch int not null default 0;

-- ── 2) Strażnik profilu (#93 + licznik odpowiedzi) ──────────────────
create or replace function public._profiles_xp_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allow int;
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.xp := 0;   -- nowy profil zakłada baza (handle_new_user); z aplikacji — bez XP
    else
      -- XP zmieniają tylko add_my_xp, admin_adjust_xp i penalize_junk_xp (#93, #97)
      new.xp := old.xp;
      new.longest_streak := greatest(coalesce(new.longest_streak, 0), coalesce(old.longest_streak, 0));
      new.xp_win_at := old.xp_win_at;
      new.xp_win_xp := old.xp_win_xp;
      if new.combo_epoch is distinct from old.combo_epoch then
        -- karta sprzed korekty serii (inna „epoka”) — rekord zostaje taki, jak w bazie
        new.best_correct_streak := old.best_correct_streak;
      elsif coalesce(new.best_correct_streak, 0) > coalesce(old.best_correct_streak, 0) then
        allow := coalesce(old.best_correct_streak, 0) + least(300, greatest(5,
                 floor(extract(epoch from (now() - coalesce(old.combo_at, now() - interval '1 day'))) * 1.2)::int));
        new.best_correct_streak := least(new.best_correct_streak, allow);
        new.combo_at := now();
      else
        new.best_correct_streak := coalesce(old.best_correct_streak, 0);   -- rekord nie maleje
      end if;
      if new.best_correct_streak = coalesce(old.best_correct_streak, 0) then new.combo_at := old.combo_at; end if;
      new.combo_epoch := old.combo_epoch;
      -- #97: karta sprzed korekty celności (inna „epoka”) — licznik odpowiedzi zostaje taki, jak w bazie
      if new.stats_epoch is distinct from old.stats_epoch then
        new.total_answers   := old.total_answers;
        new.correct_answers := old.correct_answers;
      end if;
      new.stats_epoch := old.stats_epoch;
    end if;
  end if;
  new.level := floor(coalesce(new.xp, 0) / 60.0)::int + 1;
  return new;
end;
$$;
drop trigger if exists profiles_xp_guard on public.profiles;
create trigger profiles_xp_guard before insert or update on public.profiles
  for each row execute function public._profiles_xp_guard();

-- ── 3) Ustawienie statystyk ucznia ──────────────────────────────────
--  Każdy parametr null = bez zmian. p_xp — dokładna liczba XP (różnica idzie
--  przez admin_adjust_xp: dzienny log od dnia p_day / najnowszych, historia).
--  p_combo — rekord serii 🎯 (dowolnie w górę lub w dół). p_total / p_correct —
--  liczba odpowiedzi i poprawnych (celność = poprawne / odpowiedzi); można podać
--  tylko jedno (drugie zostaje), poprawnych nie więcej niż odpowiedzi.
create or replace function public.admin_set_stats(p_user uuid, p_reason text,
                                                  p_xp int default null, p_combo int default null,
                                                  p_total int default null, p_correct int default null,
                                                  p_day date default null)
returns table (new_xp int, new_level int, new_combo int, new_total int, new_correct int)
language plpgsql
security definer
set search_path = public
as $$
declare
  me     uuid := auth.uid();
  why    text := left(btrim(coalesce(p_reason, '')), 300);
  cur    record;
  t      int;
  c      int;
  notes  text[] := '{}';
begin
  if me is null then raise exception 'Musisz być zalogowany.' using errcode = '42501'; end if;
  if p_user is null or not public._is_teacher_of(p_user) then
    raise exception 'Brak uprawnień do tego ucznia.' using errcode = '42501';
  end if;
  if p_user = me and not public._is_admin() then
    raise exception 'Nie możesz poprawiać własnych statystyk.' using errcode = '42501';
  end if;
  if char_length(why) < 3 then raise exception 'Podaj powód korekty (co najmniej 3 znaki).' using errcode = '22023'; end if;
  if p_xp is null and p_combo is null and p_total is null and p_correct is null then
    raise exception 'Nic do zmiany.' using errcode = '22023';
  end if;
  if p_xp is not null and (p_xp < 0 or p_xp > 10000000) then raise exception 'Nieprawidłowa liczba XP.' using errcode = '22023'; end if;
  if p_combo is not null and (p_combo < 0 or p_combo > 100000) then raise exception 'Nieprawidłowy rekord serii.' using errcode = '22023'; end if;
  if (p_total is not null and (p_total < 0 or p_total > 10000000))
     or (p_correct is not null and (p_correct < 0 or p_correct > 10000000)) then
    raise exception 'Nieprawidłowa liczba odpowiedzi.' using errcode = '22023';
  end if;

  select coalesce(p.xp, 0) xp, coalesce(p.best_correct_streak, 0) combo,
         coalesce(p.total_answers, 0) total, coalesce(p.correct_answers, 0) correct
    into cur from public.profiles p where p.id = p_user for update;
  if not found then raise exception 'Nie ma takiego konta.' using errcode = 'P0002'; end if;

  -- XP: różnica przez admin_adjust_xp (log dzienny + historia + własne sprawdzenia)
  if p_xp is not null and p_xp <> cur.xp then
    if p_xp - cur.xp > 100000 then raise exception 'Za duża korekta XP (najwyżej +100 000 naraz).' using errcode = '22023'; end if;
    perform 1 from public.admin_adjust_xp(p_user, p_xp - cur.xp, why, p_day, null);
  end if;

  -- rekord serii 🎯 (w obie strony) i licznik odpowiedzi (celność)
  t := coalesce(p_total, cur.total);
  c := coalesce(p_correct, cur.correct);
  if c > t then raise exception 'Poprawnych odpowiedzi nie może być więcej niż wszystkich.' using errcode = '22023'; end if;
  if p_combo is not null and p_combo <> cur.combo then
    notes := notes || ('🎯 rekord serii ' || cur.combo || ' → ' || p_combo);
  end if;
  if t <> cur.total or c <> cur.correct then
    notes := notes || ('🎯 celność ' || cur.correct || '/' || cur.total
      || case when cur.total > 0 then ' (' || round(cur.correct * 100.0 / cur.total) || '%)' else '' end
      || ' → ' || c || '/' || t || case when t > 0 then ' (' || round(c * 100.0 / t) || '%)' else '' end);
  end if;
  if array_length(notes, 1) > 0 then
    update public.profiles p
       set best_correct_streak = coalesce(p_combo, p.best_correct_streak),
           combo_epoch = case when p_combo is not null and p_combo <> cur.combo then coalesce(p.combo_epoch, 0) + 1 else p.combo_epoch end,
           combo_at    = case when p_combo is not null and p_combo <> cur.combo then now() else p.combo_at end,
           total_answers   = t,
           correct_answers = c,
           stats_epoch = case when t <> cur.total or c <> cur.correct then coalesce(p.stats_epoch, 0) + 1 else p.stats_epoch end
     where p.id = p_user;
    insert into public.xp_adjustments (user_id, by_user, requested, delta, day, log_delta,
                                       combo_from, combo_to, xp_before, xp_after, reason)
    select p_user, me, 0, 0, null, 0,
           case when p_combo is not null and p_combo <> cur.combo then cur.combo end,
           case when p_combo is not null and p_combo <> cur.combo then p_combo end,
           p.xp, p.xp, left(why || ' · ' || array_to_string(notes, ' · '), 600)
      from public.profiles p where p.id = p_user;
  end if;

  return query
  select coalesce(p.xp, 0), floor(coalesce(p.xp, 0) / 60.0)::int + 1, coalesce(p.best_correct_streak, 0),
         coalesce(p.total_answers, 0), coalesce(p.correct_answers, 0)
    from public.profiles p where p.id = p_user;
end;
$$;

-- ── 4) 🧹 −5 XP za wpisywanie byle czego (po ostrzeżeniu — decyduje aplikacja) ──
create or replace function public.penalize_junk_xp()
returns table (applied int, today int, new_xp int)
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  d     date := (now() at time zone 'Europe/Warsaw')::date;
  done  int;
  cur   int;
  take  int;
  rest  int;
  r     record;
begin
  if me is null then return query select 0, 0, 0; return; end if;
  select coalesce(f.dropped_xp, 0) into done from public.xp_flags f where f.user_id = me and f.day = d and f.kind = 'junk';
  done := coalesce(done, 0);
  select coalesce(p.xp, 0) into cur from public.profiles p where p.id = me for update;
  if not found then return query select 0, done, 0; return; end if;
  take := greatest(0, least(5, 50 - done, cur));
  if take > 0 then
    update public.profiles p set xp = p.xp - take where p.id = me;
    -- dzienny log (rankingi tydzień / miesiąc): najpierw dziś, potem najnowsze dni
    rest := take;
    for r in select x.day, x.xp from public.daily_xp_log x
              where x.user_id = me and x.xp > 0
              order by (x.day = current_date) desc, x.day desc loop
      exit when rest <= 0;
      update public.daily_xp_log x set xp = x.xp - least(rest, r.xp), updated_at = now()
       where x.user_id = me and x.day = r.day;
      rest := rest - least(rest, r.xp);
    end loop;
    -- last_at bez zmian (nowy wiersz — minutę wstecz): kara nie może blokować zgłoszeń 🧹
    -- z aplikacji (report_learning_flags przyjmuje najwyżej jedno na minutę wg last_at)
    insert into public.xp_flags (user_id, day, kind, dropped_xp, events, info, last_at)
    values (me, d, 'junk', take, 0, null, now() - interval '1 minute')
    on conflict (user_id, day, kind) do update
       set dropped_xp = public.xp_flags.dropped_xp + excluded.dropped_xp;
  end if;
  return query select take, done + take, cur - take;
end;
$$;

-- ── 5) Uprawnienia (zasady z #84) ───────────────────────────────────
revoke all on function public._profiles_xp_guard() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_set_stats(uuid,text,int,int,int,int,date)', 'public.penalize_junk_xp()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

select 'OK — migracja #97 (✏️ ustawianie statystyk ucznia + 🧹 −5 XP za byle co) gotowa' as status;

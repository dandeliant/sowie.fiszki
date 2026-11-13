-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 🛟 POSTĘP ROZDZIAŁÓW BEZ NADPISYWANIA + „✅ ZALICZONY” NA STAŁE
--  Migracja #100 · idempotentna (można uruchomić ponownie) · 13.11.2026, SW v1.262
--
--  Uczniowie zgłaszali, że nauczone słówka „zresetowały się” i dział nie jest
--  już zaliczony. Jedna z przyczyn: aplikacja zapisywała CAŁY rozdział naraz
--  (upsert word_states). Karta otwarta od kilku dni (np. komputer w szkole)
--  albo drugie urządzenie po jednej odpowiedzi nadpisywały postęp zdobyty gdzie
--  indziej starszym stanem.
--
--  1) save_unit_progress(p_book, p_unit, p_states, p_total) → jsonb
--     (SECURITY INVOKER — RLS „unit_progress: własny ALL”: tylko własny wiersz)
--     scala stany słówko po słówku: dla każdego numeru wygrywa NOWSZY stan
--     (_ws_ts: ut — od v1.262 przy każdej zmianie, lastReview, ignAt, teacherDone;
--     remis — przysłany), numery, których aplikacja nie przysłała, zostają.
--     known_count liczy baza (_ws_known: known = true, numer < total).
--     Zwraca { known, completed_at, states } — states tylko wtedy, gdy baza
--     miała nowszy stan któregoś słówka (aplikacja dociąga go do pamięci).
--  2) unit_progress.completed_at — „✅ Zaliczony”: ustawia baza (wyzwalacz
--     unit_progress_done), gdy known_count ≥ total > 0 — przy każdym zapisie
--     (stara aplikacja, RPC powyżej, zaliczenie przez nauczyciela #99).
--     Później zostaje, nawet gdy po powtórkach procent spadnie. Z aplikacji
--     (authenticated / anon) nie da się jej ustawić ani skasować.
--     Rozdziały, które teraz mają 100%, dostają datę od razu.
--
--  Wymaga: unit_progress (supabase-schema.sql) z RLS „unit_progress: własny ALL”.
--  Uruchom w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. KOLUMNA ───────────────────────────────────────────────────
alter table public.unit_progress add column if not exists completed_at timestamptz;

-- ── 2. POMOCNICZE (czyste funkcje — RPC wykonuje je z uprawnieniami ucznia) ──
-- Czas ostatniej zmiany stanu słówka (ms od 1970)
create or replace function public._ws_ts(s jsonb)
returns numeric language sql immutable set search_path = public as $$
  select case when s is null or jsonb_typeof(s) <> 'object' then 0 else greatest(
    case when jsonb_typeof(s->'ut') = 'number'          then (s->>'ut')::numeric          else 0 end,
    case when jsonb_typeof(s->'lastReview') = 'number'  then (s->>'lastReview')::numeric  else 0 end,
    case when jsonb_typeof(s->'ignAt') = 'number'       then (s->>'ignAt')::numeric       else 0 end,
    case when jsonb_typeof(s->'teacherDone') = 'number' then (s->>'teacherDone')::numeric else 0 end) end
$$;

-- Ile słówek opanowanych (known = true) wśród numerów 0 … total-1
create or replace function public._ws_known(s jsonb, p_total int)
returns int language sql immutable set search_path = public as $$
  select count(*)::int
    from jsonb_each(case when jsonb_typeof(s) = 'object' then s else '{}'::jsonb end) e
   where e.key ~ '^[0-9]{1,5}$' and e.key::int < greatest(coalesce(p_total, 0), 0)
     and jsonb_typeof(e.value) = 'object' and (e.value->>'known') = 'true'
$$;

-- ── 3. „✅ ZALICZONY” — data zaliczenia ustawiana przez bazę ─────
create or replace function public._unit_progress_done()
returns trigger language plpgsql set search_path = public as $$
declare
  v timestamptz := case when tg_op = 'UPDATE' then old.completed_at else null end;
begin
  -- z aplikacji (authenticated / anon) daty nie da się ustawić ani skasować;
  -- funkcje bazy (np. teacher_complete_units, SQL Editor) mogą ją podać
  if current_user not in ('authenticated', 'anon') then
    v := coalesce(new.completed_at, v);
  end if;
  if coalesce(new.total, 0) > 0 and coalesce(new.known_count, 0) >= new.total then
    v := coalesce(v, now());
  end if;
  new.completed_at := v;
  return new;
end $$;
drop trigger if exists unit_progress_done on public.unit_progress;
create trigger unit_progress_done
  before insert or update on public.unit_progress
  for each row execute function public._unit_progress_done();

-- Rozdziały, które już teraz mają 100%
update public.unit_progress
   set completed_at = now()
 where completed_at is null and total > 0 and known_count >= total;

-- ── 4. ZAPIS ZE SCALANIEM ───────────────────────────────────────
create or replace function public.save_unit_progress(p_book text, p_unit text, p_states jsonb, p_total int)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  b       text := btrim(coalesce(p_book, ''));
  u       text := btrim(coalesce(p_unit, ''));
  v_cur   jsonb;
  v_new   jsonb;
  v_kept  int := 0;
  v_known int;
  v_done  timestamptz;
begin
  if v_me is null then
    raise exception 'AUTH' using errcode = '42501';
  end if;
  if b = '' or u = '' or char_length(b) > 80 or char_length(u) > 80 then
    raise exception 'BAD_UNIT' using errcode = '22023';
  end if;
  if p_states is null or jsonb_typeof(p_states) <> 'object' or length(p_states::text) > 2000000 then
    raise exception 'BAD_STATES' using errcode = '22023';
  end if;
  if p_total is null or p_total < 0 or p_total > 5000 then
    raise exception 'BAD_TOTAL' using errcode = '22023';
  end if;

  select up.word_states into v_cur
    from public.unit_progress up
   where up.user_id = v_me and up.book_key = b and up.unit_key = u
   for update;

  if v_cur is null or jsonb_typeof(v_cur) <> 'object' then
    v_new := p_states;
  else
    -- słówko po słówku: nowszy stan wygrywa (remis — przysłany); numery spoza przysłanych zostają
    select coalesce(jsonb_object_agg(m.k, m.val), '{}'::jsonb),
           coalesce(sum(case when m.kept then 1 else 0 end), 0)::int
      into v_new, v_kept
      from (
        select coalesce(n.key, c.key) as k,
               case when n.key is null then c.value
                    when c.key is not null and public._ws_ts(c.value) > public._ws_ts(n.value) then c.value
                    else n.value end as val,
               (n.key is not null and c.key is not null and public._ws_ts(c.value) > public._ws_ts(n.value)) as kept
          from jsonb_each(p_states) n
          full join jsonb_each(v_cur) c on c.key = n.key
      ) m;
  end if;

  v_known := public._ws_known(v_new, p_total);

  insert into public.unit_progress as up (user_id, book_key, unit_key, word_states, known_count, total, last_studied)
  values (v_me, b, u, v_new, v_known, p_total, (extract(epoch from clock_timestamp()) * 1000)::bigint)
  on conflict (user_id, book_key, unit_key) do update
     set word_states  = excluded.word_states,
         known_count  = excluded.known_count,
         total        = excluded.total,
         last_studied = excluded.last_studied
  returning up.completed_at into v_done;

  return jsonb_build_object('known', v_known, 'completed_at', v_done,
                            'states', case when v_kept > 0 then v_new else null end);
end;
$$;

-- ── 5. UPRAWNIENIA (zasady z #84) ───────────────────────────────
-- funkcja wyzwalacza — nie do wywołania przez /rest/v1/rpc
revoke all on function public._unit_progress_done() from public, anon, authenticated;
-- czyste funkcje pomocnicze — RPC (SECURITY INVOKER) wykonuje je z uprawnieniami ucznia
revoke all on function public._ws_ts(jsonb) from public, anon;
revoke all on function public._ws_known(jsonb, int) from public, anon;
grant execute on function public._ws_ts(jsonb) to authenticated;
grant execute on function public._ws_known(jsonb, int) to authenticated;
-- tylko dla zalogowanych (RLS pilnuje, że to własny wiersz)
revoke all on function public.save_unit_progress(text, text, jsonb, int) from public, anon;
grant execute on function public.save_unit_progress(text, text, jsonb, int) to authenticated;

select 'OK — migracja #100 (🛟 postęp rozdziałów bez nadpisywania + ✅ zaliczony na stałe) gotowa' as status;

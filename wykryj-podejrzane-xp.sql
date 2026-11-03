-- ═══════════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 🔎 WYKRYJ PODEJRZANE XP (raport TYLKO DO ODCZYTU)
--  03.11.2026 · nic nie zapisuje, nic nie zmienia, nie tworzy tabel
--
--  Jak użyć: Supabase → SQL Editor → wklej cały plik → Run. Wynik to
--  jedna tabela: każdy wiersz = uczeń + dzień (albo sam rekord serii)
--  z dowodami i powodem. Uruchom raz, gdy chcesz przejrzeć — nie co
--  chwilę (przegląda postęp wszystkich uczniów: zużywa budżet dysku).
--
--  SKĄD PODEJRZENIE (zgłoszenie z 03.11.2026): uczeń klikał na zmianę
--  Spację i → w Fiszkach. Do 30.10.2026 (~17:30, SW v1.219) ocena
--  „Łatwe” w Fiszkach dawała 8 XP (↓ „Średnie” 5 XP), więc klikanie
--  co ~0,5 s dawało ok. 1000 XP na minutę ≈ 16 poziomów na minutę.
--  Od 30.10 Fiszki nie dają XP, ale klikanie nadal nabijało rekord
--  serii 🎯 (ranking), licznik „umiem” / „Opanowane” (ranking 📚,
--  wyzwania klasowe) i odblokowanie gier. Od SW z „🐢 strażnikiem
--  tempa” takie odpowiedzi w ogóle się nie liczą.
--
--  DOWODY (kolumny):
--   • szybkie_oceny — ile słówek tego dnia oceniono w odstępie < 1 s od
--     poprzedniego słówka w tym samym rozdziale (znacznik lastReview
--     w unit_progress.word_states). Uczciwie to niemożliwe: w Fiszkach
--     trzeba przeczytać słówko, odwrócić kartę i odpowiedź (≥ 1,4 s),
--     w Wpisz / Quiz / Prawda-Fałsz ocena przychodzi ≥ 1,5 s po
--     odpowiedzi. Zapisuje się tylko OSTATNIA ocena każdego słówka —
--     to dolna granica. Próg: ≥ 10 takich ocen i ≥ połowa ocen dnia.
--   • xp_na_min — XP dnia / minuty nauki (heartbeat co minutę aktywnej
--     strony app.html; liczą się też przerwy, więc uczciwa średnia
--     zwykle < 60). Próg „do sprawdzenia” 150, „bardzo podejrzane” 300
--     (w weekend od 31.10 ×2, bo XP jest wtedy podwójne).
--   • XP bez minut — ≥ 300 XP i 0 minut nauki. Uwaga: gry z osobnych
--     stron (Skoczek, Most, Motyle…) dają XP bez minut — sprawdź gry.
--   • skok — ≥ 1500 XP i ≥ 5× więcej niż mediana dni z XP tego ucznia.
--   • rekord_serii 🎯 ≥ 150 — osobny wiersz (bez daty).
--  waga: 3 = bardzo prawdopodobne (klikanie + XP), 2 = prawdopodobne,
--  1 = do sprawdzenia. Konta admina / nauczyciela / opiekuna pomijamy.
--
--  CO DALEJ: nie odejmuj automatycznie. Porozmawiaj z uczniem, sprawdź
--  w aplikacji (postęp ucznia → „🛡️ Tempo i korekta XP”, wymaga
--  migracji #93) i tam odejmij XP z podanego dnia (rankingi tygodnia
--  i miesiąca też się poprawią) albo obniż rekord serii 🎯.
--  „sugerowana_korekta” to szacunek: szybkie oceny × 16 XP (każde słówko
--  oceniane zwykle 2× w sesji po 8 XP), najwyżej XP tego dnia.
--  Alerty z migracji #93 (od jej uruchomienia) widać w aplikacji:
--  Panel nauczyciela → „🐢 Tempo i korekta XP”.
-- ═══════════════════════════════════════════════════════════════════
with
par as (
  select 120  as dni,            -- ile dni wstecz
         1000 as szybko_ms,      -- odstęp między ocenami słówek < 1 s = klikanie bez czytania
         10   as szybkie_min,    -- ile szybkich ocen jednego dnia, żeby zgłosić
         150  as xp_min_uwaga,   -- XP na minutę nauki — do sprawdzenia (weekend od 31.10: ×2)
         300  as xp_min_mocno,   -- XP na minutę nauki — bardzo podejrzane
         300  as xp_dzien_min,   -- dni z mniejszym XP pomijamy (przy XP/min i „bez minut”)
         1500 as skok_xp,        -- dzień z dużym XP…
         5    as skok_razy,      -- …i tyle razy więcej niż mediana ucznia
         150  as seria_uwaga,    -- rekord serii 🎯 do sprawdzenia
         date '2026-10-30' as koniec_xp_fiszek   -- ostatni dzień, w którym Fiszki dawały XP
),
uczniowie as (
  select p.id,
         p.username                                              as login,
         nullif(to_jsonb(p) ->> 'nickname', '')                  as ksywka,
         coalesce(p.xp, 0)                                       as xp_razem,
         coalesce(p.level, 1)                                    as poziom,
         coalesce((to_jsonb(p) ->> 'best_correct_streak')::int, 0) as rekord_serii,
         (select string_agg(distinct c.name, ', ')
            from public.class_members m join public.classes c on c.id = m.class_id
           where m.user_id = p.id)                               as klasy
    from public.profiles p
   where not coalesce((to_jsonb(p) ->> 'is_admin')::boolean, false)
     and not coalesce((to_jsonb(p) ->> 'is_teacher')::boolean, false)
     and not coalesce((to_jsonb(p) ->> 'is_parent')::boolean, false)
),
dni as (            -- dzienny log XP (rankingi tydzień / miesiąc)
  select d.user_id, d.day,
         coalesce(d.xp, 0)                                  as xp,
         coalesce((to_jsonb(d) ->> 'minutes')::int, 0)      as minuty,
         coalesce((to_jsonb(d) ->> 'words')::int, 0)        as slowka,
         case when extract(isodow from d.day) in (6, 7) and d.day >= date '2026-10-31' then 2 else 1 end as wk
    from public.daily_xp_log d
   where d.day >= current_date - (select dni from par)
     and coalesce(d.xp, 0) > 0
),
mediana as (
  select user_id, percentile_cont(0.5) within group (order by xp) as med from dni group by user_id
),
oceny as (          -- ostatnia ocena każdego słówka (ms od 1970) z postępu rozdziałów
  select up.user_id, up.book_key, up.unit_key, (e.value ->> 'lastReview')::bigint as lr
    from public.unit_progress up
   cross join lateral jsonb_each(case when jsonb_typeof(up.word_states::jsonb) = 'object'
                                      then up.word_states::jsonb else '{}'::jsonb end) e
   where jsonb_typeof(e.value) = 'object'
     and (e.value ->> 'lastReview') ~ '^[0-9]{12,14}$'
     and (e.value ->> 'lastReview')::bigint >= (extract(epoch from now()) - (select dni from par) * 86400) * 1000
),
odstepy as (
  select user_id, lr,
         lr - lag(lr) over (partition by user_id, book_key, unit_key order by lr) as gap
    from oceny
),
klik as (
  select o.user_id,
         (to_timestamp(o.lr / 1000.0) at time zone 'Europe/Warsaw')::date as day,
         count(*) filter (where o.gap < (select szybko_ms from par))     as szybkie,
         count(*)                                                         as oceny,
         round((percentile_cont(0.5) within group (order by o.gap) / 1000.0)::numeric, 2) as mediana_s
    from odstepy o
   group by o.user_id, 2
),
dzien as (
  select coalesce(d.user_id, k.user_id) as user_id, coalesce(d.day, k.day) as day,
         d.xp, d.minuty, d.slowka, coalesce(d.wk, 1) as wk, k.szybkie, k.oceny, k.mediana_s
    from dni d
    full join klik k on k.user_id = d.user_id and k.day = d.day
),
ocena as (
  select z.*, u.login, u.ksywka, u.klasy, u.poziom, u.xp_razem, u.rekord_serii, coalesce(m.med, 0) as med, p.*,
         case when z.minuty > 0 then round(z.xp::numeric / z.minuty) end as xp_na_min,
         (coalesce(z.szybkie, 0) >= p.szybkie_min and z.szybkie * 2 >= z.oceny)            as klikanie,
         (coalesce(z.xp, 0) >= p.xp_dzien_min * z.wk and z.minuty > 0
            and z.xp::numeric / z.minuty >= p.xp_min_mocno * z.wk)                        as tempo_mocno,
         (coalesce(z.xp, 0) >= p.xp_dzien_min * z.wk and z.minuty > 0
            and z.xp::numeric / z.minuty >= p.xp_min_uwaga * z.wk)                        as tempo_uwaga,
         (coalesce(z.xp, 0) >= p.xp_dzien_min * z.wk and coalesce(z.minuty, 0) = 0)        as bez_minut,
         (coalesce(z.xp, 0) >= p.skok_xp * z.wk and z.xp >= p.skok_razy * greatest(coalesce(m.med, 0), 1)) as skok
    from dzien z
    join uczniowie u on u.id = z.user_id
    left join mediana m on m.user_id = z.user_id
   cross join par p
),
wiersze as (
  select case when klikanie and (tempo_uwaga or skok or bez_minut) then 3
              when klikanie or tempo_mocno then 2 else 1 end                as waga,
         login, ksywka, klasy, day as dzien, xp as xp_dnia, minuty, xp_na_min, slowka as opanowane_dnia,
         szybkie as szybkie_oceny, oceny as oceny_dnia, mediana_s as mediana_odstepu_s,
         rekord_serii, poziom, xp_razem,
         concat_ws(' · ',
           case when klikanie then '🃏 ' || szybkie || ' z ' || oceny || ' ocen słówek w odstępach < 1 s (mediana '
                                   || coalesce(replace(mediana_s::text, '.', ','), '?') || ' s) — klikanie bez czytania' end,
           case when tempo_mocno then '⚡ ' || xp_na_min || ' XP na minutę nauki — za szybko na uczciwą naukę'
                when tempo_uwaga then '⚡ ' || xp_na_min || ' XP na minutę nauki — do sprawdzenia' end,
           case when bez_minut then '⏱️ ' || xp || ' XP bez zapisanych minut nauki (mogą to być gry z osobnych stron)' end,
           case when skok then '📈 ' || xp || ' XP — ' || round(xp / greatest(med, 1)::numeric) || '× więcej niż zwykły dzień ucznia' end
         ) as powod,
         case
           when klikanie and day <= koniec_xp_fiszek and coalesce(xp, 0) > 0
             then 'Odejmij ok. ' || least(xp, szybkie * 16) || ' XP od dnia ' || to_char(day, 'DD.MM.YYYY')
                  || ' (🛡️ Tempo i korekta XP); rekord serii 🎯 obniż, jeśli jest podobny do liczby szybkich ocen'
           when klikanie
             then 'Fiszki nie dawały już XP (chyba że uczeń miał starą wersję aplikacji) — sprawdź rekord serii 🎯 i „opanowane” słówka'
           when tempo_mocno or skok
             then 'Sprawdź dzień w aplikacji; odejmij najwyżej nadwyżkę ponad zwykły dzień ucznia (~' || round(med::numeric) || ' XP)'
           else 'Do sprawdzenia — bez korekty, jeśli uczeń naprawdę się uczył'
         end as sugerowana_korekta
    from ocena
   where klikanie or tempo_uwaga or bez_minut or skok
  union all
  select case when u.rekord_serii >= 3 * p.seria_uwaga then 2 else 1 end, u.login, u.ksywka, u.klasy, null::date,
         null::int, null::int, null::numeric, null::int, null::bigint, null::bigint, null::numeric,
         u.rekord_serii, u.poziom, u.xp_razem,
         '🎯 rekord serii ' || u.rekord_serii || ' poprawnych odpowiedzi z rzędu — bardzo wysoki',
         'Jeśli są dni z klikaniem 🃏 — obniż rekord serii (🛡️ Tempo i korekta XP → „Rekord serii — ustaw na”)'
    from uczniowie u cross join par p
   where u.rekord_serii >= p.seria_uwaga
)
select * from wiersze
 order by waga desc, login, dzien desc nulls first;

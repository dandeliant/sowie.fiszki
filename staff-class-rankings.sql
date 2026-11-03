-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — RANKING KLAS DLA NAUCZYCIELA I ADMINA
--  Migracja #92 · idempotentna (03.11.2026)
--
--  Nauczyciel i admin widzą ranking jak uczeń: zakładki 📚 Słówka · ⚡ XP dziś ·
--  📅 Tydzień · 🗓️ Miesiąc · 🔥 Streak · 🎯 Seria, każda klasa osobno
--  + „🌐 Wszystkie klasy”. Nauczyciel — tylko WŁASNE klasy (classes.admin_id,
--  jak _owns_class z #75), admin — wszystkie klasy platformy.
--
--  1) staff_rank_classes() — lista klas do wyboru: class_id, class_name,
--     owner_name (login właściciela klasy), is_mine, students (bez kont
--     admina / nauczyciela — jak w my_class_rankings).
--  2) staff_class_rankings(p_class, p_top):
--     • p_class = id klasy → wszyscy uczniowie tej klasy;
--     • p_class = null → „Wszystkie klasy”: każdy uczeń raz (class_names —
--       jego klasy, max 3 nazwy), tylko top p_top (1–50, domyślnie 20)
--       w KAŻDEJ z 6 kategorii (wynik > 0) — najwyżej 6 × p_top wierszy,
--       nawet gdy admin ma setki klas (limit wierszy PostgREST, mała baza).
--     Kolumny jak w my_class_rankings (#61): xp_today, xp_week (7 dni),
--     xp_month (31 dni), longest_streak, best_combo, level, xp_total,
--     well_learned + username, nickname, avatar_url.
--  Obie funkcje: SECURITY DEFINER, same sprawdzają uprawnienia
--  (uczeń / opiekun → NOT_ALLOWED, nauczyciel → cudza klasa NOT_ALLOWED);
--  EXECUTE tylko dla authenticated (#84).
--
--  Wymaga: #20 (_is_admin, _is_teacher), #21 (daily_xp_log), #45 (best_correct_streak),
--  #54 (well_learned_words), #61 (nickname), zdjęć profilowych (avatar_url).
--  Aplikacja działa też bez tej migracji (ranking klasy z dotychczasowych
--  zapytań, bez „Wszystkich klas”).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Klasy do wyboru ───────────────────────────────────────────
drop function if exists public.staff_rank_classes();
create function public.staff_rank_classes()
returns table (class_id uuid, class_name text, owner_name text, is_mine boolean, students int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_admin boolean;
begin
  if v_me is null then raise exception 'AUTH'; end if;
  v_admin := public._is_admin();
  if not (v_admin or public._is_teacher()) then raise exception 'NOT_ALLOWED'; end if;

  return query
    select c.id,
           c.name::text,
           o.username::text,
           coalesce(c.admin_id = v_me, false),
           (select count(*)::int
              from public.class_members m
              join public.profiles p on p.id = m.user_id
             where m.class_id = c.id
               and coalesce(p.is_admin, false) = false
               and coalesce(p.is_teacher, false) = false)
      from public.classes c
      left join public.profiles o on o.id = c.admin_id
     where c.admin_id = v_me or v_admin
     order by coalesce(c.admin_id = v_me, false) desc, c.name;
end;
$$;

-- ── 2. Ranking: jedna klasa albo wszystkie klasy ─────────────────
drop function if exists public.staff_class_rankings(uuid, int);
create function public.staff_class_rankings(p_class uuid default null, p_top int default 20)
returns table (
  user_id uuid, username text, nickname text, avatar_url text,
  xp_today int, xp_week int, xp_month int, longest_streak int, best_combo int,
  level int, xp_total int, well_learned int, class_names text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_admin boolean;
  v_top   int := greatest(1, least(coalesce(p_top, 20), 50));
begin
  if v_me is null then raise exception 'AUTH'; end if;
  v_admin := public._is_admin();
  if not (v_admin or public._is_teacher()) then raise exception 'NOT_ALLOWED'; end if;
  if p_class is not null and not (v_admin or public._owns_class(p_class)) then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
  with scope as (
    select c.id as cid, coalesce(c.name, '?') as cname
      from public.classes c
     where (p_class is not null and c.id = p_class)
        or (p_class is null and (v_admin or c.admin_id = v_me))
  ),
  people as (
    select m.user_id as uid,
           array_to_string((array_agg(s.cname order by s.cname))[1:3], ', ')
             || case when count(*) > 3 then ' +' || (count(*) - 3) else '' end as names
      from scope s
      join public.class_members m on m.class_id = s.cid
     group by m.user_id
  ),
  stats as (
    select pe.uid, pe.names,
           pr.username::text                         as uname,
           nullif(pr.nickname, '')::text             as nick,
           pr.avatar_url::text                       as avatar,
           coalesce(x.t, 0)::int                     as xt,
           coalesce(x.w, 0)::int                     as xw,
           coalesce(x.mo, 0)::int                    as xm,
           coalesce(pr.longest_streak, 0)::int       as ls,
           coalesce(pr.best_correct_streak, 0)::int  as bc,
           coalesce(pr.level, 1)::int                as lv,
           coalesce(pr.xp, 0)::int                   as xpt,
           coalesce(pr.well_learned_words, 0)::int   as wl
      from people pe
      join public.profiles pr on pr.id = pe.uid
      left join lateral (
        select sum(d.xp) filter (where d.day = current_date)      as t,
               sum(d.xp) filter (where d.day >= current_date - 6) as w,
               sum(d.xp)                                          as mo
          from public.daily_xp_log d
         where d.user_id = pe.uid
           and d.day >= current_date - 30
      ) x on true
     where coalesce(pr.is_admin, false) = false
       and coalesce(pr.is_teacher, false) = false
  ),
  ranked as (
    select st.*,
           row_number() over (order by st.wl desc, st.uname, st.uid) as r_wl,
           row_number() over (order by st.xt desc, st.uname, st.uid) as r_xt,
           row_number() over (order by st.xw desc, st.uname, st.uid) as r_xw,
           row_number() over (order by st.xm desc, st.uname, st.uid) as r_xm,
           row_number() over (order by st.ls desc, st.uname, st.uid) as r_ls,
           row_number() over (order by st.bc desc, st.uname, st.uid) as r_bc
      from stats st
  )
  select rk.uid, rk.uname, rk.nick, rk.avatar,
         rk.xt, rk.xw, rk.xm, rk.ls, rk.bc, rk.lv, rk.xpt, rk.wl, rk.names
    from ranked rk
   where p_class is not null
      or (rk.wl > 0 and rk.r_wl <= v_top)
      or (rk.xt > 0 and rk.r_xt <= v_top)
      or (rk.xw > 0 and rk.r_xw <= v_top)
      or (rk.xm > 0 and rk.r_xm <= v_top)
      or (rk.ls > 0 and rk.r_ls <= v_top)
      or (rk.bc > 0 and rk.r_bc <= v_top)
   order by rk.wl desc, rk.uname;
end;
$$;

-- ── 3. Uprawnienia (#84): tylko zalogowani; resztę sprawdzają funkcje ──
revoke all on function public.staff_rank_classes()              from public, anon;
revoke all on function public.staff_class_rankings(uuid, int)   from public, anon;
grant execute on function public.staff_rank_classes()            to authenticated;
grant execute on function public.staff_class_rankings(uuid, int) to authenticated;

select 'OK — migracja #92 (ranking klas dla nauczyciela i admina) gotowa' as status;

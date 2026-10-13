-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — TOPKA WSZYSTKICH UŻYTKOWNIKÓW (ranking globalny)
--  Migracja #67 · idempotentna
--
--  RPC global_leaderboard(p_metric, p_period, p_limit) — ranking wszystkich
--  uczących się (bez kont admina i nauczyciela):
--    p_metric: 'words' — słówka:  tydzień = słówka nauczone w tym tygodniu
--                                  (daily_xp_log.words), całość = słówka
--                                  opanowane bardzo dobrze (profiles.well_learned_words)
--              'xp'    — XP:      tydzień = suma daily_xp_log.xp, całość = profiles.xp
--              'games' — punkty z gier (game_sessions.score, #66)
--    p_period: 'week' (od poniedziałku bieżącego tygodnia) | 'all'
--  Zwraca top N + wiersz wywołującego (gdy jest poza topką).
--
--  PRYWATNOŚĆ: inni użytkownicy pokazywani są TYLKO ksywką (#61), a gdy jej
--  nie ustawili — zamaskowanym loginem („ja•••"). user_id innych nie wychodzi
--  z bazy (NULL); pełny login widzi tylko sam zainteresowany przy swoim wierszu.
--
--  Wymaga: #21 (daily_xp_log), #45 (daily_xp_log.words), #54
--  (profiles.well_learned_words), #61 (profiles.nickname), #62 (avatar_url).
--  #66 (game_sessions) — opcjonalnie: bez niej kategoria „gry" jest pusta.
-- ═══════════════════════════════════════════════════════════════

drop function if exists public.global_leaderboard(text, text, int);

create or replace function public.global_leaderboard(
  p_metric text default 'words',
  p_period text default 'week',
  p_limit  int  default 50
) returns table (
  place        int,
  display_name text,
  avatar_url   text,
  level        int,
  value        bigint,
  is_me        boolean,
  total_users  int
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me     uuid := auth.uid();
  v_since  date := date_trunc('week', current_date)::date;   -- poniedziałek
  v_limit  int  := least(greatest(coalesce(p_limit, 50), 5), 100);
  v_metric text := coalesce(p_metric, 'words');
  v_week   boolean := coalesce(p_period, 'week') = 'week';
begin
  if v_me is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  create temp table if not exists _glb_vals (uid uuid primary key, val bigint) on commit drop;
  truncate _glb_vals;

  if v_metric = 'xp' then
    if v_week then
      insert into _glb_vals
        select d.user_id, sum(d.xp)::bigint from public.daily_xp_log d
        where d.day >= v_since group by d.user_id;
    else
      insert into _glb_vals select p.id, coalesce(p.xp, 0)::bigint from public.profiles p;
    end if;
  elsif v_metric = 'games' then
    if to_regclass('public.game_sessions') is not null then
      if v_week then
        execute 'insert into _glb_vals select user_id, sum(score)::bigint from public.game_sessions
                 where day >= $1 group by user_id' using v_since;
      else
        execute 'insert into _glb_vals select user_id, sum(score)::bigint from public.game_sessions
                 group by user_id';
      end if;
    end if;
  else
    if v_week then
      insert into _glb_vals
        select d.user_id, sum(coalesce(d.words, 0))::bigint from public.daily_xp_log d
        where d.day >= v_since group by d.user_id;
    else
      insert into _glb_vals select p.id, coalesce(p.well_learned_words, 0)::bigint from public.profiles p;
    end if;
  end if;

  return query
  with ranked as (
    select p.id as uid, p.username, p.nickname, p.avatar_url, coalesce(p.level, 1) as lvl, v.val,
           row_number() over (order by v.val desc, coalesce(p.xp, 0) desc, p.id) as rn,
           count(*) over () as cnt
    from _glb_vals v
    join public.profiles p on p.id = v.uid
    where v.val > 0
      and coalesce(p.is_admin, false) = false
      and coalesce(p.is_teacher, false) = false
  )
  select r.rn::int,
         case
           when r.uid = v_me then coalesce(nullif(r.nickname, ''), r.username)
           when nullif(r.nickname, '') is not null then r.nickname
           else left(coalesce(r.username, 'uczeń'), 2) || '•••'
         end,
         r.avatar_url, r.lvl::int, r.val, (r.uid = v_me), r.cnt::int
  from ranked r
  where r.rn <= v_limit or r.uid = v_me
  order by r.rn;
end;
$$;

revoke all on function public.global_leaderboard(text, text, int) from public;
grant execute on function public.global_leaderboard(text, text, int) to authenticated;

select 'OK — global_leaderboard gotowe (#67).' as status;

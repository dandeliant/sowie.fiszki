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

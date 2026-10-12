-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — LIVE „Gramy wszyscy": ZAGRAJ PONOWNIE (rematch)
--  Migracja #65 · idempotentna
--
--  Po zakończeniu gry gospodarz może wznowić ją z TYMI SAMYMI graczami
--  (ten sam PIN i QR — nowi gracze też mogą dołączyć). RPC:
--    • kasuje odpowiedzi z poprzedniej rundy (live_game_answers nie ma
--      polityki DELETE, dlatego SECURITY DEFINER),
--    • zeruje wyniki graczy,
--    • przywraca status 'waiting' (lobby), opcjonalnie zmienia typ gry
--      i limit czasu, przedłuża ważność PIN-u o 4 godziny.
--  Gdy PIN zdążył zostać zajęty przez inną aktywną grę — błąd (klient
--  tworzy wtedy nową grę z nowym PIN-em).
--
--  Wymaga: add-live-games.sql, add-live-time-limit-and-score-rpc.sql.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.live_game_rematch(
  p_game_id    uuid,
  p_game_type  text default null,
  p_time_limit int  default null   -- null = bez zmian, 0 = bez limitu, >0 = sekundy
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  select g.pin into v_pin
  from public.live_games g
  where g.id = p_game_id and g.host_id = auth.uid();

  if v_pin is null then
    raise exception 'Tylko gospodarz gry może ją wznowić.';
  end if;

  if exists (
    select 1 from public.live_games g
    where g.pin = v_pin and g.id <> p_game_id
      and g.status <> 'finished' and g.expires_at > now()
  ) then
    raise exception 'PIN_TAKEN: kod tej gry jest już używany przez inną grę.';
  end if;

  delete from public.live_game_answers where game_id = p_game_id;
  update public.live_game_players set score = 0 where game_id = p_game_id;

  update public.live_games set
    status              = 'waiting',
    current_question    = 0,
    question_order      = null,
    question_started_at = null,
    game_type           = coalesce(nullif(trim(p_game_type), ''), game_type),
    time_limit_seconds  = case
                            when p_time_limit is null then time_limit_seconds
                            when p_time_limit <= 0   then null
                            else p_time_limit
                          end,
    expires_at          = greatest(expires_at, now() + interval '4 hours')
  where id = p_game_id;
end;
$$;

revoke all on function public.live_game_rematch(uuid, text, int) from public;
grant execute on function public.live_game_rematch(uuid, text, int) to authenticated;

select 'OK — live_game_rematch gotowe (#65).' as status;

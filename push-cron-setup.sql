-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — harmonogram powiadomień push (co godzinę) · SZABLON
--  Do migracji #91 (push-reminders.sql) i Edge Function „push-reminders”.
--
--  ⚠️ To jest SZABLON — w repo zostaje <CRON_SECRET>. Prawdziwą wartość
--  (z pliku push-keys.local.txt, linia CRON_SECRET=…) wklej TYLKO w Supabase
--  → SQL Editor, przed kliknięciem Run. Nie zapisuj jej w tym pliku.
--
--  Kolejność: 1) migracja #91, 2) sekrety funkcji, 3) wdrożenie funkcji
--  (Verify JWT = OFF), 4) ten plik. Można uruchomić ponownie (np. po zmianie
--  sekretu) — sekret w Vault zostanie podmieniony, zadanie crona nadpisane.
--
--  Wymaga rozszerzeń pg_cron i pg_net (Database → Extensions; poniżej
--  „create extension if not exists” włącza je, jeśli są dostępne).
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Sekret crona w Supabase Vault (zaszyfrowany; nie trafia do treści zadania)
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'push_cron_secret';
  if v_id is null then
    perform vault.create_secret('<CRON_SECRET>', 'push_cron_secret', 'Sekret crona — Edge Function push-reminders (#91)');
  else
    perform vault.update_secret(v_id, '<CRON_SECRET>');
  end if;
end $$;

-- 2) Zadanie: co godzinę, minutę po pełnej (czas serwera UTC — godzinę ucznia
--    w jego strefie liczy baza). Nazwane zadanie jest nadpisywane przy ponownym uruchomieniu.
select cron.schedule(
  'push-reminders',
  '1 * * * *',
  $job$
  select net.http_post(
    url := 'https://kofenaaeleyhwhbkytcz.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);

-- ── Sprawdzanie (uruchom osobno, gdy chcesz zajrzeć) ──
--   select jobid, jobname, schedule, active from cron.job where jobname = 'push-reminders';
--   select status, return_message, start_time from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'push-reminders')
--    order by start_time desc limit 5;
--   select status_code, content, created from net._http_response order by created desc limit 5;
--     → content np. {"due":3,"sent":3,"gone":0,"failed":0,"transient":0,"skipped":0,"ms":420}
--   select last_run_at, last_due from public.push_status;   -- „bicie serca” funkcji
--
-- ── Wyłączenie przypomnień push (aplikacja po ~3 h wraca do lokalnych) ──
--   select cron.unschedule('push-reminders');

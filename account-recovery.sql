-- ════════════════════════════════════════════════════════════════════
--  Migracja #98 — 🔑 odzyskiwanie hasła e-mailem (nauczyciel, opiekun, admin)
--  (06.11.2026, SW v1.256)
--
--  Konta logują się loginem (w Supabase Auth adres techniczny
--  <login>@sowie-fiszki.app). Dorosłe konta mogą DOBROWOLNIE podać prawdziwy
--  e-mail — po potwierdzeniu linkiem „Nie pamiętam hasła” wysyła na niego
--  jednorazowy link do ustawienia nowego hasła (60 min).
--
--  Wszystko obsługuje Edge Function „account” (klucz service role) — tabele
--  NIE są dostępne z aplikacji (RLS bez polityk + revoke dla anon / authenticated).
--
--  1) account_emails   — e-mail do odzyskiwania (1 na konto), potwierdzenie
--  2) password_resets  — jednorazowe linki do zmiany hasła (tylko skrót tokenu)
--  3) recovery_log     — licznik prób (limity: na IP, na adres, na konto);
--                        IP i e-mail tylko jako skrót SHA-256, wpisy > 7 dni usuwane
--  Usunięcie konta (profiles) usuwa też jego e-mail i linki (on delete cascade).
--
--  Idempotentna.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.account_emails (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  email          text not null check (char_length(email) between 6 and 254 and email = lower(email)),
  verified_at    timestamptz,
  verify_hash    text,
  verify_sent_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists account_emails_email on public.account_emails (email) where verified_at is not null;
create unique index if not exists account_emails_verify on public.account_emails (verify_hash) where verify_hash is not null;

create table if not exists public.password_resets (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index if not exists password_resets_user on public.password_resets (user_id, created_at desc);

create table if not exists public.recovery_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  kind       text not null check (kind in ('forgot', 'verify', 'reset')),
  ip_hash    text,
  email_hash text,
  user_id    uuid
);
create index if not exists recovery_log_at on public.recovery_log (at);
create index if not exists recovery_log_ip on public.recovery_log (ip_hash, at);
create index if not exists recovery_log_email on public.recovery_log (email_hash, at);

-- tylko Edge Function (service role) — z aplikacji nic
alter table public.account_emails  enable row level security;
alter table public.password_resets enable row level security;
alter table public.recovery_log    enable row level security;
revoke all on table public.account_emails, public.password_resets, public.recovery_log from public, anon, authenticated;
revoke all on sequence public.password_resets_id_seq, public.recovery_log_id_seq from public, anon, authenticated;

select 'OK — migracja #98 (🔑 odzyskiwanie hasła e-mailem) gotowa — wdroż Edge Function „account” (instrukcja: docs/ODZYSKIWANIE-HASLA.md)' as status;

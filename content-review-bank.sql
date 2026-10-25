-- ═══════════════════════════════════════════════════════════════
--  Migracja #78 — kontrola treści nauczycieli, bank zadań, czytanki AI
-- ═══════════════════════════════════════════════════════════════
--  1) grammar_sets (#73) dostaje status publikacji:
--       published — widzą wszyscy (jak dotąd)
--       pending   — czeka na zatwierdzenie admina (widzi autor i admin)
--       rejected  — odrzucony (widzi autor i admin, z notatką admina)
--     Nauczyciel zapisujący zestaw w podręczniku, który NIE jest jego własnym
--     (np. Brainy 6, podręczniki admina) → zawsze 'pending'. We własnym podręczniku
--     nauczyciela i u admina → od razu 'published'. Zmiana treści w cudzym podręczniku
--     wraca do 'pending'. Istniejące zestawy zostają opublikowane.
--  2) Wspólny bank zadań: autor może udostępnić zestaw (shared = true) → share_status
--     'pending' → admin zatwierdza ('approved') → widzą go wszyscy nauczyciele w „📚 Banku zadań”
--     i mogą skopiować do swojego rozdziału (copied_from).
--  3) reading_sets — czytanki (krótkie opowiadania ze słówkami rozdziału + pytania),
--     te same zasady statusu i banku. questions: [{q, o:[3–4 odpowiedzi], a: indeks}].
--  Nauczyciel nie zmieni statusu ani decyzji admina (trigger _content_review_guard).
--  Wymaga: #20 (_is_admin, _is_teacher), #29/#33 (admin_books), #73 (grammar_sets). Idempotentna.
-- ═══════════════════════════════════════════════════════════════

-- ── grammar_sets: kolumny statusu i banku ──
alter table public.grammar_sets add column if not exists status       text not null default 'published';
alter table public.grammar_sets add column if not exists review_note  text;
alter table public.grammar_sets add column if not exists reviewed_by  uuid;
alter table public.grammar_sets add column if not exists reviewed_at  timestamptz;
alter table public.grammar_sets add column if not exists shared       boolean not null default false;
alter table public.grammar_sets add column if not exists share_status text;
alter table public.grammar_sets add column if not exists copied_from  uuid;
alter table public.grammar_sets drop constraint if exists grammar_sets_status_check;
alter table public.grammar_sets add constraint grammar_sets_status_check check (status in ('published','pending','rejected'));
alter table public.grammar_sets drop constraint if exists grammar_sets_share_check;
alter table public.grammar_sets add constraint grammar_sets_share_check check (share_status is null or share_status in ('pending','approved','rejected'));
alter table public.grammar_sets drop constraint if exists grammar_sets_source_check;
alter table public.grammar_sets add constraint grammar_sets_source_check check (source in ('ai','manual','bank'));
create index if not exists grammar_sets_review on public.grammar_sets (status) where status <> 'published';
create index if not exists grammar_sets_bank on public.grammar_sets (share_status) where share_status is not null;

-- ── reading_sets: czytanki ──
create table if not exists public.reading_sets (
  id           uuid primary key default gen_random_uuid(),
  book_id      text not null,
  unit_key     text not null,
  title        text not null check (char_length(title) between 1 and 120),
  level        text,
  body         text not null check (char_length(body) between 20 and 4000),
  body_pl      text check (body_pl is null or char_length(body_pl) <= 5000),
  words        jsonb not null default '[]'::jsonb check (jsonb_typeof(words) = 'array' and octet_length(words::text) < 20000),
  questions    jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array' and octet_length(questions::text) < 30000),
  source       text not null default 'ai' check (source in ('ai','manual','bank')),
  status       text not null default 'published' check (status in ('published','pending','rejected')),
  review_note  text,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  shared       boolean not null default false,
  share_status text check (share_status is null or share_status in ('pending','approved','rejected')),
  copied_from  uuid,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists reading_sets_unit on public.reading_sets (book_id, unit_key, created_at);
create index if not exists reading_sets_review on public.reading_sets (status) where status <> 'published';
create index if not exists reading_sets_bank on public.reading_sets (share_status) where share_status is not null;

-- ── czy zapis wymaga zatwierdzenia: nie-admin poza własnym podręcznikiem ──
create or replace function public._content_needs_review(p_book text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if public._is_admin() then return false; end if;
  if to_regclass('public.admin_books') is not null then
    if exists (select 1 from public.admin_books b where b.book_id = p_book and b.created_by = auth.uid()) then
      return false;
    end if;
  end if;
  return true;
end $$;

-- ── strażnik statusu (wspólny dla obu tabel) ──
-- SECURITY INVOKER: zapis wprost od użytkownika ('authenticated') podlega regułom,
-- funkcje SECURITY DEFINER / service_role — nie.
create or replace function public._content_review_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb;
  changed boolean := false;
  k text;
  content_cols text[] := case when tg_table_name = 'grammar_sets'
    then array['topic','items','book_id','unit_key']
    else array['title','body','body_pl','questions','words','book_id','unit_key','level'] end;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  new.updated_at := now();
  if public._is_admin() then
    if tg_op = 'UPDATE' and (new.status is distinct from old.status or new.share_status is distinct from old.share_status) then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
    if new.shared and new.share_status is null then new.share_status := 'approved'; end if;
    if not new.shared then new.share_status := null; end if;
    return new;
  end if;
  -- nauczyciel / autor
  if tg_op = 'INSERT' then
    new.status := case when public._content_needs_review(new.book_id) then 'pending' else 'published' end;
    new.share_status := case when new.shared then 'pending' else null end;
    new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    return new;
  end if;
  o := to_jsonb(old);
  foreach k in array content_cols loop
    if (n -> k) is distinct from (o -> k) then changed := true; end if;
  end loop;
  -- decyzji admina nauczyciel nie zmienia
  new.status := old.status; new.review_note := old.review_note;
  new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.share_status := old.share_status;
  if changed and public._content_needs_review(new.book_id) then
    new.status := 'pending'; new.review_note := null;
  end if;
  if not new.shared then
    new.share_status := null;
  elsif (not old.shared) or changed or old.share_status = 'rejected' then
    new.share_status := 'pending';
  end if;
  return new;
end $$;

drop trigger if exists grammar_sets_review_guard on public.grammar_sets;
create trigger grammar_sets_review_guard before insert or update on public.grammar_sets
  for each row execute function public._content_review_guard();
drop trigger if exists reading_sets_review_guard on public.reading_sets;
create trigger reading_sets_review_guard before insert or update on public.reading_sets
  for each row execute function public._content_review_guard();

-- ── RLS: opublikowane — wszyscy; oczekujące/odrzucone — autor i admin; bank — nauczyciele ──
alter table public.grammar_sets enable row level security;
drop policy if exists "grammar_sets: read all" on public.grammar_sets;
drop policy if exists "grammar_sets: read" on public.grammar_sets;
create policy "grammar_sets: read" on public.grammar_sets for select using (
  status = 'published' or created_by = auth.uid() or public._is_admin()
  or (share_status = 'approved' and public._is_teacher()));

alter table public.reading_sets enable row level security;
drop policy if exists "reading_sets: read" on public.reading_sets;
drop policy if exists "reading_sets: staff insert" on public.reading_sets;
drop policy if exists "reading_sets: owner update" on public.reading_sets;
drop policy if exists "reading_sets: owner delete" on public.reading_sets;
create policy "reading_sets: read" on public.reading_sets for select using (
  status = 'published' or created_by = auth.uid() or public._is_admin()
  or (share_status = 'approved' and public._is_teacher()));
create policy "reading_sets: staff insert" on public.reading_sets for insert
  with check (created_by = auth.uid() and (public._is_admin() or public._is_teacher()));
create policy "reading_sets: owner update" on public.reading_sets for update
  using (created_by = auth.uid() or public._is_admin()) with check (created_by = auth.uid() or public._is_admin());
create policy "reading_sets: owner delete" on public.reading_sets for delete
  using (created_by = auth.uid() or public._is_admin());
grant select on public.reading_sets to anon, authenticated;
grant insert, update, delete on public.reading_sets to authenticated;

-- ── liczniki dla admina (baner / kafelek) ──
create or replace function public.content_review_counts()
returns table(grammar_pending int, reading_pending int, bank_pending int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Brak uprawnień administratora'; end if;
  return query select
    (select count(*)::int from public.grammar_sets where status = 'pending'),
    (select count(*)::int from public.reading_sets where status = 'pending'),
    (select count(*)::int from public.grammar_sets where share_status = 'pending')
      + (select count(*)::int from public.reading_sets where share_status = 'pending');
end $$;
revoke all on function public.content_review_counts() from public, anon;
grant execute on function public.content_review_counts() to authenticated;

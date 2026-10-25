-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — FUNKCJE AI (OpenAI przez Supabase Edge Function „ai”)
--  Migracja #73 · idempotentna
--
--  1) ai_usage + ai_usage_bump() — dzienne limity zapytań do AI na konto.
--     Licznik zmienia WYŁĄCZNIE Edge Function (rola service_role) —
--     użytkownik może tylko podejrzeć swoje liczniki.
--  2) grammar_sets — zestawy zadań gramatycznych (A/B/C + luki) dla
--     podręcznika i rozdziału, tworzone przez admina/nauczyciela (z AI
--     albo ręcznie). Widoczne dla WSZYSTKICH (także gościa) — w rozdziale
--     „🧠 Utrwalaj gramatykę” i jako misje w Grammar City.
--  3) word_sentences — nauczyciel może zapisywać zdania przykładowe
--     w SWOIM podręczniku (admin_books.created_by) — do „Uzupełnij zdania (AI)”.
--
--  Wymaga: #20 (_is_admin, _is_teacher), #33 (admin_books.created_by).
--  Klucz OpenAI NIE trafia do bazy ani do przeglądarki — tylko do sekretów
--  Edge Function (Supabase → Edge Functions → Secrets: OPENAI_API_KEY).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. LIMITY ────────────────────────────────────────────────────
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  action  text not null,
  cnt     int  not null default 0,
  primary key (user_id, day, action)
);
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage: read own" on public.ai_usage;
create policy "ai_usage: read own" on public.ai_usage for select using (user_id = auth.uid() or public._is_admin());
grant select on public.ai_usage to authenticated;

-- Zwiększa licznik, jeśli nie przekroczono limitu. Zwraca nowy licznik albo -1 (limit).
create or replace function public.ai_usage_bump(p_user uuid, p_action text, p_max int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v int;
begin
  insert into public.ai_usage (user_id, day, action, cnt) values (p_user, current_date, p_action, 0)
  on conflict (user_id, day, action) do nothing;
  update public.ai_usage set cnt = cnt + 1
   where user_id = p_user and day = current_date and action = p_action and cnt < p_max
  returning cnt into v;
  return coalesce(v, -1);
end;
$$;
revoke all on function public.ai_usage_bump(uuid, text, int) from public, anon, authenticated;
grant execute on function public.ai_usage_bump(uuid, text, int) to service_role;

-- ── 2. ZESTAWY ZADAŃ GRAMATYCZNYCH ───────────────────────────────
-- items: [{ "type":"abc", "q":"She ___ to school.", "o":["go","goes","going"], "a":1, "e":"wyjaśnienie" },
--         { "type":"gap", "q":"He ___ (play) football.", "a":["plays"], "e":"…" }]
create table if not exists public.grammar_sets (
  id         uuid primary key default gen_random_uuid(),
  book_id    text not null,
  unit_key   text not null,
  topic      text not null check (char_length(topic) between 1 and 120),
  items      jsonb not null check (jsonb_typeof(items) = 'array' and octet_length(items::text) < 200000),
  source     text not null default 'ai' check (source in ('ai','manual')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists grammar_sets_unit on public.grammar_sets (book_id, unit_key, created_at);

alter table public.grammar_sets enable row level security;
drop policy if exists "grammar_sets: read all"      on public.grammar_sets;
drop policy if exists "grammar_sets: staff insert"  on public.grammar_sets;
drop policy if exists "grammar_sets: owner update"  on public.grammar_sets;
drop policy if exists "grammar_sets: owner delete"  on public.grammar_sets;
create policy "grammar_sets: read all" on public.grammar_sets for select using (true);
create policy "grammar_sets: staff insert" on public.grammar_sets for insert
  with check (created_by = auth.uid() and (public._is_admin() or public._is_teacher()));
create policy "grammar_sets: owner update" on public.grammar_sets for update
  using (created_by = auth.uid() or public._is_admin()) with check (created_by = auth.uid() or public._is_admin());
create policy "grammar_sets: owner delete" on public.grammar_sets for delete
  using (created_by = auth.uid() or public._is_admin());
grant select on public.grammar_sets to anon, authenticated;
grant insert, update, delete on public.grammar_sets to authenticated;

-- ── 3. ZDANIA PRZYKŁADOWE: nauczyciel we własnym podręczniku ─────
do $$
begin
  if to_regclass('public.word_sentences') is null or to_regclass('public.admin_books') is null then
    raise notice 'Brak word_sentences / admin_books — pomijam politykę nauczyciela.';
    return;
  end if;
  execute 'drop policy if exists "word_sentences: owner teacher insert" on public.word_sentences';
  execute 'drop policy if exists "word_sentences: owner teacher update" on public.word_sentences';
  execute $p$
    create policy "word_sentences: owner teacher insert" on public.word_sentences for insert
      with check (exists (select 1 from public.admin_books b where b.book_id = word_sentences.book_id and b.created_by = auth.uid()))
  $p$;
  execute $p$
    create policy "word_sentences: owner teacher update" on public.word_sentences for update
      using (exists (select 1 from public.admin_books b where b.book_id = word_sentences.book_id and b.created_by = auth.uid()))
  $p$;
end $$;

-- ── 4. EMOJI PRZY SŁÓWKACH Z PANELU (generator listy słówek AI) ──
do $$
begin
  if to_regclass('public.admin_words') is not null then
    execute 'alter table public.admin_words add column if not exists emoji text';
  end if;
end $$;

select 'OK — funkcje AI: limity, zestawy gramatyczne, zdania nauczyciela, emoji słówek' as status;

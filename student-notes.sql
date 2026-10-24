-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — NOTATKI I PRACE DOMOWE DLA KONKRETNEGO UCZNIA
--  Migracja #69 · idempotentna
--
--  Obok notatek publicznych/prywatnych (book_notes, #14 + #39) admin
--  i nauczyciel mogą dodać przy podręczniku albo unicie notatkę lub pracę
--  domową dla WYBRANYCH uczniów. Każdy uczeń dostaje osobny wiersz — widzi
--  tylko swoje, inni uczniowie nic nie widzą. Uczeń może oznaczyć pracę
--  domową jako zrobioną (RPC student_note_set_done), treści nie zmieni.
--
--  Kto może pisać do ucznia (_can_note_student):
--    admin — do każdego,
--    nauczyciel — do uczniów, których utworzył (profiles.created_by, #13)
--                 albo którzy są w jego klasie (classes.admin_id).
--
--  Wymaga: #13 (profiles.created_by), #20 (_is_admin), tabel classes /
--  class_members.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. TABELA ────────────────────────────────────────────────────
create table if not exists public.student_notes (
  id          uuid primary key default gen_random_uuid(),
  book_id     text not null,
  unit_key    text not null default '',          -- '' = notatka przy całym podręczniku
  student_id  uuid not null references auth.users(id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null default 'note' check (kind in ('note','homework')),
  content     text not null check (char_length(content) between 1 and 4000),
  due_date    date,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists student_notes_student on public.student_notes (student_id, book_id, unit_key);
create index if not exists student_notes_author  on public.student_notes (author_id, book_id, unit_key);

-- ── 2. KTO MOŻE PISAĆ DO UCZNIA ──────────────────────────────────
create or replace function public._can_note_student(p_student uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or p_student is null or p_student = v_me then
    return false;
  end if;
  if public._is_admin() then
    return true;
  end if;
  if exists (select 1 from public.profiles p where p.id = p_student and p.created_by = v_me) then
    return true;
  end if;
  return exists (
    select 1 from public.class_members m
    join public.classes c on c.id = m.class_id
    where m.user_id = p_student and c.admin_id = v_me
  );
end;
$$;

-- ── 3. RLS ───────────────────────────────────────────────────────
alter table public.student_notes enable row level security;

drop policy if exists "student_notes: read"   on public.student_notes;
drop policy if exists "student_notes: insert" on public.student_notes;
drop policy if exists "student_notes: update" on public.student_notes;
drop policy if exists "student_notes: delete" on public.student_notes;

-- Uczeń widzi swoje, autor — napisane przez siebie, admin — wszystko.
create policy "student_notes: read" on public.student_notes for select using (
  student_id = auth.uid() or author_id = auth.uid() or public._is_admin()
);
create policy "student_notes: insert" on public.student_notes for insert with check (
  author_id = auth.uid() and public._can_note_student(student_id)
);
-- Edycja treści: autor lub admin (uczeń oznacza „zrobione” tylko przez RPC).
create policy "student_notes: update" on public.student_notes for update
  using (author_id = auth.uid() or public._is_admin())
  with check (author_id = auth.uid() or public._is_admin());
create policy "student_notes: delete" on public.student_notes for delete using (
  author_id = auth.uid() or public._is_admin()
);

grant select, insert, update, delete on public.student_notes to authenticated;

-- ── 4. UCZEŃ: „ZROBIONE” ─────────────────────────────────────────
create or replace function public.student_note_set_done(p_id uuid, p_done boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v_at timestamptz;
begin
  update public.student_notes
     set done_at = case when p_done then now() else null end
   where id = p_id and student_id = auth.uid()
  returning done_at into v_at;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  return v_at;
end;
$$;

revoke all on function public._can_note_student(uuid) from public;
grant execute on function public._can_note_student(uuid) to authenticated;
revoke all on function public.student_note_set_done(uuid, boolean) from public;
grant execute on function public.student_note_set_done(uuid, boolean) to authenticated;

select 'OK — notatki i prace domowe dla ucznia gotowe' as status;

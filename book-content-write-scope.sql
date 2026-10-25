-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — zapis treści podręcznika tylko we WŁASNYCH podręcznikach
--  Migracja #77 · idempotentna
--
--  Problem: polityki z #28 / #57 / #59 pozwalały KAŻDEMU nauczycielowi
--  (konto nauczyciela może założyć każdy przy rejestracji) nadpisać lub
--  usunąć nagrania wymowy, obrazki słowniczka i zdania kontekstowe we
--  WSZYSTKICH podręcznikach — także w podręcznikach admina i data.js.
--    • word_audio        — wa_write_staff
--    • dictionary_words  — dw_write_staff
--    • word_contexts     — wc_write_staff
--    • storage.objects   — wa_storage_* (bucket word-audio), di_storage_* (dict-images)
--
--  Nowa reguła (helper _can_edit_book_content):
--    admin  — każdy podręcznik
--    nauczyciel — tylko podręcznik z admin_books, gdzie created_by = auth.uid()
--  Pliki w Storage: podręcznik = pierwszy segment ścieżki ({book_id}/{unit}/plik)
--  — tak zapisują db.js (uploadWordAudio) i slownik-obrazkowy.html.
--  Odczyt (SELECT) bez zmian — publiczny.
--
--  Wymaga: #20 (_is_admin/_is_teacher), #28, #57, #59 (tabele tylko jeśli istnieją),
--  admin_books z kolumną created_by (#29/#33).
-- ═══════════════════════════════════════════════════════════════

create or replace function public._can_edit_book_content(p_book text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public._is_admin()
      or (p_book is not null and p_book <> '' and public._is_teacher() and exists (
            select 1 from public.admin_books b
             where b.book_id = p_book and b.created_by = auth.uid()));
$$;

grant execute on function public._can_edit_book_content(text) to anon, authenticated;

do $$
begin
  -- ── tabele ─────────────────────────────────────────────────────
  if to_regclass('public.word_audio') is not null then
    execute 'drop policy if exists "wa_write_staff" on public.word_audio';
    execute 'drop policy if exists "wa_write_own_book" on public.word_audio';
    execute 'create policy "wa_write_own_book" on public.word_audio for all
               using (public._can_edit_book_content(book_id))
               with check (public._can_edit_book_content(book_id))';
  end if;

  if to_regclass('public.dictionary_words') is not null then
    execute 'drop policy if exists "dw_write_staff" on public.dictionary_words';
    execute 'drop policy if exists "dw_write_own_book" on public.dictionary_words';
    execute 'create policy "dw_write_own_book" on public.dictionary_words for all
               using (public._can_edit_book_content(book_id))
               with check (public._can_edit_book_content(book_id))';
  end if;

  if to_regclass('public.word_contexts') is not null then
    execute 'drop policy if exists "wc_write_staff" on public.word_contexts';
    execute 'drop policy if exists "wc_write_own_book" on public.word_contexts';
    execute 'create policy "wc_write_own_book" on public.word_contexts for all
               using (public._can_edit_book_content(book_id))
               with check (public._can_edit_book_content(book_id))';
  end if;

  -- ── Storage (tylko gdy jest schemat storage — na Supabase zawsze) ──
  if to_regclass('storage.objects') is not null then
    -- word-audio
    execute 'drop policy if exists "wa_storage_insert_staff" on storage.objects';
    execute 'drop policy if exists "wa_storage_update_staff" on storage.objects';
    execute 'drop policy if exists "wa_storage_delete_staff" on storage.objects';
    execute 'drop policy if exists "wa_storage_insert_own_book" on storage.objects';
    execute 'drop policy if exists "wa_storage_update_own_book" on storage.objects';
    execute 'drop policy if exists "wa_storage_delete_own_book" on storage.objects';
    execute $p$create policy "wa_storage_insert_own_book" on storage.objects for insert
               with check (bucket_id = 'word-audio' and public._can_edit_book_content(split_part(name, '/', 1)))$p$;
    execute $p$create policy "wa_storage_update_own_book" on storage.objects for update
               using (bucket_id = 'word-audio' and public._can_edit_book_content(split_part(name, '/', 1)))
               with check (bucket_id = 'word-audio' and public._can_edit_book_content(split_part(name, '/', 1)))$p$;
    execute $p$create policy "wa_storage_delete_own_book" on storage.objects for delete
               using (bucket_id = 'word-audio' and public._can_edit_book_content(split_part(name, '/', 1)))$p$;

    -- dict-images
    execute 'drop policy if exists "di_storage_insert_staff" on storage.objects';
    execute 'drop policy if exists "di_storage_update_staff" on storage.objects';
    execute 'drop policy if exists "di_storage_delete_staff" on storage.objects';
    execute 'drop policy if exists "di_storage_insert_own_book" on storage.objects';
    execute 'drop policy if exists "di_storage_update_own_book" on storage.objects';
    execute 'drop policy if exists "di_storage_delete_own_book" on storage.objects';
    execute $p$create policy "di_storage_insert_own_book" on storage.objects for insert
               with check (bucket_id = 'dict-images' and public._can_edit_book_content(split_part(name, '/', 1)))$p$;
    execute $p$create policy "di_storage_update_own_book" on storage.objects for update
               using (bucket_id = 'dict-images' and public._can_edit_book_content(split_part(name, '/', 1)))
               with check (bucket_id = 'dict-images' and public._can_edit_book_content(split_part(name, '/', 1)))$p$;
    execute $p$create policy "di_storage_delete_own_book" on storage.objects for delete
               using (bucket_id = 'dict-images' and public._can_edit_book_content(split_part(name, '/', 1)))$p$;
  end if;
end$$;

-- ── Kontrola: polityki, które wciąż wpuszczają każdego nauczyciela ──
-- Pusty wynik = OK (poza user_labels — prywatne etykiety, nieszkodliwe).
select schemaname, tablename, policyname, cmd
  from pg_policies
 where coalesce(qual, '') || ' ' || coalesce(with_check, '') ~* 'is_teacher'
   and coalesce(qual, '') || ' ' || coalesce(with_check, '') !~* '_is_teacher_of|_owns_class|created_by|admin_id|_can_edit_book_content'
 order by schemaname, tablename, policyname;

-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — KTÓRE MIGRACJE SĄ JUŻ W BAZIE?
--  Tylko odczyt: niczego nie zmienia (funkcje pomocnicze są tymczasowe,
--  w schemacie pg_temp — znikają po zamknięciu połączenia).
--
--  Supabase → SQL Editor → wklej całość → Run.
--  Wynik: najpierw ❌ (brakujące), potem ✅ (są w bazie), na końcu ➖
--  (jednorazowe poprawki danych, których nie da się sprawdzić).
--  Dla każdej migracji sprawdzany jest charakterystyczny obiekt, który
--  ona tworzy (tabela, kolumna, funkcja, polityka, fragment kodu funkcji).
--  Seedy zdań: ✅ = w bazie są zdania dla tego podręcznika.
-- ═══════════════════════════════════════════════════════════════

create or replace function pg_temp.tab(t text) returns boolean language sql as
  $$ select to_regclass(t) is not null $$;
create or replace function pg_temp.col(t text, c text) returns boolean language sql as
  $$ select exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = t and column_name = c) $$;
create or replace function pg_temp.fn(f text) returns boolean language sql as
  $$ select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname = f) $$;
create or replace function pg_temp.body(f text, pat text) returns boolean language sql as
  $$ select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname = f and p.prosrc ilike '%' || pat || '%') $$;
create or replace function pg_temp.pol(t text, p text) returns boolean language sql as
  $$ select exists (select 1 from pg_policies where tablename = t and policyname = p) $$;
create or replace function pg_temp.trg(t text) returns boolean language sql as
  $$ select exists (select 1 from pg_trigger where tgname = t and not tgisinternal) $$;
create or replace function pg_temp.rows(t text, book text) returns boolean language plpgsql as $$
  declare r boolean;
  begin
    if to_regclass('public.' || t) is null then return false; end if;
    execute format('select exists (select 1 from public.%I where book_id = $1)', t) into r using book;
    return r;
  end $$;
create or replace function pg_temp.trials_ok() returns boolean language plpgsql as $$
  declare r boolean;
  begin
    if not pg_temp.col('profiles', 'trial_used_at') then return false; end if;
    execute $q$select not exists (select 1 from public.profiles
               where plan = 'premium' and trial_used_at is not null and plan_expires_at > now()
                 and plan_expires_at - trial_used_at <= interval '8 days' and coalesce(is_admin, false) = false)$q$ into r;
    return r;
  end $$;

create or replace function pg_temp.mw_ok() returns boolean language plpgsql as $$
  declare r boolean;
  begin
    if to_regclass('public.admin_books') is null or to_regclass('public.admin_units') is null then return false; end if;
    execute $q$select exists (select 1 from public.admin_units u join public.admin_books b on b.book_id = u.book_id
                               where b.name ilike 'Angielski MW%')$q$ into r;
    return r;
  end $$;

with c(nr, plik, ok) as (values
  ('01', 'supabase-schema.sql',                   pg_temp.tab('public.unit_progress')),
  ('02', 'fix-rls-and-user-books.sql',            pg_temp.tab('public.user_books')),
  ('03', 'admin-create-user.sql + admin-delete-user.sql', pg_temp.fn('admin_create_user') and pg_temp.fn('admin_delete_user')),
  ('04', 'add-teacher-role.sql',                  pg_temp.col('profiles', 'is_teacher')),
  ('05', 'add-plan.sql',                          pg_temp.col('profiles', 'plan')),
  ('06', 'fix-admin-update-profiles.sql',         pg_temp.pol('profiles', 'profiles: admin UPDATE all')),
  ('07', 'sync-is-teacher-with-plan.sql (jednorazowa)', null),
  ('08', 'fix-delete-own-account.sql',            pg_temp.fn('delete_own_account')),
  ('09', 'teacher-sets-schema.sql',               pg_temp.tab('public.teacher_sets')),
  ('10', 'book-access-requests-schema.sql',       pg_temp.tab('public.book_access_requests')),
  ('11', 'fix-book-access-requests-admin-only.sql', pg_temp.col('book_access_requests', 'student_name')),
  ('12', 'admin-reset-password.sql',              pg_temp.fn('admin_reset_user_password')),
  ('13', 'fix-created-by.sql',                    pg_temp.col('profiles', 'created_by') and pg_temp.fn('set_profile_creator')),
  ('14', 'book-notes-schema.sql',                 pg_temp.tab('public.book_notes')),
  ('15', 'word-error-reports-schema.sql',         pg_temp.tab('public.word_error_reports')),
  ('16', 'fix-admin-create-user.sql',             pg_temp.body('admin_create_user', 'reauthentication_token')),
  ('17', 'add-parent-role.sql',                   pg_temp.tab('public.parent_children') and pg_temp.col('profiles', 'is_parent')),
  ('17b','fix-parent-add-child.sql',              pg_temp.fn('parent_add_child')),
  ('18', 'admin-messages-schema.sql',             pg_temp.tab('public.conversations')),
  ('19', 'add-premium-expiry.sql',                pg_temp.col('profiles', 'plan_expires_at') and pg_temp.fn('admin_extend_premium')),
  ('20', 'fix-rls-recursion.sql',                 pg_temp.fn('_is_parent_of')),
  ('21', 'add-daily-xp-history.sql',              pg_temp.tab('public.daily_xp_log')),
  ('22', 'auto-delete-inactive-users.sql',        pg_temp.fn('auto_delete_inactive_users')),
  ('23', 'fix-admin-no-trial.sql',                pg_temp.body('activate_trial', 'is_admin')),
  ('24', 'add-study-minutes.sql',                 pg_temp.col('daily_xp_log', 'minutes') and pg_temp.fn('log_study_minutes')),
  ('25', 'dedupe-user-books.sql',                 exists (select 1 from pg_indexes where tablename = 'user_books'
                                                     and indexdef ilike '%unique%' and indexdef ilike '%user_id%' and indexdef ilike '%book_id%')),
  ('26', 'add-user-labels.sql',                   pg_temp.tab('public.user_labels')),
  ('27', 'book-access-overrides.sql',             pg_temp.tab('public.book_access_overrides')),
  ('28', 'add-word-audio.sql',                    pg_temp.tab('public.word_audio')),
  ('29', 'add-admin-books-metadata.sql',          pg_temp.col('admin_books', 'school_type')),
  ('30', 'public-contact-messages.sql',           pg_temp.tab('public.public_contact_messages')),
  ('31', 'add-language-ru.sql',                   exists (select 1 from pg_constraint where conname = 'admin_books_language_check'
                                                     and pg_get_constraintdef(oid) like '%''ru''%')),
  ('32', 'add-hide-premium-banners.sql',          pg_temp.col('profiles', 'hide_premium_banners')),
  ('33', 'add-teacher-books.sql',                 pg_temp.pol('admin_books', 'admin_books_select')),
  ('34', 'extend-trial-to-30-days.sql',           pg_temp.body('activate_trial', '30 days')),
  ('35', 'add-user-private-note.sql',             pg_temp.col('user_labels', 'private_note')),
  ('36', 'admin-grant-trial.sql',                 pg_temp.fn('admin_grant_trial')),
  ('37', 'backfill-7day-trials-to-30.sql (brak aktywnych 7-dniowych triali)', pg_temp.trials_ok()),
  ('38', 'admin-link-parent-to-student.sql',      pg_temp.fn('admin_link_parent_to_student')),
  ('39', 'book-notes-add-visibility.sql',         pg_temp.col('book_notes', 'visibility')),
  ('40', 'add-dialogs.sql',                       pg_temp.tab('public.dialogs')),
  ('41', 'add-word-audio-bilingual.sql',          pg_temp.col('word_audio', 'audio_url_pl')),
  ('42', 'add-sentence-audio.sql',                pg_temp.col('word_audio', 'audio_url_sent_pl')),
  ('43', 'drop-word-audio-not-null.sql',          exists (select 1 from information_schema.columns where table_schema = 'public'
                                                     and table_name = 'word_audio' and column_name = 'audio_url' and is_nullable = 'YES')),
  ('44', 'add-audio-stats-rpcs.sql',              pg_temp.fn('audio_storage_stats')),
  ('45', 'add-ranking-stats.sql',                 pg_temp.col('profiles', 'best_correct_streak') and pg_temp.fn('log_daily_words')),
  ('46', 'class-challenges-schema.sql',           pg_temp.tab('public.class_challenges')),
  ('47', 'student-class-ranking.sql',             pg_temp.fn('my_class_rankings')),
  ('48', 'child-active-challenges.sql',           pg_temp.fn('child_active_challenges')),
  ('49', 'shop-schema.sql',                       pg_temp.tab('public.shop_products')),
  ('50', 'add-typed-days.sql',                    pg_temp.col('daily_xp_log', 'typed')),
  ('51', 'typed-answers-schema.sql',              pg_temp.tab('public.typed_answers')),
  ('52', 'grade-disabled-weeks.sql',              pg_temp.tab('public.grade_disabled_weeks')),
  ('53', 'admin-account-management.sql',          pg_temp.fn('admin_login_stats')),
  ('54', 'add-well-learned-ranking.sql',          pg_temp.col('profiles', 'well_learned_words')),
  ('55', 'notesownik-boards-schema.sql',          pg_temp.tab('public.notesownik_boards')),
  ('56', 'sowiemysli-maps-schema.sql',            pg_temp.tab('public.sowiemysli_maps')),
  ('57', 'dictionary-images-schema.sql',          pg_temp.tab('public.dictionary_words')),
  ('58', 'penpal-schema.sql',                     pg_temp.tab('public.penpal_submissions')),
  ('59', 'word-contexts-schema.sql',              pg_temp.tab('public.word_contexts')),
  ('60', 'class-ranking-links.sql',               pg_temp.tab('public.class_ranking_links')),
  ('61', 'student-duels.sql',                     pg_temp.tab('public.duels') and pg_temp.col('profiles', 'nickname')),
  ('62', 'profile-avatars.sql',                   pg_temp.col('profiles', 'avatar_url')),
  ('63', 'duel-invite-teacher.sql',               pg_temp.fn('_duel_can_pair')),
  ('64', 'class-quizzes.sql',                     pg_temp.tab('public.quizzes')),
  ('65', 'live-game-rematch.sql',                 pg_temp.fn('live_game_rematch')),
  ('66', 'game-sessions.sql',                     pg_temp.tab('public.game_sessions')),
  ('67', 'global-leaderboard.sql',                pg_temp.fn('global_leaderboard')),
  ('68', 'grammar-city-online.sql',               pg_temp.fn('gc_my_classes')),
  ('69', 'student-notes.sql',                     pg_temp.tab('public.student_notes')),
  ('70', 'pet-sync.sql',                          pg_temp.col('profiles', 'pet')),
  ('71', 'pet-social.sql',                        pg_temp.tab('public.pet_reactions')),
  ('72', 'grammar-city-saves.sql',                pg_temp.tab('public.grammar_city_saves')),
  ('73', 'ai-features.sql',                       pg_temp.tab('public.grammar_sets') and pg_temp.fn('ai_usage_bump')),
  ('74', 'admin-safety.sql',                      pg_temp.tab('public.admin_audit') and pg_temp.trg('profiles_guard')),
  ('75', 'teacher-scope-rls.sql',                 pg_temp.fn('_is_teacher_of')),
  ('76', 'parent-link-codes.sql',                 pg_temp.tab('public.parent_link_codes')),
  ('77', 'book-content-write-scope.sql',          pg_temp.fn('_can_edit_book_content')),
  -- poza numeracją CLAUDE.md
  ('78', 'content-review-bank.sql',                 pg_temp.col('grammar_sets', 'status') and pg_temp.tab('public.reading_sets')),
  ('79', 'ai-cost-panel.sql',                     pg_temp.col('ai_usage', 'tokens_in') and pg_temp.tab('public.ai_limits')),
  ('80', 'ai-chat-logs.sql',                      pg_temp.tab('public.ai_chat_logs')),
  ('81', 'pet-phrases.sql',                       pg_temp.tab('public.pet_phrases')),
  ('82', 'ai-diary.sql',                          pg_temp.col('ai_chat_logs', 'session_id') and pg_temp.fn('my_ai_diary')),
  ('83', 'user-presence.sql',                     pg_temp.tab('public.user_presence') and pg_temp.fn('presence_online')),
  ('84', 'security-advisor-fixes.sql',            coalesce(not has_function_privilege('anon', to_regprocedure('public._delete_account_rows(uuid)')::oid, 'EXECUTE'), true)),
  ('x2', 'add-live-games.sql',                    pg_temp.fn('create_live_game')),
  ('x3', 'add-live-time-limit-and-score-rpc.sql', pg_temp.fn('update_live_player_score')),
  ('x4', 'fix-live-join-token.sql + fix-live-join-ambiguous.sql', pg_temp.fn('join_live_game')),
  ('x5', 'add-activity-tracking.sql',             pg_temp.tab('public.activity_events')),
  ('x6', 'add-generated-passwords.sql',           pg_temp.col('profiles', 'generated_password') and pg_temp.fn('set_generated_password')),
  ('x7', 'add-image-url.sql',                     pg_temp.col('word_sentences', 'image_url')),
  ('x8', 'add-angielskiMW-unit1.sql (dane)',      pg_temp.mw_ok()),
  -- seedy zdań przykładowych (word_sentences)
  ('s1', 'fix-sentences-tiger1/2/3.sql',          pg_temp.rows('word_sentences', 'tiger1') and pg_temp.rows('word_sentences', 'tiger2') and pg_temp.rows('word_sentences', 'tiger3')),
  ('s2', 'fix-sentences-brainy6/7.sql',           pg_temp.rows('word_sentences', 'brainy6') and pg_temp.rows('word_sentences', 'brainy7')),
  ('s3', 'fix-sentences-bugsteam2/3.sql',         pg_temp.rows('word_sentences', 'bugsteam2') and pg_temp.rows('word_sentences', 'bugsteam3')),
  ('s4', 'fix-sentences-together4/5/6.sql',       pg_temp.rows('word_sentences', 'together4') and pg_temp.rows('word_sentences', 'together5') and pg_temp.rows('word_sentences', 'together6')),
  ('s5', 'fix-sentences-link7/8.sql',             pg_temp.rows('word_sentences', 'link7') and pg_temp.rows('word_sentences', 'link8')),
  ('s6', 'fix-sentences-beHappy2.sql',            pg_temp.rows('word_sentences', 'beHappy2')),
  ('s7', 'fix-sentences-englishA1.sql',           pg_temp.rows('word_sentences', 'englishA1')),
  ('s8', 'fix-sentences-kidscan1.sql',            pg_temp.rows('word_sentences', 'kidscan1')),
  ('s9', 'fix-sentences-stepsplus4.sql',          pg_temp.rows('word_sentences', 'stepsplus4')),
  ('s10','fix-sentences-newpassword.sql',         pg_temp.rows('word_sentences', 'newpassword')),
  ('s11','fix-sentences-impuls3.sql',             pg_temp.rows('word_sentences', 'impuls3')),
  ('s12','sentences-francais.sql',                pg_temp.rows('word_sentences', 'francais')),
  -- seedy fiszek kontekstowych (word_contexts, #59)
  ('k1', 'seed-contexts-brainy5.sql',             pg_temp.rows('word_contexts', 'brainy5')),
  ('k2', 'seed-contexts-brainy6.sql',             pg_temp.rows('word_contexts', 'brainy6')),
  ('k3', 'seed-contexts-brainy7.sql',             pg_temp.rows('word_contexts', 'brainy7')),
  ('k4', 'seed-contexts-bugsteam2.sql',           pg_temp.rows('word_contexts', 'bugsteam2')),
  ('k5', 'seed-contexts-bugsteam3.sql',           pg_temp.rows('word_contexts', 'bugsteam3')),
  ('k6', 'seed-contexts-stayBrainy4.sql',         pg_temp.rows('word_contexts', 'stayBrainy4'))
)
select nr, plik,
       case when ok is null then '➖ nie do sprawdzenia'
            when ok then '✅ jest' else '❌ BRAK' end as status
  from c
 order by case when ok is null then 2 when ok then 1 else 0 end, nr;

# Sowie Fiszki — przewodnik dla Claude

> Ten plik jest automatycznie czytany na starcie każdej nowej sesji Claude Code.
> Zawiera najważniejsze informacje o projekcie — architekturę, konwencje, stan funkcji.

## 🦉 Projekt

**Sowie Fiszki** — PWA do nauki angielskiego (fiszki, gry, generatory mowy).
- **Właściciel / administrator:** Daniel Ostrowski
- **E-mail kontaktowy:** `sowie.fiszki@gmail.com`
- **Repo:** https://github.com/dandeliant/sowie.fiszki (branch `main`, **prywatne** od 29.04.2026)
- **Hosting:** Vercel → **https://sowiefiszki.com** (custom domain, od 29.04.2026; wcześniej GitHub Pages)
- **Backend:** Supabase (auth + Postgres + RLS), projekt `kofenaaeleyhwhbkytcz`
- **Charakter:** osoba fizyczna prowadząca Platformę; **model freemium** (30-dniowy trial Premium → Free / Premium po opłacie). Wcześniej projekt był non-commercial — od ~2026-04-29 przygotowywany do monetyzacji.
- **Service Worker:** aktualnie `v1.32` (stan na 15 maja 2026). Format `vMAJOR.MINOR` z zerem wiodącym, od `v1.00` (zresetowane od maja 2026 dla porządku; wcześniej luźna numeracja `v50`–`v233`).
- **Promocja Premium:** **wszyscy zalogowani użytkownicy mają Premium za darmo do 31.08.2026** (override po stronie kodu w `db.js isPremium()` — `isPromoActive()` zwraca `true` gdy `Date.now() < 2026-09-01 00:00`). Po 1.09.2026 promocja samoczynnie wygasa — wraca normalna logika: nowi użytkownicy mają 30-dniowy trial gratis, reszta przechodzi na Free.

## 💰 Koszty i terminy odnowienia

| Pozycja | Koszt | Termin / Status |
|---|---|---|
| **Domena `sowiefiszki.com`** (zarejestrowana przez Vercel) | $11,25 USD ≈ **46 zł** / rok | **Odnowienie: 29 kwietnia 2027** (auto-renew z karty zapisanej w Vercel) |
| **Hosting Vercel** (Free tier — 100 GB transferu/mies.) | 0 zł | Wystarczy do ~kilku tysięcy aktywnych użytkowników. Po przekroczeniu — Vercel Pro ~20 USD/mies. |
| **Supabase** (Free tier — 500 MB DB + 1 GB Storage + 5 GB transfer) | 0 zł | Storage uważnie monitorować przy nagraniach wymowy (`word-audio` bucket). Po przekroczeniu — Supabase Pro ~25 USD/mies. |
| **GitHub** (repo prywatne, Free tier) | 0 zł | Bez limitów dla małego repo |

**Razem stałe koszty: ~46 zł / rok** (~3,80 zł / miesiąc). Wszystko inne na Free tierach do rozsądnego pułapu użycia.

**⚠️ Termin do pamiętania: kwiecień 2027** — sprawdzić stan karty w Vercel ~30 dni przed odnowieniem domeny. W razie problemów z auto-renew, domena może wygasnąć i przejść do bidu po grace period.

### 📧 Skrzynka firmowa (planowana)

Obecnie **brak skrzynki na własnej domenie** — kontakt idzie na `sowie.fiszki@gmail.com`.

**Plan:** uruchomić `kontakt@sowiefiszki.com` przez **ForwardEmail.net** (forwarding na gmail, darmowe). Próba 2 maja 2026 nieudana — ForwardEmail blokuje świeżo zarejestrowane domeny przez ~30-90 dni jako anti-abuse policy (sowiefiszki.com kupiona 29.04.2026). 

**Termin powtórnej próby: początek lipca 2026** (po ~60 dniach „dojrzewania" domeny). Wtedy:
1. Sign up na forwardemail.net (przez Google `sowie.fiszki@gmail.com`)
2. Add Domain `sowiefiszki.com` → Add Alias `kontakt` → `sowie.fiszki@gmail.com`
3. W Vercel DNS: 2 rekordy MX (`mx1.forwardemail.net`, `mx2.forwardemail.net`, priority 10) + TXT (`forward-email=kontakt:sowie.fiszki@gmail.com`) + SPF (`v=spf1 a mx include:_spf.forwardemail.net -all`)
4. (Opcjonalnie) Gmail „Send mail as" z App Password — żeby odpowiedzi wychodziły z `kontakt@sowiefiszki.com`
5. Po potwierdzeniu działania → update we wszystkich plikach (`polityka.html` §13, `regulamin.html`, `home.html`/`faq.html`/`aktualnosci.html` stopki, `app.html` wzmianki, `LIST-DO-WYDAWNICTW.md`).

**Alternatywy gdyby ForwardEmail nadal odmawiał po 90 dniach:** Zoho Mail Free (5 skrzynek, 5 GB, bez IMAP) lub Cloudflare Email Routing (wymaga przeniesienia DNS z Vercel do Cloudflare).

## 📂 Architektura

### Pliki główne
- `index.html` (~550 linii) — ekran logowania/rejestracji. 3 role rejestracji (Uczeń / Nauczyciel / Rodzic-Opiekun), regulamin + polityka prywatności, checkboxy zgody.
- `app.html` (~15 800 linii) — główna aplikacja SPA. Wszystkie ekrany (patrz niżej). Logika w IIFE + globalnych funkcjach. **Nie dziel na moduły — jeden plik pozostaje konwencją.**
- `teacher.html` (~150 linii) — osobna strona „Panel nauczyciela" (hub kafelków: Klasy / Dostęp / Zestawy / Prośby / Błędy / Wiadomości / Nieaktywni / Podręczniki nauczycieli / Raporty / Karty pracy / Premium). Każdy kafelek to `<a href="app.html?go=xxx">` — `app.html` ma handler `?go=` parameter, który wywołuje odpowiednią funkcję `openAdminClasses()` / `openTeacherSets()` itp. Statyczna strona, nie ładuje DB.
- `words.html` (~280 linii) — osobna strona „Słówka" (podgląd wszystkich słówek z wszystkich podręczników, ładuje `data.js`). Filtr podręcznika/unitu + wyszukiwarka. Tabela 5 kolumn: Podręcznik/Unit · Polski · Angielski · Zdanie PL · Zdanie EN. Limit 1000 wierszy. Kafelek „🔤 Słówka" w panelu admina kieruje tutaj.
- `data.js` — obiekt `BOOKS` z 17 podręcznikami (klasa1–8, brainy6/7, tiger1/2/3, together4/5/6, bugsteam2/3, stepsplus4, stepsplus5, englishA1, beHappy2, newpassword, czasowniki, francais). Każda ksiazka ma: `id`, `language`, `schoolType`, `grade`, `defaultAccess`/`adminOnly`, `units: { unitN: { name, icon, color, words: [[pl, en, zdaniePl, zdanieEn], …] } }`. Funkcja `getBookUnitsWithAll(bId)` dodaje virtualny unit `all` (ikona 🌍, nazwa „Wszystkie", zawiera wszystkie słowa z podręcznika) — używany przez gry z opcją „cały podręcznik".
- `db.js` — warstwa Supabase (sesja, auth, profile, postępy, klasy, user_books, RLS helpers). Funkcje eksportowane przez globalny obiekt `DB`.
- `supabase-config.js` — URL + anon key.
- `sw.js` — Service Worker (network-first dla HTML/JS + cache-first dla fontów/CDN). Bypass dla Supabase REST API.
- `manifest.json` — PWA manifest. `id: "/"`, `start_url: "/app"`, `scope: "/"`, `display: standalone`, 2 ikony SVG (regular + maskable), shortcuts (App / Nauczyciel / Home). Po `start_url` Chrome ląduje od razu w app.html (auth gate przekieruje na `/login` jeśli niezalogowany).
- `icon.svg` / `icon-maskable.svg` — wektorowe ikony PWA. `icon.svg` ma zaokrąglone rogi (`rx=96`) i napis „Sowie Fiszki" pod owlem, używany jako `purpose: any` + `apple-touch-icon` + `<link rel="icon">`. `icon-maskable.svg` jest pełnoekranowy (Android maskuje go do okręgu/squircle) z owlem w strefie bezpiecznej (inner 60%). Oba używają emoji 🦉 renderowanego przez Apple Color / Noto Color / Segoe UI Emoji w zależności od platformy.
- **PWA install** — `app.html` (sekcja `_initPwaInstall`) wyłapuje `beforeinstallprompt` (Android Chrome) i pokazuje banner z przyciskiem „Zainstaluj". Dla iOS Safari (które nie wspiera tego API) pokazuje osobny banner z instrukcją „⎙ → Dodaj do ekranu głównego". Dismiss zapamiętywany w `localStorage['fiszki_pwa_install_dismissed_at']` na 7 dni. Globalna funkcja `window.showInstallPromptNow()` dla wywołania z modala konta. Banner ukrywa się gdy `display-mode: standalone` (apka już zainstalowana).

### Kluczowe ekrany w `app.html`
`sLang`, `sSchool`, `sClass`, `sBooks` (panel staff), `sUnits`, `sWordList`, `sStudy`, `sCrossword`, `sWordsearch`, `sSnake`, `sMemory`, `sHangman`, `sScrGame`, `sSentScrGame`, `sBoardGame`, `sDobble`, `sImageCard`, `sCubes`, `sDuel` (Rywalizacja), `sSpeed`, `sStats`, `sApps`, `sDone`, `sAdminAccess`, `sAdminClasses`, `sClassDetail`, `sStudentProgress`, `sTeacherSets`, `sTeacherSetEdit`, `sAdminTeacherSets`, `sAccessRequests`, `sWordErrors`, `sMessages`, `sParentPanel`, `sAddChild`, `sChildBooks`, `sInactive`, `sBulkStudents`.

### Pliki gier w sekcji INNE (samodzielne HTML)
11 gier — wszystkie mają TOP i BOTTOM link „Powrót do Sowie Fiszki" + `@media print` ukrywający je:
- `how-many.html` — „Ile? — How many?" (there is/are + liczebniki)
- `birthday.html` — „Urodziny" (liczebniki + miesiące, SVG awatary)
- `generator-cyfr.html` — „Generator cyfr" (losowa liczba + brytyjski TTS)
- `speaking_cards_together5.html` — Together 5 Present Simple (czas + przysłówki)
- `speaking_cards_animals.html` — Animals & Food (likes/doesn't like/eats)
- `whats_the_matter.html` — Tiger & Friends 2 U5 (choroby, porady)
- `shops_speaking_generator.html` — Bugs Team 3 U5 (I'm looking for / There is-are)
- `have_you_ever.html` — Have you ever…? (Present Perfect, 2-osobowy)
- `speaking_game_present_simple.html` — Yes/no questions + pełne odpowiedzi
- `citylife_speaking.html` — CityLife „paszport" generator + speaking practice
- `has_he_got_a_pet.html` — „Has he/she got a pet?" generator (Steps Plus, has got + zwierzaki, postać + mystery box + animacja)

Każda z gier ma też modal **„ℹ️ Jak grać?"** (fixed top-right) z 5-8 krokami instrukcji.

## 🗄️ Migracje SQL do Supabase

Kolejność uruchamiania w SQL Editor (każda jest idempotentna — można ponownie):

1. `supabase-schema.sql` — podstawowe tabele (profiles, unit_progress, admin_requests) + RLS
2. `fix-rls-and-user-books.sql` — tabela user_books
3. `admin-create-user.sql`, `admin-delete-user.sql` — RPC do zarządzania użytkownikami
4. `add-teacher-role.sql` — kolumna is_teacher + RLS dla nauczyciela
5. `add-plan.sql` — kolumna plan (free/premium/teacher)
6. `fix-admin-update-profiles.sql` — admin UPDATE na profiles (naprawia zmianę planu)
7. `sync-is-teacher-with-plan.sql` — jednorazowa synchronizacja is_teacher z planem
8. `fix-delete-own-account.sql` — RPC delete_own_account (RODO art. 17)
9. `teacher-sets-schema.sql` — teacher_sets/words/assignments
10. `book-access-requests-schema.sql` — prośby ucznia o dostęp
11. `fix-book-access-requests-admin-only.sql` — prośby tylko dla admina + student_name
12. `admin-reset-password.sql` — RPC admin_reset_user_password (pgcrypto)
13. `fix-created-by.sql` — profiles.created_by + RPC set_profile_creator (nauczyciel widzi tylko swoich uczniów)
14. `book-notes-schema.sql` — notatki admina na ekranach podręcznika/unitu
15. `word-error-reports-schema.sql` — zgłoszenia błędów w słówkach (widoczne tylko dla admina)
16. `fix-admin-create-user.sql` — naprawa `admin_create_user` (puste stringi zamiast NULL dla kolumn tokenów — bez tego gotrue odrzucał `signInWithPassword`); zezwala nauczycielowi tworzyć konta uczniów
17. `add-parent-role.sql` — rola Rodzic/Opiekun (`profiles.is_parent`) + tabela `parent_children` + RPC `find_user_by_username`, `parent_assign_book_to_child`, `parent_unassign_book_from_child`
18. `admin-messages-schema.sql` — konwersacje user ↔ admin (`conversations`, `conversation_messages`) + RPC `count_open_conversations`
19. `add-premium-expiry.sql` — `profiles.plan_expires_at` + `trial_used_at` + RPC `activate_trial()` (7-dniowy trial) + RPC `admin_extend_premium(user_id, months)`
20. `fix-rls-recursion.sql` — **KRYTYCZNE**: naprawia infinite recursion w politykach RLS (profiles ↔ parent_children ↔ profiles). Tworzy helpery `_is_admin()`, `_is_teacher()`, `_is_parent_of(uuid)` z `SECURITY DEFINER` (omijają RLS). Bez tego: HTTP 500 przy SELECT profiles → „Nieprawidłowa nazwa użytkownika lub hasło" przy logowaniu.
21. `add-daily-xp-history.sql` — tabela `daily_xp_log (user_id, day, xp)` z RLS + RPC `log_daily_xp(delta)` (upsert). Używane do wykresu „Historia nauki 12 miesięcy" (Premium).
22. `auto-delete-inactive-users.sql` — RPC `auto_delete_inactive_users()` usuwa konta uczniów (nie admin/nauczyciel/opiekun) z `last_study_date` >1 rok temu. Wywoływane client-side raz dziennie przy logowaniu admina.
23. `fix-admin-no-trial.sql` — admin nie dostaje triala (czyści `plan_expires_at` + `trial_used_at` dla wszystkich adminów, RPC `activate_trial()` zwraca NULL dla admina).
24. `add-study-minutes.sql` — kolumny `minutes` + `first_active_at` w `daily_xp_log` + RPC `log_study_minutes(p_minutes)`. Klient wysyła heartbeat co 1 min aktywnej widoczności strony (`DB.logStudyMinutes(1)`). Używane w widoku nauczyciela/opiekuna: postęp ucznia → sekcja „📅 Aktywność nauki" (ostatnie 90 dni: data / pierwsze wejście / czas nauki / XP).
25. `dedupe-user-books.sql` — usuwa duplikaty wierszy z `user_books` (zostawia najstarszy per para `user_id`+`book_id`) + dodaje `UNIQUE(user_id, book_id)`. Naprawia: uczeń widział dwa identyczne kafelki tego samego podręcznika w sekcji „Twoje podręczniki".
26. `add-user-labels.sql` — tabela `user_labels(labeler_id, target_user_id, label)` + RLS (widzi tylko autor). Admin/nauczyciel/opiekun mogą podpisywać prywatnymi etykietami uczniów/dzieci (np. „Jan Kowa"). Etykieta widoczna jest tylko u autora — inni widzą tylko login. API: `DB.getUserLabel(id)`, `DB.setUserLabel(id, txt)`, `DB.deleteUserLabel(id)`; helper `fmtNameWithLabel(id, username)` w app.html renderuje login + etykietę w każdym widoku (klasy, postęp ucznia, dzieci opiekuna, panel admina).
27. `book-access-overrides.sql` — tabela `book_access_overrides(book_id PK, visible_to_guest, visible_to_student, visible_to_teacher, visible_to_parent, tier 'free'/'premium', updated_by, updated_at)` z RLS (SELECT all dla każdego, w tym anon; INSERT/UPDATE/DELETE tylko admin). Pozwala adminowi nadpisywać widoczność per rola + tier dla pojedynczego podręcznika. Ustawienia z DB mają pierwszeństwo przed flagami `defaultAccess`/`adminOnly` z `data.js`. API: `DB.loadBookAccessOverrides()` (cache, ładowane w `loadProfile`), `DB.getBookAccessOverrides()`, `DB.adminSaveBookAccessOverride(bookId, settings)`, `DB.adminClearBookAccessOverride(bookId)`. Helper w app.html: `getEffectiveBookAccess(book)` zwraca `{visibleToGuest, visibleToStudent, visibleToTeacher, visibleToParent, tier, hasOverride}`. Edytuje się w 3. zakładce „⚙️ Globalnie" modala „🔓 Dostęp" (admin only).
28. `add-word-audio.sql` — tabela `word_audio((book_id, unit_key, word_pl) PK, audio_url, audio_path, uploaded_by, uploaded_at)` + Storage bucket `word-audio` (publiczny dla SELECT) + Storage RLS policies (SELECT anon, INSERT/UPDATE/DELETE staff). Custom nagrania wymowy słówek z mikrofonu (MediaRecorder API → audio/webm;codecs=opus → upload do Supabase Storage). API: `DB.loadWordAudioCache()` (ładuje wszystkie URL-e na start, cache `book_id|unit_key|word_pl → url`), `DB.getWordAudioUrl(bookId, unitKey, wordPl)` (sync getter z cache), `DB.uploadWordAudio(blob, bookId, unitKey, wordPl)`, `DB.deleteWordAudio(bookId, unitKey, wordPl)`. UI w modalu „✏️ Edytuj słówko" (otwierany z fiszki przez przycisk „✏️ Edytuj") — sekcja „🎙️ Wymowa" z przyciskami Nagraj/Stop/Odtwórz/Zapisz/Usuń. W playback chain (`_speakTargetCurr` w app.html): jeśli istnieje custom nagranie → odtwarzamy je; w przeciwnym razie fallback do TTS (`spk`). Limit 1MB / max 10s per nagranie.
29. `add-admin-books-metadata.sql` — `ALTER TABLE admin_books ADD COLUMN school_type, language, grade` (idempotentnie) + CHECK constraints (`school_type IN ('primary','secondary','courses','grammar','other')`, `language IN ('en','fr','de','es','it')`) + UPDATE istniejących wierszy z defaultami `school_type='courses', language='en'`. **WAŻNE:** bez tej migracji wszystkie podręczniki dodane przez panel admina (`admin_books`) są niewidoczne we wszystkich 4 kafelkach `sSchool` — bo filtr w `refreshBooks` używa `b.language` i `b.schoolType`, których stary schemat `admin_books` nie miał. API: `DB.adminAddBook(bookId, name, sName, icon, color, desc, lang, meta)` z dodatkowym argumentem `meta = {schoolType, language, grade}` (z fallbackiem do insertu bez meta jeśli kolumny nie istnieją), `DB.adminEditBook(bookId, fields)` (częściowy update), `DB.adminDeleteBook(bookId)` (kasuje też powiązane `admin_units` + `admin_words`). UI: rozszerzony modal „📚 Nowy podręcznik" z polami Kategoria + Język + Klasa (Klasa pokazywana tylko dla primary/secondary). Modal pełni też rolę „✏️ Edytuj podręcznik" — otwierany przez nowy przycisk ✏️ w lewym górnym rogu kafelka admin-added book (CSS `.book-edit-btn`, tylko admin, tylko gdy `book._isAdminBook === true`). Tryb edycji ma dodatkowo przycisk „🗑️ Usuń".
30. `public-contact-messages.sql` — tabela `public_contact_messages(id, name, email, subject, message, user_agent, is_read, is_replied, notes, created_at)` z CHECK constraints na długość pól + RLS (INSERT anyone z CHECK; SELECT/UPDATE/DELETE tylko admin) + RPC `count_unread_contact_messages()`. Publiczny formularz kontaktowy w sekcji `#kontakt` na `home.html` — anti-bot: honeypot (ukryte pole `website` — bot wypełni), time-check (formularz wypełniony w <3s = bot), URL-count check (>3 linki w wiadomości = spam), walidacje długości po stronie klienta i bazy. API: `DB.submitContactForm(payload)` (anon), `DB.adminLoadContactMessages(filter)`, `DB.adminUpdateContactMessage(id, fields)`, `DB.adminDeleteContactMessage(id)`, `DB.countUnreadContactMessages()`. Admin widzi wiadomości w nowym ekranie `sContactMessages` (kafelek „📨 Formularz kontaktowy" w `teacher.html` → `?go=contactMessages`). Każda wiadomość ma akcje: oznacz przeczytane / oznacz odpowiedziane / odpowiedz e-mailem (mailto: link) / usuń.
31. `add-language-ru.sql` — rozszerzenie `admin_books_language_check` z migracji #29 o `'ru'`. Po dodaniu kafelków języków w sLang (Angielski/Francuski/Niemiecki/Rosyjski) admin może tworzyć podręczniki rosyjskie przez modal „Nowy podręcznik". Idempotentna (DROP CONSTRAINT IF EXISTS + ADD). UI: select language w modalu admina ma teraz 4 opcje (EN/FR/DE/RU). `selectLanguage` w app.html zunifikowane — wszystkie języki idą przez sSchool z 4 kategoriami (Podstawowa/Średnia/Kursy/Gramatyka), tytuły dynamiczne przez `_LANG_META` i `getLangMeta()`. `francais` w data.js dostał `schoolType: 'courses'`, żeby pojawił się w kategorii „💼 Kursy tematyczne".
32. `add-hide-premium-banners.sql` — kolumna `profiles.hide_premium_banners BOOLEAN NOT NULL DEFAULT FALSE` + RPC `admin_set_hide_premium_banners(p_user_id UUID, p_value BOOLEAN)` (`SECURITY DEFINER`). Pozwala adminowi/nauczycielowi-twórcy ukryć bannery Premium („🎁 Masz 7 dni Premium" + „🎁 Darmowy trial kończy się…") konkretnemu uczniowi. Reguły RPC: admin → wszystkim, nauczyciel → tylko `created_by = self`, sam uczeń nie zmienia (nie ma RPC w eksporcie do UI). API: `DB.getHidePremiumBanners()` (z lokalnego `_profile`), `DB.adminSetHideBanners(userId, value)`. UI: nowy modal `#userSettingsModal` „⚙️ Ustawienia konta" otwierany przyciskiem ⚙️ w widoku Klasy (`renderClassStudents`) i Dostępu (`buildAccessUserCard`) — pozwala ustawić plan (Free/Premium/Teacher, admin only) i ukryć bannery (admin lub nauczyciel-twórca). W `maybeShowTrialWelcomeBanner` i `maybeShowPremiumExpiryBanner` early-return na `DB.getHidePremiumBanners()`. `_rowToProfile` mapuje pole na `hidePremiumBanners`. `loadAllProfiles` i `findProfileByUsername` dociągają kolumnę.
33. `add-teacher-books.sql` — **wlasne podreczniki nauczyciela** w tabelach `admin_books` / `admin_units` / `admin_words`. Kolumna `created_by` juz istnieje w schemacie (db.js zawsze ja wypelnia) — migracja zmienia tylko polityki RLS. Po migracji nauczyciel moze tworzyc/edytowac/usuwac wlasne podreczniki (gdzie `created_by = auth.uid()`), ich unity i slowa. Wlasne podreczniki nauczyciela sa **prywatne** — inni nauczyciele ich NIE widza. Uczen widzi je tylko po wprost przydzieleniu przez `user_books` (panel „🔓 Dostep" na karcie podrecznika lub w klasie). Tier: Free. Polityka SELECT na `admin_books` laczy 4 warunki: `_is_admin()` (admin widzi wszystko) OR `created_by = auth.uid()` (tworca) OR `EXISTS (profiles WHERE id=created_by AND is_admin=true)` (publiczne podreczniki admina) OR `EXISTS (user_books WHERE book_id=admin_books.book_id AND user_id=auth.uid())` (przydzielone). `admin_units` i `admin_words` dziedzicza widocznosc po podreczniku-rodzicu (EXISTS subquery). Polityka INSERT/UPDATE/DELETE: admin lub `created_by = auth.uid()` (lub na rodzicu dla unitow/slow). UI: kafelek „➕ Nowy podręcznik" pokazuje sie nauczycielowi (wczesniej tylko admin), kafelek „➕ Nowy rozdział" i ikona ✏️ na karcie podrecznika tylko dla wlasciciela (helper `canEditBook(book)` w app.html: `admin || (teacher && book.createdBy === DB.getUserId() && book._isAdminBook)`). `db.js`: `_applyAdminData` dodaje `createdBy` do BOOKS object, `adminAddBook` ustawia `createdBy = _userId` w lokalnym BOOKS, `adminEditBook` / `adminDeleteBook` wymagaja teraz admina LUB nauczyciela-wlasciciela (sprawdzaja `existing.created_by === _userId`). `adminAddUnit` / `adminAddWord` / `adminEditWord` / `adminDeleteWord` nie maja JS-level role check — RLS pilnuje na poziomie DB.
34. `extend-trial-to-30-days.sql` — **trial Premium wydluzony z 7 do 30 dni**. Aktualizuje RPC `activate_trial()` — `INTERVAL '7 days'` → `INTERVAL '30 days'`. Zachowuje istniejaca logike admin-no-trial (admin nie dostaje triala). Istniejacy uzytkownicy ktorzy juz uzyli triala — bez zmian (admin moze przedluzyc per-user przez `admin_extend_premium`). Idempotentna. Po migracji aktualizacja tekstow w `app.html` (banner „🎁 Masz 30 dni Premium"), `db.js` (komentarze), `regulamin.html` (§5, §10), `polityka.html` (CTA), `home.html` (hero, FAQ, CTA, meta-tags), `faq.html` (FAQ), `consent.js` (consent text), `CLAUDE.md`.
35. `add-user-private-note.sql` — **prywatna etykieta w user_labels** (`private_note TEXT NULL`). Modal `#userLabelModal` ma teraz dwa pola: 🏷️ **Grupa** (istniejąca kolumna `label` — używana do grupowania nauczycieli w widoku „Konta nauczycieli") + ✏️ **Prywatna etykieta** (nowa kolumna `private_note` — wyświetlana inline obok loginu). Oba pola są prywatne dla autora (RLS bez zmian — z migracji #26). `db.js`: `_myPrivateNotes` cache, `setUserLabel(targetId, label, privateNote)` przyjmuje opcjonalny 3. argument (wsteczna kompatybilność: stare wywołania z 1 argumentem działają), `getUserPrivateNote(targetId)`, `deleteUserLabel` kasuje obie kolumny. Init dociąga obie kolumny z fallbackiem dla bazy bez migracji #35. `fmtNameWithLabel` priorytetowo pokazuje `private_note`, fallback na `label`. UI: w widoku Konta nauczycieli grupowanie po `label` + inline badge ✏️ z `private_note`. Idempotentna.
36. `admin-grant-trial.sql` — **admin nadaje N dni Premium** dowolnemu użytkownikowi (np. nauczycielowi/opiekunowi po wygaśnięciu pierwotnego 30-dniowego trialu). Nowe RPC `admin_grant_trial(p_user_id UUID, p_days INTEGER DEFAULT 30)` (`SECURITY DEFINER`) — admin-only, ustawia `plan='premium'`, `plan_expires_at = (max(now, current_expires) + days)` (przedłuża aktywny plan lub aktywuje od dziś), `trial_used_at = NOW()` (semantycznie nowy trial). API: `DB.adminGrantTrial(userId, days=30)`. UI: w modalu `#userSettingsModal` (otwierany przez ⚙️ przy uczniu/nauczycielu/opiekunie) admin widzi sekcję „🎁 Trial Premium" z aktualnym stanem planu (data wygaśnięcia, ile dni zostało) i przyciskiem „🎁 Aktywuj 30 dni Premium". Kliknięcie → confirm → RPC → toast + odświeżenie cache `_allProfiles`. Sekcja wyłączona dla admina-targetu (sam siebie nie potrzebuje). `loadAllProfiles` rozszerzony o `plan_expires_at, trial_used_at, is_parent` żeby UI mógł poprawnie wyświetlić stan. Idempotentna (CREATE OR REPLACE).
37. `backfill-7day-trials-to-30.sql` — **jednorazowy backfill istniejących 7-dniowych triali do 30 dni**. Konta które aktywowały trial pod starą regułą (przed migracją #34) miały `plan_expires_at = trial_used_at + 7 dni`. Banner pokazywał „za 7 dni" mimo że tekst statyczny mówi „30 dni Premium". Migracja przedłuża aktywne triale (gdzie `plan='premium'` AND `trial_used_at IS NOT NULL` AND `plan_expires_at > NOW()` AND `(plan_expires_at - trial_used_at) <= 8 days` AND `is_admin = false`) do `trial_used_at + 30 days`. Idempotentna — po pierwszym przebiegu warunek przestaje pasować, więc kolejne uruchomienia nic nie zmienią. Konta z manualnym przedłużeniem przez admina (np. 1 miesiąc lub admin_grant_trial 30 dni) nie są modyfikowane (różnica > 8 dni). Po migracji baner „🎁 Masz 30 dni Premium za darmo — kończy się DATA (za N dni)" pokaże poprawnie 30 dni.
38. `admin-link-parent-to-student.sql` — **RPC `admin_link_parent_to_student(parent_id, student_id)`** (`SECURITY DEFINER`). Pozwala adminowi/nauczycielowi (sprawdzane przez `_is_admin()` / `_is_teacher()` z migracji #20) zlinkować już istniejące konto opiekuna z kontem ucznia: ustawia `profiles.is_parent = TRUE` na koncie opiekuna + INSERT do `parent_children`. Idempotentna (ON CONFLICT DO NOTHING). Używana przez `bulkCreateStudentsForClass(withParents=true)` w db.js — checkbox „👨‍👩‍👧 Stwórz także konta dla rodziców/opiekunów" w sBulkStudents. Dla każdego ucznia generowany jest powiązany opiekun z loginem `{login_ucznia}_opiekun` (i fallback `_opiekun2` gdy zajęty). PDF wydruku w trybie z opiekunami daje 1 blok per uczeń z 2 kartami (uczeń + opiekun), wycinane wzdłuż przerywanej linii. API: `DB.adminLinkParentToStudent(parentId, studentId)`, `DB.bulkCreateStudentsForClass(classId, className, count, withParents)`.
39. `book-notes-add-visibility.sql` — **dwie kategorie notatek admina per (book_id, unit_key)**: kolumna `visibility TEXT NOT NULL DEFAULT 'public'` w `book_notes` + CHECK constraint `IN ('public','private')` + zamiana `UNIQUE(book_id, unit_key)` na `UNIQUE(book_id, unit_key, visibility)` (możliwa równolegle publiczna + prywatna notatka per miejsce). Backfill: wszystkie istniejące notatki dostają `'public'` — uczeń od razu zobaczy treści, które były dotąd ukryte za Premium-gate w UI. **RLS bez zmian** (SELECT każdy, INSERT/UPDATE/DELETE tylko admin — filtr widoczności po stronie klienta). `db.js`: `loadBookNote(bookId, unitKey, visibility='public')`, nowy `loadBookNotesBoth(bookId, unitKey)` zwraca `{public, private}`, `saveBookNote(..., visibility)`, `deleteBookNote(..., visibility)` — wszystkie z graceful fallbackiem dla bazy bez migracji #39 (stary schemat traktuje istniejące notatki jako `'public'`). UI w `app.html`: kontener `#bookNoteUnits`/`#bookNoteUnit` przemianowany na `.admin-note-wrap`, renderuje 1-2 inner `.admin-note` divy — publiczna w fioletowym stylu (wszyscy), prywatna w pomarańczowym (admin + nauczyciel/opiekun Premium) z badge `🔒 prywatna`. Modal `#bookNoteModal` ma `#bookNoteModalHelper` z dynamiczną treścią + tytuł z ikoną (📢/🔒) + label. Każda notatka edytowalna z osobnego przycisku „✏️ Edytuj" / „➕ Dodaj".

**Zawsze przypominaj użytkownikowi** o uruchomieniu nowej migracji w Supabase, kiedy tworzysz nową.

## 🎭 Role i uprawnienia

**Rola** (`is_admin` / `is_teacher` / `is_parent`) × **Plan** (`free` / `premium` + `plan_expires_at`). Admin automatycznie traktowany jak Premium (pełny dostęp). Trial Premium 30 dni nadawany automatycznie nowemu kontu przy pierwszym logowaniu (migracja #34 — wcześniej było 7 dni).

| Rola | Co widzi | Co może robić |
|---|---|---|
| **Gość** (`isGuest`) | tylko `defaultAccess: true`; **brak motywów, brak gier INNE** (🔒) | uczyć się podstawami; nic nie jest zapisywane |
| **Uczeń** (Free) | defaultAccess + user_books; gry INNE zablokowane (🔒 Premium) | uczyć się, prosić o dostęp, pisać do admina, usunąć konto |
| **Uczeń-Premium** | jw. + gry INNE odblokowane | pełny dostęp |
| **Nauczyciel** (`is_teacher`) | defaultAccess + user_books + panel | zarządzać klasami, tworzyć konta uczniów, resetować hasła, teacher_sets; **widzi tylko uczniów z `created_by = self`**; **prywatne notatki admina** (🔒) — tylko z Premium; **publiczne notatki admina** (📢) widoczne dla każdego; limity Free: **max 8 klas · 30 uczniów/klasa · 10 teacher_sets** |
| **Rodzic/Opiekun** (`is_parent`) | defaultAccess + gry INNE + panel opiekuna | dodawać dzieci po loginie (`find_user_by_username`); widzieć postępy dzieci; **Premium**: przydzielać podręczniki dzieciom, widzieć prywatne notatki admina, 10 teacher_sets (Free: 10, Premium: ∞) |
| **Admin** (`is_admin`) | wszystko (także `adminOnly`) | rozpatrywać prośby, zarządzać wszystkimi zestawami, zmieniać plany, moderować błędy, odpowiadać na wiadomości |

**Panel admina/nauczyciela** — od SW v59 zredukowany do **2 dużych kafelków** w `sBooks`: „👩‍🏫 Panel nauczyciela" (link do `teacher.html`) + „🔤 Słówka" (admin only, link do `words.html`). Pełny zestaw funkcji (Klasy · Dostęp · Zestawy · Prośby (admin) · Podręczniki nauczycieli (admin) · 🐛 Zgłoszone błędy (admin) · 💬 Wiadomości (admin) · 🔔 Nieaktywni · Raporty · Karty pracy · ⭐ Premium) jest dostępny w `teacher.html` i wraca do `app.html?go=xxx`.

**Panel opiekuna** (`sParentPanel`): Moje dzieci · 💬 Wiadomości · 🔔 Nieaktywni · 📊 Raporty (Premium) · ⭐ Premium.

## 🎨 Motywy

5 motywów: `owl` (domyślny), `forest`, `night`, `sunset`, `paper` (jasny). `localStorage['fiszki_theme']`. Gość — brak wyboru (kłódka).

## 🎮 Tryby nauki / gry z listy unitów

W `sWordList` każdy unit ma rzędy gier (wszystkie z opcją **🌍 Wszystkie** = cały podręcznik):
Krzyżówka · Wordsearch · Memory · Snake (Wąż wyrazowy) · Hangman · Rozsypanka literowa · Rozsypanka zdaniowa · Gra planszowa · Dobble · Speaking Cubes · Sentence Builder · Spell Card · Image Card · Rywalizacja.

**Konwencja per gra z panelem selekcji słów** (Krzyżówka, Wordsearch, Snake, Dobble, Board, Speaking Cubes):
- **Auto-select tylko pojedynczych słów** (`!/\s/.test(en.trim()) && !/\s/.test(pl.trim())`)
- Wyrażenia wieloczłonowe są klikalne (klasa `eligible`), ale niezaznaczone
- **Selektor liczby słów** (gdzie zaimplementowany): Auto/10/20/30/40
- **Duplikat akcji** pod panelem selekcji (Nowa/Drukuj/PDF/JPEG/Wróć)
- Query selektora chipsów **zawsze scope'owany** do swojego `#xxxWordChips` (nie document-wide) — inaczej łapią się chipsy z innych paneli (bug fix w krzyżówce).

**Rywalizacja** (`sDuel`) — całkowicie przepisana, 2-4 graczy, 5 trybów gry (Klasyczny, Race to 50/100/200, Eliminacja, Drużynowy 2v2). Klasyczny ma limit 2 min. Setup modal z wyborem graczy/awatarów/koloru/trybu/źródła słów. 20 awatarów + 8 kolorów. Power-upy (⚡/🛡️/👁️/🔄) losowane co 3 rundy. FIRE STREAK (3+) = +50%. Podium + statystyki końcowe.

## 📝 Konwencje

### Commity (WAŻNE)
- **Po polsku** w treści, ale **bez polskich znaków w tytule pierwszej linijki** — HEREDOC w bashu nie escape'uje `\u0119`. Używaj `ś → s`, `ż → z` itd. w tytule. W treści commit-message polskie znaki działają OK.
- Co-author: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- Używaj HEREDOC: `git commit -F - <<'COMMITMSG'\n...\nCOMMITMSG`
- **Nigdy nie używaj `--amend`** ani `git push --force` bez wyraźnej zgody.

### Deploy — bump Service Worker
- **Po każdej zauważalnej zmianie** w `app.html`, `data.js`, `db.js`, `index.html` zbumpuj `CACHE_NAME` w `sw.js`. Format: `vMAJOR.MINOR` z zerem wiodącym, np. `v1.00` → `v1.01` → `v1.02` … `v1.99` → `v2.00`. (Wcześniej była luźna numeracja `v50`–`v233` — zresetowane do `v1.00` od maja 2026 dla porządku.)
- Bez bumpa: przeglądarka nie wykryje nowej wersji → baner nie pojawi się u użytkowników.
- Mechanizm: user dostaje baner „Nowa wersja dostępna. Kliknij OK, aby odświeżyć." → klik → `postMessage SKIP_WAITING` → `controllerchange` → `location.reload()`.

### Dodawanie nowej gry do INNE
1. Stwórz plik `.html` w głównym folderze.
2. Dodaj CSS `.back-link` + `@media print { .back-link, .htp-btn, .htp-modal { display: none !important; } }`.
3. **Dwa linki powrotu** (góra + dół):
   - Góra: `<a href="app.html" class="back-link">← Powrót do Sowie Fiszki</a>`
   - Dół: `<div style="text-align:center;margin:20px 0 10px"><a href="app.html" class="back-link">← Wróć do Sowie Fiszki</a></div>`
4. Dodaj modal „ℹ️ Jak grać?" (klasy `.htp-btn`, `.htp-modal`, `.htp-box`) z instrukcją krok-po-kroku.
5. W `app.html` znajdź ekran `id="sApps"` i dodaj kafelek (`<a href="nazwa.html" class="book-card">`).
6. Bump `CACHE_NAME` (jeśli edytowany app.html), commit + push.

### Edit istniejących plików
- `app.html` jest GIGANTYCZNY — używaj `Grep` zamiast Read na całość. Szukaj po unikalnych fragmentach.
- **Nie dziel** `app.html` na moduły — konwencja projektu: jeden duży plik.
- `escHtml` jest globalny (linia ~5532) — używać w kodzie głównego scriptu dla bezpiecznego HTML; `esc` to krótsza wersja bez escape `"`.

### Stopka w druku/PDF/generowanych plikach
- Główna stopka: dwa spany — `.site-footer-full` (widoczna na stronie) i `.site-footer-print` (widoczna tylko `@media print` = „© 2026 Sowie Fiszki")
- W custom generatorach (karta pracy, raport postępów, bulk credentials) — stopka „© 2026 Sowie Fiszki" (bez Daniel Ostrowski / Regulamin / Polityka)

## 🐛 Znane problemy / pułapki

- **Service Worker cache** — od v8 strategia network-first dla HTML/JS/JSON + cache-first dla fontów/CDN + bypass dla Supabase REST API. Nowy SW NIE robi `skipWaiting()` — czeka na baner. Po każdym deploy'u bumpuj `CACHE_NAME`.
- **RLS rekurencja** — nowe polityki odwołujące się do `profiles` z innej tabeli MUSZĄ używać helperów `_is_admin()`, `_is_teacher()`, `_is_parent_of(uuid)` z `SECURITY DEFINER` (patrz migracja #20). Bez tego PostgreSQL zwraca 500.
- **CRLF/LF warnings przy commicie na Windows** — normalne, ignoruj.
- **RLS zwraca pustą listę** — brak polityki. Zawsze dodawaj `.select()` po UPDATE żeby wykryć ciche blokady.
- **Polskie znaki w tytule commita** — HEREDOC ich nie escape'uje. Używaj ASCII w tytule.
- **`escHtml` vs `esc`** — IIFE ma własne lokalne `escHtml`. Funkcje w głównym scripcie używają globalnego `escHtml` z linii ~5532.

## ⚖️ Compliance

- **Regulamin** (§1–§15) i **Polityka prywatności** (12 sekcji) są w `app.html` (modal) i `index.html` (modal). Spójna treść w obu.
- **RODO:** obowiązkowa zgoda przy rejestracji, wymóg zgody opiekuna <16 lat, prawo do bycia zapomnianym (funkcja „Usuń konto" w modalu „Moje konto" w nagłówku).
- **Wiek użytkownika:** bez ograniczeń, ale dzieci <16 lat wymagają zgody rodzica (checkbox przy rejestracji).
- **Dane:** login + hasło (bcrypt w Supabase Auth) + postępy nauki. Przy prośbie o dostęp — dobrowolne imię i nazwisko (dla admina).
- **AI** — nie planowane, nie wspominaj w regulaminie ani marketingu.

## 🔧 Typowe zadania

### Poprawa funkcji lub dodanie nowej
1. Przeczytaj tylko relevantne fragmenty (`Grep`, nie cały `app.html`).
2. Jeśli zadanie duże — zaproponuj etapy.
3. Wprowadź zmiany, pokaż co się zmieniło.
4. **Bump `CACHE_NAME`** gdy zmiany w app.html/data.js/db.js/index.html.
5. Commit + push (tylko na wyraźną prośbę użytkownika).
6. Wspomnij o potrzebie uruchomienia migracji SQL, jeśli ją dodałeś.

### Styl odpowiedzi
- Użytkownik preferuje **polski**.
- Konkretne kroki, nie długie elaboraty.
- Przy zmianach w `app.html` (widocznych w preview): informuj że „`app.html` jest widoczny w panelu Launch preview".
- Przy niejasnościach pytaj przez `AskUserQuestion` zamiast zgadywać.

## 📋 Status funkcji (stan na 13 maja 2026, SW v1.23)

✅ Działa:
- Logowanie/rejestracja z Supabase Auth (3 role: Uczeń / Nauczyciel / Rodzic-Opiekun)
- Motywy + przyciski w nagłówku (🎨 motyw, 👤 moje konto) — Gość ma kłódkę na motywach
- Hierarchiczna nawigacja Język → Szkoła → Klasa → Podręcznik → Unit
- Wszystkie tryby nauki (Fiszki, Quiz, Type, Spelling, Dyktando, Mów, 14 gier z listy unitów + virtualny „🌍 Wszystkie")
- Masowe tworzenie kont uczniów + PDF/druk + 4. kolumna „Instrukcja logowania"
- **🆕 Opcjonalne auto-konta opiekunów przy masowym tworzeniu uczniów** (migracja #38, checkbox `bulkWithParents`, login `{login_ucznia}_opiekun` z fallbackiem `_opiekun2`, PDF z 1 blokiem per uczeń + 2 kartami uczeń/opiekun do wycięcia)
- Reset hasła uczniów przez admin/nauczyciela
- Zestawy nauczycielskie (teacher_sets) + admin overview + import CSV/TSV/wklejka (Premium) + **import słówek z istniejących podręczników** (modal `#importBookWordsModal` w `sTeacherSetEdit`: wybór podręcznika → unitu → checkboxy → „Dodaj zaznaczone", używa `DB.teacherAddWordsBulk`)
- Prośby o dostęp do podręczników (admin-only)
- Notatki admina na podręczniku/unicie (book_notes) — **dwie kategorie** (migracja #39): 📢 publiczna (wszyscy widzą, w tym uczeń i gość) + 🔒 prywatna (admin + nauczyciel/opiekun Premium)
- Karty pracy (druk listy słówek + wariant „📝 Zdania z lukami" Premium + logo szkoły Premium)
- Zgłaszanie błędów w słówkach → admin inbox (RLS) + ekran sWordErrors (filtr status, resolve/delete)
- System wiadomości user ↔ admin (`conversations` / `conversation_messages`) + sMessages + modal wątku
- Rola Rodzic/Opiekun: panel, dodaj dziecko po loginie, przydzielanie podręczników (Premium)
- **🆕 Przykładowe zdania PL/EN dla wszystkich podręczników** (~5000 zdań w `word_sentences` po uruchomieniu SQL `fix-sentences-*.sql`). Tiger 1/2/3, Brainy 6/7, Bugs Team 2/3, Be Happy 2, Kids Can 1, English Class A1, Steps Plus 4, Together 4/5/6, Link 7/8, Klasa 1-8, New Password A2+/B1, Impuls 3. Klasa 1-8 + stepsplus5 Unit 7 ma zdania inline w data.js (4-elem format), reszta w DB (z fallbackiem inline po sync).
- **🆕 Disambiguacja nawiasem w word_pl** dla par różnych znaczeń: `miasto (duże)`/`miasto (małe)`, `skakać (krótko)`/`skakać (wysoko)`, `godzina (zegar)`/`godzina (jednostka)`, `przed (miejsce)`/`przed (czas)`, `uroczy (przyjemny)`/`uroczy (słodki)`. Konwencja słownikowa — różne od „luźnych nawiasów" usuniętych w Tiger 1 (commit `5a7f0c0`).
- **Premium features:**
  - 30-dniowy trial automatyczny (raz w życiu konta) + cennik (klik → prośba do admina)
  - **🆕 Promocja Premium za darmo dla wszystkich do 31.08.2026** (override po stronie kodu — `DB.isPromoActive()` zwraca true, `isPremium()` short-circuit, `getPlanExpiryInfo()` zwraca null żeby ukryć trial/expiry banery, `maybeShowPromoBanner` w app.html — gradient pasek na górze)
  - Banner wygasania 30 dni przed końcem (codziennie, dismiss-per-day) + welcome trial banner (raz)
  - Wybór głosu lektora (4 głosy UK/US × tempo) w modalu „Moje konto"
  - Export PDF karty postępów + dyplom PDF A4 landscape
  - Wykres historii XP (Canvas, 7/30/365 dni) — Free tylko 7 dni
  - Powiadomienia nieaktywnych (próg 30 dni — miesiąc) — kafelek „🔔 Nieaktywni" z badge + sInactive z dismiss per-user
  - Export postępów do CSV
  - Branding szkoły (logo + nazwa, base64 w localStorage)
- Auto-delete kont uczniów >1 rok nieaktywnych (admin-only RPC, raz dziennie)
- Limity Free nauczyciela/opiekuna (8 klas / 30 uczniów / 10 teacher_sets)
- Usuwanie konta (RODO)
- 11 gier w sekcji INNE + modal „ℹ️ Jak grać?" w każdej
- **Stopka w druku/PDF**: skrócona do „© 2026 Sowie Fiszki" (bez pełnego copyrightu)

🚧 Zaplanowane / odłożone:
- Widok ucznia dla `teacher_sets` — nauczyciel tworzy, uczeń jeszcze nie widzi
- Płatności Premium — struktura jest, ale integracja (Stripe/PayU) nieaktywna (regulamin §10). Cennik po promocji: **24 zł/mies, 114 zł/6 mies, 180 zł/rok** (ogłoszone na home.html).
- Turniej 4/8 graczy w Rywalizacji (single elimination bracket) — osobny commit
- Heatmapa raportów (mamy tylko CSV export postępów)
- Offline mode (PWA) — kafelek w home.html ukryty, FAQ poprawione. Wraca gdy gotowe.
- Email kontaktowy na własnej domenie (`kontakt@sowiefiszki.com` przez ForwardEmail) — odłożone do lipca 2026 (anti-abuse policy, patrz wyżej)

## 🔧 Skrypty deweloperskie

- **`sync-supabase-to-datajs.js`** (Node.js, korzystam z global.fetch) — synchronizuje cały stan Supabase (admin_books + admin_units + admin_words + word_sentences) do lokalnego data.js. Tryby: safe (`data.js.new`) i `--in-place` (z backupem `.bak`). Po sync data.js zawiera SNAPSHOT — działa offline, w git history, niezależne od dostępności DB. Formaty słówek: `[pl, en]` / `[pl, en, emoji]` / `[pl, en, sentPl, sentEn]` (4-elem inline) / `[pl, en, emoji, sentPl, sentEn]` (5-elem z emoji + zdania). Aplikacja obsługuje wszystkie 4 przez helper `getInlineSentences(w)` + `isLikelySentence(s)` w app.html.

## 📝 Konwencja nazewnictwa gry „karty z symbolami"

Gra dawniej zwana **Dobble** została **przemianowana** na *„Karty do gry"* w UI ze względów prawnych — Dobble to znak towarowy Asmodee/Zygomatic (Spot It! to wersja amerykańska, też trademark). Mechanika (dopasowywanie symboli) nie jest opatentowana, ale **nazwa jest chroniona**. Zmiana w user-visible miejscach (`home.html`, `app.html` ekran sDobble, `aktualnosci.html`). **Wewnętrzne identyfikatory pozostają niezmienione** (CSS `.dobble-card`, JS `openDobble()`, `dobbleGenerate()`, ID `sDobble`, `dobbleTitle` itp. — nie powodują ryzyka prawnego, a rename wymagałby modyfikacji kilkudziesięciu miejsc). Jeśli dodajesz nowe user-visible string z odwołaniem do tej gry, użyj *„Karty do gry"* lub opisowo *„Karty wyrazowe/obrazkowe do dopasowywania"*.

## 🆘 Gdy coś się zepsuje

- `git log --oneline -10` — ostatnie commity.
- `git diff HEAD~1` — co ostatnio się zmieniło.
- `git revert <sha>` — bezpieczne cofnięcie commita.
- Jeśli migracja SQL wywraca bazę — napisz kolejną migrację z `IF NOT EXISTS` / `DROP IF EXISTS` zamiast edytować starą.
- Jeśli po zmianach RLS wywala HTTP 500 — sprawdź czy polityki odwołujące się do `profiles` używają helperów `_is_admin()/_is_parent_of()` (migracja #20).

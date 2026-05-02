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
- **Charakter:** osoba fizyczna prowadząca Platformę; **model freemium** (7-dniowy trial Premium → Free / Premium po opłacie). Wcześniej projekt był non-commercial — od ~2026-04-29 przygotowywany do monetyzacji.
- **Service Worker:** aktualnie `v50` (stan na 23 kwietnia 2026)

## 💰 Koszty i terminy odnowienia

| Pozycja | Koszt | Termin / Status |
|---|---|---|
| **Domena `sowiefiszki.com`** (zarejestrowana przez Vercel) | $11,25 USD ≈ **46 zł** / rok | **Odnowienie: 29 kwietnia 2027** (auto-renew z karty zapisanej w Vercel) |
| **Hosting Vercel** (Free tier — 100 GB transferu/mies.) | 0 zł | Wystarczy do ~kilku tysięcy aktywnych użytkowników. Po przekroczeniu — Vercel Pro ~20 USD/mies. |
| **Supabase** (Free tier — 500 MB DB + 1 GB Storage + 5 GB transfer) | 0 zł | Storage uważnie monitorować przy nagraniach wymowy (`word-audio` bucket). Po przekroczeniu — Supabase Pro ~25 USD/mies. |
| **GitHub** (repo prywatne, Free tier) | 0 zł | Bez limitów dla małego repo |

**Razem stałe koszty: ~46 zł / rok** (~3,80 zł / miesiąc). Wszystko inne na Free tierach do rozsądnego pułapu użycia.

**⚠️ Termin do pamiętania: kwiecień 2027** — sprawdzić stan karty w Vercel ~30 dni przed odnowieniem domeny. W razie problemów z auto-renew, domena może wygasnąć i przejść do bidu po grace period.

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
- `manifest.json` — PWA manifest.

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

**Zawsze przypominaj użytkownikowi** o uruchomieniu nowej migracji w Supabase, kiedy tworzysz nową.

## 🎭 Role i uprawnienia

**Rola** (`is_admin` / `is_teacher` / `is_parent`) × **Plan** (`free` / `premium` + `plan_expires_at`). Admin automatycznie traktowany jak Premium (pełny dostęp). Trial Premium 7 dni nadawany automatycznie nowemu kontu przy pierwszym logowaniu.

| Rola | Co widzi | Co może robić |
|---|---|---|
| **Gość** (`isGuest`) | tylko `defaultAccess: true`; **brak motywów, brak gier INNE** (🔒) | uczyć się podstawami; nic nie jest zapisywane |
| **Uczeń** (Free) | defaultAccess + user_books; gry INNE zablokowane (🔒 Premium) | uczyć się, prosić o dostęp, pisać do admina, usunąć konto |
| **Uczeń-Premium** | jw. + gry INNE odblokowane | pełny dostęp |
| **Nauczyciel** (`is_teacher`) | defaultAccess + user_books + panel | zarządzać klasami, tworzyć konta uczniów, resetować hasła, teacher_sets; **widzi tylko uczniów z `created_by = self`**; **notatki na podręczniku — tylko z Premium**; limity Free: **max 8 klas · 30 uczniów/klasa · 10 teacher_sets** |
| **Rodzic/Opiekun** (`is_parent`) | defaultAccess + gry INNE + panel opiekuna | dodawać dzieci po loginie (`find_user_by_username`); widzieć postępy dzieci; **Premium**: przydzielać podręczniki dzieciom, widzieć notatki, 10 teacher_sets (Free: 10, Premium: ∞) |
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
- **Po każdej zauważalnej zmianie** w `app.html`, `data.js`, `db.js`, `index.html` zbumpuj `CACHE_NAME` w `sw.js` (np. `v50` → `v51`).
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

## 📋 Status funkcji (stan na 23 kwietnia 2026, SW v50)

✅ Działa:
- Logowanie/rejestracja z Supabase Auth (3 role: Uczeń / Nauczyciel / Rodzic-Opiekun)
- Motywy + przyciski w nagłówku (🎨 motyw, 👤 moje konto) — Gość ma kłódkę na motywach
- Hierarchiczna nawigacja Język → Szkoła → Klasa → Podręcznik → Unit
- Wszystkie tryby nauki (Fiszki, Quiz, Type, Spelling, Dyktando, Mów, 14 gier z listy unitów + virtualny „🌍 Wszystkie")
- Masowe tworzenie kont uczniów + PDF/druk + 4. kolumna „Instrukcja logowania"
- Reset hasła uczniów przez admin/nauczyciela
- Zestawy nauczycielskie (teacher_sets) + admin overview + import CSV/TSV/wklejka (Premium) + **import słówek z istniejących podręczników** (modal `#importBookWordsModal` w `sTeacherSetEdit`: wybór podręcznika → unitu → checkboxy → „Dodaj zaznaczone", używa `DB.teacherAddWordsBulk`)
- Prośby o dostęp do podręczników (admin-only)
- Notatki admina na podręczniku/unicie (book_notes) — Nauczyciel/Opiekun z Premium też widzą
- Karty pracy (druk listy słówek + wariant „📝 Zdania z lukami" Premium + logo szkoły Premium)
- Zgłaszanie błędów w słówkach → admin inbox (RLS) + ekran sWordErrors (filtr status, resolve/delete)
- System wiadomości user ↔ admin (`conversations` / `conversation_messages`) + sMessages + modal wątku
- Rola Rodzic/Opiekun: panel, dodaj dziecko po loginie, przydzielanie podręczników (Premium)
- **Premium features:**
  - 7-dniowy trial automatyczny (raz w życiu konta) + cennik (klik → prośba do admina)
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
- Płatności Premium — struktura jest, ale integracja (Stripe/PayU) nieaktywna (regulamin §10)
- Turniej 4/8 graczy w Rywalizacji (single elimination bracket) — osobny commit
- Heatmapa raportów (mamy tylko CSV export postępów)

## 🆘 Gdy coś się zepsuje

- `git log --oneline -10` — ostatnie commity.
- `git diff HEAD~1` — co ostatnio się zmieniło.
- `git revert <sha>` — bezpieczne cofnięcie commita.
- Jeśli migracja SQL wywraca bazę — napisz kolejną migrację z `IF NOT EXISTS` / `DROP IF EXISTS` zamiast edytować starą.
- Jeśli po zmianach RLS wywala HTTP 500 — sprawdź czy polityki odwołujące się do `profiles` używają helperów `_is_admin()/_is_parent_of()` (migracja #20).

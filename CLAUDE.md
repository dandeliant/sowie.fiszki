# Sowie Fiszki — przewodnik dla Claude

> Ten plik jest automatycznie czytany na starcie każdej nowej sesji Claude Code.
> Zawiera najważniejsze informacje o projekcie — architekturę, konwencje, stan funkcji.

## 🦉 Projekt

**Sowie Fiszki** — PWA do nauki angielskiego (fiszki, gry, generatory mowy).
- **Właściciel / administrator:** Daniel Ostrowski
- **E-mail kontaktowy:** `sowie.fiszki@gmail.com`
- **Repo:** https://github.com/dandeliant/sowie.fiszki (branch `main`)
- **Hosting:** GitHub Pages → https://dandeliant.github.io/sowie.fiszki/
- **Backend:** Supabase (auth + Postgres + RLS), projekt `kofenaaeleyhwhbkytcz`
- **Charakter:** projekt niekomercyjny (osoba fizyczna)

## 📂 Architektura

### Pliki główne
- `index.html` (~520 linii) — ekran logowania/rejestracji. Import regulaminu + polityki prywatności, checkboxy zgody.
- `app.html` (~12 700 linii) — główna aplikacja SPA. Wszystkie ekrany (`sLang`, `sSchool`, `sClass`, `sBooks`, `sUnits`, `sWordList`, `sStudy`, `sAdminAccess`, `sAdminClasses`, `sClassDetail`, `sStudentProgress`, `sTeacherSets`, `sAdminTeacherSets`, `sAccessRequests`, `sBulkStudents`, `sApps`, `sDone`, …). Logika w IIFE + globalnych funkcjach. Nie dziel na moduły — jeden plik pozostaje konwencją.
- `data.js` — obiekt `BOOKS` z 17 podręcznikami (klasa1–8, brainy6/7, tiger1/2/3, together4/5/6, bugsteam2/3, stepsplus4, stepsplus5, englishA1, beHappy2, newpassword, czasowniki, francais). Każda ksiazka ma: `id`, `language`, `schoolType`, `grade`, `defaultAccess`/`adminOnly`, `units: { unitN: { name, icon, color, words: [[pl, en, zdaniePl, zdanieEn], …] } }`.
- `db.js` — warstwa Supabase (sesja, auth, profile, postępy, klasy, user_books, RLS helpers). Funkcje eksportowane przez globalny obiekt `DB`.
- `supabase-config.js` — URL + anon key.
- `sw.js` — Service Worker (cache PWA).
- `manifest.json` — PWA manifest.

### Pliki gier w sekcji INNE (samodzielne HTML)
- `how-many.html` — „Ile? — How many?" (nauka mówienia o ilości)
- `birthday.html` — „Urodziny" (liczebniki + miesiące, SVG awatary)
- `generator-cyfr.html` — „Generator cyfr" (losowa liczba + brytyjski TTS)
- `speaking_cards_together5.html` — Together 5 Present Simple (czynności + zegar + przysłówki)
- `speaking_cards_animals.html` — Animals & Food (likes/doesn't like/eats)
- `whats_the_matter.html` — Tiger & Friends 2 Unit 5 (choroby, porady)
- `shops_speaking_generator.html` — Bugs Team 3 Unit 5 (I'm looking for / There is-are)

Każdy z nich ma link powrotny `<a href="app.html" class="back-link">← Powrót do Sowie Fiszki</a>` u góry oraz `@media print { .back-link { display: none !important; } }` w CSS.

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
16. `fix-admin-create-user.sql` — naprawa `admin_create_user` (puste stringi zamiast NULL dla kolumn tokenów — bez tego gotrue odrzucał `signInWithPassword`); dodatkowo zezwala nauczycielowi tworzyć konta uczniów
17. `add-parent-role.sql` — rola Rodzic/Opiekun (`profiles.is_parent`) + tabela `parent_children` + RPC `find_user_by_username`, `parent_assign_book_to_child`, `parent_unassign_book_from_child`
18. `admin-messages-schema.sql` — konwersacje user ↔ admin (`conversations`, `conversation_messages`) + RPC `count_open_conversations`
19. `add-premium-expiry.sql` — `profiles.plan_expires_at` + `trial_used_at` + RPC `activate_trial()` (7-dniowy trial) + RPC `admin_extend_premium(user_id, months)`
20. `fix-rls-recursion.sql` — **KRYTYCZNE**: naprawia infinite recursion w politykach RLS (profiles ↔ parent_children ↔ profiles). Tworzy helpery `_is_admin()`, `_is_teacher()`, `_is_parent_of(uuid)` z `SECURITY DEFINER` (omijają RLS) i przebudowuje polityki. Bez tego: HTTP 500 przy każdym SELECT profiles → „Nieprawidłowa nazwa użytkownika lub hasło" przy logowaniu.
20. `add-daily-xp-history.sql` — tabela `daily_xp_log (user_id, day, xp)` z RLS (user/parent/teacher/admin) + RPC `log_daily_xp(delta)` (upsert). Używane do wykresu „Historia nauki 12 miesięcy" (Premium).
16. `fix-admin-create-user.sql` — naprawa `admin_create_user` (puste stringi zamiast NULL dla kolumn tokenów — bez tego gotrue odrzucał `signInWithPassword`); dodatkowo zezwala nauczycielowi tworzyć konta uczniów

**Zawsze przypominaj użytkownikowi** o uruchomieniu nowej migracji w Supabase, kiedy tworzysz nową.

## 🎭 Role i uprawnienia

| Rola | Co widzi | Co może robić |
|---|---|---|
| **Gość** (`isGuest`) | tylko `defaultAccess: true` (klasa1–8); **brak motywów, brak gier INNE** (🔒) | uczyć się podstawami; nic nie jest zapisywane |
| **Uczeń** (Free) | defaultAccess + user_books; gry INNE zablokowane (🔒 Premium) | uczyć się, prosić o dostęp, pisać do admina, usunąć konto |
| — | Limity Free (Nauczyciel/Opiekun — admin i Premium bez limitów) | max 8 klas · max 30 uczniów/klasa · max 10 teacher_sets |
| **Uczeń-Premium** | jw. + gry INNE odblokowane | pełny dostęp do gier i funkcji rozszerzonych |
| **Nauczyciel** (`is_teacher`) | defaultAccess + user_books + panel nauczyciela + gry INNE | zarządzać klasami, tworzyć konta uczniów, resetować hasła, teacher_sets; **widzi tylko uczniów utworzonych przez siebie** (filtr `created_by`); **notatki na podręczniku/unicie — tylko z planem Premium** |
| **Rodzic / Opiekun** (`is_parent`) | defaultAccess + gry INNE + panel opiekuna | dodawać dzieci po loginie (sprawdza `find_user_by_username`); widzieć postępy dzieci; **Premium**: przydzielać podręczniki dzieciom (`parent_assign_book_to_child`), widzieć notatki |
| **Admin** (`is_admin`) | wszystko (także `adminOnly`, notatki bez ograniczeń) | rozpatrywać prośby o dostęp, zarządzać wszystkimi zestawami nauczycieli, zmieniać plany, moderować zgłoszone błędy, odpowiadać na wiadomości w inboxie |

**Panel nauczyciela** pokazuje się po zalogowaniu (admin + nauczyciel). Kafelki:
- Klasy · Dostęp · Zestawy · Prośby (admin-only) · Podręczniki nauczycieli (admin-only) · Raporty · Karty pracy

## 🎨 Motywy

System oparty o atrybut `data-theme` na `<html>`. Motywy: `owl` (domyślny), `forest`, `night`, `sunset`, `paper` (jasny). Przechowywane w `localStorage['fiszki_theme']`. Zmiana przez modal dostępny z ikony 🎨 w nagłówku.

## 📝 Konwencje

### Commity (WAŻNE)
- **Po polsku** w treści, ale **bez polskich znaków w tytule pierwszej linijki** — HEREDOC w bashu nie escape'uje `\u0119` itp., więc polskie znaki w tytule się rozjeżdżają. Używaj `ś → s`, `ż → z` itd. w tytule. W treści commit-message polskie znaki działają OK.
- Co-author: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Używaj HEREDOC-a: `git commit -F - <<'COMMITMSG'\n...\nCOMMITMSG`
- **Nigdy nie używaj `--amend`** ani `git push --force` bez wyraźnej zgody użytkownika.

### Dodawanie nowej gry do INNE
1. Stwórz plik `.html` w głównym folderze (np. `cp` z Downloads).
2. Dodaj CSS `.back-link` (dopasuj do stylu gry) + `@media print { .back-link { display: none !important; } }`.
3. **Dwa linki powrotu** (konwencja): u GÓRY `<body>` i u DOŁU tuż przed `</body>`:
   - Góra: `<a href="app.html" class="back-link">← Powrót do Sowie Fiszki</a>`
   - Dół: `<div style="text-align:center;margin:20px 0 10px"><a href="app.html" class="back-link">← Wróć do Sowie Fiszki</a></div>`
   - CSS `.back-link` stylizuje oba (wspólna klasa), `@media print` ukrywa oba przy druku.
4. W `app.html` znajdź ekran `id="sApps"` (`<div class="screen" id="sApps">`) i dodaj kafelek:
   ```html
   <a href="nazwa.html" class="book-card" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;align-items:center;gap:9px">
     <div class="book-icon">🎮</div>
     <div class="book-name">Nazwa</div>
     <div class="book-desc">Opis</div>
   </a>
   ```
5. Commit + push.

### Dodawanie słówek do podręcznika
- Format 4-elementowy: `['polskie', 'english', 'zdanie PL.', 'sentence EN.']`
- Zdania przykładowe w indeksie `[2]` i `[3]` wyświetlają się automatycznie w trybie Fiszki (funkcja `showCardSentence`).
- Najprostsze: dodać nowy `unitN` do `units: {}` wewnątrz istniejącego podręcznika w `data.js`.

### Edit istniejących plików
- `app.html` jest GIGANTYCZNY — używaj `Grep` zamiast Read na całość. Szukaj po unikalnych fragmentach.
- **Nie dziel** `app.html` na moduły — konwencja projektu: jeden duży plik.

### Deploy — bump Service Worker
- **Po każdej zauważalnej zmianie** w `app.html`, `data.js`, `db.js` lub `index.html` zbumpuj `CACHE_NAME` w `sw.js` (np. `v8` → `v9`).
- Bez bumpa: przeglądarka nie wykryje nowej wersji SW → baner nie pojawi się u użytkowników.
- Sam przebieg: user dostaje baner „Nowa wersja dostępna. Kliknij OK, aby odświeżyć." → klik → `postMessage SKIP_WAITING` → `controllerchange` → `location.reload()`.

## 🐛 Znane problemy / pułapki

- **Service Worker cache** — od v8 (kwiecień 2026) strategia jest network-first dla HTML/JS/JSON + cache-first dla fontów/CDN. Nowy SW NIE robi już `skipWaiting()` — czeka na zgodę klienta. Użytkownik dostaje baner „🔄 Nowa wersja dostępna. Kliknij OK, aby odświeżyć." (kod banera w `app.html` i `index.html` przy rejestracji SW). **Po każdym deploy'u bumpuj `CACHE_NAME` w `sw.js`** (v8 → v9 → v10…) — to trigger dla przeglądarki, żeby pobrała nowego SW i pokazała baner. Offline fallback nadal działa z cache.
- **CRLF/LF warnings przy commicie na Windows** — są normalne, ignoruj.
- **RLS zwraca pustą listę** — prawdopodobnie brak odpowiedniej polityki. Zawsze dodawaj `.select()` po UPDATE żeby wykryć ciche blokady.
- **Email w `.claude/`** — katalog jest w `.gitignore`, ale upewnij się że nie committuje się `settings.local.json`.
- **Polskie znaki w tytule commita** — HEREDOC ich nie escape'uje. Używaj podstawowych liter w tytule (patrz: Commity).

## ⚖️ Compliance

- **Regulamin** (§1–§15) i **Polityka prywatności** (12 sekcji) są w `app.html` (modal) i `index.html` (modal). Spójna treść w obu.
- **RODO:** obowiązkowa zgoda przy rejestracji, wymóg zgody opiekuna <16 lat, prawo do bycia zapomnianym (funkcja „Usuń konto" w modalu „Moje konto" w nagłówku).
- **Wiek użytkownika:** bez ograniczeń, ale dzieci <16 lat wymagają zgody rodzica (checkbox przy rejestracji).
- **Dane:** login + hasło (bcrypt w Supabase Auth) + postępy nauki. Przy prośbie o dostęp — dobrowolne imię i nazwisko (dla admina).

## 🔧 Typowe zadania

### Poprawa funkcji lub dodanie nowej
1. Przeczytaj tylko relevantne fragmenty (`Grep`, nie cały `app.html`).
2. Jeśli zadanie duże — zaproponuj etapy przez `AskUserQuestion`.
3. Wprowadź zmiany, pokaż co się zmieniło.
4. Commit + push (tylko na wyraźną prośbę użytkownika).
5. Wspomnij o potrzebie uruchomienia migracji SQL, jeśli ją dodałeś.

### Styl odpowiedzi
- Użytkownik preferuje **polski**.
- Konkretne kroki, nie długie elaboraty.
- Przy zmianach w `app.html` (w preview): informuj że „`app.html` jest widoczny w panelu Launch preview" — użytkownik wtedy sam widzi.
- Przy niejasnościach pytaj przez `AskUserQuestion` zamiast zgadywać.

## 📋 Status funkcji (stan na kwiecień 2026)

✅ Działa:
- Logowanie/rejestracja z Supabase Auth
- Motywy + przyciski w nagłówku (🎨 motyw, 👤 moje konto)
- Hierarchiczna nawigacja Język → Szkoła → Klasa → Podręcznik → Unit
- Tryby nauki (Fiszki, Quiz, Type, Spelling, Gry planszowe, Snake, Memory, Hangman, Dobble, Duel, …)
- Masowe tworzenie kont uczniów + PDF/druk
- Reset hasła uczniów przez admin/nauczyciela
- Zestawy nauczycielskie (teacher_sets) + admin overview
- Prośby o dostęp do podręczników (admin-only)
- Notatki admina na ekranach podręcznika/unitu (book_notes)
- Karty pracy (druk listy słówek)
- Zgłaszanie błędów i naruszeń (mailto)
- Premium: 7-dniowy trial automatyczny + cennik (klik → prośba do admina) + codzienny banner wygasania (30 dni) + welcome banner trialu (raz)
- Premium: wybór głosu lektora (4 opcje UK/US + tempo) w modalu „Moje konto" — Free = UK Female Google
- Premium: export PDF karty postępów (na ekranie 📊 Moje wyniki)
- Premium: drukowalny dyplom PDF A4 landscape (ozdobny certyfikat)
- Premium: wykres historii XP (Canvas) na ekranie statystyk — 7/30/365 dni; Free tylko 7 dni
- Premium: powiadomienia na panelu nauczyciela/opiekuna o uczniach/dzieciach nieaktywnych ≥5 dni, z przyciskiem "📧 Przypomnij"
- Premium: masowy import słówek (CSV/TSV/wklejka) do zestawu nauczyciela — modal z parserem i podglądem (na ekranie edycji zestawu)
- Premium: wariant „📝 Zdania z lukami" w Kartach pracy — generator luk na bazie zdań przykładowych word[2]/word[3]
- Premium: export postępów do CSV (na ekranie 📊 Moje wyniki)
- Premium: branding w Moje konto — logo szkoły (URL lub upload <400 KB, base64 w localStorage) + nazwa — pojawia się w nagłówku PDF kart pracy i listy kont uczniów
- Usuwanie konta (RODO)
- 7 gier w sekcji INNE

🚧 Zaplanowane / odłożone:
- Import zestawów słówek przez nauczyciela (wklejka + CSV) — istnieje infrastruktura `teacher_words`, brak UI do importu
- Widok ucznia dla `teacher_sets` — nauczyciel tworzy, uczeń jeszcze nie widzi
- Plan Premium — struktura jest, ale płatności nieaktywne (regulamin §10)

## 🆘 Gdy coś się zepsuje

- Zobacz `git log --oneline -10` — ostatnie commity.
- `git diff HEAD~1` — co ostatnio się zmieniło.
- `git revert <sha>` — bezpieczne cofnięcie commita (nie psuje historii).
- Jeśli migracja SQL wywraca bazę — napisz kolejną migrację z `IF NOT EXISTS` / `DROP IF EXISTS` zamiast edytować starą.

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
- **Service Worker:** aktualnie `v1.227` (`CACHE_NAME` w `sw.js`). Format `vMAJOR.NNN` (3-cyfrowy minor z zerami wiodącymi): `v1.227` → `v1.228` … `v1.999` → `v2.000`.
- **Promocja Premium:** **wszyscy zalogowani użytkownicy mają Premium za darmo do 30.11.2026** (override po stronie kodu w `db.js isPremium()` — `isPromoActive()` zwraca `true` gdy `Date.now() < 2026-12-01 00:00`). Po 30.11.2026 promocja (przedłużona 25.10.2026 z 31.10) samoczynnie wygasa — wraca normalna logika: nowi użytkownicy mają 30-dniowy trial gratis, reszta przechodzi na Free.

## 📚 Dokumentacja szczegółowa (`docs/`)

Ten plik to skrót. Szczegóły funkcji są w `docs/` — **przed zmianą danej funkcji znajdź jej opis Grepem** (np. nazwę funkcji JS, tabeli lub pliku) i przeczytaj tylko ten fragment:
- `docs/MIGRACJE.md` — migracje #1–#88: tabele, RPC, RLS, API db.js, UI.
- `docs/FUNKCJE.md` — Fiszki/FSRS i „Opanowane”, XP, Ignoruj, oceny, tryb skupienia, AI (OpenAI, rozmowy, głos), pupil, rankingi, statystyki, SEO, koszty i terminy, status funkcji, skrypty (sync, kopia zapasowa).
- `docs/GRAMMAR-CITY.md` — Grammar City 3D (silnik, auta, mapy, sklep, policja, pory roku…).
- `docs/GRY-INNE.md` — gry i losowanki z INNE, Wyścig słówek 3D, blokada gier, gry z listy unitów, nazwa „Karty do gry”.

Po dodaniu funkcji dopisz jej opis do właściwego pliku w `docs/` (nie do CLAUDE.md); tutaj tylko zasady i pułapki, które trzeba znać przy każdej zmianie.

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

## 🗄️ Migracje SQL do Supabase

- Ostatnia: **#88** (`homework-tasks.sql`). Pełna lista z opisami: `docs/MIGRACJE.md`.
- Nowa migracja: sprawdź wolny numer na świeżym `origin/main`, plik idempotentny (`if not exists`, `create or replace`, `drop … if exists`), dopisz wiersz w `sprawdz-migracje.sql` i opis w `docs/MIGRACJE.md`, testuj na PGlite.
- Kod klienta działa bez nowej migracji (fail-soft: `null` = brak migracji → UI chowa funkcję).
- **Zawsze przypominaj użytkownikowi** o uruchomieniu nowej migracji w Supabase, kiedy tworzysz nową.

## 🎭 Role i uprawnienia

**Rola** (`is_admin` / `is_teacher` / `is_parent`) × **Plan** (`free` / `premium` + `plan_expires_at`). Admin automatycznie traktowany jak Premium (pełny dostęp). Trial Premium 30 dni nadawany automatycznie nowemu kontu przy pierwszym logowaniu (migracja #34 — wcześniej było 7 dni).

| Rola | Co widzi | Co może robić |
|---|---|---|
| **Gość** (`isGuest`) | tylko `defaultAccess: true`; **brak motywów, brak gier INNE** (🔒) | uczyć się podstawami; nic nie jest zapisywane |
| **Uczeń** (Free) | defaultAccess + user_books; gry INNE zablokowane (🔒 Premium) | uczyć się, prosić o dostęp, pisać do admina, usunąć konto |
| **Uczeń-Premium** | jw. + gry INNE odblokowane | pełny dostęp |
| **Nauczyciel** (`is_teacher`) | defaultAccess + user_books + panel | zarządzać klasami, tworzyć konta uczniów, resetować hasła, teacher_sets; **widzi tylko uczniów z `created_by = self`**; **prywatne notatki admina** (🔒) — tylko z Premium; **publiczne notatki admina** (📢) widoczne dla każdego; limity Free: **max 8 klas · 30 uczniów/klasa · 10 teacher_sets** |
| **Rodzic/Opiekun** (`is_parent`) | defaultAccess + gry INNE + panel opiekuna | dodawać dzieci jednorazowym kodem od dziecka lub nauczyciela (migracja #76); widzieć postępy dzieci; **Premium**: przydzielać podręczniki dzieciom, widzieć prywatne notatki admina, 10 teacher_sets (Free: 10, Premium: ∞) |
| **Admin** (`is_admin`) | wszystko (także `adminOnly`) | rozpatrywać prośby, zarządzać wszystkimi zestawami, zmieniać plany, moderować błędy, odpowiadać na wiadomości |

**Panel admina/nauczyciela** — od SW v59 zredukowany do **2 dużych kafelków** w `sBooks`: „👩‍🏫 Panel nauczyciela" (link do `teacher.html`) + „🔤 Słówka" (admin only, link do `words.html`). Pełny zestaw funkcji (Klasy · Dostęp · Zestawy · Prośby (admin) · Podręczniki nauczycieli (admin) · 🐛 Zgłoszone błędy (admin) · 💬 Wiadomości (admin) · 🔔 Nieaktywni · Raporty · Karty pracy · ⭐ Premium) jest dostępny w `teacher.html` i wraca do `app.html?go=xxx`.

**Panel opiekuna** (`sParentPanel`): Moje dzieci · 💬 Wiadomości · 🔔 Nieaktywni · 📊 Raporty (Premium) · ⭐ Premium.

## 🎨 Motywy

5 motywów: `owl` (domyślny), `forest`, `night`, `sunset`, `paper` (jasny). `localStorage['fiszki_theme']`. Gość — brak wyboru (kłódka).

## 📝 Konwencje

### Commity (WAŻNE)
- **Po polsku** w treści, ale **bez polskich znaków w tytule pierwszej linijki** — HEREDOC w bashu nie escape'uje `\u0119`. Używaj `ś → s`, `ż → z` itd. w tytule. W treści commit-message polskie znaki działają OK.
- Co-author: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Używaj HEREDOC: `git commit -F - <<'COMMITMSG'\n...\nCOMMITMSG`
- **Nigdy nie używaj `--amend`** ani `git push --force` bez wyraźnej zgody.

### Deploy — bump Service Worker
- **Po każdej zauważalnej zmianie** w `app.html`, `data.js`, `db.js`, `index.html` zbumpuj `CACHE_NAME` w `sw.js`. Format: `vMAJOR.NNN` (3-cyfrowy minor z zerami wiodącymi), np. `v1.001` → `v1.002` → `v1.003` … `v1.999` → `v2.000`. (Numeracja zresetowana do `v1.001`; wcześniej 2-cyfrowy `vMAJOR.MINOR` doszedł do `v2.02`.)
- Bez bumpa: przeglądarka nie wykryje nowej wersji → baner nie pojawi się u użytkowników.
- Mechanizm (od SW v1.211 — wspólny **`sw-update.js`** w app.html i index.html): gdy czeka nowa wersja, użytkownik dostaje okno. Jeśli `whats-new.json` ma wpisy z `"show": true` dla wersji nowszych niż jego (`v` = `CACHE_NAME`; wersje SW odpytywane przez `GET_VERSION` / MessageChannel, zapas `localStorage['fiszki_app_ver']`) — okno „🦉 Nowa wersja Sowich Fiszek / Co nowego” z listą, inaczej dawny baner „Nowa wersja dostępna”. **OK działa jak Ctrl+Shift+R**: `SKIP_WAITING` → `controllerchange` → `fetch(…, {cache:'reload'})` głównych plików (`CORE` + bieżąca strona, max 4 s) → `location.reload()`. Gdy okno nie pokazało się przed przeładowaniem (aktualizacja ze starszej wersji bez `sw-update.js`, zamknięte karty), po wczytaniu nowej wersji „🦉 Nowości w Sowich Fiszkach” pokazuje się raz (`fiszki_notes_seen`); nowy użytkownik (strona bez SW przy wejściu) nie dostaje listy.
- **„Co nowego” tylko po akceptacji właściciela (decyzja z 30.10.2026):** przy każdym podbiciu `CACHE_NAME` zapytaj (AskUserQuestion z podglądem tekstu), czy pokazać okno i z jaką treścią; wpis w `whats-new.json` (`v`, `date`, `show`, `title`, `items` — krótkie punkty z emoji językiem ucznia) z `"show": true` dopiero po zgodzie. Zaznacz punkty wymagające nieuruchomionej migracji.

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
- **Uprawnienia do funkcji (WAŻNE)** — Supabase nadaje każdej nowej funkcji w `public` EXECUTE dla `anon` i `authenticated` (domyślne uprawnienia), a `revoke … from public` tego NIE zdejmuje — każdą taką funkcję da się wywołać przez `/rest/v1/rpc/…`, także bez logowania. Funkcja SECURITY DEFINER bez własnego sprawdzania uprawnień (pomocnik wołany tylko przez inne funkcje) → `revoke all on function … from public, anon, authenticated`. RPC tylko dla zalogowanych → `revoke execute … from public, anon; grant execute … to authenticated`. Dla gości (anon) zostają tylko: `check_username_exists`, `submit_admin_request`, `join_live_game`, `update_live_player_score`, `penpal_*`, `notesownik_get_board`, `sowiemysli_get_map` + pomocnicze z polityk RLS (`_is_admin`, `_can_…` — anon musi je wykonywać, bo polityki są sprawdzane z jego uprawnieniami). Patrz migracja #84.
- **Supabase Free (Nano, 0,5 GB RAM) — limit operacji dysku (Disk IO budget)**: gdy pamięci brakuje, serwer używa swapu i zużywa budżet IO; po jego wyczerpaniu baza przestaje odpowiadać (awaria 28.10.2026: Database/Auth/PostgREST „Unhealthy”, błąd 522, pomógł Restart project). Dane aplikacji są małe — unikaj częstego odpytywania bazy: wyniki RPC na ekranie startowym trzymamy w pamięci (`sfCached` w module pupila — ranking `my_class_rankings` i wyzwania `list_my_active_challenges` 5 min), sygnały „Teraz online” co 90 s. Przy powtarzających się awariach: plan Pro + Micro (1 GB RAM).
- **XP zapisuje baza, nie zapis profilu (#85)** — nowe źródło XP: `addXP(x)` (albo `addBonusXP(n)` poza fiszkami) → `DB.gainXP` → RPC `add_my_xp`. Nie dopisuj `xp`/`level` do `_profilePayload` i nie zmieniaj XP przez `setXP` — stara karta albo drugie urządzenie cofały w ten sposób poziom uczniów.
- **Edycja słówka nie może gubić elementów 2+** (emoji, zdania inline z data.js) — zawsze `[newPl, newTarget, ...stare.slice(2)]` (`adminEditWord`, `_applyAdminData`, `saveWordEdit`; SW v1.217). Dane zapisane pod polskim słowem (word_sentences, word_hints, word_contexts, word_audio, dictionary_words) przy zmianie polskiego słowa przenosi `moveWordData` (zdanie i wskazówka — kopia, reszta — UPDATE word_pl). Zdania do wyświetlania czytaj przez `wordSentences(w, bookId)` (najpierw poprawione w bazie, także spod `DB.getOriginalPl`, potem inline) — nie przez samo `getInlineSentences`, bo wtedy edycja z ✏️ się nie pokaże; edytor zdań wypełnia pola przez `wordSentences`.
- **CRLF/LF warnings przy commicie na Windows** — normalne, ignoruj.
- **RLS zwraca pustą listę** — brak polityki. Zawsze dodawaj `.select()` po UPDATE żeby wykryć ciche blokady.
- **Polskie znaki w tytule commita** — HEREDOC ich nie escape'uje. Używaj ASCII w tytule.
- **`escHtml` vs `esc`** — IIFE ma własne lokalne `escHtml`. Funkcje w głównym scripcie używają globalnego `escHtml` z linii ~5532.

## ⚖️ Compliance

- **Regulamin** (§1–§15) i **Polityka prywatności** (12 sekcji) są w `app.html` (modal) i `index.html` (modal). Spójna treść w obu.
- **RODO:** obowiązkowa zgoda przy rejestracji, wymóg zgody opiekuna <16 lat, prawo do bycia zapomnianym (funkcja „Usuń konto" w modalu „Moje konto" w nagłówku).
- **Wiek użytkownika:** bez ograniczeń, ale dzieci <16 lat wymagają zgody rodzica (checkbox przy rejestracji).
- **Dane:** login + hasło (bcrypt w Supabase Auth) + postępy nauki. Przy prośbie o dostęp — dobrowolne imię i nazwisko (dla admina).
- **AI** — funkcje 🤖 (OpenAI przez Edge Function `ai`, migracja #73) opisane w Polityce prywatności (procesor OpenAI) i Regulaminie §8 ust. 3. Do AI tylko treść zadania — bez danych osobowych. W marketingu (home/faq) nie eksponować bez decyzji właściciela.

## 🔧 Typowe zadania

### Poprawa funkcji lub dodanie nowej
1. Przeczytaj tylko relevantne fragmenty (`Grep`, nie cały `app.html`).
2. Jeśli zadanie duże — zaproponuj etapy.
3. Wprowadź zmiany, pokaż co się zmieniło.
4. **Bump `CACHE_NAME`** gdy zmiany w app.html/data.js/db.js/index.html.
5. Commit + push **od razu po zakończeniu i sprawdzeniu zmiany — bez pytania** (decyzja właściciela z 9.10.2026). Nadal bez `--amend` / `push --force` / `reset --hard` bez wyraźnej zgody.
6. Wspomnij o potrzebie uruchomienia migracji SQL, jeśli ją dodałeś.

### Styl odpowiedzi
- Użytkownik preferuje **polski**.
- Konkretne kroki, nie długie elaboraty.
- Przy zmianach w `app.html` (widocznych w preview): informuj że „`app.html` jest widoczny w panelu Launch preview".
- Przy niejasnościach pytaj przez `AskUserQuestion` zamiast zgadywać.

## 🆘 Gdy coś się zepsuje

- `git log --oneline -10` — ostatnie commity.
- `git diff HEAD~1` — co ostatnio się zmieniło.
- `git revert <sha>` — bezpieczne cofnięcie commita.
- Jeśli migracja SQL wywraca bazę — napisz kolejną migrację z `IF NOT EXISTS` / `DROP IF EXISTS` zamiast edytować starą.
- Jeśli po zmianach RLS wywala HTTP 500 — sprawdź czy polityki odwołujące się do `profiles` używają helperów `_is_admin()/_is_parent_of()` (migracja #20).

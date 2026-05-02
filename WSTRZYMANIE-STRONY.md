# Jak wstrzymać publikację Sowie Fiszki

> Plik **roboczy** dla Daniela. Nie deploy'owany na sowiefiszki.com — żyje tylko w repo.
> Trzy metody, od najszybszej do najczystszej.

---

## 🚨 METODA A — Najszybsza (nagły przypadek, ~30 sekund)

**Kiedy używać:** ktoś zgłosił problem prawny, dane osobowe wyciekły, wirus, cokolwiek pilnego — strona MUSI zniknąć **NATYCHMIAST**.

### Kroki:

1. Wejdź na **https://vercel.com**
2. Zaloguj się → kliknij projekt **sowie.fiszki**
3. **Settings** (góra menu projektu) → **Domains** (lewe menu)
4. Kliknij **⋯** (trzy kropki) obok `sowiefiszki.com` → **Remove**
5. Potwierdź

**Efekt:** za ~30 sekund każde wejście na `sowiefiszki.com` pokazuje pustą stronę / DNS error / Vercel 404. Strona **kompletnie offline**.

### Jak przywrócić:

1. Vercel → projekt → Settings → Domains → **Add Domain**
2. Wpisz `sowiefiszki.com`
3. Vercel weryfikuje DNS (już są skonfigurowane) — w ciągu kilku minut domena znów wskazuje na Twój projekt

**Plus:** ZERO commitów. ZERO zmian w kodzie. Bez śladu w historii git.
**Minus:** użytkownik widzi szpetny błąd — bez pięknej strony z sową.

---

## 🛠️ METODA B — Maintenance mode z brandingiem (~2 minuty)

**Kiedy używać:** planowana konserwacja, rzucenie commit'em który ma być pokazany użytkownikom („wracamy za chwilę"), aktualizacja DB.

### Co masz przygotowane w repo:

- **`maintenance.html`** — gotowa, ładna strona „Wracamy za chwilę 🦉🛠️" (auto-refresh co 2 minuty)
- **`vercel.maintenance.json`** — gotowy szablon konfiguracji (rewrite-all do maintenance)

### Włączenie trybu konserwacji (~2 min):

#### Opcja B.1 — przez GitHub web (najwygodniejsze, działa z telefonu)

1. Otwórz [github.com/dandeliant/sowie.fiszki](https://github.com/dandeliant/sowie.fiszki)
2. Kliknij na plik **`vercel.json`**
3. Klik ołówka **(Edit)** w prawym górnym rogu
4. Otwórz drugą zakładkę z **`vercel.maintenance.json`** → skopiuj **całą zawartość**
5. Wróć do edycji `vercel.json` → **zaznacz wszystko** (Ctrl+A) → **wklej skopiowaną zawartość**
6. Na dole: **Commit changes** → opis: *„Włączam tryb konserwacji"* → **Commit directly to main**
7. Vercel auto-deploy w 1-2 min → cała strona pokazuje `maintenance.html`

#### Opcja B.2 — lokalnie (terminal)

```bash
cd "C:\Users\Asus\Desktop\Sowie fiszki 2 — kopia"
copy vercel.maintenance.json vercel.json /Y
git add vercel.json
git commit -m "Wlaczam tryb konserwacji"
git push
```

### Wyłączenie trybu konserwacji (~2 min):

#### Opcja B.1 — GitHub web

1. github.com/dandeliant/sowie.fiszki → kliknij `vercel.json` → ołówek (Edit)
2. **Zaznacz wszystko** (Ctrl+A) → wklej **oryginalną zawartość** (poniżej)
3. Commit → *„Wyłączam tryb konserwacji"* → main

#### Opcja B.2 — lokalnie (cofnij commit)

```bash
git revert HEAD  # cofa ostatni commit (zachowuje historię)
git push
```

#### Oryginalna zawartość `vercel.json` (do wklejenia gdy wyłączasz):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "redirects": [
    { "source": "/", "destination": "/home.html", "permanent": false }
  ],
  "rewrites": [
    { "source": "/login", "destination": "/index.html" },
    { "source": "/faq", "destination": "/faq.html" },
    { "source": "/regulamin", "destination": "/regulamin.html" },
    { "source": "/polityka", "destination": "/polityka.html" },
    { "source": "/app", "destination": "/app.html" },
    { "source": "/teacher", "destination": "/teacher.html" },
    { "source": "/words", "destination": "/words.html" }
  ],
  "headers": [
    {
      "source": "/(.*)\\.html",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    },
    {
      "source": "/sw\\.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

---

## 🔄 METODA C — Roll-back do wcześniejszej wersji (~30 sekund, w Vercel)

**Kiedy używać:** ktoś zgłosił że jakiś commit zepsuł stronę, chcesz wrócić do poprzedniej działającej wersji bez przywracania starego kodu w git.

### Kroki:

1. Vercel → projekt → **Deployments**
2. Znajdź deployment z **poprzedniej** wersji (zielony „Production" sprzed psującego commit'a)
3. Kliknij **⋯** → **Promote to Production**
4. Potwierdź

**Efekt:** Vercel kieruje ruch na wybrany stary deployment w ~30 sekund. Repo NIE jest zmieniane — tylko tymczasowo serwujesz starą wersję.

**Aby wrócić do najnowszej:**
- Vercel → Deployments → najnowszy → Promote to Production

---

## 🆘 Plan na sytuacje awaryjne

### Scenariusz 1: Wydawnictwo grozi pozwem
1. **Method A** (Vercel Domains → Remove) → strona offline w 30 sek
2. Spokojnie odpowiedz wydawnictwu, że już zareagowałeś
3. Usuń problematyczne treści w repo
4. **Method A** (Add Domain back) → strona wraca

### Scenariusz 2: Wprowadzasz dużą migrację SQL i nie chcesz strajku użytkowników w trakcie
1. **Method B.2** (lokalnie) — `copy vercel.maintenance.json vercel.json` + push
2. Uruchom migrację w Supabase
3. Test
4. `git revert HEAD` + push → strona wraca

### Scenariusz 3: Wykryłeś bug w produkcji
1. **Method C** — promote poprzedni deployment w Vercel (30 sek)
2. Spokojnie napraw bug w kodzie
3. Push fix → deploy
4. Vercel automatycznie ustawi nowy production (rollback przestaje obowiązywać)

---

## ⚠️ Czego NIE robić

- ❌ **Nie kasuj projektu w Vercel** — to nieodwracalne, stracisz cały setup (DNS, deploymenty, statystyki)
- ❌ **Nie zmieniaj nameserverów domeny** — dłuższa propagacja (~24h), użytkownicy mogą widzieć dziwne rzeczy
- ❌ **Nie używaj `git push --force` na main** — może zniszczyć historię
- ❌ **Nie zostaw maintenance mode na noc bez powodu** — Google może obniżyć ranking SEO

---

## 📊 Porównanie metod

| | Czas włączenia | Czas wyłączenia | Branding | Trace w git |
|---|---|---|---|---|
| **A: Remove domain** | 30 s (Vercel UI) | 1-3 min (re-add) | ❌ szpetny błąd | brak |
| **B: Maintenance JSON** | 1-2 min (push) | 1-2 min (push) | ✅ piękna strona z sową | tak (commit) |
| **C: Roll-back** | 30 s (Vercel UI) | 30 s (re-promote) | używa starej wersji | brak |

**Rekomendacja:**
- **Pilne sprawy prawne** → Metoda A (najszybsza)
- **Zaplanowana konserwacja** → Metoda B (z piękną stroną)
- **Niedawny bug w produkcji** → Metoda C (roll-back)

---

_Plik aktualizować przy każdej zmianie konfiguracji vercel.json (oryginalna zawartość)._

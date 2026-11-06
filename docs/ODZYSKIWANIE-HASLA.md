# 🔑 Odzyskiwanie hasła e-mailem — wdrożenie (migracja #98, SW v1.256)

Dla kont **nauczyciela, opiekuna i admina**. Uczniowie nie podają e-maila — hasło ucznia zmienia nauczyciel (panel klasy), a ekran logowania mówi to uczniowi w „🔑 Nie pamiętam hasła”.

## Jak to działa

1. Dorosły podaje e-mail przy rejestracji (pole „E-mail do odzyskania hasła”, dobrowolne) albo w **👤 Moje konto → 🔑 E-mail do odzyskania hasła**.
2. Przychodzi link potwierdzający (ważny 48 h) → `index.html#verify-email=…` → „✅ E-mail potwierdzony”.
3. Gdy zapomni hasła: ekran logowania → **🔑 Nie pamiętam hasła** → login albo e-mail → link do ustawienia nowego hasła (jednorazowy, 60 minut) → `index.html#reset=…` → „🔑 Ustaw nowe hasło” → logowanie z podpowiedzianym loginem.
4. Odpowiedź na „Nie pamiętam hasła” jest zawsze taka sama (nie zdradza, czy konto lub adres istnieje). Limity: 10 próśb na godzinę z jednego IP, 3 e-maile na godzinę na jeden adres, 5 zmian adresu / ponownych linków na godzinę na konto.
5. Jeden adres może być przypisany do kilku kont (np. konto nauczyciela i konto opiekuna) — e-mail z „Nie pamiętam hasła” wymienia wtedy wszystkie loginy (max 3), każdy z osobnym linkiem.

Tabele (`account_emails`, `password_resets`, `recovery_log`) są niedostępne z aplikacji — obsługuje je wyłącznie Edge Function **`account`** (klucz service role). W bazie są tylko skróty tokenów (SHA-256), a w logu prób — skróty IP i e-maili (7 dni).

## Wdrożenie — krok po kroku (właściciel)

### 1. Migracja
Supabase → **SQL Editor** → wklej i uruchom `account-recovery.sql` (#98).

### 2. Wysyłka e-maili — Brevo (darmowy plan: 300 e-maili dziennie, serwery w UE)
1. Załóż konto na **brevo.com** (adres `sowie.fiszki@gmail.com`).
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain** → `sowiefiszki.com` → Brevo pokaże rekordy DNS (kod Brevo, DKIM, DMARC).
3. Dodaj te rekordy tam, gdzie zarządzasz DNS domeny `sowiefiszki.com` (np. Vercel → Domains → sowiefiszki.com → DNS Records, albo panel rejestratora domeny). Wróć do Brevo → **Verify / Authenticate** (DNS czasem potrzebuje kilkunastu minut).
4. **Senders → Add a sender**: nazwa `Sowie Fiszki`, adres `noreply@sowiefiszki.com` (skrzynka nie musi istnieć — domena jest już uwierzytelniona).
5. **SMTP & API → API Keys → Generate a new API key** (np. „sowie-fiszki”) → skopiuj klucz. **Nie wklejaj go do czatu ani do repozytorium** — tylko do Supabase (krok 4).

### 3. Edge Function „account”
Supabase → **Edge Functions → Deploy a new function → Via Editor** → nazwa **`account`** → wklej całą zawartość pliku `supabase/functions/account/index.ts` → **Deploy**.
Potem w ustawieniach funkcji **wyłącz „Enforce JWT Verification” / „Verify JWT”** (akcje „Nie pamiętam hasła”, potwierdzenie i nowe hasło są dla niezalogowanych — funkcja sama sprawdza zalogowanie tam, gdzie trzeba).

### 4. Sekrety funkcji
Supabase → **Edge Functions → Secrets → Add new secret**:

| Nazwa | Wartość |
|---|---|
| `BREVO_API_KEY` | klucz z kroku 2.5 |
| `MAIL_FROM` | `noreply@sowiefiszki.com` |
| `SITE_URL` | `https://sowiefiszki.com` |

(`SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` Supabase podaje funkcji sam.)
Zamiast Brevo można użyć **Resend** (sekret `RESEND_API_KEY` zamiast `BREVO_API_KEY`) — wtedy w Polityce prywatności trzeba zmienić podmiot przetwarzający (Brevo → Resend, USA).

### 5. Test
1. Zaloguj się kontem nauczyciela → **👤 Moje konto → 🔑 E-mail do odzyskania hasła** → wpisz swój adres → **💾 Zapisz** → „📧 Wysłaliśmy link…”.
2. Kliknij link w e-mailu (sprawdź też „Spam”) → „✅ E-mail potwierdzony”. W „Moje konto” stan: „✅ … — potwierdzony”.
3. Wyloguj się → **🔑 Nie pamiętam hasła** → login → **📧 Wyślij link** → kliknij link z e-maila → ustaw nowe hasło → zaloguj się.

Bez wdrożonej funkcji aplikacja działa jak dotąd: sekcja w „Moje konto” i „Nie pamiętam hasła” pokazują „Odzyskiwanie hasła e-mailem nie jest jeszcze włączone”.

## Pliki
- `account-recovery.sql` — migracja #98
- `supabase/functions/account/index.ts` — Edge Function (akcje get / set / resend / remove / verify / forgot / reset)
- `db.js` — `DB.accountCall(action, payload)`
- `index.html` — pole e-mail przy rejestracji (nauczyciel / opiekun), „🔑 Nie pamiętam hasła”, formularz „Ustaw nowe hasło” (`#reset=`), potwierdzenie adresu (`#verify-email=`)
- `app.html` — „👤 Moje konto → 🔑 E-mail do odzyskania hasła” (`_renderRecoveryEmail`, `saveRecoveryEmail`, `resendRecoveryEmail`, `removeRecoveryEmail`)
- Polityka prywatności (app.html, index.html, polityka.html) — punkt „E-mail do odzyskania hasła” + podmiot Brevo

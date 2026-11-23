// ============================================================
//  KOREPETYCJE (TutorFlow) — zapis na koncie Sowie Fiszki (Supabase, migracja #104)
//
//  • Dostęp: admin albo nauczyciel z Premium (jak Sowie Myśli; promocja jak db.js).
//    Uczeń / opiekun / nauczyciel bez Premium / niezalogowany → bramka #kpGate.
//  • Dane: cały stan TutorFlow = jeden dokument JSON na konto (tutoring_data).
//    Numer wersji chroni przed nadpisaniem zmian z drugiego urządzenia — przy
//    konflikcie pytamy: „Wczytaj z konta” albo „Zachowaj moje (nadpisz)”.
//  • TutorFlow czyta synchronicznie (Store.init → adapter.read()), więc najpierw
//    pobieramy dane z konta do kopii roboczej localStorage['tutorflow:v1:<uid>']
//    (+ meta 'tutorflow:meta:<uid>': wersja z bazy, „niezapisane”), a potem
//    startujemy aplikację. Każdy zapis: od razu lokalnie, do bazy po SAVE_DELAY
//    (ponawiane bez internetu; zamknięcie karty z niezapisanymi zmianami pyta).
//  • Po powrocie na kartę (co najwyżej raz na minutę) sprawdzamy, czy na koncie
//    nie ma nowszej wersji — jeśli tu nic nie zmieniono, wczytujemy ją po cichu.
// ============================================================
window.TF = window.TF || {};

(function () {
  'use strict';

  const PROMO_END = Date.parse('2027-02-01T00:00:00');   // jak db.js isPromoActive()
  const SAVE_DELAY = 1500;
  const RETRY = [5000, 15000, 30000, 60000];
  const CHECK_GAP = 60000;

  let sb = null, user = null, profile = null;
  let version = 0, dirty = false, saving = false, again = false;
  let timer = null, retryN = 0, lastJson = null, quiet = false, conflictOpen = false, lastCheck = 0;

  const K = () => 'tutorflow:v1:' + user.id;
  const KM = () => 'tutorflow:meta:' + user.id;
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  const meta = () => { try { return JSON.parse(lsGet(KM()) || '{}') || {}; } catch (e) { return {}; } };
  const saveMeta = () => lsSet(KM(), JSON.stringify({ version: version, dirty: dirty, ok: true, at: Date.now() }));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── Premium / dostęp ────────────────────────────────────────────
  function hasPremium(p) {
    if (!p) return false;
    if (p.is_admin) return true;
    if (Date.now() < PROMO_END) return true;
    if (p.plan === 'teacher') return true;   // dawny typ konta nauczyciela
    if (p.plan !== 'premium') return false;
    return !p.plan_expires_at || new Date(p.plan_expires_at).getTime() > Date.now();
  }
  function canUse(p) { return !!p && (!!p.is_admin || (!!p.is_teacher && hasPremium(p))); }

  // ── wskaźnik zapisu w nagłówku ──────────────────────────────────
  function status(kind, text, title) {
    const el = document.getElementById('kpSync');
    if (!el) return;
    el.hidden = false;
    el.setAttribute('data-kind', kind);
    el.textContent = text;
    el.title = title || text;
  }
  function toast(title, opts) {
    try { if (window.TF.UI && window.TF.UI.toast) window.TF.UI.toast(title, opts || {}); } catch (e) {}
  }

  // ── bramka (brak logowania / brak uprawnień / błąd) ─────────────
  function gate(html, buttons) {
    const boot = document.getElementById('boot');
    if (boot) boot.remove();
    const g = document.getElementById('kpGate');
    if (!g) { alert(String(html).replace(/<[^>]+>/g, '')); return; }
    g.querySelector('.kp-gate__body').innerHTML = html;
    g.querySelector('.kp-gate__btns').innerHTML = (buttons || []).map((b) =>
      '<a class="btn ' + (b.primary ? 'btn--brand' : '') + '" href="' + esc(b.href) + '">' + esc(b.label) + '</a>').join('');
    g.hidden = false;
  }

  // ── adapter dla TutorFlow (synchroniczny; baza w tle) ───────────
  const adapter = {
    name: 'konto Sowie Fiszki',
    read() {
      try { return JSON.parse(lsGet(K()) || 'null'); } catch (e) { return null; }
    },
    write(state) {
      const json = JSON.stringify(state);
      if (!lsSet(K(), json)) {
        toast('Kopia robocza się nie zmieściła', { type: 'warn', desc: 'Zapisuję bezpośrednio na koncie — nie zamykaj karty do „✓ Zapisano”.' });
      }
      if (quiet || json === lastJson) return true;
      dirty = true; saveMeta();
      schedule();
      return true;
    },
    clear() {
      lsDel(K());
      dirty = true; saveMeta();
      schedule();
      return true;
    },
    info() {
      const size = (lsGet(K()) || '').length;
      return { name: 'konto Sowie Fiszki', size: size, sizeKb: Math.round(size / 1024 * 10) / 10 };
    }
  };

  function schedule(delay) {
    clearTimeout(timer);
    status('pending', '⏳ Zapisuję…', 'Zmiany zapiszą się na Twoim koncie za chwilę');
    timer = setTimeout(() => push(false), delay == null ? SAVE_DELAY : delay);
  }

  async function push(force) {
    if (!dirty && !force) return;
    if (saving) { again = true; return; }
    const json = lsGet(K()) || JSON.stringify((window.TF.Store && window.TF.Store.state) || {});
    let data;
    try { data = JSON.parse(json); } catch (e) { return; }
    saving = true;
    status('saving', '⏳ Zapisuję…');
    let res = null, err = null;
    try {
      const r = await sb.rpc('tutoring_save', { p_data: data, p_version: version, p_force: !!force });
      res = r.data; err = r.error;
    } catch (e) { err = e; }
    saving = false;
    if (err) {
      const m = ((err && err.message) || '') + ' ' + ((err && err.code) || '');
      if (/NOT_ALLOWED/.test(m)) { status('error', '⚠️ Brak uprawnień', 'Korepetycje zapisuje tylko nauczyciel z Premium albo admin'); return; }
      if (/TOO_BIG/.test(m)) {
        status('error', '⚠️ Za dużo danych');
        toast('Za dużo danych do zapisania (ponad 5 MB)', { type: 'bad', desc: 'Usuń stare załączniki lub dane demonstracyjne.' });
        return;
      }
      if (/tutoring_save|PGRST202|42883/.test(m)) { status('error', '⚠️ Wymaga migracji #104'); return; }
      status('offline', '☁️ Offline — zapiszę później', 'Brak połączenia z kontem. Zmiany są bezpieczne w tej przeglądarce i zapiszą się same.');
      clearTimeout(timer);
      timer = setTimeout(() => push(false), RETRY[Math.min(retryN++, RETRY.length - 1)]);
      return;
    }
    retryN = 0;
    const row = Array.isArray(res) ? res[0] : res;
    if (row && row.o_conflict) { onConflict(row); return; }
    version = row && row.o_version != null ? row.o_version : version + 1;
    lastJson = json;
    if (lsGet(K()) === json) dirty = false;   // nowsze zmiany w trakcie zapisu zostają do wysłania
    saveMeta();
    status('ok', '✓ Zapisano', 'Dane są zapisane na Twoim koncie Sowie Fiszki');
    if (dirty || again) { again = false; schedule(); }
  }

  async function fetchServer() {
    const r = await sb.rpc('tutoring_load');
    if (r.error) throw r.error;
    return Array.isArray(r.data) ? (r.data[0] || null) : (r.data || null);
  }

  // Wczytaj stan z konta do aplikacji (po konflikcie albo po zmianie na innym urządzeniu)
  function applyServer(row) {
    const data = row ? row.o_data : null;
    version = row ? row.o_version : 0;
    quiet = true;
    try {
      if (data) { lsSet(K(), JSON.stringify(data)); window.TF.Store.replaceAll(data); }
      else { lsDel(K()); window.TF.Store.reset(); }
    } finally { quiet = false; }
    lastJson = lsGet(K());
    dirty = false; saveMeta();
    try { if (window.TF.App && window.TF.App.refreshChrome) window.TF.App.refreshChrome(); } catch (e) {}
    try { if (window.TF.Router && window.TF.Router.refresh) window.TF.Router.refresh(); } catch (e) {}
    status('ok', '✓ Zapisano');
  }

  async function onConflict(row) {
    if (conflictOpen) return;
    conflictOpen = true;
    status('conflict', '⚠️ Zmiany na innym urządzeniu');
    const when = row && row.o_updated_at ? new Date(row.o_updated_at).toLocaleString('pl-PL') : '';
    let ok = true;
    try {
      ok = await window.TF.UI.confirm({
        title: 'Dane zmieniono na innym urządzeniu',
        text: 'Na Twoim koncie jest nowsza wersja danych' + (when ? ' (zapisana ' + when + ')' : '') +
          ' niż ta, na której pracujesz w tym oknie. Wczytać dane z konta? Zmiany z tego okna od ostatniego zapisu przepadną.',
        warning: 'Wybierz „Zachowaj moje”, jeśli to tutaj są właściwe dane — wtedy nadpiszą wersję na koncie.',
        confirmLabel: 'Wczytaj z konta', danger: false,
        cancelLabel: 'Zachowaj moje (nadpisz)'
      });
    } catch (e) { ok = true; }
    conflictOpen = false;
    if (ok) {
      try { applyServer(await fetchServer()); toast('Wczytano najnowsze dane z konta', { type: 'ok' }); }
      catch (e) { status('offline', '☁️ Offline — spróbuję później'); }
    } else {
      dirty = true; push(true);
    }
  }

  // Po powrocie na kartę: nowsza wersja na koncie? (tylko odczyt numeru wersji)
  async function checkRemote() {
    if (!user || saving || conflictOpen || Date.now() - lastCheck < CHECK_GAP) return;
    lastCheck = Date.now();
    let v = null;
    try {
      const r = await sb.from('tutoring_data').select('version').eq('user_id', user.id).maybeSingle();
      if (r.error) return;
      v = r.data ? r.data.version : 0;
    } catch (e) { return; }
    if (v === version) return;
    if (dirty) { push(false); return; }   // zapis wykryje konflikt i zapyta
    try { applyServer(await fetchServer()); toast('Wczytano zmiany z innego urządzenia', { type: 'info' }); } catch (e) {}
  }

  // ── start ───────────────────────────────────────────────────────
  async function boot(start) {
    sb = (window.supabase && typeof window.supabase.from === 'function') ? window.supabase : null;
    if (!sb) {
      gate('Nie udało się połączyć z Sowimi Fiszkami. Sprawdź internet i odśwież stronę.', [{ label: '↻ Odśwież', href: 'korepetycje.html', primary: true }]);
      return;
    }
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) {}
    if (!session) {
      gate('<b>Zaloguj się na konto nauczyciela</b> w Sowich Fiszkach, żeby korzystać z Korepetycji. ' +
        'Wszystko, co tu wpiszesz, zapisuje się na Twoim koncie — zobaczysz to na każdym urządzeniu.',
        [{ label: '🔑 Zaloguj się', href: 'index.html?redirect=korepetycje.html', primary: true }, { label: '← Sowie Fiszki', href: 'app.html' }]);
      return;
    }
    user = session.user;

    let p = null, perr = null;
    try {
      const r = await sb.from('profiles').select('is_admin,is_teacher,is_parent,plan,plan_expires_at,username').eq('id', user.id).maybeSingle();
      p = r.data; perr = r.error;
    } catch (e) { perr = e; }
    const m0 = meta();
    if (!p && perr) {   // brak połączenia — dawniej zalogowany i z dostępem → praca na kopii roboczej
      if (m0.ok && lsGet(K())) { return startOffline(start, m0); }
      gate('Brak połączenia z Sowimi Fiszkami. Sprawdź internet i odśwież stronę.', [{ label: '↻ Odśwież', href: 'korepetycje.html', primary: true }]);
      return;
    }
    profile = p;
    if (!canUse(p)) {
      if (p && p.is_teacher) {
        gate('<b>Korepetycje</b> to narzędzie z <b>Premium dla nauczycieli</b>: uczniowie, kalendarz zajęć, płatności, zarobki, prognozy i raporty — zapisywane na Twoim koncie.',
          [{ label: '⭐ Zobacz Premium', href: 'app.html?go=premium', primary: true }, { label: '← Panel nauczyciela', href: 'teacher.html' }]);
      } else {
        gate('<b>Korepetycje</b> to narzędzie dla <b>nauczycieli</b> (z Premium) do prowadzenia własnych korepetycji.',
          [{ label: '← Sowie Fiszki', href: 'app.html', primary: true }]);
      }
      return;
    }

    let row = null, lerr = null;
    try { row = await fetchServer(); } catch (e) { lerr = e; }
    if (lerr) {
      const msg = ((lerr && lerr.message) || '') + ' ' + ((lerr && lerr.code) || '');
      if (/tutoring_load|PGRST202|42883/.test(msg)) {
        gate('Moduł Korepetycje wymaga uruchomienia migracji <b>#104</b> (<code>tutoring-data.sql</code>) w Supabase.',
          [{ label: '← Panel nauczyciela', href: 'teacher.html', primary: true }]);
        return;
      }
      if (lsGet(K())) return startOffline(start, m0);
      gate('Nie udało się wczytać danych z konta. Sprawdź internet i odśwież stronę.', [{ label: '↻ Odśwież', href: 'korepetycje.html', primary: true }]);
      return;
    }

    const local = lsGet(K());
    let restoreAsk = null;
    if (!row) {
      // pusto na koncie: pierwsze wejście albo dane usunięto na innym urządzeniu
      version = 0;
      if ((m0.version || 0) > 0) { lsDel(K()); dirty = false; }
      else dirty = !!(local && m0.dirty);   // pierwsze dane jeszcze niewysłane
    } else if (local && m0.dirty && m0.version === row.o_version) {
      version = row.o_version; dirty = true;   // niezapisane zmiany z tego urządzenia — wyślemy je
    } else {
      if (local && m0.dirty) {
        // niezapisane zmiany tutaj, a na koncie nowsza wersja z innego urządzenia
        restoreAsk = { json: local, at: m0.at };
        lsSet('tutorflow:backup:' + user.id, local);
      }
      lsSet(K(), JSON.stringify(row.o_data));
      version = row.o_version; dirty = false;
    }
    lastJson = dirty ? null : lsGet(K());
    saveMeta();
    start();
    if (dirty) schedule(300); else status('ok', '✓ Zapisano', 'Dane są zapisane na Twoim koncie Sowie Fiszki');
    if (restoreAsk) askRestore(restoreAsk);
    listen();
  }

  function startOffline(start, m0) {
    version = m0.version || 0; dirty = !!m0.dirty;
    lastJson = dirty ? null : lsGet(K());
    start();
    status('offline', '☁️ Offline — zapiszę później', 'Brak połączenia z kontem. Pracujesz na kopii z tej przeglądarki — zapisze się, gdy wróci internet.');
    if (dirty) { clearTimeout(timer); timer = setTimeout(() => push(false), RETRY[0]); }
    listen();
  }

  function askRestore(b) {
    setTimeout(async () => {
      let ok = false;
      try {
        ok = await window.TF.UI.confirm({
          title: 'Niezapisane zmiany z tego urządzenia',
          text: 'W tej przeglądarce zostały zmiany, które nie zdążyły się zapisać' + (b.at ? ' (z ' + new Date(b.at).toLocaleString('pl-PL') + ')' : '') +
            ', a na koncie są nowsze dane z innego urządzenia. Wczytałem dane z konta. Przywrócić zamiast nich zmiany z tej przeglądarki?',
          confirmLabel: 'Przywróć zmiany stąd', danger: false,
          cancelLabel: 'Zostaw dane z konta'
        });
      } catch (e) {}
      if (!ok) return;
      let data = null;
      try { data = JSON.parse(b.json); } catch (e) { return; }
      quiet = true;
      try { lsSet(K(), b.json); window.TF.Store.replaceAll(data); } finally { quiet = false; }
      try { if (window.TF.Router && window.TF.Router.refresh) window.TF.Router.refresh(); } catch (e) {}
      dirty = true; push(true);
    }, 900);
  }

  let listening = false;
  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener('online', () => { if (dirty) push(false); });
    window.addEventListener('beforeunload', (e) => {
      if (dirty || saving) { e.preventDefault(); e.returnValue = ''; }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { if (dirty && !saving) push(false); }
      else checkRemote();
    });
  }

  window.TF.Cloud = {
    adapter: adapter,
    boot: boot,
    saveNow: () => push(false),
    status: () => ({ version: version, dirty: dirty, saving: saving }),
    canUse: canUse
  };
})();

'use strict';
// ═══════════════════════════════════════════════════════════════
//  SOWIE FISZKI — Baza danych (Supabase)
//
//  Strategia: dane ładowane asynchronicznie przy starcie (DB.init),
//  następnie buforowane lokalnie. Odczyty są synchroniczne (z bufora),
//  zapisy aktualizują bufor + wysyłają do Supabase w tle (fire-and-forget).
//
//  Wymagane tabele (patrz supabase-schema.sql):
//    public.profiles
//    public.unit_progress
//    public.admin_requests
// ═══════════════════════════════════════════════════════════════

const DB = (() => {

  // ─── Bufor w pamięci ─────────────────────────────────────────
  let _profile        = null;   // zsynchronizowany profil użytkownika
  let _userId         = null;   // auth.users.id (UUID)
  let _adminRequests  = [];     // cache próśb o admina (tylko dla admina)
  let _saveTimer      = null;   // debounce zapisu profilu
  let _sentences      = {};     // cache zdań: 'bookId__wordPl' → {sentence_pl, sentence_target}
  let _adminWords     = [];     // globalne słówka/edycje admina
  let _adminBooks     = [];     // podręczniki dodane przez admina
  let _adminUnits     = [];     // rozdziały dodane przez admina
  let _myBooks        = null;   // null=brak ograniczeń, [bookId,...]=dozwolone podręczniki
  let _myLabels       = {};     // prywatne etykiety: targetUserId -> label (tylko moje — admin/teacher/parent)

  // ─── Domyślny profil ─────────────────────────────────────────
  function emptyProfile(username) {
    return {
      username,
      xp: 0, level: 1,
      streak: 0, longestStreak: 0,
      lastStudyDate: null,
      totalSessions: 0, totalAnswers: 0, correctAnswers: 0,
      unitProgress: {},
      achievements: [],
      dailyXP: 0, dailyXPDate: null,
      speedBest: 0,
      isAdmin: false
    };
  }

  // ─── Mapowanie wiersz DB → profil JS ─────────────────────────
  function _rowToProfile(row, unitRows) {
    const unitProgress = {};
    (unitRows || []).forEach(r => {
      unitProgress[`${r.book_key}__${r.unit_key}`] = {
        wordStates:  r.word_states  || {},
        knownCount:  r.known_count  || 0,
        total:       r.total        || 0,
        lastStudied: r.last_studied || null
      };
    });
    return {
      username:      row.username,
      xp:            row.xp             || 0,
      level:         row.level          || 1,
      streak:        row.streak         || 0,
      longestStreak: row.longest_streak || 0,
      lastStudyDate: row.last_study_date || null,
      totalSessions: row.total_sessions  || 0,
      totalAnswers:  row.total_answers   || 0,
      correctAnswers:row.correct_answers || 0,
      achievements:  row.achievements    || [],
      dailyXP:       row.daily_xp        || 0,
      dailyXPDate:   row.daily_xp_date   || null,
      speedBest:     row.speed_best      || 0,
      isAdmin:       row.is_admin        || false,
      isTeacher:     row.is_teacher      || false,
      isParent:      row.is_parent       || false,
      plan:          row.plan            || 'free',
      planExpiresAt: row.plan_expires_at || null,
      trialUsedAt:   row.trial_used_at   || null,
      unitProgress
    };
  }

  // ─── Budowanie payloadu profilu ──────────────────────────────
  function _profilePayload() {
    return {
      id:              _userId,
      username:        _profile.username,
      xp:              _profile.xp,
      level:           _profile.level,
      streak:          _profile.streak,
      longest_streak:  _profile.longestStreak,
      last_study_date: _profile.lastStudyDate,
      total_sessions:  _profile.totalSessions,
      total_answers:   _profile.totalAnswers,
      correct_answers: _profile.correctAnswers,
      achievements:    _profile.achievements,
      daily_xp:        _profile.dailyXP,
      daily_xp_date:   _profile.dailyXPDate,
      speed_best:      _profile.speedBest
    };
  }

  // ─── Zapis profilu do Supabase — debounce 600ms ───────────────
  //  Kilka szybkich zapisów scala się w jeden request z najnowszymi
  //  wartościami, eliminując race condition "starszy request wygrywa".
  function _save() {
    if (!_profile || !_userId) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      const payload = _profilePayload();
      supabase.from('profiles').upsert(payload, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.warn('[DB] Błąd zapisu profilu:', error.message);
      });
    }, 600);
  }

  // ═══════════════════════════════════════════════════════════════
  //  INICJALIZACJA — wywołaj await DB.init(username) przy starcie
  // ═══════════════════════════════════════════════════════════════
  async function init(username) {
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !session) throw new Error('Brak aktywnej sesji Supabase.');

    _userId = session.user.id;

    // Pobierz profil i postępy równolegle
    const [profRes, unitRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', _userId).single(),
      supabase.from('unit_progress').select('*').eq('user_id', _userId)
    ]);

    if (profRes.error) throw profRes.error;

    _profile = _rowToProfile(profRes.data, unitRes.data || []);

    // Załaduj przypisane podręczniki (user_books) — z deduplikacja
    // (chroni przed duplikatami w bazie, gdyby UNIQUE constraint jeszcze
    // nie zostal dodany lub gdyby kilka razy dodano to samo przypisanie).
    if (!_profile.isAdmin) {
      const { data: ubData } = await supabase
        .from('user_books').select('book_id').eq('user_id', _userId);
      if (ubData && ubData.length > 0) {
        _myBooks = Array.from(new Set(ubData.map(r => r.book_id)));
      } else {
        _myBooks = null;
      }
    } else {
      _myBooks = null; // admin widzi wszystko
    }

    // Załaduj moje prywatne etykiety uzytkownikow (user_labels).
    // Tylko admin/nauczyciel/opiekun moga miec etykiety — dla ucznia
    // fetch zwroci pusta liste (RLS przepuszcza SELECT own, ale uczen
    // nie ma zadnych wpisow jako labeler). Graceful degradation gdy
    // migracja add-user-labels.sql nie zostala uruchomiona.
    _myLabels = {};
    try {
      const { data: lblData, error: lblErr } = await supabase
        .from('user_labels').select('target_user_id, label').eq('labeler_id', _userId);
      if (!lblErr && lblData) {
        lblData.forEach(r => { _myLabels[r.target_user_id] = r.label; });
      }
    } catch(e) {
      // tabela jeszcze nie istnieje — OK, pusta mapa
    }

    // Jeśli admin — załaduj też prośby
    if (_profile.isAdmin) {
      const { data: reqData } = await supabase
        .from('admin_requests')
        .select('*')
        .order('created_at', { ascending: false });
      _adminRequests = reqData || [];
    }

    return _profile;
  }

  // ═══════════════════════════════════════════════════════════════
  //  AUTH — używane przez index.html
  // ═══════════════════════════════════════════════════════════════

  /**
   * Loguje użytkownika. Rzuca wyjątek przy błędzie.
   * Zwraca nazwę użytkownika.
   */
  async function login(username, password) {
    const email = `${username}@sowie-fiszki.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === 'email_not_confirmed' || error.message.includes('Email not confirmed'))
        throw new Error('Konto wymaga potwierdzenia e-mail. Wyłącz "Confirm email" w Supabase → Auth → Providers → Email.');
      throw new Error('Nieprawidłowa nazwa użytkownika lub hasło.');
    }
    // Sprawdź, czy profil istnieje (maybeSingle nie rzuca błędu gdy brak wiersza)
    const { data: prof } = await supabase
      .from('profiles').select('username').eq('id', data.user.id).maybeSingle();
    if (!prof || prof.username !== username)
      throw new Error('Nieprawidłowa nazwa użytkownika lub hasło.');
    return username;
  }

  /**
   * Rejestruje nowego użytkownika. Rzuca wyjątek przy błędzie.
   */
  async function register(username, password) {
    // Sprawdź unikalność nazwy
    const { data: exists } = await supabase.rpc('check_username_exists', { p_username: username });
    if (exists) throw new Error('Ta nazwa jest już zajęta.');

    const email = `${username}@sowie-fiszki.app`;
    // Przekaż username w metadanych — trigger handle_new_user() użyje tego do stworzenia profilu
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } }
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Rejestracja nieudana — spróbuj ponownie.');

    // Profil tworzony automatycznie przez trigger on_auth_user_created.
    return username;
  }

  /**
   * Wylogowuje użytkownika.
   */
  async function logout() {
    await supabase.auth.signOut();
    _profile = null;
    _userId  = null;
    _adminRequests = [];
  }

  // ═══════════════════════════════════════════════════════════════
  //  ODCZYT (synchroniczny — z bufora)
  // ═══════════════════════════════════════════════════════════════

  function getUser(username) {
    return _profile || emptyProfile(username);
  }

  function getAccounts() {
    // Kompatybilność — nie używane przy Supabase; zwraca pusty obiekt
    return {};
  }

  // ═══════════════════════════════════════════════════════════════
  //  XP / POZIOM
  // ═══════════════════════════════════════════════════════════════
  function setXP(username, totalXP, level) {
    if (!_profile) return;
    _profile.xp    = totalXP;
    _profile.level = level;
    _save();
  }

  // ═══════════════════════════════════════════════════════════════
  //  POSTĘP JEDNOSTKI
  // ═══════════════════════════════════════════════════════════════
  function saveUnitProgress(username, bookId, unitKey, wordStates, knownCount, total) {
    if (!_profile || !_userId) return;
    const key = `${bookId}__${unitKey}`;
    _profile.unitProgress[key] = {
      wordStates, knownCount, total, lastStudied: Date.now()
    };
    // Zapis w tle — UPSERT
    supabase.from('unit_progress').upsert({
      user_id:      _userId,
      book_key:     bookId,
      unit_key:     unitKey,
      word_states:  wordStates,
      known_count:  knownCount,
      total,
      last_studied: Date.now()
    }, { onConflict: 'user_id,book_key,unit_key' }).then(({ error }) => {
      if (error) console.warn('[DB] Błąd zapisu postępu:', error.message);
    });
  }

  function getUnitProgress(username, bookId, unitKey) {
    if (!_profile) return null;
    return _profile.unitProgress[`${bookId}__${unitKey}`] || null;
  }

  function getBookProgress(username, book) {
    if (!_profile) return {};
    const result = {};
    Object.keys(book.units).forEach(uk => {
      const saved = _profile.unitProgress[`${book.id}__${uk}`];
      const total = book.units[uk].words.length;
      const known = saved ? (saved.knownCount || 0) : 0;
      result[uk] = { known, total, pct: total > 0 ? Math.round((known / total) * 100) : 0 };
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  //  KOLEJKA POWTOREK — slowa z nextReview <= now
  // ═══════════════════════════════════════════════════════════════
  // Zwraca obiekt:
  //   {
  //     totalDue: liczba slow do powtorki teraz,
  //     unitsDue: [{ bookId, unitKey, count }, ...] (posortowane malejaco po count),
  //     nextDueDays: ile dni do najblizszej powtorki (gdy totalDue=0)
  //   }
  // Iteruje po wszystkich zapisanych unit_progress dla zalogowanego usera.
  function getReviewQueue() {
    if (!_profile || !_profile.unitProgress) return { totalDue: 0, unitsDue: [], nextDueDays: null };
    const now = Date.now();
    let totalDue = 0;
    let nextReviewMin = null;
    const perUnit = [];
    Object.entries(_profile.unitProgress).forEach(([key, prog]) => {
      const ws = prog && prog.wordStates;
      if (!ws) return;
      const [bookId, unitKey] = key.split('__');
      // Tylko slowa, ktore juz byly cwiczone (reps>0) i nadeszly do powtorki.
      // Slowa z reps=0 sa "nowe" — nie liczymy ich do kolejki, bo nigdy nie
      // mialy wlasciwego nextReview (lub byly pomylone i lecza sie od zera).
      let count = 0;
      Object.values(ws).forEach(s => {
        if (!s || typeof s !== 'object') return;
        if ((s.reps || 0) < 1) return; // pomijamy nowe i pomylone
        if (s.nextReview && s.nextReview <= now) {
          count++;
        } else if (s.nextReview && (nextReviewMin === null || s.nextReview < nextReviewMin)) {
          nextReviewMin = s.nextReview;
        }
      });
      if (count > 0) {
        totalDue += count;
        perUnit.push({ bookId, unitKey, count });
      }
    });
    perUnit.sort((a, b) => b.count - a.count);
    let nextDueDays = null;
    if (totalDue === 0 && nextReviewMin !== null) {
      nextDueDays = Math.max(0, Math.ceil((nextReviewMin - now) / 86400000));
    }
    return { totalDue, unitsDue: perUnit, nextDueDays };
  }

  // ═══════════════════════════════════════════════════════════════
  //  SERIA DNI
  // ═══════════════════════════════════════════════════════════════
  function updateStreak(username) {
    if (!_profile) return {};
    const today     = new Date().toDateString();
    if (_profile.lastStudyDate === today) return _profile;
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    _profile.streak        = _profile.lastStudyDate === yesterday ? (_profile.streak || 0) + 1 : 1;
    _profile.longestStreak = Math.max(_profile.streak, _profile.longestStreak || 0);
    _profile.lastStudyDate = today;
    _profile.totalSessions = (_profile.totalSessions || 0) + 1;
    _save();
    return _profile;
  }

  // ═══════════════════════════════════════════════════════════════
  //  STATYSTYKI ODPOWIEDZI
  // ═══════════════════════════════════════════════════════════════
  function recordAnswer(username, correct) {
    if (!_profile) return;
    _profile.totalAnswers = (_profile.totalAnswers || 0) + 1;
    if (correct) _profile.correctAnswers = (_profile.correctAnswers || 0) + 1;
    _save();
  }

  // ═══════════════════════════════════════════════════════════════
  //  DZIENNY CEL XP
  // ═══════════════════════════════════════════════════════════════
  function getDailyXP(username) {
    if (!_profile) return 0;
    const today = new Date().toDateString();
    if (_profile.dailyXPDate !== today) return 0;
    return _profile.dailyXP || 0;
  }

  function addDailyXP(username, amount) {
    if (!_profile) return { prev: 0, now: 0 };
    const today = new Date().toDateString();
    if (_profile.dailyXPDate !== today) { _profile.dailyXP = 0; _profile.dailyXPDate = today; }
    const prev     = _profile.dailyXP || 0;
    _profile.dailyXP = prev + amount;
    _save();
    // Log do historii (Premium chart) — fire-and-forget
    if (amount > 0 && _userId) {
      supabase.rpc('log_daily_xp', { p_delta: amount }).then(() => {}).catch(e => {
        console.warn('[log_daily_xp]', e.message || e);
      });
    }
    return { prev, now: _profile.dailyXP };
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORIA XP (Premium — wykres 12 miesiecy)
  // Zwraca rowniez minutes + first_active_at (kolumny dodane migracja
  // add-study-minutes.sql). Jesli migracja nie zostala uruchomiona,
  // kolumny nie istnieja — lapiemy blad i fallback do samego XP.
  // ═══════════════════════════════════════════════════════════════
  async function getDailyXpHistory(userId, days) {
    const uid = userId || _userId;
    if (!uid) return [];
    const d = Math.max(1, Math.min(400, days || 365));
    const from = new Date(); from.setDate(from.getDate() - d);
    const fromStr = from.toISOString().slice(0, 10);
    let res = await supabase
      .from('daily_xp_log')
      .select('day, xp, minutes, first_active_at')
      .eq('user_id', uid)
      .gte('day', fromStr)
      .order('day', { ascending: true });
    if (res.error) {
      // Fallback: stary schemat bez minutes/first_active_at
      res = await supabase
        .from('daily_xp_log')
        .select('day, xp')
        .eq('user_id', uid)
        .gte('day', fromStr)
        .order('day', { ascending: true });
      if (res.error) throw new Error(res.error.message);
    }
    return res.data || [];
  }

  // Loguje N minut nauki w dzisiejszym dniu (heartbeat co 60 s).
  // Fire-and-forget — nie blokuje UI jesli brak polaczenia.
  async function logStudyMinutes(minutes) {
    if (!_userId) return;
    const n = Math.max(1, Math.min(10, minutes || 1));
    try {
      const { error } = await supabase.rpc('log_study_minutes', { p_minutes: n });
      if (error) console.warn('[logStudyMinutes]', error.message);
    } catch(e) {
      console.warn('[logStudyMinutes]', e.message || e);
    }
  }

  // Uczniowie nieaktywni (dla nauczyciela — created_by = self)
  async function getInactiveStudents(days) {
    try {
      if (!_userId) return [];
      if (!_profile?.isTeacher && !_profile?.isAdmin) return [];
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - Math.max(1, days || 30));
      let q = supabase
        .from('profiles')
        .select('id, username, last_study_date, daily_xp, created_by')
        .eq('is_admin', false)
        .eq('is_teacher', false);
      // is_parent istnieje tylko po migracji add-parent-role.sql — jesli brak kolumny,
      // filtr rzuci blad. Lapiemy i filtrujemy klient-side.
      try { q = q.eq('is_parent', false); } catch(e) {}
      if (!_profile.isAdmin) q = q.eq('created_by', _userId);
      const { data, error } = await q;
      if (error) { console.warn('[getInactiveStudents]', error.message); return []; }
      return (data || []).filter(p => {
        if (!p.last_study_date) return true;   // nigdy sie nie uczyl
        return new Date(p.last_study_date) < threshold;
      });
    } catch(e) {
      console.warn('[getInactiveStudents]', e.message || e);
      return [];
    }
  }

  // Auto-usun konta uczniow nieaktywnych >= 1 rok (admin-only RPC).
  // Zwraca liczbe usunietych kont. Nie wywala sie przy braku uprawnien — warn + 0.
  async function autoDeleteInactiveUsers() {
    if (!_profile?.isAdmin) return 0;
    try {
      const { data, error } = await supabase.rpc('auto_delete_inactive_users');
      if (error) { console.warn('[auto_delete_inactive_users]', error.message); return 0; }
      return Number(data) || 0;
    } catch(e) { console.warn('[auto_delete_inactive_users]', e.message || e); return 0; }
  }

  // Dzieci nieaktywne (dla opiekuna)
  async function getInactiveChildren(days) {
    try {
      if (!_userId || !_profile?.isParent) return [];
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - Math.max(1, days || 30));
      const { data: rels, error: rErr } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', _userId);
      if (rErr) { console.warn('[getInactiveChildren]', rErr.message); return []; }
      const ids = (rels || []).map(r => r.child_id);
      if (!ids.length) return [];
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, username, last_study_date, daily_xp')
        .in('id', ids);
      if (error) { console.warn('[getInactiveChildren]', error.message); return []; }
      return (profiles || []).filter(p => {
        if (!p.last_study_date) return true;
        return new Date(p.last_study_date) < threshold;
      });
    } catch(e) {
      console.warn('[getInactiveChildren]', e.message || e);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ODZNAKI
  // ═══════════════════════════════════════════════════════════════
  function unlockAchievement(username, id) {
    if (!_profile) return false;
    if (!_profile.achievements) _profile.achievements = [];
    if (_profile.achievements.includes(id)) return false;
    _profile.achievements.push(id);
    _save();
    return true;
  }

  function getAchievements(username) {
    return _profile ? (_profile.achievements || []) : [];
  }

  // ═══════════════════════════════════════════════════════════════
  //  SPEED CHALLENGE
  // ═══════════════════════════════════════════════════════════════
  function saveSpeedScore(username, score) {
    if (!_profile) return 0;
    if (score > (_profile.speedBest || 0)) { _profile.speedBest = score; _save(); }
    return _profile.speedBest || 0;
  }

  function getSpeedBest(username) {
    return _profile ? (_profile.speedBest || 0) : 0;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ADMIN
  // ═══════════════════════════════════════════════════════════════
  function isAdmin(username) {
    return _profile ? (_profile.isAdmin === true) : false;
  }

  function isTeacher(username) {
    return _profile ? (_profile.isTeacher === true || _profile.isAdmin === true) : false;
  }

  function getUserPlan() {
    if (!_profile) return 'free';
    if (_profile.isAdmin) return 'teacher'; // admin = pełny dostęp
    if (_profile.isTeacher) return _profile.plan === 'free' ? 'teacher' : _profile.plan;
    return _profile.plan || 'free';
  }

  async function setUserPlan(userId, plan) {
    if (!_profile?.isAdmin) throw new Error('Brak uprawnień');
    // Plan 'teacher' automatycznie nadaje rolę nauczyciela (is_teacher=true);
    // pozostałe plany (free/premium) ją zdejmują. is_admin pozostaje bez zmian.
    const updates = { plan, is_teacher: plan === 'teacher' };
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, plan, is_teacher');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error('Nie udało się zapisać planu — sprawdź uprawnienia (RLS) w bazie.');
    }
    return data[0];
  }

  function getAdminRequests() {
    return _adminRequests;
  }

  /**
   * Wysyła prośbę o uprawnienia admina przez funkcję SECURITY DEFINER
   * (działa też bez zalogowanego użytkownika — ze strony logowania).
   * Rzuca wyjątek przy błędzie. Zwraca false jeśli prośba już istnieje.
   */
  async function addAdminRequest(username) {
    const { data: result, error } = await supabase
      .rpc('submit_admin_request', { p_username: username });
    if (error) throw new Error(error.message);
    if (result === 'not_found')      throw new Error('Nie znaleziono użytkownika o takiej nazwie.');
    if (result === 'already_admin')  throw new Error('To konto już ma uprawnienia administratora!');
    if (result === 'already_pending') return false;
    return true; // 'ok'
  }

  /**
   * Admin: zatwierdź prośbę. Używa funkcji RPC z SECURITY DEFINER.
   */
  async function approveAdminRequest(username) {
    const req = _adminRequests.find(r => r.username === username && r.status === 'pending');
    if (!req) return;
    const { error } = await supabase.rpc('approve_admin_request', { p_request_id: req.id });
    if (error) { console.warn('[DB] approveAdminRequest:', error.message); return; }
    // Zaktualizuj bufor
    req.status = 'approved';
  }

  /**
   * Admin: odrzuć prośbę.
   */
  async function rejectAdminRequest(username) {
    const req = _adminRequests.find(r => r.username === username && r.status === 'pending');
    if (!req) return;
    const { error } = await supabase.rpc('reject_admin_request', { p_request_id: req.id });
    if (error) { console.warn('[DB] rejectAdminRequest:', error.message); return; }
    req.status = 'rejected';
  }

  function getPendingRequestsCount() {
    return _adminRequests.filter(r => r.status === 'pending').length;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ADMIN — ZARZĄDZANIE TREŚCIĄ (słówka, podręczniki, rozdziały)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ładuje dane admina z Supabase i aplikuje do globalnego BOOKS.
   * Wywoływać raz przy starcie (dla wszystkich użytkowników — SELECT jest publiczny).
   */
  async function loadAdminData() {
    const [bRes, uRes, wRes] = await Promise.all([
      supabase.from('admin_books').select('*').order('updated_at'),
      supabase.from('admin_units').select('*').order('updated_at'),
      supabase.from('admin_words').select('*').order('updated_at')
    ]);
    _adminBooks = bRes.data || [];
    _adminUnits = uRes.data || [];
    _adminWords = wRes.data || [];
    _applyAdminData();
  }

  function _applyAdminData() {
    // 1. Nowe podręczniki → dodaj do BOOKS
    _adminBooks.forEach(row => {
      if (!BOOKS[row.book_id]) {
        BOOKS[row.book_id] = {
          id: row.book_id, name: row.name, shortName: row.short_name || row.name,
          icon: row.icon || '📖', color: row.color || '#a29bfe',
          description: row.description || '', lang: row.lang || 'en-GB',
          units: {}, _isAdminBook: true
        };
      }
    });

    // 2. Nowe rozdziały → dodaj do BOOKS[bookId].units
    _adminUnits.forEach(row => {
      if (!BOOKS[row.book_id]) return;
      if (!BOOKS[row.book_id].units[row.unit_key]) {
        BOOKS[row.book_id].units[row.unit_key] = {
          name: row.name, icon: row.icon || '📖',
          color: row.color || '#a29bfe', words: [], _isAdminUnit: true
        };
      }
    });

    // 3. Zmiany słówek (nowe / edycje / usunięcia)
    _adminWords.forEach(row => {
      if (!BOOKS[row.book_id]) return;
      const unit = BOOKS[row.book_id].units[row.unit_key];
      if (!unit) return;
      const words = unit.words;

      if (row.original_pl) {
        // Edycja lub usunięcie słówka z data.js
        const idx = words.findIndex(w => w[0] === row.original_pl);
        if (idx !== -1) {
          if (row.is_deleted) words.splice(idx, 1);
          else words[idx] = [row.word_pl, row.word_target];
        }
      } else if (!row.is_deleted) {
        // Nowe słówko — dodaj jeśli nie duplikat
        if (!words.find(w => w[0] === row.word_pl)) {
          words.push([row.word_pl, row.word_target]);
        }
      }
    });
  }

  // ── Słówka ──────────────────────────────────────────────────

  async function adminAddWord(bookId, unitKey, wordPl, wordTarget) {
    const { data, error } = await supabase.from('admin_words').insert({
      book_id: bookId, unit_key: unitKey, word_pl: wordPl, word_target: wordTarget,
      original_pl: null, is_deleted: false, created_by: _userId, updated_at: new Date().toISOString()
    }).select().single();
    if (error) throw new Error(error.message);
    _adminWords.push(data);
    const words = BOOKS[bookId]?.units[unitKey]?.words;
    if (words && !words.find(w => w[0] === wordPl)) words.push([wordPl, wordTarget]);
  }

  async function adminEditWord(bookId, unitKey, originalPl, newPl, newTarget) {
    const existing = _adminWords.find(w =>
      w.book_id === bookId && w.unit_key === unitKey &&
      (w.word_pl === originalPl || w.original_pl === originalPl) && !w.is_deleted
    );
    if (existing) {
      const { error } = await supabase.from('admin_words').update({
        word_pl: newPl, word_target: newTarget, is_deleted: false, updated_at: new Date().toISOString()
      }).eq('id', existing.id);
      if (error) throw new Error(error.message);
      existing.word_pl = newPl; existing.word_target = newTarget;
    } else {
      const { data, error } = await supabase.from('admin_words').insert({
        book_id: bookId, unit_key: unitKey, word_pl: newPl, word_target: newTarget,
        original_pl: originalPl, is_deleted: false, created_by: _userId, updated_at: new Date().toISOString()
      }).select().single();
      if (error) throw new Error(error.message);
      _adminWords.push(data);
    }
    const words = BOOKS[bookId]?.units[unitKey]?.words;
    if (words) { const i = words.findIndex(w => w[0] === originalPl); if (i !== -1) words[i] = [newPl, newTarget]; }
  }

  async function adminDeleteWord(bookId, unitKey, wordPl) {
    // Sprawdź czy to słówko dodane przez admina (bez original_pl)
    const adminAdded = _adminWords.find(w =>
      w.book_id === bookId && w.unit_key === unitKey && w.word_pl === wordPl && !w.original_pl && !w.is_deleted
    );
    if (adminAdded) {
      const { error } = await supabase.from('admin_words').delete().eq('id', adminAdded.id);
      if (error) throw new Error(error.message);
      _adminWords = _adminWords.filter(w => w.id !== adminAdded.id);
    } else {
      // Słówko z data.js — oznacz jako usunięte
      const existing = _adminWords.find(w =>
        w.book_id === bookId && w.unit_key === unitKey && w.original_pl === wordPl
      );
      if (existing) {
        const { error } = await supabase.from('admin_words').update({
          is_deleted: true, updated_at: new Date().toISOString()
        }).eq('id', existing.id);
        if (error) throw new Error(error.message);
        existing.is_deleted = true;
      } else {
        const { data, error } = await supabase.from('admin_words').insert({
          book_id: bookId, unit_key: unitKey, word_pl: '', word_target: '',
          original_pl: wordPl, is_deleted: true, created_by: _userId, updated_at: new Date().toISOString()
        }).select().single();
        if (error) throw new Error(error.message);
        _adminWords.push(data);
      }
    }
    const words = BOOKS[bookId]?.units[unitKey]?.words;
    if (words) { const i = words.findIndex(w => w[0] === wordPl); if (i !== -1) words.splice(i, 1); }
  }

  // ── Podręczniki ──────────────────────────────────────────────

  async function adminAddBook(bookId, name, shortName, icon, color, description, lang) {
    const { data, error } = await supabase.from('admin_books').insert({
      book_id: bookId, name, short_name: shortName || name,
      icon: icon || '📖', color: color || '#a29bfe', description: description || '', lang: lang || 'en-GB',
      created_by: _userId, updated_at: new Date().toISOString()
    }).select().single();
    if (error) throw new Error(error.message);
    _adminBooks.push(data);
    BOOKS[bookId] = {
      id: bookId, name, shortName: shortName || name,
      icon: icon || '📖', color: color || '#a29bfe', description: description || '', lang: lang || 'en-GB',
      units: {}, _isAdminBook: true
    };
  }

  // ── Rozdziały ────────────────────────────────────────────────

  async function adminAddUnit(bookId, unitKey, name, icon, color) {
    const { data, error } = await supabase.from('admin_units').insert({
      book_id: bookId, unit_key: unitKey, name,
      icon: icon || '📖', color: color || '#a29bfe',
      created_by: _userId, updated_at: new Date().toISOString()
    }).select().single();
    if (error) throw new Error(error.message);
    _adminUnits.push(data);
    if (BOOKS[bookId]) {
      BOOKS[bookId].units[unitKey] = { name, icon: icon || '📖', color: color || '#a29bfe', words: [], _isAdminUnit: true };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ZDANIA PRZYKŁADOWE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Wczytuje zdania dla danego podręcznika do lokalnego cache.
   * Wywołuj fire-and-forget przy wyborze podręcznika.
   */
  async function loadSentences(bookId) {
    const { data, error } = await supabase
      .from('word_sentences')
      .select('word_pl, sentence_pl, sentence_target, image_url')
      .eq('book_id', bookId);
    if (error) { console.warn('[DB] loadSentences:', error.message); return; }
    (data || []).forEach(row => {
      _sentences[bookId + '__' + row.word_pl] = {
        sentence_pl:     row.sentence_pl,
        sentence_target: row.sentence_target,
        image_url:       row.image_url || ''
      };
    });
  }

  /** Zwraca zdanie z cache (synchronicznie). */
  function getSentence(bookId, wordPl) {
    return _sentences[bookId + '__' + wordPl] || null;
  }

  /** Admin: zapisuje / aktualizuje zdanie (UPSERT). */
  async function saveSentence(bookId, wordPl, sentencePl, sentenceTarget, imageUrl) {
    const payload = {
      book_id:         bookId,
      word_pl:         wordPl,
      sentence_pl:     sentencePl,
      sentence_target: sentenceTarget,
      updated_by:      _userId,
      updated_at:      new Date().toISOString()
    };
    if (imageUrl !== undefined) payload.image_url = imageUrl || '';
    const { error } = await supabase.from('word_sentences').upsert(payload, { onConflict: 'book_id,word_pl' });
    if (error) throw new Error(error.message);
    _sentences[bookId + '__' + wordPl] = { sentence_pl: sentencePl, sentence_target: sentenceTarget, image_url: imageUrl || '' };
  }

  // ═══════════════════════════════════════════════════════════════
  //  FLUSH — wymuś zapis przed wylogowaniem (await!)
  // ═══════════════════════════════════════════════════════════════
  async function flush() {
    if (!_profile || !_userId) return;
    clearTimeout(_saveTimer); // anuluj oczekujący debounce
    const { error } = await supabase.from('profiles')
      .upsert(_profilePayload(), { onConflict: 'id' });
    if (error) console.warn('[DB] Flush error:', error.message);
  }

  // ── Admin: Zarządzanie klasami ──────────────────────────────────

  // ═══════════════════════════════════════════════════════════════
  //  BOOK ACCESS REQUESTS — prośby ucznia o dostęp do podręcznika
  // ═══════════════════════════════════════════════════════════════

  async function requestBookAccess({ book_id, school_type, grade, student_name, message }) {
    if (!_userId) throw new Error('Musisz być zalogowany.');
    if (!student_name || !student_name.trim()) {
      throw new Error('Podaj swoje imię i nazwisko — jest wymagane, aby administrator mógł Cię zidentyfikować.');
    }
    const payload = {
      user_id: _userId,
      book_id,
      school_type: school_type || null,
      grade: grade || null,
      student_name: student_name.trim(),
      message: message || null,
      status: 'pending'
    };
    const { data, error } = await supabase
      .from('book_access_requests')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function listMyBookAccessRequests() {
    if (!_userId) return [];
    const { data, error } = await supabase
      .from('book_access_requests')
      .select('id, book_id, school_type, grade, status, created_at, reviewed_at')
      .eq('user_id', _userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  // Tylko admin — nauczyciel nie widzi próśb (zmiana wobec poprzedniej wersji)
  async function listAllBookAccessRequests(status) {
    if (!_profile?.isAdmin) return [];
    let q = supabase
      .from('book_access_requests')
      .select('id, user_id, book_id, school_type, grade, student_name, message, status, created_at, reviewed_at');
    if (status) q = q.eq('status', status);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }

  // Akceptacja prośby o dostęp. Wykonuje się bezpośrednio z klienta
  // (zamiast RPC), żeby uniknąć problemów z wdrożeniem migracji SQL —
  // używamy polityk RLS „admin UPDATE" na book_access_requests i
  // admin INSERT na user_books. Weryfikujemy, że UPDATE faktycznie
  // zmienił wiersz (dzięki `.select()`), żeby ujawnić ciche błędy.
  async function approveBookAccessRequest(requestId) {
    if (!_profile?.isAdmin) throw new Error('Tylko administrator może rozpatrywać prośby.');
    if (!requestId) throw new Error('Brak ID prośby.');

    // 1) Pobierz szczegóły prośby
    const { data: req, error: qErr } = await supabase
      .from('book_access_requests')
      .select('id, user_id, book_id, status')
      .eq('id', requestId)
      .maybeSingle();
    if (qErr) throw new Error('Nie udało się wczytać prośby: ' + qErr.message);
    if (!req) throw new Error('Prośba nie istnieje.');
    if (req.status !== 'pending') throw new Error('Prośba została już rozpatrzona (status: ' + req.status + ').');

    // 2) Nadaj dostęp do podręcznika. Jeśli już istnieje — ignoruj duplikat.
    const { error: ubErr } = await supabase
      .from('user_books')
      .insert({ user_id: req.user_id, book_id: req.book_id });
    if (ubErr && !/duplicate|unique|already/i.test(ubErr.message)) {
      throw new Error('Nie udało się nadać dostępu do podręcznika: ' + ubErr.message);
    }

    // 3) Zmień status prośby. Weryfikujemy, że UPDATE dotknął wiersza.
    const { data: updated, error: upErr } = await supabase
      .from('book_access_requests')
      .update({ status: 'approved', reviewed_by: _userId, reviewed_at: new Date().toISOString() })
      .eq('id', requestId)
      .select('id, status');
    if (upErr) throw new Error('Nie udało się zaktualizować statusu: ' + upErr.message);
    if (!updated || updated.length === 0) {
      throw new Error('UPDATE nie zmienił żadnego wiersza — sprawdź polityki RLS (polityka „bar: admin UPDATE").');
    }
    return updated[0];
  }

  async function rejectBookAccessRequest(requestId) {
    if (!_profile?.isAdmin) throw new Error('Tylko administrator może rozpatrywać prośby.');
    const { error } = await supabase
      .from('book_access_requests')
      .update({ status: 'rejected', reviewed_by: _userId, reviewed_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) throw new Error(error.message);
  }

  async function countPendingBookAccessRequests() {
    if (!_profile?.isAdmin) return 0;
    const { count, error } = await supabase
      .from('book_access_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) return 0;
    return count || 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // WORD ERROR REPORTS — zgłoszenia błędów w słówkach
  // ═══════════════════════════════════════════════════════════════
  async function createWordErrorReport({ bookId, unitKey, wordPl, wordTarget, description }) {
    if (!_userId) throw new Error('Musisz być zalogowany, aby zgłosić błąd.');
    if (!description || !description.trim()) throw new Error('Brak opisu błędu.');
    const payload = {
      reporter_id: _userId,
      reporter_username: _profile?.username || null,
      book_id: bookId || null,
      unit_key: unitKey || null,
      word_pl: wordPl || null,
      word_target: wordTarget || null,
      description: description.trim()
    };
    const { data, error } = await supabase
      .from('word_error_reports')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function listWordErrorReports(status) {
    if (!_profile?.isAdmin) return [];
    let q = supabase
      .from('word_error_reports')
      .select('id, reporter_id, reporter_username, book_id, unit_key, word_pl, word_target, description, status, created_at, resolved_at');
    if (status) q = q.eq('status', status);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function resolveWordErrorReport(reportId) {
    if (!_profile?.isAdmin) throw new Error('Tylko administrator może oznaczać zgłoszenia.');
    const { data, error } = await supabase
      .from('word_error_reports')
      .update({ status: 'resolved', resolved_by: _userId, resolved_at: new Date().toISOString() })
      .eq('id', reportId)
      .select('id, status');
    if (error) throw new Error(error.message);
    if (!data || !data.length) throw new Error('Brak uprawnień do aktualizacji (RLS).');
    return data[0];
  }

  async function deleteWordErrorReport(reportId) {
    if (!_profile?.isAdmin) throw new Error('Tylko administrator może usuwać zgłoszenia.');
    const { error } = await supabase
      .from('word_error_reports')
      .delete()
      .eq('id', reportId);
    if (error) throw new Error(error.message);
  }

  async function countPendingWordErrorReports() {
    if (!_profile?.isAdmin) return 0;
    const { count, error } = await supabase
      .from('word_error_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) return 0;
    return count || 0;
  }

  // ═══════════════════════════════════════════════════════════
  // PARENT / OPIEKUN — relacja parent_children + zarzadzanie dziecmi
  // ═══════════════════════════════════════════════════════════
  // Limity planu Free (Nauczyciel/Opiekun). Admin + Premium nie podlegają.
  const FREE_LIMITS = Object.freeze({
    MAX_CLASSES: 8,
    MAX_STUDENTS_PER_CLASS: 30,
    MAX_TEACHER_SETS: 10
  });
  function _isFreeCreator() {
    if (_profile?.isAdmin) return false;
    if (isPremium()) return false;
    return !!(_profile?.isTeacher || _profile?.isParent);
  }
  function getFreeLimits() { return FREE_LIMITS; }

  function isParent() { return _profile?.isParent === true; }
  function isPremium() {
    if (!_profile) return false;
    // Admin ma pelny dostep z racji roli — traktujemy jak permanentne premium
    if (_profile.isAdmin) return true;
    if (_profile.plan !== 'premium') return false;
    // Bez daty wygasniecia = permanent premium (np. nadany recznie przez admina)
    if (!_profile.planExpiresAt) return true;
    return new Date(_profile.planExpiresAt) > new Date();
  }

  // Info o dacie wygasniecia planu: { daysLeft, expiresAt, isTrial } albo null
  function getPlanExpiryInfo() {
    if (!_profile) return null;
    // Admin nie ma wygasania — rola daje pelny dostep
    if (_profile.isAdmin) return null;
    if (_profile.plan !== 'premium' || !_profile.planExpiresAt) return null;
    const now = new Date();
    const exp = new Date(_profile.planExpiresAt);
    const diffMs = exp.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    // Trial: trial_used_at jest ustawiony i plan_expires_at = trial_used_at + ~7 dni (+/- 1h)
    let isTrial = false;
    if (_profile.trialUsedAt) {
      const trialStart = new Date(_profile.trialUsedAt);
      const diffFromTrial = exp.getTime() - trialStart.getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      isTrial = Math.abs(diffFromTrial - sevenDaysMs) < 60 * 60 * 1000;
    }
    return { daysLeft, expiresAt: exp, isTrial };
  }

  function hasUsedTrial() { return _profile?.trialUsedAt != null; }

  // Aktywuje 7-dniowy trial (RPC). Zwraca nowa date wygasniecia lub null.
  async function activateTrialIfEligible() {
    if (!_userId || !_profile) return null;
    if (_profile.isAdmin) return null;       // admin ma pelny dostep z racji roli
    if (_profile.trialUsedAt) return null;   // juz wykorzystany
    if (_profile.plan === 'premium') return null;  // juz ma premium
    try {
      const { data, error } = await supabase.rpc('activate_trial');
      if (error) { console.warn('[activate_trial]', error.message); return null; }
      if (data) {
        _profile.plan = 'premium';
        _profile.planExpiresAt = data;
        _profile.trialUsedAt = new Date().toISOString();
      }
      return data;
    } catch (e) { console.warn('[activate_trial]', e.message); return null; }
  }

  // Client-side downgrade, jesli plan Premium wygasnal. Zwraca true jesli
  // zmodyfikowal profil.
  async function downgradePlanIfExpired() {
    if (!_userId || !_profile) return false;
    if (_profile.plan !== 'premium') return false;
    if (!_profile.planExpiresAt) return false;  // permanent
    const exp = new Date(_profile.planExpiresAt);
    if (exp > new Date()) return false;  // jeszcze aktywny
    const { error } = await supabase
      .from('profiles')
      .update({ plan: 'free', plan_expires_at: null })
      .eq('id', _userId);
    if (error) { console.warn('[downgrade]', error.message); return false; }
    _profile.plan = 'free';
    _profile.planExpiresAt = null;
    return true;
  }

  // Admin: przedluz plan Premium uzytkownikowi o X miesiecy (RPC).
  async function adminExtendPremium(userId, months) {
    const { data, error } = await supabase.rpc('admin_extend_premium', {
      p_user_id: userId, p_months: months
    });
    if (error) throw new Error(error.message);
    return data;
  }

  // Pobierz dowolny profil po ID (uzywane przez opiekuna do widoku
  // postepu dziecka — RLS pozwala dzieki polityce prof_select_parent_child).
  async function fetchProfileById(userId) {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, daily_xp, plan, xp, level, streak, total_sessions, total_answers, correct_answers, last_study_date, plan_expires_at, is_admin, is_teacher')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[fetchProfileById]', error.message);
      return null;
    }
    return data || null;
  }

  async function listMyChildren() {
    if (!_userId) return [];
    const { data: rels, error } = await supabase
      .from('parent_children')
      .select('id, child_id, created_at')
      .eq('parent_id', _userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    if (!rels || !rels.length) return [];
    const childIds = rels.map(r => r.child_id);
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, username, daily_xp, plan, xp, level, streak, total_sessions, total_answers, correct_answers, last_study_date, plan_expires_at, is_admin, is_teacher')
      .in('id', childIds);
    if (pErr) throw new Error(pErr.message);
    const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    return rels.map(r => ({
      relationId: r.id,
      childId: r.child_id,
      createdAt: r.created_at,
      profile: byId[r.child_id] || null
    }));
  }

  async function findUserByUsername(username) {
    const uname = (username || '').trim();
    if (!uname) return null;
    const { data, error } = await supabase.rpc('find_user_by_username', { p_username: uname });
    if (error) throw new Error(error.message);
    if (!data || !data.length) return null;
    return data[0];
  }

  async function addChild(childUserId) {
    if (!_userId) throw new Error('Nie zalogowany.');
    if (!_profile?.isParent) throw new Error('Tylko opiekun moze dodawac dzieci.');
    if (childUserId === _userId) throw new Error('Nie mozesz dodac siebie jako dziecka.');
    // Uzywamy RPC parent_add_child (SECURITY DEFINER) — omija problem
    // rekurencji RLS profiles<->parent_children. Migracja: fix-parent-add-child.sql
    const { error } = await supabase.rpc('parent_add_child', { p_child_id: childUserId });
    if (error) {
      // Fallback: stary direct insert (gdyby RPC jeszcze nie zostalo zainstalowane)
      const { error: insErr } = await supabase
        .from('parent_children')
        .insert({ parent_id: _userId, child_id: childUserId });
      if (insErr) {
        if (insErr.code === '23505') throw new Error('To dziecko juz jest przypisane.');
        // Zwracamy oryginalny blad RPC (zwykle bardziej opisowy)
        throw new Error(error.message || insErr.message);
      }
    }
  }

  async function removeChild(relationId) {
    if (!_userId) throw new Error('Nie zalogowany.');
    const { error } = await supabase
      .from('parent_children')
      .delete()
      .eq('id', relationId)
      .eq('parent_id', _userId);
    if (error) throw new Error(error.message);
  }

  async function parentAssignBookToChild(childId, bookId) {
    const { error } = await supabase.rpc('parent_assign_book_to_child', {
      p_child_id: childId, p_book_id: bookId
    });
    if (error) throw new Error(error.message);
  }

  async function parentUnassignBookFromChild(childId, bookId) {
    const { error } = await supabase.rpc('parent_unassign_book_from_child', {
      p_child_id: childId, p_book_id: bookId
    });
    if (error) throw new Error(error.message);
  }

  async function getChildUserBooks(childId) {
    if (!_userId) return [];
    const { data, error } = await supabase
      .from('user_books')
      .select('book_id')
      .eq('user_id', childId);
    if (error) throw new Error(error.message);
    return (data || []).map(r => r.book_id);
  }

  // ═══════════════════════════════════════════════════════════
  // WIADOMOSCI: konwersacje user ↔ admin
  // ═══════════════════════════════════════════════════════════
  async function createConversation(subject, body) {
    if (!_userId) throw new Error('Musisz byc zalogowany.');
    if (!subject || !subject.trim()) throw new Error('Brak tematu.');
    if (!body || !body.trim()) throw new Error('Brak tresci wiadomosci.');
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ user_id: _userId, username: _profile?.username || null, subject: subject.trim() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { error: mErr } = await supabase
      .from('conversation_messages')
      .insert({ conversation_id: conv.id, sender_id: _userId, sender_is_admin: false, body: body.trim() });
    if (mErr) throw new Error(mErr.message);
    return conv;
  }

  async function listMyConversations() {
    if (!_userId) return [];
    const { data, error } = await supabase
      .from('conversations')
      .select('id, subject, status, created_at, last_message_at')
      .eq('user_id', _userId)
      .order('last_message_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function listAllConversations(status) {
    if (!_profile?.isAdmin) return [];
    let q = supabase
      .from('conversations')
      .select('id, user_id, username, subject, status, created_at, last_message_at');
    if (status) q = q.eq('status', status);
    q = q.order('last_message_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function getConversationMessages(convId) {
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('id, sender_id, sender_is_admin, body, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function replyToConversation(convId, body) {
    if (!_userId) throw new Error('Nie zalogowany.');
    if (!body || !body.trim()) throw new Error('Pusta wiadomosc.');
    const isAdminSender = !!_profile?.isAdmin;
    const { error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: convId,
        sender_id: _userId,
        sender_is_admin: isAdminSender,
        body: body.trim()
      });
    if (error) throw new Error(error.message);
    // Zaktualizuj last_message_at (RLS pozwoli userowi/adminowi na wlasna konwersacje)
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', convId);
  }

  async function closeConversation(convId) {
    if (!_profile?.isAdmin) throw new Error('Tylko admin moze zamykac konwersacje.');
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'closed' })
      .eq('id', convId);
    if (error) throw new Error(error.message);
  }

  async function countOpenConversations() {
    if (!_profile?.isAdmin) return 0;
    const { data, error } = await supabase.rpc('count_open_conversations');
    if (error) return 0;
    return Number(data) || 0;
  }

  // ═══════════════════════════════════════════════════════════════
  //  RESET HASŁA UCZNIA — nie zapisujemy hasła, pokazujemy raz
  // ═══════════════════════════════════════════════════════════════
  //
  // Generuje nowe losowe hasło, zmienia je w auth.users przez RPC,
  // zwraca nowe hasło w jawnej postaci — UI pokaże je jednorazowo.
  // Po tej operacji hasło nie jest już nigdzie w bazie dostępne.
  async function adminResetUserPassword(userId) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) throw new Error('Brak uprawnień.');
    const newPass = _randomPassword(8);
    const { error } = await supabase.rpc('admin_reset_user_password', {
      p_user_id: userId,
      p_new_password: newPass
    });
    if (error) throw new Error(error.message);
    return newPass;
  }

  // ═══════════════════════════════════════════════════════════════
  //  BULK STUDENT CREATION — masowe tworzenie kont uczniów
  // ═══════════════════════════════════════════════════════════════

  function _randomPassword(len = 8) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // bez 0,1,o,i,l
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }
  function _slugifyClassName(name) {
    return (name || 'klasa').toLowerCase()
      .replace(/[ąćęłńóśżź]/g, m => ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ż':'z','ź':'z'}[m] || m))
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'klasa';
  }

  // Tworzy `count` kont uczniów, dodaje ich do klasy, zwraca listę {username, password}
  async function bulkCreateStudentsForClass(classId, className, count) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) throw new Error('Brak uprawnień');
    if (!classId) throw new Error('Brak ID klasy.');
    if (!count || count < 1 || count > 50) throw new Error('Podaj liczbę uczniów od 1 do 50.');
    // Limit Free: max 30 uczniow/klasa — sprawdzamy czy masowe dodanie miesci sie w limicie
    if (_isFreeCreator()) {
      const { count: currentMembers } = await supabase
        .from('class_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('class_id', classId);
      const cur = currentMembers || 0;
      if (cur + count > FREE_LIMITS.MAX_STUDENTS_PER_CLASS) {
        const remaining = Math.max(0, FREE_LIMITS.MAX_STUDENTS_PER_CLASS - cur);
        throw new Error('LIMIT_STUDENTS_BULK:' + FREE_LIMITS.MAX_STUDENTS_PER_CLASS + ':' + remaining);
      }
    }

    const slug = _slugifyClassName(className);
    const created = [];
    const errors = [];

    // Znajdź pierwszy wolny numer (żeby nie nadpisywać istniejących loginów klasy)
    let offset = 1;
    for (let i = 0; i < count; i++) {
      // Szukaj wolnego loginu slug_NN
      let username = null, pass = null, userId = null;
      for (let tries = 0; tries < 20; tries++) {
        const num = String(offset).padStart(2, '0');
        const candidate = `${slug}_${num}`;
        offset++;
        // Spróbuj utworzyć; jeśli konflikt — idź dalej
        pass = _randomPassword(8);
        try {
          const { data, error } = await supabase.rpc('admin_create_user', {
            p_username: candidate, p_password: pass
          });
          if (error) {
            if (/exist|duplicat|zaj/i.test(error.message)) continue; // login zajęty — próbuj dalej
            throw new Error(error.message);
          }
          username = candidate;
          userId = (data && data.user_id) || data;
          break;
        } catch(e) {
          if (/exist|duplicat|zaj/i.test(e.message)) continue;
          throw e;
        }
      }
      if (!username) { errors.push('Nie udało się utworzyć konta #' + (i+1)); continue; }

      // Zapisz twórcę konta (best-effort)
      if (userId) {
        try { await supabase.rpc('set_profile_creator', { p_user_id: userId }); } catch(e) {}
      }

      // Dodaj do klasy (best-effort)
      try {
        if (userId) await addClassMember(classId, userId);
      } catch(e) { /* nie blokuj reszty */ }

      created.push({ username, password: pass });
    }
    return { created, errors };
  }

  // ═══════════════════════════════════════════════════════════════
  //  TEACHER SETS — zestawy słów tworzone przez nauczyciela
  // ═══════════════════════════════════════════════════════════════

  async function teacherLoadMySets() {
    if (!_userId) return [];
    const { data, error } = await supabase
      .from('teacher_sets')
      .select('id, name, school_type, grade, topic, source_note, created_at, updated_at')
      .eq('owner_id', _userId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  // ADMIN: wszystkie zestawy wszystkich nauczycieli + nazwa właściciela.
  // Wykorzystuje politykę RLS „teacher_sets: admin ALL".
  async function adminLoadAllTeacherSets() {
    if (!_profile?.isAdmin) return [];
    const { data: sets, error } = await supabase
      .from('teacher_sets')
      .select('id, owner_id, name, school_type, grade, topic, source_note, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    const list = sets || [];
    // Dociągnij username właściciela (oddzielny select, bo Supabase nie
    // robi joinów między schemą profili bez konfiguracji FK).
    const ownerIds = [...new Set(list.map(s => s.owner_id).filter(Boolean))];
    if (ownerIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ownerIds);
      const byId = Object.fromEntries((profs || []).map(p => [p.id, p.username]));
      list.forEach(s => { s.owner_username = byId[s.owner_id] || '(nieznany)'; });
    }
    return list;
  }

  async function teacherGetSet(setId) {
    const { data, error } = await supabase
      .from('teacher_sets')
      .select('*')
      .eq('id', setId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function teacherCreateSet(fields) {
    if (!_userId) throw new Error('Nie jesteś zalogowany.');
    // Limit Free: max 10 zestawow dla nauczyciela/opiekuna Free
    if (_isFreeCreator()) {
      const { count } = await supabase
        .from('teacher_sets')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', _userId);
      if ((count || 0) >= FREE_LIMITS.MAX_TEACHER_SETS) {
        throw new Error('LIMIT_SETS:' + FREE_LIMITS.MAX_TEACHER_SETS);
      }
    }
    const payload = {
      owner_id: _userId,
      name: fields.name,
      school_type: fields.school_type || null,
      grade: fields.grade || null,
      topic: fields.topic || null,
      source_note: fields.source_note || null,
      is_public: false
    };
    const { data, error } = await supabase
      .from('teacher_sets')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function teacherUpdateSet(setId, fields) {
    const allowed = {};
    ['name','school_type','grade','topic','source_note'].forEach(k => {
      if (fields[k] !== undefined) allowed[k] = fields[k];
    });
    const { data, error } = await supabase
      .from('teacher_sets')
      .update(allowed)
      .eq('id', setId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function teacherDeleteSet(setId) {
    const { error } = await supabase
      .from('teacher_sets')
      .delete()
      .eq('id', setId);
    if (error) throw new Error(error.message);
  }

  async function teacherLoadWords(setId) {
    const { data, error } = await supabase
      .from('teacher_words')
      .select('id, word, translation, example, position')
      .eq('set_id', setId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function teacherAddWord(setId, { word, translation, example, position }) {
    const payload = {
      set_id: setId,
      word: word,
      translation: translation,
      example: example || null,
      position: (typeof position === 'number') ? position : 0
    };
    const { data, error } = await supabase
      .from('teacher_words')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function teacherAddWordsBulk(setId, wordsArr) {
    if (!Array.isArray(wordsArr) || wordsArr.length === 0) return [];
    const payload = wordsArr.map((w, i) => ({
      set_id: setId,
      word: w.word,
      translation: w.translation,
      example: w.example || null,
      position: (typeof w.position === 'number') ? w.position : i
    }));
    const { data, error } = await supabase
      .from('teacher_words')
      .insert(payload)
      .select();
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function teacherUpdateWord(wordId, fields) {
    const allowed = {};
    ['word','translation','example','position'].forEach(k => {
      if (fields[k] !== undefined) allowed[k] = fields[k];
    });
    const { data, error } = await supabase
      .from('teacher_words')
      .update(allowed)
      .eq('id', wordId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function teacherDeleteWord(wordId) {
    const { error } = await supabase
      .from('teacher_words')
      .delete()
      .eq('id', wordId);
    if (error) throw new Error(error.message);
  }

  async function teacherLoadAssignments(setId) {
    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('id, class_id, assigned_at')
      .eq('set_id', setId);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function teacherAssignSet(setId, classId) {
    const { data, error } = await supabase
      .from('teacher_assignments')
      .insert({ set_id: setId, class_id: classId })
      .select()
      .single();
    if (error) {
      if (String(error.message).includes('duplicate')) return null; // już przypisane
      throw new Error(error.message);
    }
    return data;
  }

  async function teacherUnassignSet(setId, classId) {
    const { error } = await supabase
      .from('teacher_assignments')
      .delete()
      .eq('set_id', setId)
      .eq('class_id', classId);
    if (error) throw new Error(error.message);
  }

  // Nauczyciel widzi tylko uczniów, których sam utworzył (created_by = jego ID).
  // Admin widzi wszystkich.
  async function loadAllProfiles() {
    if (!_profile?.isAdmin && !_profile?.isTeacher) return [];
    let q = supabase
      .from('profiles')
      .select('id, username, xp, level, streak, total_sessions, total_answers, correct_answers, last_study_date, is_admin, is_teacher, plan, created_by, created_at');
    if (!_profile.isAdmin && _profile.isTeacher) {
      q = q.eq('created_by', _userId);
    }
    // Sortuj od najnowszych do najstarszych (created_at malejaco)
    q = q.order('created_at', { ascending: false, nullsFirst: false });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════
  //  BOOK NOTES — notatki administratora przy podręcznikach / unitach
  // ═══════════════════════════════════════════════════════════════
  // unitKey: '' (lub null/undefined) → notatka na poziomie podręcznika
  //          'unit5'                 → notatka na poziomie unitu
  async function loadBookNote(bookId, unitKey) {
    if (!bookId) return null;
    const key = unitKey || '';
    const { data, error } = await supabase
      .from('book_notes')
      .select('id, book_id, unit_key, content, updated_at, updated_by')
      .eq('book_id', bookId)
      .eq('unit_key', key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function saveBookNote(bookId, unitKey, content) {
    if (!_profile?.isAdmin) throw new Error('Tylko administrator może edytować notatki.');
    if (!bookId) throw new Error('Brak book_id.');
    const key = unitKey || '';
    const payload = {
      book_id: bookId,
      unit_key: key,
      content: content || '',
      updated_by: _userId
    };
    const { data, error } = await supabase
      .from('book_notes')
      .upsert(payload, { onConflict: 'book_id,unit_key' })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function deleteBookNote(bookId, unitKey) {
    if (!_profile?.isAdmin) throw new Error('Tylko administrator może usuwać notatki.');
    if (!bookId) throw new Error('Brak book_id.');
    const key = unitKey || '';
    const { error } = await supabase
      .from('book_notes')
      .delete()
      .eq('book_id', bookId)
      .eq('unit_key', key);
    if (error) throw new Error(error.message);
  }

  // Samodzielne usunięcie własnego konta („prawo do bycia zapomnianym" — RODO art. 17).
  // Wywołuje funkcję SQL delete_own_account(), która kasuje powiązane dane i auth.users.
  // Po tej operacji sesja przestaje być ważna — klient powinien wylogować użytkownika.
  async function deleteOwnAccount() {
    if (!_userId) throw new Error('Nie jesteś zalogowany.');
    const { data, error } = await supabase.rpc('delete_own_account');
    if (error) throw new Error(error.message);
    // Wyloguj i wyczyść lokalną sesję
    try { await supabase.auth.signOut(); } catch(e) {}
    _profile = null;
    _userId = null;
    return data; // 'ok'
  }

  // Wyszukanie jednego profilu po loginie — używane przez panel nauczyciela,
  // który nie ma listy wszystkich uczniów, tylko wpisuje konkretny login.
  // Wyszukanie jednego profilu po loginie. Nauczyciel — tylko wśród
  // uczniów, których sam utworzył. Admin — po każdym loginie.
  async function findProfileByUsername(username) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) return null;
    if (!username) return null;
    let q = supabase
      .from('profiles')
      .select('id, username, xp, level, streak, total_sessions, total_answers, correct_answers, last_study_date, is_admin, is_teacher, plan, created_by')
      .eq('username', username);
    if (!_profile.isAdmin && _profile.isTeacher) {
      q = q.eq('created_by', _userId);
    }
    q = q.limit(1);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data && data[0]) || null;
  }

  async function loadUserProgress(userId) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) return [];
    const { data, error } = await supabase
      .from('unit_progress')
      .select('book_key, unit_key, known_count, total, last_studied')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function loadClasses() {
    if (!_userId) return [];
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, created_at, class_members(user_id)')
      .eq('admin_id', _userId)
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function saveClass(name, classId = null) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) throw new Error('Brak uprawnień');
    if (classId) {
      const { data, error } = await supabase.from('classes')
        .update({ name }).eq('id', classId).select().single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      // Limit Free: max 8 klas dla nauczyciela Free
      if (_isFreeCreator()) {
        const { count } = await supabase
          .from('classes')
          .select('id', { count: 'exact', head: true })
          .eq('admin_id', _userId);
        if ((count || 0) >= FREE_LIMITS.MAX_CLASSES) {
          throw new Error('LIMIT_CLASSES:' + FREE_LIMITS.MAX_CLASSES);
        }
      }
      const { data, error } = await supabase.from('classes')
        .insert({ name, admin_id: _userId }).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
  }

  async function deleteClass(classId) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) throw new Error('Brak uprawnień');
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) throw new Error(error.message);
  }

  async function addClassMember(classId, userId) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) throw new Error('Brak uprawnień');
    // Limit Free: max 30 uczniow na klase
    if (_isFreeCreator()) {
      const { count } = await supabase
        .from('class_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('class_id', classId);
      if ((count || 0) >= FREE_LIMITS.MAX_STUDENTS_PER_CLASS) {
        throw new Error('LIMIT_STUDENTS:' + FREE_LIMITS.MAX_STUDENTS_PER_CLASS);
      }
    }
    const { error } = await supabase.from('class_members')
      .upsert({ class_id: classId, user_id: userId });
    if (error) throw new Error(error.message);
  }

  async function removeClassMember(classId, userId) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) throw new Error('Brak uprawnień');
    const { error } = await supabase.from('class_members')
      .delete().eq('class_id', classId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  // ─── PRYWATNE ETYKIETY UZYTKOWNIKOW (user_labels) ──────────
  // Tylko admin/nauczyciel/opiekun. Widoczne tylko dla autora.
  function getMyUserLabels() { return _myLabels || {}; }
  function getUserLabel(targetUserId) { return (_myLabels || {})[targetUserId] || null; }

  async function setUserLabel(targetUserId, label) {
    if (!_userId || !targetUserId) throw new Error('Brak ID uzytkownika');
    const txt = (label || '').trim();
    if (!txt) throw new Error('Etykieta nie moze byc pusta');
    if (txt.length > 80) throw new Error('Etykieta moze miec max 80 znakow');
    const { error } = await supabase
      .from('user_labels')
      .upsert({ labeler_id: _userId, target_user_id: targetUserId, label: txt, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    _myLabels[targetUserId] = txt;
    return txt;
  }

  async function deleteUserLabel(targetUserId) {
    if (!_userId || !targetUserId) return;
    const { error } = await supabase
      .from('user_labels')
      .delete().eq('labeler_id', _userId).eq('target_user_id', targetUserId);
    if (error) throw new Error(error.message);
    delete _myLabels[targetUserId];
  }

  // ── Admin: Zarządzanie dostępem do podręczników ──────────────

  function getUserBooks() { return _myBooks; }

  async function adminLoadUserBooks(userId) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) return [];
    const { data, error } = await supabase
      .from('user_books').select('book_id').eq('user_id', userId);
    if (error) throw new Error(error.message);
    return (data || []).map(r => r.book_id);
  }

  async function adminSetUserBooks(userId, bookIds) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) throw new Error('Brak uprawnień');
    // Usuń stare wpisy
    const { error: delErr } = await supabase
      .from('user_books').delete().eq('user_id', userId);
    if (delErr) throw new Error(delErr.message);
    // Dodaj nowe
    if (bookIds.length > 0) {
      const rows = bookIds.map(bid => ({ user_id: userId, book_id: bid }));
      const { error: insErr } = await supabase.from('user_books').insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
  }

  async function adminCreateUser(username, password) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) throw new Error('Brak uprawnień');
    const { data, error } = await supabase.rpc('admin_create_user', {
      p_username: username, p_password: password
    });
    if (error) throw new Error(error.message);
    // Zapisz twórcę, żeby nauczyciel widział "swoich" uczniów.
    const newUserId = (data && data.user_id) || data;
    if (newUserId && typeof newUserId === 'string') {
      try { await supabase.rpc('set_profile_creator', { p_user_id: newUserId }); } catch(e) {}
    }
    return data; // returns new user UUID (lub obiekt {user_id})
  }

  async function adminDeleteUser(userId) {
    if (!_profile?.isAdmin && !_profile?.isTeacher) throw new Error('Brak uprawnień');
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId });
    if (error) throw new Error(error.message);
  }

  function getUserId() { return _userId; }

  // ─── PUBLICZNE API ───────────────────────────────────────────
  return {
    // init / auth
    init,
    flush,
    login,
    register,
    logout,
    // odczyt
    getAccounts,
    getUser,
    // xp
    setXP,
    // postęp
    saveUnitProgress,
    getUnitProgress,
    getReviewQueue,
    getBookProgress,
    // seria
    updateStreak,
    // statystyki
    recordAnswer,
    // dzienny xp
    getDailyXP,
    addDailyXP,
    // odznaki
    unlockAchievement,
    getAchievements,
    // speed
    saveSpeedScore,
    getSpeedBest,
    // admin
    isAdmin,
    isTeacher,
    getUserPlan,
    setUserPlan,
    addAdminRequest,
    getAdminRequests,
    approveAdminRequest,
    rejectAdminRequest,
    getPendingRequestsCount,
    // zdania przykładowe
    loadSentences,
    getSentence,
    saveSentence,
    // admin — treść
    loadAdminData,
    adminAddWord,
    adminEditWord,
    adminDeleteWord,
    adminAddBook,
    adminAddUnit,
    // admin — dostęp do podręczników
    getUserBooks,
    adminLoadUserBooks,
    adminSetUserBooks,
    adminCreateUser,
    adminDeleteUser,
    // admin — klasy
    loadAllProfiles,
    findProfileByUsername,
    deleteOwnAccount,
    // book notes (admin)
    loadBookNote,
    saveBookNote,
    deleteBookNote,
    // book access requests
    requestBookAccess,
    listMyBookAccessRequests,
    listAllBookAccessRequests,
    approveBookAccessRequest,
    rejectBookAccessRequest,
    countPendingBookAccessRequests,
    // word error reports
    createWordErrorReport,
    listWordErrorReports,
    resolveWordErrorReport,
    deleteWordErrorReport,
    countPendingWordErrorReports,
    // parent/opiekun
    isParent,
    isPremium,
    getPlanExpiryInfo,
    hasUsedTrial,
    activateTrialIfEligible,
    downgradePlanIfExpired,
    adminExtendPremium,
    getFreeLimits,
    getDailyXpHistory,
    logStudyMinutes,
    getMyUserLabels,
    getUserLabel,
    setUserLabel,
    deleteUserLabel,
    getInactiveStudents,
    getInactiveChildren,
    autoDeleteInactiveUsers,
    listMyChildren,
    fetchProfileById,
    findUserByUsername,
    addChild,
    removeChild,
    parentAssignBookToChild,
    parentUnassignBookFromChild,
    getChildUserBooks,
    // messages/konwersacje
    createConversation,
    listMyConversations,
    listAllConversations,
    getConversationMessages,
    replyToConversation,
    closeConversation,
    countOpenConversations,
    // bulk student creation
    bulkCreateStudentsForClass,
    adminResetUserPassword,
    // teacher sets
    teacherLoadMySets,
    adminLoadAllTeacherSets,
    teacherGetSet,
    teacherCreateSet,
    teacherUpdateSet,
    teacherDeleteSet,
    teacherLoadWords,
    teacherAddWord,
    teacherAddWordsBulk,
    teacherUpdateWord,
    teacherDeleteWord,
    teacherLoadAssignments,
    teacherAssignSet,
    teacherUnassignSet,
    loadUserProgress,
    loadClasses,
    saveClass,
    deleteClass,
    addClassMember,
    removeClassMember,
    getUserId
  };

})();

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
    return { prev, now: _profile.dailyXP };
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

  function getAdminRequests() {
    return _adminRequests;
  }

  /**
   * Wysyła prośbę o uprawnienia admina.
   * Rzuca wyjątek przy błędzie. Zwraca false jeśli prośba już istnieje.
   */
  async function addAdminRequest(username) {
    // Pobierz user_id po nazwie użytkownika
    const { data: profRows, error } = await supabase
      .rpc('get_profile_by_username', { p_username: username });
    if (error || !profRows || profRows.length === 0)
      throw new Error('Nie znaleziono użytkownika o takiej nazwie.');
    const targetId = profRows[0].id;
    if (profRows[0].is_admin)
      throw new Error('To konto już ma uprawnienia administratora!');

    // Sprawdź czy prośba już istnieje
    const { data: existing } = await supabase
      .from('admin_requests')
      .select('id')
      .eq('user_id', targetId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) return false; // już oczekuje

    const { error: insErr } = await supabase
      .from('admin_requests')
      .insert({ user_id: targetId, username });
    if (insErr) throw new Error(insErr.message);
    return true;
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
  //  FLUSH — wymuś zapis przed wylogowaniem (await!)
  // ═══════════════════════════════════════════════════════════════
  async function flush() {
    if (!_profile || !_userId) return;
    clearTimeout(_saveTimer); // anuluj oczekujący debounce
    const { error } = await supabase.from('profiles')
      .upsert(_profilePayload(), { onConflict: 'id' });
    if (error) console.warn('[DB] Flush error:', error.message);
  }

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
    addAdminRequest,
    getAdminRequests,
    approveAdminRequest,
    rejectAdminRequest,
    getPendingRequestsCount
  };

})();

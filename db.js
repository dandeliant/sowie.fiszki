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

    // Załaduj przypisane podręczniki (user_books)
    if (!_profile.isAdmin) {
      const { data: ubData } = await supabase
        .from('user_books').select('book_id').eq('user_id', _userId);
      _myBooks = (ubData && ubData.length > 0) ? ubData.map(r => r.book_id) : null;
    } else {
      _myBooks = null; // admin widzi wszystko
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
      .select('word_pl, sentence_pl, sentence_target')
      .eq('book_id', bookId);
    if (error) { console.warn('[DB] loadSentences:', error.message); return; }
    (data || []).forEach(row => {
      _sentences[bookId + '__' + row.word_pl] = {
        sentence_pl:     row.sentence_pl,
        sentence_target: row.sentence_target
      };
    });
  }

  /** Zwraca zdanie z cache (synchronicznie). */
  function getSentence(bookId, wordPl) {
    return _sentences[bookId + '__' + wordPl] || null;
  }

  /** Admin: zapisuje / aktualizuje zdanie (UPSERT). */
  async function saveSentence(bookId, wordPl, sentencePl, sentenceTarget) {
    const { error } = await supabase.from('word_sentences').upsert({
      book_id:         bookId,
      word_pl:         wordPl,
      sentence_pl:     sentencePl,
      sentence_target: sentenceTarget,
      updated_by:      _userId,
      updated_at:      new Date().toISOString()
    }, { onConflict: 'book_id,word_pl' });
    if (error) throw new Error(error.message);
    // Zaktualizuj lokalny cache
    _sentences[bookId + '__' + wordPl] = { sentence_pl: sentencePl, sentence_target: sentenceTarget };
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

  async function loadAllProfiles() {
    if (!_profile?.isAdmin) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, xp, level, streak, total_sessions, total_answers, correct_answers, last_study_date, is_admin')
      .order('username');
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function loadUserProgress(userId) {
    if (!_profile?.isAdmin) return [];
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
    if (!_profile?.isAdmin) throw new Error('Brak uprawnień');
    if (classId) {
      const { data, error } = await supabase.from('classes')
        .update({ name }).eq('id', classId).select().single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const { data, error } = await supabase.from('classes')
        .insert({ name, admin_id: _userId }).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
  }

  async function deleteClass(classId) {
    if (!_profile?.isAdmin) throw new Error('Brak uprawnień');
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) throw new Error(error.message);
  }

  async function addClassMember(classId, userId) {
    if (!_profile?.isAdmin) throw new Error('Brak uprawnień');
    const { error } = await supabase.from('class_members')
      .upsert({ class_id: classId, user_id: userId });
    if (error) throw new Error(error.message);
  }

  async function removeClassMember(classId, userId) {
    if (!_profile?.isAdmin) throw new Error('Brak uprawnień');
    const { error } = await supabase.from('class_members')
      .delete().eq('class_id', classId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  // ── Admin: Zarządzanie dostępem do podręczników ──────────────

  function getUserBooks() { return _myBooks; }

  async function adminLoadUserBooks(userId) {
    if (!_profile?.isAdmin) return [];
    const { data, error } = await supabase
      .from('user_books').select('book_id').eq('user_id', userId);
    if (error) throw new Error(error.message);
    return (data || []).map(r => r.book_id);
  }

  async function adminSetUserBooks(userId, bookIds) {
    if (!_profile?.isAdmin) throw new Error('Brak uprawnień');
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
    if (!_profile?.isAdmin) throw new Error('Brak uprawnień');
    const { data, error } = await supabase.rpc('admin_create_user', {
      p_username: username, p_password: password
    });
    if (error) throw new Error(error.message);
    return data; // returns new user UUID
  }

  async function adminDeleteUser(userId) {
    if (!_profile?.isAdmin) throw new Error('Brak uprawnień');
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
    loadUserProgress,
    loadClasses,
    saveClass,
    deleteClass,
    addClassMember,
    removeClassMember,
    getUserId
  };

})();

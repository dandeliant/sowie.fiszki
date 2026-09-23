/* PenPal – wspólne narzędzia: API (serwer PHP lub tryb lokalny), UI helpers. */
(function () {
  'use strict';

  const LOCAL_KEY = 'penpal-db-v1';
  const API_URL = 'api.php';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function uid(n = 8) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  }

  function plural(n, one, few, many) {
    const n10 = n % 10, n100 = n % 100;
    if (n === 1) return `${n} ${one}`;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} ${few}`;
    return `${n} ${many}`;
  }

  function toast(msg, type = 'info') {
    let host = $('#toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3600);
  }

  function confirmDialog(message, { okText = 'OK', danger = false } = {}) {
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'modal modal-sm';
      d.innerHTML = `<div class="modal-body"><p>${esc(message)}</p></div>
        <div class="modal-foot"><button class="btn btn-ghost" value="no">Anuluj</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="yes">${esc(okText)}</button></div>`;
      document.body.appendChild(d);
      d.addEventListener('click', e => {
        const v = e.target.closest('button')?.value;
        if (v) d.close(v);
      });
      d.addEventListener('close', () => { resolve(d.returnValue === 'yes'); d.remove(); });
      d.showModal();
    });
  }

  function download(filename, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  function slug(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
      .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  }

  // ---------------------------------------------------------------------------
  // Tryb lokalny – wszystko w localStorage tej przeglądarki (do testów / bez serwera).
  // ---------------------------------------------------------------------------
  function emptyDb() {
    return { settings: { projectName: 'Listy przyjaźni', formOpen: true, deadline: '', intro: '' }, submissions: [], matching: null };
  }
  function loadLocal() {
    try {
      const db = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (db && Array.isArray(db.submissions)) return Object.assign(emptyDb(), db);
    } catch (e) { /* brak dostępu lub uszkodzone dane */ }
    return emptyDb();
  }
  function saveLocal(db) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(db)); }
    catch (e) { throw new Error('Nie udało się zapisać danych w przeglądarce.'); }
  }
  async function sha256(s) {
    if (!crypto.subtle) return s;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function publicSub(s) {
    const { tokenHash, ...rest } = s;
    return rest;
  }

  const local = {
    async config() {
      return { ok: true, ...loadLocal().settings };
    },
    async submit(data) {
      const db = loadLocal();
      const token = uid(12);
      const sub = { ...data, id: uid(), createdAt: new Date().toISOString(), updatedAt: null, active: true, tokenHash: await sha256(token) };
      db.submissions.push(sub);
      saveLocal(db);
      return { ok: true, id: sub.id, token };
    },
    async getOwn(id, token) {
      const s = loadLocal().submissions.find(x => x.id === id);
      if (!s || s.tokenHash !== await sha256(token)) throw new Error('Nieprawidłowy link do edycji.');
      return { ok: true, submission: publicSub(s) };
    },
    async updateOwn(id, token, data) {
      const db = loadLocal();
      const s = db.submissions.find(x => x.id === id);
      if (!s || s.tokenHash !== await sha256(token)) throw new Error('Nieprawidłowy link do edycji.');
      Object.assign(s, data, { updatedAt: new Date().toISOString() });
      saveLocal(db);
      return { ok: true };
    },
    async me() { return { ok: true, admin: true, defaultPassword: false }; },
    async login() { return { ok: true }; },
    async logout() { return { ok: true }; },
    async list() {
      const db = loadLocal();
      return { ok: true, settings: db.settings, submissions: db.submissions.map(publicSub), matching: db.matching };
    },
    async saveSubmission(sub) {
      const db = loadLocal();
      const i = db.submissions.findIndex(x => x.id === sub.id);
      if (i >= 0) db.submissions[i] = { ...db.submissions[i], ...sub, updatedAt: new Date().toISOString() };
      else db.submissions.push({ ...sub, id: sub.id || uid(), createdAt: new Date().toISOString(), active: sub.active !== false });
      saveLocal(db);
      return { ok: true };
    },
    async deleteSubmission(id) {
      const db = loadLocal();
      db.submissions = db.submissions.filter(x => x.id !== id);
      saveLocal(db);
      return { ok: true };
    },
    async saveMatching(matching) {
      const db = loadLocal();
      db.matching = matching;
      saveLocal(db);
      return { ok: true };
    },
    async saveSettings(settings) {
      const db = loadLocal();
      db.settings = { ...db.settings, ...settings };
      saveLocal(db);
      return { ok: true };
    },
    async importDb(data) {
      saveLocal(Object.assign(emptyDb(), data));
      return { ok: true };
    },
  };

  // ---------------------------------------------------------------------------
  // Tryb serwerowy – api.php
  // ---------------------------------------------------------------------------
  async function call(action, body) {
    const res = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    let json;
    try { json = await res.json(); } catch (e) { throw new Error(`Błąd serwera (${res.status}).`); }
    if (!res.ok || !json.ok) {
      const err = new Error(json.error || `Błąd serwera (${res.status}).`);
      err.status = res.status;
      err.fromApi = true;
      throw err;
    }
    return json;
  }

  const server = {
    config: () => call('config'),
    submit: data => call('submit', data),
    getOwn: (id, token) => call('get_own', { id, token }),
    updateOwn: (id, token, data) => call('update_own', { id, token, data }),
    me: () => call('me'),
    login: password => call('login', { password }),
    logout: () => call('logout', {}),
    list: () => call('list'),
    saveSubmission: sub => call('save_submission', sub),
    deleteSubmission: id => call('delete_submission', { id }),
    saveMatching: m => call('save_matching', m),
    saveSettings: s => call('save_settings', s),
    importDb: data => call('import', data),
  };

  // ---------------------------------------------------------------------------
  // Tryb Supabase – sowiefiszki.com (Vercel bez PHP). Dane w tabelach:
  //   penpal_submissions, penpal_config, penpal_matching (migracja #58).
  //   Publiczne akcje (submit / get_own / update_own) przez RPC SECURITY DEFINER.
  //   Odczyt/edycja admina bezpośrednio na tabelach (RLS _is_admin()).
  // ---------------------------------------------------------------------------
  const SB = (window.supabase && typeof window.supabase.from === 'function') ? window.supabase : null;

  function rowToSub(r) {
    return {
      id: r.id, school: r.school, city: r.city, schoolType: r.school_type,
      guardian: r.guardian, email: r.email, note: r.note, students: r.students || [],
      active: r.active !== false, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
  function subToRow(s) {
    return {
      school: (s.school || '').trim(), city: (s.city || '').trim(), school_type: s.schoolType || 'sp',
      guardian: (s.guardian || '').trim(), email: (s.email || '').trim(), note: (s.note || '').trim(),
      students: s.students || [],
    };
  }
  function cfgToSettings(c) {
    return {
      projectName: (c && c.project_name) || 'Listy przyjaźni',
      formOpen: c ? c.form_open !== false : true,
      deadline: (c && c.deadline) || '',
      intro: (c && c.intro) || '',
    };
  }
  async function isSiteAdmin() {
    if (!SB) return false;
    try {
      const { data: { session } } = await SB.auth.getSession();
      if (!session) return false;
      const { data } = await SB.from('profiles').select('is_admin').eq('id', session.user.id).single();
      return !!(data && data.is_admin);
    } catch (e) { return false; }
  }

  const supabaseApi = {
    async config() {
      const { data } = await SB.from('penpal_config').select('*').eq('id', 1).maybeSingle();
      return { ok: true, ...cfgToSettings(data) };
    },
    async submit(data) {
      const { data: r, error } = await SB.rpc('penpal_submit', { p_data: data });
      if (error) throw new Error(error.message || 'Nie udało się wysłać zgłoszenia.');
      if (!r || r.ok === false) throw new Error((r && r.error) || 'Nie udało się wysłać zgłoszenia.');
      return { ok: true, id: r.id, token: r.token };
    },
    async getOwn(id, token) {
      const { data: r, error } = await SB.rpc('penpal_get_own', { p_id: id, p_token: token });
      if (error || !r) throw new Error('Nieprawidłowy link do edycji.');
      return { ok: true, submission: r };
    },
    async updateOwn(id, token, data) {
      const { data: r, error } = await SB.rpc('penpal_update_own', { p_id: id, p_token: token, p_data: data });
      if (error) throw new Error(error.message || 'Nie udało się zapisać zmian.');
      if (!r || r.ok === false) throw new Error((r && r.error) || 'Nieprawidłowy link do edycji.');
      return { ok: true };
    },
    async me() { return { ok: true, admin: await isSiteAdmin(), defaultPassword: false }; },
    async login() { const ok = await isSiteAdmin(); if (!ok) { const e = new Error('Zaloguj się jako administrator na sowiefiszki.com.'); e.status = 401; throw e; } return { ok: true }; },
    async logout() { return { ok: true }; },
    async list() {
      if (!(await isSiteAdmin())) { const e = new Error('Zaloguj się jako administrator.'); e.status = 401; throw e; }
      const [subsRes, cfgRes, mtRes] = await Promise.all([
        SB.from('penpal_submissions').select('*'),
        SB.from('penpal_config').select('*').eq('id', 1).maybeSingle(),
        SB.from('penpal_matching').select('data').eq('id', 1).maybeSingle(),
      ]);
      if (subsRes.error) { const e = new Error(subsRes.error.message); e.status = subsRes.error.code === 'PGRST301' ? 401 : 500; throw e; }
      return {
        ok: true,
        settings: cfgToSettings(cfgRes.data),
        submissions: (subsRes.data || []).map(rowToSub),
        matching: (mtRes.data && mtRes.data.data) ? mtRes.data.data : null,
      };
    },
    async saveSubmission(sub) {
      const row = subToRow(sub); row.active = sub.active !== false;
      if (sub.id) {
        const { error } = await SB.from('penpal_submissions').update({ ...row, updated_at: new Date().toISOString() }).eq('id', sub.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await SB.from('penpal_submissions').insert({ ...row, id: uid(8), created_at: new Date().toISOString() });
        if (error) throw new Error(error.message);
      }
      return { ok: true };
    },
    async deleteSubmission(id) {
      const { error } = await SB.from('penpal_submissions').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
    async saveMatching(matching) {
      const { error } = await SB.from('penpal_matching').upsert({ id: 1, data: matching, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      return { ok: true };
    },
    async saveSettings(settings) {
      const { error } = await SB.from('penpal_config').upsert({
        id: 1, project_name: settings.projectName || 'Listy przyjaźni', form_open: settings.formOpen !== false,
        deadline: settings.deadline || null, intro: settings.intro || '', updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    },
    async importDb(data) {
      if (!(await isSiteAdmin())) { const e = new Error('Zaloguj się jako administrator.'); e.status = 401; throw e; }
      await SB.from('penpal_submissions').delete().neq('id', '');
      const rows = (data.submissions || []).map(s => ({
        ...subToRow(s), id: /^[a-f0-9]{8,32}$/.test(String(s.id || '')) ? s.id : uid(8),
        active: s.active !== false, created_at: s.createdAt || new Date().toISOString(), updated_at: s.updatedAt || null,
      }));
      if (rows.length) { const { error } = await SB.from('penpal_submissions').insert(rows); if (error) throw new Error(error.message); }
      if (data.settings && data.settings.projectName) await this.saveSettings(data.settings);
      if (data.matching && data.matching.groups) await this.saveMatching(data.matching);
      return { ok: true };
    },
  };

  // Wykrycie trybu: Supabase (sowiefiszki) -> serwer PHP -> tryb lokalny.
  let modePromise = null;
  function detectMode() {
    if (!modePromise) {
      modePromise = (async () => {
        if (SB) return 'supabase';
        if (location.protocol === 'file:') return 'local';
        try {
          await call('config');
          return 'server';
        } catch (e) {
          return e.fromApi ? 'server' : 'local';
        }
      })();
    }
    return modePromise;
  }
  function implFor(mode) { return mode === 'supabase' ? supabaseApi : mode === 'server' ? server : local; }

  const API = new Proxy({}, {
    get(_, name) {
      if (name === 'mode') return detectMode();
      return async (...args) => implFor(await detectMode())[name](...args);
    },
  });

  function showLocalBanner(extra = '') {
    const b = document.createElement('div');
    b.className = 'local-banner';
    b.innerHTML = `<strong>Tryb lokalny</strong> – dane zapisują się tylko w tej przeglądarce (brak połączenia z <code>api.php</code>). ${extra}`;
    document.body.prepend(b);
  }

  window.PP = { $, $$, esc, uid, fmtDate, plural, toast, confirmDialog, download, slug, API, showLocalBanner };
})();

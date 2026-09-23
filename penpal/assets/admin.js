/* PenPal – panel organizatora */
(async function () {
  'use strict';
  const { $, $$, esc, fmtDate, plural, toast, confirmDialog, download, slug, API } = PP;
  const M = PenpalMatcher;

  const ICON = {
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 12h10M13 8l4 4-4 4M11 16l-4-4 4-4"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
    school: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 5l9 5-9 5-9-5z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/></svg>',
    chevron: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
  };

  const PENALTY_LABELS = [
    ['bez znaczenia', 'Szkoła nie ma znaczenia – liczy się tylko wiek.'],
    ['słabe', 'Para z tej samej szkoły ≈ różnica 1 klasy.'],
    ['zalecane', 'Para z tej samej szkoły ≈ różnica 2 klas. Najpierw szukamy rówieśnika z innej szkoły, potem z klasy o 1–2 wyżej/niżej.'],
    ['mocne', 'Para z tej samej szkoły ≈ różnica 3 klas.'],
    ['bardzo mocne', 'Para z tej samej szkoły ≈ różnica 4 klas.'],
    ['nigdy', 'Uczniowie z tej samej szkoły nie są łączeni. Nadmiarowe osoby trafią do grup 3-osobowych lub zostaną bez pary.'],
  ];

  const state = {
    mode: 'server',
    settings: {},
    submissions: [],
    matching: null,
    people: new Map(),
    groupOf: new Map(),
    removedCount: 0,
    selected: [],
    filter: 'all',
    search: '',
    subsSearch: '',
    open: new Set(),
  };

  const pref = {
    get(k, d) { try { const v = localStorage.getItem('penpal-pref-' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('penpal-pref-' + k, v); } catch (e) { /* ignoruj */ } },
  };

  // ---------------------------------------------------------------------------
  // Start i logowanie
  // ---------------------------------------------------------------------------
  state.mode = await API.mode;
  if (state.mode === 'local') {
    PP.showLocalBanner('Aby zbierać zgłoszenia online, wgraj pliki na serwer z PHP (instrukcja w README.md).');
  }

  function handleError(err) {
    if (err && err.status === 401) {
      $('#app').classList.add('hidden');
      $('#login').classList.remove('hidden');
    }
    toast(err.message || String(err), 'error');
  }

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('button', e.target);
    btn.disabled = true;
    try {
      await API.login($('#password').value);
      $('#password').value = '';
      $('#login').classList.add('hidden');
      await start();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('#logout').addEventListener('click', async () => {
    try { await API.logout(); } catch (e) { /* i tak wracamy do logowania */ }
    location.reload();
  });

  async function start() {
    const me = await API.me();
    if (!me.admin) {
      $('#login').classList.remove('hidden');
      $('#password').focus();
      return;
    }
    $('#pw-warning').classList.toggle('hidden', !me.defaultPassword);
    $('#app').classList.remove('hidden');
    await reload();
  }

  async function reload() {
    try {
      const res = await API.list();
      state.settings = res.settings || {};
      state.submissions = res.submissions || [];
      state.matching = res.matching || null;
      buildPeople();
      cleanMatching();
      renderAll();
    } catch (err) {
      handleError(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Dane
  // ---------------------------------------------------------------------------
  function classDisplay(sub, st) {
    const t = M.SCHOOL_TYPES[sub.schoolType] || M.SCHOOL_TYPES.sp;
    return M.classLabel(st.grade, st.section) + (sub.schoolType !== 'sp' ? ' ' + t.short : '');
  }

  function buildPeople() {
    state.people = new Map();
    for (const s of state.submissions) {
      if (s.active === false) continue;
      for (const st of s.students || []) {
        state.people.set(st.id, {
          id: st.id, name: st.name, grade: st.grade, section: st.section,
          level: M.levelOf(s.schoolType, st.grade), school: s.id, sub: s, cls: classDisplay(s, st),
        });
      }
    }
  }

  function cleanMatching() {
    state.removedCount = 0;
    const m = state.matching;
    if (!m || !Array.isArray(m.groups)) { state.matching = null; indexGroups(); return; }
    const seen = new Set();
    let removed = 0;
    m.groups = m.groups
      .map(g => g.filter(id => {
        const ok = state.people.has(id) && !seen.has(id);
        if (!ok) removed++;
        seen.add(id);
        return ok;
      }))
      .filter(g => g.length >= 2);
    state.removedCount = removed;
    indexGroups();
  }

  function indexGroups() {
    state.groupOf = new Map();
    (state.matching?.groups || []).forEach((g, i) => g.forEach(id => state.groupOf.set(id, i)));
  }

  function unmatchedPeople() {
    return [...state.people.values()].filter(p => !state.groupOf.has(p.id))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pl'));
  }

  function analyze(group) {
    const members = group.map(id => state.people.get(id));
    const infos = members.map(p => M.describe(p, members.filter(o => o !== p)));
    return {
      members, infos,
      ageOk: infos.every(i => i.ageOk),
      sameSchool: infos.some(i => i.sameSchool),
      trio: members.length > 2,
    };
  }

  function penaltyValue(raw) {
    const v = +raw;
    return v >= 5 ? Infinity : v;
  }

  let saveTimer = null;
  function saveMatching() {
    clearTimeout(saveTimer);
    return new Promise(resolve => {
      saveTimer = setTimeout(async () => {
        try {
          if (state.matching) state.matching.updatedAt = new Date().toISOString();
          await API.saveMatching(state.matching || { groups: [] });
        } catch (err) {
          handleError(err);
        }
        resolve();
      }, 250);
    });
  }

  // ---------------------------------------------------------------------------
  // Zakładki
  // ---------------------------------------------------------------------------
  function showTab(name) {
    $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('[data-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== name));
    pref.set('tab', name);
  }
  $$('.tabs [role=tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  showTab(pref.get('tab', 'subs'));

  function renderAll() {
    const name = state.settings.projectName || 'Listy przyjaźni';
    $('#brand-name').textContent = name;
    document.title = `Panel – ${name}`;
    renderSubs();
    renderMatch();
    renderSettings();
  }

  // ---------------------------------------------------------------------------
  // ZGŁOSZENIA
  // ---------------------------------------------------------------------------
  function hue(str) {
    let h = 0;
    for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }

  function renderSubs() {
    const active = state.submissions.filter(s => s.active !== false);
    const students = [...state.people.values()];
    const last = state.submissions.map(s => s.createdAt).filter(Boolean).sort().pop();
    $('#subs-stats').innerHTML = [
      [active.length, 'aktywnych szkół'],
      [students.length, 'uczniów'],
      [active.length ? (students.length / active.length).toFixed(1).replace('.', ',') : '–', 'średnio na szkołę'],
      [last ? new Date(last).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '–', 'ostatnie zgłoszenie'],
    ].map(([v, l]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('');

    // rozkład wieku
    const counts = {};
    students.forEach(p => { if (p.level) counts[p.level] = (counts[p.level] || 0) + 1; });
    const maxLevel = Math.max(8, ...Object.keys(counts).map(Number));
    const max = Math.max(1, ...Object.values(counts));
    let bars = '';
    for (let L = 1; L <= maxLevel; L++) {
      const n = counts[L] || 0;
      const label = L <= 8 ? `${L} SP` : `${L - 8} pp.`;
      bars += `<div class="bar" title="${esc(M.levelLabel(L))}: ${n}"><b>${n || ''}</b><i style="height:${(n / max) * 70}%"></i><span>${label}</span></div>`;
    }
    $('#levels').innerHTML = bars;

    // lista szkół
    const q = state.subsSearch.toLowerCase();
    const list = state.submissions
      .filter(s => !q || [s.school, s.city, s.guardian, s.email, ...(s.students || []).map(x => x.name)].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (!state.submissions.length) {
      $('#subs-list').innerHTML = `<div class="card empty">Nie ma jeszcze zgłoszeń. Wyślij nauczycielom link do formularza (zakładka Ustawienia) albo dodaj szkołę ręcznie.</div>`;
      return;
    }
    if (!list.length) {
      $('#subs-list').innerHTML = `<div class="card empty">Brak wyników dla „${esc(state.subsSearch)}”.</div>`;
      return;
    }
    $('#subs-list').innerHTML = list.map(schoolCard).join('');
  }

  function schoolCard(s) {
    const t = M.SCHOOL_TYPES[s.schoolType] || M.SCHOOL_TYPES.sp;
    const open = state.open.has(s.id) || !!state.subsSearch;
    const inactive = s.active === false;
    const byGrade = {};
    (s.students || []).forEach(st => { byGrade[st.grade] = (byGrade[st.grade] || 0) + 1; });
    const chips = Object.keys(byGrade).sort((a, b) => a - b).map(g => `<span class="chip">kl. ${g}: <b>${byGrade[g]}</b></span>`).join('');
    let body = '';
    if (open) {
      const rows = (s.students || []).slice().sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, 'pl')).map((st, i) => {
        const gi = state.groupOf.get(st.id);
        let partner = '<span class="muted">—</span>';
        if (gi != null) {
          const a = analyze(state.matching.groups[gi]);
          partner = a.members.filter(p => p.id !== st.id).map(p => `${esc(p.name)} <span class="muted">(${esc(p.cls)}, ${esc(p.sub.school)})</span>`).join('<br>');
          const me = a.infos[a.members.findIndex(p => p.id === st.id)];
          if (!me.ageOk) partner += ` <span class="chip chip-bad">inna klasa</span>`;
        } else if (!inactive && state.matching) {
          partner = '<span class="chip chip-warn">bez pary</span>';
        }
        return `<tr><td class="muted">${i + 1}</td><td>${esc(st.name)}</td><td><b>${esc(classDisplay(s, st))}</b></td><td>${partner}</td></tr>`;
      }).join('');
      body = `<div class="school-body">
        ${s.note ? `<div class="notice" style="margin-bottom:12px"><b>Uwagi:</b> ${esc(s.note)}</div>` : ''}
        <table class="mini-table"><thead><tr><th>#</th><th>Uczeń</th><th>Klasa</th><th>Korespondent</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="row" style="margin-top:14px">
          <button class="btn btn-sm" data-act="edit">Edytuj</button>
          <button class="btn btn-sm btn-ghost" data-act="toggle">${inactive ? 'Włącz do dopasowania' : 'Wyłącz z dopasowania'}</button>
          ${s.email ? `<a class="btn btn-sm btn-ghost" href="mailto:${esc(s.email)}">Napisz e-mail</a>` : ''}
          <span class="spacer"></span>
          <button class="btn btn-sm btn-ghost" data-act="delete" style="color:var(--bad)">Usuń zgłoszenie</button>
        </div>
      </div>`;
    }
    return `<div class="card school${inactive ? ' inactive' : ''}" data-sid="${esc(s.id)}">
      <div class="school-head" data-act="expand" role="button" tabindex="0" aria-expanded="${open}">
        <div class="avatar" style="background:hsl(${hue(s.school)} 45% 48%)">${esc(t.short)}</div>
        <div class="info">
          <h3>${esc(s.school)}${inactive ? ' <span class="chip chip-warn">wyłączona</span>' : ''}</h3>
          <div class="meta">${s.city ? esc(s.city) + ' · ' : ''}Opiekun: <b>${esc(s.guardian)}</b>${s.email ? ' · ' + esc(s.email) : ''} · ${esc(fmtDate(s.createdAt))}${s.updatedAt ? ' (edyt.)' : ''}</div>
        </div>
        <div class="class-chips">${chips}</div>
        <span class="chip chip-accent">${plural((s.students || []).length, 'uczeń', 'uczniów', 'uczniów')}</span>
        <span style="color:var(--text-3);transform:rotate(${open ? 180 : 0}deg);transition:transform .2s">${ICON.chevron}</span>
      </div>
      ${body}
    </div>`;
  }

  $('#subs-list').addEventListener('click', async e => {
    const actEl = e.target.closest('[data-act]');
    if (!actEl || e.target.closest('a')) return;
    const sid = actEl.closest('[data-sid]').dataset.sid;
    const sub = state.submissions.find(s => s.id === sid);
    const act = actEl.dataset.act;
    if (act === 'expand') {
      state.open.has(sid) ? state.open.delete(sid) : state.open.add(sid);
      renderSubs();
    } else if (act === 'edit') {
      openEditor(sub);
    } else if (act === 'toggle') {
      try {
        await API.saveSubmission({ ...sub, active: sub.active === false });
        await reload();
      } catch (err) { handleError(err); }
    } else if (act === 'delete') {
      if (!await confirmDialog(`Usunąć zgłoszenie „${sub.school}” (${plural(sub.students.length, 'uczeń', 'uczniów', 'uczniów')})? Tej operacji nie można cofnąć.`, { okText: 'Usuń', danger: true })) return;
      try {
        await API.deleteSubmission(sid);
        toast('Usunięto zgłoszenie', 'ok');
        await reload();
      } catch (err) { handleError(err); }
    }
  });
  $('#subs-list').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.school-head')) { e.preventDefault(); e.target.click(); }
  });

  $('#subs-search').addEventListener('input', e => { state.subsSearch = e.target.value.trim(); renderSubs(); });
  $('#expand-all').addEventListener('click', () => {
    const all = state.open.size < state.submissions.length;
    state.open = new Set(all ? state.submissions.map(s => s.id) : []);
    $('#expand-all').textContent = all ? 'Zwiń wszystkie' : 'Rozwiń wszystkie';
    renderSubs();
  });

  // edycja zgłoszenia
  const editDialog = $('#edit-dialog');
  const editEditor = new SubmissionEditor($('#edit-editor'));
  let editingSub = null;
  function openEditor(sub) {
    editingSub = sub || null;
    $('#edit-title').textContent = sub ? `Edycja: ${sub.school}` : 'Nowa szkoła';
    editEditor.setData(sub || { schoolType: 'sp', students: [] });
    editDialog.showModal();
  }
  $('#add-school').addEventListener('click', () => openEditor(null));
  $('#edit-cancel').addEventListener('click', () => editDialog.close());
  $('#edit-save').addEventListener('click', async () => {
    const data = editEditor.getData();
    if (!data) return;
    try {
      await API.saveSubmission({ ...data, id: editingSub?.id, active: editingSub ? editingSub.active !== false : true });
      editDialog.close();
      toast('Zapisano', 'ok');
      await reload();
    } catch (err) { handleError(err); }
  });

  // ---------------------------------------------------------------------------
  // DOPASOWANIE
  // ---------------------------------------------------------------------------
  const penaltyInput = $('#penalty');
  penaltyInput.value = pref.get('penalty', '2');
  function renderPenalty() {
    const [label, help] = PENALTY_LABELS[+penaltyInput.value];
    $('#penalty-val').textContent = label;
    $('#penalty-help').textContent = help;
  }
  penaltyInput.addEventListener('input', () => { pref.set('penalty', penaltyInput.value); renderPenalty(); });
  renderPenalty();

  $('#match-all').addEventListener('click', () => runMatch(false));
  $('#match-new').addEventListener('click', () => runMatch(true));

  async function runMatch(onlyNew) {
    const people = [...state.people.values()];
    if (people.length < 2) { toast('Za mało uczniów do dopasowania.', 'error'); return; }
    const penalty = penaltyValue(penaltyInput.value);
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const now = new Date().toISOString();
    if (onlyNew && state.matching?.groups.length) {
      const groups = state.matching.groups.map(g => g.slice());
      const fresh = unmatchedPeople();
      if (!fresh.length) { toast('Wszyscy uczniowie mają już pary.'); return; }
      const r = M.match(fresh, { sameSchoolPenalty: penalty, seed, existingGroups: groups, lookup: state.people });
      state.matching = { ...state.matching, groups: groups.concat(r.groups) };
      const n = fresh.length - r.unmatched.length;
      toast(n ? `Dopasowano ${plural(n, 'nową osobę', 'nowe osoby', 'nowych osób')}` : 'Nie udało się dopasować nowych osób', n ? 'ok' : 'error');
    } else {
      if (state.matching?.groups.length &&
          !await confirmDialog('Utworzyć dopasowanie od nowa? Obecne pary (także ręczne zmiany) zostaną zastąpione nowymi.', { okText: 'Dopasuj od nowa' })) return;
      const r = M.match(people, { sameSchoolPenalty: penalty, seed });
      state.matching = { createdAt: now, seed, penalty: +penaltyInput.value, groups: r.groups };
      toast(`Utworzono ${plural(r.groups.length, 'parę', 'pary', 'par')}`, 'ok');
    }
    state.removedCount = 0;
    state.selected = [];
    indexGroups();
    await saveMatching();
    renderMatch();
    renderSubs();
  }

  function renderMatch() {
    const m = state.matching;
    const unmatched = unmatchedPeople();
    const notices = [];
    if (state.removedCount) {
      notices.push(`<div class="notice notice-warn" style="margin-bottom:12px">${plural(state.removedCount, 'osoba została usunięta', 'osoby zostały usunięte', 'osób zostało usuniętych')} z dopasowania, bo jej zgłoszenie usunięto lub wyłączono. Sprawdź pary poniżej.</div>`);
    }
    if (m?.groups.length && unmatched.length) {
      notices.push(`<div class="notice notice-warn" style="margin-bottom:12px"><b>${plural(unmatched.length, 'osoba nie ma', 'osoby nie mają', 'osób nie ma')} pary</b> (np. z nowych zgłoszeń). Kliknij <b>Dopasuj nowych</b> – istniejące pary zostaną bez zmian.</div>`);
    }
    $('#match-notices').innerHTML = notices.join('');
    $('#match-new').disabled = !m?.groups.length;

    if (!m || !m.groups.length) {
      $('#match-stats').innerHTML = '';
      $('#match-content').innerHTML = `<div class="card empty">
        <p><b>Nie ma jeszcze dopasowania.</b></p>
        <p>${state.people.size ? `Masz ${plural(state.people.size, 'ucznia', 'uczniów', 'uczniów')} z ${plural(new Set([...state.people.values()].map(p => p.school)).size, 'szkoły', 'szkół', 'szkół')}. Kliknij <b>Dopasuj wszystkich</b>.` : 'Najpierw zbierz zgłoszenia szkół.'}</p>
        <p class="small">Algorytm łączy rówieśników z różnych szkół. Jeśli dla kogoś zabraknie osoby w tym samym wieku, dobierze kogoś z klasy starszej lub młodszej i <b style="color:var(--bad)">oznaczy tę osobę na czerwono</b>.</p>
      </div>`;
      return;
    }

    const analyses = m.groups.map(analyze);
    const matchedCount = analyses.reduce((n, a) => n + a.members.length, 0);
    const flaggedPeople = analyses.reduce((n, a) => n + a.infos.filter(i => !i.ageOk).length, 0);
    const okGroups = analyses.filter(a => a.ageOk).length;
    $('#match-stats').innerHTML = [
      [m.groups.length, 'par / grup', ''],
      [`${Math.round((okGroups / m.groups.length) * 100)}%`, 'par w tym samym wieku', 'stat-ok'],
      [flaggedPeople, 'osób z inną klasą', flaggedPeople ? 'stat-bad' : ''],
      [analyses.filter(a => a.sameSchool).length, 'par z tej samej szkoły', ''],
      [analyses.filter(a => a.trio).length, 'grup 3-osobowych', ''],
      [unmatched.length, 'bez pary', unmatched.length ? 'stat-bad' : ''],
    ].map(([v, l, c]) => `<div class="stat ${c}"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('');

    const filters = [['all', 'Wszystkie'], ['flagged', 'Inna klasa'], ['same', 'Ta sama szkoła'], ['trio', 'Trójki']];
    $('#match-content').innerHTML = `
      <div class="toolbar">
        <input type="search" id="match-search" placeholder="Szukaj ucznia lub szkoły…" value="${esc(state.search)}">
        <div class="seg" role="group" aria-label="Filtr">${filters.map(([k, l]) => `<button data-filter="${k}" aria-pressed="${state.filter === k}">${l}</button>`).join('')}</div>
        <span class="spacer"></span>
        <button class="btn btn-sm" id="export-csv">Eksport CSV</button>
        <button class="btn btn-primary btn-sm" id="print">Drukuj</button>
      </div>
      <div class="row" style="margin-bottom:14px">
        <div class="legend"><span><i class="bad"></i>brak rówieśnika – dopasowano z klasą starszą/młodszą</span><span>Kliknij dwie osoby, aby je zamienić lub połączyć.</span></div>
        <span class="spacer"></span>
        <span class="muted small">Dopasowano: ${esc(fmtDate(m.createdAt))}${m.updatedAt && fmtDate(m.updatedAt) !== fmtDate(m.createdAt) ?` · zmiany: ${esc(fmtDate(m.updatedAt))}` : ''} · ${plural(matchedCount, 'osoba', 'osoby', 'osób')}</span>
      </div>
      <div class="pairs" id="pairs"></div>
      <div id="unmatched"></div>
      <div id="selection"></div>`;

    $('#match-search').addEventListener('input', e => { state.search = e.target.value.trim(); renderPairs(); });
    $$('[data-filter]').forEach(b => b.addEventListener('click', () => {
      state.filter = b.dataset.filter;
      $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderPairs();
    }));
    $('#print').addEventListener('click', openPrint);
    $('#export-csv').addEventListener('click', exportCsv);
    renderPairs();
  }

  function personHtml(p, info) {
    const flags = [];
    if (!info.ageOk) {
      const dir = info.withOlder && info.withYounger ? 'starszą i młodszą' : info.withOlder ? 'starszą' : 'młodszą';
      flags.push(`<div class="flag">${ICON.warn}<span>Brak rówieśnika – dopasowano z klasą ${dir}${info.maxDiff > 1 ? ` (różnica ${info.maxDiff} kl.)` : ''}</span></div>`);
    }
    if (info.sameSchool) flags.push(`<div class="flag soft">${ICON.school}<span>Ta sama szkoła</span></div>`);
    const sel = state.selected.includes(p.id);
    return `<div class="person${info.ageOk ? '' : ' mismatch'}${sel ? ' selected' : ''}" data-pid="${esc(p.id)}" role="button" tabindex="0" aria-pressed="${sel}">
      <div class="n">${esc(p.name)}</div>
      <div class="c"><span class="cls">${esc(p.cls)}</span>${esc(p.sub.school)}${p.sub.city ? ', ' + esc(p.sub.city) : ''}</div>
      ${flags.join('')}
    </div>`;
  }

  function renderPairs() {
    const m = state.matching;
    const q = state.search.toLowerCase();
    let html = '';
    let shown = 0;
    m.groups.forEach((g, i) => {
      const a = analyze(g);
      if (state.filter === 'flagged' && a.ageOk) return;
      if (state.filter === 'same' && !a.sameSchool) return;
      if (state.filter === 'trio' && !a.trio) return;
      if (q && !a.members.some(p => `${p.name} ${p.sub.school} ${p.sub.city || ''} ${p.cls}`.toLowerCase().includes(q))) return;
      shown++;
      const chips = [
        a.ageOk ? '<span class="chip chip-ok">ten sam wiek</span>' : '<span class="chip chip-bad">różny wiek</span>',
        a.trio ? '<span class="chip chip-warn">grupa 3-osobowa</span>' : '',
      ].join('');
      const members = a.members.map((p, k) => personHtml(p, a.infos[k]));
      html += `<div class="pair${a.trio ? ' trio' : ''}${a.ageOk ? '' : ' has-mismatch'}">
        <div class="pair-top"><span class="no">${a.trio ? 'Grupa' : 'Para'} ${i + 1}</span><span class="spacer"></span>${chips}</div>
        <div class="pair-members">${a.trio ? members.join('') : `${members[0]}<div class="link-icon">${ICON.link}</div>${members[1]}`}</div>
      </div>`;
    });
    $('#pairs').innerHTML = html || '<div class="card empty" style="grid-column:1/-1">Brak par dla wybranego filtra.</div>';

    const un = unmatchedPeople();
    $('#unmatched').innerHTML = un.length ? `
      <div class="card-head" style="margin:26px 0 10px"><h2>Bez pary <span class="chip chip-bad">${un.length}</span></h2>
      <span class="muted small">Zaznacz osobę i drugą osobę z listy lub z pary, aby połączyć.</span></div>
      <div class="pairs">${un.map(p => personHtml(p, { ageOk: true })).join('')}</div>` : '';
    renderSelection();
    return shown;
  }

  // wybór osób i ręczne poprawki
  $('#match-content').addEventListener('click', e => {
    const el = e.target.closest('.person');
    if (!el) return;
    togglePerson(el.dataset.pid);
  });
  $('#match-content').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.person')) { e.preventDefault(); togglePerson(e.target.dataset.pid); }
  });

  function togglePerson(id) {
    const i = state.selected.indexOf(id);
    if (i >= 0) state.selected.splice(i, 1);
    else {
      state.selected.push(id);
      if (state.selected.length > 2) state.selected.shift();
    }
    $$('.person').forEach(el => {
      const sel = state.selected.includes(el.dataset.pid);
      el.classList.toggle('selected', sel);
      el.setAttribute('aria-pressed', String(sel));
    });
    renderSelection();
  }

  function renderSelection() {
    const box = $('#selection');
    if (!box) return;
    const sel = state.selected.map(id => state.people.get(id)).filter(Boolean);
    state.selected = sel.map(p => p.id);
    if (!sel.length) { box.innerHTML = ''; return; }
    const g = sel.map(p => state.groupOf.get(p.id));
    const names = sel.map(p => `<b>${esc(p.name)}</b>`).join(' i ');
    const actions = [];
    let hint = '';
    if (sel.length === 1) {
      hint = g[0] != null ? 'wybierz drugą osobę, aby zamienić' : 'wybierz osobę, z którą połączyć';
      if (g[0] != null) actions.push(['remove', 'Wyjmij z pary']);
    } else if (g[0] != null && g[1] != null) {
      if (g[0] === g[1]) hint = 'te osoby są już w jednej grupie';
      else actions.push(['swap', 'Zamień miejscami', true]);
    } else if (g[0] == null && g[1] == null) {
      actions.push(['pair', 'Połącz w parę', true]);
    } else {
      actions.push(['join', 'Dołącz do tej grupy', true], ['replace', 'Wymień osoby']);
    }
    box.innerHTML = `<div class="selection-bar"><span>${names}${hint ? ` <span style="opacity:.7">– ${hint}</span>` : ''}</span>
      ${actions.map(([k, l, p]) => `<button class="btn btn-sm${p ? ' btn-primary' : ''}" data-sel="${k}">${l}</button>`).join('')}
      <button class="btn btn-sm" data-sel="clear">Anuluj</button></div>`;
  }

  $('#match-content').addEventListener('click', async e => {
    const b = e.target.closest('[data-sel]');
    if (!b) return;
    const act = b.dataset.sel;
    const groups = state.matching.groups;
    const [a, c] = state.selected;
    const ga = state.groupOf.get(a), gc = state.groupOf.get(c);
    if (act === 'swap') {
      groups[ga][groups[ga].indexOf(a)] = c;
      groups[gc][groups[gc].indexOf(c)] = a;
    } else if (act === 'pair') {
      groups.push([a, c]);
    } else if (act === 'join' || act === 'replace') {
      const [inGroup, loose] = ga != null ? [a, c] : [c, a];
      const gi = state.groupOf.get(inGroup);
      if (act === 'join') groups[gi].push(loose);
      else groups[gi][groups[gi].indexOf(inGroup)] = loose;
    } else if (act === 'remove') {
      groups[ga].splice(groups[ga].indexOf(a), 1);
      if (groups[ga].length < 2) groups.splice(ga, 1);
    }
    state.selected = [];
    if (act !== 'clear') {
      indexGroups();
      renderMatch();
      renderSubs();
      await saveMatching();
      toast('Zapisano zmianę', 'ok');
    } else {
      $$('.person.selected').forEach(el => el.classList.remove('selected'));
      renderSelection();
    }
  });

  // ---------------------------------------------------------------------------
  // Wydruk i eksport
  // ---------------------------------------------------------------------------
  const printDialog = $('#print-dialog');
  function openPrint() {
    const schools = state.submissions.filter(s => s.active !== false).sort((a, b) => a.school.localeCompare(b.school, 'pl'));
    $('#print-school').innerHTML = '<option value="">Wszystkie szkoły</option>' +
      schools.map(s => `<option value="${esc(s.id)}">${esc(s.school)}</option>`).join('');
    printDialog.showModal();
  }
  $('#print-cancel').addEventListener('click', () => printDialog.close());
  $('#print-go').addEventListener('click', () => {
    const mode = $('input[name=pmode]:checked', printDialog).value;
    const schoolId = $('#print-school').value;
    $('#print-root').innerHTML = mode === 'pairs' ? printPairs(schoolId) : printSchools(schoolId);
    printDialog.close();
    setTimeout(() => window.print(), 50);
  });

  function flagText(info) {
    if (info.ageOk) return '';
    const dir = info.withOlder && info.withYounger ? 'starszą i młodszą' : info.withOlder ? 'starszą' : 'młodszą';
    return `Brak rówieśnika – dopasowano z klasą ${dir}${info.maxDiff > 1 ? ` (różnica ${info.maxDiff} kl.)` : ''}`;
  }

  function printHeader(title, sub) {
    return `<div class="pr-head"><h1>${esc(title)}</h1><div class="sub">${sub}</div></div>`;
  }

  const LEGEND = '<div class="pr-legend"><span></span> Uczeń podkreślony na czerwono – w projekcie zabrakło rówieśnika, dlatego dopasowano go z klasą starszą lub młodszą.</div>';

  function printSchools(onlyId) {
    const project = state.settings.projectName || 'Listy przyjaźni';
    const today = new Date().toLocaleDateString('pl-PL');
    const schools = state.submissions.filter(s => s.active !== false && (!onlyId || s.id === onlyId))
      .sort((a, b) => a.school.localeCompare(b.school, 'pl'));
    return schools.map(s => {
      const students = (s.students || []).slice().sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, 'pl'));
      let anyBad = false;
      const rows = students.map((st, i) => {
        const gi = state.groupOf.get(st.id);
        if (gi == null) return `<tr class="bad"><td>${i + 1}</td><td class="who">${esc(st.name)}<span class="pr-note">Brak pary</span></td><td>${esc(classDisplay(s, st))}</td><td colspan="3">—</td></tr>`;
        const a = analyze(state.matching.groups[gi]);
        const k = a.members.findIndex(p => p.id === st.id);
        const info = a.infos[k];
        if (!info.ageOk) anyBad = true;
        const others = a.members.filter(p => p.id !== st.id);
        return `<tr class="${info.ageOk ? '' : 'bad'}">
          <td>${i + 1}</td>
          <td class="who">${esc(st.name)}${info.ageOk ? '' : `<span class="pr-note">${esc(flagText(info))}</span>`}</td>
          <td>${esc(classDisplay(s, st))}</td>
          <td>${others.map(p => `<b>${esc(p.name)}</b>`).join('<br>')}</td>
          <td>${others.map(p => esc(p.cls)).join('<br>')}</td>
          <td>${others.map(p => `${esc(p.sub.school)}${p.sub.city ? ', ' + esc(p.sub.city) : ''}<br><small>opiekun: ${esc(p.sub.guardian)}${p.sub.email ? ', ' + esc(p.sub.email) : ''}</small>`).join('<br>')}</td>
        </tr>`;
      }).join('');
      return `<section class="pr-page">
        ${printHeader(project, `<b>${esc(s.school)}</b>${s.city ? ', ' + esc(s.city) : ''} · opiekun: ${esc(s.guardian)} · ${plural(students.length, 'uczeń', 'uczniów', 'uczniów')} · ${today}`)}
        ${anyBad ? LEGEND : ''}
        <table class="pr-table"><thead><tr><th style="width:26px">#</th><th>Uczeń</th><th style="width:60px">Klasa</th><th>Korespondent</th><th style="width:60px">Klasa</th><th>Szkoła korespondenta</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="pr-foot">Wygenerowano w panelu projektu „${esc(project)}”.</div>
      </section>`;
    }).join('') || '<p>Brak danych do wydruku.</p>';
  }

  function printPairs(onlyId) {
    const project = state.settings.projectName || 'Listy przyjaźni';
    const cell = (p, info) => `<div class="${info.ageOk ? '' : 'who'}" style="${info.ageOk ? '' : 'color:#c00000;font-weight:700;text-decoration:underline'}">${esc(p.name)} <span style="font-weight:400">(kl. ${esc(p.cls)})</span></div>
      <small>${esc(p.sub.school)}${p.sub.city ? ', ' + esc(p.sub.city) : ''}</small>${info.ageOk ? '' : `<span class="pr-note">${esc(flagText(info))}</span>`}`;
    let anyBad = false;
    const rows = state.matching.groups.map((g, i) => {
      const a = analyze(g);
      if (onlyId && !a.members.some(p => p.school === onlyId)) return '';
      if (!a.ageOk) anyBad = true;
      return `<tr class="${a.ageOk ? '' : 'bad'}"><td>${i + 1}</td>${a.members.slice(0, 2).map((p, k) => `<td>${cell(p, a.infos[k])}</td>`).join('')}
        <td>${a.members[2] ? cell(a.members[2], a.infos[2]) : ''}</td></tr>`;
    }).join('');
    const title = onlyId ? state.submissions.find(s => s.id === onlyId)?.school : 'Wszystkie pary';
    return `<section class="pr-page">
      ${printHeader(project, `${esc(title)} · ${plural(state.matching.groups.length, 'para', 'pary', 'par')} · ${new Date().toLocaleDateString('pl-PL')}`)}
      ${anyBad ? LEGEND : ''}
      <table class="pr-table"><thead><tr><th style="width:30px">Nr</th><th>Osoba 1</th><th>Osoba 2</th><th style="width:22%">Osoba 3 (grupa)</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
  }

  function exportCsv() {
    const cols = ['Nr pary', 'Szkoła', 'Miejscowość', 'Opiekun', 'Uczeń', 'Klasa', 'Korespondent', 'Klasa korespondenta', 'Szkoła korespondenta', 'Opiekun korespondenta', 'E-mail opiekuna korespondenta', 'Uwagi'];
    const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [cols.map(q).join(';')];
    state.matching.groups.forEach((g, i) => {
      const a = analyze(g);
      a.members.forEach((p, k) => {
        const others = a.members.filter(o => o !== p);
        const notes = [flagText(a.infos[k]), a.infos[k].sameSchool ? 'ta sama szkoła' : '', a.trio ? 'grupa 3-osobowa' : ''].filter(Boolean).join('; ');
        lines.push([i + 1, p.sub.school, p.sub.city, p.sub.guardian, p.name, p.cls,
          others.map(o => o.name).join(' / '), others.map(o => o.cls).join(' / '), others.map(o => o.sub.school).join(' / '),
          others.map(o => o.sub.guardian).join(' / '), others.map(o => o.sub.email).join(' / '), notes].map(q).join(';'));
      });
    });
    unmatchedPeople().forEach(p => lines.push(['', p.sub.school, p.sub.city, p.sub.guardian, p.name, p.cls, '', '', '', '', '', 'BRAK PARY'].map(q).join(';')));
    download(`dopasowanie-${slug(state.settings.projectName || 'listy')}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  // ---------------------------------------------------------------------------
  // USTAWIENIA
  // ---------------------------------------------------------------------------
  function renderSettings() {
    const f = $('#settings-form');
    f.projectName.value = state.settings.projectName || '';
    f.intro.value = state.settings.intro || '';
    f.deadline.value = state.settings.deadline || '';
    f.formOpen.checked = state.settings.formOpen !== false;
    const url = new URL('index.html', location.href).href;
    $('#form-url').value = url;
    $('#embed-code').value = `<iframe src="${url}" title="Zgłoszenie szkoły" style="width:100%;min-height:1500px;border:0"></iframe>`;
  }

  $('#settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    try {
      await API.saveSettings({ projectName: f.projectName.value.trim(), intro: f.intro.value.trim(), deadline: f.deadline.value, formOpen: f.formOpen.checked });
      toast('Zapisano ustawienia', 'ok');
      await reload();
    } catch (err) { handleError(err); }
  });

  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const inp = $(b.dataset.copy);
    try { await navigator.clipboard.writeText(inp.value); } catch (e) { inp.select(); document.execCommand('copy'); }
    toast('Skopiowano', 'ok');
  }));

  $('#backup').addEventListener('click', () => {
    const data = { exportedAt: new Date().toISOString(), settings: state.settings, submissions: state.submissions, matching: state.matching };
    download(`penpal-kopia-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
  });

  $('#restore').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.submissions)) throw new Error('To nie jest plik kopii zapasowej PenPal.');
      if (!await confirmDialog(`Przywrócić kopię z pliku „${file.name}” (${plural(data.submissions.length, 'szkoła', 'szkoły', 'szkół')})? Obecne dane zostaną zastąpione.`, { okText: 'Przywróć', danger: true })) return;
      await API.importDb(data);
      toast('Przywrócono dane', 'ok');
      await reload();
    } catch (err) { handleError(err); }
  });

  $('#demo').addEventListener('click', async () => {
    if (!await confirmDialog('Dodać 6 przykładowych szkół z losowymi uczniami? Przydatne do wypróbowania dopasowania.', { okText: 'Dodaj' })) return;
    const first = ['Ania', 'Kasia', 'Zosia', 'Ola', 'Maja', 'Lena', 'Julia', 'Hania', 'Wiktoria', 'Natalia', 'Kuba', 'Antek', 'Franek', 'Szymon', 'Filip', 'Janek', 'Staś', 'Tymon', 'Olek', 'Igor', 'Michał', 'Bartek'];
    const last = 'ABCDEFGHIJKLMNOPRSTWZ';
    const schools = [
      ['Szkoła Podstawowa nr 3', 'Kraków', 'sp', 'Anna Kowalska', [4, 5, 5, 6]],
      ['Szkoła Podstawowa im. Kopernika', 'Toruń', 'sp', 'Piotr Nowak', [5, 6, 7]],
      ['SP nr 12', 'Gdańsk', 'sp', 'Ewa Wiśniewska', [4, 7, 8]],
      ['Zespół Szkół w Lipnie', 'Lipno', 'sp', 'Marek Zając', [3, 5, 8]],
      ['I Liceum Ogólnokształcące', 'Poznań', 'lo', 'Barbara Lis', [1, 2]],
      ['Szkoła Podstawowa nr 1', 'Opole', 'sp', 'Tomasz Wójcik', [6, 6, 7]],
    ];
    const r = () => Math.random();
    try {
      for (const [school, city, schoolType, guardian, grades] of schools) {
        const students = [];
        grades.forEach(g => {
          const n = 2 + Math.floor(r() * 5);
          const section = 'abc'[Math.floor(r() * 3)];
          for (let i = 0; i < n; i++) students.push({ id: PP.uid(), name: `${first[Math.floor(r() * first.length)]} ${last[Math.floor(r() * last.length)]}.`, grade: g, section });
        });
        await API.saveSubmission({ school, city, schoolType, guardian, email: '', note: '', students, active: true });
      }
      toast('Dodano przykładowe szkoły', 'ok');
      await reload();
    } catch (err) { handleError(err); }
  });

  // ---------------------------------------------------------------------------
  try {
    await start();
  } catch (err) {
    handleError(err);
    $('#login').classList.remove('hidden');
  }
})();

/* PenPal – edytor zgłoszenia szkoły (formularz nauczyciela + edycja w panelu). */
(function () {
  'use strict';
  const { $, $$, esc, uid, plural } = PP;
  const M = PenpalMatcher;

  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';

  const TEMPLATE = `
    <div class="grid grid-2">
      <label class="field"><span>Nazwa szkoły</span><input name="school" required maxlength="160" placeholder="np. Szkoła Podstawowa nr 5 im. M. Konopnickiej"></label>
      <label class="field"><span>Miejscowość <em>(opcjonalnie)</em></span><input name="city" maxlength="80" placeholder="np. Kraków"></label>
      <label class="field"><span>Typ szkoły</span><select name="schoolType">
        ${Object.entries(M.SCHOOL_TYPES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join('')}
      </select></label>
      <label class="field"><span>Opiekun szkolny (imię i nazwisko)</span><input name="guardian" required maxlength="100" placeholder="np. Anna Kowalska"></label>
      <label class="field"><span>E-mail opiekuna <em>(do kontaktu)</em></span><input name="email" type="email" maxlength="120" placeholder="nauczyciel@szkola.pl"></label>
      <label class="field"><span>Uwagi <em>(opcjonalnie)</em></span><input name="note" maxlength="1000" placeholder="np. dwie osoby chcą pisać po angielsku"></label>
    </div>
    <div class="card-head" style="margin:26px 0 8px">
      <h2>Uczestnicy <span class="chip chip-accent js-count">0</span></h2>
      <div class="row">
        <button type="button" class="btn btn-ghost btn-sm js-paste">Wklej listę</button>
        <button type="button" class="btn btn-sm js-add">+ Dodaj ucznia</button>
      </div>
    </div>
    <p class="muted small" style="margin-bottom:6px">Wpisz <b>tylko imię</b> (a gdy w klasie jest kilka takich samych — dodaj pierwszą literę nazwiska, np. „Ania K."), klasę i oddział. Nie podawaj pełnych nazwisk. Klasa jest potrzebna do dopasowania rówieśników.</p>
    <table class="students">
      <thead><tr><th></th><th>Imię</th><th>Klasa</th><th>Oddział</th><th></th></tr></thead>
      <tbody></tbody>
    </table>
    <div class="empty js-empty">Brak uczniów – dodaj pierwszą osobę lub wklej całą listę.</div>
    <div class="class-chips js-chips" style="margin-top:10px"></div>`;

  function pasteDialog() {
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'modal';
      d.innerHTML = `
        <div class="modal-head"><h2>Wklej listę uczniów</h2></div>
        <div class="modal-body">
          <p class="muted small">Każdy uczeń w osobnej linii. Klasa na końcu linii, np.:<br>
          <code>Anna Nowak 5a</code> &nbsp; <code>Jan K.; 6b</code> &nbsp; <code>Ola Wiśniewska, IIIc</code> — można też wkleić dwie kolumny z Excela.</p>
          <label class="field"><span>Domyślna klasa <em>(dla linii bez klasy)</em></span>
            <input class="js-def" placeholder="np. 5a" style="max-width:160px"></label>
          <label class="field" style="margin-top:12px"><span>Lista</span><textarea rows="10" class="js-text" placeholder="Anna Nowak 5a&#10;Jan Kowalski 5b&#10;Zosia Lis 6a"></textarea></label>
          <div class="js-preview small" style="margin-top:10px"></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" value="cancel">Anuluj</button>
          <button class="btn btn-primary js-ok" value="ok" disabled>Dodaj</button>
        </div>`;
      document.body.appendChild(d);
      const ta = $('.js-text', d), def = $('.js-def', d), prev = $('.js-preview', d), ok = $('.js-ok', d);
      let parsed = [];
      const update = () => {
        parsed = parseList(ta.value, def.value);
        const good = parsed.filter(p => p.cls), bad = parsed.filter(p => !p.cls);
        ok.disabled = !parsed.length;
        ok.textContent = parsed.length ? `Dodaj ${plural(parsed.length, 'ucznia', 'uczniów', 'uczniów')}` : 'Dodaj';
        prev.innerHTML = parsed.length
          ? `<span class="chip chip-ok">${good.length} z klasą</span> ` +
            (bad.length ? `<span class="chip chip-warn">${bad.length} bez klasy – uzupełnisz w tabeli</span>` : '')
          : '';
      };
      ta.addEventListener('input', update);
      def.addEventListener('input', update);
      d.addEventListener('click', e => {
        const v = e.target.closest('button')?.value;
        if (v) d.close(v);
      });
      d.addEventListener('close', () => { resolve(d.returnValue === 'ok' ? parsed : null); d.remove(); });
      d.showModal();
      ta.focus();
    });
  }

  function parseList(text, defaultClass) {
    const def = M.parseClass(defaultClass);
    return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
      line = line.replace(/^\d+[.)]\s*/, ''); // numeracja "1. "
      const parts = line.split(/\s*[\t;,|]\s*|\s+/).filter(Boolean);
      // klasa może zajmować 1 lub 2 ostatnie tokeny ("5a" albo "5 a" / "kl. 5a")
      for (const take of [1, 2]) {
        if (parts.length <= take) continue;
        const cls = M.parseClass(parts.slice(-take).join(' '));
        if (cls) return { name: parts.slice(0, -take).join(' ').replace(/\s*(kl\.?|klasa)$/i, ''), cls };
      }
      return { name: parts.join(' '), cls: def };
    });
  }

  class SubmissionEditor {
    constructor(root) {
      this.root = root;
      root.innerHTML = TEMPLATE;
      this.tbody = $('tbody', root);
      this.typeSel = $('[name=schoolType]', root);
      root.addEventListener('input', () => this.refresh());
      this.typeSel.addEventListener('change', () => this.onTypeChange());
      $('.js-add', root).addEventListener('click', () => { this.addRow(); $('tr:last-child input', this.tbody).focus(); });
      $('.js-paste', root).addEventListener('click', async () => {
        const list = await pasteDialog();
        if (!list) return;
        // usuń pusty pierwszy wiersz, jeśli taki był
        $$('tr', this.tbody).forEach(tr => { if (!$('.js-name', tr).value.trim()) tr.remove(); });
        list.forEach(p => this.addRow({ name: p.name, grade: p.cls?.grade, section: p.cls?.section }));
        this.refresh();
      });
      this.tbody.addEventListener('click', e => {
        if (e.target.closest('.js-del')) {
          e.target.closest('tr').remove();
          this.refresh();
        }
      });
      this.tbody.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.matches('input')) {
          e.preventDefault();
          const tr = e.target.closest('tr');
          if (!tr.nextElementSibling) this.addRow({ grade: $('.js-grade', tr).value, section: $('.js-section', tr).value });
          $('.js-name', tr.nextElementSibling).focus();
        }
      });
    }

    get maxGrade() {
      return M.SCHOOL_TYPES[this.typeSel.value]?.grades || 8;
    }

    gradeOptions(selected) {
      let h = '<option value="">–</option>';
      for (let g = 1; g <= this.maxGrade; g++) h += `<option value="${g}"${+selected === g ? ' selected' : ''}>${g}</option>`;
      return h;
    }

    addRow(st = {}) {
      const tr = document.createElement('tr');
      tr.dataset.id = st.id || uid();
      tr.innerHTML = `
        <td class="num"></td>
        <td class="name"><input class="js-name" maxlength="80" placeholder="Imię (np. Ania K.)" aria-label="Imię" value="${esc(st.name || '')}"></td>
        <td class="grade"><select class="js-grade" aria-label="Klasa">${this.gradeOptions(st.grade)}</select></td>
        <td class="section"><input class="js-section" maxlength="3" placeholder="a" aria-label="Oddział" value="${esc(st.section || '')}"></td>
        <td class="del"><button type="button" class="btn btn-ghost btn-icon js-del" title="Usuń" aria-label="Usuń ucznia">${ICON_TRASH}</button></td>`;
      this.tbody.appendChild(tr);
      this.refresh();
      return tr;
    }

    onTypeChange() {
      $$('.js-grade', this.tbody).forEach(sel => {
        const v = sel.value;
        sel.innerHTML = this.gradeOptions(v);
      });
      this.refresh();
    }

    refresh() {
      const rows = $$('tr', this.tbody);
      rows.forEach((tr, i) => { $('.num', tr).textContent = i + 1; });
      $('.js-empty', this.root).classList.toggle('hidden', rows.length > 0);
      const students = this.students().filter(s => s.name);
      $('.js-count', this.root).textContent = students.length;
      const byClass = {};
      students.forEach(s => {
        if (!s.grade) return;
        const k = s.grade;
        byClass[k] = (byClass[k] || 0) + 1;
      });
      $('.js-chips', this.root).innerHTML = Object.keys(byClass).sort((a, b) => a - b)
        .map(k => `<span class="chip">klasa ${k}: <b>${byClass[k]}</b></span>`).join('');
    }

    students() {
      return $$('tr', this.tbody).map(tr => ({
        id: tr.dataset.id,
        name: $('.js-name', tr).value.trim().replace(/\s+/g, ' '),
        grade: +$('.js-grade', tr).value || 0,
        section: $('.js-section', tr).value.trim().toLowerCase(),
      }));
    }

    field(name) {
      return $(`[name=${name}]`, this.root);
    }

    setData(sub) {
      for (const k of ['school', 'city', 'guardian', 'email', 'note']) this.field(k).value = sub[k] || '';
      this.typeSel.value = sub.schoolType || 'sp';
      this.tbody.innerHTML = '';
      (sub.students || []).forEach(s => this.addRow(s));
      if (!(sub.students || []).length) this.addRow();
      this.refresh();
    }

    /** Zwraca dane albo null (i zaznacza błędy). */
    getData() {
      $$('[aria-invalid]', this.root).forEach(el => el.removeAttribute('aria-invalid'));
      const errors = [];
      const mark = (el, msg) => { el.setAttribute('aria-invalid', 'true'); errors.push({ el, msg }); };
      const data = {
        school: this.field('school').value.trim(),
        city: this.field('city').value.trim(),
        schoolType: this.typeSel.value,
        guardian: this.field('guardian').value.trim(),
        email: this.field('email').value.trim(),
        note: this.field('note').value.trim(),
      };
      if (data.school.length < 3) mark(this.field('school'), 'Podaj nazwę szkoły.');
      if (data.guardian.length < 3) mark(this.field('guardian'), 'Podaj imię i nazwisko opiekuna.');
      if (data.email && !this.field('email').checkValidity()) mark(this.field('email'), 'Nieprawidłowy adres e-mail.');

      // pomiń całkowicie puste wiersze
      $$('tr', this.tbody).forEach(tr => {
        if (!$('.js-name', tr).value.trim() && !$('.js-grade', tr).value && !$('.js-section', tr).value.trim()) tr.remove();
      });
      this.refresh();
      const rows = $$('tr', this.tbody);
      if (!rows.length) {
        errors.push({ el: $('.js-add', this.root), msg: 'Dodaj co najmniej jednego ucznia.' });
      }
      rows.forEach((tr, i) => {
        const name = $('.js-name', tr), grade = $('.js-grade', tr), sec = $('.js-section', tr);
        if (name.value.trim().length < 2) mark(name, `Uczeń nr ${i + 1}: podaj imię.`);
        if (!grade.value) mark(grade, `Uczeń nr ${i + 1}: wybierz klasę.`);
        if (!/^\p{L}{0,3}$/u.test(sec.value.trim())) mark(sec, `Uczeń nr ${i + 1}: oddział to litera, np. „a”.`);
      });
      if (errors.length) {
        errors[0].el.focus();
        PP.toast(errors[0].msg + (errors.length > 1 ? ` (i ${errors.length - 1} więcej)` : ''), 'error');
        return null;
      }
      data.students = this.students();
      return data;
    }
  }

  window.SubmissionEditor = SubmissionEditor;
})();

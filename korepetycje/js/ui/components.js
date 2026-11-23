/* ============================================================
   TutorFlow — components.js
   Runtime UI: delegowane akcje, modale, panele, toasty, menu,
   oraz drobne rendery wielokrotnego użytku (avatar, badge…).
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const icon = window.TF.icon;

  const UI = { actions: {}, changes: {}, submits: {} };

  /* ============================================================
     DELEGOWANE ZDARZENIA
     Widoki renderują HTML ze znacznikiem data-action="nazwa",
     a handler rejestrują raz przez UI.action(). Dzięki temu
     ponowny render nie wymaga podpinania nasłuchów.
     ============================================================ */
  UI.action = function (name, fn) { UI.actions[name] = fn; return UI; };
  UI.change = function (name, fn) { UI.changes[name] = fn; return UI; };
  UI.submit = function (name, fn) { UI.submits[name] = fn; return UI; };

  UI.bind = function () {
    document.addEventListener('click', function (e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const name = el.getAttribute('data-action');
      const fn = UI.actions[name];
      if (!fn) return;
      e.preventDefault();
      e.stopPropagation();
      fn(el, e);
    });

    document.addEventListener('change', function (e) {
      const el = e.target.closest('[data-change]');
      if (!el) return;
      const fn = UI.changes[el.getAttribute('data-change')];
      if (fn) fn(el, e);
    });

    document.addEventListener('input', function (e) {
      const el = e.target.closest('[data-live]');
      if (!el) return;
      const fn = UI.changes[el.getAttribute('data-live')];
      if (fn) fn(el, e);
    });

    document.addEventListener('submit', function (e) {
      const form = e.target.closest('[data-submit]');
      if (!form) return;
      e.preventDefault();
      const fn = UI.submits[form.getAttribute('data-submit')];
      if (fn) fn(form, e);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('[role="button"][data-action]')) {
        e.target.click();
      }
    });
  };

  /* ============================================================
     TOASTY
     ============================================================ */
  const ICON_FOR = { ok: '✓', bad: '!', warn: '!', info: 'i' };

  UI.toast = function (title, opts) {
    opts = opts || {};
    const root = document.getElementById('toastRoot');
    const el = document.createElement('div');
    el.className = 'toast toast--' + (opts.type || 'ok');
    el.innerHTML =
      '<span class="toast__icon">' + (ICON_FOR[opts.type || 'ok'] || '✓') + '</span>' +
      '<div class="toast__body grow"><strong>' + U.esc(title) + '</strong>' +
      (opts.desc ? '<p>' + U.esc(opts.desc) + '</p>' : '') + '</div>' +
      (opts.actionLabel ? '<button class="toast__action">' + U.esc(opts.actionLabel) + '</button>' : '');

    if (opts.actionLabel && opts.onAction) {
      el.querySelector('.toast__action').addEventListener('click', function () {
        opts.onAction();
        dismiss();
      });
    }
    root.appendChild(el);
    const timer = setTimeout(dismiss, opts.duration || 4200);
    function dismiss() {
      clearTimeout(timer);
      if (!el.parentNode) return;
      el.classList.add('is-out');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    }
    return { dismiss };
  };

  /* ============================================================
     MODALE
     ============================================================ */
  const modalStack = [];

  UI.modal = function (cfg) {
    cfg = cfg || {};
    const root = document.getElementById('modalRoot');
    const scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.innerHTML =
      '<div class="modal ' + (cfg.size === 'wide' ? 'modal--wide' : cfg.size === 'narrow' ? 'modal--narrow' : '') + '" role="dialog" aria-modal="true">' +
        (cfg.title ? '<div class="modal__head"><div><h2>' + U.esc(cfg.title) + '</h2>' +
          (cfg.subtitle ? '<p>' + U.esc(cfg.subtitle) + '</p>' : '') + '</div>' +
          '<button class="icon-btn" data-modal-close aria-label="Zamknij">' + icon('x', 18) + '</button></div>' : '') +
        '<div class="modal__body">' + (cfg.body || '') + '</div>' +
        (cfg.footer ? '<div class="modal__foot ' + (cfg.footerSplit ? 'modal__foot--split' : '') + '">' + cfg.footer + '</div>' : '') +
      '</div>';

    root.appendChild(scrim);
    document.body.style.overflow = 'hidden';

    const api = {
      el: scrim,
      body: scrim.querySelector('.modal__body'),
      close: function () { destroy(); }
    };

    function destroy() {
      const i = modalStack.indexOf(api);
      if (i !== -1) modalStack.splice(i, 1);
      scrim.style.animation = 'fadeIn 140ms reverse both';
      setTimeout(() => {
        if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
        if (!modalStack.length) document.body.style.overflow = '';
      }, 130);
      if (cfg.onClose) cfg.onClose();
    }

    scrim.addEventListener('click', function (e) {
      if (e.target === scrim && cfg.dismissible !== false) destroy();
      if (e.target.closest('[data-modal-close]')) destroy();
    });

    modalStack.push(api);
    if (cfg.onMount) cfg.onMount(api);

    // autofocus pierwszego pola
    setTimeout(() => {
      const f = scrim.querySelector('[autofocus], input:not([type=hidden]), select, textarea');
      if (f && !cfg.noAutofocus) { try { f.focus(); f.select && f.select(); } catch (e) {} }
    }, 60);

    return api;
  };

  UI.closeTopModal = function () {
    if (modalStack.length) modalStack[modalStack.length - 1].close();
    return modalStack.length;
  };
  UI.closeAllModals = function () { while (modalStack.length) modalStack[modalStack.length - 1].close(); };
  UI.hasModal = function () { return modalStack.length > 0; };

  /* ============================================================
     PANEL WYSUWANY
     ============================================================ */
  let sheetApi = null;
  UI.sheet = function (cfg) {
    if (sheetApi) sheetApi.close();
    const root = document.getElementById('sheetRoot');
    const scrim = document.createElement('div');
    scrim.className = 'sheet-scrim';
    scrim.innerHTML =
      '<aside class="sheet" role="dialog" aria-modal="true">' +
        '<div class="sheet__head"><div><h2>' + U.esc(cfg.title || '') + '</h2>' +
          (cfg.subtitle ? '<p class="small dim">' + U.esc(cfg.subtitle) + '</p>' : '') + '</div>' +
          '<button class="icon-btn" data-sheet-close aria-label="Zamknij">' + icon('x', 18) + '</button></div>' +
        '<div class="sheet__body">' + (cfg.body || '') + '</div>' +
        (cfg.footer ? '<div class="sheet__foot">' + cfg.footer + '</div>' : '') +
      '</aside>';
    root.appendChild(scrim);
    document.body.style.overflow = 'hidden';

    const api = {
      el: scrim,
      body: scrim.querySelector('.sheet__body'),
      close: function () {
        scrim.style.animation = 'fadeIn 140ms reverse both';
        setTimeout(() => { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, 130);
        if (!modalStack.length) document.body.style.overflow = '';
        sheetApi = null;
        if (cfg.onClose) cfg.onClose();
      }
    };
    scrim.addEventListener('click', function (e) {
      if (e.target === scrim || e.target.closest('[data-sheet-close]')) api.close();
    });
    sheetApi = api;
    if (cfg.onMount) cfg.onMount(api);
    return api;
  };
  UI.hasSheet = function () { return !!sheetApi; };
  UI.closeSheet = function () { if (sheetApi) sheetApi.close(); };

  /* ============================================================
     POTWIERDZENIE (nigdy nie usuwamy jednym kliknięciem)
     ============================================================ */
  UI.confirm = function (cfg) {
    return new Promise(function (resolve) {
      let decided = false;
      const m = UI.modal({
        size: 'narrow',
        title: cfg.title || 'Na pewno?',
        body: '<p class="muted" style="white-space:pre-line">' + U.esc(cfg.text || '') + '</p>' +
          (cfg.warning ? '<div class="insight insight--bad mt-4"><span class="insight__ico">!</span><div class="insight__body">' + U.esc(cfg.warning) + '</div></div>' : ''),
        footer:
          '<button class="btn" data-confirm-no>' + U.esc(cfg.cancelLabel || 'Anuluj') + '</button>' +
          '<button class="btn ' + (cfg.danger === false ? 'btn--brand' : 'btn--danger') + '" data-confirm-yes>' +
            U.esc(cfg.confirmLabel || 'Usuń') + '</button>',
        onClose: function () { if (!decided) resolve(false); }
      });
      m.el.addEventListener('click', function (e) {
        if (e.target.closest('[data-confirm-yes]')) { decided = true; m.close(); resolve(true); }
        if (e.target.closest('[data-confirm-no]')) { decided = true; m.close(); resolve(false); }
      });
    });
  };

  /* ============================================================
     MENU KONTEKSTOWE
     ============================================================ */
  let openMenu = null;
  UI.menu = function (anchor, items) {
    UI.closeMenu();
    const el = document.createElement('div');
    el.className = 'menu menu--fixed';
    el.innerHTML = items.map(function (it) {
      if (it.sep) return '<div class="menu__sep"></div>';
      if (it.label && it.header) return '<div class="menu__label">' + U.esc(it.label) + '</div>';
      return '<button class="menu__item ' + (it.danger ? 'menu__item--danger' : '') + '" data-menu-idx="' + items.indexOf(it) + '">' +
        (it.icon ? icon(it.icon, 16) : '') + '<span>' + U.esc(it.label) + '</span>' +
        (it.kbd ? '<kbd>' + U.esc(it.kbd) + '</kbd>' : '') + '</button>';
    }).join('');
    document.body.appendChild(el);

    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = Math.min(r.right - w, window.innerWidth - w - 8);
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    el.style.left = Math.max(8, left) + 'px';
    el.style.top = top + 'px';

    el.addEventListener('click', function (e) {
      const b = e.target.closest('[data-menu-idx]');
      if (!b) return;
      const it = items[+b.getAttribute('data-menu-idx')];
      UI.closeMenu();
      if (it && it.onClick) it.onClick();
    });
    openMenu = el;
    setTimeout(function () {
      document.addEventListener('click', outside, { once: true });
      document.addEventListener('scroll', UI.closeMenu, { once: true, capture: true });
    }, 0);
    function outside() { UI.closeMenu(); }
    return el;
  };
  UI.closeMenu = function () {
    if (openMenu && openMenu.parentNode) openMenu.parentNode.removeChild(openMenu);
    openMenu = null;
  };

  /* ============================================================
     MAŁE RENDERY
     ============================================================ */
  UI.avatar = function (student, size) {
    if (!student) return '<span class="avatar ' + (size || '') + '">?</span>';
    const cls = size ? 'avatar avatar--' + size : 'avatar';
    return '<span class="' + cls + '" style="background:' + U.gradientFor(student.id + student.firstName) + '">' +
      U.esc(U.initials(student.firstName, student.lastName)) + '</span>';
  };

  UI.lessonStatusBadge = function (l) {
    const s = M.LESSON_STATUS[l.status] || M.LESSON_STATUS.planned;
    return '<span class="badge badge--' + s.cls + '"><i class="dot"></i>' + U.esc(s.short) + '</span>';
  };

  UI.paymentBadge = function (l) {
    if (!window.TF.Compute.isBillable(l) && l.status !== 'planned') {
      return '<span class="badge">Bezpłatne</span>';
    }
    if (l.paymentStatus === 'package') return '<span class="badge badge--brand">Pakiet</span>';
    if (l.paymentStatus === 'free') return '<span class="badge">Bezpłatne</span>';
    if (l.paymentStatus === 'paid') return '<span class="badge badge--ok">Opłacone</span>';
    if (window.TF.Compute.isOverdue(l)) return '<span class="badge badge--bad">Zaległe</span>';
    if (l.status === 'planned') return '<span class="badge badge--outline">Do zapłaty</span>';
    return '<span class="badge badge--warn">Do zapłaty</span>';
  };

  UI.studentStatusBadge = function (s) {
    const due = window.TF.Compute.unpaidTotal(s.id);
    if (due > 0 && s.status === 'active') return '<span class="badge badge--bad"><i class="dot"></i>Zaległość</span>';
    const st = M.STUDENT_STATUS[s.status] || M.STUDENT_STATUS.active;
    return '<span class="badge badge--' + st.cls + '"><i class="dot"></i>' + U.esc(st.label) + '</span>';
  };

  UI.trend = function (value, opts) {
    opts = opts || {};
    const v = Number(value) || 0;
    const cls = Math.abs(v) < 0.5 ? 'flat' : (v > 0 ? 'up' : 'down');
    const arrow = cls === 'flat' ? '→' : (cls === 'up' ? '↑' : '↓');
    const inv = opts.invert && cls !== 'flat' ? (cls === 'up' ? 'down' : 'up') : cls;
    return '<span class="trend trend--' + inv + '">' + arrow + ' ' + U.pctLabel(Math.abs(v)) + '</span>';
  };

  UI.empty = function (cfg) {
    return '<div class="empty">' +
      '<div class="empty__art">' + icon(cfg.icon || 'sparkles', 30) + '</div>' +
      '<h3>' + U.esc(cfg.title || 'Brak danych') + '</h3>' +
      (cfg.text ? '<p>' + U.esc(cfg.text) + '</p>' : '') +
      (cfg.ctaLabel ? '<button class="btn btn--brand mt-2" data-action="' + cfg.ctaAction + '"' +
        (cfg.ctaData ? ' ' + cfg.ctaData : '') + '><span class="plus">+</span> ' + U.esc(cfg.ctaLabel) + '</button>' : '') +
      '</div>';
  };

  UI.progress = function (pctVal, variant) {
    const p = U.clamp(pctVal, 0, 100);
    return '<div class="progress ' + (variant ? 'progress--' + variant : '') + '"><span style="width:' + p + '%"></span></div>';
  };

  /** Pierścień postępu (SVG) */
  UI.ring = function (pctVal, size, label, sub) {
    const s = size || 84;
    const r = (s - 10) / 2;
    const c = 2 * Math.PI * r;
    const p = U.clamp(pctVal, 0, 100);
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '" style="flex:none">' +
      '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="7"/>' +
      '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="url(#ringGrad)" stroke-width="7" stroke-linecap="round" ' +
        'stroke-dasharray="' + c + '" stroke-dashoffset="' + (c - c * p / 100) + '" transform="rotate(-90 ' + s / 2 + ' ' + s / 2 + ')"/>' +
      '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>' +
      (label ? '<text x="50%" y="' + (sub ? '45%' : '52%') + '" text-anchor="middle" dominant-baseline="middle" ' +
        'font-size="' + (s / 4.4) + '" font-weight="700" fill="var(--text)">' + U.esc(label) + '</text>' : '') +
      (sub ? '<text x="50%" y="63%" text-anchor="middle" dominant-baseline="middle" font-size="' + (s / 8) + '" fill="var(--text-3)">' + U.esc(sub) + '</text>' : '') +
      '</svg>';
  };

  UI.kpi = function (cfg) {
    return '<div class="kpi" ' + (cfg.route ? 'data-clickable data-action="go" data-route="' + cfg.route + '"' : '') +
      (cfg.delay ? ' style="animation-delay:' + cfg.delay + 'ms"' : '') + '>' +
      '<div class="kpi__top"><span class="kpi__label">' + U.esc(cfg.label) + '</span>' +
      (cfg.icon ? '<span class="kpi__icon ' + (cfg.tone ? 'kpi__icon--' + cfg.tone : '') + '">' + icon(cfg.icon, 16) + '</span>' : '') +
      '</div>' +
      '<div class="kpi__value">' + cfg.value + (cfg.unit ? ' <small>' + U.esc(cfg.unit) + '</small>' : '') + '</div>' +
      (cfg.foot ? '<div class="kpi__foot">' + cfg.foot + '</div>' : '') +
      '</div>';
  };

  UI.card = function (title, bodyHtml, opts) {
    opts = opts || {};
    return '<section class="card ' + (opts.class || '') + '">' +
      (title ? '<div class="card__head"><div><h2>' + U.esc(title) + '</h2>' +
        (opts.subtitle ? '<p>' + U.esc(opts.subtitle) + '</p>' : '') + '</div>' +
        (opts.action || '') + '</div>' : '') +
      '<div class="' + (opts.noPad ? '' : 'card__body') + '">' + bodyHtml + '</div>' +
      (opts.foot ? '<div class="card__foot">' + opts.foot + '</div>' : '') +
      '</section>';
  };

  window.TF.UI = UI;
})();

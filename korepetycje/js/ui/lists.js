/* ============================================================
   TutorFlow — lists.js
   Renderery powtarzalnych elementów list, współdzielone przez
   wiele widoków (wiersz lekcji, karta ucznia, zadanie, …).
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const icon = window.TF.icon;

  const L = {};

  /* ---------------- Wiersz lekcji ---------------- */
  L.lessonRow = function (l, opts) {
    opts = opts || {};
    const c = C();
    const s = S().student(l.studentId);
    const status = M.LESSON_STATUS[l.status] || M.LESSON_STATUS.planned;
    const now = c.isNow(l);
    const past = c.isPast(l) && l.status === 'planned';
    const barColor = {
      planned: 'var(--info-500)', done: 'var(--ok-500)', no_show: '#a855f7',
      cancelled_student: 'var(--bad-500)', cancelled_tutor: 'var(--bad-500)', rescheduled: 'var(--warn-500)'
    }[l.status] || 'var(--info-500)';

    let actions = '';
    if (opts.actions !== false) {
      if (l.status === 'planned') {
        actions =
          '<button class="icon-btn icon-btn--sm" data-tip="Oznacz jako odbytą" data-action="lessonDone" data-id="' + l.id + '">' + icon('check', 15) + '</button>' +
          '<button class="icon-btn icon-btn--sm" data-tip="Notatka po lekcji" data-action="lessonSummary" data-id="' + l.id + '">' + icon('note', 15) + '</button>' +
          '<button class="icon-btn icon-btn--sm" data-tip="Odwołaj" data-action="lessonCancel" data-id="' + l.id + '">' + icon('ban', 15) + '</button>';
      } else if (c.isBillable(l) && l.paymentStatus === 'unpaid') {
        actions = '<button class="btn btn--xs btn--soft" data-action="lessonPay" data-id="' + l.id + '">' + icon('wallet', 13) + ' Opłacone</button>';
      }
      actions += '<button class="icon-btn icon-btn--sm" data-tip-left data-tip="Więcej" data-action="lessonMenu" data-id="' + l.id + '">' + icon('more', 15) + '</button>';
    }

    return '<div class="lesson-row ' + (now ? 'is-now' : '') + ' ' + (opts.dim && c.isPast(l) ? 'is-past' : '') + '">' +
      '<div class="lesson-row__time"><strong>' + U.fmtTime(l.start) + '</strong><small>' + U.fmtTime(c.lessonEndTime(l)) + '</small></div>' +
      '<div class="lesson-row__bar" style="background:' + barColor + '"></div>' +
      (opts.avatar !== false ? UI.avatar(s, 'sm') : '') +
      '<div class="lesson-row__main">' +
        '<strong class="truncate">' + U.esc(S().studentName(l.studentId)) + '</strong>' +
        '<div class="lesson-row__meta">' +
          '<span>' + U.esc(l.topic || l.subject || (s && s.subject) || 'Zajęcia') + '</span>' +
          '<span>·</span><span>' + U.durLabel(l.duration) + '</span>' +
          '<span>·</span><span>' + (l.mode === 'online' ? 'Online' : 'Stacjonarnie') + '</span>' +
          (now ? '<span class="badge badge--brand">trwa teraz</span>' : '') +
          (past ? '<span class="badge badge--warn">do oznaczenia</span>' : '') +
          (l.status !== 'planned' ? '<span class="badge badge--' + status.cls + '">' + U.esc(status.short) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="col right gap-1">' +
        '<span class="lesson-row__price">' + U.money(l.price) + '</span>' +
        UI.paymentBadge(l) +
      '</div>' +
      (actions ? '<div class="lesson-row__actions">' + actions + '</div>' : '') +
      '</div>';
  };

  /* ---------------- Wiersz tabeli lekcji ---------------- */
  L.lessonTableRow = function (l) {
    const s = S().student(l.studentId);
    return '<tr data-clickable data-action="lessonMenuRow" data-id="' + l.id + '">' +
      '<td class="nowrap"><strong>' + U.fmtDate(l.date) + '</strong><div class="tiny dim">' + U.cap(U.DOW_LONG[U.dow(l.date)]) + '</div></td>' +
      '<td class="nowrap mono">' + U.fmtTime(l.start) + '–' + U.fmtTime(C().lessonEndTime(l)) + '</td>' +
      '<td><div class="row gap-2">' + UI.avatar(s, 'sm') + '<span class="truncate">' + U.esc(S().studentName(l.studentId)) + '</span></div></td>' +
      '<td class="nowrap small">' + U.esc(l.topic || l.subject || '—') + '</td>' +
      '<td class="nowrap small">' + (l.mode === 'online' ? 'Online' : 'Stacjonarnie') + '</td>' +
      '<td class="num small">' + U.durLabel(l.duration) + '</td>' +
      '<td class="num"><strong>' + U.money(l.price) + '</strong></td>' +
      '<td>' + UI.lessonStatusBadge(l) + '</td>' +
      '<td>' + UI.paymentBadge(l) + '</td>' +
      '<td class="actions-cell"><button class="icon-btn icon-btn--sm" data-action="lessonMenu" data-id="' + l.id + '">' + icon('more', 15) + '</button></td>' +
      '</tr>';
  };

  /* ---------------- Karta ucznia ---------------- */
  L.studentCard = function (s, idx) {
    const c = C();
    const fin = c.studentFinance(s.id);
    const next = fin.nextLesson;
    const due = fin.due;
    return '<article class="student-card" data-action="go" data-route="#/students/' + s.id + '" style="animation-delay:' + Math.min(idx * 25, 300) + 'ms">' +
      '<div class="student-card__top">' + UI.avatar(s) +
        '<div class="grow" style="min-width:0">' +
          '<div class="row-between gap-2"><span class="student-card__name truncate">' + U.esc(S().studentName(s.id)) + '</span>' +
          UI.studentStatusBadge(s) + '</div>' +
          '<div class="student-card__sub truncate">' + U.esc([s.subject, s.level, s.grade].filter(Boolean).join(' · ') || '—') + '</div>' +
          '<div class="row gap-2 mt-2 tiny dim">' +
            (s.mode === 'online' ? icon('video', 13) + '<span>Online</span>' : icon('mapPin', 13) + '<span>Stacjonarnie</span>') +
            '<span>·</span><span>' + U.money(s.rates[60] || 0) + '/60 min</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="student-card__grid">' +
        '<div class="student-card__cell"><small>Lekcje</small><strong>' + fin.lessonsHeld + '</strong></div>' +
        '<div class="student-card__cell"><small>Najbliższe</small><strong class="small">' +
          (next ? U.fmtDate(next.date, 'short') + ' ' + U.fmtTime(next.start) : '—') + '</strong></div>' +
        '<div class="student-card__cell"><small>Saldo</small><strong class="' + (due > 0 ? 'pos-down' : '') + '">' +
          (due > 0 ? U.money(due) : '0') + '</strong></div>' +
      '</div>' +
      '</article>';
  };

  /* ---------------- Zadanie ---------------- */
  L.taskItem = function (t) {
    const p = M.PRIORITY[t.priority] || M.PRIORITY.med;
    const overdue = !t.done && t.due && t.due < U.today();
    return '<div class="task-item ' + (t.done ? 'is-done' : '') + '">' +
      '<span class="prio ' + p.cls + '"></span>' +
      '<label class="check" style="margin-top:1px"><input type="checkbox" data-change="toggleTask" data-id="' + t.id + '"' + (t.done ? ' checked' : '') + '>' +
        '<span class="check__box">' + icon('check', 12) + '</span></label>' +
      '<div class="grow" style="min-width:0">' +
        '<div class="task-item__title">' + U.esc(t.title) + '</div>' +
        '<div class="lesson-row__meta">' +
          (t.due ? '<span class="' + (overdue ? 'pos-down bold' : '') + '">' + (overdue ? 'Po terminie · ' : '') + U.dayLabel(t.due, 'medium') + '</span>' : '') +
          (t.studentId ? '<span>·</span><span>' + U.esc(S().studentName(t.studentId)) + '</span>' : '') +
          '<span>·</span><span>' + U.esc(p.label) + '</span>' +
        '</div>' +
      '</div>' +
      '<button class="icon-btn icon-btn--sm" data-action="editTask" data-id="' + t.id + '">' + icon('edit', 14) + '</button>' +
      '</div>';
  };

  /* ---------------- Materiał ---------------- */
  L.materialItem = function (m) {
    const t = M.MATERIAL_TYPE[m.type] || M.MATERIAL_TYPE.link;
    return '<div class="mat-item">' +
      '<span class="mat-item__ico ' + t.cls + '">' + t.icon + '</span>' +
      '<div class="grow" style="min-width:0">' +
        '<div class="bold truncate">' + U.esc(m.title) + '</div>' +
        '<div class="lesson-row__meta">' +
          '<span>' + U.esc(t.label) + '</span>' +
          (m.studentId ? '<span>·</span><span>' + U.esc(S().studentName(m.studentId)) + '</span>' : '<span>·</span><span>wspólny</span>') +
          '<span>·</span><span>' + U.fmtDate(m.date) + '</span>' +
        '</div>' +
      '</div>' +
      (m.url ? '<a class="icon-btn icon-btn--sm" href="' + U.esc(m.url) + '" target="_blank" rel="noopener" data-tip="Otwórz">' + icon('external', 14) + '</a>' : '') +
      '<button class="icon-btn icon-btn--sm" data-action="editMaterial" data-id="' + m.id + '">' + icon('edit', 14) + '</button>' +
      '</div>';
  };

  /* ---------------- Notatka ---------------- */
  L.noteCard = function (n) {
    const kindLabel = { private: 'Prywatna', lesson: 'Z lekcji', progress: 'Postęp' }[n.kind] || 'Notatka';
    return '<div class="note-card">' +
      '<div class="note-card__head">' +
        '<div class="row gap-2 tiny dim">' +
          '<span class="badge badge--outline">' + kindLabel + '</span>' +
          (n.studentId ? '<span>' + U.esc(S().studentName(n.studentId)) + '</span>' : '') +
          '<span>' + U.fmtDate(n.date, 'medium') + '</span>' +
        '</div>' +
        '<button class="icon-btn icon-btn--sm" data-action="editNote" data-id="' + n.id + '">' + icon('edit', 14) + '</button>' +
      '</div>' +
      '<p>' + U.esc(n.text) + '</p>' +
      '</div>';
  };

  /* ---------------- Wskazówka / przypomnienie ---------------- */
  L.insight = function (x) {
    return '<div class="insight insight--' + (x.tone || 'info') + '">' +
      '<span class="insight__ico">' + (x.icon || '💡') + '</span>' +
      '<div class="insight__body"><strong>' + U.esc(x.title) + '</strong>' +
      (x.text ? '<p>' + U.esc(x.text) + '</p>' : '') + '</div>' +
      (x.route ? '<button class="btn btn--xs insight__cta" data-action="go" data-route="' + x.route + '">' +
        U.esc(x.actionLabel || 'Zobacz') + '</button>' : '') +
      '</div>';
  };

  L.reminder = function (r) {
    return L.insight({
      tone: r.tone, icon: r.icon, title: r.title, text: r.text,
      route: r.action && r.action.route, actionLabel: r.action && r.action.label
    });
  };

  window.TF.Lists = L;
})();

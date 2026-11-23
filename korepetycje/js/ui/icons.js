/* ============================================================
   TutorFlow — icons.js
   Lekki zestaw ikon SVG (stroke = currentColor).
   Użycie: TF.icon('calendar', 18)
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';

  const P = {
    dashboard: '<path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/>',
    today: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M9 15.5l2 2 4-4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.2"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16.5 3.6a4 4 0 0 1 0 7"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    wallet: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8.5Z"/><path d="M3 9h13"/><circle cx="17" cy="13.5" r="1.2" fill="currentColor" stroke="none"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19"/><path d="M6.5 15h3"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    checkSquare: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.2l2.6 2.6L16.5 9"/>',
    note: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h8L20 8.5v11a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 5 19.5v-15Z"/><path d="M14 3v5.5h5.5"/><path d="M9 13h6M9 16.5h4"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    more: '<circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none"/>',
    chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M7 4.5v15l12-7.5-12-7.5Z"/>',
    ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 18 18 6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L3 9"/><path d="M4 13a8 8 0 0 0 14 4.5L21 15"/><path d="M3 5v4h4M21 19v-4h-4"/>',
    phone: '<path d="M5 3.5h3.2l1.6 4-2 1.4a12 12 0 0 0 5.3 5.3l1.4-2 4 1.6V17a2.5 2.5 0 0 1-2.7 2.5A15.5 15.5 0 0 1 2.5 6.2 2.5 2.5 0 0 1 5 3.5Z"/>',
    mail: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    download: '<path d="M12 3v12"/><path d="m7.5 11 4.5 4.5L16.5 11"/><path d="M4 20h16"/>',
    upload: '<path d="M12 20V8"/><path d="m7.5 12 4.5-4.5L16.5 12"/><path d="M4 4h16"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M15.5 5.5A2.5 2.5 0 0 0 13 3H6.5A2.5 2.5 0 0 0 4 5.5V13a2.5 2.5 0 0 0 2.5 2.5"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4.5A2.5 2.5 0 0 1 15.5 21h-9A2.5 2.5 0 0 1 4 18.5v-9A2.5 2.5 0 0 1 6.5 7H11"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    receipt: '<path d="M5 3.5 6.8 5l1.7-1.5L10.2 5 12 3.5 13.8 5l1.7-1.5L17.2 5 19 3.5v17L17.2 19l-1.7 1.5L13.8 19 12 20.5 10.2 19l-1.7 1.5L6.8 19 5 20.5v-17Z"/><path d="M9 9h6M9 13h6"/>',
    file: '<path d="M6 3.5A1.5 1.5 0 0 1 7.5 2h6L19 7.5v13A1.5 1.5 0 0 1 17.5 22h-10A1.5 1.5 0 0 1 6 20.5v-17Z"/><path d="M13 2v6h6"/>',
    mapPin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
    video: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="m15.5 10.5 6-3v9l-6-3v-3Z"/>',
    sparkles: '<path d="m12 3 1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z"/><path d="M18.5 15.5 19.4 18l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z"/>',
    alert: '<path d="M12 3.5 22 20H2L12 3.5Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
    flame: '<path d="M12 22c4 0 7-2.8 7-6.6 0-4.5-4.5-6-5.5-10.4-2 1.4-2.6 3.6-2.3 5.4-1-.6-1.7-1.8-1.8-3.1C7.4 9 5 11.3 5 15.4 5 19.2 8 22 12 22Z"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/>',
    printer: '<path d="M7 9V3.5h10V9"/><path d="M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1.2"/><circle cx="17.5" cy="12" r="1" fill="currentColor" stroke="none"/>',
    scissors: '<circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M20 4 8.5 15.5"/><path d="M14.5 14.5 20 20"/><path d="M8.5 8.5 12 12"/>'
  };

  window.TF.icon = function (name, size, extraClass) {
    const d = P[name];
    if (!d) return '';
    const s = size || 18;
    return '<svg class="' + (extraClass || '') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };
  window.TF.ICONS = P;
})();

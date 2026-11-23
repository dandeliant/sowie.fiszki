/* ============================================================
   TutorFlow — charts.js
   Wykresy rysowane ręcznie w SVG. Bez zewnętrznych bibliotek,
   więc aplikacja działa też offline i z pliku lokalnego.
   Każdy element z atrybutem data-tipv pokazuje tooltip.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const Ch = {};

  const PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

  function niceMax(v) {
    if (v <= 0) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  /** Wygładzenie łamanej (Catmull-Rom → Bézier) */
  function smoothPath(pts, tension) {
    if (pts.length < 2) return '';
    const t = tension === undefined ? 0.32 : tension;
    let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i], p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) * t / 2;
      const c1y = p1[1] + (p2[1] - p0[1]) * t / 2;
      const c2x = p2[0] - (p3[0] - p1[0]) * t / 2;
      const c2y = p2[1] - (p3[1] - p1[1]) * t / 2;
      d += 'C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0] + ',' + p2[1].toFixed(1);
    }
    return d;
  }

  function wrap(inner, opts) {
    return '<div class="chart" ' + (opts && opts.style ? 'style="' + opts.style + '"' : '') + '>' + inner +
      '<div class="chart__tip"></div></div>';
  }

  function fmt(v, money) { return money === false ? U.num(v, 0) : U.money(v); }

  /* ============================================================
     WYKRES LINIOWY / OBSZAROWY
     data: [{label, value, fullLabel?, sub?}]
     ============================================================ */
  Ch.area = function (data, opts) {
    opts = opts || {};
    const W = 660, H = opts.height || 230;
    const padL = opts.padL === undefined ? 52 : opts.padL, padR = 14, padT = 16, padB = 28;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const uid = 'g' + Math.random().toString(36).slice(2, 8);

    if (!data.length) return wrap('<svg viewBox="0 0 ' + W + ' ' + H + '"></svg>');

    const maxV = niceMax(Math.max.apply(null, data.map((d) => d.value)) || 1);
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const x = (i) => padL + i * stepX;
    const y = (v) => padT + innerH - (v / maxV) * innerH;

    const pts = data.map((d, i) => [x(i), y(d.value)]);
    const line = smoothPath(pts);
    const area = line + ' L' + x(data.length - 1) + ',' + (padT + innerH) + ' L' + padL + ',' + (padT + innerH) + ' Z';

    let grid = '', yl = '';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = maxV * i / steps;
      const yy = y(v);
      grid += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="var(--border)" stroke-width="1" stroke-dasharray="' + (i ? '3 4' : '0') + '"/>';
      yl += '<text x="' + (padL - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="10.5" fill="var(--text-3)">' +
        (opts.money === false ? U.num(v, 0) : U.moneyShort(v)) + '</text>';
    }

    let xl = '', dots = '', hits = '';
    const skip = data.length > 14 ? Math.ceil(data.length / 12) : 1;
    data.forEach((d, i) => {
      if (i % skip === 0 || i === data.length - 1) {
        xl += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="var(--text-3)">' + U.esc(d.label) + '</text>';
      }
      const tip = U.esc((d.fullLabel || d.label) + ' — ' + fmt(d.value, opts.money) + (d.sub ? ' · ' + d.sub : ''));
      dots += '<circle cx="' + x(i) + '" cy="' + y(d.value) + '" r="3.5" fill="var(--surface)" stroke="' + (opts.color || 'var(--brand-500)') + '" stroke-width="2.2"/>';
      hits += '<circle cx="' + x(i) + '" cy="' + y(d.value) + '" r="' + Math.max(10, stepX / 2) + '" fill="transparent" data-tipv="' + tip + '" style="cursor:pointer"/>';
    });

    let avgLine = '';
    if (opts.showAvg && data.length > 1) {
      const a = U.avg(data, (d) => d.value);
      avgLine = '<line x1="' + padL + '" y1="' + y(a) + '" x2="' + (W - padR) + '" y2="' + y(a) +
        '" stroke="var(--warn-500)" stroke-width="1.4" stroke-dasharray="5 4" opacity=".8"/>' +
        '<text x="' + (W - padR) + '" y="' + (y(a) - 6) + '" text-anchor="end" font-size="10" fill="var(--warn-500)">średnia ' + U.moneyShort(a) + '</text>';
    }

    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
      '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + (opts.color || '#6366f1') + '" stop-opacity=".28"/>' +
      '<stop offset="1" stop-color="' + (opts.color || '#6366f1') + '" stop-opacity="0"/></linearGradient></defs>' +
      grid + yl +
      '<path d="' + area + '" fill="url(#' + uid + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + (opts.color || 'var(--brand-500)') + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      avgLine + dots + hits + xl +
      '</svg>';
    return wrap(svg, opts);
  };

  /* ============================================================
     SŁUPKI
     data: [{label, value, fullLabel?, color?, kind?}]
     ============================================================ */
  Ch.bars = function (data, opts) {
    opts = opts || {};
    const W = 660, H = opts.height || 230;
    const padL = opts.padL === undefined ? 52 : opts.padL, padR = 14, padT = 16, padB = 28;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    if (!data.length) return wrap('<svg viewBox="0 0 ' + W + ' ' + H + '"></svg>');

    const maxV = niceMax(Math.max.apply(null, data.map((d) => Math.abs(d.value))) || 1);
    const slot = innerW / data.length;
    const bw = Math.min(opts.barWidth || 34, slot * 0.62);
    const y = (v) => padT + innerH - (v / maxV) * innerH;

    let grid = '', yl = '';
    for (let i = 0; i <= 4; i++) {
      const v = maxV * i / 4, yy = y(v);
      grid += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="var(--border)" stroke-width="1" stroke-dasharray="' + (i ? '3 4' : '0') + '"/>';
      yl += '<text x="' + (padL - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="10.5" fill="var(--text-3)">' +
        (opts.money === false ? U.num(v, 0) : U.moneyShort(v)) + '</text>';
    }

    let bars = '', xl = '';
    const skip = data.length > 14 ? Math.ceil(data.length / 12) : 1;
    data.forEach((d, i) => {
      const cx = padL + slot * i + slot / 2;
      const h = Math.max(2, (Math.abs(d.value) / maxV) * innerH);
      const top = padT + innerH - h;
      const r = Math.min(5, bw / 2);
      const color = d.color || opts.color || 'var(--brand-500)';
      const op = d.kind === 'estimate' ? '.5' : d.kind === 'forecast' ? '.78' : '1';
      const tip = U.esc((d.fullLabel || d.label) + ' — ' + fmt(d.value, opts.money) + (d.sub ? ' · ' + d.sub : ''));
      bars += '<path class="bar-hover" d="M' + (cx - bw / 2) + ',' + (padT + innerH) +
        ' L' + (cx - bw / 2) + ',' + (top + r) +
        ' Q' + (cx - bw / 2) + ',' + top + ' ' + (cx - bw / 2 + r) + ',' + top +
        ' L' + (cx + bw / 2 - r) + ',' + top +
        ' Q' + (cx + bw / 2) + ',' + top + ' ' + (cx + bw / 2) + ',' + (top + r) +
        ' L' + (cx + bw / 2) + ',' + (padT + innerH) + ' Z" fill="' + color + '" opacity="' + op + '" data-tipv="' + tip + '"/>';
      if (d.kind === 'estimate') {
        bars += '<rect x="' + (cx - bw / 2) + '" y="' + top + '" width="' + bw + '" height="' + h + '" fill="none" stroke="' + color + '" stroke-width="1.2" stroke-dasharray="3 3" opacity=".7" pointer-events="none"/>';
      }
      if (i % skip === 0 || i === data.length - 1) {
        xl += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="var(--text-3)">' + U.esc(d.label) + '</text>';
      }
    });

    let target = '';
    if (opts.target) {
      const ty = y(opts.target);
      target = '<line x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty +
        '" stroke="var(--ok-500)" stroke-width="1.6" stroke-dasharray="6 4"/>' +
        '<text x="' + (W - padR) + '" y="' + (ty - 6) + '" text-anchor="end" font-size="10" fill="var(--ok-500)">cel ' + U.moneyShort(opts.target) + '</text>';
    }

    return wrap('<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
      grid + yl + bars + target + xl + '</svg>', opts);
  };

  /* ============================================================
     SŁUPKI GRUPOWANE (np. przychód vs koszty)
     series: [{name, color, values:[]}], labels: []
     ============================================================ */
  Ch.groupedBars = function (labels, series, opts) {
    opts = opts || {};
    const W = 660, H = opts.height || 240;
    const padL = 52, padR = 14, padT = 16, padB = 28;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    if (!labels.length) return wrap('<svg viewBox="0 0 ' + W + ' ' + H + '"></svg>');

    let max = 0;
    series.forEach((s) => s.values.forEach((v) => { max = Math.max(max, v); }));
    const maxV = niceMax(max || 1);
    const slot = innerW / labels.length;
    const n = series.length;
    const bw = Math.min(16, (slot * 0.7) / n);
    const y = (v) => padT + innerH - (v / maxV) * innerH;

    let grid = '', yl = '';
    for (let i = 0; i <= 4; i++) {
      const v = maxV * i / 4, yy = y(v);
      grid += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="var(--border)" stroke-width="1" stroke-dasharray="' + (i ? '3 4' : '0') + '"/>';
      yl += '<text x="' + (padL - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="10.5" fill="var(--text-3)">' + U.moneyShort(v) + '</text>';
    }
    let bars = '', xl = '';
    labels.forEach((lb, i) => {
      const groupW = bw * n + 3 * (n - 1);
      const startX = padL + slot * i + slot / 2 - groupW / 2;
      series.forEach((s, k) => {
        const v = s.values[i] || 0;
        const h = Math.max(1.5, (v / maxV) * innerH);
        const top = padT + innerH - h;
        const x0 = startX + k * (bw + 3);
        bars += '<rect class="bar-hover" x="' + x0 + '" y="' + top + '" width="' + bw + '" height="' + h + '" rx="3" fill="' + s.color + '" data-tipv="' +
          U.esc(lb + ' · ' + s.name + ' — ' + U.money(v)) + '"/>';
      });
      xl += '<text x="' + (padL + slot * i + slot / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="var(--text-3)">' + U.esc(lb) + '</text>';
    });

    const legend = '<div class="chart-legend">' + series.map((s) =>
      '<span><i style="background:' + s.color + '"></i>' + U.esc(s.name) + '</span>').join('') + '</div>';

    return wrap('<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' + grid + yl + bars + xl + '</svg>') + legend;
  };

  /* ============================================================
     PIERŚCIEŃ (struktura)
     data: [{label, value, color?}]
     ============================================================ */
  Ch.donut = function (data, opts) {
    opts = opts || {};
    const size = opts.size || 190;
    const R = size / 2, r = R * 0.62;
    const total = U.sum(data, (d) => d.value);
    if (!total) {
      return '<div class="chart center dim small" style="padding:32px 0">Brak danych do pokazania</div>';
    }
    let a0 = -Math.PI / 2, paths = '';
    data.forEach((d, i) => {
      const frac = d.value / total;
      const a1 = a0 + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const x0 = R + R * Math.cos(a0), y0 = R + R * Math.sin(a0);
      const x1 = R + R * Math.cos(a1), y1 = R + R * Math.sin(a1);
      const ix1 = R + r * Math.cos(a1), iy1 = R + r * Math.sin(a1);
      const ix0 = R + r * Math.cos(a0), iy0 = R + r * Math.sin(a0);
      const color = d.color || PALETTE[i % PALETTE.length];
      paths += '<path class="bar-hover" d="M' + x0 + ',' + y0 + ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + x1 + ',' + y1 +
        ' L' + ix1 + ',' + iy1 + ' A' + r + ',' + r + ' 0 ' + large + ' 0 ' + ix0 + ',' + iy0 + ' Z" fill="' + color +
        '" data-tipv="' + U.esc(d.label + ' — ' + U.money(d.value) + ' (' + U.pctLabel(frac * 100, 0) + ')') + '"/>';
      a0 = a1;
    });
    const center = opts.centerLabel
      ? '<text x="' + R + '" y="' + (R - 4) + '" text-anchor="middle" font-size="' + (size / 8.5) + '" font-weight="700" fill="var(--text)">' + U.esc(opts.centerLabel) + '</text>' +
        '<text x="' + R + '" y="' + (R + 14) + '" text-anchor="middle" font-size="' + (size / 17) + '" fill="var(--text-3)">' + U.esc(opts.centerSub || '') + '</text>'
      : '';
    const legend = '<div class="chart-legend">' + data.map((d, i) =>
      '<span><i style="background:' + (d.color || PALETTE[i % PALETTE.length]) + '"></i>' + U.esc(d.label) +
      ' <b class="mono">' + U.moneyShort(d.value) + '</b></span>').join('') + '</div>';

    return wrap('<svg viewBox="0 0 ' + size + ' ' + size + '" style="max-width:' + size + 'px;margin:0 auto">' + paths + center + '</svg>') + legend;
  };

  /* ============================================================
     SPARKLINE — miniwykres do kart KPI
     ============================================================ */
  Ch.sparkline = function (values, opts) {
    opts = opts || {};
    const W = opts.width || 90, H = opts.height || 30;
    if (!values.length) return '';
    const max = Math.max.apply(null, values) || 1;
    const min = Math.min.apply(null, values);
    const span = (max - min) || 1;
    const stepX = values.length > 1 ? W / (values.length - 1) : 0;
    const pts = values.map((v, i) => [i * stepX, H - 3 - ((v - min) / span) * (H - 6)]);
    const d = smoothPath(pts);
    const color = opts.color || 'var(--brand-500)';
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" fill="none">' +
      '<path d="' + d + ' L' + W + ',' + H + ' L0,' + H + ' Z" fill="' + color + '" opacity=".10"/>' +
      '<path d="' + d + '" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
      '</svg>';
  };

  /* ============================================================
     POZIOME SŁUPKI (rankingi)
     ============================================================ */
  Ch.hbars = function (data, opts) {
    opts = opts || {};
    const max = Math.max.apply(null, data.map((d) => d.value)) || 1;
    return '<div class="col gap-3">' + data.map((d, i) =>
      '<div class="rank-row">' +
        (opts.rank !== false ? '<span class="rank-row__pos ' + (i < 3 ? 'top' + (i + 1) : '') + '">' + (i + 1) + '</span>' : '') +
        '<div class="rank-row__bar">' +
          '<div class="row-between" style="margin-bottom:5px"><span class="truncate">' + (d.html || U.esc(d.label)) + '</span>' +
          '<strong class="mono small nowrap">' + (opts.money === false ? U.num(d.value, 0) + (opts.unit || '') : U.money(d.value)) + '</strong></div>' +
          '<div class="progress"><span style="width:' + U.pct(d.value, max) + '%;background:' + (d.color || 'var(--grad-brand)') + '"></span></div>' +
        '</div>' +
      '</div>').join('') + '</div>';
  };

  /* ============================================================
     TOOLTIPY — delegacja zdarzeń
     ============================================================ */
  Ch.bind = function () {
    document.addEventListener('mouseover', function (e) {
      const t = e.target.closest && e.target.closest('[data-tipv]');
      if (!t) return;
      const chart = t.closest('.chart');
      if (!chart) return;
      const tip = chart.querySelector('.chart__tip');
      if (!tip) return;
      tip.innerHTML = t.getAttribute('data-tipv');
      const cr = chart.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      tip.style.left = (tr.left + tr.width / 2 - cr.left) + 'px';
      tip.style.top = (tr.top - cr.top) + 'px';
      tip.classList.add('is-on');
    }, true);

    document.addEventListener('mouseout', function (e) {
      const t = e.target.closest && e.target.closest('[data-tipv]');
      if (!t) return;
      const chart = t.closest('.chart');
      if (!chart) return;
      const tip = chart.querySelector('.chart__tip');
      if (tip) tip.classList.remove('is-on');
    }, true);
  };

  Ch.PALETTE = PALETTE;
  window.TF.Charts = Ch;
})();

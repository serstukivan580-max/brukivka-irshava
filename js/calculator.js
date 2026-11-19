/* =========================================================================
   Калькулятор вартості — чисті функції (без DOM), щоб їх можна було тестувати.
   ========================================================================= */
(function (root) {
  'use strict';

  var LIMITS = {
    area:   { min: 1,   max: 5000 },
    side:   { min: 0.1, max: 500 },
    linear: { min: 0.1, max: 2000 }
  };

  /** Перетворює введення користувача на число. Повертає NaN, якщо це не число. */
  function toNumber(value) {
    if (typeof value === 'number') return isFinite(value) ? value : NaN;
    if (value === null || value === undefined) return NaN;
    var s = String(value).replace(/\s+/g, '').replace(',', '.');
    if (s === '' || !/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  function checkRange(n, lim, unit) {
    if (isNaN(n)) return 'Введіть число';
    if (n <= 0) return 'Значення має бути більше нуля';
    if (n < lim.min) return 'Мінімум ' + lim.min + ' ' + unit;
    if (n > lim.max) return 'Максимум ' + lim.max + ' ' + unit;
    return '';
  }

  /** Перевіряє введення. Повертає { ok, errors, area }. */
  function validate(input) {
    var errors = {};
    var area = NaN;

    if (input.mode === 'dims') {
      var l = toNumber(input.length);
      var w = toNumber(input.width);
      var el = checkRange(l, LIMITS.side, 'м');
      var ew = checkRange(w, LIMITS.side, 'м');
      if (el) errors.length = el;
      if (ew) errors.width = ew;
      if (!el && !ew) {
        area = l * w;
        if (area < LIMITS.area.min) errors.width = 'Площа замала (мін. 1 м²)';
        else if (area > LIMITS.area.max) errors.width = 'Площа завелика (макс. 5000 м²)';
      }
    } else {
      area = toNumber(input.area);
      var ea = checkRange(area, LIMITS.area, 'м²');
      if (ea) errors.area = ea;
    }

    if (input.curb) {
      var ec = checkRange(toNumber(input.curbLength), LIMITS.linear, 'м');
      if (ec) errors.curbLength = ec;
    }
    if (input.drain) {
      var ed = checkRange(toNumber(input.drainLength), LIMITS.linear, 'м');
      if (ed) errors.drainLength = ed;
    }

    var ok = Object.keys(errors).length === 0;
    return { ok: ok, errors: errors, area: ok ? round2(area) : NaN };
  }

  function round2(n) { return Math.round(n * 100) / 100; }
  function money(n) { return Math.round(n); }

  /**
   * Головний розрахунок.
   * input: { mode, area, length, width, tile, thickness, material: 'ours'|'client',
   *          demolition, excavation, base, curb, curbLength, drain, drainLength }
   * prices: CONFIG.prices
   * Повертає { ok, errors, area, lines: [{key,label,detail,amount}], total, minApplied }
   */
  function calculate(input, prices) {
    var v = validate(input);
    if (!v.ok) return { ok: false, errors: v.errors, area: NaN, lines: [], total: NaN, minApplied: false };

    var area = v.area;
    var lines = [];
    var tilePrice = prices.tile[input.tile];
    var laborPrice = prices.labor[input.thickness];

    if (tilePrice === undefined) return fail('tile', 'Оберіть тип бруківки');
    if (laborPrice === undefined) return fail('thickness', 'Оберіть товщину');

    if (input.material !== 'client') {
      var tileArea = area * (1 + (prices.reserveRatio || 0));
      lines.push({
        key: 'material', label: 'Бруківка',
        detail: round2(tileArea) + ' м² з запасом',
        amount: money(tileArea * tilePrice)
      });
    }

    lines.push({
      key: 'labor', label: 'Укладка',
      detail: input.thickness + ' см',
      amount: money(area * laborPrice)
    });

    var prep = 0;
    if (input.demolition) prep += prices.demolition;
    if (input.excavation) prep += prices.excavation;
    if (input.base) prep += prices.base;
    if (prep > 0) {
      lines.push({ key: 'prep', label: 'Підготовка основи', detail: area + ' м²', amount: money(area * prep) });
    }

    if (input.curb) {
      var cl = toNumber(input.curbLength);
      lines.push({ key: 'curb', label: 'Бордюр', detail: cl + ' пог. м', amount: money(cl * prices.curb) });
    }
    if (input.drain) {
      var dl = toNumber(input.drainLength);
      lines.push({ key: 'drain', label: 'Водовідвід', detail: dl + ' пог. м', amount: money(dl * prices.drain) });
    }

    var total = lines.reduce(function (s, l) { return s + l.amount; }, 0);
    var minApplied = false;
    if (prices.minOrder > 0 && total < prices.minOrder) {
      total = prices.minOrder;
      minApplied = true;
    }

    return { ok: true, errors: {}, area: area, lines: lines, total: total, minApplied: minApplied };

    function fail(field, msg) {
      var e = {}; e[field] = msg;
      return { ok: false, errors: e, area: NaN, lines: [], total: NaN, minApplied: false };
    }
  }

  /** 123456 -> "123 456 грн" */
  function formatMoney(n, currency) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return Math.round(n).toLocaleString('uk-UA').replace(/ | /g, ' ') + ' ' + (currency || 'грн');
  }

  root.BRUK = root.BRUK || {};
  root.BRUK.calc = {
    toNumber: toNumber,
    validate: validate,
    calculate: calculate,
    formatMoney: formatMoney,
    LIMITS: LIMITS
  };
})(typeof window !== 'undefined' ? window : globalThis);

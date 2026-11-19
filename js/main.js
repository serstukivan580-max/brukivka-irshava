/* =========================================================================
   Головний скрипт: шапка, меню, швидкий розрахунок, каталог, калькулятор,
   До/Після, галерея, TikTok/відгуки, анімації
   ========================================================================= */
(function () {
  'use strict';

  var CFG = window.BRUK.CONFIG;
  var calc = window.BRUK.calc;
  var P = CFG.prices;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return calc.formatMoney(n, P.currency); }
  function tileById(id) { return CFG.tiles.filter(function (t) { return t.id === id; })[0]; }
  function scrollToEl(el) {
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---- Телефон, рік ---------------------------------------------------- */
  $$('[data-phone-link]').forEach(function (a) { a.setAttribute('href', CFG.phone.href); });
  $$('[data-phone-text]').forEach(function (el) { el.textContent = CFG.phone.display; });
  var year = $('[data-year]'); if (year) year.textContent = new Date().getFullYear();

  /* ---- Шапка ----------------------------------------------------------- */
  var header = $('[data-header]');
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 30); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Мобільне меню --------------------------------------------------- */
  var burger = $('[data-burger]');
  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    document.body.classList.toggle('menu-open', open);
  }
  burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  $$('[data-nav] a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1024) setMenu(false); });

  /* ---- Каталог --------------------------------------------------------- */
  var catalog = $('[data-catalog]');
  if (catalog) {
    catalog.innerHTML = CFG.tiles.map(function (t) {
      return '<article class="ccard reveal">' +
        '<div class="ccard__media"><img src="' + esc(t.img) + '" alt="Бруківка «' + esc(t.name) + '»" loading="lazy"></div>' +
        '<div class="ccard__body">' +
          '<h3 class="ccard__name">' + esc(t.name) + '</h3>' +
          '<p class="ccard__note">' + esc(t.note) + '</p>' +
          '<div class="ccard__foot">' +
            '<span class="ccard__price">від ' + money(P.tile[t.id]) + ' <small>/ м²</small></span>' +
            '<button class="ccard__pick" type="button" data-pick="' + esc(t.id) + '">Порахувати →</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  /* ---- Калькулятор ----------------------------------------------------- */
  var form = $('[data-calc]');
  var calcApi = form ? initCalculator(form) : null;

  $$('[data-pick]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!calcApi) return;
      calcApi.setTile(b.getAttribute('data-pick'));
      scrollToEl($('#calculator'));
    });
  });

  function initCalculator(form) {
    // Типи бруківки
    $('[data-tiles]', form).innerHTML = CFG.tiles.map(function (t, i) {
      return '<label class="topt">' +
        '<input type="radio" name="tile" value="' + esc(t.id) + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<img class="topt__img" src="' + esc(t.img) + '" alt="" loading="lazy">' +
        '<span class="topt__check" aria-hidden="true"></span>' +
        '<span class="topt__body"><span class="topt__name">' + esc(t.name) + '</span>' +
        '<span class="topt__price">' + money(P.tile[t.id]) + ' / м²</span></span>' +
      '</label>';
    }).join('');

    // Товщина
    $('[data-thickness]', form).innerHTML = CFG.thickness.map(function (t) {
      return '<label class="thopt">' +
        '<input type="radio" name="thickness" value="' + t.value + '"' + (t.value === 6 ? ' checked' : '') + '>' +
        '<span class="thopt__layers" aria-hidden="true"><i style="--h:' + (t.value * 3) + 'px"></i><b></b></span>' +
        '<span class="thopt__name">' + esc(t.name) + '</span>' +
        '<span class="thopt__note">' + esc(t.note) + '</span>' +
      '</label>';
    }).join('');

    // Ціни біля чекбоксів
    var hints = { demolition: '/ м²', excavation: '/ м²', base: '/ м²', curb: '/ пог. м', drain: '/ пог. м' };
    Object.keys(hints).forEach(function (k) {
      var el = $('[data-price-hint="' + k + '"]', form);
      if (el) el.textContent = money(P[k]) + ' ' + hints[k];
    });

    var out = {
      area: $('[data-out-area]', form),
      tile: $('[data-out-tile]', form),
      breakdown: $('[data-breakdown]', form),
      total: $('[data-total]', form),
      per: $('[data-per]', form),
      note: $('[data-note]', form),
      toast: $('[data-toast]', form)
    };
    var currentTotal = 0, lastResult = null, animFrame = null;

    function field(name) { return form.querySelector('[name="' + name + '"]'); }
    function radio(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }

    function read() {
      return {
        mode: radio('mode'),
        area: field('area').value,
        length: field('length').value,
        width: field('width').value,
        tile: radio('tile'),
        thickness: Number(radio('thickness')),
        material: radio('material'),
        demolition: field('demolition').checked,
        excavation: field('excavation').checked,
        base: field('base').checked,
        curb: field('curb').checked,
        curbLength: field('curbLength').value,
        drain: field('drain').checked,
        drainLength: field('drainLength').value
      };
    }

    function showErrors(errors) {
      $$('[data-error]', form).forEach(function (el) {
        var key = el.getAttribute('data-error');
        var msg = errors[key] || '';
        el.textContent = msg;
        var input = field(key);
        if (input) {
          input.classList.toggle('is-invalid', !!msg);
          input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        }
      });
    }

    function animateTotal(to) {
      if (animFrame) cancelAnimationFrame(animFrame);
      var from = currentTotal;
      if (reduceMotion || from === to) { currentTotal = to; out.total.textContent = money(to); return; }
      var start = null, dur = 500;
      function tick(ts) {
        if (start === null) start = ts;
        var k = Math.min(1, (ts - start) / dur);
        var v = from + (to - from) * (1 - Math.pow(1 - k, 3));
        out.total.textContent = money(v);
        if (k < 1) animFrame = requestAnimationFrame(tick);
        else { currentTotal = to; animFrame = null; }
      }
      animFrame = requestAnimationFrame(tick);
      // Якщо вкладка у фоні й анімація не запустилась — все одно показати суму
      clearTimeout(animFallback);
      animFallback = setTimeout(function () {
        if (currentTotal !== to && lastResult && lastResult.res.total === to) {
          if (animFrame) cancelAnimationFrame(animFrame);
          animFrame = null; currentTotal = to; out.total.textContent = money(to);
        }
      }, dur + 200);
    }
    var animFallback;

    function update() {
      var input = read();

      $$('[data-mode-panel]', form).forEach(function (p) { p.hidden = p.getAttribute('data-mode-panel') !== input.mode; });
      $$('[data-dep]', form).forEach(function (el) {
        var on = field(el.getAttribute('data-dep')).checked;
        el.classList.toggle('is-disabled', !on);
        el.querySelector('input').disabled = !on;
      });

      var t = tileById(input.tile);
      out.tile.textContent = t ? t.name + ', ' + input.thickness + ' см' : '';

      var res = calc.calculate(input, P);
      showErrors(res.errors);

      if (!res.ok) {
        lastResult = null;
        out.area.textContent = '—';
        out.breakdown.innerHTML = '<li class="breakdown__empty">Перевірте поля, позначені червоним</li>';
        if (animFrame) cancelAnimationFrame(animFrame);
        out.total.textContent = '—';
        out.per.textContent = '';
        return;
      }

      lastResult = { input: input, res: res };
      out.area.textContent = String(res.area).replace('.', ',');
      out.breakdown.innerHTML = res.lines.map(function (l) {
        return '<li class="breakdown__row"><span class="breakdown__label">' + esc(l.label) +
          '<small>' + esc(String(l.detail).replace(/(\d)\.(\d)/g, '$1,$2')) + '</small></span>' +
          '<span class="breakdown__dots" aria-hidden="true"></span>' +
          '<span class="breakdown__val">' + money(l.amount) + '</span></li>';
      }).join('');
      out.per.textContent = '≈ ' + money(res.total / res.area) + ' за м² під ключ';

      var note = 'Орієнтовний розрахунок. Точну вартість назве майстер після заміру на місці.';
      if (res.minApplied) note = 'Застосовано мінімальну вартість замовлення. ' + note;
      if (P.isDemo) note += ' Ціни на сайті поки демонстраційні.';
      out.note.textContent = note;

      animateTotal(res.total);
    }

    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    // Надіслати розрахунок
    $('[data-share]', form).addEventListener('click', function () {
      if (!lastResult) { toast('Спочатку виправте помилки в полях'); return; }
      var text = buildSummary(lastResult.input, lastResult.res);
      if (navigator.share) {
        navigator.share({ title: 'Розрахунок бруківки', text: text }).catch(function () { /* скасовано */ });
        return;
      }
      copyText(text).then(function () {
        toast('Розрахунок скопійовано — вставте його у Viber чи Telegram');
      }, function () {
        toast('Не вдалося скопіювати. Зателефонуйте нам: ' + CFG.phone.display);
      });
    });

    function buildSummary(input, res) {
      var t = tileById(input.tile);
      var lines = [
        'Розрахунок викладки бруківки',
        'Площа: ' + res.area + ' м²',
        'Бруківка: ' + (t ? t.name : input.tile) + ', ' + input.thickness + ' см' +
          (input.material === 'client' ? ' (матеріал замовника)' : '')
      ];
      res.lines.forEach(function (l) { lines.push('• ' + l.label + ' (' + l.detail + '): ' + money(l.amount)); });
      lines.push('Разом орієнтовно: ' + money(res.total));
      lines.push('Хочу замовити замір. Тел.: ' + CFG.phone.display);
      return lines.join('\n');
    }

    var toastTimer;
    function toast(msg) {
      out.toast.textContent = msg;
      out.toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { out.toast.classList.remove('is-visible'); }, 3600);
    }

    update();

    return {
      setTile: function (id) {
        var r = form.querySelector('input[name="tile"][value="' + id + '"]');
        if (r) { r.checked = true; update(); }
      },
      setArea: function (val) {
        form.querySelector('input[name="mode"][value="area"]').checked = true;
        field('area').value = val;
        update();
      }
    };
  }

  /* ---- Швидкий розрахунок у hero --------------------------------------- */
  var quick = $('[data-quick]');
  if (quick) {
    var qTiles = $('[data-quick-tiles]', quick);
    qTiles.innerHTML = CFG.tiles.map(function (t) {
      return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>';
    }).join('');
    var qArea = $('input[name="qarea"]', quick);
    var qOut = $('[data-quick-total]', quick);

    var qUpdate = function () {
      var res = calc.calculate({
        mode: 'area', area: qArea.value, tile: qTiles.value, thickness: 6, material: 'ours',
        demolition: false, excavation: true, base: true, curb: false, drain: false
      }, P);
      qArea.classList.toggle('is-invalid', !res.ok);
      qOut.textContent = res.ok ? '≈ ' + money(res.total) : 'Вкажіть площу 1–5000 м²';
    };
    quick.addEventListener('input', qUpdate);
    quick.addEventListener('change', qUpdate);
    quick.addEventListener('submit', function (e) { e.preventDefault(); });
    $('[data-quick-more]', quick).addEventListener('click', function (e) {
      if (!calcApi) return;
      e.preventDefault();
      calcApi.setTile(qTiles.value);
      if (calc.validate({ mode: 'area', area: qArea.value }).ok) calcApi.setArea(qArea.value);
      scrollToEl($('#calculator'));
    });
    qUpdate();
  }

  /* ---- До / Після ------------------------------------------------------ */
  var works = $('[data-works]');
  if (works) window.BRUK.beforeAfter.render(works, CFG.works);
  var worksNote = $('[data-works-note]');
  if (worksNote) worksNote.hidden = !CFG.worksAreStock;

  /* ---- TikTok / відгуки ------------------------------------------------ */
  var reviews = $('[data-reviews]');
  if (reviews) {
    if (CFG.reviews && CFG.reviews.length) {
      reviews.classList.remove('tiktok');
      reviews.innerHTML =
        '<div class="section-head"><p class="kicker">Відгуки</p><h2 class="section-title">Що кажуть господарі</h2></div>' +
        '<div class="reviews-grid">' + CFG.reviews.map(function (r) {
          return '<blockquote class="review"><p>«' + esc(r.text) + '»</p><footer>' + esc(r.name) + '</footer></blockquote>';
        }).join('') + '</div>';
    } else {
      reviews.innerHTML =
        '<div class="tiktok__body">' +
          '<p class="kicker kicker--light">Наші об\'єкти наживо</p>' +
          '<h2 class="tiktok__title">Кожен двір — від голого ґрунту до готової бруківки — в нашому TikTok</h2>' +
          '<p class="tiktok__text">Показуємо реальні роботи без фільтрів: підготовку основи, укладку, результат. Подивіться відео та почитайте коментарі господарів.</p>' +
          '<a class="btn btn--accent btn--lg" href="' + esc(CFG.tiktok) + '" target="_blank" rel="noopener" style="align-self:flex-start">Дивитися ' + esc(CFG.tiktokHandle) + '</a>' +
        '</div>' +
        '<div class="tiktok__stats">' +
          '<div class="tiktok__stat"><b>5 500+</b><span>підписників</span></div>' +
          '<div class="tiktok__stat"><b>115 000+</b><span>вподобайок</span></div>' +
          '<div class="tiktok__stat tiktok__stat--wide">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.27 0 .53.04.77.12V9.8a5.7 5.7 0 1 0 4.93 5.6V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z"/></svg>' +
            '<span>Реальні об\'єкти з Іршави та області</span>' +
          '</div>' +
        '</div>';
    }
  }

  /* ---- Скопіювати номер ------------------------------------------------ */
  var copyBtn = $('[data-copy-phone]');
  if (copyBtn) {
    var copyLabel = copyBtn.textContent;
    copyBtn.addEventListener('click', function () {
      copyText(CFG.phone.display).then(function () {
        copyBtn.textContent = 'Номер скопійовано ✓';
      }, function () {
        copyBtn.textContent = CFG.phone.display;
      });
      setTimeout(function () { copyBtn.textContent = copyLabel; }, 2400);
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  /* ---- Галерея (лайтбокс) ---------------------------------------------- */
  var lb = $('[data-lightbox]');
  if (lb && typeof lb.showModal === 'function') {
    var lbImg = $('[data-lightbox-img]', lb);
    $$('[data-full]').forEach(function (b) {
      b.addEventListener('click', function () {
        var img = b.querySelector('img');
        lbImg.src = b.getAttribute('data-full');
        lbImg.alt = img ? img.alt : '';
        lb.showModal();
      });
    });
    $('[data-lightbox-close]', lb).addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  } else {
    $$('[data-full]').forEach(function (b) { b.style.cursor = 'default'; });
  }

  /* ---- Поява блоків при скролі ----------------------------------------- */
  var revealEls = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revealEls.forEach(function (el) { io.observe(el); });
  }
})();

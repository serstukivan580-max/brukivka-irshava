/* =========================================================================
   Блок «До / Після»: великий слайдер порівняння + перемикач об'єктів.
   Працює мишею, пальцем (тач) і з клавіатури (стрілки, Home/End).
   ========================================================================= */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ARROWS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 3 12l6 6M15 6l6 6-6 6"/></svg>';

  function render(container, works) {
    if (!works || !works.length) { container.hidden = true; return; }

    container.innerHTML =
      '<div class="ba-main">' +
        '<div class="ba" data-ba style="--pos:50%">' +
          '<img class="ba__img" data-ba-after alt="" draggable="false">' +
          '<div class="ba__before"><img class="ba__img" data-ba-before alt="" draggable="false"></div>' +
          '<span class="ba__tag ba__tag--before">До</span>' +
          '<span class="ba__tag ba__tag--after">Після</span>' +
          '<div class="ba__handle" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">' +
            '<span class="ba__knob">' + ARROWS + '</span>' +
          '</div>' +
        '</div>' +
        '<p class="ba__cap"><strong data-ba-title></strong><span data-ba-meta></span></p>' +
      '</div>' +
      (works.length > 1
        ? '<div class="ba-list" role="tablist" aria-label="Оберіть об\'єкт">' +
            works.map(function (w, i) {
              return '<button class="ba-thumb" type="button" role="tab" aria-selected="' + (i === 0) + '" data-ba-index="' + i + '">' +
                '<img src="' + esc(w.after) + '" alt="" loading="lazy">' +
                '<span><span class="ba-thumb__title">' + esc(w.title) + '</span>' +
                (w.meta ? '<span class="ba-thumb__meta">' + esc(w.meta) + '</span>' : '') + '</span>' +
              '</button>';
            }).join('') +
          '</div>'
        : '');

    var slider = container.querySelector('[data-ba]');
    var api = initSlider(slider);
    var imgBefore = container.querySelector('[data-ba-before]');
    var imgAfter = container.querySelector('[data-ba-after]');
    var title = container.querySelector('[data-ba-title]');
    var meta = container.querySelector('[data-ba-meta]');
    var thumbs = Array.prototype.slice.call(container.querySelectorAll('[data-ba-index]'));

    function show(i) {
      var w = works[i];
      imgBefore.src = w.before; imgBefore.alt = 'До: ' + w.title;
      imgAfter.src = w.after;   imgAfter.alt = 'Після: ' + w.title;
      title.textContent = w.title;
      meta.textContent = w.meta || '';
      api.label('Порівняння до і після: ' + w.title);
      api.set(50);
      thumbs.forEach(function (t, k) { t.setAttribute('aria-selected', String(k === i)); });
    }

    thumbs.forEach(function (t) {
      t.addEventListener('click', function () { show(Number(t.getAttribute('data-ba-index'))); });
    });

    show(0);

    // Невелика підказка-анімація при першій появі
    if ('IntersectionObserver' in window && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { io.disconnect(); api.hint(); }
      }, { threshold: 0.5 });
      io.observe(slider);
    }
  }

  function initSlider(el) {
    var handle = el.querySelector('.ba__handle');
    var pos = 50, dragging = false, touched = false;

    function set(p) {
      pos = Math.max(0, Math.min(100, p));
      el.style.setProperty('--pos', pos + '%');
      var r = Math.round(pos);
      handle.setAttribute('aria-valuenow', r);
      handle.setAttribute('aria-valuetext', 'Показано ' + r + '% фото «до»');
    }
    function fromEvent(e) {
      var rect = el.getBoundingClientRect();
      return ((e.clientX - rect.left) / rect.width) * 100;
    }

    el.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true; touched = true;
      el.classList.add('is-dragging');
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      set(fromEvent(e));
    });
    el.addEventListener('pointermove', function (e) { if (dragging) set(fromEvent(e)); });
    function stop() { dragging = false; el.classList.remove('is-dragging'); }
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('lostpointercapture', stop);

    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 2;
      var map = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step };
      touched = true;
      if (e.key in map) { set(pos + map[e.key]); e.preventDefault(); }
      else if (e.key === 'Home') { set(0); e.preventDefault(); }
      else if (e.key === 'End') { set(100); e.preventDefault(); }
    });

    function hint() {
      if (touched) return;
      var frames = [50, 62, 38, 50], i = 0;
      el.style.transition = 'none';
      (function next() {
        if (touched || i >= frames.length) return;
        animateTo(frames[i++], 450, next);
      })();
    }
    function animateTo(target, dur, done) {
      var from = pos, start = null;
      function tick(ts) {
        if (touched) return;
        if (start === null) start = ts;
        var k = Math.min(1, (ts - start) / dur);
        var e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        set(from + (target - from) * e);
        if (k < 1) requestAnimationFrame(tick); else if (done) done();
      }
      requestAnimationFrame(tick);
    }

    set(50);
    return {
      set: set,
      hint: hint,
      label: function (t) { handle.setAttribute('aria-label', t); }
    };
  }

  root.BRUK = root.BRUK || {};
  root.BRUK.beforeAfter = { render: render };
})(window);

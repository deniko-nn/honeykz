/* Плавная прокрутка с ограничением скорости: колесо, тачпад и клавиши.
   Страница едет к цели не быстрее MAX_SPEED пикселей в секунду, поэтому быстрым рывком
   пролистать блоки нельзя. Настройка скорости — константа MAX_SPEED ниже. */
(function () {
  'use strict';
  var MAX_SPEED = 1700;   // px/с: ~0,5 с на экран высотой 900 px
  var EASE = 0.14;        // «мягкость» разгона и остановки (меньше — плавнее)
  var root = document.documentElement;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var pos = window.scrollY, target = pos, lastSet = pos, raf = 0, last = 0;
  function maxY() { return Math.max(0, root.scrollHeight - window.innerHeight); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function tick(now) {
    var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
    /* кто-то другой сдвинул страницу (меню, магнит, полоса прокрутки): подхватываем её положение */
    if (Math.abs(window.scrollY - lastSet) > 2) { pos = target = window.scrollY; lastSet = pos; stop(); return; }
    var diff = target - pos;
    var step = diff * (1 - Math.pow(1 - EASE, dt * 60));
    var cap = MAX_SPEED * dt;
    step = clamp(step, -cap, cap);
    pos += step;
    window.scrollTo(0, pos);
    lastSet = window.scrollY;
    if (Math.abs(target - pos) < 0.5) { pos = target; window.scrollTo(0, pos); lastSet = window.scrollY; stop(); return; }
    raf = requestAnimationFrame(tick);
  }
  function go() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function push(delta) {
    if (!raf) { pos = target = window.scrollY; lastSet = pos; }
    var H = window.innerHeight;
    /* цель не уходит далеко от текущей точки: после остановки колеса страница быстро замирает */
    target = clamp(target + delta, Math.max(0, pos - H * 1.1), Math.min(maxY(), pos + H * 1.1));
    target = clamp(target, 0, maxY());
    go();
  }

  /* внутри прокручиваемых областей (корзина, шторка, поля ввода) колесо работает как обычно */
  function inScrollable(el) {
    while (el && el !== document.body && el !== root) {
      if (el.nodeType === 1) {
        var cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) return true;
        if (el.tagName === 'TEXTAREA') return true;
      }
      el = el.parentElement;
    }
    return false;
  }
  function locked() { return document.body.classList.contains('cart-open') || document.body.classList.contains('menu-open') || document.body.classList.contains('is-loading'); }

  window.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey || e.defaultPrevented || locked()) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (inScrollable(e.target)) return;
    e.preventDefault();
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 34; else if (e.deltaMode === 2) d *= window.innerHeight;
    push(d);
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || locked()) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if ((e.key === ' ' || e.key === 'Enter') && (tag === 'BUTTON' || tag === 'A')) return;
    var H = window.innerHeight, d = 0;
    switch (e.key) {
      case 'ArrowDown': d = 70; break;
      case 'ArrowUp': d = -70; break;
      case 'PageDown': d = H * 0.85; break;
      case 'PageUp': d = -H * 0.85; break;
      case ' ': d = e.shiftKey ? -H * 0.85 : H * 0.85; break;
      default: return;
    }
    e.preventDefault();
    push(d);
  });

  window.SmoothScroll = { maxSpeed: MAX_SPEED };
})();

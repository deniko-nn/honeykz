/* Плавная прокрутка как на nightkidz.shop: библиотека Lenis с теми же параметрами
   (длительность 1,2 с, экспоненциальное торможение, touchMultiplier 2).
   Lenis ведёт колесо и тачпад, а GSAP ScrollTrigger получает положение страницы на каждом кадре. */
(function () {
  'use strict';
  if (!window.Lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var MAX_SPEED = 2000;   // px/с: сколько прокрутки в секунду принимается от колеса (меньше — медленнее)
  var BURST = 700;        // запас на один рывок, px
  var budget = BURST, lastT = performance.now();

  var lenis = new Lenis({
    duration: 1.2,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
    touchMultiplier: 2,
    smoothWheel: true,
    anchors: false,
    /* Ограничитель скорости: «бюджет» прокрутки пополняется со скоростью MAX_SPEED px/с.
       Рывок колеса тратит бюджет; что не поместилось, отбрасывается. Так страницу нельзя промотать
       одним сильным жестом, а обычное чтение мышью или тачпадом не ограничивается. */
    virtualScroll: function (e) {
      if (e.event && e.event.type && e.event.type.indexOf('touch') === 0) return true;
      var now = performance.now();
      budget = Math.min(BURST, budget + (now - lastT) / 1000 * MAX_SPEED);
      lastT = now;
      var d = Math.abs(e.deltaY);
      if (d < 1) return true;
      if (budget < 1) return false;
      var take = Math.min(d, budget);
      budget -= take;
      e.deltaY = Math.sign(e.deltaY) * take;
      return true;
    }
  });
  window.__lenis = lenis;

  /* связка с анимациями прокрутки */
  if (window.gsap && window.ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    (function loop(t) { lenis.raf(t); requestAnimationFrame(loop); })(0);
  }

  /* корзина и мобильное меню закрывают страницу: прокрутка под ними останавливается */
  function sync() {
    var lock = document.body.classList.contains('cart-open') || document.body.classList.contains('menu-open') || document.body.classList.contains('is-loading');
    if (lock) lenis.stop(); else lenis.start();
  }
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
})();

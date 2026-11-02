(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = window.innerWidth < 768;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;

  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* Ширина окна без полосы прокрутки: 100vw её включает и сдвигает главы истории. */
  var track = $('#track');
  var chapterCount = $$('.chapter', track).length;
  var storyHead = $('.story-head'), storySticky = $('.story-sticky');
  function setHead() { storySticky.style.setProperty('--head', storyHead.offsetHeight + 'px'); }
  function setWidths() {
    setHead();
    var w = root.clientWidth;
    root.style.setProperty('--vw', w + 'px');
    track.style.width = (w * chapterCount) + 'px';
  }
  setWidths();
  ScrollTrigger.addEventListener('refreshInit', setWidths);
  if ('ResizeObserver' in window) new ResizeObserver(setHead).observe(storyHead);
  if (document.fonts) document.fonts.ready.then(setHead);

  /* ---------- 3D главного экрана ---------- */
  var hero = null;
  var data = window.HoneyData || { heroJars: [], chipNames: {} };
  try { hero = HeroScene($('#heroCanvas'), { mobile: mobile, reduce: reduce, jars: data.heroJars }); }
  catch (e) { root.classList.add('no-webgl'); }

  var panels = $$('.product');
  var products = $('#products');

  /* ---------- загрузчик ---------- */
  var pre = $('#preloader'), countEl = $('#preCount'), fillEl = $('#dropFill');
  var t0 = performance.now(), minMs = reduce ? 400 : 2400, ready = false, shown = 0, finished = false;
  var waits = $$('img').map(function (im) {
    return im.complete ? 1 : new Promise(function (r) { im.addEventListener('load', r); im.addEventListener('error', r); });
  });
  Promise.all([document.fonts ? document.fonts.ready : 1].concat(waits)).then(function () { ready = true; });
  setTimeout(function () { ready = true; }, 6000);

  function finish() {
    if (finished) return; finished = true;
    setTimeout(function () {
      pre.classList.add('is-done');
      document.body.classList.remove('is-loading');
      setTimeout(function () { document.body.classList.add('is-ready'); }, reduce ? 0 : 350);
      if (hero) hero.start();
      ScrollTrigger.refresh();
      var gone = function () { if (pre.parentNode) pre.parentNode.removeChild(pre); };
      pre.addEventListener('transitionend', gone);
      setTimeout(gone, 1500);
    }, reduce ? 0 : 500);
  }
  function tick(now) {
    var t = Math.min(1, (now - t0) / minMs), eased = 1 - Math.pow(1 - t, 3);
    shown = Math.max(shown, Math.min(eased, ready ? 1 : 0.92));
    countEl.textContent = Math.round(shown * 100);
    fillEl.setAttribute('y', String(160 * (1 - shown)));
    if (shown >= 1) finish(); else requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  /* шрифты и картинки меняют высоту блоков, поэтому пересчитываем точки закрепления */
  if (document.fonts) document.fonts.ready.then(function () { if (finished) ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { if (finished) ScrollTrigger.refresh(); });

  /* ---------- прокрутка к блокам ---------- */
  var dur = function (s) { return reduce ? 0.01 : s; };
  function pinOf(el) { return ScrollTrigger.getAll().filter(function (s) { return s.pin === el; })[0]; }
  function scrollToY(y, d, ease) {
    gsap.killTweensOf(window);
    gsap.to(window, { duration: dur(d || 0.8), ease: ease || 'power3.out', scrollTo: { y: y, autoKill: false } });
  }
  /* Закреплённый блок встаёт ровно к верхнему краю: прокручиваем к началу закрепления, без отступа. */
  function go(id) {
    var el = document.getElementById(id), st = pinOf(el);
    scrollToY(st ? st.start : el.getBoundingClientRect().top + window.scrollY, 1);
    header.classList.remove('is-open');
    closeMenu();
  }
  function goProduct(i) {
    var st = pinOf(products);
    if (st) scrollToY(st.start + i * (st.end - st.start) / Math.max(1, panels.length - 1), 1.2, 'power3.inOut');
    else scrollToY(panels[i].getBoundingClientRect().top + window.scrollY, 1);
  }

  /* ---------- шапка ---------- */
  var header = $('#siteHeader'), hnav = $('#hnav'), logo = $('#logo');
  var menuBtn = $('#menuBtn'), mmenu = $('#mmenu');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    mmenu.setAttribute('aria-hidden', String(!open));
    menuBtn.textContent = open ? 'Закрыть' : 'Меню';
  }
  function closeMenu() { setMenu(false); }
  menuBtn.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1023) closeMenu(); });
  function collapsed() { return header.classList.contains('is-collapsed'); }
  function onScroll() {
    var c = window.scrollY > 100;
    header.classList.toggle('is-collapsed', c);
    if (!c) header.classList.remove('is-open');
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var openT, closeT;
  hnav.addEventListener('mouseenter', function () { if (!collapsed()) return; clearTimeout(closeT); openT = setTimeout(function () { header.classList.add('is-open'); }, 120); });
  hnav.addEventListener('mouseleave', function () { clearTimeout(openT); closeT = setTimeout(function () { header.classList.remove('is-open'); }, 200); });
  logo.addEventListener('click', function () {
    if (collapsed()) header.classList.toggle('is-open');
    else scrollToY(0);
  });
  $$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-go')); }); });

  /* Цвет шапки и горшка зависит от участка: на светлых блоках тёмные линии, на тёмных — светлые. */
  var potEl = document.getElementById('honey-pot');
  function potTheme(onLight) { if (potEl) potEl.setAttribute('data-pot-theme', onLight ? 'light' : 'dark'); }
  function dark() { header.classList.add('is-dark'); potTheme(true); }
  function light() { header.classList.remove('is-dark'); potTheme(false); }
  ScrollTrigger.create({ trigger: '#products', start: 'top 20%', refreshPriority: -1, onEnter: dark, onEnterBack: dark, onLeaveBack: light });
  ScrollTrigger.create({ trigger: '#contact', start: 'top 50%', refreshPriority: -1, onEnter: light, onEnterBack: light, onLeaveBack: dark });

  /* ---------- главный экран: активен, пока он в кадре ---------- */
  /* Главный экран активен, пока он на виду. Считаем по позиции прокрутки, а не через ScrollTrigger:
     у ScrollTrigger «активно» ложно ровно в верхней точке страницы, и после возврата наверх банки не отзывались. */
  var heroOn = true;
  function syncHero() {
    if (!hero) return;
    var on = window.scrollY < window.innerHeight * 1.15;
    if (on) {
      /* start() и setActive() безопасны при повторном вызове, поэтому включаем при каждой проверке */
      hero.setActive(true);
      if (finished) hero.start();
    } else if (heroOn) {
      hero.deselect(); hero.setActive(false); hero.stop();
    }
    heroOn = on;
  }
  /* Проверяем не только при прокрутке, но и при движении мыши и касании: если какое-то
     событие прокрутки пропущено, главный экран всё равно включится. */
  ['scroll', 'resize', 'pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (t) {
    window.addEventListener(t, syncHero, { passive: true });
  });
  document.addEventListener('visibilitychange', syncHero);

  var chip = $('#heroChip'), chipName = $('#heroChipName');
  if (hero) {
    hero.onSelect(function (k) {
      var info = data.chipNames[k];
      if (k && info) { chipName.textContent = info.name; chip.dataset.idx = info.index; chip.hidden = false; }
      else chip.hidden = true;
    });
  }
  chip.addEventListener('click', function (e) { e.preventDefault(); goProduct(Number(chip.dataset.idx)); });

  /* ---------- продукты: карточки выезжают друг на друга ---------- */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (min-height: 640px)', function () {
    var n = panels.length;
    if (n < 2) { products.classList.add('is-flow'); return; }
    products.classList.remove('is-flow');
    gsap.set(panels, { zIndex: function (i) { return i; }, '--dim': 0, '--sh': 0 });
    gsap.set(panels.slice(1), { yPercent: 100, borderTopLeftRadius: 40, borderTopRightRadius: 40 });
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: products, start: 'top top',
        end: function () { return '+=' + ((n - 1) * window.innerHeight); },
        scrub: true, pin: true, anticipatePin: 1,
        /* каждый блок «досаживается» в окно целиком, а не остаётся на полпути */
        snap: reduce ? false : { snapTo: 1 / (n - 1), duration: { min: 0.25, max: 0.8 }, delay: 0.08, ease: 'power2.inOut' }
      }
    });
    /* Магнит между главным экраном и мёдом: остановка «почти у блока» доезжает до блока,
       иначе сверху остаётся полоса главного экрана, пока не прокрутишь ещё. */
    var pin = tl.scrollTrigger;
    ScrollTrigger.create({
      start: 0,
      end: function () { return pin.start; },
      snap: reduce ? false : {
        snapTo: function (v, self) { return v < 0.12 ? 0 : v > 0.88 ? 1 : (self.direction > 0 ? 1 : 0); },
        duration: { min: 0.3, max: 0.8 }, delay: 0.08, ease: 'power2.inOut'
      }
    });
    for (var i = 1; i < n; i++) {
      /* новая карточка поднимается и выпрямляет верхние углы */
      tl.to(panels[i], { yPercent: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, ease: 'none', duration: 1 }, i - 1);
      /* тень появляется, только когда карточка уже выезжает, а не ждёт под экраном */
      tl.to(panels[i], { '--sh': 1, ease: 'none', duration: 0.2 }, i - 1);
      /* предыдущая чуть сдвигается вверх и темнеет, уходя «вглубь» (без масштабирования, чтобы текст оставался чётким) */
      tl.to(panels[i - 1], { yPercent: -5, '--dim': 0.34, borderTopLeftRadius: 32, borderTopRightRadius: 32, ease: 'none', duration: 1 }, i - 1);
    }
  });
  mm.add('(max-width: 1023px), (max-height: 639px)', function () {
    products.classList.add('is-flow');
    /* верх липкой карточки = высота экрана минус высота блока: нижний край упирается в низ экрана,
       пока следующая карточка наезжает сверху */
    function layout() {
      panels.forEach(function (p) { p.style.setProperty('--stick', Math.min(0, window.innerHeight - p.offsetHeight) + 'px'); });
    }
    layout();
    var ro = ('ResizeObserver' in window) ? new ResizeObserver(layout) : null;
    if (ro) panels.forEach(function (p) { ro.observe(p); });
    window.addEventListener('resize', layout);
    ScrollTrigger.addEventListener('refresh', layout);
    return function () {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', layout);
      ScrollTrigger.removeEventListener('refresh', layout);
      panels.forEach(function (p) { p.style.removeProperty('--stick'); });
    };
  });

  /* ---------- галерея: зум под курсором и миниатюры ---------- */
  panels.forEach(function (p) {
    var zoom = $('.zoom', p), img = $('.zoom-img', p), thumbs = $$('.thumb', p), idx = 0;
    function show(i) {
      idx = (i + thumbs.length) % thumbs.length;
      img.src = thumbs[idx].getAttribute('data-src');
      thumbs.forEach(function (o, k) { o.classList.toggle('is-on', k === idx); });
      if (!reduce && img.animate) img.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    }
    zoom.addEventListener('mousemove', function (e) {
      var r = zoom.getBoundingClientRect();
      zoom.style.setProperty('--x', ((e.clientX - r.left) / r.width * 100) + '%');
      zoom.style.setProperty('--y', ((e.clientY - r.top) / r.height * 100) + '%');
    });
    if (thumbs.length < 2) return;
    thumbs.forEach(function (t, k) { t.addEventListener('click', function () { show(k); }); });
    /* свайп по фото листает кадры */
    var sx = null, sy = null;
    zoom.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    zoom.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) show(idx + (dx < 0 ? 1 : -1));
      sx = null;
    }, { passive: true });
  });

  /* ---------- история: горизонтальная прокрутка, главы встают ровно в окно ---------- */
  var sBar = $('#storyBar'), sCount = $('#storyCount');
  gsap.to(track, {
    x: function () { return -(track.scrollWidth - root.clientWidth); }, ease: 'none',
    scrollTrigger: {
      trigger: '#story', start: 'top top',
      end: function () { return '+=' + (track.scrollWidth - root.clientWidth); },
      scrub: 1, pin: true, invalidateOnRefresh: true,
      onUpdate: function (self) {
        sBar.style.transform = 'scaleX(' + self.progress + ')';
        sCount.textContent = (Math.round(self.progress * (chapterCount - 1)) + 1) + ' / ' + chapterCount;
      },
      snap: reduce ? false : { snapTo: 1 / (chapterCount - 1), duration: { min: 0.2, max: 0.7 }, delay: 0.1, ease: 'power1.inOut' }
    }
  });

  /* ---------- форма: открывает письмо в почтовой программе ---------- */
  $('#contactForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target.elements;
    var body = 'Имя: ' + f.name.value + '\nКонтакт: ' + f.contact.value + '\n\n' + f.message.value;
    window.location.href = 'mailto:info@med.kz?subject=' + encodeURIComponent('Заказ с сайта') + '&body=' + encodeURIComponent(body);
  });
})();

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
    /* при включённом Lenis переход делает он, чтобы не спорить с плавной прокруткой */
    if (window.__lenis) {
      window.__lenis.scrollTo(y, { duration: dur(d || 1.2), force: true, easing: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } });
      return;
    }
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
  var themed = [document.getElementById('honey-pot')];
  function potTheme(onLight) { themed.forEach(function (el) { if (el) el.setAttribute('data-pot-theme', onLight ? 'light' : 'dark'); }); }
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
    /* главный экран нужен, пока блок мёдов не дошёл до верха окна (его высота = высота прокладки) */
    var sp = document.querySelector('.spacer'), edge = sp ? sp.offsetHeight - 2 : window.innerHeight;
    var on = window.scrollY < edge;
    if (on) {
      /* start() и setActive() безопасны при повторном вызове, поэтому включаем при каждой проверке */
      hero.setActive(true);
      if (finished) hero.start();
    } else if (heroOn) {
      hero.deselect(); hero.setActive(false); hero.stop();
    }
    heroOn = on;
    var hf = document.getElementById('hero'); if (hf) hf.classList.toggle('is-off', !on);
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
  /* Закреплённая стопка: компьютер и телефон в портрете. На телефоне карточка умещается в один экран
     (is-compact), подробности открываются кнопкой «Подробнее». */
  mm.add('(min-width: 1024px) and (min-height: 640px) and (hover: hover) and (pointer: fine)', function () {
    var n = panels.length;
    if (n < 2) { products.classList.add('is-flow'); return; }
    products.classList.remove('is-flow');
    var compact = window.innerWidth < 768;
    products.classList.toggle('is-compact', compact);
    /* затемнение предыдущей карточки — отдельный слой: анимируем только его прозрачность (дёшево для слоёв) */
    panels.forEach(function (p) { if (!$('.pdim', p)) { var d = document.createElement('div'); d.className = 'pdim'; p.appendChild(d); } });
    gsap.set(panels, { zIndex: function (i) { return i; } });
    gsap.set(panels.slice(1), { yPercent: 108, borderTopLeftRadius: 40, borderTopRightRadius: 40 });
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: products, start: 'top top',
        end: function () { return '+=' + ((n - 1) * window.innerHeight); },
        scrub: true, pin: true, anticipatePin: 1,
        /* каждый блок «досаживается» в окно целиком, а не остаётся на полпути */
        snap: (reduce || window.__lenis) ? false : { snapTo: function (v) { return Math.round(v * (n - 1)) / (n - 1); }, directional: false, inertia: false, duration: { min: 0.25, max: 0.8 }, delay: 0.08, ease: 'power2.inOut' }
      }
    });
    /* Магнит между главным экраном и мёдом: остановка «почти у блока» доезжает до блока,
       иначе сверху остаётся полоса главного экрана, пока не прокрутишь ещё. */
    var pin = tl.scrollTrigger;
    ScrollTrigger.create({
      start: 0,
      end: function () { return pin.start; },
      snap: (reduce || window.__lenis) ? false : {
        snapTo: function (v, self) { return v < 0.12 ? 0 : v > 0.88 ? 1 : (self.direction > 0 ? 1 : 0); },
        inertia: false, duration: { min: 0.3, max: 0.8 }, delay: 0.08, ease: 'power2.inOut'
      }
    });
    for (var i = 1; i < n; i++) {
      /* новая карточка поднимается и выпрямляет верхние углы */
      tl.to(panels[i], { yPercent: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, ease: 'none', duration: 1 }, i - 1);
      /* предыдущая чуть сдвигается вверх и темнеет, уходя «вглубь» (без масштабирования, чтобы текст оставался чётким) */
      tl.to(panels[i - 1], { yPercent: -5, borderTopLeftRadius: 32, borderTopRightRadius: 32, ease: 'none', duration: 1 }, i - 1);
      tl.to($('.pdim', panels[i - 1]), { opacity: 0.34, ease: 'none', duration: 1 }, i - 1);
    }
    return function () { products.classList.remove('is-compact'); closeSheets(); };
  });

  /* «Подробнее» на телефоне: нижняя шторка с характеристиками внутри карточки. */
  function closeSheets() {
    panels.forEach(function (p) {
      p.classList.remove('is-more');
      var m = $('.more', p); if (m) { m.setAttribute('aria-expanded', 'false'); m.textContent = 'Подробнее'; }
    });
  }
  panels.forEach(function (p) {
    var m = $('.more', p);
    if (!m) return;
    m.addEventListener('click', function () {
      var open = !p.classList.contains('is-more');
      closeSheets();
      if (open) {
        /* шторка начинается под строкой с ценой и кнопками, чтобы их не перекрывать */
        var row = $('.buy-row', p), sheet = $('.details', p);
        if (row && sheet) sheet.style.top = (row.offsetTop + row.offsetHeight + 14) + 'px';
        p.classList.add('is-more'); m.setAttribute('aria-expanded', 'true'); m.textContent = 'Закрыть';
      }
    });
  });
  window.addEventListener('scroll', function () { if (document.querySelector('.product.is-more')) closeSheets(); }, { passive: true });
  /* Телефоны, планшеты и сенсорные экраны: обычный список без закрепления, наезда и анимации */
  mm.add('(max-width: 1023px), (max-height: 639px), (hover: none), (pointer: coarse)', function () {
    products.classList.add('is-flow');
    return function () { products.classList.remove('is-flow'); };
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
      snap: (reduce || window.__lenis) ? false : { snapTo: 1 / (chapterCount - 1), duration: { min: 0.2, max: 0.7 }, delay: 0.1, ease: 'power1.inOut' }
    }
  });

  /* ---------- доводка до ближайшей карточки (Lenis) ----------
     Когда прокрутка остановилась рядом с карточкой или главой, страница плавно докатывается до неё.
     Это заменяет «магниты» ScrollTrigger, которые спорили бы с плавной прокруткой. */
  (function () {
    var lenis = window.__lenis;
    if (!lenis || reduce) return;
    function pins() { return ScrollTrigger.getAll().filter(function (t) { return t.pin; }); }
    function points(y, dir) {
      var all = pins(), prod = all.filter(function (t) { return t.pin === products; })[0];
      var story = all.filter(function (t) { return t.pin === storySticky.parentElement || t.trigger === $('#story'); })[0];
      var list = [];
      if (prod) {
        if (y < prod.start - 2) return [0, prod.start];                  // между главным экраном и мёдом
        if (y <= prod.end + 2) { for (var i = 0; i < panels.length; i++) list.push(prod.start + i * (prod.end - prod.start) / Math.max(1, panels.length - 1)); return list; }
      }
      if (story && y >= story.start - 2 && y <= story.end + 2) {
        for (var k = 0; k < chapterCount; k++) list.push(story.start + k * (story.end - story.start) / Math.max(1, chapterCount - 1));
        return list;
      }
      return null;
    }
    var timer = 0, lastY = window.scrollY, dir = 1;
    function settle() {
      if (lenis.isScrolling) { timer = setTimeout(settle, 120); return; }
      var y = window.scrollY, pts = points(y, dir);
      if (!pts) return;
      var best = pts[0];
      if (pts.length === 2 && pts[0] === 0) {         // зона главного экрана: до 12% и после 88% решает близость, посередине — направление
        var t = (y - pts[0]) / (pts[1] - pts[0]);
        best = t < 0.12 ? pts[0] : t > 0.88 ? pts[1] : (dir > 0 ? pts[1] : pts[0]);
      } else {
        pts.forEach(function (v) { if (Math.abs(v - y) < Math.abs(best - y)) best = v; });
      }
      if (Math.abs(best - y) > 2) lenis.scrollTo(best, { duration: 0.75, force: false, easing: function (t) { return 1 - Math.pow(1 - t, 3); } });
    }
    window.addEventListener('scroll', function () {
      var y = window.scrollY; if (y !== lastY) { dir = y > lastY ? 1 : -1; lastY = y; }
      clearTimeout(timer); timer = setTimeout(settle, 140);
    }, { passive: true });
  })();

  /* ---------- форма: открывает письмо в почтовой программе ---------- */
  $('#contactForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target.elements;
    var body = 'Имя: ' + f.name.value + '\nКонтакт: ' + f.contact.value + '\n\n' + f.message.value;
    window.location.href = 'mailto:info@med.kz?subject=' + encodeURIComponent('Заказ с сайта') + '&body=' + encodeURIComponent(body);
  });
})();

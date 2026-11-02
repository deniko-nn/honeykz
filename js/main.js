(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = window.innerWidth < 768;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- 3D: главный экран и облака точек ---------- */
  var hero = null;
  try { hero = HeroScene($('#heroCanvas'), { mobile: mobile, reduce: reduce }); }
  catch (e) { document.documentElement.classList.add('no-webgl'); }

  var panels = $$('.product');
  var products = $('#products');
  var clouds = panels.map(function (el) {
    try {
      return HoneyCloud($('.cloud', el), { accent: getComputedStyle(el).getPropertyValue('--accent').trim(), mobile: mobile, reduce: reduce });
    } catch (e) { return null; }
  });

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

  /* ---------- шапка ---------- */
  var header = $('#siteHeader'), hnav = $('#hnav'), logo = $('#logo');
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

  function scrollToY(y) { gsap.killTweensOf(window); gsap.to(window, { duration: reduce ? 0.01 : 0.8, ease: 'power3.out', scrollTo: { y: y } }); }
  function go(id) {
    gsap.killTweensOf(window);
    gsap.to(window, { duration: reduce ? 0.01 : 0.8, ease: 'power3.out', scrollTo: { y: '#' + id, offsetY: 80 } });
    header.classList.remove('is-open');
  }
  $$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-go')); }); });

  function dark() { header.classList.add('is-dark'); }
  function light() { header.classList.remove('is-dark'); }
  ScrollTrigger.create({ trigger: '#products', start: 'top 20%', refreshPriority: -1, onEnter: dark, onEnterBack: dark, onLeaveBack: light });
  ScrollTrigger.create({ trigger: '#contact', start: 'top 50%', refreshPriority: -1, onEnter: light, onEnterBack: light, onLeaveBack: dark });

  /* ---------- главный экран: активен, пока он в кадре ---------- */
  ScrollTrigger.create({
    start: 0, end: function () { return window.innerHeight * 1.15; },
    onToggle: function (self) {
      if (!hero) return;
      hero.setActive(self.isActive);
      if (self.isActive) { if (finished) hero.start(); } else hero.stop();
    }
  });

  var NAMES = { tsvetochny: 'Цветочный мёд', gorny: 'Горный мёд', lipovy: 'Липовый мёд' };
  var ORDER = ['tsvetochny', 'gorny', 'lipovy'];
  var chip = $('#heroChip'), chipName = $('#heroChipName');
  if (hero) {
    hero.onSelect(function (k) {
      if (k) { chipName.textContent = NAMES[k]; chip.dataset.idx = ORDER.indexOf(k); chip.hidden = false; }
      else chip.hidden = true;
    });
  }
  function goProduct(i) {
    var st = ScrollTrigger.getAll().filter(function (s) { return s.pin === products; })[0];
    gsap.killTweensOf(window);
    if (st) {
      var y = st.start + i * (st.end - st.start) / Math.max(1, panels.length - 1);
      gsap.to(window, { duration: reduce ? 0.01 : 1.2, ease: 'power3.inOut', scrollTo: { y: y } });
    } else {
      gsap.to(window, { duration: reduce ? 0.01 : 1, ease: 'power3.out', scrollTo: { y: panels[i], offsetY: 60 } });
    }
  }
  chip.addEventListener('click', function (e) { e.preventDefault(); goProduct(Number(chip.dataset.idx)); });

  /* ---------- продукты: стопка выезжает друг на друга ---------- */
  var activeIdx = -1;
  function setActive(i) {
    if (i === activeIdx) return;
    activeIdx = i;
    clouds.forEach(function (c, k) { if (!c) return; if (k === i) { c.scatter(); c.start(); } else c.stop(); });
  }
  function stopClouds() { activeIdx = -1; clouds.forEach(function (c) { if (c) c.stop(); }); }

  var mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (min-height: 640px)', function () {
    products.classList.remove('is-flow');
    gsap.set(panels, { zIndex: function (i) { return i; } });
    gsap.set(panels.slice(1), { yPercent: 100 });
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: products, start: 'top top',
        end: function () { return '+=' + ((panels.length - 1) * window.innerHeight); },
        scrub: true, pin: true, anticipatePin: 1,
        onUpdate: function (self) { setActive(Math.round(self.progress * (panels.length - 1))); }
      }
    });
    panels.slice(1).forEach(function (p) { tl.to(p, { yPercent: 0, ease: 'none', duration: 1 }); });
    ScrollTrigger.create({ trigger: products, start: 'top bottom', onEnter: function () { activeIdx = -1; setActive(0); }, onLeaveBack: stopClouds });
    ScrollTrigger.create({ trigger: '#story', start: 'top bottom', onEnter: stopClouds, onLeaveBack: function () { activeIdx = -1; setActive(panels.length - 1); } });
    return stopClouds;
  });
  mm.add('(max-width: 1023px), (max-height: 639px)', function () {
    products.classList.add('is-flow');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        var c = clouds[panels.indexOf(en.target)]; if (!c) return;
        if (en.isIntersecting) { c.scatter(); c.start(); } else c.stop();
      });
    }, { threshold: 0.35 });
    panels.forEach(function (p) { io.observe(p); });
    return function () { io.disconnect(); stopClouds(); };
  });

  /* ---------- галерея: зум под курсором и миниатюры ---------- */
  panels.forEach(function (p) {
    var zoom = $('.zoom', p), img = $('.zoom-img', p);
    zoom.addEventListener('mousemove', function (e) {
      var r = zoom.getBoundingClientRect();
      zoom.style.setProperty('--x', ((e.clientX - r.left) / r.width * 100) + '%');
      zoom.style.setProperty('--y', ((e.clientY - r.top) / r.height * 100) + '%');
    });
    $$('.thumb', p).forEach(function (t) {
      t.addEventListener('click', function () {
        img.src = t.getAttribute('data-src');
        $$('.thumb', p).forEach(function (o) { o.classList.toggle('is-on', o === t); });
      });
    });
  });

  /* ---------- история: горизонтальная прокрутка с закреплением ---------- */
  var track = $('#track');
  gsap.to(track, {
    x: function () { return -(track.scrollWidth - window.innerWidth); }, ease: 'none',
    scrollTrigger: {
      trigger: '#story', start: 'top top',
      end: function () { return '+=' + (track.scrollWidth - window.innerWidth); },
      scrub: 1, pin: true, invalidateOnRefresh: true
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

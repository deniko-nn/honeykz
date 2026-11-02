/* Полоса прокрутки в виде сот: лента шестиугольников у правого края.
   Ячейки наполняются мёдом по мере прокрутки; по ленте можно кликать и перетаскивать (мышью). */
(function () {
  'use strict';
  var host = document.getElementById('comb-scroll');
  if (!host) return;
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var N = 22, r = 10, w = Math.sqrt(3) * r, step = 1.5 * r, pad = 1.5;
  var W = 2 * w + pad * 2, H = (N - 1) * step + 2 * r + pad * 2;
  host.style.aspectRatio = (W / H).toFixed(4);

  /* Острый шестиугольник; ячейки идут «в шахматном порядке», как настоящие соты. */
  function hex(cx, cy) {
    var p = [];
    for (var k = 0; k < 6; k++) {
      var a = Math.PI / 180 * (60 * k + 30);
      p.push((cx + (r - 0.8) * Math.cos(a)).toFixed(2) + ',' + (cy + (r - 0.8) * Math.sin(a)).toFixed(2));
    }
    return p.join(' ');
  }
  var cells = '';
  for (var i = 0; i < N; i++) {
    cells += '<polygon points="' + hex(pad + w / 2 + (i % 2 ? w / 2 : 0), pad + r + i * step) + '"/>';
  }
  host.innerHTML = '<svg viewBox="0 0 ' + W.toFixed(2) + ' ' + H.toFixed(2) + '" aria-hidden="true" focusable="false">' + cells + '</svg>';
  var polys = [].slice.call(host.querySelectorAll('polygon'));

  function progress() {
    var run = root.scrollHeight - window.innerHeight;
    return run > 0 ? Math.min(1, Math.max(0, window.scrollY / run)) : 0;
  }

  var queued = false, last = -1;
  function paint() {
    queued = false;
    var p = progress();
    if (p === last) return;
    last = p;
    var pos = p * N, cur = Math.min(N - 1, Math.floor(pos));
    for (var i = 0; i < N; i++) {
      var f = Math.max(0, Math.min(1, pos - i));
      polys[i].style.fillOpacity = f.toFixed(3);
      polys[i].classList.toggle('is-now', i === cur && p > 0.001);
    }
  }
  function ask() { if (!queued) { queued = true; requestAnimationFrame(paint); } }
  window.addEventListener('scroll', ask, { passive: true });
  window.addEventListener('resize', ask);
  if ('ResizeObserver' in window) new ResizeObserver(ask).observe(root);
  paint();

  /* Управление мышью: клик и перетаскивание по ленте листают страницу. */
  var dragging = false;
  function jump(e) {
    var b = host.getBoundingClientRect();
    var p = Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
    window.scrollTo(0, p * (root.scrollHeight - window.innerHeight));
  }
  host.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    dragging = true;
    host.classList.add('is-drag');
    try { host.setPointerCapture(e.pointerId); } catch (err) {}
    jump(e);
  });
  host.addEventListener('pointermove', function (e) { if (dragging) jump(e); });
  function end(e) {
    if (!dragging) return;
    dragging = false;
    host.classList.remove('is-drag');
    try { host.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
})();

/* Корзина: выезжающая панель, состав заказа, данные покупателя и отправка заказа в WhatsApp.
   Номер и способы получения берутся из data/honey.js (HONEY_SETTINGS). */
(function () {
  'use strict';
  var data = window.HoneyData;
  if (!data || !data.products.length) return;
  var settings = data.settings || {};
  var NB = ' ';
  var STORE = 'med-kz-cart-v1';
  var byId = {};
  data.products.forEach(function (p) { byId[p.id] = p; });
  var waNumber = String(settings.whatsapp || '').replace(/\D/g, '');
  var methods = (settings.получение && settings.получение.length) ? settings.получение : [{ название: 'Самовывоз', адрес: false }];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- состояние ---------- */
  var cart = {};   // id -> количество
  var form = { method: 0, name: '', phone: '', address: '', comment: '' };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    Object.keys(saved.items || {}).forEach(function (id) { if (byId[id] && saved.items[id] > 0) cart[id] = Math.min(99, saved.items[id] | 0); });
    if (saved.form) Object.keys(form).forEach(function (k) { if (saved.form[k] != null) form[k] = saved.form[k]; });
  } catch (e) {}
  if (!methods[form.method]) form.method = 0;
  function persist() { try { localStorage.setItem(STORE, JSON.stringify({ items: cart, form: form })); } catch (e) {} }

  function count() { return Object.keys(cart).reduce(function (n, id) { return n + cart[id]; }, 0); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function total() {
    var sum = 0, unknown = 0;
    Object.keys(cart).forEach(function (id) {
      var pr = byId[id].price;
      if (isNum(pr)) sum += pr * cart[id]; else unknown++;
    });
    return { sum: sum, unknown: unknown };
  }
  function priceLine(p, q) { return isNum(p.price) ? data.money(p.price * q) : (p.price ? String(p.price) : 'цена по запросу'); }

  /* ---------- разметка ---------- */
  var btn = document.createElement('button');
  btn.className = 'cart-btn'; btn.type = 'button'; btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg><span class="cart-btn-t">Корзина</span><b class="cart-n" aria-live="polite">0</b>';
  /* кнопка живёт внутри меню шапки, чтобы стоять с ним в одном ряду */
  (document.getElementById('hnav') || document.getElementById('siteHeader') || document.body).appendChild(btn);

  var wrap = document.createElement('div');
  wrap.className = 'cart';
  wrap.innerHTML =
    '<div class="cart-backdrop" data-close></div>' +
    '<aside class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cartTitle" tabindex="-1" aria-hidden="true">' +
      '<header class="cart-head"><h2 id="cartTitle">Корзина</h2><button class="cart-x" type="button" data-close aria-label="Закрыть корзину"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></button></header>' +
      '<div class="cart-body" id="cartBody"></div>' +
    '</aside>';
  document.body.appendChild(wrap);
  var panel = $('.cart-panel', wrap), body = $('#cartBody', wrap);

  var toast = document.createElement('div');
  toast.className = 'cart-toast'; toast.setAttribute('role', 'status');
  document.body.appendChild(toast);

  /* ---------- отрисовка ---------- */
  function render() {
    var ids = Object.keys(cart);
    var n = count();
    $('.cart-n', btn).textContent = n;
    btn.classList.toggle('has-items', n > 0);
    btn.setAttribute('aria-label', 'Корзина, товаров: ' + n);

    if (!ids.length) {
      body.innerHTML = '<div class="cart-empty"><p class="cart-empty-t">В корзине пока пусто</p><p>Выберите мёд и нажмите «В корзину».</p><button class="cart-go" type="button" data-go-products>Выбрать мёд</button></div>';
      return;
    }
    var items = ids.map(function (id) {
      var p = byId[id], q = cart[id];
      return '<li class="ci" data-id="' + id + '"><img src="' + esc(p.images[0]) + '" alt="">' +
        '<div class="ci-main"><p class="ci-name">' + esc(p.name) + '</p>' + (p.unit ? '<p class="ci-unit">' + esc(p.unit) + '</p>' : '') +
        '<div class="ci-row"><div class="qty"><button type="button" data-dec aria-label="Меньше">−</button><span aria-live="polite">' + q + '</span><button type="button" data-inc aria-label="Больше">+</button></div>' +
        '<span class="ci-sum">' + esc(priceLine(p, q)) + '</span></div></div>' +
        '<button class="ci-del" type="button" data-del aria-label="Убрать «' + esc(p.name) + '»"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>';
    }).join('');

    var t = total();
    var m = methods[form.method];
    var radios = methods.map(function (mt, i) {
      return '<label class="opt"><input type="radio" name="method" value="' + i + '"' + (i === form.method ? ' checked' : '') + '><span>' + esc(mt.название) + '</span></label>';
    }).join('');
    var totalTxt = t.sum ? data.money(t.sum) : '—';
    body.innerHTML =
      '<ul class="cart-list">' + items + '</ul>' +
      '<form class="cart-form" id="cartForm" novalidate>' +
        '<fieldset class="methods"><legend>Как получить заказ</legend>' + radios + '</fieldset>' +
        '<label class="fld"><span>Ваше имя</span><input name="name" type="text" autocomplete="name" value="' + esc(form.name) + '"><em class="err" data-err="name"></em></label>' +
        '<label class="fld"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 ___ ___ __ __" value="' + esc(form.phone) + '"><em class="err" data-err="phone"></em></label>' +
        '<label class="fld fld-addr"' + (m.адрес ? '' : ' hidden') + '><span>Адрес доставки (город, улица, дом, квартира)</span><textarea name="address" rows="2" autocomplete="street-address">' + esc(form.address) + '</textarea><em class="err" data-err="address"></em></label>' +
        '<label class="fld"><span>Комментарий (необязательно)</span><textarea name="comment" rows="2">' + esc(form.comment) + '</textarea></label>' +
        '<div class="cart-total"><span>Итого</span><strong>' + esc(totalTxt) + '</strong></div>' +
        (t.unknown ? '<p class="cart-note">Цена части товаров уточняется, она не вошла в итог.</p>' : '') +
        '<p class="cart-note">Стоимость доставки и оплату уточним в WhatsApp.</p>' +
        (waNumber ? '' : '<p class="cart-warn" role="alert">Оформление пока недоступно: не указан номер WhatsApp. Позвоните нам или напишите позже.</p>') +
        '<button class="cart-send" type="submit"' + (waNumber ? '' : ' disabled') + '>Отправить заказ в WhatsApp</button>' +
        '<button class="cart-clear" type="button" data-clear>Очистить корзину</button>' +
      '</form>';
  }

  /* ---------- изменения корзины ---------- */
  function setQty(id, q) {
    q = Math.max(0, Math.min(99, q | 0));
    if (q) cart[id] = q; else delete cart[id];
    persist(); render();
  }
  function bump() {
    if (btn.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
    }
  }
  var toastT;
  function showToast(name) {
    toast.innerHTML = '<span>Добавлено: ' + esc(name) + '</span><button type="button" data-open-cart>Открыть корзину</button>';
    toast.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove('is-on'); }, 3200);
  }
  function add(id) {
    if (!byId[id]) return;
    cart[id] = Math.min(99, (cart[id] || 0) + 1);
    persist(); render(); bump(); showToast(byId[id].name);
  }

  /* ---------- открыть / закрыть ---------- */
  var lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    toast.classList.remove('is-on');
    wrap.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-open');
    setTimeout(function () { panel.focus(); }, 30);
  }
  function close() {
    wrap.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-open');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  btn.addEventListener('click', open);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && wrap.classList.contains('is-open')) close(); });
  /* страница под панелью не прокручивается */
  var backdrop = $('.cart-backdrop', wrap);
  ['wheel', 'touchmove'].forEach(function (t) { backdrop.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });

  /* ---------- события ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var buy = t.closest && t.closest('.buy');
    if (buy) { add(buy.getAttribute('data-id')); return; }
    if (t.closest && t.closest('[data-open-cart]')) { open(); return; }
    if (t.closest && t.closest('[data-close]') && wrap.contains(t)) { close(); return; }
  });
  body.addEventListener('click', function (e) {
    var t = e.target, row = t.closest && t.closest('.ci');
    if (row) {
      var id = row.getAttribute('data-id');
      if (t.closest('[data-inc]')) setQty(id, cart[id] + 1);
      else if (t.closest('[data-dec]')) setQty(id, cart[id] - 1);
      else if (t.closest('[data-del]')) setQty(id, 0);
      return;
    }
    if (t.closest('[data-clear]')) { cart = {}; persist(); render(); return; }
    if (t.closest('[data-go-products]')) {
      close();
      var el = document.getElementById('products');
      if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200);
    }
  });
  /* поля формы запоминаем; смена способа получения показывает или прячет адрес */
  body.addEventListener('input', function (e) {
    var f = e.target.name;
    if (f && f in form && f !== 'method') { form[f] = e.target.value; persist(); var er = $('[data-err="' + f + '"]', body); if (er) er.textContent = ''; }
  });
  body.addEventListener('change', function (e) {
    if (e.target.name === 'method') {
      form.method = +e.target.value; persist();
      var addr = $('.fld-addr', body); if (addr) addr.hidden = !methods[form.method].адрес;
    }
  });

  /* ---------- отправка в WhatsApp ---------- */
  function validate() {
    var m = methods[form.method], errs = {};
    if (!form.name.trim()) errs.name = 'Напишите, как к вам обращаться';
    var digits = form.phone.replace(/\D/g, '');
    if (digits.length < 10) errs.phone = 'Укажите телефон: не меньше 10 цифр';
    if (m.адрес && !form.address.trim()) errs.address = 'Укажите адрес доставки';
    return errs;
  }
  function message() {
    var lines = ['Здравствуйте! Хочу оформить заказ на сайте:', ''];
    Object.keys(cart).forEach(function (id, i) {
      var p = byId[id], q = cart[id];
      var unit = p.unit ? ', ' + p.unit.replace(/^за\s+/i, '') : '';
      var title = /м[её]д/i.test(p.name) ? p.name : p.name + ' мёд';
      var line = (i + 1) + '. ' + title + unit + ' × ' + q;
      if (isNum(p.price)) line += ' = ' + data.money(p.price * q).replace(/ /g, ' ');
      else line += ' (цена по запросу)';
      lines.push(line);
    });
    var t = total();
    lines.push('');
    lines.push('Итого: ' + (t.sum ? data.money(t.sum).replace(/ /g, ' ') : 'уточнить') + (t.unknown ? ' + позиции с ценой по запросу' : ''));
    lines.push('');
    var m = methods[form.method];
    lines.push('Получение: ' + m.название);
    if (m.адрес) lines.push('Адрес: ' + form.address.trim());
    lines.push('Имя: ' + form.name.trim());
    lines.push('Телефон: ' + form.phone.trim());
    if (form.comment.trim()) lines.push('Комментарий: ' + form.comment.trim());
    lines.push('');
    lines.push('Подтвердите, пожалуйста, наличие, стоимость доставки и реквизиты для оплаты.');
    return lines.join('\n');
  }
  body.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!waNumber || !count()) return;
    var errs = validate();
    $$('.err', body).forEach(function (el) { el.textContent = errs[el.getAttribute('data-err')] || ''; });
    var first = Object.keys(errs)[0];
    if (first) { var inp = $('[name="' + first + '"]', body); if (inp) inp.focus(); return; }
    var url = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(message());
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  });

  /* Для проверки и других скриптов */
  window.HoneyCart = { add: add, open: open, close: close, message: message, count: count };
  render();
})();

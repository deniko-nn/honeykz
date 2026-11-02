/* Строит карточки мёда из data/honey.js: разметку, цвета, картинки-заглушки и список банок для 3D-сцены. */
(function () {
  'use strict';
  var NB = ' ';
  var settings = window.HONEY_SETTINGS || {};
  var source = (window.HONEY_PRODUCTS || []).filter(function (p) { return p && p.показывать !== false; });
  var currency = settings.валюта || '₸';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- цвета ---------- */
  function hexToRgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16);
    return isNaN(n) || h.length !== 6 ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    var a = s * Math.min(l, 1 - l);
    function f(n) {
      var k = (n + h / 30) % 12, c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return ('0' + Math.round(255 * c).toString(16)).slice(-2);
    }
    return '#' + f(0) + f(8) + f(4);
  }
  /* Из цвета мёда получаем светлый фон, чуть темнее фон и тёмный акцент так, чтобы текст читался. */
  function palette(tone) {
    var rgb = hexToRgb(tone) || [240, 185, 63], hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var h = hsl[0];
    return { bg: hslToHex(h, 0.9, 0.91), bg2: hslToHex(h, 0.82, 0.78), accent: hslToHex(h, 0.85, 0.24) };
  }

  /* ---------- картинки-заглушки (пока нет фото) ---------- */
  var SHADE = '<linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2a1400" stop-opacity=".3"/></linearGradient>';
  function svgUri(body, defs) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 720" preserveAspectRatio="xMidYMid slice"><defs>' + SHADE + (defs || '') + '</defs>' + body + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  function jarArt(x, base, w, tone, lid, label) {
    var s = w / 120, y = base - 160 * s, ink = (label && label.ink) || '#383838', bg = (label && label.bg) || '#fffefa';
    var body = 'M37 26V32C37 38 19 39 19 53V132C19 143 25 150 36 150H84C95 150 101 143 101 132V53C101 39 83 38 83 32V26Z';
    var lab;
    if (label && label.title) {
      var fs = Math.max(4.6, Math.min(9.6, 46 / (label.title.length * 0.6)));
      lab = '<path d="M60 83l4 2.3v4.6L60 92.2l-4-2.3v-4.6z" fill="none" stroke="' + ink + '" stroke-width=".9"/>' +
        '<text x="60" y="106" text-anchor="middle" font-family="\'Cormorant Garamond\', Georgia, \'Times New Roman\', serif" font-weight="400" font-size="' + fs.toFixed(1) + '" fill="' + ink + '">' + esc(label.title) + '</text>' +
        (label.sub ? '<text x="60" y="115" text-anchor="middle" font-family="Arial, sans-serif" font-size="3.6" letter-spacing=".5" fill="' + ink + '" opacity=".7">' + esc(String(label.sub).toUpperCase()) + '</text>' : '');
    } else {
      lab = '<path d="M60 85l6 3.5v7L60 99l-6-3.5v-7z" fill="none" stroke="' + ink + '" stroke-width="1.2"/>' +
        '<line x1="42" y1="107" x2="78" y2="107" stroke="' + ink + '" stroke-width="1.4"/><line x1="48" y1="113" x2="72" y2="113" stroke="' + ink + '" stroke-width=".9" opacity=".7"/>';
    }
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<ellipse cx="60" cy="154" rx="46" ry="4" fill="#000" opacity=".16"/>' +
      '<rect x="33" y="6" width="54" height="20" rx="2.5" fill="' + (lid || '#f6eeda') + '"/><rect x="33" y="20" width="54" height="6" rx="1.5" fill="#000" opacity=".12"/>' +
      '<path d="' + body + '" fill="' + tone + '"/><path d="' + body + '" fill="url(#shade)"/>' +
      '<rect x="26" y="60" width="5" height="62" rx="2.5" fill="#fff" opacity=".32"/>' +
      '<rect x="31" y="78" width="58" height="42" rx="1" fill="' + bg + '"/>' + lab + '</g>';
  }
  function hexPts(cx, cy, r) {
    var o = [];
    for (var i = 0; i < 6; i++) { var a = Math.PI / 180 * (60 * i + 30); o.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
    return o.join(' ');
  }
  function combArt(tone, seed) {
    var out = '', r = 46, dx = r * Math.sqrt(3), dy = r * 1.5, row = 0, x, y = -r;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    while (y < 720 + r) {
      x = -r + (row % 2 ? dx / 2 : 0);
      while (x < 800 + r) {
        if (rnd() < 0.62) out += '<polygon points="' + hexPts(x, y, r - 2.5) + '" fill="' + tone + '" fill-opacity="' + (0.3 + rnd() * 0.7).toFixed(2) + '"/>';
        else out += '<polygon points="' + hexPts(x, y, r - 2.5) + '" fill="none" stroke="' + tone + '" stroke-opacity=".35"/>';
        x += dx;
      }
      y += dy; row++;
    }
    return out;
  }
  function dipperArt(x, y, ang, L) {
    var ribs = '';
    for (var i = 0; i < 7; i++) ribs += '<ellipse cx="' + (L - 70 + i * 9) + '" cy="0" rx="4.5" ry="' + (14 + 10 * Math.sin(Math.PI * i / 6)).toFixed(1) + '" fill="#b98440" stroke="#6b4420" stroke-width="1"/>';
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + ang + ')"><rect x="0" y="-5" width="' + (L - 70) + '" height="10" rx="5" fill="#8a5a2b"/>' + ribs + '</g>';
  }
  /* Нижняя часть большой этикетки (кадр 4): название и подпись или две линии. */
  function bigLabel(label, pal) {
    var ink = (label && label.ink) || '#2a2218';
    if (!(label && label.title)) return '<line x1="270" y1="470" x2="530" y2="470" stroke="' + ink + '" stroke-width="4"/><line x1="310" y1="510" x2="490" y2="510" stroke="' + ink + '" stroke-width="2.4" opacity=".7"/>';
    var fs = Math.max(30, Math.min(110, 370 / (label.title.length * 0.6)));
    return '<text x="400" y="' + (470 + fs * 0.1).toFixed(0) + '" text-anchor="middle" font-family="\'Cormorant Garamond\', Georgia, serif" font-weight="400" font-size="' + fs.toFixed(0) + '" fill="' + ink + '">' + esc(label.title) + '</text>' +
      (label.sub ? '<text x="400" y="540" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" letter-spacing="6" fill="' + ink + '" opacity=".7">' + esc(String(label.sub).toUpperCase()) + '</text>' : '');
  }
  function placeholders(tone, pal, lid, seed, label) {
    var bgDef = '<linearGradient id="bg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + pal.bg + '"/><stop offset="1" stop-color="' + pal.bg2 + '"/></linearGradient>';
    return [
      svgUri('<rect width="800" height="720" fill="url(#bg)"/><circle cx="400" cy="300" r="230" fill="#fff" opacity=".25"/><rect y="560" width="800" height="160" fill="#000" opacity=".07"/>' + jarArt(255, 590, 290, tone, lid, label), bgDef),
      svgUri('<rect width="800" height="720" fill="' + pal.bg2 + '"/>' + combArt(tone, seed) + '<circle cx="400" cy="360" r="150" fill="' + pal.bg + '" opacity=".9"/>' + jarArt(330, 440, 140, tone, lid, label)),
      svgUri('<rect width="800" height="720" fill="url(#bg)"/><rect y="500" width="800" height="220" fill="#7a5530" opacity=".25"/>' + jarArt(150, 560, 250, tone, lid, label) + jarArt(430, 560, 170, tone, '#3a2a1a', label) + dipperArt(330, 610, -14, 420), bgDef),
      svgUri('<rect width="800" height="720" fill="' + tone + '"/><rect x="170" y="110" width="460" height="500" fill="#fffefa"/><rect x="190" y="130" width="420" height="460" fill="none" stroke="' + pal.accent + '" stroke-width="2"/><polygon points="' + hexPts(400, 300, 90) + '" fill="none" stroke="' + pal.accent + '" stroke-width="4"/><polygon points="' + hexPts(400, 300, 60) + '" fill="' + tone + '" opacity=".9"/>' + bigLabel(label, pal))
    ];
  }

  /* ---------- нормализация данных ---------- */
  var used = {};
  var products = source.map(function (p, i) {
    if (!p.название) console.warn('[мёд] у записи №' + (i + 1) + ' не указано «название»: оно нужно, чтобы показать карточку.');
    if (!hexToRgb(p.цвет)) console.warn('[мёд] у «' + (p.название || '№' + (i + 1)) + '» не указан «цвет» (например, \'#f0b93f\'): взят цвет по умолчанию.');
    var tone = hexToRgb(p.цвет) ? p.цвет : '#f0b93f';
    var auto = palette(tone);
    var pal = {
      accent: hexToRgb(p.цвет_акцента) ? p.цвет_акцента : auto.accent,
      bg: hexToRgb(p.цвет_фона) ? p.цвет_фона : auto.bg,
      bg2: hexToRgb(p.цвет_фона_2) ? p.цвет_фона_2 : auto.bg2
    };
    var id = 'honey-' + (i + 1);
    /* Надпись на банке: по умолчанию название мёда; пустая строка '' оставляет только эмблему. */
    var title = p.надпись_на_банке != null ? p.надпись_на_банке : p.название;
    var label = {
      title: title ? String(title) : '',
      sub: p.надпись_мелко != null ? String(p.надпись_мелко) : 'натуральный мёд',
      bg: hexToRgb(p.цвет_этикетки) ? p.цвет_этикетки : '#f6eeda',
      ink: hexToRgb(p.цвет_надписи) ? p.цвет_надписи : '#2a2218'
    };
    var images = (p.фото && p.фото.length) ? p.фото.slice(0, 4) : placeholders(tone, pal, p.крышка, 7 + i * 31, label);
    return {
      id: id, name: p.название || 'Без названия', chip: p.название_в_плашке || p.название || 'Мёд', second: p.второе_название,
      tagline: p.слоган, desc: p.описание, season: p.сезон, texture: p.консистенция,
      benefits: p.плюсы || [], storage: p.хранение, price: p.цена, oldPrice: p.старая_цена, unit: p.подпись_цены,
      tone: tone, tone3d: hexToRgb(p.цвет_3d) ? p.цвет_3d : tone, lid: hexToRgb(p.крышка) ? p.крышка : null,
      pal: pal, images: images, label: label
    };
  });

  function money(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return v.toLocaleString('ru-RU').replace(/[\s ]/g, NB) + NB + currency;
    return String(v).replace(/ /g, NB);
  }

  /* ---------- разметка ---------- */
  function panel(p) {
    var thumbs = p.images.length > 1 ? p.images.map(function (src, k) {
      return '<button class="thumb' + (k ? '' : ' is-on') + '" type="button" data-src="' + esc(src) + '" aria-label="Кадр ' + (k + 1) + '"><img src="' + esc(src) + '" alt=""><span class="thumb-dim"></span></button>';
    }).join('') : '';
    var specs = '';
    if (p.season) specs += '<p><b>Сезон сбора:</b> ' + esc(p.season) + '</p>';
    if (p.texture) specs += '<p><b>Консистенция:</b> ' + esc(p.texture) + '</p>';
    var benefits = p.benefits.length ? '<div class="benefits"><p class="h-sm">Чем хорош</p><ul>' + p.benefits.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>' : '';
    var price = '';
    if (p.price != null && p.price !== '') {
      price = '<span class="price">' + (p.oldPrice ? '<s>' + esc(money(p.oldPrice)) + '</s> ' : '') + esc(money(p.price)) + (p.unit ? '<small> ' + esc(p.unit) + '</small>' : '') + '</span>';
    }
    return '<article class="product" data-id="' + p.id + '" style="--accent:' + p.pal.accent + ';--bg:' + p.pal.bg + ';--bg2:' + p.pal.bg2 + '">' +
      '<div class="product-inner"><div class="gallery"><div class="zoom"><img class="zoom-img" src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + ': фото"></div>' +
      (thumbs ? '<div class="thumbs">' + thumbs + '</div>' : '') + '</div>' +
      '<div class="info">' +
      (p.tagline ? '<span class="tagline">' + esc(p.tagline) + '</span>' : '') +
      (p.second ? '<p class="kz">' + esc(p.second) + '</p>' : '') +
      '<h2 class="name">' + esc(p.name) + '</h2>' +
      (p.desc ? '<p class="desc">' + esc(p.desc) + '</p>' : '') +
      '<div class="details">' + (specs ? '<div class="specs">' + specs + '</div>' : '') + benefits +
      (p.storage ? '<p class="usage"><b>Хранение:</b> ' + esc(p.storage) + '</p>' : '') + '</div>' +
      '<div class="buy-row">' + price + '<button class="more" type="button" aria-expanded="false">Подробнее</button><button class="buy" type="button" data-name="' + esc(p.name) + '">Купить</button></div>' +
      '</div></div></article>';
  }

  var host = document.getElementById('products');
  if (host) host.innerHTML = products.map(panel).join('');

  /* Кнопка «Купить»: если указан номер WhatsApp, открываем чат с названием мёда. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.buy');
    if (!b) return;
    var num = String(settings.whatsapp || '').replace(/\D/g, '');
    if (!num) return;
    window.open('https://wa.me/' + num + '?text=' + encodeURIComponent('Здравствуйте! Хочу заказать мёд «' + b.getAttribute('data-name') + '».'), '_blank', 'noopener');
  });

  /* Данные для остальных скриптов: список банок для 3D и подписи для плашки. */
  var heroCount = Math.max(1, Math.min(4, settings.банок_на_главном_экране || 4));
  window.HoneyData = {
    products: products,
    heroJars: products.slice(0, heroCount).map(function (p) { return { key: p.id, tone: p.tone3d, lid: p.lid, label: p.label }; }),
    chipNames: products.reduce(function (m, p, i) { m[p.id] = { name: p.chip, index: i }; return m; }, {})
  };
})();

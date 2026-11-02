/* Общая 3D-банка: профиль вращения, крышка, этикетка, окружение и выборка точек с поверхности. */
/* hex-цвета трактуем как sRGB (иначе в этой версии three.js они выцветают) */
THREE.ColorManagement.legacyMode = false;

window.Jar3D = (function () {
  var R = 0.95; // радиус корпуса

  function profile() {
    var pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(R - 0.17, 0)];
    for (var i = 1; i <= 8; i++) {
      var a = (i / 8) * Math.PI / 2;
      pts.push(new THREE.Vector2(R - 0.17 + Math.sin(a) * 0.17, 0.17 - Math.cos(a) * 0.17));
    }
    pts.push(new THREE.Vector2(R, 1.65));
    var shoulder = new THREE.QuadraticBezierCurve(new THREE.Vector2(R, 1.65), new THREE.Vector2(R, 2.02), new THREE.Vector2(0.58, 2.1));
    shoulder.getPoints(14).slice(1).forEach(function (p) { pts.push(p); });
    pts.push(new THREE.Vector2(0.58, 2.28));
    return pts;
  }

  /* Рисуем этикетку на canvas. Если задан title, на ней название и подпись, иначе просто эмблема. */
  function hexPath(x, cx, cy, r) {
    x.beginPath();
    for (var i = 0; i < 6; i++) { var a = Math.PI / 180 * (60 * i + 30); x[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    x.closePath();
  }
  function drawLabel(c, o) {
    var x = c.getContext('2d'), W = c.width, H = c.height, ink = o.ink || '#2a2218';
    x.clearRect(0, 0, W, H);
    x.fillStyle = o.bg || '#f6eeda'; x.fillRect(0, 0, W, H);
    x.strokeStyle = ink; x.globalAlpha = 0.5; x.lineWidth = 1.5; x.strokeRect(10, 10, W - 20, H - 20);
    x.globalAlpha = 1; x.lineWidth = 3;
    if (o.title) {
      hexPath(x, W / 2, 40, 14, ink); x.lineWidth = 2.5; x.stroke();
      var fs = 66;
      x.font = '600 ' + fs + 'px "Cormorant Garamond", Georgia, serif';
      while (x.measureText(o.title).width > W - 96 && fs > 24) { fs -= 2; x.font = '600 ' + fs + 'px "Cormorant Garamond", Georgia, serif'; }
      x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      x.fillText(o.title, W / 2, 112);
      if (o.sub) {
        x.globalAlpha = 0.7; x.font = '500 15px "Iosevka Charon Mono", monospace';
        if ('letterSpacing' in x) x.letterSpacing = '3px';
        x.fillText(String(o.sub).toUpperCase(), W / 2, 152);
        if ('letterSpacing' in x) x.letterSpacing = '0px';
        x.globalAlpha = 1;
      }
    } else {
      hexPath(x, W / 2, 66, 30, ink); x.stroke();
      x.lineWidth = 4; x.beginPath(); x.moveTo(190, 124); x.lineTo(322, 124); x.stroke();
      x.lineWidth = 2; x.globalAlpha = 0.7; x.beginPath(); x.moveTo(218, 146); x.lineTo(294, 146); x.stroke();
      x.globalAlpha = 1;
    }
  }
  function labelTexture(o) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 180;
    drawLabel(c, o);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    t.userData = { redraw: function () { drawLabel(c, o); t.needsUpdate = true; } };
    return t;
  }
  /* Шрифты подгружаются не сразу: после загрузки перерисовываем этикетки. */
  function fontsReady(fn) {
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('600 40px "Cormorant Garamond"'), document.fonts.load('500 15px "Iosevka Charon Mono"')]).then(fn, fn);
    } else fn();
  }

  /** o: { tone, lid, label: { title, sub, bg, ink } } */
  function create(o) {
    var g = new THREE.Group();
    var tone = new THREE.Color(o.tone);
    var body = new THREE.Mesh(
      new THREE.LatheGeometry(profile(), 72),
      new THREE.MeshPhysicalMaterial({
        color: tone, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12,
        emissive: tone.clone().multiplyScalar(0.1), envMapIntensity: 0.45, side: THREE.DoubleSide
      })
    );
    body.castShadow = true;

    var lidMat = new THREE.MeshStandardMaterial({ color: o.lid || 0xd9b45e, metalness: o.lid ? 0.2 : 1, roughness: o.lid ? 0.6 : 0.3, envMapIntensity: o.lid ? 0.3 : 0.8 });
    var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 56), lidMat);
    lid.position.y = 2.46; lid.castShadow = true;
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.026, 10, 64), lidMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = 2.26;

    var labelTex = labelTexture(o.label || {});
    var label = new THREE.Mesh(
      new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.9, 72, 1, true, -Math.PI * 0.4, Math.PI * 0.8),
      new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.75, side: THREE.DoubleSide })
    );
    label.position.y = 1.0;

    g.add(body, lid, rim, label);
    g.userData.height = 2.67;
    g.userData.redrawLabel = labelTex.userData.redraw;
    return g;
  }

  /** Равномерная по площади выборка n точек с поверхности (в локальных координатах группы). */
  function sample(group, n) {
    var meshes = [];
    group.traverse(function (m) { if (m.isMesh) meshes.push(m); });
    var tri = [], total = 0, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
    meshes.forEach(function (m) {
      m.updateMatrix();
      var pos = m.geometry.attributes.position, idx = m.geometry.index;
      var cnt = idx ? idx.count / 3 : pos.count / 3;
      for (var i = 0; i < cnt; i++) {
        var i0 = idx ? idx.getX(3 * i) : 3 * i, i1 = idx ? idx.getX(3 * i + 1) : 3 * i + 1, i2 = idx ? idx.getX(3 * i + 2) : 3 * i + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrix);
        b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrix);
        c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrix);
        ab.subVectors(b, a); ac.subVectors(c, a);
        var area = ab.cross(ac).length() * 0.5;
        if (area > 0) { total += area; tri.push([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, total]); }
      }
    });
    var out = new Float32Array(n * 3);
    for (var k = 0; k < n; k++) {
      var r = Math.random() * total, lo = 0, hi = tri.length - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (tri[mid][9] < r) lo = mid + 1; else hi = mid; }
      var t = tri[lo], u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      var w = 1 - u - v;
      out[3 * k] = t[0] * w + t[3] * u + t[6] * v;
      out[3 * k + 1] = t[1] * w + t[4] * u + t[7] * v;
      out[3 * k + 2] = t[2] * w + t[5] * u + t[8] * v;
    }
    return out;
  }

  /** Тёплое студийное окружение для отражений (без внешних HDR-файлов). */
  function makeEnv(renderer) {
    var pm = new THREE.PMREMGenerator(renderer);
    var s = new THREE.Scene();
    var room = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#3a2a18').multiplyScalar(0.25), side: THREE.BackSide }));
    room.position.y = 5; s.add(room);
    function panel(w, h, p, i, col) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(i), side: THREE.DoubleSide }));
      m.position.set(p[0], p[1], p[2]); m.lookAt(0, 1, 0); s.add(m);
    }
    panel(9, 4, [-6, 7, 5], 7, '#ffe8c8');
    panel(4, 9, [9, 3, 3], 3.5, '#ffc890');
    panel(12, 2.5, [0, 8, -6], 5, '#fff4e0');
    var tex = pm.fromScene(s, 0.04).texture;
    pm.dispose();
    return tex;
  }

  return { create: create, sample: sample, makeEnv: makeEnv, fontsReady: fontsReady };
})();

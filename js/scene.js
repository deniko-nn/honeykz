/* Главный экран: тёмная 3D-сцена. Камера следует за курсором, под курсором пятно света,
   клик по банке выдвигает её вперёд, перетаскивание вращает выбранную банку. */
window.HeroScene = function (canvas, opts) {
  opts = opts || {};
  var mobile = !!opts.mobile, reduce = !!opts.reduce;
  var BG = 0x120c07;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.045);
  scene.environment = Jar3D.makeEnv(renderer);

  /* Кадрирование зависит от формы окна: широкий экран держит банки справа от заголовка,
     портрет (телефон) ставит их по центру в верхней части. */
  var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  var baseX = -2.0, baseY = 2.1, lookAt = new THREE.Vector3(baseX, 1.0, 0), spread = 1, portrait = null;

  /* ---------- пол ---------- */
  var floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x1d130b, roughness: 0.5, metalness: 0.1, envMapIntensity: 0.18 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  /* ---------- банки ---------- */
  /* Банки берутся из списка мёда (data/honey.js); запасной вариант — три банки по умолчанию. */
  var list = (opts.jars && opts.jars.length) ? opts.jars : [
    { key: 'a', tone: '#e8a21e' }, { key: 'b', tone: '#b8680f', lid: '#3a2a1a' }, { key: 'c', tone: '#eec25a' }
  ];
  var count = list.length, mid = (count - 1) / 2, gap = count <= 3 ? 3.2 : 2.3;
  var defs = list.map(function (j, i) {
    var t = count === 1 ? 1 : count === 2 ? 0.6 : 1 - Math.abs(i - mid) / mid;
    return { key: j.key, tone: j.tone, lid: j.lid, x: (i - mid) * gap, z: 0.4 - 1.1 * t, s: count === 1 ? 1.5 : 1.0 + 0.5 * t, ry: (mid - i) * 0.25 };
  });
  var jars = {}, pickables = [];
  defs.forEach(function (d) {
    var g = Jar3D.create({ tone: d.tone, lid: d.lid });
    g.scale.setScalar(d.s);
    g.position.set(d.x * spread, 0, d.z);
    g.rotation.y = d.ry;
    g.traverse(function (m) { if (m.isMesh) { m.userData.key = d.key; pickables.push(m); } });
    scene.add(g);
    jars[d.key] = { group: g, x0: d.x, z0: d.z, ry0: d.ry, rotTarget: d.ry, hover: 0 };
  });

  function framing() {
    var asp = window.innerWidth / window.innerHeight, p = asp < 0.9;
    if (p === portrait) return;
    var first = portrait === null;
    portrait = p;
    camera.fov = p ? 48 : 36;
    baseX = p ? -0.1 : (count > 3 ? -3.4 : -2.7); baseY = p ? 2.4 : 2.1;
    camera.position.z = p ? 16.5 : (count > 3 ? 16.5 : 14);
    lookAt.set(baseX, p ? 0.1 : 1.0, 0);
    spread = p ? 0.56 : 1;
    Object.keys(jars).forEach(function (k) { jars[k].group.position.x = jars[k].x0 * spread; });
    if (first) { camera.position.x = baseX; camera.position.y = baseY; }
    camera.updateProjectionMatrix();
  }

  /* ---------- соты и ложка ---------- */
  function addComb(cx, cz, rings, rot, seedOffset) {
    var g = new THREE.Group(), size = 0.42;
    var geo = new THREE.CylinderGeometry(size - 0.02, size - 0.02, 1, 6);
    var mat = new THREE.MeshStandardMaterial({ color: 0xc8801c, roughness: 0.35, emissive: 0x5a2a00, emissiveIntensity: 0.45, envMapIntensity: 0.5 });
    var n = 0;
    for (var q = -rings; q <= rings; q++) {
      for (var r = -rings; r <= rings; r++) {
        if (Math.abs(-q - r) > rings) continue;
        var h = 0.1 + ((Math.sin((q * 7 + r * 13 + seedOffset) * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.2;
        var m = new THREE.Mesh(geo, mat);
        m.scale.y = h;
        m.position.set(size * Math.sqrt(3) * (q + r / 2), h / 2, size * 1.5 * r);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m); n++;
      }
    }
    g.position.set(cx * spread, 0, cz); g.rotation.y = rot;
    scene.add(g);
  }
  addComb(-1.9, 2.6, 1, 0.3, 1);
  addComb(5.2, -2.2, 2, 0.9, 7);
  addComb(-6.2, -1.6, 1, 0.1, 3);

  (function addDipper() {
    var g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 });
    var handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.7, 14), wood);
    handle.rotation.z = Math.PI / 2; handle.position.x = 1.4; handle.castShadow = true; g.add(handle);
    for (var k = 0; k < 7; k++) {
      var rad = 0.2 + 0.18 * Math.sin(Math.PI * k / 6);
      var rib = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.05, 28), new THREE.MeshStandardMaterial({ color: 0xb98440, roughness: 0.6 }));
      rib.rotation.z = Math.PI / 2; rib.position.x = -k * 0.1; rib.castShadow = true; g.add(rib);
    }
    g.position.set(1.6 * spread, 0.2, 2.6); g.rotation.y = -0.6; g.rotation.z = 0.05;
    scene.add(g);
  })();

  /* ---------- пыль в луче света ---------- */
  var dustN = mobile ? 70 : 150, dustPos = new Float32Array(dustN * 3);
  for (var i = 0; i < dustN; i++) { dustPos[3 * i] = (Math.random() - 0.5) * 12; dustPos[3 * i + 1] = Math.random() * 4.5; dustPos[3 * i + 2] = (Math.random() - 0.5) * 8; }
  var dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.03, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  /* ---------- свет ---------- */
  scene.add(new THREE.AmbientLight(0xffe9cc, 0.06));
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x1a0f05, 0.16));
  var key = new THREE.DirectionalLight(0xffe0b0, 1.05);
  key.position.set(-5, 8, 6); key.castShadow = !mobile;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -9; key.shadow.camera.right = 9; key.shadow.camera.top = 9; key.shadow.camera.bottom = -9;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30; key.shadow.bias = -0.0004;
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xffb870, 0.9); rim.position.set(6, 4, -6); scene.add(rim);

  var spot = new THREE.SpotLight(0xffd29a, 2.4, 0, Math.PI / 6, 0.6, 1);
  spot.position.set(0, 6, 10); scene.add(spot, spot.target);

  /* ---------- пятно света под курсором ---------- */
  function discTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var disc = discTexture(), pool = new THREE.Group(); scene.add(pool);
  function ring(size, opacity, scale) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
      map: disc, color: 0xffd9a8, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    m.rotation.x = -Math.PI / 2; m.scale.setScalar(scale); pool.add(m); return m;
  }
  var p1 = ring(2.5, 0.55, 1), p2 = ring(5, 0.22, 1.2), p3 = ring(9, 0.08, 1.5);

  /* ---------- взаимодействие ---------- */
  var mouse = { x: 0, y: 0 }, ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
  var target = new THREE.Vector3(0, 0.02, 1), smooth = new THREE.Vector3(0, 0.02, 1);
  var selected = null, hovered = null, onSelect = function () {};
  var drag = null, active = true, running = false, raf = 0;

  function overUI(e) { return e.target && e.target.closest && e.target.closest('.site-header, .hero-chip, a, button, input, textarea'); }
  function pointer(e) {
    mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = e.clientY / window.innerHeight - 0.5;
    ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    if (drag) { jars[drag.key].rotTarget += (e.clientX - drag.x) * 0.012; drag.x = e.clientX; }
  }
  function pick() {
    var hit = ray.intersectObjects(pickables, false);
    return hit.length ? hit[0].object.userData.key : null;
  }
  function choose(k) {
    if (selected && selected !== k) {
      gsap.to(jars[selected].group.position, { z: jars[selected].z0, duration: 0.8, ease: 'power2.out' });
      jars[selected].rotTarget = jars[selected].ry0;
    }
    if (k && k !== selected) {
      gsap.to(jars[k].group.position, { z: jars[k].z0 + (mobile ? 2.2 : 3.2), duration: 1, ease: 'power3.out' });
      jars[k].rotTarget = 0;
      selected = k;
    } else if (k === selected) {
      gsap.to(jars[k].group.position, { z: jars[k].z0, duration: 0.8, ease: 'power2.out' });
      jars[k].rotTarget = jars[k].ry0; selected = null;
    } else { selected = null; }
    onSelect(selected);
  }
  window.addEventListener('pointermove', pointer);
  var down = null;
  window.addEventListener('pointerdown', function (e) {
    if (!active || overUI(e)) return;
    pointer(e); ray.setFromCamera(ndc, camera);
    var k = pick(), touch = e.pointerType === 'touch';
    down = { x: e.clientX, y: e.clientY, t: e.timeStamp, touch: touch };
    if (k && k === selected && !touch) drag = { key: k, x: e.clientX };
  });
  window.addEventListener('pointerup', function (e) {
    var d = down; down = null; drag = null;
    if (!d || !active) return;
    var moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 10 || e.timeStamp - d.t > 500) return;
    pointer(e); ray.setFromCamera(ndc, camera);
    var k = pick();
    if (k) choose(k);
    else if (d.touch && selected) choose(selected);
  });
  window.addEventListener('pointercancel', function () { down = null; drag = null; });

  /* ---------- цикл ---------- */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    framing();
  }
  window.addEventListener('resize', resize); resize();

  function frame(t) {
    raf = requestAnimationFrame(frame);
    camera.position.x += (baseX + mouse.x * 4 - camera.position.x) * 0.03;
    camera.position.y += (baseY - mouse.y * 2 - camera.position.y) * 0.03;
    camera.lookAt(lookAt);

    ray.setFromCamera(ndc, camera);
    hovered = pick();
    document.body.style.cursor = (active && hovered) ? (drag ? 'grabbing' : 'grab') : '';

    var fl = ray.intersectObject(floor, false);
    if (fl.length) target.copy(fl[0].point);
    smooth.lerp(target, 0.08);
    pool.position.set(smooth.x, 0.02, smooth.z);
    var pulse = reduce ? 1 : 1 + Math.sin(t * 0.003) * 0.04;
    var d = 1 + smooth.distanceTo(target) * 0.08;
    p1.scale.setScalar(d * pulse); p2.scale.setScalar(d * 1.4 * pulse); p3.scale.setScalar(d * 2.2 * pulse);

    spot.position.x += (mouse.x * 10 - spot.position.x) * 0.06;
    spot.position.y += (6 - mouse.y * 4 - spot.position.y) * 0.06;
    spot.position.z += (10 - spot.position.z) * 0.06;
    spot.target.position.copy(smooth); spot.target.updateMatrixWorld();

    Object.keys(jars).forEach(function (k) {
      var j = jars[k];
      j.hover += ((hovered === k ? 1 : 0) - j.hover) * 0.12;
      j.group.rotation.y += (j.rotTarget - j.group.rotation.y) * 0.08;
      j.group.position.y = j.hover * 0.06;
    });

    if (!reduce) {
      var p = dustGeo.attributes.position.array;
      for (var i = 0; i < dustN; i++) { p[3 * i + 1] += 0.0025; if (p[3 * i + 1] > 4.5) p[3 * i + 1] = 0; }
      dustGeo.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); document.body.style.cursor = ''; }

  frame(0); cancelAnimationFrame(raf); // первый кадр сразу, пока идёт загрузка

  return {
    start: start, stop: stop,
    setActive: function (v) { active = v; },
    onSelect: function (cb) { onSelect = cb; },
    deselect: function () { if (selected) choose(selected); }
  };
};

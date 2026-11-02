/* Облако точек: банка из тысяч частиц, которые собираются в форму и медленно вращаются. */
window.HoneyCloud = function (container, opts) {
  opts = opts || {};
  var mobile = !!opts.mobile, reduce = !!opts.reduce;
  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  container.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(mobile ? 55 : 45, 1, 0.1, 100);
  camera.position.z = 8;

  var jar = Jar3D.create({ tone: opts.accent });
  var count = mobile ? 3500 : 12000;
  var orig = Jar3D.sample(jar, count);
  var scale = mobile ? 1.1 : 1.5, offY = -(jar.userData.height * scale) / 2;
  for (var i = 0; i < count; i++) { orig[3 * i] *= scale; orig[3 * i + 1] = orig[3 * i + 1] * scale + offY; orig[3 * i + 2] *= scale; }
  var pos = new Float32Array(orig);
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var dot = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'); x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
    return new THREE.CanvasTexture(c);
  })();
  var pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: opts.accent, size: 0.04, map: dot, alphaTest: 0.05, transparent: true, opacity: 0.45, depthWrite: false }));
  pts.rotation.y = 0.6;
  scene.add(pts);

  var running = false, raf = 0, last = 0;
  function resize() {
    var w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    pts.position.x = w > 900 ? 2.0 : 1.2;
  }
  window.addEventListener('resize', resize); resize();

  function scatter() {
    for (var i = 0; i < count; i++) {
      var r = 0.6 + Math.random() * 2.4, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[3 * i] = orig[3 * i] + r * Math.sin(ph) * Math.cos(th);
      pos[3 * i + 1] = orig[3 * i + 1] + r * Math.sin(ph) * Math.sin(th);
      pos[3 * i + 2] = orig[3 * i + 2] + r * Math.cos(ph);
    }
    geo.attributes.position.needsUpdate = true;
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.1, ((now || last) - last) / 1000 || 0.016); last = now || last;
    var k = reduce ? 1 : 1 - Math.pow(1 - 0.015, dt * 60);
    for (var i = 0; i < count * 3; i++) pos[i] += (orig[i] - pos[i]) * k;
    geo.attributes.position.needsUpdate = true;
    if (!reduce) pts.rotation.y += 0.0015 * dt * 60;
    renderer.render(scene, camera);
  }
  frame(); cancelAnimationFrame(raf);
  return {
    start: function () { if (!running) { running = true; last = performance.now(); resize(); raf = requestAnimationFrame(frame); } },
    stop: function () { running = false; cancelAnimationFrame(raf); },
    scatter: function () { if (!reduce) scatter(); }
  };
};

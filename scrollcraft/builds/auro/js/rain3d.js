// AURO · falling gold bars behind the page.
// A handful of real gold-bar frustums fall slowly through a dark room, smaller and darker with depth.
// They thin out in the quiet rules act and are gone before the close, so the bar that lands on the peak
// is the only gold moving at the page's one big moment.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const AU = (window.AURO = window.AURO || {});
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function start() {
  const canvas = document.createElement('canvas');
  canvas.className = 'au-rain';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100vw', height: '100vh',
    pointerEvents: 'none', zIndex: 'var(--au-3d-z, 0)', opacity: '0', transition: 'opacity 900ms cubic-bezier(0.23, 1, 0.32, 1)'
  });
  document.body.prepend(canvas);
  // Same stacking slot as the live mark; stay right before its canvas so the mark always renders above the rain.
  const keepBelowMark = () => {
    const mk = document.querySelector('canvas.au-3d');
    if (mk && mk.previousElementSibling !== canvas) mk.before(canvas);
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { canvas.remove(); return; }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Studio reflections: a black room with a few softbox strips, the same recipe as the live mark.
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020202);
  const box = (w, h, x, y, z, i, col = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0] * i, col[1] * i, col[2] * i), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  box(14, 3, 0, 9, 2, 2.2, [1, 0.9, 0.72]); box(1.4, 16, -8, 1, 5, 7); box(1, 16, 8, 0, 3, 4, [1, 0.92, 0.8]);
  box(10, 1.2, 0, -7, 6, 1.4, [1, 0.85, 0.6]); box(1.6, 22, -2.6, 0, 12, 3, [1, 0.94, 0.82]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.environment = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  scene.fog = new THREE.Fog(0x07070a, 12, 34); // far bars sink into the page's own black

  // A real gold bar: a frustum, narrower and shallower on top, with flat facets so every face catches its own light.
  const geo = new THREE.BoxGeometry(2.4, 0.62, 1.15, 1, 1, 1).toNonIndexed();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) { pos.setX(i, pos.getX(i) * 0.8); pos.setZ(i, pos.getZ(i) * 0.72); }
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setRGB(1.0, 0.65, 0.21, THREE.LinearSRGBColorSpace),
    metalness: 1, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.15, transparent: true, opacity: 1
  });

  const small = matchMedia('(max-width: 759px)').matches;
  const COUNT = small ? 7 : 13;
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  camera.position.set(0, 0, 10);

  // Deterministic layout, so every visitor sees the same composition.
  let seed = 79;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const halfH = z => Math.tan(THREE.MathUtils.degToRad(15)) * (10 - z);
  const bars = Array.from({ length: COUNT }, (_, i) => {
    const z = -3 - rnd() * 13;                       // depth: -3 (near) .. -16 (far)
    const s = (0.26 + rnd() * 0.2) * (small ? 0.68 : 1); // scale; smaller on phones
    return {
      z, s,
      lane: (i + 0.5) / COUNT * 2 - 1 + (rnd() - 0.5) * 0.12,  // spread across the width, a little jitter
      y: (rnd() * 2 - 1),                              // -1..1 of the visible height
      speed: 0.028 + rnd() * 0.026,                    // fraction of the visible height per second (12 to 20 s a fall)
      sway: rnd() * Math.PI * 2,
      rx: 0.35 + rnd() * 0.6, ry: rnd() * Math.PI * 2, rz: (rnd() - 0.5) * 0.5,
      vrx: (rnd() - 0.5) * 0.16, vry: (rnd() < 0.5 ? -1 : 1) * (0.12 + rnd() * 0.22)
    };
  });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  let w = 0, h = 0;
  function resize() {
    w = innerWidth; h = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  // How much rain the page wants right now: full through the argument, thinner in the quiet act,
  // gone before the bar starts its crossing at the close.
  function intensity() {
    const max = document.documentElement.scrollHeight - innerHeight || 1;
    const prog = scrollY / max;
    const close = typeof AU.close === 'number' ? AU.close : 0;
    const quiet = document.querySelector('.act4');
    let q4 = 0;
    if (quiet) {
      const r = quiet.getBoundingClientRect();
      q4 = Math.max(0, Math.min(1, 1 - Math.abs((r.top + r.height / 2) - h / 2) / (h * 0.9)));
    }
    const fadeClose = 1 - Math.min(1, close / 0.18);
    const tail = prog > 0.985 ? 0 : 1;
    return Math.max(0, Math.min(1, (1 - 0.55 * q4) * fadeClose * tail));
  }

  let last = performance.now(), lastScroll = scrollY, level = 0, running = true, order = 0;
  function frame(now) {
    if (!running) return;
    if (now - order > 1000) { order = now; keepBelowMark(); }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const dScroll = scrollY - lastScroll; lastScroll = scrollY;
    const target = intensity();
    level += (target - level) * Math.min(1, dt * 2.4);
    mat.opacity = level;
    canvas.style.opacity = level > 0.01 ? '1' : '0';
    if (level > 0.01) {
      const rush = Math.min(2.5, Math.abs(AU.velocity || 0) * 0.03); // a fast scroll stirs them a little
      for (let i = 0; i < COUNT; i++) {
        const b = bars[i];
        const H = halfH(b.z), W = H * camera.aspect;
        b.y -= dt * b.speed * (1 + rush) * 2;
        b.y += (dScroll / h) * 0.18 * (1 - (b.z + 16) / 13 * 0.5); // parallax: nearer bars ride the scroll more
        if (b.y < -1.25) { b.y += 2.5; b.lane = Math.max(-0.95, Math.min(0.95, -b.lane + (rnd() - 0.5) * 0.3)); }
        if (b.y > 1.25) b.y -= 2.5;
        b.rx += dt * b.vrx * (1 + rush * 0.6); b.ry += dt * b.vry * (1 + rush * 0.6);
        const x = b.lane * W * 0.92 + Math.sin(now / 2600 + b.sway) * 0.18;
        p3.set(x, b.y * H, b.z);
        e.set(b.rx, b.ry, b.rz); q.setFromEuler(e);
        s3.setScalar(b.s);
        m4.compose(p3, q, s3);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }

  if (reduced) {
    // Motion off: one still frame, only the bars near the edges and dimmer, so nothing sits on the copy.
    level = 1; mat.opacity = 0.55; canvas.style.opacity = '1';
    for (let i = 0; i < COUNT; i++) {
      const b = bars[i], H = halfH(b.z), W = H * camera.aspect;
      const edge = Math.abs(b.lane) > 0.72;
      p3.set(b.lane * W * 0.96, b.y * H, b.z); e.set(b.rx, b.ry, b.rz); q.setFromEuler(e); s3.setScalar(edge ? b.s : 0);
      m4.compose(p3, q, s3); mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    return;
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

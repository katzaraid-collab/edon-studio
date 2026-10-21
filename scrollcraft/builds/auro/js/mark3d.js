// AURO live mark: the Ingot A in gold, two pieces (bar + base) that follow the page's anchors.
// Act 1: the bar floats alone, the base stands. Act 5: the bar crosses the level line and locks onto the base.
// Reads window.AURO (written by page.js) and [data-anchor] boxes. Adds html.au-3d-ready after the first frame,
// html.no-webgl (and AURO.webgl = false) if WebGL cannot start. Under reduced motion it never starts.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const AU = (window.AURO = window.AURO || { split: 0.5, mobile: false, hero: 0, close: 0, velocity: 0, pointer: { x: 0, y: 0 }, reduced: false, webgl: true });
const root = document.documentElement;

// Geometry: the mark in SVG units (y down), from assets/mark.json.
const M = {
  B: 200, H: 170, C: 64.94, GAP: 10,
  bar: [[78, 0], [122, 0], [151.796, 64.94], [48.204, 64.94]],
  base: [[43.616, 74.94], [156.384, 74.94], [200, 170], [130, 170], [100, 86.84], [70, 170], [0, 170]],
};
const K = 2.2 / M.H;                  // world units per SVG unit at group scale 1 (same as the offline renders)
const DEPTH = 0.42, BT = 0.07, BS = 0.05;
const BAR_CY = (M.H / 2 - M.C / 2) * K;                     // bar centre, mark-centred coords (y up)
const BASE_CY = (M.H / 2 - (M.C + M.GAP + M.H) / 2) * K;    // base centre
const GAP_Y = (M.H / 2 - (M.C + M.GAP / 2)) * K;            // middle of the level gap
const BAR_W = 103.6, BAR_H = M.C, BASE_W = M.B, BASE_H = M.H - M.C - M.GAP;
const HERO_RX = -0.24, HERO_RY = 0.32;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function start() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || AU.reduced) return;

  let renderer;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true }) || canvas.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) throw new Error('no webgl');
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    fail();
    return;
  }

  const canvas = renderer.domElement;
  canvas.className = 'au-3d';
  canvas.setAttribute('aria-hidden', 'true');
  const style = document.createElement('style');
  style.textContent = '.au-3d{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:var(--au-3d-z,0);opacity:0;transition:opacity .4s cubic-bezier(.23,1,.32,1)}.au-3d-ready .au-3d{opacity:1}';
  document.head.appendChild(style);
  // First child of body at z-index 0: every positioned stage after it (sticky stages are stacking contexts)
  // paints above it, so copy always sits over the gold. Stages must keep transparent backgrounds where the 3D shows.
  document.body.insertBefore(canvas, document.body.firstChild);

  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.84;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // Studio: a black room lit by softbox strips and a gradient sweep (ported from the offline renderer).
  // The two RectAreaLights of the offline look are folded into the environment as extra boxes, so the module
  // needs nothing but three's core build.
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020202);
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 512;
  const cx = cv.getContext('2d'); const gr = cx.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#6a6a6a'); gr.addColorStop(0.36, '#ffffff'); gr.addColorStop(0.47, '#fff2d8');
  gr.addColorStop(0.52, '#2a241a'); gr.addColorStop(0.75, '#050505'); gr.addColorStop(1, '#000000');
  cx.fillStyle = gr; cx.fillRect(0, 0, 8, 512);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sweep = new THREE.Mesh(new THREE.SphereGeometry(20, 64, 32), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, color: new THREE.Color(0.82, 0.78, 0.7) }));
  sweep.rotation.x = 0.42; env.add(sweep);
  const box = (w, h, x, y, z, i, col = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0] * i, col[1] * i, col[2] * i), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  box(14, 3.2, 0, 9, 2, 5.5);
  box(1.4, 16, -8, 1, 5, 9);
  box(1.0, 16, 8, 0, 3, 5, [1, 0.92, 0.8]);
  box(10, 1.2, 0, -7, 6, 1.6, [1, 0.85, 0.6]);
  box(4, 4, 0, 2, -9, 2.5);
  box(1.2, 12, 3, 4, 9, 3);
  box(3.0, 0.7, -4.2, 5.4, 6.7, 2.6, [1, 0.95, 0.86]);   // stands in for area light 1
  box(0.6, 4.0, 6.9, 1.0, 5.8, 3.2, [1, 0.95, 0.86]);    // stands in for area light 2
  box(1.6, 22, -2.6, 0, 12, 3.4, [1, 0.94, 0.82]);       // a long strip behind the viewer: a diagonal sheen across the flat faces
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.015).texture;
  scene.environmentRotation = new THREE.Euler(0, 0.9, 0);
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xfff1d6, 0.6); key.position.set(-3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe0a0, 1.2); rim.position.set(4, 2, -3); scene.add(rim);

  const goldWarm = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1.0, 0.65, 0.21, THREE.LinearSRGBColorSpace), metalness: 1, roughness: 0.22, clearcoat: 0.35, clearcoatRoughness: 0.12 });
  const goldCool = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.96, 0.6, 0.2, THREE.LinearSRGBColorSpace), metalness: 1, roughness: 0.24, clearcoat: 0.25, clearcoatRoughness: 0.18 });

  // Piece geometry in mark-centred coordinates, then shifted so each piece's own centre sits at its local origin.
  const shapeOf = pts => {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => { const X = (x - M.B / 2) * K, Y = (M.H / 2 - y) * K; i ? s.lineTo(X, Y) : s.moveTo(X, Y); });
    s.closePath(); return s;
  };
  const extrude = (pts, cy) => {
    const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: DEPTH, bevelEnabled: true, bevelThickness: BT, bevelSize: BS, bevelSegments: 10, curveSegments: 4 });
    g.translate(0, -cy, -DEPTH / 2);
    return g;
  };
  const barGeo = extrude(M.bar, BAR_CY);
  const baseGeo = extrude(M.base, BASE_CY);

  // Act 1 pieces (independent) and the act 5 rig (assembles).
  const heroBar = new THREE.Group(); heroBar.add(new THREE.Mesh(barGeo, goldCool)); scene.add(heroBar);
  const heroBase = new THREE.Group(); heroBase.add(new THREE.Mesh(baseGeo, goldWarm)); scene.add(heroBase);
  const rig = new THREE.Group(); scene.add(rig);
  const rigBase = new THREE.Group(); rigBase.add(new THREE.Mesh(baseGeo, goldWarm)); rig.add(rigBase);
  const rigBar = new THREE.Group(); rigBar.add(new THREE.Mesh(barGeo, goldWarm)); rig.add(rigBar);
  // The level glint: a hairline of light inside the gap, visible only for a moment after the bar lands.
  const gapW = (44 + 156 * (M.C + M.GAP / 2) / M.H) * K;
  const glintMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.3), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const glint = new THREE.Mesh(new THREE.BoxGeometry(gapW * 1.04, M.GAP * K * 0.16, DEPTH * 0.9), glintMat);
  rig.add(glint);

  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const halfFov = THREE.MathUtils.degToRad(11);

  let W = 0, Hh = 0, worldPerPx = 1;
  function resize() {
    W = innerWidth; Hh = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(W, Hh, false);
    camera.aspect = W / Hh; camera.updateProjectionMatrix();
    worldPerPx = (2 * Math.tan(halfFov) * camera.position.z) / Hh;
  }
  resize();
  addEventListener('resize', resize);

  // Anchors
  const anchors = {};
  const names = ['bar', 'base', 'land', 'bar-close'];
  const visible = new Set();
  const io = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target.dataset.anchor) : visible.delete(e.target.dataset.anchor);
    wake();
  }, { rootMargin: '25% 0px 25% 0px' });
  function collect() {
    for (const n of names) {
      const el = document.querySelector(`[data-anchor="${n}"]`);
      if (el && anchors[n] !== el) { anchors[n] = el; io.observe(el); }
    }
  }
  collect();

  const rectOf = n => {
    const el = anchors[n];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: (r.left + r.width / 2 - W / 2) * worldPerPx, y: -(r.top + r.height / 2 - Hh / 2) * worldPerPx, w: r.width * worldPerPx, h: r.height * worldPerPx };
  };
  const fit = (a, w, h, pad = 0.92) => Math.min(a.w / (w * K), a.h / (h * K)) * pad;

  // Motion state
  let wob = 0, ptx = 0, pty = 0, last = performance.now(), clock = 0;
  let ready = false, raf = 0, running = false;

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    const p = AU.pointer || { x: 0, y: 0 };
    ptx = lerp(ptx, p.x || 0, 0.06); pty = lerp(pty, p.y || 0, 0.06);
    wob = lerp(wob, clamp((AU.velocity || 0) * 0.006, -0.18, 0.18), 0.08);

    // Act 1
    const aBar = visible.has('bar') && rectOf('bar');
    const aBase = visible.has('base') && rectOf('base');
    heroBar.visible = !!aBar; heroBase.visible = !!aBase;
    const heroP = clamp(AU.hero || 0);
    if (aBar) {
      const g = fit(aBar, BAR_W, BAR_H, 0.86);
      const bob = Math.sin(clock * 1.1) * aBar.h * 0.035;
      heroBar.position.set(aBar.x, aBar.y + bob + heroP * aBar.h * 0.08, 0);
      heroBar.scale.setScalar(g);
      heroBar.rotation.set(-0.04 + pty * 0.08 + Math.sin(clock * 0.7) * 0.03, 0.3 + ptx * 0.14 + Math.sin(clock * 0.5) * 0.06, 0.14 + Math.sin(clock * 0.9) * 0.025 + wob);
    }
    if (aBase) {
      const g = fit(aBase, BASE_W, BASE_H, 0.9);
      heroBase.position.set(aBase.x, aBase.y, 0);
      heroBase.scale.setScalar(g);
      heroBase.rotation.set(HERO_RX * 0.7 + pty * 0.06, HERO_RY + ptx * 0.12 + Math.sin(clock * 0.35) * 0.04, 0);
    }

    // Act 5
    const aLand = visible.has('land') && rectOf('land');
    const aFrom = rectOf('bar-close');
    rig.visible = !!aLand;
    if (aLand) {
      const c = clamp(AU.close || 0);
      const gL = fit(aLand, M.B, M.H, 0.92);
      rig.position.set(aLand.x, aLand.y, 0);
      rig.scale.setScalar(gL);
      const turn = easeInOut(smooth(0.8, 1.0, c));
      rig.rotation.set(lerp(-0.1, HERO_RX, turn) + pty * 0.05, lerp(0.12, HERO_RY, turn) + ptx * 0.1, 0);
      rig.updateMatrixWorld(true);

      // Base rises into its seat while the bar crosses.
      const rise = easeInOut(smooth(0.2, 0.7, c));
      rigBase.position.set(0, BASE_CY - (1 - rise) * M.H * K * 0.1, 0);
      rigBase.scale.setScalar(lerp(0.9, 1, rise));

      // Bar: from the alone side, over the level line on a shallow arc, onto the base.
      const seat = new THREE.Vector3(0, BAR_CY, 0);
      let startLocal = seat.clone().add(new THREE.Vector3(1.6, 0.4, 0)), startScale = 1;
      if (aFrom) {
        startLocal = rig.worldToLocal(new THREE.Vector3(aFrom.x, aFrom.y, 0));
        startScale = fit(aFrom, BAR_W, BAR_H, 0.86) / gL;
      }
      const t = easeInOut(smooth(0.2, 0.7, c));
      const pos = startLocal.clone().lerp(seat, t);
      pos.y += Math.sin(Math.PI * t) * M.H * K * 0.32;
      const u = clamp((c - 0.7) / 0.1);
      if (c >= 0.7) pos.y += Math.abs(Math.sin(u * Math.PI * 2.5)) * Math.exp(-4.2 * u) * M.H * K * 0.05 * (1 - u);
      rigBar.position.copy(pos);
      rigBar.scale.setScalar(lerp(startScale, 1, t));
      const wobble = (1 - t) * (0.14 + Math.sin(clock * 0.9) * 0.03 + wob);
      rigBar.rotation.set((1 - t) * 0.08, (1 - t) * 0.3, wobble);
      rigBar.visible = c > 0.001 || !!aFrom;

      glintMat.opacity = clamp(1 - Math.abs(c - 0.765) / 0.035) * 0.95;
      glint.position.set(0, GAP_Y, 0);
    }

    if (heroBar.visible || heroBase.visible || rig.visible) renderer.render(scene, camera);
    else renderer.clear();

    if (!ready) { ready = true; root.classList.add('au-3d-ready'); }
    if (running) raf = requestAnimationFrame(frame);
  }

  function wake() {
    const want = visible.size > 0 && !document.hidden;
    if (want && !running) { running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }
    else if (!want && running) {
      running = false;
      if (raf) cancelAnimationFrame(raf), (raf = 0);
      heroBar.visible = heroBase.visible = rig.visible = false;
      renderer.clear();
    }
  }
  document.addEventListener('visibilitychange', wake);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; fail(); });

  // Anchors can arrive after this module (the lead pastes partials, the engine may re-layout).
  if (names.some(n => !anchors[n])) new MutationObserver(collect).observe(document.body, { childList: true, subtree: true });
  wake();
  // Render one frame even if nothing is intersecting yet, so the canvas is initialised and the ready flag is honest.
  if (!running) requestAnimationFrame(t => { frame(t); });
}

function fail() {
  AU.webgl = false;
  root.classList.add('no-webgl');
  root.classList.remove('au-3d-ready');
  document.querySelectorAll('canvas.au-3d').forEach(c => c.remove());
}

try { start(); } catch (e) { console.warn('AURO 3D disabled:', e); fail(); }

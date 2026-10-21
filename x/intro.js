/* EDON intro: one fixed WebGL world over a scroll track. The phone travels the lattice and the app assembles in the
   business the visitor picks (colour, name and logo, buttons, words). Then the 3D logo falls through a shaft of light,
   lands, and its toggle switches the app on. Page-local code. Any failure drops back to the still screen. */
const H = document.documentElement;
const $ = id => document.getElementById(id);
const root = $('intro');
const sat = v => Math.min(1, Math.max(0, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, v) => { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - t, 3);
const backOut = t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const GL_POOL = 'אבגדהוזחטיכלמנסעפצקרשת';

/* the businesses come from the live demo (x.js), so the intro builds exactly what the demo runs */
const FALLBACK = [{ key: 'barber', chip: 'ברברשופ', name: 'ברברשופ אלון', sub: 'פתוח עכשיו · סוגר ב־19:00', letter: 'א', acc: '#C8FF2E', accFg: '#0B0B10',
  services: [{ n: 'תספורת', d: 35, i: 'scissors' }, { n: 'עיצוב זקן', d: 20, i: 'razor' }, { n: 'תספורת + זקן', d: 50, i: 'flame' }] }];
const DEMO = window.__edonDemo;
const BIZ = (DEMO && DEMO.list && DEMO.list.length) ? DEMO.list : FALLBACK;
let sel = 0;

/* ---------- business chips (both versions) ---------- */
const chips = root ? Array.from(root.querySelectorAll('.ichip')) : [];
const onPick = [];
function pick(key, user) {
  const i = BIZ.findIndex(b => b.key === key); if (i < 0) return;
  sel = i;
  chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.k === key)));
  if (user && DEMO && DEMO.pick) { try { DEMO.pick(key); } catch (e) {} }
  onPick.forEach(f => f());
}
chips.forEach(c => { if (!BIZ.some(b => b.key === c.dataset.k)) c.hidden = true; c.addEventListener('click', () => pick(c.dataset.k, true)); });

function still(e) {
  if (e) console.warn('[edon-intro] still version', e && e.message ? e.message : e);
  H.classList.remove('idyn', 'in-intro', 'past-intro');
  const b = document.querySelector('#hdr .brand img'); if (b) b.style.opacity = '';
}

if (root && H.classList.contains('idyn')) start().catch(still);

async function start() {
  const THREE = await import('/x/vendor/three.module.min.js');
  try { await Promise.all(['900 40px "Noto Sans Hebrew X"', '700 24px "Heebo X"', '400 16px "Heebo X"', '400 16px "JetBrains Mono X"'].map(f => document.fonts.load(f, 'אבג 02:00'))); } catch (e) {}

  /* ---------- the track: legs in viewport-heights, one pace ---------- */
  const LEGS = [['open', .70], ['color', .95], ['name', .75], ['btns', .95], ['text', .80], ['hush', .40], ['drop', 1.40], ['live', .60]];
  const WSUM = LEGS.reduce((s, l) => s + l[1], 0);
  const L = {}; { let a = 0; LEGS.forEach(([k, w]) => { L[k] = { a: a / WSUM, b: (a + w) / WSUM, w }; a += w; }); }
  H.style.setProperty('--iw', (WSUM + 1).toFixed(2));
  const lp = (k, u) => sat((u - L[k].a) / (L[k].b - L[k].a));
  const SPEED = 8; // world units per viewport-height while travelling
  const TRAVEL = ['open', 'color', 'name', 'btns', 'text'];
  function dist(u) {
    let d = 0;
    for (const k of TRAVEL) d += L[k].w * sat((u - L[k].a) / (L[k].b - L[k].a));
    const t = lp('hush', u); d += L.hush.w * (t - t * t / 2);
    return d * SPEED;
  }
  const D_END = dist(1);

  const stage = $('istage'), canvas = $('icv'), track = $('itrack'), copy = $('icopy');
  const brand = document.querySelector('#hdr .brand img');
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (devicePixelRatio || 1) < 1.5, alpha: true, powerPreference: 'high-performance', premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050507, .03);
  const camera = new THREE.PerspectiveCamera(38, 1, .05, 140);
  let PH = false, VW = 1, VH = 1;
  function sizes() {
    VW = innerWidth; VH = stage.clientHeight || innerHeight;
    PH = VW < 900 || VH > VW * 1.15;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, PH ? 1.5 : 1.75));
    renderer.setSize(VW, VH, false);
    camera.aspect = VW / VH; camera.fov = PH ? 46 : 38; camera.updateProjectionMatrix();
  }

  /* environment for the glossy parts: a dark room with three soft panels */
  {
    const s = new THREE.Scene(), box = new THREE.BoxGeometry(1, 1, 1);
    const add = (c, p, sc, side) => { const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: c, side: side || THREE.FrontSide })); m.position.set(...p); m.scale.set(...sc); s.add(m); };
    add(new THREE.Color(.03, .035, .05), [0, 0, 0], [24, 14, 24], THREE.BackSide);
    add(new THREE.Color(4, 4, 4.2), [0, 6.8, 0], [9, .1, 3]);
    add(new THREE.Color(1.5, 1.55, 1.8), [-11.8, 2, 1], [.1, 5, 9]);
    add(new THREE.Color(1.4, 2, .3), [11.8, 1, -4], [.1, 3, 6]);
    add(new THREE.Color(.9, 1, 1.5), [0, 2.5, 11.8], [7, 3, .1]);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(s, .04).texture; pm.dispose();
  }
  const hemi = new THREE.HemisphereLight(0x9fb0ff, 0x050507, .55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e0, 1.7); key.position.set(-4, 7, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xC8FF2E, 1.1); rim.position.set(4, 3, -6); scene.add(rim);
  const accL = new THREE.PointLight(0xC8FF2E, 2.2, 7, 1.6); scene.add(accL);

  /* additive glow that also writes alpha, so the canvas stays transparent where the world is dark */
  const GLOW = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
  const OUT = 'gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));\n#include <colorspace_fragment>';
  const SDBOX = 'float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }\nfloat h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }';
  const VOLT = new THREE.Color('#C8FF2E');

  /* ---------- floor: the EDON lattice, procedural, with the landing shockwave ---------- */
  const floorU = { uTime: { value: 0 }, uOp: { value: 1 }, uDim: { value: 1 }, uAcc: { value: VOLT.clone() }, uLine: { value: new THREE.Color('#2B3242') }, uCam: { value: new THREE.Vector3() }, uRing: { value: 0 }, uRingA: { value: 0 }, uImp: { value: new THREE.Vector2(0, -999) } };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), new THREE.ShaderMaterial({ ...GLOW, uniforms: floorU, extensions: { derivatives: true },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime, uOp, uDim, uRing, uRingA; uniform vec3 uAcc, uLine, uCam; uniform vec2 uImp; varying vec3 vW;
${SDBOX}
void main(){
  vec2 c = floor(vW.xz); vec2 f = fract(vW.xz) - .5;
  float d = sdBox(f, vec2(.43), .1), aa = fwidth(d) * 1.2;
  float line = 1. - smoothstep(0., aa, abs(d) - .006), inside = 1. - smoothstep(-aa, 0., d);
  float cd = length(vW - uCam), fog = exp(-cd * cd * .0019) * mix(.3, 1., smoothstep(1.5, 6.5, cd));
  float h = h21(c), lit = step(.955, h) * (.55 + .45 * sin(uTime * .7 + h * 60.)) * smoothstep(2.5, 10., cd);
  float lane = (1. - smoothstep(.6, 1.8, abs(c.x + .5))) * .3;
  float band = exp(-pow((length(c + .5 - uImp) - uRing) / 1.15, 2.)) * uRingA;
  vec3 col = (uLine * line * (.5 + lane) * uDim + uAcc * (inside * (lit * .3 * uDim + band * .85) + line * (lit * .55 * uDim + band * 1.5))) * fog * uOp;
  ${OUT}
}` }));
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = -2; scene.add(floor);

  /* ---------- glyph atlas: Hebrew + digits, for the rain and the stream ---------- */
  const atlas = document.createElement('canvas'); atlas.width = atlas.height = 512;
  {
    const g = atlas.getContext('2d'), CH = (GL_POOL + 'ךםןףץ0123456789EDON<>/{}=+*#:;').slice(0, 64);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 64; i++) { const ch = CH[i] || '0'; g.font = (/[0-9A-Z<>\/{}=+*#:;]/.test(ch) ? '400 40px "JetBrains Mono X", monospace' : '900 44px "Noto Sans Hebrew X", sans-serif'); g.fillText(ch, (i % 8) * 64 + 32, Math.floor(i / 8) * 64 + 34); }
  }
  const atlasTex = new THREE.CanvasTexture(atlas); atlasTex.flipY = false;

  /* ---------- far plane: Matrix rain, two depths, always ahead of the camera ---------- */
  const rainU = () => ({ uTime: { value: 0 }, uOp: { value: 1 }, uA: { value: atlasTex }, uCol: { value: VOLT.clone() }, uGrid: { value: new THREE.Vector2(120, 56) }, uSeed: { value: 0 } });
  const rainMat = u => new THREE.ShaderMaterial({ ...GLOW, uniforms: u, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uTime, uOp, uSeed; uniform sampler2D uA; uniform vec3 uCol; uniform vec2 uGrid; varying vec2 vUv;
float h1(float n){ return fract(sin(n * 127.1 + uSeed) * 43758.5453); }
void main(){
  vec2 g = vUv * uGrid, cell = floor(g), f = fract(g);
  float cx = cell.x, sp = .35 + h1(cx) * .9, rows = uGrid.y;
  float head = fract(uTime * sp * .045 + h1(cx + 7.)) * rows * 1.7;
  float d = head - (rows - 1. - cell.y);
  float tr = d < 0. ? 0. : exp(-d * .17);
  float on = step(.42, h1(cx * 3.1 + 11.));
  float gi = floor(h1(cx * 13. + cell.y * 7. + floor(uTime * (1.5 + h1(cx) * 3.))) * 63.99);
  vec2 auv = (vec2(mod(gi, 8.), floor(gi / 8.)) + vec2(f.x, 1. - f.y)) / 8.;
  float a = texture2D(uA, auv).r;
  float edge = smoothstep(0., .12, vUv.x) * smoothstep(1., .88, vUv.x) * smoothstep(0., .3, vUv.y) * smoothstep(1., .8, vUv.y);
  vec3 col = mix(uCol, vec3(1.), step(d, 1.2) * .7) * a * tr * on * edge * uOp * .55;
  ${OUT}
}` });
  const rainA = new THREE.Mesh(new THREE.PlaneGeometry(76, 34), rainMat(rainU())); rainA.renderOrder = -3; scene.add(rainA);
  const rainBu = rainU(); rainBu.uGrid.value.set(150, 64); rainBu.uSeed.value = 3.7;
  const rainB = new THREE.Mesh(new THREE.PlaneGeometry(110, 46), rainMat(rainBu)); rainB.renderOrder = -4; scene.add(rainB);

  /* ---------- near and mid: floating lattice chips along the path ---------- */
  const CELLS = PH0() ? 46 : 74;
  function PH0() { return innerWidth < 900; }
  const cellGeo = new THREE.PlaneGeometry(.36, .36);
  const cLit = new Float32Array(CELLS);
  const cellMat = new THREE.ShaderMaterial({ ...GLOW, uniforms: { uOp: { value: 1 }, uDim: { value: 1 }, uAcc: { value: VOLT.clone() }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 } }, extensions: { derivatives: true },
    vertexShader: 'attribute float aLit; varying vec2 vUv; varying float vLit; varying vec3 vW; void main(){ vUv = uv; vLit = aLit; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uOp, uDim, uTime; uniform vec3 uAcc, uCam; varying vec2 vUv; varying float vLit; varying vec3 vW;
${SDBOX}
void main(){
  float d = sdBox(vUv - .5, vec2(.44), .1), aa = fwidth(d) * 1.4;
  float line = 1. - smoothstep(0., aa, abs(d) - .012), inside = 1. - smoothstep(-aa, 0., d);
  float cd = length(vW - uCam), fog = exp(-cd * cd * .0026) * smoothstep(1.2, 3.4, cd);
  float pulse = .75 + .25 * sin(uTime * 1.3 + vW.x * 3. + vW.z);
  vec3 col = (vec3(.17, .2, .27) * line * (1. - vLit) + uAcc * vLit * (inside * .55 + line) * pulse) * fog * uOp * uDim;
  ${OUT}
}` });
  const cells = new THREE.InstancedMesh(cellGeo, cellMat, CELLS);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < CELLS; i++) {
      const side = rnd() < .5 ? -1 : 1;
      p.set(side * (1.7 + rnd() * 5.5), .25 + rnd() * 4.2, 4 - rnd() * (D_END + 14));
      e.set((rnd() - .5) * .5, (rnd() - .5) * .9, (rnd() - .5) * .3); q.setFromEuler(e);
      const k = .6 + rnd() * 1.1; s.set(k, k, k); m.compose(p, q, s); cells.setMatrixAt(i, m);
      cLit[i] = rnd() < .34 ? .6 + rnd() * .4 : 0;
    }
    cellGeo.setAttribute('aLit', new THREE.InstancedBufferAttribute(cLit, 1));
  }
  cells.frustumCulled = false; scene.add(cells);

  /* ---------- atmosphere: dust that wraps around the camera ---------- */
  const NDUST = PH0() ? 150 : 280;
  const dpos = new Float32Array(NDUST * 3), dsd = new Float32Array(NDUST);
  for (let i = 0; i < NDUST; i++) { dpos[i * 3] = (Math.random() - .5) * 16; dpos[i * 3 + 1] = Math.random() * 7; dpos[i * 3 + 2] = (Math.random() - .5) * 20; dsd[i] = Math.random(); }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3)); dgeo.setAttribute('aS', new THREE.BufferAttribute(dsd, 1));
  const dustU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uOp: { value: 1 }, uPx: { value: 1 } };
  const dust = new THREE.Points(dgeo, new THREE.ShaderMaterial({ ...GLOW, uniforms: dustU,
    vertexShader: `uniform float uTime, uPx; uniform vec3 uCam; attribute float aS; varying float vA;
void main(){
  vec3 p = position + vec3(sin(uTime * .21 + aS * 40.) * .4, uTime * (.03 + aS * .05), cos(uTime * .17 + aS * 20.) * .4);
  vec3 sz = vec3(16., 7., 20.), o = uCam - vec3(8., 0., 10.);
  p = mod(p - o, sz) + o; p.y = mod(p.y, 7.);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vA = smoothstep(14., 3., -mv.z) * smoothstep(.3, 1.2, -mv.z) * (.35 + aS * .65);
  gl_PointSize = (1.2 + aS * 2.4) * uPx * (6. / -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform float uOp; varying float vA; void main(){ float d = length(gl_PointCoord - .5); vec3 col = vec3(.85, .9, 1.) * smoothstep(.5, .1, d) * vA * uOp * .55; ${OUT} }` }));
  dust.frustumCulled = false; scene.add(dust);

  /* ---------- rounded-rect helpers ---------- */
  function rrShape(w, h, r, cx = 0, cy = 0) {
    const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function slab(w, h, r, depth, bevel) {
    const g = new THREE.ExtrudeGeometry(rrShape(w, h, r), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -depth / 2); return g;
  }
  function face(w, h, r) { // a flat rounded rect with 0..1 UVs, for screens and decals
    const g = new THREE.ShapeGeometry(rrShape(w, h, r), 12), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getY(i) / h + .5);
    uv.needsUpdate = true; return g;
  }
  function rr2d(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const hexA = (hex, a) => { const c = new THREE.Color(hex); return 'rgba(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ',' + a + ')'; };
  const mixHex = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

  /* icons from the page's own sprite, drawn into canvases in any colour */
  const icons = new Map(); let iconLoads = 0;
  function icon(name, color) {
    const k = name + color; if (icons.has(k)) return icons.get(k);
    const sym = document.getElementById('i-' + name); if (!sym) { icons.set(k, null); return null; }
    const img = new Image();
    img.onload = () => { iconLoads++; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (sym.getAttribute('viewBox') || '0 0 24 24') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + sym.innerHTML + '</svg>');
    icons.set(k, img); return img;
  }
  const drawIcon = (g, name, color, x, y, s) => { const im = icon(name, color); if (im && im.complete && im.naturalWidth) g.drawImage(im, x, y, s, s); };

  /* ---------- the phone ---------- */
  const PW = .78, PHH = 1.62, SWW = .70, SHH = 1.52;
  const phone = new THREE.Group(); scene.add(phone);
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x16181d, metalness: .65, roughness: .32, clearcoat: .7, clearcoatRoughness: .2, envMapIntensity: 1 });
  phone.add(new THREE.Mesh(slab(PW, PHH, .13, .075, .014), bodyMat));
  const SC = document.createElement('canvas'); SC.width = 460; SC.height = 1000;
  const sg = SC.getContext('2d');
  const screenTex = new THREE.CanvasTexture(SC); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 4;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, fog: false });
  const screen = new THREE.Mesh(face(SWW, SHH, .085), screenMat); screen.position.z = .053; phone.add(screen);
  const btnMat = new THREE.MeshPhysicalMaterial({ color: 0x23262d, metalness: .7, roughness: .35 });
  [[-.395, .32, .16], [-.395, .12, .1], [.395, .2, .2]].forEach(([x, y, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.012, h, .03), btnMat); b.position.set(x, y, 0); phone.add(b); });
  // screen coordinates (canvas px) to phone-local coordinates
  const sp = (x, y, z = .056) => new THREE.Vector3((x / 460 - .5) * SWW, (.5 - y / 1000) * SHH, z);

  /* the app on the screen, drawn from build state; strings come from the chosen business */
  const ROW_Y = [300, 420, 540], CTA_Y = 840;
  function words(B) {
    const out = [['h', 'בחרו שירות'], ['w', 'קובעים תור בשנייה, בכל שעה.']];
    B.services.slice(0, 3).forEach((v, i) => { out.push(['n' + i, v.n]); out.push(['d' + i, v.d + ' דק׳']); });
    out.push(['cta', 'קביעת תור']); return out;
  }
  const scr = { s: [] };
  function txt(g, str, n, x, y, scramble) {
    const full = Math.floor(n); let t = str.slice(0, full);
    if (scramble && full < str.length && n > 0) for (let j = 0; j < 2 && full + j < str.length; j++) t += str[full + j] === ' ' ? ' ' : GL_POOL[Math.random() * GL_POOL.length | 0];
    g.fillText(t, x, y);
  }
  function dash(g, x, y, w, h, r, col, label) {
    g.save(); g.setLineDash([7, 6]); g.lineWidth = 2; g.strokeStyle = col; rr2d(g, x, y, w, h, r); g.stroke(); g.restore();
    if (label) { g.save(); g.direction = 'ltr'; g.textAlign = 'left'; g.font = '400 13px "JetBrains Mono X", monospace'; g.fillStyle = col; g.fillText(label, x + 12, y + h / 2 + 5); g.restore(); }
  }
  function drawApp(st) {
    const g = sg, W = 460, B = BIZ[sel], acc = st.acc, fg = st.fg;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, 1000);
    g.fillStyle = '#0A0C11'; g.fillRect(0, 0, W, 1000);
    // blueprint grid fades out as the app arrives
    const bp = 1 - st.pour * .85;
    if (bp > .02) { g.strokeStyle = hexA(st.line, .07 * bp); g.lineWidth = 1; g.beginPath(); for (let x = 23; x < W; x += 23) { g.moveTo(x, 0); g.lineTo(x, 1000); } for (let y = 23; y < 1000; y += 23) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke(); }
    if (st.pour > 0) { const gr = g.createRadialGradient(W * .7, -40, 10, W * .7, -40, 620); gr.addColorStop(0, hexA(acc, .3 * st.pour + .12 * st.live)); gr.addColorStop(1, hexA(acc, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, 1000 * Math.min(1, st.pour * 1.2)); }
    const dl = hexA(st.line, .55), dlb = hexA(st.line, .9);
    g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    // status bar + island
    g.save(); g.direction = 'ltr'; g.textAlign = 'left'; g.fillStyle = '#E9EAEE'; g.font = '700 19px "Heebo X", sans-serif'; g.fillText('02:00', 34, 46); g.restore();
    g.fillStyle = '#E9EAEE'; [0, 1, 2].forEach(i => g.fillRect(376 + i * 8, 40 - i * 5, 5, 6 + i * 5)); rr2d(g, 404, 30, 26, 14, 4); g.globalAlpha = .9; g.fill(); g.globalAlpha = 1;
    g.fillStyle = '#000'; rr2d(g, 175, 18, 110, 34, 17); g.fill();
    // header: avatar + name + LIVE
    const AX = W - 40 - 64;
    if (st.av) { g.fillStyle = acc; rr2d(g, AX, 82, 64, 64, 16); g.fill(); g.fillStyle = fg; g.textAlign = 'center'; g.font = '900 36px "Noto Sans Hebrew X", sans-serif'; g.fillText(B.letter, AX + 32, 127); g.textAlign = 'right'; }
    else dash(g, AX, 82, 64, 64, 16, st.avHot ? dlb : dl);
    if (st.nameN > 0) {
      g.fillStyle = '#F4F5F0'; g.font = '700 25px "Heebo X", sans-serif'; txt(g, B.name, st.nameN * B.name.length, AX - 16, 108, true);
      g.fillStyle = '#8C919E'; g.font = '400 16px "Heebo X", sans-serif'; txt(g, B.sub.replace('פתוח עכשיו · ', ''), Math.max(0, st.nameN * 1.6 - .6) * B.sub.length, AX - 16, 136, true);
    } else { dash(g, AX - 16 - 180, 90, 180, 24, 8, dl); dash(g, AX - 16 - 120, 124, 120, 16, 6, dl); }
    if (st.live > 0) { g.save(); g.globalAlpha = st.live; g.direction = 'ltr'; g.textAlign = 'left'; g.strokeStyle = hexA(acc, .55); g.lineWidth = 2; rr2d(g, 32, 98, 78, 30, 15); g.stroke(); g.fillStyle = acc; g.beginPath(); g.arc(48, 113, 5, 0, Math.PI * 2); g.fill(); g.font = '700 14px "JetBrains Mono X", monospace'; g.fillText('LIVE', 60, 118); g.restore(); }
    // progress crumbs
    for (let i = 0; i < 4; i++) { g.fillStyle = i === 0 && st.pour > .5 ? acc : '#252932'; rr2d(g, W - 40 - (i + 1) * 92 + 8, 176, 84, 5, 2.5); g.fill(); }
    // heading + welcome
    const wl = st.words, list = words(B); let wi = 0; const wd = {};
    const total = list.reduce((s, x) => s + x[1].length, 0); let budget = wl * total;
    list.forEach(([k, v]) => { const n = Math.max(0, Math.min(v.length, budget)); wd[k] = n; budget -= v.length; wi++; });
    if (wd.h > 0) { g.fillStyle = '#F4F5F0'; g.font = '700 30px "Heebo X", sans-serif'; txt(g, 'בחרו שירות', wd.h, W - 40, 236, true); } else dash(g, W - 40 - 190, 210, 190, 30, 8, dl);
    if (wd.w > 0) { g.fillStyle = '#8C919E'; g.font = '400 17px "Heebo X", sans-serif'; txt(g, 'קובעים תור בשנייה, בכל שעה.', wd.w, W - 40, 268, true); } else dash(g, W - 40 - 250, 252, 250, 18, 6, dl);
    // service rows
    B.services.slice(0, 3).forEach((v, i) => {
      const y = ROW_Y[i];
      if (st.rows[i] >= 1) {
        g.fillStyle = '#12151C'; rr2d(g, 30, y, 400, 104, 20); g.fill(); g.strokeStyle = '#1F232C'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#191C24'; rr2d(g, 354, y + 24, 56, 56, 14); g.fill(); drawIcon(g, v.i, acc, 367, y + 37, 30);
        if (wd['n' + i] > 0) { g.fillStyle = '#F4F5F0'; g.font = '700 22px "Heebo X", sans-serif'; txt(g, v.n, wd['n' + i], 336, y + 50, true); }
        else { g.fillStyle = '#232731'; rr2d(g, 336 - 150, y + 32, 150, 20, 6); g.fill(); }
        if (wd['d' + i] > 0) { g.fillStyle = '#8C919E'; g.font = '400 16px "Heebo X", sans-serif'; txt(g, v.d + ' דק׳', wd['d' + i], 336, y + 80, true); }
        else { g.fillStyle = '#1C2028'; rr2d(g, 336 - 70, y + 64, 70, 14, 5); g.fill(); }
      } else dash(g, 30, y, 400, 104, 20, st.rows[i] > 0 ? dlb : dl, 'BUTTON ' + (i + 1));
    });
    if (st.rows[3] >= 1) {
      g.fillStyle = acc; rr2d(g, 30, CTA_Y, 400, 84, 42); g.fill();
      if (wd.cta > 0) { g.fillStyle = fg; g.textAlign = 'center'; g.font = '800 26px "Heebo X", sans-serif'; txt(g, 'קביעת תור', wd.cta, W / 2, CTA_Y + 52, true); g.textAlign = 'right'; }
      else { g.fillStyle = hexA(fg, .35); rr2d(g, W / 2 - 70, CTA_Y + 34, 140, 16, 8); g.fill(); }
    } else dash(g, 30, CTA_Y, 400, 84, 42, st.rows[3] > 0 ? dlb : dl, 'BOOK');
    g.fillStyle = 'rgba(255,255,255,.35)'; rr2d(g, 160, 972, 140, 6, 3); g.fill();
    screenTex.needsUpdate = true;
  }

  /* ---------- 3D parts that fly into the phone ---------- */
  function decal(w, h, draw, pxw = 256) {
    const c = document.createElement('canvas'); c.width = pxw; c.height = Math.round(pxw * h / w);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, fog: false });
    return { c, t, m, draw() { const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); draw(g, c.width, c.height); t.needsUpdate = true; } };
  }
  const glossy = hex => new THREE.MeshPhysicalMaterial({ color: hex, roughness: .28, metalness: .05, clearcoat: .9, clearcoatRoughness: .12, emissive: hex, emissiveIntensity: .1, envMapIntensity: .9 });
  // colour tiles: one per business
  const tiles = BIZ.map((B, i) => {
    const grp = new THREE.Group(), mat = glossy(B.acc);
    grp.add(new THREE.Mesh(slab(.56, .56, .13, .08, .016), mat));
    const d = decal(.56, .56, (g, w, h) => {
      const fg = B.accFg; drawIcon(g, B.services[0].i, fg, w / 2 - 42, 44, 84);
      g.fillStyle = fg; g.textAlign = 'center'; g.direction = 'rtl'; g.font = '800 34px "Heebo X", sans-serif'; g.fillText(B.chip, w / 2, 198);
    });
    const f = new THREE.Mesh(face(.56, .56, .13), d.m); f.position.z = .057; grp.add(f);
    grp.visible = false; scene.add(grp); return { grp, d, mat };
  });
  // the letter badge
  const badgeMat = glossy('#C8FF2E');
  const badge = new THREE.Group(); badge.add(new THREE.Mesh(slab(.4, .4, .1, .07, .014), badgeMat));
  const badgeD = decal(.4, .4, (g, w, h) => { const B = BIZ[sel]; g.fillStyle = B.accFg; g.textAlign = 'center'; g.direction = 'rtl'; g.font = '900 150px "Noto Sans Hebrew X", sans-serif'; g.fillText(B.letter, w / 2, h / 2 + 52); });
  { const f = new THREE.Mesh(face(.4, .4, .1), badgeD.m); f.position.z = .05; badge.add(f); }
  badge.visible = false; scene.add(badge);
  // service cards + the booking button: identical to the rows they become
  const RW = 400 / 460 * SWW, RH = 104 / 1000 * SHH, CH2 = 84 / 1000 * SHH;
  const cardMat = new THREE.MeshPhysicalMaterial({ color: 0x1d212b, roughness: .35, metalness: .25, clearcoat: .8, envMapIntensity: 1.1 });
  const ctaMat = glossy('#C8FF2E');
  const cards = [0, 1, 2, 3].map(i => {
    const cta = i === 3, w = RW, h = cta ? CH2 : RH, r = cta ? h / 2 : RH * .19;
    const grp = new THREE.Group(); grp.add(new THREE.Mesh(slab(w, h, r, .02, .006), cta ? ctaMat : cardMat));
    const d = decal(w, h, (g, cw, ch) => {
      const B = BIZ[sel], k = cw / 400; g.scale(k, k);
      if (cta) { g.fillStyle = hexA(B.accFg, .35); rr2d(g, 130, 34, 140, 16, 8); g.fill(); return; }
      const v = B.services[i] || B.services[0];
      g.fillStyle = '#191C24'; rr2d(g, 324, 24, 56, 56, 14); g.fill(); drawIcon(g, v.i, B.acc, 337, 37, 30);
      g.fillStyle = '#232731'; rr2d(g, 306 - 150, 32, 150, 20, 6); g.fill(); g.fillStyle = '#1C2028'; rr2d(g, 306 - 70, 64, 70, 14, 5); g.fill();
    }, 512);
    const f = new THREE.Mesh(face(w, h, r), d.m); f.position.z = .017; grp.add(f);
    grp.visible = false; scene.add(grp); return { grp, d, cta, w, h };
  });

  /* glyph stream: the rain bends into the phone and becomes the words */
  const NG = PH0() ? 96 : 180;
  const gA = new Float32Array(NG), gI = new Float32Array(NG);
  const gGeo = new THREE.PlaneGeometry(1, 1); gGeo.setAttribute('aA', new THREE.InstancedBufferAttribute(gA, 1)); gGeo.setAttribute('aG', new THREE.InstancedBufferAttribute(gI, 1));
  const gMat = new THREE.ShaderMaterial({ ...GLOW, uniforms: { uA: { value: atlasTex }, uCol: { value: VOLT.clone() } },
    vertexShader: 'attribute float aA, aG; varying vec2 vUv; varying float vA, vG; void main(){ vUv = uv; vA = aA; vG = aG; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D uA; uniform vec3 uCol; varying vec2 vUv; varying float vA, vG;
void main(){ vec2 auv = (vec2(mod(vG, 8.), floor(vG / 8.)) + vec2(vUv.x, 1. - vUv.y)) / 8.; float a = texture2D(uA, auv).r; vec3 col = mix(uCol, vec3(1.), .45) * a * vA * 1.35; ${OUT} }` });
  const glyphs = new THREE.InstancedMesh(gGeo, gMat, NG); glyphs.frustumCulled = false; glyphs.visible = false; scene.add(glyphs);
  const gSeed = Array.from({ length: NG }, () => ({ x: (Math.random() - .5) * 14, y: 1.5 + Math.random() * 5, z: 16 + Math.random() * 10, s: Math.random() * .62, t: Math.floor(Math.random() * 6), g: Math.random() * 64 | 0 }));

  /* ---------- the logo: the brand outlines, extruded, with a working toggle ---------- */
  const LOGO = [[['L',995,1456,226,1456],['L',226,1456,226,1183],['L',226,1183,995,1183]],[['L',340,1456,0,1456],['L',0,1456,0,0],['L',0,0,340,0]],[['L',895,840,226,840],['L',226,840,226,576],['L',226,576,895,576]],[['L',995,274,226,274],['L',226,274,226,0],['L',226,0,995,0]],[['L',1258,1456,1258,1183],['L',1258,1183,1576,1183],['Q',1576,1183,1683,1183,1756,1135],['Q',1756,1135,1829,1087,1866,992],['Q',1866,992,1904,897,1904,757],['L',1904,757,1904,698],['Q',1904,698,1904,557,1867,463],['Q',1867,463,1829,369,1756,321],['Q',1756,321,1683,274,1575,274],['L',1575,274,1252,274],['L',1252,274,1252,0],['L',1252,0,1575,0],['Q',1575,0,1773,0,1925,89],['Q',1925,89,2076,177,2162,335],['Q',2162,335,2248,492,2248,700],['L',2248,700,2248,757],['Q',2248,757,2248,964,2162,1122],['Q',2162,1122,2076,1279,1925,1368],['Q',1925,1368,1774,1456,1576,1456]],[['L',1453,1456,1113,1456],['L',1113,1456,1113,0],['L',1113,0,1453,0]],[['L',6194,1456,5856,1456],['L',5856,1456,5325,557],['L',5325,557,5325,1456],['L',5325,1456,4986,1456],['L',4986,1456,4986,0],['L',4986,0,5325,0],['L',5325,0,5857,899],['L',5857,899,5857,0],['L',5857,0,6194,0]]];
  const V2 = (x, y) => new THREE.Vector2(x, y);
  function mirrorY(geo) { // SVG y points down; flipping it reverses the triangle winding, so swap two corners back
    geo.applyMatrix4(new THREE.Matrix4().makeScale(1, -1, 1));
    for (const n of Object.keys(geo.attributes)) { const a = geo.attributes[n], k = a.itemSize, arr = a.array; for (let i = 0; i < a.count; i += 3) for (let j = 0; j < k; j++) { const p = (i + 1) * k + j, q = (i + 2) * k + j, t = arr[p]; arr[p] = arr[q]; arr[q] = t; } a.needsUpdate = true; }
    return geo;
  }
  const ext = (shapes, depth, bevel) => mirrorY(new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 5, curveSegments: 24 }));
  const circ = (cx, cy, r) => { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, Math.PI * 2, false); return s; };
  const logo = new THREE.Group(), logoIn = new THREE.Group(); logo.add(logoIn); scene.add(logo);
  const mLetters = new THREE.MeshPhysicalMaterial({ color: 0xEDEDE6, roughness: .3, metalness: .05, clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: .8 });
  const PILL_OFF = new THREE.Color('#2A2F38'), PILL_ON = new THREE.Color('#9CDC00'), EM_ON = new THREE.Color('#6E9E00');
  const mPill = new THREE.MeshPhysicalMaterial({ color: PILL_OFF.clone(), roughness: .3, metalness: .2, clearcoat: 1, clearcoatRoughness: .08, emissive: new THREE.Color(0), emissiveIntensity: 1, envMapIntensity: .6 });
  const mKnob = new THREE.MeshPhysicalMaterial({ color: 0x15151a, roughness: .28, metalness: .8, clearcoat: .8, clearcoatRoughness: .15, envMapIntensity: 1.2 });
  const mDot = new THREE.MeshStandardMaterial({ color: 0x3a4a10, emissive: 0xC8FF2E, emissiveIntensity: 0, roughness: .4 });
  LOGO.forEach(c => { const s = new THREE.Shape(); c.forEach(q => s.curves.push(q[0] === 'L' ? new THREE.LineCurve(V2(q[1], q[2]), V2(q[3], q[4])) : new THREE.QuadraticBezierCurve(V2(q[1], q[2]), V2(q[3], q[4]), V2(q[5], q[6])))); logoIn.add(new THREE.Mesh(ext([s], 230, 46), mLetters)); });
  logoIn.add(new THREE.Mesh(ext([rrShape(2592, 1456, 728, 2321 + 1296, 728)], 260, 60), mPill));
  const knob = new THREE.Group(); logoIn.add(knob);
  { const k = new THREE.Mesh(ext([circ(0, 728, 604)], 300, 70), mKnob); k.position.z = 120; knob.add(k); const d = new THREE.Mesh(ext([circ(0, 728, 217)], 60, 26), mDot); d.position.z = 470; knob.add(d); }
  const knobGlow = new THREE.PointLight(0xC8FF2E, 0, 2600, 1.6); knobGlow.position.set(0, -728, 900); knob.add(knobGlow);
  const KNOB_OFF = 3049, KNOB_ON = 4185;
  logoIn.position.set(-3097, 728, -180);
  const LOGO_W = 2.5, LK = LOGO_W / 6194, LKM = 2.05 / 6194;
  logo.visible = false;
  // its shadow, the shaft it falls through, the floor pool, the shock ring, the dust burst
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uOp: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform float uOp; varying vec2 vUv; void main(){ float d = length((vUv - .5) * 2.); gl_FragColor = vec4(0., 0., 0., smoothstep(1., .1, d) * uOp); }' }));
  shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = -1; scene.add(shadow);
  const shaftU = { uOp: { value: 0 }, uCol: { value: new THREE.Color('#E4F5B0') } };
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.42, 1.45, 14, 48, 1, true), new THREE.ShaderMaterial({ ...GLOW, side: THREE.DoubleSide, uniforms: shaftU,
    vertexShader: 'varying vec3 vN, vV; varying float vY; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); vY = uv.y; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uOp; uniform vec3 uCol; varying vec3 vN, vV; varying float vY; void main(){ float f = pow(abs(dot(vN, vV)), 2.2); float gy = smoothstep(0., .1, vY) * (1. - vY * .7); vec3 col = uCol * f * gy * uOp * .09; ${OUT} }` }));
  scene.add(shaft);
  const poolU = { uOp: { value: 0 }, uCol: { value: new THREE.Color('#DDF2A0') } };
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ ...GLOW, uniforms: poolU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uOp; uniform vec3 uCol; varying vec2 vUv; void main(){ float d = length((vUv - .5) * 2.); vec3 col = uCol * smoothstep(1., 0., d) * uOp * .32; ${OUT} }` }));
  pool.rotation.x = -Math.PI / 2; pool.scale.set(4.4, 4.4, 1); scene.add(pool);
  const ringU = { uOp: { value: 0 }, uCol: { value: VOLT.clone() } };
  const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 128), new THREE.ShaderMaterial({ ...GLOW, uniforms: ringU,
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uOp; uniform vec3 uCol; void main(){ vec3 col = uCol * uOp; ${OUT} }` }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  const NB = 80, bV = new Float32Array(NB * 3), bS = new Float32Array(NB);
  for (let i = 0; i < NB; i++) { const a = Math.random() * Math.PI * 2, r = .8 + Math.random() * 2.6; bV[i * 3] = Math.cos(a) * r; bV[i * 3 + 1] = 1 + Math.random() * 3.2; bV[i * 3 + 2] = Math.sin(a) * r; bS[i] = Math.random(); }
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3)); bGeo.setAttribute('aV', new THREE.BufferAttribute(bV, 3)); bGeo.setAttribute('aS', new THREE.BufferAttribute(bS, 1));
  const burstU = { uAge: { value: 9 }, uO: { value: new THREE.Vector3() }, uPx: { value: 1 } };
  const burst = new THREE.Points(bGeo, new THREE.ShaderMaterial({ ...GLOW, uniforms: burstU,
    vertexShader: 'uniform float uAge, uPx; uniform vec3 uO; attribute vec3 aV; attribute float aS; varying float vA; void main(){ vec3 p = uO + aV * uAge * (.9 + aS * .5) - vec3(0., 3.2, 0.) * uAge * uAge; p.y = max(p.y, .02); vec4 mv = modelViewMatrix * vec4(p, 1.); vA = (1. - smoothstep(.2, 1.3, uAge)) * (.5 + aS * .5); gl_PointSize = (2. + aS * 3.) * uPx * (6. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); vec3 col = vec3(.9, 1., .7) * smoothstep(.5, 0., d) * vA; ${OUT} }` }));
  burst.frustumCulled = false; burst.visible = false; scene.add(burst);

  /* ---------- camera keys: [cam xyz, look xyz] relative to the path anchor; one set per leg ---------- */
  const KEYS = {
    d: { open: [-.25, 1.5, 3.05, .8, 1.28, -.2], color: [-.3, 1.95, 4.7, 1.05, 1.15, 0], name: [-.5, 1.52, 3.45, .82, 1.27, 0], btns: [-.15, 1.4, 3.35, .8, 1.22, 0], text: [-.6, 1.62, 3.9, .88, 1.24, -.6], hush: [-.4, 1.3, 4.4, 1.0, .95, -.3], drop: [-.6, 2.0, 7.6, 2.0, 1.55, -1.0], live: [-.5, 1.4, 6.3, 2.05, .9, -.7] },
    m: { open: [0, 1.55, 4.3, 0, 1.72, 0], color: [0, 2.15, 5.9, 0, 1.78, 0], name: [.2, 1.62, 4.05, 0, 1.64, 0], btns: [0, 1.48, 3.75, 0, 1.6, 0], text: [-.3, 1.8, 4.6, 0, 1.58, -.6], hush: [0, 1.4, 5.0, -.15, 1.15, -.2], drop: [.05, 2.45, 9.2, .05, 2.5, -1.1], live: [0, 1.6, 7.0, -.08, 1.62, -.9] },
  };
  const YAW = { open: -.4, color: 0, name: -.2, btns: 0, text: .22, hush: .06, drop: -.18, live: -.26 };
  const CEN = LEGS.map(([k]) => (L[k].a + L[k].b) / 2);
  function keyed(table, u) { // smooth blend between leg-centre keys
    const names = LEGS.map(l => l[0]);
    if (u <= CEN[0]) return table[names[0]];
    for (let i = 0; i < CEN.length - 1; i++) if (u <= CEN[i + 1]) { const k = ss(0, 1, (u - CEN[i]) / (CEN[i + 1] - CEN[i])), a = table[names[i]], b = table[names[i + 1]]; return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], k)) : lerp(a, b, k); }
    return table[names[names.length - 1]];
  }
  const LOGO_AT = { d: [1.42, -.9], m: [.52, -1.75] }, PHONE_X = { d: -.45, m: -.8 };

  /* ---------- copy windows, rail, HUD ---------- */
  const blocks = Array.from(copy.querySelectorAll('.iblk')).map(el => ({ el, k: el.dataset.win, o: -1, y: 0, foc: Array.from(el.querySelectorAll('a,button')) }));
  const scrim = copy.querySelector('.iscrim');
  function windowOf(k) {
    if (k === 'open') return [-1, L.open.b + .004, 0, .035];
    if (k === 'fin') return [L.drop.a + (L.drop.b - L.drop.a) * .7, 9, .045, 0];
    return [L[k].a - .004, L[k].b + .004, .03, .03];
  }
  const railBtns = Array.from(document.querySelectorAll('#irail button'));
  const RAIL_AT = { color: .12, name: .15, btns: .12, text: .12, drop: .02, live: .5 };
  const goU = u => scrollTo({ top: T0 + u * WSUM * UNIT + 1, behavior: 'smooth' });
  railBtns.forEach(b => b.addEventListener('click', () => { const k = b.dataset.leg; goU(L[k].a + (L[k].b - L[k].a) * RAIL_AT[k]); }));
  const ret = $('iret'), retl = $('iretl'), tag = $('itag'), flash = $('iflash'), hud = $('ihud');

  /* ---------- state ---------- */
  let T0 = 0, S = 1, UNIT = 1;
  function measure() { T0 = track.getBoundingClientRect().top + scrollY; S = track.offsetHeight; UNIT = S / (WSUM + 1); }
  let uS = 0, hS = 0, last = performance.now(), running = false, raf = 0, ready = false, fxAt = -1, prevDrop = 0, shakeT = -1;
  let selS = 0, palette = BIZ[0].acc, dirty = true, lastSig = '', lastDraw = 0;
  let mx = 0, my = 0, mxS = 0, myS = 0, vel = 0;
  const v3 = new THREE.Vector3(), v3b = new THREE.Vector3(), q0 = new THREE.Quaternion(), e0 = new THREE.Euler();
  const anchor = new THREE.Vector3();
  if (FINE) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  onPick.push(() => { dirty = true; badgeD.draw(); cards.forEach(c => c.d.draw()); });

  function project(p) { v3.copy(p).project(camera); return { x: (v3.x * .5 + .5) * VW, y: (-v3.y * .5 + .5) * VH, z: v3.z }; }
  function phoneRect() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of [[-PW / 2, -PHH / 2], [PW / 2, -PHH / 2], [-PW / 2, PHH / 2], [PW / 2, PHH / 2]]) { v3b.set(x, y, .05).applyMatrix4(phone.matrixWorld); const p = project(v3b); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x0, y0, x1, y1 };
  }

  /* ---------- one frame of the world at track position u, hand-off h ---------- */
  function update(u, h, now) {
    const t = now * .001, M = PH ? KEYS.m : KEYS.d, B = BIZ[sel];
    // path anchor
    const D = dist(u);
    anchor.set(Math.sin(D * .09) * .25 * (1 - ss(L.hush.a, L.hush.b, u)), 0, -D);
    const k = keyed(M, u);
    // phone
    const ground = ss(L.hush.a, L.hush.b, u);
    const live = ss(.8, .96, lp('drop', u));
    phone.position.set(anchor.x + lerp(0, PH ? PHONE_X.m : PHONE_X.d, ground), lerp(1.25 + Math.sin(t * 1.1) * .025, .83, ground), anchor.z);
    vel = lerp(vel, (uT - uS) * 60, .1);
    phone.rotation.set(Math.sin(t * .7) * .015 * (1 - ground), keyed(YAW, u) + mxS * .08, Math.max(-.08, Math.min(.08, -vel * .6)) * (1 - ground));
    phone.updateMatrixWorld();
    // camera: keyed pose + pointer lean + impact shake
    camera.position.set(anchor.x + k[0] + mxS * .25, k[1] - myS * .12, anchor.z + k[2]);
    const dpc = lp('drop', u), fallC = sat(dpc / .62), lyC = lerp(7.6, .27, Math.pow(fallC, 1.6));
    const follow = ss(.04, .2, dpc) * (1 - ss(.5, .66, dpc)) * Math.max(0, lyC - (PH ? 3.2 : 2.6)) * (PH ? .5 : .62);
    v3.set(anchor.x + k[3], k[4] + follow, anchor.z + k[5]);
    if (shakeT >= 0) { const a = (now - shakeT) / 650; if (a >= 1) shakeT = -1; else { const amp = .07 * Math.pow(1 - a, 2); camera.position.x += Math.sin(now * .09) * amp; camera.position.y += Math.cos(now * .113) * amp; } }
    camera.lookAt(v3);
    // lights dim in the hush, return with the impact
    const dp = lp('drop', u), dim = ss(L.hush.a, L.hush.b - .01, u) * (1 - ss(.62, .82, dp));
    hemi.intensity = .55 * (1 - dim * .6); key.intensity = 1.7 * (1 - dim * .55); rim.intensity = 1.1 * (1 - dim * .4) + ss(.7, .85, dp) * .8 * (1 - ss(.85, 1, dp) * .5);
    // the chosen palette, smoothed
    // colour leg: the carousel
    const cl = lp('color', u);
    selS = lerp(selS, sel, .12);
    let frontAcc = B.acc, prevAcc = B.acc, pour = ss(.84, 1, cl) + (u > L.color.b ? 1 : 0); pour = Math.min(1, pour);
    const showTiles = cl > 0 && cl < 1 && u < L.color.b;
    if (showTiles) {
      const R = PH ? .95 : 1.25, free = cl * Math.PI * 2 * .9, start = .62 * Math.PI * 2 * .9;
      let target = -selS * Math.PI / 2; while (target < start + Math.PI / 4) target += Math.PI * 2;
      const th = lerp(free, target, ss(.5, .8, cl));
      let best = -2, second = -2, bi = 0, si = 0;
      tiles.forEach((T, i) => {
        const a = th + i * Math.PI / 2, cs = Math.cos(a);
        if (cs > best) { second = best; si = bi; best = cs; bi = i; } else if (cs > second) { second = cs; si = i; }
        const appear = ss(0, .14, cl), fly = i === sel ? ss(.8, 1, cl) : 0, scatter = i === sel ? 0 : ss(.8, 1, cl);
        T.grp.visible = appear > .01 && fly < .98;
        const rr = R * (1 + scatter * 2.2);
        v3.set(phone.position.x + Math.sin(a) * rr, phone.position.y + .12 * Math.sin(a * 2 + 1) + scatter * .8, phone.position.z + Math.cos(a) * rr);
        if (fly > 0) { v3b.copy(sp(230, 500)).applyMatrix4(phone.matrixWorld); v3.lerp(v3b, easeOut(fly)); }
        T.grp.position.copy(v3);
        T.grp.rotation.set(Math.sin(t + i) * .08, a + fly * (phone.rotation.y - a), 0);
        T.grp.scale.setScalar(appear * (1 - fly * .85));
      });
      frontAcc = BIZ[bi % BIZ.length].acc;
      const wsum = Math.max(.001, (best + 1) + (second + 1));
      prevAcc = mixHex(BIZ[bi % BIZ.length].acc, BIZ[si % BIZ.length].acc, (second + 1) / wsum);
      if (cl > .8) prevAcc = mixHex(prevAcc, B.acc, ss(.8, .9, cl));
    } else tiles.forEach(T => { T.grp.visible = false; });
    const acc = u < L.color.a ? '#C8FF2E' : (u < L.color.b ? prevAcc : B.acc);
    // name leg: the badge docks into the header, the name types itself
    const nl = lp('name', u), fly = ss(.04, .55, nl);
    const av = nl >= .55 || u > L.name.b;
    badge.visible = nl > .04 && nl < .55;
    if (badge.visible) {
      const target = sp(388, 114).applyMatrix4(phone.matrixWorld);
      const from = v3b.set(phone.position.x - 2.2, phone.position.y + 1.4, phone.position.z - 1.6);
      const e = easeOut(fly), ctrl = new THREE.Vector3(phone.position.x - 1.2, phone.position.y + 1.9, phone.position.z - .2);
      badge.position.set(0, 0, 0).addScaledVector(from, (1 - e) * (1 - e)).addScaledVector(ctrl, 2 * e * (1 - e)).addScaledVector(target, e * e);
      badge.quaternion.copy(phone.quaternion); e0.set(0, (1 - e) * -Math.PI * 1.6, (1 - e) * .5); q0.setFromEuler(e0); badge.quaternion.multiply(q0);
      badge.scale.setScalar(lerp(2.2, (64 / 460 * SWW) / .4, e));
    }
    const nameN = ss(.5, .95, nl) + (u > L.name.b ? 1 : 0);
    // buttons leg: four parts snap into their rows
    const bl = lp('btns', u), rows = [0, 0, 0, 0];
    let active = -1;
    cards.forEach((C, i) => {
      const a = .06 + i * .17, f = sat((bl - a) / .3);
      rows[i] = u > L.btns.b ? 1 : f >= 1 ? 1 : f > 0 ? .5 : 0;
      C.grp.visible = f > 0 && f < 1 && u <= L.btns.b;
      if (!C.grp.visible) return;
      active = i;
      const sy = i === 3 ? CTA_Y + 42 : ROW_Y[i] + 52, target = sp(230, sy, .07).applyMatrix4(phone.matrixWorld);
      const side = i % 2 ? 1 : -1, from = v3b.set(phone.position.x + side * 2.1, phone.position.y + 1.1 - i * .32, phone.position.z - 2.6);
      const e = backOut(Math.min(1, f));
      C.grp.position.copy(from).lerp(target, e);
      C.grp.quaternion.copy(phone.quaternion); e0.set((1 - f) * .7, (1 - f) * side * 1.1, (1 - f) * side * .3); q0.setFromEuler(e0); C.grp.quaternion.multiply(q0);
      C.grp.scale.setScalar(lerp(1.5, 1, ss(0, 1, f)));
    });
    // text leg: glyphs from the far rain become the words
    const tl = lp('text', u), wordsK = ss(.16, .96, tl) + (u > L.text.b ? 1 : 0);
    glyphs.visible = tl > 0 && tl < 1;
    if (glyphs.visible) {
      const m4 = new THREE.Matrix4(), s3 = new THREE.Vector3();
      gSeed.forEach((G, i) => {
        const f = sat((tl - G.s) / .34), on = f > 0 && f < 1;
        gA[i] = on ? Math.sin(f * Math.PI) * .95 : 0;
        if (!on) { m4.makeScale(0, 0, 0); glyphs.setMatrixAt(i, m4); return; }
        const ty = [236, 268, ROW_Y[0] + 50, ROW_Y[1] + 50, ROW_Y[2] + 50, CTA_Y + 52][G.t];
        const target = sp(120 + (i * 37) % 260, ty, .08).applyMatrix4(phone.matrixWorld);
        v3b.set(phone.position.x + G.x, G.y, phone.position.z - G.z);
        const e = f * f * (3 - 2 * f), c = new THREE.Vector3((v3b.x + target.x) / 2 + (i % 2 ? .8 : -.8), Math.max(v3b.y, target.y) + 1.2, (v3b.z + target.z) / 2);
        v3.set(0, 0, 0).addScaledVector(v3b, (1 - e) * (1 - e)).addScaledVector(c, 2 * e * (1 - e)).addScaledVector(target, e * e);
        s3.setScalar(lerp(.5, .06, e)); m4.compose(v3, camera.quaternion, s3); glyphs.setMatrixAt(i, m4);
        if ((now / 90 | 0) % 3 === i % 3) gI[i] = (G.g + (now / 120 | 0)) % 64;
      });
      glyphs.instanceMatrix.needsUpdate = true; gGeo.attributes.aA.needsUpdate = true; gGeo.attributes.aI && (gGeo.attributes.aI.needsUpdate = true); gGeo.attributes.aG.needsUpdate = true;
    }
    // the drop: fall, impact, switch on
    const LA = PH ? LOGO_AT.m : LOGO_AT.d, lx = anchor.x + LA[0], lz = anchor.z + LA[1];
    const lk = PH ? LKM : LK, fall = sat(dp / .62), REST = (1456 * lk) / 2 + .002;
    logo.visible = (u >= L.drop.a && dp > .08) || h > 0 || u > L.drop.b;
    let ly = lerp(7.6, REST, Math.pow(fall, 1.6));
    let sqY = 1, sqX = 1;
    if (dp > .62) { const b = sat((dp - .62) / .16), bump = Math.sin(b * Math.PI) * Math.pow(1 - b, .6); sqY = 1 - .16 * bump; sqX = 1 + .09 * bump; ly = REST + (1456 * lk) * (sqY - 1) / 2 + Math.sin(b * Math.PI) * .1 * (1 - b); }
    logo.position.set(lx, ly, lz);
    logo.rotation.set((1 - fall) * .55, -.18 + (1 - fall) * .6 + (PH ? .08 : 0), (1 - fall) * -.3);
    logo.scale.set(lk * sqX, lk * sqY, lk);
    const sw = ss(.7, .8, dp), on = ss(.72, .84, dp), dotK = ss(.78, .9, dp);
    knob.position.x = lerp(KNOB_OFF, KNOB_ON, sw);
    mPill.color.copy(PILL_OFF).lerp(PILL_ON, on); mPill.emissive.copy(EM_ON).multiplyScalar(.55 * on);
    mDot.emissiveIntensity = 1.2 * dotK; knobGlow.intensity = 2.6 * dotK;
    shadow.position.set(lx, .003, lz); { const hgt = ly - REST, sc = 1 + hgt * .22; shadow.scale.set(2.9 * sc, 1.2 * sc, 1); shadow.material.uniforms.uOp.value = (u >= L.drop.a ? .75 : 0) * Math.exp(-hgt * .3) * (logo.visible ? 1 : 0); }
    const shaftK = ss(.3, 1, lp('hush', u)) * (1 - ss(.66, .95, dp) * .7);
    shaft.position.set(lx, 7, lz); shaftU.uOp.value = shaftK; pool.position.set(lx, .004, lz); poolU.uOp.value = shaftK * .9 + ss(.62, .7, dp) * (1 - ss(.7, 1, dp)) * .8;
    const rk = sat((dp - .62) / .38);
    ring.visible = dp > .62 && rk < 1; ring.position.set(lx, .006, lz); ring.scale.setScalar(.2 + rk * 13); ringU.uOp.value = Math.pow(1 - rk, 1.6) * 1.4;
    floorU.uImp.value.set(lx, lz); floorU.uRing.value = rk * 15; floorU.uRingA.value = dp > .62 ? Math.pow(1 - rk, 1.3) : 0;
    // time-based impact effects, only when crossing it going forward
    if (prevDrop < .62 && dp >= .62 && uT > uS - .002 && ready) { shakeT = now; fxAt = now; burstU.uO.value.set(lx, .05, lz); flash.style.transition = 'none'; flash.style.opacity = '.42'; requestAnimationFrame(() => { flash.style.transition = 'opacity .45s cubic-bezier(.16,1,.3,1)'; flash.style.opacity = '0'; }); }
    prevDrop = dp;
    if (fxAt >= 0) { const age = (now - fxAt) / 1000; burstU.uAge.value = age; burst.visible = age < 1.4; if (age >= 1.4) fxAt = -1; } else burst.visible = false;
    // world-wide uniforms
    const fade = 1 - ss(0, .5, h);
    floorU.uTime.value = t; floorU.uCam.value.copy(camera.position); floorU.uOp.value = fade; floorU.uDim.value = 1 - dim * .75;
    floorU.uAcc.value.set(u > L.drop.a + .02 ? '#C8FF2E' : acc);
    floor.position.set(camera.position.x, 0, camera.position.z - 30);
    cellMat.uniforms.uTime.value = t; cellMat.uniforms.uCam.value.copy(camera.position); cellMat.uniforms.uOp.value = fade; cellMat.uniforms.uDim.value = 1 - dim * .8;
    const rainOp = fade * (1 - dim * .8) * (1 + ss(0, .3, tl) * (1 - ss(.7, 1, tl)) * .8);
    [[rainA, 36, 0, 15.5], [rainB, 52, 8, 21]].forEach(([m, dz, dx, y]) => { m.position.set(camera.position.x * .6 + dx, y, camera.position.z - dz); m.material.uniforms.uTime.value = t; m.material.uniforms.uOp.value = rainOp; });
    dustU.uTime.value = t; dustU.uCam.value.copy(camera.position); dustU.uOp.value = fade; dustU.uPx.value = renderer.getPixelRatio() * (VH / 900);
    burstU.uPx.value = dustU.uPx.value;
    accL.color.set(acc); accL.position.set(phone.position.x + .5, phone.position.y + .6, phone.position.z + 1.1); accL.intensity = 2.2 * (1 - dim * .7) + live * 1.5;
    screenMat.color.setScalar(lerp(.82, 1.08, Math.max(live, 1 - dim)) * (u < L.color.a ? .9 : 1));
    // hand-off: the ground dissolves into the hero's lattice, the world leaves with the page, the logo flies to the header
    stage.style.backgroundColor = 'rgba(5,5,7,' + (1 - ss(0, .55, h)).toFixed(3) + ')';
    canvas.style.transform = h > 0 ? 'translate3d(0,' + (-h * innerHeight).toFixed(1) + 'px,0)' : '';
    hud.style.transform = canvas.style.transform;
    phone.visible = h < .85;
    if (h > 0 && brand) {
      const r = brand.getBoundingClientRect(), e = ss(.12, .92, h), d = 3;
      const ndcX = ((r.left + r.width / 2) / VW) * 2 - 1, ndcY = -(((r.top + r.height / 2) + h * innerHeight) / VH) * 2 + 1;
      v3.set(ndcX, ndcY, .5).unproject(camera).sub(camera.position).normalize();
      const fwd = v3b.set(0, 0, -1).applyQuaternion(camera.quaternion), cosA = v3.dot(fwd);
      const pos = camera.position.clone().addScaledVector(v3, d / cosA);
      const wpp = (2 * d * Math.tan(camera.fov * Math.PI / 360)) / VH, sc = (r.width * wpp) / 6194;
      logo.position.lerp(pos, e);
      const qa = new THREE.Quaternion().setFromEuler(logo.rotation); qa.slerp(camera.quaternion, e); logo.quaternion.copy(qa);
      logo.scale.set(lerp(logo.scale.x, sc, e), lerp(logo.scale.y, sc, e), lerp(lk, sc, e));
      logo.visible = h < .96;
      brand.style.opacity = ss(.86, .97, h).toFixed(3);
    } else if (brand) brand.style.opacity = (1 - ss(L.hush.a, L.hush.b - .02, u)).toFixed(3);
    // screen state
    const st = { acc, fg: B.accFg, line: u < L.color.a ? '#C8FF2E' : acc, pour, av, avHot: badge.visible, nameN: Math.min(1, nameN), rows, words: Math.min(1, wordsK), live };
    const sig = [acc, pour.toFixed(2), av, st.nameN.toFixed(2), rows.join(','), st.words.toFixed(3), live.toFixed(2), sel].join('|');
    const scrambling = (st.nameN > 0 && st.nameN < 1) || (st.words > 0 && st.words < 1);
    if (dirty || sig !== lastSig || (scrambling && now - lastDraw > 50) || iconLoads) { drawApp(st); lastSig = sig; lastDraw = now; dirty = false; if (iconLoads) { iconLoads = 0; tiles.forEach(T => T.d.draw()); badgeD.draw(); cards.forEach(c => c.d.draw()); } }
    badgeMat.color.set(B.acc); badgeMat.emissive.set(B.acc); ctaMat.color.set(B.acc); ctaMat.emissive.set(B.acc);
    // copy layer
    let scrimO = 0;
    blocks.forEach(b => {
      const [a, z, ri, ro] = windowOf(b.k);
      let o = u < a ? 0 : u > z ? 0 : Math.min(ri > 0 ? sat((u - a) / ri) : 1, ro > 0 ? sat((z - u) / ro) : 1);
      if (b.k === 'fin' || b.k === 'open') o *= 1 - ss(0, .35, h);
      const y = lerp(2, -2, sat((u - a) / Math.max(.001, Math.min(1, z) - a))) * innerHeight / 100;
      if (Math.abs(o - b.o) > .002 || Math.abs(y - b.y) > .3) {
        b.el.style.opacity = o.toFixed(3); b.el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)'; b.o = o; b.y = y;
        const on = o > .5; b.el.classList.toggle('on', on); b.foc.forEach(f => { if (on) f.removeAttribute('tabindex'); else f.setAttribute('tabindex', '-1'); });
      }
      scrimO = Math.max(scrimO, o);
    });
    scrim.style.opacity = scrimO.toFixed(3);
    if (PH) { let bot = 0; blocks.forEach(b => { if (b.o > .02) { const r = b.el.getBoundingClientRect(); bot = Math.max(bot, r.bottom); } }); if (bot) { const v = Math.min(70, Math.round(bot / VH * 100) + 2) + '%'; if (scrim.style.getPropertyValue('--sb') !== v) scrim.style.setProperty('--sb', v); } }
    // rail
    const cur = u < L.color.a ? '' : u < L.name.a ? 'color' : u < L.btns.a ? 'name' : u < L.text.a ? 'btns' : u < L.hush.b ? 'text' : u < L.live.a ? 'drop' : 'live';
    let seen = true;
    railBtns.forEach(b => { const isCur = b.dataset.leg === cur; if (isCur) seen = false; b.toggleAttribute('aria-current', false); if (isCur) b.setAttribute('aria-current', 'step'); b.classList.toggle('done', seen && cur !== '' && !isCur); });
    $('irail').style.opacity = (1 - ss(0, .3, h)).toFixed(3);
    // HUD: the build reticle and the tag on whatever is flying in
    const build = Math.round(100 * (.2 * Math.min(1, pour) + .1 * (av ? 1 : 0) + .1 * Math.min(1, nameN) + .3 * rows.reduce((s, r) => s + (r >= 1 ? .25 : 0), 0) + .3 * Math.min(1, wordsK)));
    const retO = ss(L.color.a, L.color.a + .03, u) * (1 - ss(L.hush.a, L.hush.a + .03, u)) + ss(.86, .9, dp) * (1 - ss(L.live.a + .02, L.live.b, u));
    hud.style.setProperty('--hud', u > L.drop.a ? '#C8FF2E' : acc);
    if (retO > .01) {
      const R = phoneRect(), pad = 12;
      ret.style.opacity = retO.toFixed(3); ret.style.width = (R.x1 - R.x0 + pad * 2).toFixed(0) + 'px'; ret.style.height = (R.y1 - R.y0 + pad * 2).toFixed(0) + 'px';
      ret.style.transform = 'translate3d(' + (R.x0 - pad).toFixed(1) + 'px,' + (R.y0 - pad).toFixed(1) + 'px,0)';
      const lbl = u > L.drop.a ? 'LIVE · 02:00' : 'BUILD ' + build + '%'; if (retl.textContent !== lbl) retl.textContent = lbl;
    } else ret.style.opacity = '0';
    let tp = null, tl2 = '';
    if (showTiles && cl < .8) { const T = tiles.reduce((m, T) => (!m || T.grp.position.z > m.grp.position.z ? T : m), null); tp = T.grp.position; tl2 = 'COLOR · ' + frontAcc.toUpperCase(); }
    else if (badge.visible) { tp = badge.position; tl2 = 'LOGO · ' + B.letter; }
    else if (active >= 0) { tp = cards[active].grp.position; tl2 = active === 3 ? 'BOOK · CTA' : 'BUTTON ' + (active + 1) + '/4'; }
    else if (glyphs.visible && tl < .9) { v3b.copy(sp(230, 230)).applyMatrix4(phone.matrixWorld); tp = v3b; tl2 = 'TEXT · ' + Math.round(Math.min(1, wordsK) * words(B).reduce((s, x) => s + x[1].length, 0)); }
    else if (logo.visible && dp > .12 && dp < .95 && h === 0) { tp = logo.position; tl2 = sw > .5 ? 'EDON · ON' : 'EDON · OFF'; }
    if (tp && !PH) { const p = project(tp); tag.style.opacity = '1'; tag.style.transform = 'translate3d(' + (p.x + 26).toFixed(1) + 'px,' + (p.y - 34).toFixed(1) + 'px,0)'; if (tag.textContent !== tl2) tag.textContent = tl2; }
    else tag.style.opacity = '0';
    // a compact signature of what actually paints, for the verification harness
    const vs = [phone.position.z.toFixed(1), build, logo.visible ? ly.toFixed(2) : '-', sw.toFixed(2), rk.toFixed(2), Math.round(h * 20), scrimO.toFixed(2)].join('|');
    if (stage.dataset.scVerifyState !== vs) stage.dataset.scVerifyState = vs;
  }

  /* ---------- loop ---------- */
  let uT = 0;
  function read() {
    const y = scrollY;
    uT = sat((y - T0) / (WSUM * UNIT));
    const h = sat((y - (T0 + S - innerHeight)) / innerHeight);
    const past = y >= T0 + S - 1;
    H.classList.toggle('past-intro', past); H.classList.toggle('in-intro', !past);
    return { h, past };
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(64, now - last); last = now;
    const { h, past } = read();
    if (past) { running = false; gone(); return; }
    const kk = 1 - Math.pow(1 - (FINE ? .12 : .2), dt / 16.67);
    uS += (uT - uS) * kk; if (Math.abs(uT - uS) < 1e-5) uS = uT;
    hS = h;
    mxS = lerp(mxS, mx, .05); myS = lerp(myS, my, .05);
    update(uS, hS, now);
    renderer.render(scene, camera);
    if (!ready) { ready = true; stage.classList.add('ready'); H.classList.add('sc-ready'); }
    if (running) raf = requestAnimationFrame(frame);
  }
  // once the world has gone, nothing in it reports as visible and the header logo is the real one again
  function gone() { if (brand) brand.style.opacity = ''; blocks.forEach(b => { if (b.o !== 0) { b.el.style.opacity = '0'; b.o = 0; b.el.classList.remove('on'); b.foc.forEach(f => f.setAttribute('tabindex', '-1')); } }); scrim.style.opacity = '0'; }
  function wake() {
    const past = read().past; if (past) gone();
    const want = !document.hidden && !H.classList.contains('menu') && !past;
    if (want && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!want) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  }
  addEventListener('scroll', wake, { passive: true });
  document.addEventListener('visibilitychange', wake);
  new MutationObserver(wake).observe(H, { attributes: true, attributeFilter: ['class'] });
  let rw = innerWidth, rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (innerWidth !== rw || Math.abs((stage.clientHeight || innerHeight) - VH) > 120) { rw = innerWidth; sizes(); } measure(); wake(); }, 120); });
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); dirty = true; tiles.forEach(T => T.d.draw()); badgeD.draw(); cards.forEach(c => c.d.draw()); });
  // the live demo opens on the business chosen here
  $('igo').addEventListener('click', () => { if (DEMO && DEMO.pick) try { DEMO.pick(BIZ[sel].key); } catch (e) {} });

  sizes(); measure();
  tiles.forEach(T => T.d.draw()); badgeD.draw(); cards.forEach(c => c.d.draw());
  read(); uS = uT;
  renderer.compile(scene, camera);
  window.__edonIntro = { jump() { read(); uS = uT; }, get u() { return uS; } };
  wake();
}

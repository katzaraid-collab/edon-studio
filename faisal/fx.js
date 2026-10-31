/* Visual effects: drifting background leaves, leaf/smoke/emoji bursts. Exposes window.FX. */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makeCanvas(cls, z) {
    var c = document.createElement("canvas");
    c.className = cls;
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:" + z;
    document.body.appendChild(c);
    return c;
  }

  var bg = makeCanvas("fx-bg", 0);
  var fg = makeCanvas("fx-fg", 50);
  var bctx = bg.getContext("2d");
  var fctx = fg.getContext("2d");
  var W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    [bg, fg].forEach(function (c) { c.width = W * DPR; c.height = H * DPR; });
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* A seven-leaflet cannabis leaf centred on its stem base, pointing up. */
  function leaf(ctx, size, color) {
    var n = 7, spread = 0.42;
    ctx.fillStyle = color;
    for (var i = 0; i < n; i++) {
      var k = i - (n - 1) / 2;
      var a = k * spread;
      var len = size * (1 - Math.abs(k) * 0.17);
      var w = len * 0.17;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(w, -len * 0.45, 0, -len);
      ctx.quadraticCurveTo(-w, -len * 0.45, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillRect(-size * 0.025, 0, size * 0.05, size * 0.28);
  }

  /* ---------- ambient background leaves ---------- */
  var ambient = [];
  function seedAmbient() {
    ambient = [];
    var count = Math.round(Math.min(14, Math.max(7, W / 60)));
    for (var i = 0; i < count; i++) {
      ambient.push({
        x: Math.random() * W, y: Math.random() * H,
        s: 18 + Math.random() * 34,
        r: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.004,
        vy: 0.12 + Math.random() * 0.25,
        sway: Math.random() * Math.PI * 2,
        a: 0.05 + Math.random() * 0.07
      });
    }
  }
  seedAmbient();
  window.addEventListener("resize", seedAmbient);

  function drawAmbient(t) {
    bctx.clearRect(0, 0, W, H);
    var color = cssVar("--leaf", "#2F7D45");
    ambient.forEach(function (p) {
      if (!reduce) {
        p.y += p.vy * (high ? 2.2 : 1);
        p.r += p.vr * (high ? 3 : 1);
        if (p.y - p.s > H) { p.y = -p.s; p.x = Math.random() * W; }
      }
      var x = p.x + Math.sin(t / 2400 + p.sway) * 18;
      bctx.save();
      bctx.globalAlpha = p.a;
      bctx.translate(x, p.y);
      bctx.rotate(p.r);
      leaf(bctx, p.s, color);
      bctx.restore();
    });
  }

  /* ---------- foreground particles ---------- */
  var parts = [];
  function burst(x, y, opts) {
    if (reduce) return;
    opts = opts || {};
    var n = opts.n || 28;
    var leafColor = cssVar("--leaf", "#2F7D45");
    var palette = [leafColor, cssVar("--ember", "#E8641E"), leafColor, cssVar("--stamp", "#B4246A")];
    for (var i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      var sp = 4 + Math.random() * 7;
      parts.push({
        kind: opts.emoji ? "emoji" : "leaf",
        emoji: opts.emoji,
        x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        g: 0.18 + Math.random() * 0.08,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.25,
        s: opts.emoji ? 20 + Math.random() * 12 : 14 + Math.random() * 18,
        c: palette[i % palette.length],
        life: 0, max: 70 + Math.random() * 40
      });
    }
  }
  function smoke(x, y, n) {
    if (reduce) return;
    n = n || 9;
    for (var i = 0; i < n; i++) {
      parts.push({
        kind: "smoke",
        x: x + (Math.random() - 0.5) * 6, y: y,
        vx: (Math.random() - 0.5) * 0.7, vy: -0.6 - Math.random() * 0.9,
        g: 0, r: 0, vr: 0,
        s: 6 + Math.random() * 6,
        life: -i * 5, max: 110 + Math.random() * 40
      });
    }
  }
  function ring(x, y) {
    if (reduce) return;
    parts.push({ kind: "ring", x: x, y: y, vx: 0.2, vy: -0.9, g: 0, r: 0, vr: 0, s: 6, life: 0, max: 90 });
  }

  function drawParts() {
    fctx.clearRect(0, 0, W, H);
    var smokeColor = cssVar("--ink-2", "#4C6352");
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life++;
      if (p.life < 0) continue;
      if (p.life > p.max) { parts.splice(i, 1); continue; }
      var k = p.life / p.max;
      p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      fctx.save();
      if (p.kind === "smoke") {
        fctx.globalAlpha = 0.28 * (1 - k);
        fctx.fillStyle = smokeColor;
        fctx.beginPath();
        fctx.arc(p.x + Math.sin(p.life / 12) * 4, p.y, p.s * (1 + k * 3), 0, Math.PI * 2);
        fctx.fill();
      } else if (p.kind === "ring") {
        fctx.globalAlpha = 0.5 * (1 - k);
        fctx.strokeStyle = smokeColor;
        fctx.lineWidth = 3 * (1 - k) + 1;
        fctx.beginPath();
        fctx.ellipse(p.x, p.y, p.s + k * 26, (p.s + k * 26) * 0.45, 0, 0, Math.PI * 2);
        fctx.stroke();
      } else {
        fctx.globalAlpha = 1 - Math.max(0, (k - 0.6) / 0.4);
        fctx.translate(p.x, p.y);
        fctx.rotate(p.r);
        if (p.kind === "emoji") {
          fctx.font = p.s + "px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
          fctx.textAlign = "center"; fctx.textBaseline = "middle";
          fctx.fillText(p.emoji, 0, 0);
        } else {
          leaf(fctx, p.s, p.c);
        }
      }
      fctx.restore();
    }
  }

  var high = false;
  function loop(t) {
    drawAmbient(t);
    drawParts();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function centerOf(el) {
    if (!el) return { x: W / 2, y: H / 2 };
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  window.FX = {
    reduce: reduce,
    burst: burst,
    smoke: smoke,
    ring: ring,
    centerOf: centerOf,
    setHigh: function (v) { high = !!v; }
  };
})();

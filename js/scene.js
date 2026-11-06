/*
  The garden compositor: ONE visible canvas.

  - Every layer is pre-rendered once into a colour canvas (and a grey sketch canvas)
    at display resolution, cover-fit around config.scene.focal.
  - Layers that are not animating are pre-composited into cached "runs"; the stack is
    split at each animating layer so z-order and blend modes stay exact.
  - Animating layers are composited per frame through a low-res watercolour mask built
    from brush stamps that spread outward from an origin.
  - When nothing animates the loop stops completely.
  No pixel readback is ever done on loaded images (keeps file:// working).
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;
  var scene = (G.scene = {});

  var cfg, canvas, dctx;
  var S = 2048;
  var W = 1, H = 1, eff = 1, cssW = 1, cssH = 1;
  var view = { k: 1, ox: 0, oy: 0 };
  var tierName = null, T = null;
  var layers = [];
  var byId = {};
  var mask, mctx, wet, wctx, scrA, actx, scrB, bctx, mW = 1, mH = 1;
  var plan = null, planDirty = true, needsRender = true, built = false;
  var cachePool = {};
  var ticker = null;
  var running = false, last = 0;
  var swayOn = false, planSway = false, swayRendered = 0;
  var tint = { cur: [251, 250, 248], from: null, to: null, s: 1, dur: 1, active: false };
  var stats = (scene.stats = { dts: [], cpus: [], lastCpu: 0 });

  // ---------------------------------------------------------------- tiers
  function tierParams(name) {
    var r = cfg.reveal, p = cfg.perf;
    if (name === 'medium') {
      return { name: name, mode: 'mask', maxDpr: Math.min(1, p.maxDpr), maskScale: Math.min(0.35, r.maskScale),
        stamps: Math.round(r.stamps * 0.7), wetEdge: false };
    }
    if (name === 'crossfade') {
      return { name: name, mode: 'fade', maxDpr: Math.min(1.25, p.maxDpr), maskScale: 0.25, stamps: 0, wetEdge: false };
    }
    return { name: 'high', mode: 'mask', maxDpr: p.maxDpr, maskScale: r.maskScale, stamps: r.stamps, wetEdge: !!r.wetEdge };
  }

  // ---------------------------------------------------------------- tweens
  function tw(v) { return { v: v, from: v, to: v, s: 1, dur: 1, ease: U.ease.linear, active: false }; }
  function tweenTo(t, to, dur, ease) {
    if (Math.abs(t.v - to) < 1e-4) { t.v = to; t.active = false; return; }
    t.from = t.v; t.to = to; t.s = 0; t.dur = Math.max(0.05, dur); t.ease = ease || U.ease.linear; t.active = true;
  }

  function makeLayer(def) {
    return {
      def: def, id: def.id, index: def.index,
      src: null, sketchSrc: null, placeholder: null, missing: false, pending: true,
      color: null, sketch: null,
      sk: tw(0), co: tw(0), pres: tw(1),
      stamps: null, stampSeed: 0, reveals: 0, origin: null, wetAmt: 0, bench: false
    };
  }

  // ---------------------------------------------------------------- sizing
  function computeSize() {
    cssW = canvas.clientWidth || window.innerWidth || 1;
    cssH = canvas.clientHeight || window.innerHeight || 1;
    var r = Math.min(window.devicePixelRatio || 1, T.maxDpr);
    if (cssW * cssH * r * r > cfg.perf.maxCanvasPixels) r = Math.sqrt(cfg.perf.maxCanvasPixels / (cssW * cssH));
    eff = r;
    W = Math.max(1, Math.round(cssW * r));
    H = Math.max(1, Math.round(cssH * r));
    var k = Math.max(W / S, H / S), sw = S * k;
    var ox = U.clamp(W / 2 - cfg.scene.focal[0] * sw, W - sw, 0);
    var oy = U.clamp(H / 2 - cfg.scene.focal[1] * sw, H - sw, 0);
    view = { k: k, ox: ox, oy: oy };
  }

  function realloc() {
    [mask, wet, scrA, scrB].forEach(U.releaseCanvas);
    mW = Math.max(1, Math.round(W * T.maskScale));
    mH = Math.max(1, Math.round(H * T.maskScale));
    if (T.mode === 'mask') {
      mask = U.makeCanvas(mW, mH); mctx = mask.getContext('2d');
      wet = T.wetEdge ? U.makeCanvas(mW, mH) : null; wctx = wet ? wet.getContext('2d') : null;
      scrA = U.makeCanvas(W, H); actx = scrA.getContext('2d');
      scrB = U.makeCanvas(W, H); bctx = scrB.getContext('2d');
    } else {
      mask = wet = scrA = scrB = null; mctx = wctx = actx = bctx = null;
    }
  }

  // Full-size canvas pool, so caches/sketches don't allocate during animations.
  var pool = [];
  function getCanvas() {
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].width === W && pool[i].height === H) {
        var c = pool.splice(i, 1)[0];
        var x = c.getContext('2d');
        x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        x.clearRect(0, 0, W, H);
        return c;
      }
    }
    return U.makeCanvas(W, H);
  }
  function putCanvas(c) {
    if (!c) return;
    if (c.width === W && c.height === H && pool.length < 4) pool.push(c);
    else U.releaseCanvas(c);
  }
  function clearPool() { pool.forEach(U.releaseCanvas); pool = []; }

  function releaseCaches() {
    Object.keys(cachePool).forEach(function (k) { U.releaseCanvas(cachePool[k]); });
    cachePool = {};
    clearPool();
  }

  // ---------------------------------------------------------------- layer sources
  function fullyColored(L) { return L.co.v >= 1 && !L.co.active && !L.bench; }

  function makeSketch(L) {
    var s = getCanvas(), x = s.getContext('2d');
    if (L.sketchSrc) {
      x.drawImage(L.sketchSrc, view.ox, view.oy, S * view.k, S * view.k);
      return s;
    }
    x.drawImage(L.color, 0, 0);
    x.globalCompositeOperation = 'saturation';
    x.fillStyle = '#808080';
    x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(L.color, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(255,255,255,' + cfg.reveal.sketchLighten + ')';
    x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(120,110,104,0.08)'; // a touch of warm graphite
    x.fillRect(0, 0, W, H);
    return s;
  }

  function ensureSketch(L) {
    // Layers that never show a sketch (sketchOn: null) don't need one.
    if (!L.sketch && L.color && (L.def.sketchOn || L.sketchSrc)) L.sketch = makeSketch(L);
  }

  function prepareLayer(L) {
    U.releaseCanvas(L.color); U.releaseCanvas(L.sketch);
    L.color = L.sketch = null;
    if (L.missing || L.pending) return;
    var c = U.makeCanvas(W, H), x = c.getContext('2d');
    try {
      if (L.placeholder) {
        x.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);
        G.placeholders.paint(L.placeholder, x, cfg);
        x.setTransform(1, 0, 0, 1, 0, 0);
      } else if (L.src) {
        x.drawImage(L.src, view.ox, view.oy, S * view.k, S * view.k);
      }
    } catch (e) {
      U.warn('could not draw layer "' + L.id + '"', e);
    }
    L.color = c;
    if (!fullyColored(L)) ensureSketch(L);
  }

  // ---------------------------------------------------------------- reveal stamps
  function originPx(L) {
    var o = L.origin;
    if (o && o.screen) return [o.screen[0] * eff, o.screen[1] * eff];
    if (o && o.scene) return [view.ox + o.scene[0] * view.k, view.oy + o.scene[1] * view.k];
    return [W / 2, H / 2];
  }

  function makeStamps(L) {
    var o = originPx(L);
    var rng = U.rng(L.stampSeed), n = U.noise2D(L.stampSeed + 3);
    var N = Math.max(12, Math.round(T.stamps || 40));
    var cols = Math.max(3, Math.round(Math.sqrt((N * W) / H))), rows = Math.max(3, Math.round(N / cols));
    var cw = W / cols, ch = H / rows, cell = Math.sqrt(cw * cw + ch * ch);
    var maxD = 1;
    [[0, 0], [W, 0], [0, H], [W, H]].forEach(function (c) {
      maxD = Math.max(maxD, Math.hypot(c[0] - o[0], c[1] - o[1]));
    });
    var set = G.brushes.forLayer(L.def.brush);
    var st = [];
    function add(x, y, t0, dur, size) {
      var ang = Math.atan2(y - o[1], x - o[0]) + (rng() - 0.5) * 0.9;
      st.push({
        x: x, y: y, t0: t0, dur: dur, size: size, ex: 1.1 + rng() * 0.6,
        cos: Math.cos(ang), sin: Math.sin(ang),
        img: set[Math.floor(rng() * set.length)] || set[0], a: 0.78 + rng() * 0.22
      });
    }
    // A few seed blots right at the origin: the first drop of pigment.
    for (var i = 0; i < 5; i++) {
      add(o[0] + (rng() - 0.5) * cell * 0.5, o[1] + (rng() - 0.5) * cell * 0.5, rng() * 0.03, 0.26 + rng() * 0.1, cell * (0.8 + rng() * 0.5));
    }
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = (c + rng()) * cw, y = (r + rng()) * ch;
        var nd = Math.hypot(x - o[0], y - o[1]) / maxD;
        // Noise warps the arrival time so the front grows organic "fingers".
        var warp = (n.fbm((x / W) * 2.5, (y / H) * 2.5, 3) - 0.5) * 0.3;
        var t0 = U.clamp(Math.pow(nd, 0.9) * 0.62 + warp + rng() * 0.05, 0.01, 0.7);
        // Long, overlapping growth so the front moves continuously instead of in steps.
        add(x, y, t0, 0.24 + rng() * 0.14, cell * (1.3 + rng() * 0.7));
      }
    }
    st.sort(function (a, b) { return a.t0 - b.t0; });
    return st;
  }

  function buildMask(L, p) {
    // Wet edge only while paint is spreading, not while it drains.
    var ms = mW / W, useWet = !!wctx && (L.bench || L.co.to > L.co.from);
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.globalAlpha = 1;
    mctx.clearRect(0, 0, mW, mH);
    if (useWet) { wctx.setTransform(1, 0, 0, 1, 0, 0); wctx.globalAlpha = 1; wctx.clearRect(0, 0, mW, mH); }
    var wetSum = 0, st = L.stamps;
    for (var i = 0; i < st.length; i++) {
      var s = st[i];
      var u = (p - s.t0) / s.dur;
      if (u <= 0) break; // sorted by t0: nothing later has started either
      if (u > 1) u = 1;
      // Every stamp starts small and fully transparent: nothing ever pops in.
      var g = U.ease.outCubic(u);
      var a = U.smoothstep(0, 0.55, u) * s.a;
      var sy = s.size * (0.15 + 0.85 * g) * ms, sx = sy * s.ex;
      var e = s.x * ms, f = s.y * ms;
      mctx.globalAlpha = a;
      mctx.setTransform(s.cos * sx, s.sin * sx, -s.sin * sy, s.cos * sy, e, f);
      mctx.drawImage(s.img, -0.5, -0.5, 1, 1);
      if (useWet && u < 1) {
        var wa = Math.sin(Math.PI * u) * a * 0.8; // rises and dries back smoothly
        wetSum += wa;
        wctx.globalAlpha = wa;
        wctx.setTransform(s.cos * sx, s.sin * sx, -s.sin * sy, s.cos * sy, e, f);
        wctx.drawImage(s.img, -0.5, -0.5, 1, 1);
      }
    }
    // Close any remaining gaps softly near the end, so settling never pops.
    var flood = U.smoothstep(0.84, 1, p);
    if (flood > 0) {
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.globalAlpha = flood;
      mctx.fillStyle = '#fff';
      mctx.fillRect(0, 0, mW, mH);
    }
    L.wetAmt = wetSum;
  }

  // ---------------------------------------------------------------- compositing
  function isAnimating(L) { return L.bench || L.sk.active || L.co.active || L.pres.active; }

  // ---- wind in the tree: layers with `sway` are drawn live with a slow lean ----
  // A horizontal skew around the top of the trunk: the higher a point, the further it
  // leans. Canvas draws at sub-pixel positions, so the motion stays smooth.
  var SWAY_FPS_MS = 33; // while only the wind moves, redraw at ~30 fps to save battery
  function swaying(L) {
    return swayOn && L.def.sway > 0 && !L.bench && !!L.color && (L.co.v > 0 || (L.sk.v > 0 && !!L.sketch));
  }
  function swayAmount(now) {
    var t = now / 1000;
    // two slow waves together feel like gentle, uneven gusts
    return cfg.fx.sway * (0.62 * Math.sin(t * 2 * Math.PI / 6.8) + 0.38 * Math.sin(t * 2 * Math.PI / 3.1 + 1.3));
  }
  function applySway(x, L) {
    var k = swayAmount(performance.now()) * L.def.sway;
    var py = view.oy + cfg.fx.swayPivot[1] * view.k;
    x.setTransform(1, 0, k, 1, -k * py, 0);
  }

  function settledKey(L) {
    if (!L.color) return null;
    if (L.co.v >= 1) return 'c';
    if (L.sk.v > 0 && L.sketch) return 's' + L.sk.v.toFixed(3);
    return null;
  }

  function drawSettled(x, L) {
    var a = L.pres.v * L.def.opacity;
    if (L.co.v >= 1) { x.globalAlpha = a; x.drawImage(L.color, 0, 0); }
    else if (L.sk.v > 0 && L.sketch) { x.globalAlpha = a * L.sk.v * cfg.reveal.sketchOpacity; x.drawImage(L.sketch, 0, 0); }
  }

  function buildPlan() {
    var items = [], run = null;
    layers.forEach(function (L) {
      if (isAnimating(L) || swaying(L)) { run = null; if (L.color) items.push({ anim: L }); return; }
      var k = settledKey(L);
      if (!k) return; // invisible layers don't split runs
      // Grey sketches always sit IN the paper (multiply); colour uses the layer's blend.
      var blend = k === 'c' ? L.def.blend : 'multiply';
      if (!run || run.blend !== blend) { run = { blend: blend, layers: [], parts: [] }; items.push(run); }
      run.layers.push(L);
      run.parts.push(L.id + ':' + k + ':' + L.pres.v.toFixed(2));
    });
    var used = {};
    items.forEach(function (it) {
      if (it.anim) return;
      if (it.layers.length === 1) { it.single = it.layers[0]; return; }
      var key = W + 'x' + H + '|' + it.blend + '|' + it.parts.join(',');
      var c = cachePool[key];
      if (!c) {
        c = getCanvas();
        var x = c.getContext('2d');
        x.globalCompositeOperation = it.blend;
        it.layers.forEach(function (L) { drawSettled(x, L); });
        cachePool[key] = c;
      }
      it.canvas = c;
      used[key] = true;
    });
    Object.keys(cachePool).forEach(function (k) {
      if (!used[k]) { putCanvas(cachePool[k]); delete cachePool[k]; }
    });
    plan = items;
    planSway = items.some(function (it) { return it.anim && swaying(it.anim); });
    planDirty = false;
  }

  function drawAnimating(L) {
    var sw = swaying(L);
    if (sw) applySway(dctx, L);
    drawLayer(L);
    if (sw) dctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawLayer(L) {
    var x = dctx, pres = L.pres.v * L.def.opacity, p = L.co.v;
    var sa = L.sk.v * cfg.reveal.sketchOpacity * pres;
    x.globalCompositeOperation = 'multiply';
    if (p <= 0.0001) {
      if (sa > 0 && L.sketch) { x.globalAlpha = sa; x.drawImage(L.sketch, 0, 0); }
      return;
    }
    if (p >= 0.9999) { x.globalCompositeOperation = L.def.blend; x.globalAlpha = pres; x.drawImage(L.color, 0, 0); return; }
    if (T.mode === 'fade' || !L.stamps || !mctx) {
      if (sa > 0 && L.sketch) { x.globalAlpha = sa * (1 - p); x.drawImage(L.sketch, 0, 0); }
      x.globalCompositeOperation = L.def.blend;
      x.globalAlpha = pres * p; x.drawImage(L.color, 0, 0);
      return;
    }
    buildMask(L, p);
    if (sa > 0 && L.sketch) {
      actx.globalCompositeOperation = 'copy'; actx.globalAlpha = 1;
      actx.drawImage(L.sketch, 0, 0);
      actx.globalCompositeOperation = 'destination-out';
      actx.drawImage(mask, 0, 0, W, H);
      x.globalAlpha = sa; x.drawImage(scrA, 0, 0);
    }
    x.globalCompositeOperation = L.def.blend;
    bctx.globalCompositeOperation = 'copy'; bctx.globalAlpha = 1;
    bctx.drawImage(mask, 0, 0, W, H);
    bctx.globalCompositeOperation = 'source-in';
    bctx.drawImage(L.color, 0, 0);
    x.globalAlpha = pres; x.drawImage(scrB, 0, 0);
    if (wctx && L.wetAmt > 0.01) {
      // Wet edge: the freshest pigment is a little darker, then dries lighter.
      actx.globalCompositeOperation = 'copy'; actx.globalAlpha = 1;
      actx.drawImage(wet, 0, 0, W, H);
      actx.globalCompositeOperation = 'source-in';
      actx.drawImage(L.color, 0, 0);
      x.globalCompositeOperation = 'multiply';
      x.globalAlpha = pres * cfg.reveal.wetStrength;
      x.drawImage(scrA, 0, 0);
    }
  }

  function render() {
    if (!built) return;
    var t0 = performance.now();
    if (planDirty) buildPlan();
    var x = dctx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    x.fillStyle = 'rgb(' + Math.round(tint.cur[0]) + ',' + Math.round(tint.cur[1]) + ',' + Math.round(tint.cur[2]) + ')';
    x.fillRect(0, 0, W, H);
    for (var i = 0; i < plan.length; i++) {
      var it = plan[i];
      if (it.anim) { drawAnimating(it.anim); continue; }
      x.globalCompositeOperation = it.blend;
      if (it.single) drawSettled(x, it.single);
      else { x.globalAlpha = 1; x.drawImage(it.canvas, 0, 0); }
    }
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    stats.lastCpu = performance.now() - t0;
    needsRender = false;
    if (planSway && !running) wake(); // keep the wind going
    return stats.lastCpu;
  }

  // ---------------------------------------------------------------- loop
  function onSettle(L, t) {
    planDirty = true;
    // Free the sketch of a fully coloured layer; it's rebuilt if a drain needs it.
    if (t === L.co && L.co.v >= 1 && !L.bench) { putCanvas(L.sketch); L.sketch = null; }
  }

  function step(t, dt, L) {
    if (!t.active) return false;
    t.s += dt / t.dur;
    if (t.s >= 1) { t.s = 1; t.v = t.to; t.active = false; if (L) onSettle(L, t); }
    else t.v = t.from + (t.to - t.from) * t.ease(t.s);
    return true;
  }

  function update(dt) {
    var sdt = dt * (G.speed || 1);
    var any = false;
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      if (step(L.sk, sdt, L)) any = true;
      if (step(L.co, sdt, L)) any = true;
      if (step(L.pres, dt, L)) any = true;
    }
    if (tint.active) {
      tint.s += sdt / tint.dur;
      if (tint.s >= 1) { tint.s = 1; tint.active = false; }
      var e = U.ease.inOutSine(tint.s);
      for (var c = 0; c < 3; c++) tint.cur[c] = tint.from[c] + (tint.to[c] - tint.from[c]) * e;
      any = true;
    }
    var ticking = ticker ? ticker(sdt) : false;
    return { any: any, ticking: ticking };
  }

  function anyActive() {
    if (tint.active || planSway) return true;
    for (var i = 0; i < layers.length; i++) if (isAnimating(layers[i])) return true;
    return false;
  }

  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    var u = update(dt);
    var windDue = planSway && now - swayRendered >= SWAY_FPS_MS;
    if (u.any || needsRender || windDue) {
      swayRendered = now;
      var cpu = render();
      if (u.any) {
        stats.dts.push(dt * 1000); stats.cpus.push(cpu);
        if (stats.dts.length > 90) { stats.dts.shift(); stats.cpus.shift(); }
      }
    }
    if (anyActive() || u.ticking || needsRender) requestAnimationFrame(frame);
    else running = false;
  }

  function wake() {
    if (running || !built) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  scene.wake = wake;

  scene.renderNow = function () {
    needsRender = true;
    if (running) return;
    render();
  };

  // ---------------------------------------------------------------- build / resize
  function build() {
    computeSize();
    canvas.width = W;
    canvas.height = H;
    dctx = canvas.getContext('2d');
    swayOn = !!(cfg.fx && cfg.fx.sway) && T.mode !== 'fade' && !U.reducedMotion();
    realloc();
    releaseCaches();
    layers.forEach(prepareLayer);
    layers.forEach(function (L) { if (L.stamps) L.stamps = T.mode === 'mask' ? makeStamps(L) : null; });
    built = true;
    planDirty = true;
    render();
  }

  var resizeTimer = null, lastW = 0, lastH = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      // Ignore tiny height changes (mobile toolbars); rebuild on real size changes.
      if (w === lastW && Math.abs(h - lastH) < 100) return;
      lastW = w; lastH = h;
      if (built) build();
    }, 220);
  }

  // ---------------------------------------------------------------- public API
  scene.init = function (cv, config) {
    canvas = cv;
    cfg = config;
    S = cfg.scene.size;
    layers = cfg.layers.map(makeLayer);
    byId = {};
    layers.forEach(function (L) { byId[L.id] = L; });
    var t = G.paper.tintForFired(cfg, []);
    tint.cur = t.slice();
    lastW = canvas.clientWidth; lastH = canvas.clientHeight;
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  };

  scene.setTier = function (name) {
    var next = tierParams(name);
    tierName = next.name;
    T = next;
    build();
  };
  scene.tier = function () { return tierName; };

  // src: { image } | { placeholder } | { missing:true } | { pending:true }, plus optional sketchImage
  function applySource(L, src) {
    L.src = src.image || null;
    L.placeholder = src.placeholder || null;
    L.missing = !!src.missing;
    L.pending = !!src.pending;
    if (src.sketchImage) L.sketchSrc = src.sketchImage;
  }
  scene.setSource = function (id, src) {
    var L = byId[id];
    if (!L) return;
    applySource(L, src);
    if (built) { prepareLayer(L); planDirty = true; scene.renderNow(); }
  };
  // A layer that arrives late fades in softly at whatever state it should be in now.
  scene.provide = function (id, src) {
    var L = byId[id];
    if (!L) return;
    applySource(L, src);
    if (!built) return;
    prepareLayer(L);
    L.pres.v = 0;
    tweenTo(L.pres, 1, 1.0, U.ease.inOutSine);
    planDirty = true;
    wake();
  };
  scene.provideSketch = function (id, img) {
    var L = byId[id];
    if (!L || !img) return;
    L.sketchSrc = img;
    if (built && L.color && L.sketch) { U.releaseCanvas(L.sketch); L.sketch = makeSketch(L); planDirty = true; scene.renderNow(); }
  };

  scene.startSketch = function (idx, dir, durOverride) {
    var L = layers[idx];
    if (!L) return;
    ensureSketch(L);
    var dur = durOverride || L.def.sketchDuration * (dir > 0 ? 1 : 0.8);
    tweenTo(L.sk, dir > 0 ? 1 : 0, dur, U.ease.inOutSine);
    planDirty = true;
    wake();
  };

  function fadeDur(L) { return U.clamp(Math.min(L.def.duration, cfg.reveal.crossfadeDuration), 2, 4); }

  scene.startColor = function (idx, dir, opts) {
    var L = layers[idx];
    if (!L) return;
    opts = opts || {};
    var fade = T && T.mode === 'fade';
    if (dir > 0) {
      if (!L.stamps || L.co.v <= 0.001) {
        L.origin = opts.origin || null;
        L.reveals++;
        L.stampSeed = (U.hash(L.id) + L.reveals * 7919) >>> 0;
        L.stamps = fade ? null : makeStamps(L);
      }
      var d = fade ? fadeDur(L) * (1 - L.co.v) : L.def.duration * (1 - L.co.v);
      tweenTo(L.co, 1, Math.max(0.6, d), fade ? U.ease.inOutSine : U.ease.outSine);
    } else {
      ensureSketch(L);
      if (!L.stamps && !fade) { L.stampSeed = U.hash(L.id) >>> 0; L.stamps = makeStamps(L); }
      var dd = (fade ? fadeDur(L) : L.def.duration * cfg.reveal.drainSlowdown) * L.co.v;
      tweenTo(L.co, 0, Math.max(0.6, dd), U.ease.inOutSine);
    }
    planDirty = true;
    wake();
  };

  // Jump a layer straight to a state (restore / debug), no animation.
  scene.setInstant = function (idx, sk, co) {
    var L = layers[idx];
    if (!L) return;
    L.sk.active = L.co.active = false;
    L.sk.v = sk; L.co.v = co;
    if (co >= 1) { putCanvas(L.sketch); L.sketch = null; }
    else ensureSketch(L);
    planDirty = true;
  };

  scene.setTint = function (rgb, dur) {
    if (!rgb) return;
    if (!dur) { tint.cur = rgb.slice(); tint.active = false; needsRender = true; scene.renderNow(); return; }
    tint.from = tint.cur.slice(); tint.to = rgb.slice(); tint.s = 0; tint.dur = dur; tint.active = true;
    wake();
  };

  scene.setTicker = function (fn) { ticker = fn; };

  scene.layers = function () { return layers; };
  scene.layerState = function (id) {
    var L = byId[id];
    return L ? { sketch: L.sk.v, color: L.co.v, animating: isAnimating(L), pending: L.pending, missing: L.missing } : null;
  };

  scene.screenToScene = function (x, y) {
    return [Math.round((x * eff - view.ox) / view.k), Math.round((y * eff - view.oy) / view.k)];
  };

  scene.info = function () {
    return { W: W, H: H, cssW: cssW, cssH: cssH, eff: eff, mW: mW, mH: mH, tier: tierName, mode: T && T.mode,
      stamps: T && T.stamps, wetEdge: T && T.wetEdge };
  };

  // Rough GPU/canvas memory in MB (4 bytes per pixel per canvas).
  scene.memory = function () {
    var px = W * H; // display
    var layerPx = 0, sketches = 0, caches = 0;
    layers.forEach(function (L) {
      if (L.color) layerPx += L.color.width * L.color.height;
      if (L.sketch) { layerPx += L.sketch.width * L.sketch.height; sketches++; }
    });
    Object.keys(cachePool).forEach(function (k) { caches++; px += cachePool[k].width * cachePool[k].height; });
    if (scrA) px += scrA.width * scrA.height * 2;
    if (mask) px += mask.width * mask.height * (wet ? 2 : 1);
    var brushPx = 0;
    G.brushes.list.forEach(function (b) { brushPx += (b.width || 0) * (b.height || 0); });
    var mb = function (p) { return (p * 4) / 1048576; };
    return { totalMB: mb(px + layerPx + brushPx), layersMB: mb(layerPx), otherMB: mb(px + brushPx), sketches: sketches, caches: caches };
  };

  // ---------------------------------------------------------------- benchmark hooks
  var benchSaved = null;
  scene.bench = {
    begin: function (count) {
      var picked = layers.filter(function (L) { return L.color; }).slice(0, count || 3);
      benchSaved = picked.map(function (L) {
        ensureSketch(L);
        var saved = { L: L, sk: L.sk.v, co: L.co.v, stamps: L.stamps, origin: L.origin, seed: L.stampSeed };
        L.bench = true;
        L.sk.v = 1;
        L.origin = null;
        L.stampSeed = U.hash('bench' + L.id);
        L.stamps = T.mode === 'mask' ? makeStamps(L) : null;
        return saved;
      });
      planDirty = true;
      return picked.length;
    },
    frame: function (p) {
      benchSaved.forEach(function (s) { s.L.co.v = p; });
      return render();
    },
    end: function () {
      if (!benchSaved) return;
      benchSaved.forEach(function (s) {
        var L = s.L;
        L.bench = false; L.sk.v = s.sk; L.co.v = s.co; L.stamps = s.stamps; L.origin = s.origin; L.stampSeed = s.seed;
        if (L.co.v >= 1) { U.releaseCanvas(L.sketch); L.sketch = null; }
      });
      benchSaved = null;
      planDirty = true;
      render();
    }
  };
})();

/*
  Procedural watercolour garden, one painter per layer.
  Painters draw in art coordinates (config.scene.size, 2048 by default); the
  scene passes a context already transformed to the screen, so the result is sharp.
  Everything is painted once (at load / resize), never per frame.

  Watercolour tricks used here, all with plain canvas operations:
  - washes: several slightly shifted translucent fills, so edges are soft and uneven
  - pigment pooling: a darker rim just inside each shape's edge
  - backruns / lifts: pale spots taken out of a wash (destination-out)
  - wet-in-wet: gradients that fade a shape out or darken it toward one side
  - granulation: a speckle texture over each layer, so the paper shows through

  Replace any layer with real art by changing its `image` path in config.js.
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;

  // ---- colour helpers --------------------------------------------------------
  function mix(a, b, t) {
    var x = U.hexToRgb(a), y = U.hexToRgb(b);
    return '#' + [0, 1, 2].map(function (i) {
      var v = Math.round(x[i] + (y[i] - x[i]) * t);
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }
  var INK = '#3e3a44';
  function darker(c, t) { return mix(c, INK, t === undefined ? 0.35 : t); }

  // ---- shape helpers ----------------------------------------------------------
  function path(ctx, pts) {
    ctx.beginPath();
    var n = pts.length;
    var s = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
    ctx.moveTo(s[0], s[1]);
    for (var i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  }

  function jitter(pts, rng, amt) {
    return pts.map(function (p) { return [p[0] + (rng() - 0.5) * amt, p[1] + (rng() - 0.5) * amt]; });
  }

  function bbox(pts) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    pts.forEach(function (p) {
      if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1];
      if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1];
    });
    return b;
  }

  function blob(cx, cy, rx, ry, noise, seed, rough, count) {
    var pts = [], n = count || 36;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var k = 1 + (noise.fbm(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4 + seed, 3) - 0.5) * (rough || 0.5) * 2;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }

  // Ridge line from left to right, closed down to `bottom`.
  function ridge(y0, amp, freq, noise, seed, bottom, x0, x1) {
    x0 = x0 === undefined ? -80 : x0; x1 = x1 === undefined ? 2130 : x1;
    var pts = [];
    for (var x = x0; x <= x1; x += 40) {
      pts.push([x, y0 + (noise.fbm(x * freq + seed, seed, 4) - 0.5) * amp * 2]);
    }
    pts.push([x1, bottom], [x0, bottom]);
    return pts;
  }

  // Soft elliptical spot (radial gradient), optionally with a composite op.
  function spot(ctx, x, y, rx, ry, color, alpha, op) {
    ctx.save();
    if (op) ctx.globalCompositeOperation = op;
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, U.rgba(color, alpha));
    g.addColorStop(0.55, U.rgba(color, alpha * 0.55));
    g.addColorStop(1, U.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  /*
    One watercolour wash.
      passes    number of shifted fills (soft, uneven edge)
      jitter    how far each pass wanders (art px)
      color2    second pigment mixed into alternate passes
      rim       pigment pooling strength at the edge (0 = none)
      rimWidth  how far the dark rim reaches inward (art px)
      lifts     pale backruns lifted out of the wash
      fade      0..1: wet-in-wet fade toward `fadeTo` ('down' | 'up' | 'left' | 'right')
      shade     0..1: darker pigment settling toward `shadeTo`
  */
  function wash(ctx, pts, color, alpha, rng, o) {
    o = o || {};
    var passes = o.passes || 4, amt = o.jitter === undefined ? 14 : o.jitter;
    for (var i = 0; i < passes; i++) {
      var col = o.color2 && i % 2 ? o.color2 : color;
      ctx.fillStyle = U.rgba(col, (alpha / passes) * 1.7);
      path(ctx, jitter(pts, rng, amt));
      ctx.fill();
    }
    var rim = o.rim === undefined ? 1 : o.rim;
    if (!rim && !o.lifts && !o.fade && !o.shade) return;

    var b = bbox(pts), bw = b[2] - b[0], bh = b[3] - b[1];
    ctx.save();
    path(ctx, pts);
    ctx.clip();
    ctx.globalCompositeOperation = 'source-atop';

    if (o.shade) {
      var sg = gradientAcross(ctx, b, o.shadeTo || 'down');
      var dk = darker(o.shadeColor || color, 0.3);
      sg.addColorStop(0, U.rgba(dk, 0));
      sg.addColorStop(0.5, U.rgba(dk, 0));
      sg.addColorStop(1, U.rgba(dk, alpha * o.shade));
      ctx.fillStyle = sg;
      ctx.fillRect(b[0] - 20, b[1] - 20, bw + 40, bh + 40);
    }
    if (rim) {
      var rw = o.rimWidth || 26, dc = darker(o.rimColor || color, 0.25);
      ctx.lineJoin = 'round';
      [[1, 0.05], [0.55, 0.07], [0.22, 0.12]].forEach(function (s) {
        ctx.strokeStyle = U.rgba(dc, Math.min(1, s[1] * rim * (0.6 + alpha)));
        ctx.lineWidth = rw * s[0] * 2;
        path(ctx, pts);
        ctx.stroke();
      });
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (var k = 0; k < (o.lifts || 0); k++) {
      var lr = Math.min(bw, bh) * (0.18 + rng() * 0.25) + 8;
      spot(ctx, b[0] + bw * (0.15 + rng() * 0.7), b[1] + bh * (0.15 + rng() * 0.7), lr * (1 + rng()), lr, '#000000', 0.22 + rng() * 0.18);
    }
    if (o.fade) {
      var fg = gradientAcross(ctx, b, o.fadeTo || 'down');
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(1, 'rgba(0,0,0,' + o.fade + ')');
      ctx.fillStyle = fg;
      ctx.fillRect(b[0] - 20, b[1] - 20, bw + 40, bh + 40);
    }
    ctx.restore();
  }

  function gradientAcross(ctx, b, dir) {
    if (dir === 'up') return ctx.createLinearGradient(0, b[3], 0, b[1]);
    if (dir === 'left') return ctx.createLinearGradient(b[2], 0, b[0], 0);
    if (dir === 'right') return ctx.createLinearGradient(b[0], 0, b[2], 0);
    return ctx.createLinearGradient(0, b[1], 0, b[3]);
  }

  // Tapered brush stroke along a quadratic curve, filled as one shape (no joints).
  function taper(ctx, x0, y0, cx, cy, x1, y1, w0, w1, color, alpha) {
    var steps = 14, L = [], R = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps, u = 1 - t;
      var x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      var y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      var dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
      var len = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) / 2;
      L.push([x - (dy / len) * w, y + (dx / len) * w]);
      R.unshift([x + (dy / len) * w, y - (dx / len) * w]);
    }
    var pts = L.concat(R);
    ctx.fillStyle = U.rgba(color, alpha);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    ctx.fill();
  }

  // ---- granulation texture (screen space, generated once) --------------------
  var tex = null;
  function textures() {
    if (tex) return tex;
    var size = 192, r = U.rng(777);
    function tile(fn) {
      var c = U.makeCanvas(size, size), x = c.getContext('2d');
      var img = x.createImageData(size, size), d = img.data;
      for (var y = 0, p = 0; y < size; y++) {
        for (var xx = 0; xx < size; xx++, p += 4) {
          var a = fn(xx, y);
          d[p] = d[p + 1] = d[p + 2] = 0;
          d[p + 3] = U.clamp(a, 0, 1) * 255;
        }
      }
      x.putImageData(img, 0, 0);
      return c;
    }
    // Scattered specks only: any smooth noise here would show as a repeating pattern.
    tex = {
      // pale paper tooth showing through the paint
      lift: tile(function () {
        var s = r();
        return s > 0.982 ? 0.22 + r() * 0.25 : s * 0.06;
      }),
      // dark pigment grains settling in the paper
      grain: tile(function () {
        var s = r();
        return s > 0.975 ? 0.18 + r() * 0.3 : 0;
      })
    };
    return tex;
  }

  function granulate(ctx, strength) {
    var t = textures(), c = ctx.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.55 * strength;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = ctx.createPattern(t.lift, 'repeat');
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalAlpha = 0.35 * strength;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = ctx.createPattern(t.grain, 'repeat');
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
  }

  // ---- painters ------------------------------------------------------------
  var P = {};

  P.sky = function (ctx, c, r, n) {
    var g = ctx.createLinearGradient(0, 0, 0, 1180);
    g.addColorStop(0, U.rgba(c.skyTop, 0.7));
    g.addColorStop(0.42, U.rgba(c.sky, 0.46));
    g.addColorStop(0.78, U.rgba(c.skyWarm, 0.34));
    g.addColorStop(1, U.rgba(c.skyWarm, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, 2170, 1260);
    // wet-in-wet: deeper blue blooms high up
    for (var i = 0; i < 6; i++) {
      spot(ctx, r() * 2048, 40 + r() * 330, 260 + r() * 300, 90 + r() * 80, c.skyTop, 0.22 + r() * 0.12);
    }
    // clouds lifted out with a tissue, each with a soft grey-blue belly
    for (var k = 0; k < 6; k++) {
      var x = 120 + r() * 1800, y = 230 + r() * 520, rx = 220 + r() * 300, ry = 46 + r() * 50;
      var pts = blob(x, y, rx, ry, n, k * 3.7, 0.4, 44);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      for (var p = 0; p < 3; p++) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        path(ctx, jitter(pts, r, 34));
        ctx.fill();
      }
      ctx.restore();
      spot(ctx, x + rx * 0.1, y + ry * 0.7, rx * 0.8, ry * 0.5, darker(c.sky, 0.2), 0.16);
    }
  };

  P.horizon = function (ctx, c, r, n) {
    ctx.lineCap = 'round';
    for (var pass = 0; pass < 3; pass++) {
      ctx.strokeStyle = U.rgba(c.waterDeep, 0.22 - pass * 0.05);
      ctx.lineWidth = 3 + pass * 2;
      ctx.beginPath();
      for (var x = -40; x <= 2090; x += 32) {
        var y = 1085 + (n.fbm(x * 0.004 + pass, 3, 2) - 0.5) * 10;
        if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };

  P.farHills = function (ctx, c, r, n) {
    // misty, bluish, fading toward the water (atmospheric distance)
    wash(ctx, ridge(915, 100, 0.0015, n, 11, 1100), mix(c.hillFar, c.sky, 0.25), 0.4, r,
      { jitter: 18, rim: 0.9, rimWidth: 30, fade: 0.55, lifts: 2, color2: c.hillFar2 });
    wash(ctx, ridge(1000, 62, 0.0022, n, 37, 1100), c.hillFar2, 0.4, r,
      { jitter: 14, rim: 1, rimWidth: 24, fade: 0.4, lifts: 2 });
  };

  P.water = function (ctx, c, r, n) {
    var top = [], bot = [];
    for (var x = 140; x <= 1920; x += 40) {
      var t = (x - 140) / 1780;
      top.push([x, 1095 + (n(x * 0.01, 1) - 0.5) * 8]);
      bot.push([x, 1110 + Math.sin(t * Math.PI) * (110 + n(x * 0.006, 5) * 60)]);
    }
    var pts = top.concat(bot.reverse());
    wash(ctx, pts, c.water, 0.52, r, { jitter: 8, color2: c.waterDeep, rim: 1.1, rimWidth: 20, shade: 0.5, shadeTo: 'down', lifts: 1 });
    ctx.save();
    path(ctx, pts);
    ctx.clip();
    ctx.lineCap = 'round';
    // dark ripples
    for (var i = 0; i < 24; i++) {
      var y = 1112 + r() * 150, x0 = 260 + r() * 1350, len = 60 + r() * 240;
      ctx.strokeStyle = U.rgba(c.waterDeep, 0.1 + r() * 0.14);
      ctx.lineWidth = 2 + r() * 4;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + len, y + (r() - 0.5) * 4); ctx.stroke();
    }
    // light glints lifted out (toward the warm light, upper right)
    ctx.globalCompositeOperation = 'destination-out';
    for (var j = 0; j < 18; j++) {
      var gy = 1102 + r() * 90, gx = 900 + r() * 900, gl = 30 + r() * 140;
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.35 + r() * 0.35) + ')';
      ctx.lineWidth = 2 + r() * 3;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gl, gy + (r() - 0.5) * 3); ctx.stroke();
    }
    ctx.restore();
  };

  P.nearHills = function (ctx, c, r, n) {
    var left = [];
    // Slopes run past the bottom of the art, so no shape ever ends in a vertical edge.
    for (var x = -80; x <= 1700; x += 40) {
      var t = (x + 80) / 1230;
      left.push([x, Math.min(2200, 1120 + t * t * 520 + (n.fbm(x * 0.004, 9, 3) - 0.5) * 60)]);
    }
    left.push([1700, 2200], [-80, 2200]);
    wash(ctx, left, c.hillNear, 0.5, r, { jitter: 16, rim: 1, rimWidth: 34, fade: 0.3, lifts: 3, color2: mix(c.hillNear, c.grass, 0.5) });
    var right = [];
    for (var x2 = 280; x2 <= 2130; x2 += 40) {
      var t2 = (2130 - x2) / 1270;
      right.push([x2, Math.min(2200, 1180 + t2 * t2 * 470 + (n.fbm(x2 * 0.004, 21, 3) - 0.5) * 60)]);
    }
    right.push([2130, 2200], [280, 2200]);
    wash(ctx, right, c.hillNear2, 0.44, r, { jitter: 16, rim: 1.1, rimWidth: 34, fade: 0.25, lifts: 3, shade: 0.35, shadeTo: 'right' });
  };

  // Tree geometry shared by trunk and canopy (so branches reach into the leaves).
  var TREE = { x: 1105, base: 1440, top: 700 };

  P.trunk = function (ctx, c, r, n) {
    var dark = c.trunkDark || darker(c.trunk, 0.3);
    // spine with a gentle S-curve; tapered, with a flared base
    var L = [], R = [], steps = 16;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var y = TREE.base + (TREE.top - TREE.base) * t;
      var cx = TREE.x + Math.sin(t * 2.6 + 0.4) * 16 - t * 6;
      var w = 30 * (1 - t) + 10 + Math.pow(1 - t, 6) * 46; // flare near the ground
      L.push([cx - w, y]);
      R.unshift([cx + w * 1.05, y]);
    }
    var pts = L.concat(R);
    wash(ctx, pts, c.trunk, 0.74, r, { jitter: 4, passes: 4, color2: dark, rim: 1.3, rimWidth: 12, shade: 0.8, shadeTo: 'right', lifts: 1 });
    // roots
    taper(ctx, TREE.x - 48, 1410, TREE.x - 66, 1432, TREE.x - 84, 1462, 28, 3, c.trunk, 0.42);
    taper(ctx, TREE.x + 50, 1410, TREE.x + 70, 1430, TREE.x + 92, 1458, 26, 3, dark, 0.38);
    // shadow on the grass
    spot(ctx, TREE.x + 30, 1450, 190, 26, darker(c.grass, 0.4), 0.28);
    // bark: a few dry vertical strokes
    for (var b = 0; b < 9; b++) {
      var bx = TREE.x + (r() - 0.5) * 40, by = 900 + r() * 480;
      taper(ctx, bx, by, bx + (r() - 0.5) * 8, by + 40, bx + (r() - 0.5) * 6, by + 70 + r() * 60, 3, 1, dark, 0.2 + r() * 0.15);
    }
    // branches: asymmetric, reaching into the canopy masses
    var br = [
      [TREE.x - 2, 930, 980, 860, 860, 700, 22, 5],
      [TREE.x + 4, 880, 1250, 800, 1350, 640, 20, 5],
      [TREE.x, 800, 1060, 660, 1010, 520, 15, 4],
      [TREE.x + 8, 760, 1180, 640, 1230, 500, 13, 3],
      [TREE.x + 10, 1000, 1300, 960, 1440, 860, 12, 3],
      [960, 760, 900, 690, 840, 640, 6, 2]
    ];
    br.forEach(function (q, idx) {
      taper(ctx, q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], idx % 2 ? dark : c.trunk, 0.55);
      taper(ctx, q[0], q[1], q[2] + 6, q[3] + 4, q[4] + 3, q[5] + 2, q[6] * 0.5, q[7] * 0.6, dark, 0.25);
    });
  };

  P.canopy = function (ctx, c, r, n) {
    var cols = [c.leaf, c.leaf2, c.leaf3], dark = c.leafDark || darker(c.leaf3, 0.3);
    // a few big irregular masses: heavier on the left, a lifted crown on the right
    var masses = [
      [870, 650, 240, 175], [1060, 500, 290, 200], [1320, 560, 230, 170],
      [1190, 740, 260, 140], [930, 810, 180, 105], [1460, 690, 150, 110], [1250, 380, 170, 120]
    ];
    masses.forEach(function (m, i) {
      wash(ctx, blob(m[0], m[1], m[2], m[3], n, i * 2.3 + 1, 0.42, 56), cols[i % 3], 0.4, r, {
        jitter: 18, passes: 4, color2: cols[(i + 1) % 3], rim: 1, rimWidth: 30,
        shade: 0.8, shadeTo: 'down', shadeColor: dark, lifts: 2
      });
    });
    // soft leaf clusters on the edges break up the round silhouettes
    for (var k = 0; k < 90; k++) {
      var m2 = masses[k % masses.length], a = r() * Math.PI * 2, d = 0.8 + r() * 0.22;
      var x = m2[0] + Math.cos(a) * m2[2] * d, y = m2[1] + Math.sin(a) * m2[3] * d;
      var rad = 22 + r() * 30;
      ctx.fillStyle = U.rgba(k % 4 === 0 ? dark : cols[k % 3], 0.1 + r() * 0.12);
      path(ctx, blob(x, y, rad, rad * (0.6 + r() * 0.3), n, 50 + k * 1.3, 0.45, 12));
      ctx.fill();
    }
    // sunlit highlights toward the warm light (upper right)
    for (var h = 0; h < 7; h++) {
      var mm = masses[h];
      spot(ctx, mm[0] + mm[2] * 0.3, mm[1] - mm[3] * 0.35, mm[2] * 0.45, mm[3] * 0.3, '#000000', 0.22, 'destination-out');
    }
  };

  P.grass = function (ctx, c, r, n) {
    wash(ctx, ridge(1290, 50, 0.003, n, 51, 2130), c.grass, 0.42, r, { jitter: 20, rim: 0.9, rimWidth: 30, fade: 0.2, lifts: 4, color2: mix(c.grass, c.hillNear2, 0.4) });
    ctx.lineCap = 'round';
    for (var i = 0; i < 460; i++) {
      var x = r() * 2100 - 26, y = 1300 + Math.pow(r(), 0.8) * 760;
      var h = 26 + r() * 60 * (0.5 + (y - 1300) / 760), lean = (r() - 0.5) * 40;
      ctx.strokeStyle = U.rgba(i % 3 ? c.blade : c.hillNear2, 0.16 + r() * 0.18);
      ctx.lineWidth = 2 + r() * 4;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h);
      ctx.stroke();
    }
  };

  P.flowers = function (ctx, c, r, n) {
    var cols = [c.rose, c.coral, c.ochre, c.rose];
    for (var i = 0; i < 46; i++) {
      var cx = r() * 2048, cy = 1310 + Math.pow(r(), 0.9) * 640;
      var col = cols[i % cols.length], k = 0.6 + (cy - 1310) / 640;
      var count = 2 + Math.floor(r() * 4);
      // a short stem under each cluster
      taper(ctx, cx, cy + 50 * k, cx + (r() - 0.5) * 16, cy + 25 * k, cx, cy, 4 * k, 2 * k, c.blade, 0.3);
      for (var j = 0; j < count; j++) {
        var x = cx + (r() - 0.5) * 70 * k, y = cy + (r() - 0.5) * 40 * k, rad = (9 + r() * 14) * k;
        wash(ctx, blob(x, y, rad, rad * 0.85, n, i * 5 + j, 0.3, 14), col, 0.62, r, { jitter: 3, passes: 3, rim: 1.2, rimWidth: rad * 0.35 });
        if (j === 0) spot(ctx, x, y, rad * 0.35, rad * 0.3, darker(col, 0.4), 0.45);
      }
    }
    fallenPetals(ctx, c);
  };

  // petals that have fallen on the grass (part of the flowers layer, so they don't sway)
  function fallenPetals(ctx, c) {
    var r = U.rng(9090);
    for (var k = 0; k < 18; k++) {
      ctx.save();
      ctx.translate(800 + r() * 700, 1300 + r() * 300);
      ctx.rotate(r() * Math.PI);
      ctx.fillStyle = U.rgba(c.blossom, 0.45);
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  P.petals = function (ctx, c, r, n) {
    for (var i = 0; i < 60; i++) {
      var a = r() * Math.PI * 2, d = Math.sqrt(r());
      var x = 1110 + Math.cos(a) * d * 420, y = 610 + Math.sin(a) * d * 270, rad = 10 + r() * 16;
      wash(ctx, blob(x, y, rad, rad * 0.8, n, i * 1.9, 0.3, 14), c.blossom, 0.58, r, { jitter: 3, passes: 3, rim: 1.2, rimWidth: rad * 0.35 });
    }
  };

  P.light = function (ctx, c) {
    var g = ctx.createRadialGradient(1500, 380, 40, 1500, 380, 1400);
    g.addColorStop(0, U.rgba(c.light, 0.42));
    g.addColorStop(0.35, U.rgba(c.light, 0.18));
    g.addColorStop(1, U.rgba(c.light, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-50, -50, 2150, 2150);
  };

  // ---- activity details (each appears only when that activity is chosen) ----
  // Kept inside x 600–1450, y 260–1460: the part of the art both phones and desktops show.

  function sparkle(ctx, x, y, s, color, alpha) {
    spot(ctx, x, y, s * 2.2, s * 2.2, color, alpha * 0.35);
    ctx.fillStyle = U.rgba(color, alpha);
    [0, Math.PI / 2].forEach(function (a) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-s * 1.6, 0);
      ctx.quadraticCurveTo(0, -s * 0.22, s * 1.6, 0);
      ctx.quadraticCurveTo(0, s * 0.22, -s * 1.6, 0);
      ctx.fill();
      ctx.restore();
    });
  }

  // stargazing: little stars in the sky
  P.stars = function (ctx, c, r) {
    var pos = [[640, 300], [760, 410], [1420, 300], [1360, 440], [1470, 520], [600, 520],
      [300, 330], [180, 520], [420, 600], [1700, 300], [1850, 470], [1620, 600], [990, 270], [520, 260]];
    pos.forEach(function (p, i) {
      var s = 9 + r() * 9;
      if (i % 3 === 2) spot(ctx, p[0], p[1], s, s, c.ochre, 0.8);
      else sparkle(ctx, p[0], p[1], s, i % 2 ? c.ochre : mix(c.ochre, c.light, 0.5), 0.85);
    });
  };

  // breakfast in bed: a soft morning sun
  P.sun = function (ctx, c, r, n) {
    spot(ctx, 700, 330, 330, 330, c.light, 0.55);
    wash(ctx, blob(700, 330, 72, 72, n, 3, 0.12, 40), mix(c.ochre, c.light, 0.35), 0.75, r, { jitter: 4, rim: 1, rimWidth: 14, lifts: 1 });
  };

  // sunset by the water: warm glow on the horizon and its reflection
  P.sunset = function (ctx, c, r) {
    var g = ctx.createLinearGradient(0, 760, 0, 1092);
    g.addColorStop(0, U.rgba(c.coral, 0));
    g.addColorStop(0.6, U.rgba(c.coral, 0.22));
    g.addColorStop(1, U.rgba(c.rose, 0.32));
    ctx.fillStyle = g;
    ctx.fillRect(-60, 760, 2170, 332);
    spot(ctx, 1500, 1060, 420, 120, c.ochre, 0.3);
    ctx.lineCap = 'round';
    for (var i = 0; i < 26; i++) {
      var y = 1104 + Math.pow(r(), 1.4) * 130, x = 1500 + (r() - 0.5) * 520 * (1 - (y - 1104) / 200), len = 40 + r() * 140;
      ctx.strokeStyle = U.rgba(i % 2 ? c.coral : c.ochre, 0.14 + r() * 0.2);
      ctx.lineWidth = 2 + r() * 3;
      ctx.beginPath(); ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y + (r() - 0.5) * 3); ctx.stroke();
    }
  };

  // movie night: fairy lights strung through the branches
  P.lights = function (ctx, c, r) {
    var strings = [[860, 690, 1390, 630, 150], [1000, 520, 1300, 500, 95]];
    strings.forEach(function (s) {
      var x0 = s[0], y0 = s[1], x1 = s[2], y1 = s[3], sag = s[4], steps = 14;
      var mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag * 2; // control point for the droop
      ctx.strokeStyle = U.rgba(c.ink, 0.28);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
      for (var i = 1; i < steps; i++) {
        var t = i / steps, u = 1 - t;
        var x = u * u * x0 + 2 * u * t * mx + t * t * x1, y = u * u * y0 + 2 * u * t * my + t * t * y1;
        var col = [c.ochre, c.light, c.coral][i % 3];
        spot(ctx, x, y + 9, 30, 30, c.light, 0.4);
        spot(ctx, x, y + 9, 9, 11, col, 0.95);
      }
    });
  };

  // picnic: a gingham blanket and a basket
  P.blanket = function (ctx, c, r, n) {
    var q = [[700, 1440], [745, 1385], [960, 1392], [950, 1452]];
    wash(ctx, q, c.rose, 0.85, r, { jitter: 4, passes: 3, rim: 1, rimWidth: 8 });
    ctx.save();
    ctx.beginPath(); q.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath();
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 8;
    for (var i = 0; i < 9; i++) { // stripes across and along, in perspective
      var t = (i + 0.5) / 9;
      ctx.beginPath(); ctx.moveTo(700 + 45 * (1 - t) + 0 * t, 1440 - 55 * t); ctx.lineTo(950 + 10 * t, 1452 - 60 * t); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(700 + 250 * t, 1440 + 12 * t); ctx.lineTo(745 + 215 * t, 1385 + 7 * t); ctx.stroke();
    }
    ctx.restore();
    // basket
    wash(ctx, [[880, 1380], [940, 1378], [934, 1412], [886, 1414]], c.trunk, 0.7, r, { jitter: 2, passes: 3, rim: 1.2, rimWidth: 6, shade: 0.6, shadeTo: 'right' });
    ctx.strokeStyle = U.rgba(c.trunk, 0.7);
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(887, 1382); ctx.quadraticCurveTo(910, 1340, 934, 1380); ctx.stroke();
  };

  // pottery: a little hand-made pot with a flower
  P.pot = function (ctx, c, r, n) {
    var x = 1000, y = 1440;
    taper(ctx, x + 4, y - 58, x - 6, y - 90, x + 2, y - 120, 4, 3, c.blade, 0.7);
    wash(ctx, blob(x + 2, y - 128, 16, 13, n, 7, 0.3, 14), c.blossom, 0.8, r, { jitter: 2, passes: 3, rim: 1.2, rimWidth: 5 });
    var body = [[x - 24, y - 60], [x + 24, y - 60], [x + 30, y - 40], [x + 36, y - 18], [x + 22, y], [x - 22, y], [x - 36, y - 18], [x - 30, y - 40]];
    wash(ctx, body, mix(c.coral, c.trunk, 0.35), 0.8, r, { jitter: 2, passes: 3, rim: 1.3, rimWidth: 8, shade: 0.8, shadeTo: 'right', lifts: 1 });
    ctx.fillStyle = U.rgba(darker(c.coral, 0.3), 0.5);
    ctx.beginPath(); ctx.ellipse(x, y - 60, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
  };

  // bookstore: a small stack of books by the trunk
  P.books = function (ctx, c, r) {
    var x = 1240, y = 1446, cols = [c.waterDeep, c.rose, c.ochre];
    for (var i = 0; i < 3; i++) {
      var w = 110 - i * 12, h = 22, bx = x + (r() - 0.5) * 14, by = y - i * h;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate((r() - 0.5) * 0.08);
      wash(ctx, [[-w / 2, -h], [w / 2, -h], [w / 2, 0], [-w / 2, 0]], cols[i], 0.75, r, { jitter: 2, passes: 3, rim: 1.2, rimWidth: 5 });
      ctx.fillStyle = 'rgba(252,250,246,0.85)'; // pages
      ctx.fillRect(w / 2 - 12, -h + 4, 9, h - 8);
      ctx.restore();
    }
  };

  // cook something new: a tiny vegetable patch
  P.veggies = function (ctx, c, r, n) {
    for (var row = 0; row < 3; row++) {
      var y = 1310 + row * 26, x0 = 1290 + row * 6, x1 = 1440 - row * 4;
      wash(ctx, [[x0, y - 6], [x1, y - 8], [x1 + 4, y + 6], [x0 - 4, y + 8]], c.trunk, 0.45, r, { jitter: 3, passes: 2, rim: 0.8, rimWidth: 5 });
      for (var x = x0 + 10; x < x1; x += 22 + r() * 8) {
        wash(ctx, blob(x, y - 10, 11, 8, n, x * 0.1 + row, 0.4, 12), row === 1 ? c.leaf3 : c.leaf, 0.7, r, { jitter: 2, passes: 2, rim: 1, rimWidth: 4 });
        if (row !== 1 && r() < 0.6) spot(ctx, x + 6, y - 6, 6, 6, row ? c.coral : c.rose, 0.95);
      }
    }
  };

  // How strongly the paper texture shows through each layer.
  var GRAIN = { sky: 0.7, horizon: 0, farHills: 0.9, water: 0.9, nearHills: 1, trunk: 0.8, canopy: 1, grass: 1, flowers: 0.6, petals: 0.6, light: 0,
    stars: 0.3, sun: 0.6, sunset: 0.6, lights: 0.2, blanket: 0.6, pot: 0.6, books: 0.6, veggies: 0.6 };

  var DEFAULT_COLORS = { skyWarm: '#f1dccb', leafDark: '#557a68', trunkDark: '#6b574b', ink: '#4f4a47' };

  G.placeholders = {
    has: function (name) { return Object.prototype.hasOwnProperty.call(P, name); },
    paint: function (name, ctx, cfg) {
      var fn = P[name];
      if (!fn) return;
      var seed = U.hash(name);
      var colors = Object.assign({}, DEFAULT_COLORS, cfg.palette);
      ctx.save();
      // Placeholders are authored for 2048; scale if the art size differs.
      var s = cfg.scene.size / 2048;
      if (s !== 1) ctx.scale(s, s);
      fn(ctx, colors, U.rng(seed), U.noise2D(seed));
      ctx.restore();
      if (GRAIN[name]) {
        try { granulate(ctx, GRAIN[name]); } catch (e) { /* texture is optional */ }
      }
    }
  };
})();

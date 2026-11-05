/*
  Procedural placeholder art: a soft watercolour garden, one painter per layer.
  Painters draw in art coordinates (config.scene.size, 2048 by default); the
  scene passes a context already transformed to the screen, so the result is sharp.
  Replace any layer with real art by changing its `image` path in config.js.
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;

  // ---- helpers -------------------------------------------------------------
  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 1], p1 = pts[i];
      ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
    }
    ctx.closePath();
  }

  function jitter(pts, rng, amt) {
    return pts.map(function (p) { return [p[0] + (rng() - 0.5) * amt, p[1] + (rng() - 0.5) * amt]; });
  }

  // A wash: several jittered translucent fills plus a faint darker edge (pigment pooling).
  function wash(ctx, pts, color, alpha, rng, o) {
    o = o || {};
    var passes = o.passes || 4, amt = o.jitter === undefined ? 14 : o.jitter;
    for (var i = 0; i < passes; i++) {
      ctx.fillStyle = U.rgba(color, (alpha / passes) * 1.7);
      path(ctx, jitter(pts, rng, amt));
      ctx.fill();
    }
    if (o.edge !== 0) {
      ctx.strokeStyle = U.rgba(color, alpha * 0.32);
      ctx.lineWidth = o.edge || 3;
      ctx.lineJoin = 'round';
      path(ctx, jitter(pts, rng, amt * 0.5));
      ctx.stroke();
    }
  }

  function blob(cx, cy, rx, ry, noise, seed, rough, count) {
    var pts = [], n = count || 36;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var k = 1 + (noise(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + seed) - 0.5) * (rough || 0.5);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }

  // Ridge line from left to right, closed down to `bottom`.
  function ridge(y0, amp, freq, noise, seed, bottom, x0, x1) {
    x0 = x0 === undefined ? -80 : x0; x1 = x1 === undefined ? 2130 : x1;
    var pts = [];
    for (var x = x0; x <= x1; x += 48) {
      var y = y0 + (noise.fbm(x * freq + seed, seed, 3) - 0.5) * amp * 2;
      pts.push([x, y]);
    }
    pts.push([x1, bottom], [x0, bottom]);
    return pts;
  }

  // ---- painters ------------------------------------------------------------
  var P = {};

  P.sky = function (ctx, c, r, n) {
    var g = ctx.createLinearGradient(0, 0, 0, 1180);
    g.addColorStop(0, U.rgba(c.skyTop, 0.62));
    g.addColorStop(0.55, U.rgba(c.sky, 0.38));
    g.addColorStop(1, U.rgba(c.sky, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-50, -50, 2150, 1240);
    for (var i = 0; i < 7; i++) {
      var y = 120 + r() * 650, x = r() * 2048;
      wash(ctx, blob(x, y, 260 + r() * 360, 50 + r() * 60, n, i * 3.1, 0.7), c.skyTop, 0.12, r, { jitter: 30, edge: 0 });
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
    wash(ctx, ridge(930, 90, 0.0016, n, 11, 1100), c.hillFar, 0.42, r, { jitter: 18 });
    wash(ctx, ridge(1000, 60, 0.0022, n, 37, 1100), c.hillFar2, 0.38, r, { jitter: 14 });
  };

  P.water = function (ctx, c, r, n) {
    var top = [], bot = [];
    for (var x = 140; x <= 1920; x += 40) {
      var t = (x - 140) / 1780;
      var swell = Math.sin(t * Math.PI);
      top.push([x, 1095 + (n(x * 0.01, 1) - 0.5) * 8]);
      bot.push([x, 1110 + swell * (110 + n(x * 0.006, 5) * 60)]);
    }
    var pts = top.concat(bot.reverse());
    wash(ctx, pts, c.water, 0.5, r, { jitter: 8 });
    ctx.lineCap = 'round';
    for (var i = 0; i < 26; i++) {
      var y = 1110 + r() * 150, x0 = 300 + r() * 1300, len = 60 + r() * 220;
      ctx.strokeStyle = U.rgba(c.waterDeep, 0.1 + r() * 0.12);
      ctx.lineWidth = 2 + r() * 4;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + len, y + (r() - 0.5) * 4); ctx.stroke();
    }
  };

  P.nearHills = function (ctx, c, r, n) {
    var left = [[-80, 1120]];
    for (var x = -80; x <= 1150; x += 50) {
      var t = (x + 80) / 1230;
      left.push([x, 1120 + t * t * 520 + (n.fbm(x * 0.004, 9, 3) - 0.5) * 60]);
    }
    left.push([1150, 2130], [-80, 2130]);
    wash(ctx, left, c.hillNear, 0.5, r, { jitter: 16 });
    var right = [];
    for (var x2 = 860; x2 <= 2130; x2 += 50) {
      var t2 = (2130 - x2) / 1270;
      right.push([x2, 1180 + t2 * t2 * 470 + (n.fbm(x2 * 0.004, 21, 3) - 0.5) * 60]);
    }
    right.push([2130, 2130], [860, 2130]);
    wash(ctx, right, c.hillNear2, 0.42, r, { jitter: 16 });
  };

  P.trunk = function (ctx, c, r, n) {
    var pts = [[1050, 1430], [1074, 1100], [1090, 880], [1100, 760], [1126, 760], [1128, 900], [1140, 1120], [1172, 1430]];
    wash(ctx, pts, c.trunk, 0.7, r, { jitter: 5, passes: 5 });
    ctx.lineCap = 'round';
    var branches = [[1110, 900, 920, 700, 16], [1112, 820, 1320, 640, 14], [1108, 780, 1060, 560, 12], [1120, 960, 1360, 820, 10]];
    branches.forEach(function (b) {
      for (var i = 0; i < 3; i++) {
        ctx.strokeStyle = U.rgba(c.trunk, 0.32);
        ctx.lineWidth = b[4] * (1 - i * 0.25);
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.quadraticCurveTo((b[0] + b[2]) / 2 + (r() - 0.5) * 30, (b[1] + b[3]) / 2 - 30, b[2] + (r() - 0.5) * 10, b[3]);
        ctx.stroke();
      }
    });
  };

  P.canopy = function (ctx, c, r, n) {
    var cols = [c.leaf, c.leaf2, c.leaf3];
    for (var i = 0; i < 16; i++) {
      var a = r() * Math.PI * 2, d = Math.sqrt(r());
      var x = 1110 + Math.cos(a) * d * 360, y = 620 + Math.sin(a) * d * 230;
      var rad = 110 + r() * 110;
      wash(ctx, blob(x, y, rad, rad * (0.75 + r() * 0.3), n, i * 2.7, 0.55), cols[i % 3], 0.34, r, { jitter: 16 });
    }
  };

  P.grass = function (ctx, c, r, n) {
    wash(ctx, ridge(1290, 50, 0.003, n, 51, 2130), c.grass, 0.4, r, { jitter: 20 });
    ctx.lineCap = 'round';
    for (var i = 0; i < 520; i++) {
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
      for (var j = 0; j < count; j++) {
        var x = cx + (r() - 0.5) * 70 * k, y = cy + (r() - 0.5) * 40 * k, rad = (9 + r() * 14) * k;
        wash(ctx, blob(x, y, rad, rad * 0.85, n, i * 5 + j, 0.6, 14), col, 0.6, r, { jitter: 3, passes: 3, edge: 1.5 });
      }
    }
  };

  P.petals = function (ctx, c, r, n) {
    for (var i = 0; i < 60; i++) {
      var a = r() * Math.PI * 2, d = Math.sqrt(r());
      var x = 1110 + Math.cos(a) * d * 420, y = 610 + Math.sin(a) * d * 270, rad = 10 + r() * 16;
      wash(ctx, blob(x, y, rad, rad * 0.8, n, i * 1.9, 0.6, 14), c.blossom, 0.55, r, { jitter: 3, passes: 3, edge: 1.5 });
    }
    for (var k = 0; k < 18; k++) {
      ctx.save();
      ctx.translate(800 + r() * 700, 900 + r() * 700);
      ctx.rotate(r() * Math.PI);
      ctx.fillStyle = U.rgba(c.blossom, 0.45);
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
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

  G.placeholders = {
    has: function (name) { return Object.prototype.hasOwnProperty.call(P, name); },
    paint: function (name, ctx, cfg) {
      var fn = P[name];
      if (!fn) return;
      var seed = U.hash(name);
      ctx.save();
      // Placeholders are authored for 2048; scale if the art size differs.
      var s = cfg.scene.size / 2048;
      if (s !== 1) ctx.scale(s, s);
      fn(ctx, cfg.palette, U.rng(seed), U.noise2D(seed));
      ctx.restore();
    }
  };
})();

/*
  Reveal-mask brushes. Real textures come from config.brushes (white on transparent PNG).
  Until those exist, a handful of organic watercolour blots/strokes are generated once
  at load (pixel work only on our own canvases, so no tainting issues).
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;

  var brushes = (G.brushes = { list: [], procedural: [], files: [] });

  var SIZE = 256;
  var KINDS = ['blot', 'stroke', 'bloom', 'stroke', 'blot', 'dry'];

  function generate(kind, seed) {
    var c = U.makeCanvas(SIZE, SIZE);
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(SIZE, SIZE);
    var d = img.data;
    var n = U.noise2D(seed);
    var rng = U.rng(seed * 7 + 1);

    // Edge radius per angle, precomputed (seamless around the circle).
    var A = 720, R = new Float32Array(A);
    var lumpy = kind === 'bloom' ? 0.5 : kind === 'dry' ? 0.35 : 0.42;
    var fingers = kind === 'bloom' ? 0.22 : 0.1;
    for (var i = 0; i < A; i++) {
      var a = (i / A) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      R[i] = 0.6 + (n.fbm(ca * 1.4 + 10, sa * 1.4 + 10, 4) - 0.5) * lumpy +
        (n(ca * 6 + 40, sa * 6 + 40) - 0.5) * fingers;
    }
    var squash = kind === 'stroke' || kind === 'dry' ? 0.5 : 1;
    var edge = kind === 'dry' ? 0.16 : 0.1;
    var gx = rng() * 50, gy = rng() * 50;

    var p = 0;
    for (var y = 0; y < SIZE; y++) {
      var ny = (y / (SIZE - 1)) * 2 - 1;
      for (var x = 0; x < SIZE; x++, p += 4) {
        var nx = (x / (SIZE - 1)) * 2 - 1;
        var sx = nx, sy = ny / squash;
        var r = Math.sqrt(sx * sx + sy * sy);
        var ang = Math.atan2(sy, sx);
        var ri = ((ang / (Math.PI * 2) + 1) % 1) * A;
        var Rr = R[ri | 0] * (squash < 1 ? 1.25 : 1);
        var al = U.smoothstep(Rr, Rr - edge, r);
        // Pigment pooling: slightly denser just inside the edge.
        if (r < Rr) {
          var q = (r - (Rr - edge * 0.55)) / 0.04;
          al += 0.22 * Math.exp(-q * q);
        }
        // Granulation inside the wash.
        al *= 0.8 + 0.2 * n.fbm(nx * 7 + gx, ny * 7 + gy, 2);
        if (kind === 'stroke' || kind === 'dry') {
          // Dry-brush streaks along the stroke, stronger towards the tail.
          var streak = n.fbm(nx * 1.1 + 60, ny * (kind === 'dry' ? 18 : 11) + 60, 2);
          var tail = U.smoothstep(0.1, -0.9, nx);
          al *= 1 - tail * (1 - U.smoothstep(0.32, 0.62, streak)) * (kind === 'dry' ? 0.9 : 0.6);
        }
        // Little satellite drops just outside the edge.
        if (r > Rr && r < Rr + 0.2) {
          var s = n(nx * 16 + 90, ny * 16 + 90);
          if (s > 0.74) al = Math.max(al, (s - 0.74) * 3.2 * (1 - (r - Rr) / 0.2));
        }
        // Never touch the texture border.
        al *= U.smoothstep(1, 0.9, Math.max(Math.abs(nx), Math.abs(ny)));
        d[p] = d[p + 1] = d[p + 2] = 255;
        d[p + 3] = U.clamp(al, 0, 1) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  brushes.init = function () {
    if (brushes.procedural.length) return;
    for (var i = 0; i < KINDS.length; i++) brushes.procedural.push(generate(KINDS[i], 1013 + i * 97));
    brushes.list = brushes.procedural.slice();
  };

  // Called once assets are loaded: real brush files replace the procedural ones.
  brushes.useFiles = function (imgs) {
    brushes.files = imgs.filter(Boolean);
    brushes.list = brushes.files.length ? brushes.files.slice() : brushes.procedural.slice();
  };

  // The set of brushes a layer draws from: 'auto' = all, a number = that brush.
  brushes.forLayer = function (spec) {
    var list = brushes.list;
    if (typeof spec === 'number' && list[spec]) return [list[spec]];
    if (Array.isArray(spec)) {
      var sel = spec.map(function (i) { return list[i]; }).filter(Boolean);
      if (sel.length) return sel;
    }
    return list;
  };
})();

/* Paper: one static grain overlay (generated once) plus the per-stage tint colour. */
(function () {
  'use strict';
  var G = window.Garden, U = G.util;

  function grainTile(size) {
    var c = U.makeCanvas(size, size);
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(size, size);
    var d = img.data;
    var n = U.noise2D(4242), r = U.rng(99);
    // Tileable fibres: sample noise on a torus so the tile repeats seamlessly.
    var TAU = Math.PI * 2;
    for (var y = 0, p = 0; y < size; y++) {
      for (var x = 0; x < size; x++, p += 4) {
        var u = (x / size) * TAU, v = (y / size) * TAU;
        var fib = n.fbm(Math.cos(u) * 2 + Math.cos(v) * 0.4 + 20, Math.sin(u) * 2 + Math.sin(v) * 7 + 20, 3);
        var blot = n.fbm(Math.cos(u) * 0.9 + 50, Math.sin(v) * 0.9 + 50, 2);
        var speck = r();
        var a = Math.max(0, fib - 0.52) * 0.22 + Math.max(0, blot - 0.55) * 0.12 + (speck > 0.985 ? 0.12 * r() : 0) + speck * 0.035;
        d[p] = 120; d[p + 1] = 108; d[p + 2] = 96;
        d[p + 3] = U.clamp(a, 0, 1) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  G.paper = {
    init: function (overlay, cfg) {
      if (!overlay) return;
      try {
        var tile = grainTile(256);
        overlay.style.backgroundImage = 'url(' + tile.toDataURL('image/png') + ')';
        overlay.style.backgroundSize = cfg.paper.grainSize + 'px ' + cfg.paper.grainSize + 'px';
        overlay.style.opacity = String(cfg.paper.grainOpacity);
        U.releaseCanvas(tile);
      } catch (e) { U.warn('paper grain unavailable', e); }
    },
    // Tint for a trigger, as [r,g,b], or null if that trigger doesn't change the paper.
    tintFor: function (cfg, trigger) {
      var hex = cfg.stagePaperTint[trigger];
      return hex ? U.hexToRgb(hex) : null;
    },
    // Latest tint among a list of fired triggers (for instant restore).
    tintForFired: function (cfg, fired) {
      var out = null;
      cfg.triggers.forEach(function (t) {
        if (fired.indexOf(t) >= 0 && cfg.stagePaperTint[t]) out = U.hexToRgb(cfg.stagePaperTint[t]);
      });
      return out || U.hexToRgb(cfg.stagePaperTint.start || cfg.palette.paper || '#fbfaf8');
    }
  };
})();

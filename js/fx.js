/*
  Falling petals for the final bloom. Plain DOM elements animated with CSS
  transforms only, so the browser moves them on the compositor without
  repainting the garden canvas.
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;
  var fx = (G.fx = {});
  var host = null, cleanup = null;

  fx.petals = function (cfg) {
    var n = Math.max(0, Math.round(cfg.fx.petals || 0));
    if (!n || U.reducedMotion()) return;
    fx.stop();
    host = document.createElement('div');
    host.className = 'petals';
    var r = U.rng(Date.now() & 0xffff), colors = cfg.fx.colors, longest = 0;
    for (var i = 0; i < n; i++) {
      var fall = document.createElement('span');
      var petal = document.createElement('span');
      fall.className = 'petal-fall';
      petal.className = 'petal';
      var dur = (9 + r() * 7) / G.speed, delay = ((i / n) * 7 + r() * 1.5) / G.speed;
      longest = Math.max(longest, dur + delay);
      fall.style.left = (r() * 104 - 2).toFixed(1) + '%';
      fall.style.animationDuration = dur.toFixed(2) + 's';
      fall.style.animationDelay = delay.toFixed(2) + 's';
      petal.style.animationDuration = (2.6 + r() * 2.4).toFixed(2) + 's';
      petal.style.animationDelay = (-r() * 4).toFixed(2) + 's';
      var s = 9 + r() * 9;
      petal.style.width = s.toFixed(1) + 'px';
      petal.style.height = (s * (0.62 + r() * 0.2)).toFixed(1) + 'px';
      petal.style.background = colors[i % colors.length];
      petal.style.setProperty('--sway', (14 + r() * 26).toFixed(0) + 'px');
      petal.style.setProperty('--spin', (r() < 0.5 ? -1 : 1) * (120 + r() * 220) + 'deg');
      fall.appendChild(petal);
      host.appendChild(fall);
    }
    var world = document.getElementById('world');
    world.insertBefore(host, document.getElementById('grain'));
    var h = host, t = setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, (longest + 1) * 1000);
    cleanup = function () { clearTimeout(t); if (h.parentNode) h.parentNode.removeChild(h); };
  };

  fx.stop = function () { if (cleanup) cleanup(); cleanup = null; host = null; };
})();

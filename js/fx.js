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

  // After the bloom the garden keeps breathing: a few petals drift down forever and
  // specks of warm light float in the sky. Endless CSS loops, no JavaScript per frame.
  // Each group gets its own layer so it can fade in on its own.
  var moteHost = null, petalHost = null;

  function addHost() {
    var h = document.createElement('div');
    h.className = 'petals ambient';
    var world = document.getElementById('world');
    world.insertBefore(h, document.getElementById('grain'));
    return h;
  }
  function fadeIn(h) { void h.offsetWidth; h.classList.add('on'); }

  // withPetals: false = only the floating light (garden still grey), true = petals too.
  fx.ambient = function (cfg, withPetals) {
    if (U.reducedMotion()) return;
    var r = U.rng(4321), colors = cfg.fx.colors;
    var nM = Math.max(0, Math.round(cfg.fx.motes || 0));
    var nP = Math.max(0, Math.round(cfg.fx.ambientPetals || 0));
    if (!moteHost && nM) {
      moteHost = addHost();
      for (var k = 0; k < nM; k++) {
        var m = document.createElement('span');
        m.className = 'mote';
        var sz = 5 + r() * 9;
        m.style.width = m.style.height = sz.toFixed(1) + 'px';
        m.style.left = (8 + r() * 84).toFixed(1) + '%';
        m.style.top = (6 + r() * 50).toFixed(1) + '%';
        m.style.animationDuration = (7 + r() * 7).toFixed(1) + 's';
        m.style.animationDelay = (-r() * 14).toFixed(1) + 's';
        m.style.setProperty('--dx', ((r() - 0.5) * 70).toFixed(0) + 'px');
        m.style.setProperty('--dy', (-20 - r() * 50).toFixed(0) + 'px');
        moteHost.appendChild(m);
      }
      fadeIn(moteHost);
    }
    if (withPetals && !petalHost && nP) {
      petalHost = addHost();
      for (var i = 0; i < nP; i++) {
        var fall = document.createElement('span'), petal = document.createElement('span');
        fall.className = 'petal-fall';
        petal.className = 'petal';
        var dur = 15 + r() * 9;
        fall.style.left = (6 + r() * 88).toFixed(1) + '%';
        fall.style.animationDuration = dur.toFixed(1) + 's';
        fall.style.animationIterationCount = 'infinite';
        // spread them out so one is always somewhere, never a burst
        fall.style.animationDelay = (-(i / nP) * dur + r() * 2).toFixed(1) + 's';
        petal.style.animationDuration = (3 + r() * 2.5).toFixed(2) + 's';
        var s = 8 + r() * 7;
        petal.style.width = s.toFixed(1) + 'px';
        petal.style.height = (s * 0.68).toFixed(1) + 'px';
        petal.style.background = colors[i % colors.length];
        petal.style.setProperty('--sway', (18 + r() * 22).toFixed(0) + 'px');
        petal.style.setProperty('--spin', (r() < 0.5 ? -1 : 1) * (140 + r() * 200) + 'deg');
        fall.appendChild(petal);
        petalHost.appendChild(fall);
      }
      fadeIn(petalHost);
    }
  };
  fx.stopAmbient = function () {
    [moteHost, petalHost].forEach(function (h) { if (h && h.parentNode) h.parentNode.removeChild(h); });
    moteHost = petalHost = null;
  };

  // The whole garden breathes: a very slow, tiny zoom in and out (CSS only).
  fx.breathe = function (cfg) {
    var amt = +cfg.fx.breathe || 0;
    var sc = document.getElementById('scene');
    if (!amt || U.reducedMotion() || !sc) return;
    sc.style.setProperty('--breathe', String(1 + amt));
    sc.style.transformOrigin = (cfg.scene.focal[0] * 100) + '% ' + (cfg.scene.focal[1] * 100) + '%';
    sc.classList.add('breathing');
  };

  fx.stop = function () {
    if (cleanup) cleanup();
    cleanup = null; host = null;
    fx.stopAmbient();
  };
})();
